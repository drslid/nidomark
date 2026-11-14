/**
 * Sorts a collection into a new tree: quick access icons at the start of the bookmarks bar, then a dozen groups,
 * precise categories inside them and, for big categories, a third level by site or subject.
 * Each bookmark is assessed from the most certain evidence to the least: a dead site, an address only reachable
 * at home, adult content, the user's earlier choices, a known site, the shape of the address, then the local
 * model on its title and, when needed, its page.
 */
import { normalizeUrl } from './duplicates';
import type { LabeledVector } from './examples';
import { type SiteVerdict, pageText } from './site';
import {
  CATEGORIES,
  GROUPS,
  type Category,
  type GroupId,
  addressPattern,
  adultTitle,
  categoryById,
  folderRole,
  isBackupTitle,
  keywordHits,
  knownSite,
  localName,
} from './taxonomy';
import type { Features, FolderItem, NewFolder, Placement, Proposal, Reason, ReviewItem, Snapshot, Target, Usage } from './types';
import { USAGES } from './types';
import { fold, words } from './text';
import { specialName } from './names';
import { siteKey } from './url';
import { allKnownAppsIn, leadingEmoji, stripEmoji, usageOfFolderTitle } from './vocab';

export interface CategorizeOptions {
  /** Nearest labelled examples consulted for each bookmark. */
  knnK: number;
  /** How fast the weight of an example falls with its distance to the nearest one. */
  knnTau: number;
  /** Weight of the similarity to the category descriptions, next to the examples. */
  protoWeight: number;
  /** Lead the best category needs over the second, from the title and address alone. */
  margin: number;
  /** Lead it needs once the page was read. */
  marginPage: number;
  /** Lead above which reading the page is not worth it. */
  marginSure: number;
  /** Weight of each keyword found. */
  keywordWeight: number;
  /** Bonus of the platform's own category (YouTube → Videos) when the subject is unclear. */
  platformPrior: number;
  /** A category gets its own subfolder inside a group from this many bookmarks. */
  subfolderMin: number;
  /** How much bookmarks must relate to the name of a personal folder for it to be kept as it is. */
  zCoherent: number;
  /** Icons of the most visited sites at the start of the bookmarks bar (0: none). */
  quickAccess: number;
  /** Visits a site needs (typed visits count twice) to earn a place in quick access. */
  quickMinVisits: number;
  /** A category folder is split by site or subject from this many bookmarks. */
  facetFolderMin: number;
  /** Bookmarks a site or a subject needs to get its own subfolder. */
  facetMin: number;
  /** Subfolders per category, at most. */
  maxFacets: number;
  /** Categories suggested for each bookmark to check. */
  suggestions: number;
  /** Bookmarks of a site that must agree on a category for an unclear page of the site to follow them. */
  siteConsensus: number;
}

export const DEFAULT_CATEGORIZE: CategorizeOptions = {
  knnK: 5,
  knnTau: 0.02,
  protoWeight: 0.2,
  margin: 0.5,
  marginPage: 0.3,
  marginSure: 1.2,
  keywordWeight: 0.6,
  platformPrior: 0.5,
  subfolderMin: 2,
  zCoherent: 0.8,
  quickAccess: 10,
  quickMinVisits: 10,
  facetFolderMin: 10,
  facetMin: 4,
  maxFacets: 6,
  suggestions: 3,
  siteConsensus: 2,
};

/** The new tree has three levels at most: group › category › site or subject. */
export const MAX_LEVEL = 3;
/** Key of the folder of bookmarks to check. */
export const REVIEW_KEY = 'review';

const BRANDS: Record<string, string> = {
  'youtube.com': 'YouTube', 'github.com': 'GitHub', 'gitlab.com': 'GitLab', 'reddit.com': 'Reddit', 'medium.com': 'Medium', 'wikipedia.org': 'Wikipedia',
  'stackoverflow.com': 'Stack Overflow', 'linkedin.com': 'LinkedIn', 'facebook.com': 'Facebook', 'instagram.com': 'Instagram', 'pinterest.com': 'Pinterest',
  'pinterest.fr': 'Pinterest', 'x.com': 'X', 'twitter.com': 'X', 'amazon.fr': 'Amazon', 'amazon.com': 'Amazon', 'google.com': 'Google', 'dev.to': 'DEV',
  'twitch.tv': 'Twitch', 'netflix.com': 'Netflix', 'spotify.com': 'Spotify', 'deezer.com': 'Deezer', 'soundcloud.com': 'SoundCloud', 'vimeo.com': 'Vimeo',
  'dailymotion.com': 'Dailymotion', 'notion.so': 'Notion', 'leboncoin.fr': 'leboncoin', 'marmiton.org': 'Marmiton', 'allocine.fr': 'AlloCiné',
};

