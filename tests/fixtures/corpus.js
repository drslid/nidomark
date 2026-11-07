// Fictitious bookmark collection used for the feasibility study (illustrative data).
// role: acces | outil | apprendre | lire | suivre ; page: what the extension could read (null = nothing readable)
export const corpus = [
  // --- Barre de favoris
  { id: 'b1', folder: 'Barre', title: 'Home Assistant', url: 'http://192.168.1.20:8123/lovelace/0', visits: 140, typed: 25, role: 'acces',
    page: { title: 'Aperçu – Home Assistant', desc: '', heads: ['Aperçu', 'Salon', 'Chauffage', 'Énergie'], text: 'Salon 21,5 °C · Lumières allumées : 3 · Consommation du jour 7,2 kWh' } },
  { id: 'b2', folder: 'Barre', title: 'Accueil', url: 'http://192.168.1.30:5000/', visits: 35, typed: 4, role: 'acces',
    page: { title: 'NAS-Maison - Synology DiskStation', desc: '', heads: [], text: 'Connexion · Nom d’utilisateur · Mot de passe' } },
  { id: 'b3', folder: 'Barre', title: 'Le Monde.fr - Actualités et Infos en France et dans le monde', url: 'https://www.lemonde.fr/', visits: 60, typed: 30, role: 'suivre',
    page: { title: 'Le Monde.fr - Actualités et Infos en France et dans le monde', desc: 'Le Monde.fr - 1er site d’information. Les articles du journal et toute l’actualité en continu : International, France, Société, Economie, Culture, Environnement.', heads: ['À la une', 'International', 'Planète'], text: '' } },
  { id: 'b4', folder: 'Barre/Outils', title: 'Squoosh', url: 'https://squoosh.app/', visits: 6, typed: 1, role: 'outil',
    page: { title: 'Squoosh', desc: 'Squoosh is the ultimate image optimizer that allows you to compress and compare images with different codecs in your browser.', heads: [], text: 'Drop OR Paste · Or try one of these' } },
  { id: 'b5', folder: 'Barre/Outils', title: 'regex101: build, test, and debug regex', url: 'https://regex101.com/', visits: 12, typed: 3, role: 'outil',
    page: { title: 'regex101: build, test, and debug regex', desc: 'Regular expression tester with syntax highlighting, explanation, cheat sheet for PHP/PCRE, Python, GO, JavaScript, Java, C#/.NET, Rust.', heads: ['Regular expression', 'Test string', 'Explanation'], text: '' } },
  { id: 'b6', folder: 'Barre/Outils', title: 'Excalidraw', url: 'https://excalidraw.com/', visits: 9, typed: 2, role: 'outil',
    page: { title: 'Excalidraw — Collaborative whiteboarding made easy', desc: 'Excalidraw is a virtual collaborative whiteboard tool that lets you easily sketch diagrams that have a hand-drawn feel to them.', heads: [], text: '' } },
  // --- Autres favoris / Domotique
  { id: 'd1', folder: 'Autres/Domotique', title: 'Installer Home Assistant OS sur un Raspberry Pi 4 – Tutoriel', url: 'https://www.domo-blog.fr/installer-home-assistant-raspberry-pi-4/', visits: 3, typed: 0, role: 'apprendre',
    page: { title: 'Installer Home Assistant OS sur un Raspberry Pi 4 – Tutoriel', desc: 'Tutoriel pas à pas pour installer Home Assistant OS sur un Raspberry Pi 4 : matériel nécessaire, flash de la carte SD, premier démarrage et intégrations.', heads: ['Matériel nécessaire', 'Flasher la carte SD avec Raspberry Pi Imager', 'Premier démarrage', 'Ajouter vos premières intégrations'], text: 'Home Assistant est une plateforme domotique open source qui centralise vos appareils connectés.' } },
  { id: 'd2', folder: 'Autres/Domotique', title: 'Getting started | Zigbee2MQTT', url: 'https://www.zigbee2mqtt.io/guide/getting-started/', visits: 4, typed: 0, role: 'apprendre',
    page: { title: 'Getting started | Zigbee2MQTT', desc: 'Zigbee to MQTT bridge, get rid of your proprietary Zigbee bridges', heads: ['Getting started', 'Installation', 'Configuration', 'Pairing devices'], text: 'Zigbee2MQTT allows you to use your Zigbee devices without the vendor bridge or gateway.' } },
  // --- Autres favoris / Recettes
  { id: 'r1', folder: 'Autres/Recettes', title: 'Tarte tatin facile : la recette de Marmiton', url: 'https://www.marmiton.org/recettes/recette_tarte-tatin-facile_11223.aspx', visits: 2, typed: 0, role: 'apprendre',
    page: { title: 'Tarte tatin facile : la recette de Marmiton', desc: 'Tarte tatin facile - Découvrez la recette de Tarte tatin facile à faire en 20 minutes.', heads: ['Ingrédients', 'Préparation'], text: '' } },
  // --- Autres favoris / À lire
  { id: 'a1', folder: 'Autres/À lire', title: 'Sobriété numérique : comment réduire l’empreinte de nos usages', url: 'https://www.lemonde.fr/planete/article/2025/01/12/sobriete-numerique-comment-reduire-l-empreinte-de-nos-usages_6489123_3244.html', visits: 1, typed: 0, role: 'lire',
    page: { title: 'Sobriété numérique : comment réduire l’empreinte de nos usages', desc: 'Smartphones, streaming, centres de données : le numérique pèse de plus en plus lourd dans les émissions de gaz à effet de serre. Tour d’horizon des leviers.', heads: ['Des terminaux trop vite renouvelés', 'Le streaming en question'], text: '' } },
  // --- Autres favoris (non classés)
  { id: 'u1', folder: 'Autres', title: 'Jellyfin', url: 'https://jellyfin.maison-dupont.fr/web/#/home.html', visits: 48, typed: 6, role: 'acces',
    page: { title: 'Jellyfin', desc: '', heads: [], text: 'Connexion · Utilisateur · Mot de passe' } },
  { id: 'u2', folder: 'Autres', title: 'Fichiers - Nextcloud', url: 'https://cloud.maison-dupont.fr/apps/files/', visits: 22, typed: 2, role: 'acces',
    page: { title: 'Nextcloud', desc: '', heads: [], text: 'Se connecter à Nextcloud · Compte · Mot de passe' } },
  { id: 'u3', folder: 'Autres', title: 'Pi-hole - pi.hole', url: 'http://pi.hole/admin/', visits: 8, typed: 1, role: 'acces',
    page: { title: 'Pi-hole - raspberrypi', desc: '', heads: ['Dashboard', 'Total queries', 'Queries Blocked'], text: '' } },
  { id: 'u4', folder: 'Autres', title: 'Freebox OS', url: 'http://mafreebox.freebox.fr/', visits: 5, typed: 2, role: 'acces',
    page: { title: 'Freebox OS', desc: '', heads: [], text: 'Mot de passe de la Freebox' } },
  { id: 'u5', folder: 'Autres', title: 'Proxmox Virtual Environment', url: 'https://192.168.1.10:8006/', visits: 15, typed: 3, role: 'acces',
    page: { title: 'pve - Proxmox Virtual Environment', desc: '', heads: [], text: 'Proxmox VE Login · User name · Password · Realm' } },
  { id: 'u6', folder: 'Autres', title: 'Dashboard', url: 'http://192.168.1.25:3000/d/a1b2c3/maison?orgId=1', visits: 20, typed: 0, role: 'acces',
    page: { title: 'Maison - Tableaux de bord - Grafana', desc: '', heads: [], text: 'Température salon · Consommation électrique · Qualité de l’air' } },
  { id: 'u7', folder: 'Autres', title: 'Immich', url: 'http://192.168.1.30:2283/photos', visits: 18, typed: 1, role: 'acces',
    page: { title: 'Photos - Immich', desc: '', heads: [], text: '' } },
  { id: 'u8', folder: 'Autres', title: 'Accueil', url: 'http://192.168.1.50:8080/', visits: 2, typed: 0, role: 'acces',
    page: null },
  { id: 'u9', folder: 'Autres', title: 'How to Set Up Pi-hole on a Raspberry Pi', url: 'https://www.guides-tech.net/pi-hole-raspberry-pi-setup', visits: 2, typed: 0, role: 'apprendre',
    page: { title: 'How to Set Up Pi-hole on a Raspberry Pi', desc: 'Block ads on every device in your home: install Pi-hole on a Raspberry Pi, set it as your DNS server and check the dashboard.', heads: ['What you’ll need', 'Install Pi-hole', 'Configure your router’s DNS', 'Check the dashboard'], text: '' } },
  { id: 'u10', folder: 'Autres', title: 'Jellyfin : le guide complet pour débuter', url: 'https://www.blog-multimedia.fr/jellyfin-guide-debutant/', visits: 2, typed: 0, role: 'apprendre',
    page: { title: 'Jellyfin : le guide complet pour débuter', desc: 'Installer Jellyfin, ajouter vos bibliothèques de films et séries, configurer l’accès à distance : notre guide pour bien démarrer avec ce media server libre.', heads: ['Installer Jellyfin', 'Ajouter une bibliothèque', 'Accès à distance'], text: '' } },
  { id: 'u11', folder: 'Autres', title: 'Pourquoi j’ai quitté Google Photos pour Immich', url: 'https://blog.julien-martin.fr/2024/03/quitter-google-photos-immich/', visits: 1, typed: 0, role: 'lire',
    page: { title: 'Pourquoi j’ai quitté Google Photos pour Immich', desc: 'Retour d’expérience après six mois d’auto-hébergement de mes photos avec Immich : migration, sauvegardes et limites.', heads: ['Le déclic', 'La migration', 'Ce qui manque encore'], text: '' } },
  { id: 'u12', folder: 'Autres', title: 'Comprendre le chiffrement de bout en bout', url: 'https://www.cnil.fr/fr/comprendre-le-chiffrement-de-bout-en-bout', visits: 1, typed: 0, role: 'lire',
    page: { title: 'Comprendre le chiffrement de bout en bout | CNIL', desc: 'Le chiffrement de bout en bout protège le contenu de vos échanges : explications et conseils.', heads: ['Qu’est-ce que le chiffrement de bout en bout ?', 'Ses limites'], text: '' } },
  { id: 'u13', folder: 'Autres', title: 'Array.prototype.map() - JavaScript | MDN', url: 'https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Array/map', visits: 7, typed: 0, role: 'apprendre',
    page: { title: 'Array.prototype.map() - JavaScript | MDN', desc: 'La méthode map() des instances de Array crée un nouveau tableau avec les résultats de l’appel d’une fonction fournie sur chaque élément du tableau appelant.', heads: ['Syntaxe', 'Description', 'Exemples'], text: '' } },
  { id: 'u14', folder: 'Autres', title: 'CSS Grid Layout : le guide complet - Alsacréations', url: 'https://www.alsacreations.com/article/lire/1388-css3-grid-layout.html', visits: 3, typed: 0, role: 'apprendre',
    page: { title: 'CSS Grid Layout : le guide complet - Alsacréations', desc: 'Tutoriel CSS Grid Layout : créer des grilles de mise en page, placer les éléments, gérer les zones et le responsive.', heads: ['Principe', 'Placer les éléments', 'Zones nommées'], text: '' } },
  { id: 'u15', folder: 'Autres', title: '10 astuces CSS que j’aurais aimé connaître plus tôt', url: 'https://medium.com/@lea.dev/10-astuces-css-que-jaurais-aime-connaitre-plus-tot-4f2a9c1b7e3d', visits: 1, typed: 0, role: 'lire',
    page: { title: '10 astuces CSS que j’aurais aimé connaître plus tôt | Medium', desc: 'Sélecteur :has(), clamp(), container queries… dix astuces CSS modernes pour écrire moins de code.', heads: [], text: '' } },
  { id: 'u16', folder: 'Autres', title: 'Can I use... Support tables for HTML5, CSS3, etc', url: 'https://caniuse.com/', visits: 10, typed: 4, role: 'outil',
    page: { title: 'Can I use... Support tables for HTML5, CSS3, etc', desc: '"Can I use" provides up-to-date browser support tables for support of front-end web technologies on desktop and mobile web browsers.', heads: [], text: '' } },
  { id: 'u17', folder: 'Autres', title: 'TinyPNG – Compress WebP, PNG and JPEG images intelligently', url: 'https://tinypng.com/', visits: 4, typed: 1, role: 'outil',
    page: { title: 'TinyPNG – Compress WebP, PNG and JPEG images intelligently', desc: 'Make your website faster and save bandwidth. TinyPNG optimizes your WebP, PNG and JPEG images by 50-80% while preserving full transparency!', heads: [], text: '' } },
  { id: 'u18', folder: 'Autres', title: 'Lightroom : 10 réglages pour bien débuter', url: 'https://www.blog-photo-debutant.fr/lightroom-10-reglages-debuter/', visits: 2, typed: 0, role: 'apprendre',
    page: { title: 'Lightroom : 10 réglages pour bien débuter', desc: 'Exposition, balance des blancs, courbes : les dix réglages de Lightroom à maîtriser pour retoucher vos premières photos.', heads: ['Exposition', 'Balance des blancs', 'Courbe des tonalités'], text: '' } },
  { id: 'u19', folder: 'Autres', title: 'La règle des tiers en photographie', url: 'https://www.apprendre-la-photo.fr/regle-des-tiers/', visits: 1, typed: 0, role: 'apprendre',
    page: { title: 'La règle des tiers en photographie', desc: 'Comment utiliser la règle des tiers pour améliorer la composition de vos photos, avec exemples et exercices.', heads: ['Le principe', 'Exemples', 'Exercices'], text: '' } },
  { id: 'u20', folder: 'Autres', title: 'Pain au levain maison', url: 'https://www.boulangerie-maison.fr/recettes/pain-au-levain/', visits: 3, typed: 0, role: 'apprendre',
    page: { title: 'Pain au levain maison', desc: 'Recette du pain au levain naturel : rafraîchi, pétrissage, pointage, façonnage et cuisson en cocotte.', heads: ['Ingrédients', 'Étapes'], text: '' } },
  { id: 'u21', folder: 'Autres', title: 'Gâteau au chocolat fondant : la recette de Marmiton', url: 'https://www.marmiton.org/recettes/recette_gateau-au-chocolat-fondant_12345.aspx', visits: 2, typed: 0, role: 'apprendre',
    page: { title: 'Gâteau au chocolat fondant : la recette de Marmiton', desc: 'Gâteau au chocolat fondant rapide - Découvrez la recette de Gâteau au chocolat fondant rapide à faire en 10 minutes.', heads: ['Ingrédients', 'Préparation'], text: '' } },
  { id: 'u22', folder: 'Autres', title: '(1) Comment installer Home Assistant en 10 minutes - YouTube', url: 'https://www.youtube.com/watch?v=Xk3dQa9pL2c', visits: 1, typed: 0, role: 'apprendre',
    page: { title: 'Comment installer Home Assistant en 10 minutes - YouTube', desc: 'Dans cette vidéo je vous montre comment installer Home Assistant sur un mini-PC et ajouter vos premiers appareils.', heads: [], text: '' } },
  { id: 'u23', folder: 'Autres', title: 'YouTube', url: 'https://www.youtube.com/watch?v=8fJ2kQ0rT1w', visits: 1, typed: 0, role: 'lire',
    page: null },
  { id: 'u24', folder: 'Autres', title: 'Hacker News', url: 'https://news.ycombinator.com/', visits: 40, typed: 20, role: 'suivre',
    page: { title: 'Hacker News', desc: '', heads: [], text: '' } },
  { id: 'u25', folder: 'Autres', title: 'Korben – Upgrade your mind', url: 'https://korben.info/', visits: 15, typed: 5, role: 'suivre',
    page: { title: 'Korben – Upgrade your mind', desc: 'Actualité tech, logiciels libres, astuces et tutoriels par Korben.', heads: [], text: '' } },
  { id: 'u26', folder: 'Autres', title: 'SNCF Connect', url: 'https://www.sncf-connect.com/', visits: 6, typed: 2, role: 'acces',
    page: { title: 'SNCF Connect : billets de train, cars, bus', desc: 'Réservez vos billets de train TGV INOUI, OUIGO, TER, Intercités et vos trajets en car ou en bus.', heads: [], text: '' } },
  { id: 'u27', folder: 'Autres', title: 'Lisbonne - Guide de voyage Routard.com', url: 'https://www.routard.com/guide/code_dest/lisbonne.htm', visits: 2, typed: 0, role: 'lire',
    page: { title: 'Lisbonne - Guide de voyage Routard.com', desc: 'Préparez votre voyage à Lisbonne avec le Guide du Routard : infos pratiques, itinéraires, hébergements, restaurants.', heads: ['Infos pratiques', 'Que voir ?', 'Où dormir ?'], text: '' } },
  { id: 'u28', folder: 'Autres', title: 'Lisbonne en 3 jours : notre itinéraire', url: 'https://www.voyages-et-vagabondages.fr/lisbonne-3-jours/', visits: 1, typed: 0, role: 'lire',
    page: { title: 'Lisbonne en 3 jours : notre itinéraire', desc: 'Alfama, Belém, Sintra : notre itinéraire de trois jours à Lisbonne avec budget et bonnes adresses.', heads: ['Jour 1 : Alfama', 'Jour 2 : Belém', 'Jour 3 : Sintra'], text: '' } },
  { id: 'u29', folder: 'Autres', title: 'Impots.gouv.fr - Espace particulier', url: 'https://cfspart.impots.gouv.fr/', visits: 4, typed: 1, role: 'acces',
    page: { title: 'impots.gouv.fr - Espace particulier', desc: '', heads: [], text: 'Connexion ou création de votre espace particulier · Numéro fiscal' } },
  { id: 'u30', folder: 'Autres', title: 'Suivre un colis - La Poste', url: 'https://www.laposte.fr/outils/suivre-vos-envois', visits: 5, typed: 0, role: 'outil',
    page: { title: 'Suivre un colis, une lettre - La Poste', desc: 'Suivez vos envois La Poste, Colissimo et Chronopost en temps réel avec votre numéro de suivi.', heads: ['Suivre un envoi'], text: '' } },
  { id: 'u31', folder: 'Autres', title: 'ANTS - Immatriculation', url: 'https://immatriculation.ants.gouv.fr/', visits: 2, typed: 0, role: 'acces',
    page: { title: 'ANTS - Immatriculation', desc: 'Faites vos démarches de carte grise en ligne : changement de titulaire, d’adresse, duplicata.', heads: [], text: '' } },
];

