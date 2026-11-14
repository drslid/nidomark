import type { BookmarkItem, Features, HistoryInfo, Usage } from './types';
import { USAGES } from './types';
import { isIpAddress, registrableDomain } from './psl';
import { isArticlePath, isPrivateHost, isRemoteAccessHost, parseUrl, pathWords } from './url';
import { fold, words } from './text';
import { knownAppIn } from './vocab';

/** A title folded to its letters and digits, in any script. */
const titleKey = (title: string) => fold(title).replace(/[^\p{L}\p{M}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();

/** Titles that say nothing about a page, in the languages of the interface. */
const GENERIC_TITLES = new Set([
  'accueil', 'home', 'homepage', 'index', 'dashboard', 'tableau de bord', 'login', 'log in', 'connexion', 'se connecter',
  'sign in', 'untitled', 'sans titre', 'bienvenue', 'welcome', 'page', 'start', 'start page', 'nouvel onglet', 'new tab', 'default',
  'inicio', 'página principal', 'página de inicio', 'iniciar sesión', 'bienvenido', 'bienvenida', 'panel', 'sin título',
  'pagina iniziale', 'accedi', 'benvenuto', 'senza titolo', 'startseite', 'anmelden', 'willkommen', 'unbenannt', 'übersicht',
  'página inicial', 'entrar', 'bem-vindo', 'sem título', 'painel', 'startpagina', 'inloggen', 'welkom', 'naamloos',
  'strona główna', 'zaloguj', 'zaloguj się', 'witaj', 'ana sayfa', 'anasayfa', 'giriş', 'giriş yap', 'hoş geldiniz',
  'главная', 'главная страница', 'вход', 'войти', 'добро пожаловать', 'без названия', 'головна', 'головна сторінка', 'увійти', 'вхід',
  'الرئيسية', 'الصفحة الرئيسية', 'تسجيل الدخول', 'مرحبا', 'होम', 'मुखपृष्ठ', 'लॉग इन', 'হোম', 'লগইন', 'beranda', 'masuk',
  'selamat datang', 'trang chủ', 'đăng nhập', 'ホーム', 'トップページ', 'トップ', 'ログイン', 'ようこそ', '無題', '홈', '로그인',
  '首页', '主页', '登录', '首頁', '主頁', '登入', '欢迎', '歡迎',
].map(titleKey));
/** Platforms whose domain says nothing about the subject of a page. */
export const MULTI_TOPIC_SITES = new Set(['youtube.com', 'youtu.be', 'medium.com', 'reddit.com', 'github.com', 'wikipedia.org', 'lemonde.fr', 'x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'vimeo.com', 'dailymotion.com', 'substack.com', 'google.com']);

const LEARN = /tuto|tutoriel|tutorial|guide|getting started|how to|comment |pas a pas|step by step|debuter|beginner|recette|recipe|apprendre|learn|cours|course|\bdocs?\b|documentation|reference|mdn|manuel|manual/;
const TOOL = /compress|optimi[sz]|convert|test(er)?\b|debug|whiteboard|outil|tool|generat|calculat|calcul|suivre (un|vos)|track|support tables|editor|editeur|playground|translate|tradu/;
const READ = /pourquoi|why |retour d.experience|comprendre|understand|astuces|tips|itineraire|opinion|review|analyse|enquete|story/;
const ACCOUNT = /espace|compte|connexion|login|log in|sign in|account|demarches|reserv|billets|tickets|banque|bank/;
const APP_PATH = /\/(admin|apps?|web|lovelace|photos|d|ui|dashboard|login|auth)(\/|$|#)/;
const APP_HOST = /^(cloud|nas|jellyfin|ha|home|homeassistant|media|plex|photos|files|git|vault|grafana|proxmox|pve|router|admin)\./;

function isVague(title: string, siteLabel: string, isRoot: boolean): boolean {
  const t = titleKey(title);
  if (!t || GENERIC_TITLES.has(t)) return true;
  // A specific page titled with the site name only ("YouTube" for a video) says nothing about the page.
  return !isRoot && !!siteLabel && t.replace(/\s/g, '') === siteLabel.replace(/[^\p{L}\p{M}\p{N}]/gu, '');
}

const SITE_WORDS = new Set(['recette', 'recettes', 'blog', 'site', 'officiel', 'official', 'magazine', 'journal', 'com', 'fr', 'org', 'net', 'la', 'le', 'les', 'de', 'du', 'the', 'of']);

/** Title without notification counters and trailing site names: "(1) Foo - YouTube" → "Foo". */
export function cleanTitle(title: string, host: string, siteLabel: string): string {
  let t = title.replace(/^\(\d+\)\s*/, '').replace(/\s+/g, ' ').trim();
  const parts = t.split(/\s+[-|–—·:]\s+/);
  if (parts.length > 1) {
    const last = parts[parts.length - 1] ?? '';
    const lastAlnum = fold(last).replace(/[^\p{L}\p{M}\p{N}]/gu, '');
    const label = siteLabel.replace(/[^\p{L}\p{M}\p{N}]/gu, '');
    const hostAlnum = fold(host).replace(/[^\p{L}\p{M}\p{N}]/gu, '');
    const namesSite = (label.length >= 3 && lastAlnum.includes(label)) || lastAlnum === hostAlnum;
    const rest = fold(last).split(/[^\p{L}\p{M}\p{N}]+/u).filter((w) => w && !SITE_WORDS.has(w) && !(label && label.includes(w)) && !hostAlnum.includes(w));
    const head = t.slice(0, t.length - last.length).replace(/\s+[-|–—·:]\s*$/, '').trim();
    if (namesSite && rest.length === 0 && head.length >= 6) t = head;
  }
  return t.replace(/\.(com|fr|org|net|io|info|app|dev)$/i, '').trim();
}

export interface FeatureContext {
  history?: Map<string, HistoryInfo>;
}

export function computeFeatures(b: BookmarkItem, ctx: FeatureContext = {}): Features {
  const u = parseUrl(b.url);
  const host = u.hostname.replace(/^www\./, '');
  const registrable = u.ok ? registrableDomain(host) : '';
  const siteLabel = registrable && !isIpAddress(registrable) ? fold(registrable.split('.')[0] ?? '') : '';
  const isRoot = u.pathname === '/' || u.pathname === '';
  const hist = ctx.history?.get(b.url);
  const histTitle = hist?.title?.trim() ?? '';
  const pw = pathWords(b.url);
  const privateHost = isPrivateHost(u.hostname);
  const remoteAccessHost = isRemoteAccessHost(u.hostname);
  const vagueTitle = isVague(b.title, siteLabel, isRoot);
  const histInformative = !!histTitle && !isVague(histTitle, siteLabel, isRoot) && fold(histTitle) !== fold(b.title);
  const bestTitle = vagueTitle && histInformative ? histTitle : b.title || histTitle;
  const titles = `${b.title} ${histInformative ? histTitle : ''}`;
  const knownApp = knownAppIn(titles) ?? (privateHost || remoteAccessHost ? knownAppIn(u.hostname) : null);
  const articlePath = isArticlePath(u.pathname);
  const visits = hist?.visitCount ?? 0;
  const typed = hist?.typedCount ?? 0;

  const s = Object.fromEntries(USAGES.map((k) => [k, 0])) as Record<Usage, number>;
  const signals: string[] = [];
  const text = fold(`${titles} ${pw}`);
  const learnWords = LEARN.test(text);
  const readWords = READ.test(text) || articlePath;
  if (privateHost) { s.access += 3; signals.push('private-host'); }
  if (remoteAccessHost) { s.access += 2; signals.push('remote-access'); }
  if (u.port && !['80', '443'].includes(u.port)) { s.access += 1; signals.push('port'); }
  // An application name means "access" only when the page is not a guide or an article about it.
  if (knownApp && !learnWords && !readWords) { s.access += 2; signals.push('known-app'); }
  const appLike = APP_PATH.test(u.pathname) || APP_HOST.test(u.hostname);
  if (appLike) { s.access += 1; signals.push('app-path'); }
  if (/connexion|login|sign in|mot de passe|password/.test(fold(histTitle))) { s.access += 1; signals.push('login-page'); }
  if (learnWords) { s.learn += 2; signals.push('learn-words'); }
  if (TOOL.test(text)) { s.tool += 2; signals.push('tool-words'); }
  if (readWords) { s.read += 1; signals.push('article'); }
  if (isRoot && !privateHost && !knownApp) {
    if (ACCOUNT.test(text)) { s.access += 2; signals.push('account'); }
    else if (typed >= 5 || visits >= 20) { s.follow += 2; signals.push('frequent-home'); }
    else { s.tool += 1; signals.push('web-app'); }
  }
  if (visits >= 10 && (isRoot || appLike || privateHost)) { s.access += 0.5; s.follow += 0.5; }
  if (hist && visits <= 2) { s.read += 0.5; s.learn += 0.5; }

  let usage: Usage = 'read';
  let best = -1;
  for (const k of USAGES) if (s[k] > best) { best = s[k]; usage = k; }

  const insufficient = vagueTitle && !histInformative && !knownApp && pw.split(' ').filter((w) => w.length > 2).length <= 1;
  const hostWords = privateHost || isIpAddress(host) ? '' : host.split('.').slice(0, -1).join(' ');
  const multiTopic = MULTI_TOPIC_SITES.has(registrable);
  const portText = u.port ? ` port ${u.port}` : '';
  const modelText = [bestTitle, histInformative && histTitle !== bestTitle ? histTitle : '', `${u.hostname}${portText}${pw ? ` · ${pw}` : ''}`]
    .filter(Boolean)
    .join(' — ');
  const ct = cleanTitle(bestTitle, host, siteLabel);

  return {
    id: b.id,
    host,
    registrable,
    port: u.port,
    pathWords: pw,
    privateHost,
    remoteAccessHost,
    knownApp,
    articlePath,
    vagueTitle,
    bestTitle,
    cleanTitle: ct && ct !== b.title ? ct : null,
    usage,
    usageScores: s,
    signals,
    insufficient,
    text: modelText,
    words: words(`${bestTitle} ${histInformative ? histTitle : ''} ${multiTopic ? '' : hostWords} ${pw}`),
    visits,
  };
}