/** Display name of a site: its brand when known, else its domain name capitalised ("korben.info" → "Korben"). */
export function siteName(domain: string): string {
  if (BRANDS[domain]) return BRANDS[domain] as string;
  const label = domain.split('.')[0] ?? domain;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Words of a host name, its public suffix and "www" aside: "recettes.mamie-gateaux.fr" → "recettes mamie gateaux". */
function hostWords(f: Features): string {
  const suffix = f.registrable.includes('.') ? f.registrable.slice(f.registrable.indexOf('.')) : '';
  const name = suffix && f.host.endsWith(suffix) ? f.host.slice(0, -suffix.length) : f.host;
  return name.replace(/^www\./, '').replace(/[.-]+/g, ' ');
}

/** How deep an address goes: a home page is 0. */
function pathDepth(url: string): number {
  try {
    const u = new URL(url);
    return u.pathname.split('/').filter(Boolean).length + (u.search ? 1 : 0);
  } catch {
    return 99;
  }
}

export type Destination = 'bar' | 'other';

export interface CategorizeInput {
  snapshot: Snapshot;
  features: Map<string, Features>;
  /** Bookmarks to sort. */
  candidates: string[];
  /** Vector of each bookmark's title and address. */
  vectors: Map<string, Float32Array>;
  /** Vector of the page text, for the pages that were read. */
  pageVectors: Map<string, Float32Array>;
  /** Vector describing each category. */
  prototypes: Map<string, Float32Array>;
  /** Typical bookmarks of each category (lib/data/examples.ts). */
  labeled: LabeledVector[];
  usageVectors: Record<Usage, Float32Array>;
  /** Vector of each folder title. */
  folderVectors: Map<string, Float32Array>;
  /** Pages read and sites checked. */
  sites: Map<string, SiteVerdict>;
  /** Copies to remove, each with the copy kept. */
  duplicates?: { bookmarkId: string; keepId: string }[];
  /** Whether pages could be read at all (permission granted and option on). */
  siteReading: boolean;
  /** Categories the user chose in earlier sorts: by address and by site. */
  learned?: { urls: Map<string, string>; domains: Map<string, string> };
  /** Visits of each site (`siteKey`: host and port) from the browsing history, typed visits counting twice. */
  hostVisits?: Map<string, number>;
  /** The bookmarks bar is rebuilt: quick access goes at its start. Without it, the bar is left as it is. */
  barInScope?: boolean;
  /** Folders created by earlier sorts: folder → group, category or special role, and the name it was given. */
  known: Map<string, { group?: GroupId; category?: string; role?: string; name?: string }>;
  /** Folders this sort leaves as they are (outside the chosen folders): those of earlier sorts take their bookmarks. */
  remaining?: Set<string>;
  destination: Destination;
  lang: string;
  options?: Partial<CategorizeOptions>;
}

export interface Assessment {
  category: string | null;
  confidence: 'evident' | 'model' | 'none';
  reason: Reason;
  /** Reading the page could make the decision clearer. */
  unclear: boolean;
  /** Categories the model leans to when it is not sure, the most likely first: suggested for bookmarks to check. */
  suggestions?: string[];
}

export interface CategorizeResult {
  proposal: Proposal;
  assessments: Map<string, Assessment>;
}

const HOME_AUTOMATION_APPS = new Set(['Home Assistant', 'ESPHome', 'Node-RED', 'Frigate']);
const BIG_PLATFORMS = /(^|\.)(google|microsoft|live|office|amazon|apple|icloud|github|gitlab|atlassian|notion|dropbox|yahoo|facebook|adobe|salesforce|zoom|slack|ovh|orange|free|sfr|bouyguestelecom)\./;
/** Categories the model may choose; the others come from rules only. */
export const MODEL_CATEGORIES = CATEGORIES.filter((c) => c.id !== 'dead' && c.id !== 'home-services');
/** Moved even out of the user's own folders. */
const STRONG = new Set(['adult', 'dead']);

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] as number) * (b[i] as number);
  return s;
}

function softmax(o: Record<Usage, number>, t = 0.05): Record<Usage, number> {
  const max = Math.max(...USAGES.map((k) => o[k]));
  const e = USAGES.map((k) => Math.exp((o[k] - max) / t));
  const sum = e.reduce((a, b) => a + b, 0);
  return Object.fromEntries(USAGES.map((k, i) => [k, (e[i] as number) / sum])) as Record<Usage, number>;
}

/** Scores of a vector against every category, standardised: "how many standard deviations above the others". */
function zScores(v: Float32Array, prototypes: Map<string, Float32Array>): Map<string, number> {
  const sims = MODEL_CATEGORIES.map((c) => {
    const p = prototypes.get(c.id);
    return p ? dot(v, p) : 0;
  });
  const mu = sims.reduce((a, b) => a + b, 0) / sims.length;
  const sd = Math.sqrt(sims.reduce((a, b) => a + (b - mu) ** 2, 0) / sims.length) || 1;
  return new Map(MODEL_CATEGORIES.map((c, i) => [c.id, ((sims[i] as number) - mu) / sd]));
}

/** Characters a page must say about itself to count as evidence. */
const MIN_PAGE_TEXT = 40;

const DEAD_KEYS: Record<string, string> = { network: 'deadNetwork', timeout: 'deadTimeout', gone: 'deadGone', server: 'deadServer', parked: 'deadParked' };