// Turns URL path and host into words: "/installer-home-assistant-raspberry-pi-4/" -> "installer home assistant raspberry pi 4"
export function urlWords(u) {
  const url = new URL(u);
  const host = url.hostname.replace(/^www\./, '');
  const port = url.port ? ` port ${url.port}` : '';
  const path = decodeURIComponent(url.pathname + ' ' + url.hash)
    .replace(/\.(html?|aspx|php)$/i, '')
    .replace(/[\/_#.?=&-]+/g, ' ')
    .replace(/\b[0-9a-f]{8,}\b/gi, '')
    .replace(/\s+/g, ' ').trim();
  return `${host}${port}${path ? ' · ' + path : ''}`;
}

// L0 = bookmark title + URL words only (always available offline)
// L1 = L0 + page title/meta description (head of the HTML)
// L2 = L1 + headings
// L3 = L2 + short text excerpt
export function textFor(b, level) {
  const parts = [b.title, urlWords(b.url)];
  const p = b.page;
  if (level >= 1 && p) {
    if (p.title && p.title !== b.title) parts.push(p.title);
    if (p.desc) parts.push(p.desc);
  }
  if (level >= 2 && p && p.heads.length) parts.push(p.heads.join(' · '));
  if (level >= 3 && p && p.text) parts.push(p.text);
  return parts.join(' — ');
}
