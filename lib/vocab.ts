import type { Usage } from './types';
import { fold } from './text';

export interface VocabEntry {
  id: string;
  fr: string;
  en: string;
  emoji: string;
  /** Mixed French/English hints, used both in the label text given to the model and for keyword matches. */
  kw: string;
  /** Describes a kind of page (tools, articles, docs…) rather than a subject: never used to link or name groups. */
  format?: true;
}

/** Short, concrete folder names the organiser may propose, each with its default emoji. */
export const VOCAB: VocabEntry[] = [
  { id: 'home-automation', fr: 'Domotique', en: 'Home automation', emoji: '🏠', kw: 'domotique home assistant zigbee capteurs smart home automation' },
  { id: 'home-services', fr: 'Services maison', en: 'Home services', emoji: '🖥️', kw: 'serveur maison nas interface administration homelab dashboard' },
  { id: 'self-hosting', fr: 'Auto-hébergement', en: 'Self-hosting', emoji: '🗄️', kw: 'auto-hébergement self-hosted docker serveur installer guide homelab' },
  { id: 'web-dev', fr: 'Développement web', en: 'Web development', emoji: '💻', kw: 'développement web javascript css html frontend programmation' },
  { id: 'programming', fr: 'Programmation', en: 'Programming', emoji: '🧑‍💻', kw: 'programmation code python java rust git api' },
  { id: 'ai', fr: 'IA', en: 'AI', emoji: '🤖', kw: 'intelligence artificielle ia ai llm machine learning chatgpt' },
  { id: 'data', fr: 'Données', en: 'Data', emoji: '📊', kw: 'données data statistiques tableaux analyse sql' },
  { id: 'design', fr: 'Design', en: 'Design', emoji: '🎨', kw: 'design graphisme couleurs typographie ui ux icônes' },
  { id: 'linux', fr: 'Linux', en: 'Linux', emoji: '🐧', kw: 'linux debian ubuntu terminal shell' },
  { id: 'network', fr: 'Réseau', en: 'Networking', emoji: '🌐', kw: 'réseau network dns routeur wifi vpn' },
  { id: 'security', fr: 'Sécurité', en: 'Security', emoji: '🔒', kw: 'sécurité security mots de passe chiffrement vie privée' },
  { id: 'cloud', fr: 'Cloud', en: 'Cloud', emoji: '☁️', kw: 'cloud hébergement serveur stockage en ligne' },
  { id: 'tools', fr: 'Outils', en: 'Tools', emoji: '🛠️', kw: 'outil en ligne convertir compresser tester générateur tool', format: true },
  { id: 'read-later', fr: 'À lire', en: 'Read later', emoji: '📖', kw: 'article à lire plus tard lecture read later', format: true },
  { id: 'news', fr: 'Actualités', en: 'News', emoji: '📰', kw: 'actualités news journal presse info' },
  { id: 'tech-news', fr: 'Veille tech', en: 'Tech news', emoji: '📡', kw: 'veille technologique tech news blog informatique' },
  { id: 'blogs', fr: 'Blogs', en: 'Blogs', emoji: '✍️', kw: 'blog billet article personnel', format: true },
  { id: 'recipes', fr: 'Recettes', en: 'Recipes', emoji: '🍳', kw: 'recette cuisine plat dessert gâteau ingrédients recipe' },
  { id: 'travel', fr: 'Voyages', en: 'Travel', emoji: '✈️', kw: 'voyage train avion hôtel itinéraire vacances travel' },
  { id: 'maps', fr: 'Cartes', en: 'Maps', emoji: '🗺️', kw: 'carte plan itinéraire gps maps' },
  { id: 'paperwork', fr: 'Démarches', en: 'Paperwork', emoji: '🏛️', kw: 'démarches administratives impôts gouv carte grise papiers administration' },
  { id: 'banking', fr: 'Banque', en: 'Banking', emoji: '🏦', kw: 'banque compte bancaire virement crédit bank' },
  { id: 'finance', fr: 'Finances', en: 'Finance', emoji: '💶', kw: 'finances budget bourse épargne investissement' },
  { id: 'insurance', fr: 'Assurances', en: 'Insurance', emoji: '🛡️', kw: 'assurance mutuelle contrat sinistre' },
  { id: 'shopping', fr: 'Achats', en: 'Shopping', emoji: '🛒', kw: 'achat boutique commande produit shopping' },
  { id: 'housing', fr: 'Logement', en: 'Housing', emoji: '🏘️', kw: 'logement immobilier location appartement maison' },
  { id: 'diy', fr: 'Bricolage', en: 'DIY', emoji: '🔨', kw: 'bricolage outils travaux réparation diy' },
  { id: 'garden', fr: 'Jardin', en: 'Garden', emoji: '🌱', kw: 'jardin plantes potager jardinage' },
  { id: 'energy', fr: 'Énergie', en: 'Energy', emoji: '⚡', kw: 'énergie électricité solaire consommation' },
  { id: 'electronics', fr: 'Électronique', en: 'Electronics', emoji: '🔌', kw: 'électronique arduino raspberry pi esp32 soudure' },
  { id: '3d-printing', fr: 'Impression 3D', en: '3D printing', emoji: '🖨️', kw: 'impression 3d imprimante filament modèle' },
  { id: 'cars', fr: 'Auto', en: 'Cars', emoji: '🚗', kw: 'voiture auto automobile entretien' },
  { id: 'cycling', fr: 'Vélo', en: 'Cycling', emoji: '🚲', kw: 'vélo cyclisme bike' },
  { id: 'hiking', fr: 'Randonnée', en: 'Hiking', emoji: '🥾', kw: 'randonnée montagne trek sentier' },
  { id: 'sports', fr: 'Sport', en: 'Sports', emoji: '⚽', kw: 'sport football match entraînement' },
  { id: 'health', fr: 'Santé', en: 'Health', emoji: '🩺', kw: 'santé médecin médical bien-être' },
  { id: 'food', fr: 'Cuisine', en: 'Cooking', emoji: '🥘', kw: 'cuisine cuisiner techniques ustensiles' },
  { id: 'photo', fr: 'Photo', en: 'Photography', emoji: '📷', kw: 'photo photographie appareil retouche lightroom' },
  { id: 'video', fr: 'Vidéos', en: 'Videos', emoji: '▶️', kw: 'vidéo youtube chaîne', format: true },
  { id: 'movies', fr: 'Films et séries', en: 'Movies & TV', emoji: '🎞️', kw: 'film série cinéma streaming' },
  { id: 'music', fr: 'Musique', en: 'Music', emoji: '🎵', kw: 'musique album artiste playlist' },
  { id: 'podcasts', fr: 'Podcasts', en: 'Podcasts', emoji: '🎙️', kw: 'podcast émission audio' },
  { id: 'books', fr: 'Lecture', en: 'Books', emoji: '📚', kw: 'livre lecture roman bibliothèque' },
  { id: 'games', fr: 'Jeux', en: 'Games', emoji: '🎮', kw: 'jeu vidéo jeux gaming' },
  { id: 'learning', fr: 'Apprendre', en: 'Learning', emoji: '🎓', kw: 'cours formation apprendre école université', format: true },
  { id: 'languages', fr: 'Langues', en: 'Languages', emoji: '🗣️', kw: 'langue anglais vocabulaire traduction' },
  { id: 'science', fr: 'Sciences', en: 'Science', emoji: '🔬', kw: 'science recherche physique biologie' },
  { id: 'history', fr: 'Histoire', en: 'History', emoji: '📜', kw: 'histoire patrimoine archives' },
  { id: 'kids', fr: 'Enfants', en: 'Kids', emoji: '🧸', kw: 'enfants école activités famille' },
  { id: 'pets', fr: 'Animaux', en: 'Pets', emoji: '🐾', kw: 'animaux chien chat vétérinaire' },
  { id: 'weather', fr: 'Météo', en: 'Weather', emoji: '🌦️', kw: 'météo prévisions climat' },
  { id: 'jobs', fr: 'Emploi', en: 'Jobs', emoji: '💼', kw: 'emploi travail carrière cv recrutement' },
  { id: 'work', fr: 'Travail', en: 'Work', emoji: '🗂️', kw: 'travail bureau projets équipe' },
  { id: 'social', fr: 'Réseaux sociaux', en: 'Social', emoji: '💬', kw: 'réseau social forum communauté discussion' },
  { id: 'events', fr: 'Événements', en: 'Events', emoji: '📅', kw: 'événement agenda billets concert' },
  { id: 'fashion', fr: 'Mode', en: 'Fashion', emoji: '👗', kw: 'mode vêtements style' },
  { id: 'crypto', fr: 'Crypto', en: 'Crypto', emoji: '🪙', kw: 'crypto bitcoin blockchain' },
  { id: 'telecom', fr: 'Télécoms', en: 'Telecom', emoji: '📶', kw: 'opérateur box internet mobile forfait' },
  { id: 'docs', fr: 'Documentation', en: 'Documentation', emoji: '📘', kw: 'documentation référence manuel api docs', format: true },
  { id: 'entertainment', fr: 'Loisirs', en: 'Leisure', emoji: '🎉', kw: 'loisirs sorties divertissement' },
];