export function categorize(input: CategorizeInput): CategorizeResult {
  const o = { ...DEFAULT_CATEGORIZE, ...input.options };
  const { snapshot, features, lang } = input;
  const bookmark = (id: string) => snapshot.bookmarks.get(id);

  // Usage (access a service, use a tool, learn, read, follow), from rules and zero-shot similarity.
  const usageOf = (id: string): Usage => {
    const f = features.get(id) as Features;
    const v = input.vectors.get(id);
    if (!v) return f.usage;
    const zs = softmax(Object.fromEntries(USAGES.map((k) => [k, dot(v, input.usageVectors[k])])) as Record<Usage, number>);
    let best: Usage = f.usage;
    let bestScore = -Infinity;
    for (const k of USAGES) {
      const s = f.usageScores[k] + 2 * zs[k];
      if (s > bestScore) {
        bestScore = s;
        best = k;
      }
    }
    return best;
  };

  // Personal domains: several services on subdomains of one domain (jellyfin.example.fr, cloud.example.fr).
  const hostsByDomain = new Map<string, Set<string>>();
  for (const f of features.values()) {
    if (f.privateHost || !f.registrable || f.host === f.registrable) continue;
    const s = hostsByDomain.get(f.registrable) ?? new Set<string>();
    s.add(f.host);
    hostsByDomain.set(f.registrable, s);
  }
  const isHome = (id: string): boolean => {
    const f = features.get(id) as Features;
    if (f.privateHost || f.remoteAccessHost) return true;
    if (usageOf(id) !== 'access') return false;
    const b = bookmark(id);
    return (hostsByDomain.get(f.registrable)?.size ?? 0) >= 2 && !BIG_PLATFORMS.test(`.${f.registrable}`) && !(b && knownSite(b.url));
  };
  const homeApps = new Set(input.candidates.filter((id) => features.has(id) && isHome(id)).flatMap((id) => allKnownAppsIn((features.get(id) as Features).bestTitle)));

  /** Decisions that need no model: dead sites, home services, adult content, known sites and addresses. */
  function ruleAssess(id: string): Assessment | null {
    const b = bookmark(id);
    const f = features.get(id);
    if (!b || !f) return { category: null, confidence: 'none', reason: { key: 'reviewUnclear' }, unclear: false };
    const verdict = input.sites.get(id);
    const known = knownSite(b.url);
    const page = verdict?.kind === 'ok' ? verdict.page : undefined;

    // 1. Services hosted at home: a home server that is switched off is not a dead site.
    if (isHome(id)) return { category: 'home-services', confidence: 'evident', reason: { key: 'reasonHomeService' }, unclear: false };
    // 2. A site that no longer answers. Never for well-known sites that merely failed to connect: a filtering
    //    proxy or a captive portal looks the same.
    if (verdict?.kind === 'dead') {
      const transient = verdict.reason === 'network' || verdict.reason === 'timeout';
      if (!(transient && known && !known.platform)) {
        const detail = verdict.status ? `${verdict.status}` : '';
        return { category: 'dead', confidence: 'evident', reason: { key: DEAD_KEYS[verdict.reason] ?? 'deadNetwork', subs: detail ? [detail] : [] }, unclear: false };
      }
    }
    // 3. Adult content, from any evidence.
    const pattern = addressPattern(f.host);
    if (known?.category === 'adult' || pattern?.category === 'adult' || adultTitle(`${f.bestTitle} ${f.pathWords}`) || page?.adult || (page && adultTitle(`${page.title} ${page.description}`))) {
      const reason: Reason = known?.category === 'adult' ? { key: 'reasonKnownSite', subs: [known.site] } : page?.adult ? { key: 'reasonAdultPage' } : { key: 'reasonAdultWords' };
      return { category: 'adult', confidence: 'evident', reason, unclear: false };
    }
    // 4. The user's own choice in an earlier sort, for this address or this site.
    const norm = normalizeUrl(b.url) ?? b.url;
    const learnedUrl = input.learned?.urls.get(norm);
    const learnedSite = !known?.platform && f.registrable ? input.learned?.domains.get(f.registrable) : undefined;
    const learned = learnedUrl ?? learnedSite;
    if (learned && categoryById(learned)) {
      const c = categoryById(learned) as Category;
      return { category: learned, confidence: 'evident', reason: learnedUrl ? { key: 'reasonLearned', subs: [localName(c, lang)] } : { key: 'reasonLearnedSite', subs: [f.registrable, localName(c, lang)] }, unclear: false };
    }
    // 5. Known sites and typical addresses.
    if (known && !known.platform) return { category: known.category, confidence: 'evident', reason: { key: 'reasonKnownSite', subs: [known.site] }, unclear: false };
    if (pattern) return { category: pattern.category, confidence: 'evident', reason: { key: 'reasonPattern', subs: [pattern.label] }, unclear: false };
    // 5. Pages about self-hosted applications.
    const app = allKnownAppsIn(`${f.bestTitle} ${page?.title ?? ''}`)[0];
    if (app) {
      if (HOME_AUTOMATION_APPS.has(app)) return { category: 'home-automation', confidence: 'evident', reason: { key: 'reasonAboutApp', subs: [app] }, unclear: false };
      if (homeApps.has(app) || ['learn', 'read'].includes(usageOf(id))) return { category: 'selfhost', confidence: 'evident', reason: { key: 'reasonSelfHostGuide', subs: [app] }, unclear: false };
    }
    return null;
  }

  const ruled = new Map(input.candidates.map((id) => [id, ruleAssess(id)]));
  // The bookmarks recognised for sure teach the model about this collection, next to the built-in examples.
  const labeled: LabeledVector[] = [...input.labeled];
  for (const [id, a] of ruled) {
    const v = input.vectors.get(id);
    if (v && a?.category && a.category !== 'home-services' && a.category !== 'dead') labeled.push({ category: a.category, vector: v });
  }
  const scoredIds = new Set(MODEL_CATEGORIES.map((c) => c.id));

  /** Votes of the nearest labelled bookmarks, weighted by how close each is compared with the nearest one. */
  function knn(v: Float32Array): Map<string, number> {
    const top: { c: string; s: number }[] = [];
    for (const l of labeled) {
      if (!scoredIds.has(l.category)) continue;
      const s = dot(v, l.vector);
      if (top.length < o.knnK) top.push({ c: l.category, s });
      else if (s > (top[top.length - 1] as { s: number }).s) top[top.length - 1] = { c: l.category, s };
      else continue;
      top.sort((a, b) => b.s - a.s);
    }
    const best = top[0]?.s ?? 0;
    const votes = new Map<string, number>();
    for (const x of top) votes.set(x.c, (votes.get(x.c) ?? 0) + Math.exp((x.s - best) / o.knnTau));
    return votes;
  }

  function modelScores(v: Float32Array): Map<string, number> {
    const votes = knn(v);
    const z = zScores(v, input.prototypes);
    return new Map(MODEL_CATEGORIES.map((c) => [c.id, (votes.get(c.id) ?? 0) + o.protoWeight * (z.get(c.id) ?? 0)]));
  }

  function assess(id: string): Assessment {
    const ruledOut = ruled.get(id);
    if (ruledOut) return ruledOut;
    const b = bookmark(id) as { url: string };
    const f = features.get(id) as Features;
    const verdict = input.sites.get(id);
    const known = knownSite(b.url);
    const read = verdict?.kind === 'ok' ? verdict.page : undefined;
    // A page that says almost nothing (a login form, an empty shell) is no evidence: its site's home page will be.
    const page = read && pageText(read).length >= MIN_PAGE_TEXT ? read : undefined;
    // 6. The model, on the title and address, and on the page when it was read.
    const v = input.vectors.get(id);
    const pv = page ? input.pageVectors.get(id) : undefined;
    const st = v ? modelScores(v) : null;
    const sp = pv ? modelScores(pv) : null;
    // The words of the address help when the page could not be read; a page that was read says more.
    const titleHits = keywordHits(`${f.bestTitle} ${f.pathWords} ${read ? '' : hostWords(f)}`);
    const pageHits = page ? keywordHits(`${page.title} ${page.description} ${page.keywords} ${page.headings.join(' ')}`) : new Map<string, number>();
    const rank = (weights: { title: number; page: number }) => {
      const scores = new Map<string, number>();
      for (const c of MODEL_CATEGORIES) {
        let x = (st?.get(c.id) ?? 0) * weights.title + (sp?.get(c.id) ?? 0) * weights.page;
        x += o.keywordWeight * Math.min((weights.title ? (titleHits.get(c.id) ?? 0) : 0) + (weights.page ? (pageHits.get(c.id) ?? 0) : 0), 2);
        if (known?.platform && known.category === c.id) x += o.platformPrior;
        scores.set(c.id, x);
      }
      const order = [...scores.entries()].sort((a, b2) => b2[1] - a[1]);
      const [first, second] = order;
      return { category: first?.[0], lead: first && second ? first[1] - second[1] : 0, order: order.map(([c]) => c) };
    };
    // The clearest evidence wins: the title and the page together, or either one when the other is ambiguous.
    const fromTitle = st ? rank({ title: 1, page: 0 }) : null;
    const fromPage = sp ? rank({ title: 0, page: 1 }) : null;
    const together = st && sp ? rank({ title: 0.5, page: 0.5 }) : null;
    const choice =
      together && together.lead >= o.marginPage
        ? { ...together, from: 'page' as const }
        : fromTitle && fromTitle.lead >= o.margin
          ? { ...fromTitle, from: 'title' as const }
          : fromPage && fromPage.lead >= o.margin
            ? { ...fromPage, from: 'page' as const }
            : null;
    if (choice?.category) {
      const c = categoryById(choice.category) as Category;
      const reason: Reason = choice.from === 'page' && page ? { key: 'reasonPage', subs: [(page.description || page.title).slice(0, 90)] } : { key: 'reasonModel', subs: [localName(c, lang)] };
      return { category: c.id, confidence: 'model', reason, unclear: !page && choice.lead < o.marginSure };
    }
    // 7. A platform without a clear subject: its own category.
    if (known?.platform) return { category: known.category, confidence: 'model', reason: { key: 'reasonPlatform', subs: [known.site] }, unclear: !page };
    // Suggestions for the user, the model's lean first: adult content is only ever decided by the rules.
    const lean = together ?? fromTitle ?? fromPage;
    const suggestions = [...(known?.platform ? [known.category] : []), ...(lean?.order ?? [])].filter((c, i, all) => c !== 'adult' && all.indexOf(c) === i).slice(0, o.suggestions);
    // 8. Not enough evidence.
    const reason: Reason =
      verdict?.kind === 'blocked'
        ? { key: 'reviewBlocked', subs: [String(verdict.status)] }
        : read
          ? { key: 'reviewUnclearPage' }
          : f.insufficient || f.vagueTitle
            ? { key: input.siteReading ? 'reviewVague' : 'reviewNoAccess' }
            : { key: input.siteReading ? 'reviewUnclear' : 'reviewNoAccess' };
    return { category: null, confidence: 'none', reason, unclear: !read && verdict?.kind !== 'blocked', suggestions };
  }

  const assessments = new Map(input.candidates.map((id) => [id, assess(id)]));

  // The pages of one site usually share its subject: a page the model could not place follows the other bookmarks
  // of its site when they agree (the unclear posts of a tech blog go with its other posts). Sites that publish on
  // every subject, home addresses and links of the user's own domains are left out.
  const siteVotes = new Map<string, Map<string, number>>();
  const siteOf = (id: string): string => {
    const f = features.get(id);
    const b = bookmark(id);
    if (!f?.registrable || !b || f.privateHost || isHome(id) || knownSite(b.url)?.platform || BIG_PLATFORMS.test(`.${f.registrable}`)) return '';
    return f.registrable;
  };
  for (const [id, a] of assessments) {
    const site = a.category && a.confidence !== 'none' && !STRONG.has(a.category) && a.category !== 'home-services' ? siteOf(id) : '';
    if (!site) continue;
    const votes = siteVotes.get(site) ?? new Map<string, number>();
    votes.set(a.category as string, (votes.get(a.category as string) ?? 0) + 1);
    siteVotes.set(site, votes);
  }
  for (const [id, a] of assessments) {
    if (a.category) continue;
    const site = siteOf(id);
    const votes = site ? siteVotes.get(site) : undefined;
    if (!votes) continue;
    const total = [...votes.values()].reduce((n, x) => n + x, 0);
    const [best, n] = [...votes.entries()].sort((x, y) => y[1] - x[1])[0] as [string, number];
    if (n >= o.siteConsensus && n / total >= 2 / 3) {
      assessments.set(id, { category: best, confidence: 'model', reason: { key: 'reasonSameSite', subs: [String(n), site] }, unclear: false });
    } else a.suggestions = [best, ...(a.suggestions ?? []).filter((c) => c !== best)].slice(0, o.suggestions);
  }

  // --- Folders ------------------------------------------------------------------------------------------
  const backup = new Set<string>();
  for (const f of snapshot.folders.values()) if (!f.isRoot && isBackupTitle(f.title)) backup.add(f.id);
  const inBackup = (folderId: string | undefined): boolean => {
    let cur = folderId ? snapshot.folders.get(folderId) : undefined;
    while (cur && !cur.isRoot) {
      if (backup.has(cur.id)) return true;
      cur = cur.parentId ? snapshot.folders.get(cur.parentId) : undefined;
    }
    return false;
  };
  // Folders named with an emoji only ("🎬", "📺") are recognised by it; a group's emoji means the group.
  const emojiRole = new Map<string, { group?: GroupId; category?: string }>();
  for (const c of CATEGORIES) emojiRole.set(c.emoji, { category: c.id });
  for (const g of GROUPS) {
    const own = CATEGORIES.filter((x) => x.group === g.id);
    emojiRole.set(g.emoji, own.length > 1 ? { group: g.id } : { category: own[0]?.id });
  }

  interface FolderInfo {
    f: FolderItem;
    kind: 'category' | 'group' | 'catch-all' | 'personal' | 'root';
    category?: string;
    group?: GroupId;
    coherent: boolean;
    /** Folders organised by use ("Tools", "Read later") keep the bookmarks used that way, whatever their subject. */
    usage?: Usage | null;
  }
  const folderInfo = new Map<string, FolderInfo>();
  const memberIds = (f: FolderItem) => f.bookmarkIds.filter((id) => features.has(id));
  for (const f of snapshot.folders.values()) {
    if (f.unmodifiable || backup.has(f.id) || inBackup(f.parentId)) continue;
    const usage = f.isRoot ? null : usageOfFolderTitle(f.title);
    if (f.isRoot) {
      folderInfo.set(f.id, { f, kind: 'root', coherent: false });
      continue;
    }
    // The folder of bookmarks to check of an earlier sort is emptied, whatever its name has become.
    if (input.known.get(f.id)?.role === 'review') {
      folderInfo.set(f.id, { f, kind: 'catch-all', coherent: false });
      continue;
    }
    const k = input.known.get(f.id) ?? (leadingEmoji(f.title) === f.title.trim() ? emojiRole.get(f.title.trim()) : undefined);
    if (k?.category) {
      folderInfo.set(f.id, { f, kind: 'category', category: k.category, coherent: true });
      continue;
    }
    if (k?.group) {
      folderInfo.set(f.id, { f, kind: 'group', group: k.group, coherent: true });
      continue;
    }
    // A name made of an unknown emoji only ("🦄") still means something to the user: it is not an untitled folder.
    const emojiOnly = !!f.title.trim() && leadingEmoji(f.title) === f.title.trim();
    const role = emojiOnly ? ({ kind: 'personal' } as const) : folderRole(f.title);
    if (role.kind === 'category') folderInfo.set(f.id, { f, kind: 'category', category: role.category, coherent: true, usage });
    else if (role.kind === 'group') folderInfo.set(f.id, { f, kind: 'group', group: role.group, coherent: true, usage });
    else if (role.kind === 'catch-all' && !usage) folderInfo.set(f.id, { f, kind: 'catch-all', coherent: false });
    else folderInfo.set(f.id, { f, kind: 'personal', coherent: !!usage, usage });
  }

  // How much a bookmark relates to a folder name, compared with every other folder name and category.
  const references = [...input.folderVectors.values(), ...input.prototypes.values()];
  const relatedness = (id: string, folderId: string): number => {
    const v = input.vectors.get(id);
    const fv = input.folderVectors.get(folderId);
    if (!v || !fv || references.length < 3) return 0;
    const sims = references.map((r) => dot(v, r));
    const mu = sims.reduce((a, b) => a + b, 0) / sims.length;
    const sd = Math.sqrt(sims.reduce((a, b) => a + (b - mu) ** 2, 0) / sims.length) || 1;
    return (dot(v, fv) - mu) / sd;
  };

  // Personal folders are kept when their bookmarks belong together: one dominant group, or a shared subject
  // with the folder name ("Mariage 2025": venues, caterers and dresses are all about the wedding).
  for (const info of folderInfo.values()) {
    if (info.kind !== 'personal' || info.usage) continue;
    const members = memberIds(info.f);
    if (!members.length) {
      info.coherent = true;
      continue;
    }
    const groups = new Map<GroupId, number>();
    let categorized = 0;
    for (const id of members) {
      const a = assessments.get(id);
      const c = a?.category ? categoryById(a.category) : undefined;
      if (!c || STRONG.has(c.id)) continue;
      categorized++;
      groups.set(c.group, (groups.get(c.group) ?? 0) + 1);
    }
    const [topGroup, topCount] = [...groups.entries()].sort((a, b) => b[1] - a[1])[0] ?? [undefined, 0];
    const concentrated = categorized >= 3 && topCount / categorized >= 0.6;
    const related = members.reduce((s, id) => s + relatedness(id, info.f.id), 0) / members.length;
    info.coherent = concentrated || related >= o.zCoherent;
    if (concentrated && topGroup) info.group = topGroup;
  }

  // --- Layout: every bookmark gets a place in a new tree ------------------------------------------------
  const rootId = (input.destination === 'bar' ? snapshot.barId : snapshot.otherId) ?? snapshot.otherId ?? snapshot.barId ?? '';
  // Adult content, dead links and bookmarks to check never go to the always-visible bar.
  const otherRoot = snapshot.otherId ?? rootId;
  const removed = new Map((input.duplicates ?? []).map((d) => [d.bookmarkId, d.keepId]));
  const cat = (id: string): string | null => assessments.get(id)?.category ?? null;
  const strong = (id: string) => STRONG.has(cat(id) ?? '');

  // 1. Quick access: the most visited sites, as icons at the start of the bookmarks bar. Without history, the
  //    shortcuts the user already keeps in the bar.
  const quickAccess: string[] = [];
  const quickReason = new Map<string, Reason>();
  const candidateSet = new Set(input.candidates);
  const barIds = snapshot.barId ? (snapshot.folders.get(snapshot.barId)?.bookmarkIds ?? []).filter((id) => candidateSet.has(id) && !removed.has(id)) : [];
  if (o.quickAccess > 0 && snapshot.barId && input.barInScope !== false) {
    const eligible = (id: string) => features.has(id) && !removed.has(id) && !strong(id);
    if (input.hostVisits?.size) {
      // One icon per site: its shortest address (the home page rather than an article).
      const bySite = new Map<string, { id: string; score: number; depth: number }>();
      for (const id of input.candidates) {
        if (!eligible(id)) continue;
        const url = bookmark(id)?.url ?? '';
        const site = siteKey(url);
        const score = input.hostVisits.get(site) ?? 0;
        if (score < o.quickMinVisits) continue;
        const depth = pathDepth(url);
        const cur = bySite.get(site);
        if (!cur || depth < cur.depth) bySite.set(site, { id, score, depth });
      }
      for (const x of [...bySite.values()].sort((a, b) => b.score - a.score).slice(0, o.quickAccess)) {
        quickAccess.push(x.id);
        quickReason.set(x.id, { key: 'reasonQuickAccess' });
      }
    }
    // Without history, or when no bookmarked site is visited often: the shortcuts already in the bar, in their order.
    if (!quickAccess.length) {
      for (const id of barIds.filter(eligible).slice(0, o.quickAccess)) {
        quickAccess.push(id);
        quickReason.set(id, { key: 'reasonBarShortcut' });
      }
    }
  }
  // Bookmarklets and browser pages kept in the bar stay there: they are used from it, on any page.
  for (const id of barIds) {
    if (features.has(id)) continue;
    quickAccess.push(id);
    quickReason.set(id, { key: 'reasonBarTool' });
  }
  const quick = new Set(quickAccess);

  // 2. The user's folders that make sense are recreated with their bookmarks: under the category or the group
  //    they are about, or in "My folders" when they mix subjects ("Wedding 2025").
  interface Kept {
    info: FolderInfo;
    ids: string[];
    /** Bookmarks of each of its subfolders ("Wedding 2025" › "Caterers"), deeper levels included. */
    parts: Map<string, string[]>;
    category?: string;
    group?: GroupId;
  }
  const kept = new Map<string, Kept>();
  // The outermost folder that makes sense, so that a project keeps its parts together. A folder that only holds
  // folders ("Personal") is not a project by itself: its subfolders are judged one by one.
  const keptAbove = (folderId: string): { info: FolderInfo; part?: string } | undefined => {
    let found: { info: FolderInfo; part?: string } | undefined;
    let below: string | undefined;
    for (let cur = folderInfo.get(folderId); cur && cur.kind !== 'root'; cur = cur.f.parentId ? folderInfo.get(cur.f.parentId) : undefined) {
      if (cur.kind === 'personal' && cur.coherent && memberIds(cur.f).length) found = { info: cur, part: below };
      below = cur.f.id;
    }
    return found;
  };
  for (const id of input.candidates) {
    if (removed.has(id) || quick.has(id) || strong(id) || !features.has(id)) continue;
    const at = keptAbove(bookmark(id)?.parentId ?? '');
    if (!at) continue;
    const k: Kept = kept.get(at.info.f.id) ?? { info: at.info, ids: [], parts: new Map() };
    k.ids.push(id);
    if (at.part) k.parts.set(at.part, [...(k.parts.get(at.part) ?? []), id]);
    kept.set(at.info.f.id, k);
  }
  // A folder left with a single bookmark is not worth recreating: that bookmark is sorted like the others.
  for (const [fid, k] of kept) if (k.ids.length < 2) kept.delete(fid);
  for (const k of kept.values()) {
    const cats = new Map<string, number>();
    const groups = new Map<GroupId, number>();
    for (const id of k.ids) {
      const c = cat(id) ? categoryById(cat(id) as string) : undefined;
      if (!c) continue;
      cats.set(c.id, (cats.get(c.id) ?? 0) + 1);
      groups.set(c.group, (groups.get(c.group) ?? 0) + 1);
    }
    const [topCat, nCat] = [...cats.entries()].sort((a, b) => b[1] - a[1])[0] ?? [undefined, 0];
    const [topGroup, nGroup] = [...groups.entries()].sort((a, b) => b[1] - a[1])[0] ?? [undefined, 0];
    if (!k.info.usage && topCat && nCat >= 2 && nCat / k.ids.length >= 0.6) k.category = topCat;
    else if (!k.info.usage && topGroup && nGroup >= 3 && nGroup / k.ids.length >= 0.6) k.group = topGroup;
  }
  const keptOf = new Map<string, Kept>();
  for (const k of kept.values()) for (const id of k.ids) keptOf.set(id, k);

  // 3. Everything else by category; unclear bookmarks wait in "To check", links that are not web pages apart.
  const byCategory = new Map<string, string[]>();
  const toReview: string[] = [];
  const special: string[] = [];
  for (const id of input.candidates) {
    if (removed.has(id) || quick.has(id) || keptOf.has(id)) continue;
    if (!features.has(id)) {
      special.push(id);
      continue;
    }
    const c = cat(id);
    if (!c) toReview.push(id);
    else byCategory.set(c, [...(byCategory.get(c) ?? []), id]);
  }

  // 4. Folders. Names: the user's own name for a category or a group when one of their folders meant it.
  const userName = new Map<string, { name: string; size: number }>();
  for (const info of folderInfo.values()) {
    const id = info.kind === 'category' ? info.category : info.kind === 'group' ? `g:${info.group}` : undefined;
    // A folder of an earlier sort may be named with its emoji only: its name was kept aside.
    const name = stripEmoji(info.f.title) || input.known.get(info.f.id)?.name || '';
    if (!id || !name || info.f.isRoot) continue;
    const size = memberIds(info.f).length;
    if ((userName.get(id)?.size ?? -1) < size) userName.set(id, { name, size });
  }
  const catName = (c: Category) => userName.get(c.id)?.name ?? localName(c, lang);
  const groupName = (g: { id: GroupId; fr: string; en: string }) => userName.get(`g:${g.id}`)?.name ?? localName(g, lang);
  const byTitle = (a: string, b: string) => (bookmark(a)?.title ?? '').localeCompare(bookmark(b)?.title ?? '', lang);

  // Folders of earlier sorts that this sort leaves as they are, by the folder key they stand for.
  const outside = new Map<string, string>();
  for (const [id, k] of input.known) {
    const f = snapshot.folders.get(id);
    if (!f || f.unmodifiable || !input.remaining?.has(id)) continue;
    const key = k.category ? `c:${k.category}` : k.group ? `g:${k.group}` : k.role;
    if (key && !outside.has(key)) outside.set(key, id);
  }
  const newFolders: NewFolder[] = [];
  const targets = new Map<string, Target>();
  const add = (f: NewFolder): string => {
    newFolders.push(f);
    return f.key;
  };
  const put = (ids: string[], key: string) => {
    for (const id of ids) targets.set(id, { kind: 'new', key });
  };
  // The user's name, without the emoji in front; a folder named with an emoji only keeps it as its name.
  const nameOf = (title: string) => {
    const name = stripEmoji(title);
    return name ? { name, emoji: leadingEmoji(title) ?? '' } : { name: title.trim() || specialName('untitled', lang), emoji: '' };
  };
  const addKept = (k: Kept, parent: { parentId?: string; parentKey?: string }, level: number) => {
    const key = add({ key: `k:${k.info.f.id}`, vocabId: k.category ?? null, groupId: k.group, ...nameOf(k.info.f.title), parentId: parent.parentId ?? '', parentKey: parent.parentKey, level, reason: { key: 'reasonKeptFolder', subs: [k.info.f.title] } });
    put(k.ids, key);
    if (level >= MAX_LEVEL) return;
    const parts = [...k.parts.entries()].filter(([, ids]) => ids.length >= 2).sort((a, b) => (snapshot.folders.get(a[0])?.title ?? '').localeCompare(snapshot.folders.get(b[0])?.title ?? '', lang));
    for (const [fid, ids] of parts) {
      const title = snapshot.folders.get(fid)?.title ?? '';
      put(ids, add({ key: `k:${fid}`, vocabId: null, ...nameOf(title), parentId: '', parentKey: key, level: level + 1, reason: { key: 'reasonKeptFolder', subs: [title] } }));
    }
  };
  // A big category is split by site or by subject, on a third level at most.
  const fill = (key: string, cid: string, ids: string[], level: number) => {
    const rest = new Set(ids);
    if (level < MAX_LEVEL) {
      for (const facet of buildFacets(ids, cid)) {
        const fkey = add({ key: `f:${cid}:${facet.slug}`, vocabId: cid, name: facet.name, emoji: '', parentId: '', parentKey: key, level: level + 1, reason: { key: 'reasonFacet', subs: [String(facet.ids.length)] } });
        put(facet.ids, fkey);
        for (const id of facet.ids) rest.delete(id);
      }
    }
    put([...rest], key);
    for (const k of kept.values()) {
      if (k.category !== cid) continue;
      if (level < MAX_LEVEL) addKept(k, { parentKey: key }, level + 1);
      else put(k.ids, key);
    }
  };
  function buildFacets(ids: string[], cid: string): { slug: string; name: string; ids: string[] }[] {
    if (ids.length < o.facetFolderMin) return [];
    const c = categoryById(cid) as Category;
    const ignore = new Set([...c.keywords.split(','), ...c.aliases.split(','), c.fr, c.en].flatMap((w) => words(w)));
    const pool = new Set(ids);
    const out: { slug: string; name: string; ids: string[] }[] = [];
    while (out.length < o.maxFacets) {
      const sites = new Map<string, string[]>();
      const terms = new Map<string, string[]>();
      for (const id of pool) {
        const f = features.get(id) as Features;
        if (f.registrable && !f.privateHost) sites.set(f.registrable, [...(sites.get(f.registrable) ?? []), id]);
        for (const w of new Set(words(stripEmoji(f.bestTitle)))) {
          if (w.length < 3 || ignore.has(w) || f.registrable.startsWith(`${w}.`)) continue;
          terms.set(w, [...(terms.get(w) ?? []), id]);
        }
      }
      const best = [
        ...[...sites.entries()].map(([d, m]) => ({ slug: `site-${d}`, name: siteName(d), ids: m })),
        ...[...terms.entries()].map(([w, m]) => ({ slug: `term-${w}`, name: displayWord(w, m), ids: m })),
      ]
        .filter((x) => x.ids.length >= o.facetMin && x.ids.length < pool.size)
        .sort((a, b) => b.ids.length - a.ids.length || a.name.localeCompare(b.name))[0];
      if (!best) break;
      out.push(best);
      for (const id of best.ids) pool.delete(id);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, lang));
  }
  function displayWord(w: string, ids: string[]): string {
    const forms = new Map<string, number>();
    for (const id of ids) {
      for (const token of (features.get(id) as Features).bestTitle.split(/[^\p{L}\p{M}\p{N}+#.-]+/u)) {
        if (token && fold(token) === w) forms.set(token, (forms.get(token) ?? 0) + 1);
      }
    }
    const form = [...forms.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? w;
    return form.charAt(0).toUpperCase() + form.slice(1);
  }

  const groupsWith = new Map<GroupId, Map<string, string[]>>();
  for (const [cid, ids] of byCategory) {
    const g = (categoryById(cid) as Category).group;
    const m = groupsWith.get(g) ?? new Map<string, string[]>();
    m.set(cid, ids);
    groupsWith.set(g, m);
  }
  // A kept folder about a category or a group makes it exist.
  for (const k of kept.values()) {
    const g = k.category ? (categoryById(k.category) as Category).group : k.group;
    if (!g) continue;
    const m = groupsWith.get(g) ?? new Map<string, string[]>();
    if (k.category && !m.has(k.category)) m.set(k.category, []);
    groupsWith.set(g, m);
  }
  const layGroup = (g: (typeof GROUPS)[number], parentId: string) => {
    const cats = groupsWith.get(g.id);
    if (!cats) return;
    const keptHere = [...kept.values()].filter((k) => k.group === g.id && !k.category);
    const entries = [...cats.entries()].sort((a, b) => catName(categoryById(a[0]) as Category).localeCompare(catName(categoryById(b[0]) as Category), lang));
    if (entries.length === 1 && !keptHere.length) {
      // One category in this group: the folder is named after it ("📺 Streaming", not "🎬 Leisure"), unless the
      // user had a folder for the group ("Tools").
      const [cid, ids] = entries[0] as [string, string[]];
      const c = categoryById(cid) as Category;
      const name = userName.get(cid)?.name ?? userName.get(`g:${g.id}`)?.name ?? localName(c, lang);
      fill(add({ key: `c:${cid}`, vocabId: cid, groupId: g.id, name, emoji: c.emoji, parentId, level: 1, reason: { key: 'reasonNewCategory', subs: [String(ids.length)] } }), cid, ids, 1);
      return;
    }
    const total = entries.reduce((n, [, ids]) => n + ids.length, 0);
    const gkey = add({ key: `g:${g.id}`, vocabId: null, groupId: g.id, name: groupName(g), emoji: g.emoji, parentId, level: 1, reason: { key: 'reasonNewGroup', subs: [String(total)] } });
    for (const [cid, ids] of entries) {
      const c = categoryById(cid) as Category;
      const hasKept = [...kept.values()].some((k) => k.category === cid);
      if (c.own || ids.length >= o.subfolderMin || hasKept || outside.has(`c:${cid}`)) fill(add({ key: `c:${cid}`, vocabId: cid, groupId: g.id, name: catName(c), emoji: c.emoji, parentId: '', parentKey: gkey, level: 2, reason: { key: 'reasonNewCategory', subs: [String(ids.length)] } }), cid, ids, 2);
      else put(ids, gkey);
    }
    for (const k of keptHere) addKept(k, { parentKey: gkey }, 2);
  };
  // The most used folders come first, next to quick access: by the visits of their sites when the history is known
  // (sites already in quick access aside; on a log scale, so that many used sites outweigh a single one), else by size.
  const quickSites = new Set(quickAccess.map((id) => siteKey(bookmark(id)?.url ?? '')));
  const groupScore = (g: GroupId): number => {
    const ids = [...(groupsWith.get(g)?.values() ?? [])].flat();
    for (const k of kept.values()) if (k.group === g || (k.category && (categoryById(k.category) as Category).group === g)) ids.push(...k.ids);
    if (!input.hostVisits?.size) return ids.length;
    const sites = new Set(ids.map((id) => siteKey(bookmark(id)?.url ?? '')).filter((x) => !quickSites.has(x)));
    return [...sites].reduce((n, x) => n + Math.log2(1 + (input.hostVisits?.get(x) ?? 0)), 0) + ids.length / 1000;
  };
  const tops = GROUPS.filter((g) => g.id !== 'adult' && g.id !== 'dead' && groupsWith.has(g.id));
  const score = new Map(tops.map((g) => [g.id, groupScore(g.id)]));
  for (const g of tops.sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0))) layGroup(g, rootId);
  const mine = [...kept.values()].filter((k) => !k.category && !k.group).sort((a, b) => a.info.f.title.localeCompare(b.info.f.title, lang));
  if (mine.length) {
    add({ key: 'mine', vocabId: null, name: specialName('mine', lang), emoji: '🗂️', parentId: rootId, level: 1, reason: { key: 'reasonMyFolders' } });
    for (const k of mine) addKept(k, { parentKey: 'mine' }, 2);
  }
  for (const g of GROUPS) if (g.id === 'adult' || g.id === 'dead') layGroup(g, otherRoot);
  if (toReview.length) {
    add({ key: REVIEW_KEY, vocabId: null, name: specialName('review', lang), emoji: '❓', parentId: otherRoot, level: 1, reason: { key: 'reasonReviewFolder' } });
    put(toReview, REVIEW_KEY);
  }
  if (special.length) {
    add({ key: 'special', vocabId: null, name: specialName('special', lang), emoji: '🧩', parentId: otherRoot, level: 1, reason: { key: 'reasonSpecial' } });
    put(special, 'special');
  }
  // Folders an earlier sort made, left out of this one, take what belongs to them: sorting only "To check", or only
  // the bookmarks added since, files them in the folders already there instead of making a second "Tech". Only where
  // the folder above is the same, so that the tree shown is the tree created.
  const folderByKey = new Map(newFolders.map((f) => [f.key, f]));
  for (const f of newFolders) {
    const id = outside.get(f.key);
    const existing = id ? snapshot.folders.get(id) : undefined;
    if (!id || !existing) continue;
    const above = f.parentKey ? folderByKey.get(f.parentKey)?.existingId : f.parentId;
    if (existing.parentId !== above) continue;
    f.existingId = id;
    f.name = input.known.get(id)?.name || stripEmoji(existing.title) || f.name;
    f.emoji = leadingEmoji(existing.title) ?? f.emoji;
  }
  for (const id of quickAccess) targets.set(id, { kind: 'bar' });
  // A duplicate the user decides to keep goes where its kept copy goes.
  for (const [id, keepId] of removed) targets.set(id, targets.get(keepId) ?? { kind: 'new', key: toReview.length ? REVIEW_KEY : (newFolders[0]?.key ?? REVIEW_KEY) });

  // --- Proposal -----------------------------------------------------------------------------------------
  const ordered = [...input.candidates].sort(byTitle);
  const placements: Placement[] = [];
  const review: ReviewItem[] = [];
  const duplicates: Proposal['duplicates'] = [];
  const suggestions: Record<string, string[]> = {};
  for (const id of ordered) {
    const a = assessments.get(id);
    const target = targets.get(id) ?? { kind: 'new', key: REVIEW_KEY };
    let reason: Reason = a?.reason ?? { key: 'reasonSpecial' };
    const keepId = removed.get(id);
    if (keepId) {
      const kept = bookmark(keepId);
      const where = kept ? snapshot.folders.get(kept.parentId) : undefined;
      // Root folders are named as the browser names them, in its language.
      const place = where?.title ?? '';
      reason = { key: 'reasonDuplicate', subs: [kept?.title || kept?.url || '', place] };
      duplicates.push({ bookmarkId: id, keepId });
    } else if (quick.has(id)) reason = quickReason.get(id) as Reason;
    else if (keptOf.has(id)) reason = { key: 'reasonKeptFolder', subs: [(keptOf.get(id) as Kept).info.f.title] };
    if (target.kind === 'new' && target.key === REVIEW_KEY && !keepId) {
      review.push({ bookmarkId: id, reason });
      const s = (a?.suggestions ?? []).filter((c) => categoryById(c));
      if (s.length) suggestions[id] = s;
    }
    placements.push({ bookmarkId: id, target, reason });
  }

  // Cleaner titles: notification counters and repeated site names removed; short names for the bar.
  const titles: Record<string, string> = {};
  for (const id of input.candidates) {
    const b = bookmark(id);
    const f = features.get(id);
    if (!b || !f) continue;
    let t = f.cleanTitle;
    if (quick.has(id) && (t ?? b.title).length > 24) {
      const head = (t ?? b.title).split(/\s+[-|–—·:]\s+/)[0]?.replace(/\.(com|fr|org|net|io)$/i, '');
      if (head && head.length >= 3) t = head;
    }
    if (t && t !== b.title) titles[id] = t;
  }

  return {
    proposal: { snapshotTakenAt: snapshot.takenAt, candidates: ordered, duplicates, placements, newFolders, review, titles, folderEmojis: {}, quickAccess, suggestions },
    assessments,
  };
}

/**
 * Bookmarks a sort covers: every bookmark inside the chosen folders, the shortcuts of the bookmarks bar included,
 * except Nidomark's backups and managed bookmarks. The nearest chosen ancestor decides, so a folder can be left out.
 */
export function scopeCandidates(snapshot: Snapshot, include: string[], exclude: string[] = []): string[] {
  const included = new Set(include.filter((id) => snapshot.folders.has(id)));
  const excluded = new Set(exclude);
  const memo = new Map<string, boolean>();
  const inScope = (folderId: string): boolean => {
    const known = memo.get(folderId);
    if (known !== undefined) return known;
    const cur = snapshot.folders.get(folderId);
    let ok = false;
    if (cur && !cur.unmodifiable && !(isBackupTitle(cur.title) && !cur.isRoot)) {
      if (excluded.has(cur.id)) ok = false;
      else if (included.has(cur.id)) ok = true;
      else ok = cur.parentId ? inScope(cur.parentId) : false;
    }
    memo.set(folderId, ok);
    return ok;
  };
  const out: string[] = [];
  for (const b of snapshot.bookmarks.values()) {
    if (b.unmodifiable) continue;
    if (inScope(b.parentId)) out.push(b.id);
  }
  return out;
}
