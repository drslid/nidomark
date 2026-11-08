/**
 * Sorts a collection into a small set of folders: a dozen groups at the top, precise categories inside them.
 * Each bookmark is assessed from the most certain evidence to the least: a dead site, an address only reachable
 * at home, a known site, the shape of the address, then the local model on its title and, when needed, its page.
 */
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
  groupById,
  isBackupTitle,
  keywordHits,
  knownSite,
  localName,
} from './taxonomy';
import type { Features, FolderItem, NewFolder, Placement, Proposal, Reason, ReviewItem, Snapshot, Target, Usage } from './types';
import { USAGES } from './types';
import { allKnownAppsIn, leadingEmoji, usageOfFolderTitle } from './vocab';

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
};

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
  /** Bookmarks the user filed differently from a proposal: bookmark → folder. */
  examples: Map<string, string>;
  /** Folders created by earlier sorts: folder → group or category. */
  known: Map<string, { group?: GroupId; category?: string }>;
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
    // 4. Known sites and typical addresses.
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
    const titleHits = keywordHits(`${f.bestTitle} ${f.pathWords}`);
    const pageHits = page ? keywordHits(`${page.title} ${page.description} ${page.keywords} ${page.headings.join(' ')}`) : new Map<string, number>();
    const rank = (weights: { title: number; page: number }) => {
      const scores = new Map<string, number>();
      for (const c of MODEL_CATEGORIES) {
        let x = (st?.get(c.id) ?? 0) * weights.title + (sp?.get(c.id) ?? 0) * weights.page;
        x += o.keywordWeight * Math.min((weights.title ? (titleHits.get(c.id) ?? 0) : 0) + (weights.page ? (pageHits.get(c.id) ?? 0) : 0), 2);
        if (known?.platform && known.category === c.id) x += o.platformPrior;
        scores.set(c.id, x);
      }
      const [first, second] = [...scores.entries()].sort((a, b2) => b2[1] - a[1]);
      return { category: first?.[0], lead: first && second ? first[1] - second[1] : 0 };
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
    // 8. Not enough evidence.
    const reason: Reason =
      verdict?.kind === 'blocked'
        ? { key: 'reviewBlocked', subs: [String(verdict.status)] }
        : read
          ? { key: 'reviewUnclearPage' }
          : f.insufficient || f.vagueTitle
            ? { key: input.siteReading ? 'reviewVague' : 'reviewNoAccess' }
            : { key: input.siteReading ? 'reviewUnclear' : 'reviewNoAccess' };
    return { category: null, confidence: 'none', reason, unclear: !read && verdict?.kind !== 'blocked' };
  }

  const assessments = new Map(input.candidates.map((id) => [id, assess(id)]));

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
    const k = input.known.get(f.id) ?? (leadingEmoji(f.title) === f.title.trim() ? emojiRole.get(f.title.trim()) : undefined);
    if (k?.category) {
      folderInfo.set(f.id, { f, kind: 'category', category: k.category, coherent: true });
      continue;
    }
    if (k?.group) {
      folderInfo.set(f.id, { f, kind: 'group', group: k.group, coherent: true });
      continue;
    }
    const role = folderRole(f.title);
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

  const ancestors = (folderId: string): FolderInfo[] => {
    const out: FolderInfo[] = [];
    let cur = folderInfo.get(folderId);
    while (cur) {
      out.push(cur);
      cur = cur.f.parentId ? folderInfo.get(cur.f.parentId) : undefined;
    }
    return out;
  };

  // --- Who moves ----------------------------------------------------------------------------------------
  type Decision =
    | { kind: 'stay'; reason: Reason }
    | { kind: 'review'; reason: Reason }
    | { kind: 'move'; category: string; reason: Reason }
    | { kind: 'folder'; folderId: string; reason: Reason }
    | { kind: 'duplicate'; keepId: string; reason: Reason };
  const decisions = new Map<string, Decision>();
  const duplicateOf = new Map((input.duplicates ?? []).map((d) => [d.bookmarkId, d.keepId]));
  const exampleFolders = new Map<string, string>();
  /** Bookmarks lying directly in a group folder, by "folder|category". */
  const loose = new Map<string, string[]>();
  for (const [bid, folderId] of input.examples) {
    const b = bookmark(bid);
    const f = b ? features.get(bid) : undefined;
    if (b && f?.registrable && b.parentId === folderId && folderInfo.has(folderId)) exampleFolders.set(f.registrable, folderId);
  }

  for (const id of input.candidates) {
    const b = bookmark(id) as { parentId: string; url: string };
    const a = assessments.get(id) as Assessment;
    const chain = ancestors(b.parentId);
    const parent = chain[0];
    const f = features.get(id) as Features;
    // A copy of a page kept elsewhere goes, whatever it is about.
    const keepId = duplicateOf.get(id);
    if (keepId) {
      const kept = bookmark(keepId);
      const where = kept ? snapshot.folders.get(kept.parentId) : undefined;
      const fr = lang.startsWith('fr');
      const place = where?.isRoot ? (where.id === snapshot.barId ? (fr ? 'Barre de favoris' : 'Bookmarks bar') : fr ? 'Autres favoris' : 'Other bookmarks') : (where?.title ?? '');
      decisions.set(id, { kind: 'duplicate', keepId, reason: { key: 'reasonDuplicate', subs: [kept?.title || kept?.url || '', place] } });
      continue;
    }
    // The user's own corrections come first.
    if (input.examples.get(id) === b.parentId) {
      decisions.set(id, { kind: 'stay', reason: { key: 'reasonUserKept' } });
      continue;
    }
    const learned = f.registrable ? exampleFolders.get(f.registrable) : undefined;
    if (learned && learned !== b.parentId && !STRONG.has(a.category ?? '')) {
      decisions.set(id, { kind: 'folder', folderId: learned, reason: { key: 'reasonLearnedSite', subs: [f.registrable, snapshot.folders.get(learned)?.title ?? ''] } });
      continue;
    }
    if (!a.category) {
      const sorted = parent && (parent.kind === 'personal' || parent.kind === 'category' || parent.kind === 'group');
      decisions.set(id, sorted ? { kind: 'stay', reason: { key: 'reasonKeptFolder', subs: [parent.f.title] } } : { kind: 'review', reason: a.reason });
      continue;
    }
    const c = categoryById(a.category) as Category;
    if (parent?.usage && !STRONG.has(c.id) && (usageOf(id) === parent.usage || (parent.usage === 'read' && usageOf(id) === 'learn'))) {
      decisions.set(id, { kind: 'stay', reason: { key: 'reasonKeptFolder', subs: [parent.f.title] } });
      continue;
    }
    // Already in the right place: its category, its group, or a folder of the user's that holds together.
    const home = chain.find((x) => (x.kind === 'category' && x.category === c.id) || (x.kind === 'group' && x.group === c.group));
    if (home && !(home.kind === 'group' && STRONG.has(c.id))) {
      decisions.set(id, { kind: 'stay', reason: { key: 'reasonAlreadyFiled', subs: [home.f.title] } });
      if (home.kind === 'group' && home === parent) {
        const k = `${home.f.id}|${c.id}`;
        loose.set(k, [...(loose.get(k) ?? []), id]);
      }
      continue;
    }
    if (parent?.kind === 'personal' && parent.coherent && !STRONG.has(c.id)) {
      decisions.set(id, { kind: 'stay', reason: { key: 'reasonKeptFolder', subs: [parent.f.title] } });
      continue;
    }
    if (parent?.kind === 'category' && !STRONG.has(c.id) && relatedness(id, parent.f.id) >= o.zCoherent) {
      decisions.set(id, { kind: 'stay', reason: { key: 'reasonKeptFolder', subs: [parent.f.title] } });
      continue;
    }
    decisions.set(id, { kind: 'move', category: c.id, reason: a.reason });
  }

  // --- Where they go ------------------------------------------------------------------------------------
  const rootId = (input.destination === 'bar' ? snapshot.barId : snapshot.otherId) ?? snapshot.otherId ?? snapshot.barId ?? '';
  // Adult content and dead links never go to the always-visible bar.
  const discreetRoot = snapshot.otherId ?? rootId;
  const moving = new Map<string, string[]>();
  for (const [id, d] of decisions) if (d.kind === 'move') moving.set(d.category, [...(moving.get(d.category) ?? []), id]);

  const usable = (x: FolderInfo) => !x.f.isRoot;
  const existingFor = (cat: string): FolderInfo | undefined => {
    const all = [...folderInfo.values()].filter((x) => usable(x) && x.kind === 'category' && x.category === cat);
    return all.sort((a, b) => memberIds(b.f).length - memberIds(a.f).length || a.f.depth - b.f.depth)[0];
  };
  const groupFolderFor = (g: GroupId): FolderInfo | undefined => {
    const all = [...folderInfo.values()].filter((x) => usable(x) && x.kind === 'group' && x.group === g);
    return all.sort((a, b) => memberIds(b.f).length - memberIds(a.f).length || a.f.depth - b.f.depth)[0];
  };
  /** Bookmarks that leave their group folder for a subfolder of their category. */
  const retarget = new Map<string, Target>();

  const newFolders: NewFolder[] = [];
  const targets = new Map<string, Target>();
  const folderName = (x: { fr: string; en: string }) => localName(x, lang);
  const addFolder = (key: string, x: { fr: string; en: string; emoji: string }, parent: { parentId?: string; parentKey?: string }, reason: Reason, ids: { category?: string; group?: GroupId }) => {
    newFolders.push({ key, vocabId: ids.category ?? null, groupId: ids.group, name: folderName(x), emoji: x.emoji, parentId: parent.parentId ?? '', parentKey: parent.parentKey, reason });
  };

  for (const g of GROUPS) {
    const groupFolder = groupFolderFor(g.id);
    const looseIn = (c: Category) => (groupFolder ? (loose.get(`${groupFolder.f.id}|${c.id}`) ?? []) : []);
    const cats = CATEGORIES.filter((c) => c.group === g.id && moving.has(c.id));
    if (!cats.length) continue;
    const needNew: Category[] = [];
    for (const c of cats) {
      const ex = existingFor(c.id);
      if (!ex) {
        needNew.push(c);
        continue;
      }
      targets.set(c.id, { kind: 'existing', folderId: ex.f.id });
      if (groupFolder && ex.f.parentId === groupFolder.f.id) for (const id of looseIn(c)) retarget.set(id, { kind: 'existing', folderId: ex.f.id });
    }
    if (!needNew.length) continue;
    const parentRoot = g.id === 'adult' || g.id === 'dead' ? discreetRoot : rootId;
    const count = (c: Category) => (moving.get(c.id)?.length ?? 0) + looseIn(c).length;
    const ownSub = (c: Category) => c.own || count(c) >= o.subfolderMin;
    if (groupFolder) {
      for (const c of needNew) {
        if (!ownSub(c)) {
          targets.set(c.id, { kind: 'existing', folderId: groupFolder.f.id });
          continue;
        }
        const key = `c:${c.id}`;
        addFolder(key, c, { parentId: groupFolder.f.id }, { key: 'reasonNewCategory', subs: [String(count(c))] }, { category: c.id });
        targets.set(c.id, { kind: 'new', key });
        for (const id of looseIn(c)) retarget.set(id, { kind: 'new', key });
      }
      continue;
    }
    const groupCategories = CATEGORIES.filter((c) => c.group === g.id).length;
    if (needNew.length === 1 || groupCategories === 1) {
      // One category in this group: the folder is named after it ("📺 Streaming", not "🎬 Leisure").
      for (const c of needNew) {
        const key = `c:${c.id}`;
        addFolder(key, c, { parentId: parentRoot }, { key: 'reasonNewCategory', subs: [String(count(c))] }, { category: c.id });
        targets.set(c.id, { kind: 'new', key });
      }
      continue;
    }
    const gkey = `g:${g.id}`;
    addFolder(gkey, g, { parentId: parentRoot }, { key: 'reasonNewGroup', subs: [String(needNew.reduce((s, c) => s + count(c), 0))] }, { group: g.id });
    for (const c of needNew) {
      if (!ownSub(c)) {
        targets.set(c.id, { kind: 'new', key: gkey });
        continue;
      }
      const key = `c:${c.id}`;
      addFolder(key, c, { parentKey: gkey }, { key: 'reasonNewCategory', subs: [String(count(c))] }, { category: c.id });
      targets.set(c.id, { kind: 'new', key });
    }
  }

  // --- Proposal -----------------------------------------------------------------------------------------
  const placements: Placement[] = [];
  const review: ReviewItem[] = [];
  const duplicates: Proposal['duplicates'] = [];
  const title = (id: string) => bookmark(id)?.title ?? '';
  const ordered = [...input.candidates].sort((a, b) => title(a).localeCompare(title(b), lang));
  for (const id of ordered) {
    const d = decisions.get(id) as Decision;
    if (d.kind === 'duplicate') {
      duplicates.push({ bookmarkId: id, keepId: d.keepId });
      placements.push({ bookmarkId: id, target: { kind: 'stay' }, reason: d.reason });
    } else if (d.kind === 'review') {
      review.push({ bookmarkId: id, reason: d.reason });
      placements.push({ bookmarkId: id, target: { kind: 'stay' }, reason: d.reason });
    } else if (d.kind === 'stay') placements.push({ bookmarkId: id, target: retarget.get(id) ?? { kind: 'stay' }, reason: retarget.has(id) ? (assessments.get(id) as Assessment).reason : d.reason });
    else if (d.kind === 'folder') placements.push({ bookmarkId: id, target: { kind: 'existing', folderId: d.folderId }, reason: d.reason });
    else placements.push({ bookmarkId: id, target: targets.get(d.category) ?? { kind: 'stay' }, reason: d.reason });
  }

  // Cleaner titles for the bookmarks sorted and for the bookmarks bar.
  const titles: Record<string, string> = {};
  const candidateSet = new Set(input.candidates);
  for (const b of snapshot.bookmarks.values()) {
    const f = features.get(b.id);
    if (!f || b.unmodifiable || !(candidateSet.has(b.id) || b.parentId === snapshot.barId)) continue;
    let t = f.cleanTitle;
    if (b.parentId === snapshot.barId && (t ?? b.title).length > 24) {
      const head = (t ?? b.title).split(/\s+[-|–—·:]\s+/)[0]?.replace(/\.(com|fr|org|net|io)$/i, '');
      if (head && head.length >= 3) t = head;
    }
    if (t && t !== b.title) titles[b.id] = t;
  }

  // An emoji for the user's category folders that receive bookmarks or sit next to the new ones.
  const folderEmojis: Record<string, string> = {};
  const receiving = new Set(placements.flatMap((p) => (p.target.kind === 'existing' ? [p.target.folderId] : [])));
  for (const info of folderInfo.values()) {
    if (info.f.isRoot || leadingEmoji(info.f.title)) continue;
    if (!receiving.has(info.f.id) && !(newFolders.length && info.f.parentId === rootId)) continue;
    const emoji = info.kind === 'category' ? categoryById(info.category ?? '')?.emoji : info.kind === 'group' && info.group ? groupById(info.group).emoji : undefined;
    if (emoji) folderEmojis[info.f.id] = emoji;
  }

  return {
    proposal: { snapshotTakenAt: snapshot.takenAt, candidates: ordered, duplicates, placements, newFolders, review, titles, folderEmojis },
    assessments,
  };
}

/**
 * Bookmarks a sort covers: every web bookmark inside the chosen folders, except the bookmarks bar's own shortcuts
 * and Nidomark's backups. The nearest chosen ancestor decides, so a subfolder can be left out of a chosen folder.
 */
export function scopeCandidates(snapshot: Snapshot, features: { has(id: string): boolean }, include: string[], exclude: string[] = []): string[] {
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
    if (b.unmodifiable || !features.has(b.id) || b.parentId === snapshot.barId) continue;
    if (inScope(b.parentId)) out.push(b.id);
  }
  return out;
}