const BY_ID = new Map(VOCAB.map((v) => [v.id, v]));

export function vocabById(id: string): VocabEntry | undefined {
  return BY_ID.get(id);
}

export function vocabName(v: VocabEntry, lang: string): string {
  return lang.startsWith('fr') ? v.fr : v.en;
}

/** Folder title without a leading emoji, for comparisons. */
export function stripEmoji(title: string): string {
  return title.replace(/^[\p{Extended_Pictographic}\p{Emoji_Component}\uFE0F\u200D\s]+/u, '').trim();
}

export function leadingEmoji(title: string): string | null {
  const m = title.match(/^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u);
  return m ? (m[1] ?? null) : null;
}

/** Vocabulary entry whose name (French or English) matches a folder title. */
export function vocabForTitle(title: string): VocabEntry | undefined {
  const t = fold(stripEmoji(title));
  if (!t) return undefined;
  return VOCAB.find((v) => fold(v.fr) === t || fold(v.en) === t);
}

/** Folders organised by usage rather than subject ("Tools", "Read later"). */
const USAGE_FOLDERS: [RegExp, Usage][] = [
  [/^(outils?|tools?|utilitaires?|utilities)$/, 'tool'],
  [/^(a lire|lire plus tard|a voir|a regarder|plus tard|read later|to read|reading list|watch later)$/, 'read'],
];

