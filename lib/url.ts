import { isIpAddress } from './psl';

export interface ParsedUrl {
  ok: boolean;
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  hash: string;
}

export function parseUrl(url: string): ParsedUrl {
  try {
    const u = new URL(url);
    return { ok: true, protocol: u.protocol, hostname: u.hostname.toLowerCase(), port: u.port, pathname: u.pathname, hash: u.hash };
  } catch {
    return { ok: false, protocol: '', hostname: '', port: '', pathname: '', hash: '' };
  }
}

export function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** A site as the history counts it: host and port, without "www." (two services of a home server are two sites). */
export function siteKey(url: string): string {
  try {
    return new URL(url).host.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

const PRIVATE_SUFFIXES = ['.local', '.lan', '.home', '.home.arpa', '.internal', '.localdomain', '.intranet', '.box'];
/** Appliance and home-router names reachable on a home network. */
const HOME_APPLIANCE_HOSTS = new Set([
  'pi.hole', 'mafreebox.freebox.fr', 'fritz.box', 'router.asus.com', 'tplinkwifi.net', 'routerlogin.net',
  'livebox.home', 'homeassistant.local', 'hassio.local', 'nas.local', 'myrouter.local',
]);
/** Dynamic DNS and remote-access suffixes used to reach home services from the Internet. */
export const REMOTE_ACCESS_SUFFIXES = [
  'duckdns.org', 'synology.me', 'myds.me', 'quickconnect.to', 'myfritz.net', 'freeboxos.fr', 'ui.nabu.casa',
  'ts.net', 'ddns.net', 'hopto.org', 'zapto.org', 'dynu.net', 'no-ip.org', 'tplinkdns.com', 'asuscomm.com',
];

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  return h === '::1' || /^f[cd][0-9a-f]{2}:/.test(h) || h.startsWith('fe80:');
}

/** Host only reachable from a local network: private address, local suffix, single label or known appliance. */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (!h) return false;
  if (h === 'localhost' || HOME_APPLIANCE_HOSTS.has(h)) return true;
  if (isPrivateIPv4(h) || isPrivateIPv6(h)) return true;
  if (!h.includes('.') && !isIpAddress(h)) return true;
  return PRIVATE_SUFFIXES.some((s) => h.endsWith(s));
}

export function isRemoteAccessHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return REMOTE_ACCESS_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

/** Words of the URL path, without file extensions, numbers and opaque identifiers. */
export function pathWords(url: string): string {
  const u = parseUrl(url);
  if (!u.ok) return '';
  let path = `${u.pathname} ${u.hash}`;
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep the raw path */
  }
  return path
    .replace(/\.(html?|aspx?|php|jsp)\b/gi, ' ')
    .replace(/[/_#.?=&+:;,~!@$%^*()[\]{}|\\"'-]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^\d+$/.test(w) && !/^[0-9a-f]{8,}$/i.test(w) && !(w.length > 12 && /\d/.test(w) && /[a-z]/i.test(w)))
    .join(' ')
    .trim();
}

/** Article-like path: dated, or a long slug of several words. */
export function isArticlePath(pathname: string): boolean {
  return /\/(19|20)\d\d\/\d\d?\//.test(pathname) || /[a-z\u00e0-\u00ff]+-[a-z\u00e0-\u00ff]+-[a-z\u00e0-\u00ff]+-[a-z\u00e0-\u00ff]+/i.test(pathname);
}