export function usageOfFolderTitle(title: string): Usage | null {
  const t = fold(stripEmoji(title)).replace(/\s+/g, ' ').trim();
  for (const [re, usage] of USAGE_FOLDERS) if (re.test(t)) return usage;
  return null;
}

/** Self-hosted applications, recognised in titles: pattern → display name. */
export const KNOWN_APPS: [RegExp, string][] = [
  [/home ?assistant|\bhass\b|lovelace/i, 'Home Assistant'],
  [/synology|diskstation|\bdsm\b/i, 'Synology'],
  [/jellyfin/i, 'Jellyfin'],
  [/\bplex\b/i, 'Plex'],
  [/\bemby\b/i, 'Emby'],
  [/nextcloud/i, 'Nextcloud'],
  [/pi-?hole/i, 'Pi-hole'],
  [/adguard home/i, 'AdGuard Home'],
  [/freebox/i, 'Freebox'],
  [/proxmox/i, 'Proxmox'],
  [/grafana/i, 'Grafana'],
  [/immich/i, 'Immich'],
  [/portainer/i, 'Portainer'],
  [/unifi/i, 'UniFi'],
  [/truenas|freenas/i, 'TrueNAS'],
  [/unraid/i, 'Unraid'],
  [/openmediavault/i, 'OpenMediaVault'],
  [/node-?red/i, 'Node-RED'],
  [/esphome/i, 'ESPHome'],
  [/frigate/i, 'Frigate'],
  [/paperless/i, 'Paperless'],
  [/vaultwarden/i, 'Vaultwarden'],
  [/\bgitea\b|forgejo/i, 'Gitea'],
  [/sonarr|radarr|lidarr|prowlarr/i, 'Arr'],
  [/qbittorrent|transmission/i, 'Torrent'],
  [/syncthing/i, 'Syncthing'],
  [/uptime kuma/i, 'Uptime Kuma'],
  [/homarr|heimdall|homepage dashboard/i, 'Dashboard'],
  [/octoprint/i, 'OctoPrint'],
  [/photoprism/i, 'PhotoPrism'],
  [/kodi/i, 'Kodi'],
  [/nginx proxy manager|traefik/i, 'Proxy'],
  [/cockpit|webmin|netdata/i, 'Server admin'],
];

export function knownAppIn(text: string): string | null {
  for (const [re, name] of KNOWN_APPS) if (re.test(text)) return name;
  return null;
}

export function allKnownAppsIn(text: string): string[] {
  return KNOWN_APPS.filter(([re]) => re.test(text)).map(([, name]) => name);
}

/** Text given to the model for a folder name of the vocabulary. */
export function vocabLabelText(v: VocabEntry, lang: string): string {
  return `${vocabName(v, lang)} : ${v.kw}`;
}
