import { nameIn, namesInEveryLanguage } from './names';
import { registrableDomain } from './psl';
import { fold } from './text';

/** Top-level folders. Few on purpose: the precise categories live inside them. */
export type GroupId = 'leisure' | 'news' | 'tech' | 'home' | 'shopping' | 'money' | 'life' | 'travel' | 'social' | 'learning' | 'tools' | 'adult' | 'dead';

export interface Group {
  id: GroupId;
  emoji: string;
  fr: string;
  en: string;
  /** Folder names that mean this group, comma-separated. */
  aliases: string;
}

export interface Category {
  id: string;
  group: GroupId;
  emoji: string;
  fr: string;
  en: string;
  /** What the category holds, given to the model. */
  desc: string;
  /** Words that point to this category in a title, an address or a page, comma-separated. */
  keywords: string;
  /** Folder names that mean this category, comma-separated. */
  aliases: string;
  /** Sites that are this category: domains ("netflix.com"), brands ("amazon.*"), hosts ("mail.google.com") or "host/path" prefixes. */
  sites: string;
  /** Multi-topic platforms: their category only applies when the subject of the page is not clear. */
  platforms?: string;
  /** Gets its own folder even with a single bookmark. */
  own?: true;
}

/** In this order in the bookmarks bar or in "Other bookmarks". */
export const GROUPS: Group[] = [
  { id: 'leisure', emoji: '🎬', fr: 'Loisirs', en: 'Leisure', aliases: 'loisirs, loisir, divertissement, divertissements, entertainment, leisure, fun, detente, hobbies, passions' },
  { id: 'news', emoji: '📰', fr: 'Infos', en: 'News', aliases: 'infos, info, informations, actu, actus, presse, medias, media, journaux' },
  { id: 'tech', emoji: '💻', fr: 'Tech', en: 'Tech', aliases: 'tech, techno, informatique, it, geek, numerique, computer, computing, high-tech, high tech' },
  { id: 'home', emoji: '🏠', fr: 'Maison', en: 'Home', aliases: 'maison, home, chez moi, foyer, house' },
  { id: 'shopping', emoji: '🛒', fr: 'Shopping', en: 'Shopping', aliases: 'shopping, achats, achat, courses, boutiques, magasins, e-commerce, bons plans, deals, promos, wishlist, envies, idees cadeaux, cadeaux' },
  { id: 'money', emoji: '💶', fr: 'Argent', en: 'Money', aliases: 'argent, finances, finance, money, budget, sous' },
  { id: 'life', emoji: '🏛️', fr: 'Vie pratique', en: 'Everyday life', aliases: 'vie pratique, pratique, quotidien, vie quotidienne, everyday, daily life' },
  { id: 'travel', emoji: '✈️', fr: 'Voyages', en: 'Travel', aliases: 'voyages, voyage, vacances, travel, trips, trip, sejours, transports, transport' },
  { id: 'social', emoji: '💬', fr: 'Social', en: 'Social', aliases: 'social, communication, communaute, communautes, community' },
  { id: 'learning', emoji: '🎓', fr: 'Apprendre', en: 'Learning', aliases: 'apprendre, apprentissage, education, savoir, culture, connaissances, learning, knowledge, etudes' },
  { id: 'tools', emoji: '🧰', fr: 'Outils', en: 'Tools', aliases: 'outils, outil, tools, utilitaires, utilities, boite a outils, toolbox' },
  { id: 'adult', emoji: '🔞', fr: 'Porn', en: 'Porn', aliases: 'porn, porno, pornos, adulte, adultes, adult, xxx, nsfw, 18+, sexe, sex, hot' },
  { id: 'dead', emoji: '🚫', fr: 'Sites inaccessibles', en: 'Unreachable sites', aliases: 'sites inaccessibles, sites morts, liens morts, liens casses, dead links, broken links, unreachable sites, dead sites, hors ligne, offline' },
];

export const CATEGORIES: Category[] = [
  // Leisure
  {
    id: 'streaming', group: 'leisure', emoji: '📺', fr: 'Streaming', en: 'Streaming', own: true,
    desc: 'Streaming : regarder des films, des séries, des animés ou la télévision en ligne, replay et directs. Watch movies, TV shows and anime online.',
    keywords: 'porn, porno, xxx, nsfw, hentai, milf, camgirl, webcam sexe, erotique, erotic, escort',
    aliases: 'streaming, films, film, series, serie, films et series, series et films, movies, tv, tele, television, vod, replay, anime, animes, mangas animes, netflix, a regarder, watchlist',
    sites: 'netflix.com primevideo.com disneyplus.com canalplus.com mycanal.fr max.com hbomax.com paramountplus.com tv.apple.com crunchyroll.com animationdigitalnetwork.fr animationdigitalnetwork.com adn.fr molotov.tv france.tv tf1.fr tf1plus.fr 6play.fr m6.fr m6plus.fr arte.tv twitch.tv kick.com pluto.tv rakuten.tv mubi.com hulu.com peacocktv.com tubi.tv filmo.tv universcine.com auvio.rtbf.be play.rts.ch oqee.tv salto.fr amazon.com/gp/video amazon.fr/gp/video watch.plex.tv',
  },
  {
    id: 'downloads', group: 'leisure', emoji: '📥', fr: 'Téléchargement', en: 'Downloads',
    desc: 'Téléchargement de films, séries, jeux et logiciels : torrents, téléchargement direct, hébergeurs de fichiers. Torrent and direct download sites.',
    keywords: 'torrent, torrents, telechargement, telecharger, download, ddl, magnet, seed, tracker, uptobox, 1fichier',
    aliases: 'telechargement, telechargements, downloads, download, torrent, torrents, ddl',
    sites: 'yggtorrent.top yggtorrent.qa 1337x.to thepiratebay.org nyaa.si rutracker.org zone-telechargement.com wawacity.tv extreme-down.tv uptobox.com 1fichier.com torrent9.fr oxtorrent.com cpasbien.ch limetorrents.lol torrentgalaxy.to rarbg.to fitgirl-repacks.site',
  },
  {
    id: 'video', group: 'leisure', emoji: '▶️', fr: 'Vidéos', en: 'Videos',
    desc: 'Vidéos en ligne : chaînes YouTube, vidéastes, clips et courtes vidéos. Online videos and YouTube channels.',
    keywords: 'video, videos, youtube, youtubeur, chaine youtube, vlog, clip, shorts',
    aliases: 'videos, video, youtube, youtubeurs, chaines youtube, chaines, a voir, watch later',
    sites: 'vimeo.com dailymotion.com odysee.com rumble.com bilibili.com nebula.tv peertube.fr framatube.org',
    platforms: 'youtube.com youtu.be m.youtube.com',
  },
  {
    id: 'music', group: 'leisure', emoji: '🎵', fr: 'Musique', en: 'Music',
    desc: 'Musique, radio et podcasts : écouter, playlists, albums, artistes, paroles, partitions. Music, radio and podcasts.',
    keywords: 'musique, music, album, albums, artiste, playlist, concert, chanson, chansons, song, songs, lyrics, paroles, radio, podcast, podcasts, partition, tablature, accords, guitare, piano',
    aliases: 'musique, music, zik, son, sons, podcasts, podcast, radio, radios, musiques',
    sites: 'spotify.com open.spotify.com deezer.com soundcloud.com bandcamp.com music.apple.com podcasts.apple.com music.youtube.com music.amazon.fr music.amazon.com qobuz.com tidal.com last.fm genius.com radiofrance.fr franceinter.fr nrj.fr funradio.fr skyrock.com rtl2.fr cheriefm.fr nostalgie.fr fip.fr radio.garden tunein.com songsterr.com ultimate-guitar.com setlist.fm discogs.com musicbrainz.org ausha.co podbean.com musescore.com boiteachansons.net',
  },
  {
    id: 'gaming', group: 'leisure', emoji: '🎮', fr: 'Jeux vidéo', en: 'Video games',
    desc: 'Jeux vidéo : boutiques de jeux, actualité du jeu vidéo, guides, mods, communautés de joueurs. Video games, gaming news and guides.',
    keywords: 'jeu video, jeux video, game, games, gaming, gamer, steam, ps5, playstation, xbox, nintendo, speedrun, soluce, walkthrough, esport, jeux pc',
    aliases: 'jeux, jeux video, jeu video, games, gaming, jv, jeu, gamer',
    sites: 'steampowered.com store.steampowered.com steamcommunity.com epicgames.com gog.com jeuxvideo.com gamekult.com ign.com gamespot.com itch.io nintendo.com nintendo.fr playstation.com xbox.com battle.net blizzard.com riotgames.com leagueoflegends.com chess.com lichess.org roblox.com minecraft.net ea.com ubisoft.com rockstargames.com millenium.org gamergen.com nexusmods.com curseforge.com speedrun.com howlongtobeat.com protondb.com isthereanydeal.com instant-gaming.com humblebundle.com fandom.com gameblog.fr jeuxactu.com',
  },
  {
    id: 'movies', group: 'leisure', emoji: '🎞️', fr: 'Cinéma', en: 'Movies & TV',
    desc: 'Cinéma et séries : critiques, fiches de films, bandes-annonces, programmes télé, où regarder. Movie reviews, trailers and TV guides.',
    keywords: 'cinema, critique de film, bande-annonce, bande annonce, trailer, sorties cinema, casting, realisateur, box office, programme tv',
    aliases: 'cinema, cine, critiques, a voir au cinema',
    sites: 'allocine.fr imdb.com senscritique.com letterboxd.com themoviedb.org betaseries.com trakt.tv justwatch.com rottentomatoes.com metacritic.com programme-tv.net telerama.fr premiere.fr ecranlarge.com',
  },
  {
    id: 'books', group: 'leisure', emoji: '📚', fr: 'Livres & BD', en: 'Books & comics',
    desc: 'Livres, bandes dessinées, mangas et webtoons : lire, critiques de livres, livres numériques. Books, comics, manga and e-books.',
    keywords: 'livres, roman, romans, lecture, bd, bande dessinee, manga, mangas, comics, webtoon, ebook, ebooks, epub, chapitre',
    aliases: 'livres, livre, lecture, lectures, bd, bandes dessinees, mangas, manga, comics, ebooks, books, reading, scans, webtoons',
    sites: 'babelio.com goodreads.com webtoons.com mangadex.org japscan.lol wattpad.com audible.fr audible.com kobo.com gutenberg.org bedetheque.com bdgest.com manga-news.com mangaplus.shueisha.co.jp lalibrairie.com placedeslibraires.fr booknode.com',
  },
  {
    id: 'sport', group: 'leisure', emoji: '⚽', fr: 'Sport', en: 'Sports',
    desc: 'Sport : résultats, actualité sportive, football, rugby, tennis, cyclisme, course à pied, randonnée, entraînement. Sports results, training and outdoor.',
    keywords: 'sport, sports, football, foot, match, score, scores, resultats, ligue, championnat, rugby, tennis, basket, nba, cyclisme, velo, course a pied, running, randonnee, rando, trail, ski, fitness, musculation, entrainement, workout, marathon',
    aliases: 'sport, sports, foot, football, rugby, running, velo, rando, randonnee, fitness, muscu, musculation, ski, tennis, basket',
    sites: 'lequipe.fr sofoot.com rmcsport.bfmtv.com eurosport.fr eurosport.com transfermarkt.fr transfermarkt.com flashscore.fr flashscore.com sofascore.com livescore.com uefa.com fifa.com nba.com nfl.com ligue1.com fff.fr psg.fr om.fr ol.fr lnr.fr ffr.fr rolandgarros.com formula1.com motogp.com letour.fr strava.com connect.garmin.com komoot.com alltrails.com visorando.com openrunner.com utmb.world espn.com skysports.com',
  },
  {
    id: 'photo', group: 'leisure', emoji: '📷', fr: 'Photo', en: 'Photography',
    desc: 'Photographie : techniques, retouche, appareils et objectifs, galeries et partage de photos. Photography techniques, gear and galleries.',
    keywords: 'photographie, photography, photographe, appareil photo, retouche photo, lightroom, reflex, objectif photo',
    aliases: 'photo, photos, photographie, photography',
    sites: 'flickr.com 500px.com lightroom.adobe.com photos.google.com phototrend.fr nikonpassion.com dpreview.com fstoppers.com apprendre-la-photo.fr',
  },
  {
    id: 'events', group: 'leisure', emoji: '🎟️', fr: 'Sorties', en: 'Going out',
    desc: 'Sorties et spectacles : billetterie, concerts, théâtre, festivals, expositions, restaurants. Tickets, shows, festivals and outings.',
    keywords: 'billetterie, concert, concerts, spectacle, spectacles, theatre, festival, festivals, exposition, restaurant, restaurants',
    aliases: 'sorties, sortir, spectacles, concerts, restos, restaurants, festivals, evenements, events',
    sites: 'ticketmaster.fr ticketmaster.com fnacspectacles.com seetickets.com billetreduc.com shotgun.live dice.fm thefork.fr lafourchette.com sortiraparis.com timeout.fr eventbrite.fr eventbrite.com',
  },
  {
    id: 'betting', group: 'leisure', emoji: '🎰', fr: 'Paris & jeux d’argent', en: 'Betting',
    desc: 'Paris sportifs, poker, loto et jeux d’argent. Sports betting, poker and lottery.',
    keywords: 'pari, paris sportifs, cote, cotes, poker, loto, euromillions, casino, bookmaker, betting, bet',
    aliases: 'paris, paris sportifs, poker, jeux d argent, betting, casino',
    sites: 'betclic.fr winamax.fr unibet.fr pmu.fr fdj.fr parionssport.fdj.fr pokerstars.fr zebet.fr netbet.fr bwin.fr',
  },
  // News
  {
    id: 'news', group: 'news', emoji: '📰', fr: 'Actualités', en: 'News',
    desc: 'Actualités : journaux, presse en ligne, information générale, politique, monde, économie. Newspapers and general news.',
    keywords: 'actualite, actualites, actu, actus, news, info, infos, journal, presse, quotidien, politique, monde, international, economie, breaking news, edition, editorial',
    aliases: 'actualites, actualite, actu, actus, news, presse, journaux, journal, infos, medias',
    sites: 'lemonde.fr lefigaro.fr liberation.fr francetvinfo.fr franceinfo.fr 20minutes.fr leparisien.fr ouest-france.fr bfmtv.com lci.fr tf1info.fr mediapart.fr lexpress.fr lepoint.fr nouvelobs.com humanite.fr la-croix.com lesechos.fr latribune.fr courrierinternational.com huffingtonpost.fr francebleu.fr ledauphine.com sudouest.fr lavoixdunord.fr ladepeche.fr actu.fr rfi.fr france24.com euronews.com bbc.com bbc.co.uk cnn.com nytimes.com theguardian.com washingtonpost.com reuters.com apnews.com aljazeera.com lesoir.be rtbf.be rts.ch letemps.ch 24heures.ch lapresse.ca radio-canada.ca news.google.com msn.com konbini.com brut.media arretsurimages.net marianne.net valeursactuelles.com lopinion.fr challenges.fr capital.fr slate.fr lemonde.co.uk',
  },
  {
    id: 'weather', group: 'news', emoji: '🌦️', fr: 'Météo', en: 'Weather',
    desc: 'Météo : prévisions, vigilance, radar de pluie, vent et marées. Weather forecasts, radar and tides.',
    keywords: 'meteo, weather, previsions, forecast, temperature, pluie, radar, vent, maree, marees, vigilance, orage',
    aliases: 'meteo, weather',
    sites: 'meteofrance.com meteo-france.com lachainemeteo.com meteociel.fr windy.com accuweather.com weather.com meteoblue.com infoclimat.fr wunderground.com meteoconsult.fr meteo.fr maree.info windguru.cz',
  },
  // Tech
  {
    id: 'technews', group: 'tech', emoji: '📡', fr: 'Actu tech', en: 'Tech news',
    desc: 'Actualité high-tech et blogs tech : nouveautés, tests de smartphones et d’ordinateurs, numérique, logiciels, veille technologique. Technology news and tech blogs.',
    keywords: 'high-tech, high tech, hightech, actualite tech, tech news, technologie, numerique, geek, smartphone, smartphones, android, iphone, gadget, gadgets, comparatif, veille techno, hardware, processeur, carte graphique',
    aliases: 'actu tech, tech news, veille, veille tech, veille techno, veille technologique, high-tech, high tech, geek, blogs tech, technews',
    sites: 'korben.info numerama.com frandroid.com 01net.com clubic.com lesnumeriques.com journaldugeek.com next.ink nextinpact.com zdnet.fr zdnet.com lemondeinformatique.fr siecledigital.fr presse-citron.net macg.co igen.fr iphon.fr phonandroid.com tomsguide.fr tomshardware.fr tomshardware.com generation-nt.com linuxfr.org theverge.com arstechnica.com techcrunch.com wired.com engadget.com gizmodo.com 9to5mac.com 9to5google.com macrumors.com androidauthority.com xda-developers.com servethehome.com theregister.com bleepingcomputer.com news.ycombinator.com slashdot.org lobste.rs techradar.com cnet.com usine-digitale.fr begeek.fr mac4ever.com journaldunet.com blogdumoderateur.com gsmarena.com phonearena.com anandtech.com hardware.fr cowcotland.com overclocking.com igeneration.fr numerama.fr lafibre.info dealabs.com/groupes/high-tech',
  },
  {
    id: 'dev', group: 'tech', emoji: '👨‍💻', fr: 'Développement', en: 'Development',
    desc: 'Développement logiciel et programmation : code, documentation technique, API, frameworks, dépôts Git, questions de développeurs. Programming, code and developer documentation.',
    keywords: 'dev, developpement, developpeur, programmation, programming, developer, api, sdk, framework, javascript, typescript, python, java, rust, golang, php, css, html, sql, git, docker, kubernetes, devops, npm, regex, backend, frontend, debug, open source',
    aliases: 'dev, developpement, code, programmation, programming, development, web dev, webdev, devops, docs, documentation, github, coding, informatique dev',
    sites: 'gitlab.com bitbucket.org stackoverflow.com stackexchange.com superuser.com serverfault.com askubuntu.com developer.mozilla.org npmjs.com pypi.org crates.io packagist.org rubygems.org nuget.org hub.docker.com dev.to hashnode.com freecodecamp.org w3schools.com css-tricks.com smashingmagazine.com codepen.io jsfiddle.net codesandbox.io replit.com leetcode.com readthedocs.io docs.python.org python.org nodejs.org react.dev reactjs.org vuejs.org angular.dev angular.io svelte.dev typescriptlang.org rust-lang.org go.dev kotlinlang.org developer.android.com developer.apple.com learn.microsoft.com devdocs.io caniuse.com sourceforge.net codeberg.org jetbrains.com code.visualstudio.com developpez.com developpez.net postman.com swagger.io regex101.com vercel.com/docs tailwindcss.com getbootstrap.com php.net laravel.com symfony.com djangoproject.com spring.io kubernetes.io docs.docker.com',
    platforms: 'github.com gist.github.com',
  },
  {
    id: 'ai', group: 'tech', emoji: '🤖', fr: 'IA', en: 'AI',
    desc: 'Intelligence artificielle : assistants conversationnels, modèles de langage, génération d’images et de voix, apprentissage automatique. Artificial intelligence tools and models.',
    keywords: 'ia, intelligence artificielle, artificial intelligence, llm, gpt, chatgpt, chatbot, machine learning, deep learning, prompt, prompts, generative ai, ia generative, stable diffusion, midjourney, modele de langage',
    aliases: 'ia, ai, intelligence artificielle, chatgpt, llm, prompts, ia generative',
    sites: 'chatgpt.com chat.openai.com openai.com claude.ai anthropic.com gemini.google.com mistral.ai chat.mistral.ai perplexity.ai huggingface.co midjourney.com copilot.microsoft.com poe.com character.ai stability.ai runwayml.com elevenlabs.io suno.com ollama.com lmstudio.ai groq.com deepseek.com phind.com kaggle.com replicate.com civitai.com leonardo.ai ideogram.ai notebooklm.google.com grok.com x.ai lmarena.ai',
  },
  {
    id: 'cloud', group: 'tech', emoji: '☁️', fr: 'Serveurs & cloud', en: 'Servers & cloud',
    desc: 'Hébergement et cloud : serveurs, VPS, noms de domaine, DNS, consoles d’hébergeurs, CDN. Hosting providers, servers, domains and cloud consoles.',
    keywords: 'serveur, serveurs, server, servers, vps, hebergement, hebergeur, hosting, cloud, nom de domaine, dns, cdn, datacenter, serveur dedie, bare metal',
    aliases: 'cloud, serveurs, serveur, hebergement, hosting, vps, infra, infrastructure, sysadmin, admin sys, domaines',
    sites: 'ovh.com ovhcloud.com hetzner.com scaleway.com online.net digitalocean.com linode.com vultr.com aws.amazon.com console.aws.amazon.com cloud.google.com console.cloud.google.com portal.azure.com azure.microsoft.com cloudflare.com dash.cloudflare.com vercel.com netlify.com heroku.com render.com fly.io railway.app o2switch.fr ionos.fr ionos.com gandi.net namecheap.com godaddy.com porkbun.com infomaniak.com hostinger.com hostinger.fr contabo.com cloud.oracle.com backblaze.com wasabi.com noip.com letsencrypt.org',
  },
  {
    id: 'security', group: 'tech', emoji: '🔐', fr: 'Sécurité', en: 'Security',
    desc: 'Sécurité informatique et vie privée : mots de passe, VPN, antivirus, cybersécurité, fuites de données. Security, privacy, passwords and VPN.',
    keywords: 'securite, security, cybersecurite, cybersecurity, mot de passe, mots de passe, password, passwords, vpn, antivirus, malware, hacking, pentest, chiffrement, encryption, vie privee, privacy, 2fa, phishing, ctf',
    aliases: 'securite, security, cybersecurite, hacking, vpn, privacy, vie privee, mots de passe',
    sites: 'haveibeenpwned.com bitwarden.com 1password.com keepass.info nordvpn.com expressvpn.com mullvad.net protonvpn.com virustotal.com malwarebytes.com cybermalveillance.gouv.fr cert.ssi.gouv.fr ssi.gouv.fr ssllabs.com shodan.io owasp.org hackthebox.com tryhackme.com root-me.org exploit-db.com krebsonsecurity.com zataz.com privacyguides.org',
  },
  {
    id: 'selfhost', group: 'tech', emoji: '🗄️', fr: 'Auto-hébergement', en: 'Self-hosting',
    desc: 'Auto-hébergement : installer ses propres services, homelab, NAS, Docker, guides d’applications auto-hébergées. Self-hosting guides and homelab.',
    keywords: 'auto-hebergement, autohebergement, self-hosted, selfhosted, self hosting, homelab, docker compose, serveur maison, nas, raspberry pi, reverse proxy',
    aliases: 'auto-hebergement, autohebergement, auto hebergement, self-hosting, selfhosting, selfhosted',
    sites: 'awesome-selfhosted.net selfh.st linuxserver.io yunohost.org umbrel.com casaos.io truenas.com unraid.net proxmox.com openmediavault.org jellyfin.org nextcloud.com immich.app pi-hole.net',
  },
  {
    id: 'software', group: 'tech', emoji: '💾', fr: 'Logiciels', en: 'Software',
    desc: 'Logiciels et systèmes : télécharger des applications, systèmes d’exploitation, Linux, Windows, macOS, logiciels libres. Software downloads and operating systems.',
    keywords: 'logiciel, logiciels, software, linux, windows, macos, distribution linux, logiciel libre, driver, pilote, telecharger logiciel',
    aliases: 'logiciels, logiciel, software, apps, applications, linux, windows, mac, macos, utilitaires pc',
    sites: 'ubuntu.com debian.org archlinux.org wiki.archlinux.org linuxmint.com fedoraproject.org getfedora.org videolan.org 7-zip.org notepad-plus-plus.org mozilla.org libreoffice.org gimp.org inkscape.org blender.org obsproject.com alternativeto.net ninite.com chocolatey.org flathub.org f-droid.org play.google.com apps.apple.com microsoft.com/windows support.microsoft.com support.apple.com',
  },
  // Home
  {
    id: 'home-services', group: 'home', emoji: '🖥️', fr: 'Services maison', en: 'Home services',
    desc: 'Services hébergés à la maison : interfaces de NAS, box, routeur, serveur multimédia, tableaux de bord sur le réseau local. Dashboards of devices and services at home.',
    keywords: 'nas, routeur, router, dashboard, tableau de bord, serveur maison, reseau local, lan',
    aliases: 'services maison, homelab, serveur maison, reseau local, lan, local, mes services, self-hosted services, home services, maison services, nas, mon nas',
    sites: '',
  },
  {
    id: 'home-automation', group: 'home', emoji: '💡', fr: 'Domotique', en: 'Home automation',
    desc: 'Domotique et maison connectée : Home Assistant, capteurs, éclairage connecté, automatisations, Zigbee. Smart home and home automation.',
    keywords: 'domotique, home automation, home assistant, zigbee, z-wave, capteur, capteurs, sensor, smart home, maison connectee, ampoule connectee, thermostat, automatisation, mqtt, esphome, tasmota',
    aliases: 'domotique, home automation, maison connectee, smart home, home assistant',
    sites: 'home-assistant.io jeedom.com domoticz.com homey.app smartthings.com zigbee2mqtt.io hacf.fr ifttt.com meethue.com shelly.cloud esphome.io maison-et-domotique.com domo-blog.fr tuya.com',
  },
  {
    id: 'diy', group: 'home', emoji: '🔨', fr: 'Bricolage & déco', en: 'DIY & decor',
    desc: 'Bricolage, travaux, décoration, meubles et jardin : rénovation, outillage, plantes, potager. DIY, home improvement, furniture and garden.',
    keywords: 'bricolage, diy, travaux, renovation, deco, decoration, meuble, meubles, jardin, garden, jardinage, potager, plomberie, peinture, outillage, carrelage, isolation, plantes',
    aliases: 'bricolage, deco, decoration, travaux, renovation, jardin, jardinage, diy, maison et jardin, meubles, deco maison, amenagement',
    sites: 'leroymerlin.fr castorama.fr bricodepot.fr bricomarche.com mr-bricolage.fr ikea.com maisonsdumonde.com conforama.fr manomano.fr 123elec.com systeme-d.com houzz.fr cotemaison.fr deco.fr jardiland.com truffaut.com gammvert.fr rustica.fr aujardin.info promessedefleurs.com but.fr',
  },
  {
    id: 'cooking', group: 'home', emoji: '🍳', fr: 'Cuisine', en: 'Cooking',
    desc: 'Cuisine et recettes : plats, desserts, pâtisserie, ingrédients, techniques de cuisine. Recipes and cooking.',
    keywords: 'recette, recettes, recipe, recipes, cuisine, cooking, plat, dessert, gateau, ingredients, four, thermomix, cookeo, patisserie, apero, sauce, gratin, tarte',
    aliases: 'cuisine, recettes, recette, cooking, recipes, food, bouffe, miam, patisserie, a cuisiner',
    sites: 'marmiton.org 750g.com cuisineaz.com cuisine.journaldesfemmes.fr ricardocuisine.com hervecuisine.com chefsimon.com jamieoliver.com allrecipes.com bbcgoodfood.com seriouseats.com epicurious.com foodnetwork.com tasty.co cookomix.com ptitchef.com papillesetpupilles.fr cuisineactuelle.fr elle.fr/elle-a-table',
  },
  // Shopping
  {
    id: 'shopping', group: 'shopping', emoji: '🛒', fr: 'Shopping', en: 'Shopping',
    desc: 'Achats en ligne : boutiques, marketplaces, petites annonces, comparateurs de prix, bons plans. Online shops, marketplaces and deals.',
    keywords: 'acheter, achat, achats, boutique, shop, store, commande, panier, promo, promotion, soldes, prix, bon plan, bons plans, deal, deals, produit, annonce, occasion, livraison gratuite',
    aliases: 'shopping, achats, courses, boutiques, magasins, e-commerce, bons plans, deals, promos, wishlist, envies, cadeaux, idees cadeaux, a acheter',
    sites: 'amazon.* cdiscount.com fnac.com darty.com boulanger.com ldlc.com materiel.net topachat.com rueducommerce.fr aliexpress.com temu.com shein.com ebay.* leboncoin.fr vinted.fr vinted.com fr.shopping.rakuten.com backmarket.fr zalando.fr asos.com decathlon.fr carrefour.fr e.leclerc auchan.fr intermarche.com lidl.fr action.com kiabi.com laredoute.fr etsy.com wish.com idealo.fr ledenicheur.fr dealabs.com groupon.fr veepee.fr showroomprive.com sephora.fr nocibe.fr cultura.com micromania.fr nike.com adidas.fr uniqlo.com hm.com zara.com galerieslafayette.com pcpartpicker.com label-emmaus.co',
  },
  // Money
  {
    id: 'bank', group: 'money', emoji: '🏦', fr: 'Banque', en: 'Banking',
    desc: 'Banque en ligne : comptes, virements, cartes, crédits, paiements. Online banking and payments.',
    keywords: 'banque, bank, virement, carte bancaire, livret, paiement, payment, iban, banque en ligne',
    aliases: 'banque, banques, bank, banking, comptes, mes comptes',
    sites: 'credit-agricole.fr labanquepostale.fr mabanque.bnpparibas bnpparibas.net societegenerale.fr particuliers.sg.fr lcl.fr caisse-epargne.fr banquepopulaire.fr creditmutuel.fr cic.fr boursorama.com boursobank.com fortuneo.fr hellobank.fr monabanq.com ing.fr revolut.com n26.com qonto.com shine.fr lydia-app.com sumeria.eu paypal.com wise.com nickel.eu orangebank.fr hsbc.fr bred.fr axa.fr/banque',
  },
  {
    id: 'invest', group: 'money', emoji: '📈', fr: 'Bourse & crypto', en: 'Investing & crypto',
    desc: 'Investissement : bourse, actions, ETF, assurance vie, cryptomonnaies, gestion de patrimoine. Investing, stocks and crypto.',
    keywords: 'bourse, investir, investissement, invest, investing, trading, crypto, cryptomonnaie, bitcoin, ethereum, etf, pea, assurance vie, portefeuille, dividende, patrimoine',
    aliases: 'bourse, investissement, investissements, crypto, cryptos, trading, placements, epargne, patrimoine',
    sites: 'zonebourse.com abcbourse.com investing.com tradingview.com degiro.fr traderepublic.com binance.com coinbase.com kraken.com coinmarketcap.com coingecko.com etoro.com finance.yahoo.com fr.finance.yahoo.com morningstar.fr quantalys.com linxea.com yomoni.fr finary.com ledger.com metamask.io bitcoin.org ethereum.org boursedirect.fr',
  },
  {
    id: 'insurance', group: 'money', emoji: '🛡️', fr: 'Assurances', en: 'Insurance',
    desc: 'Assurances : auto, habitation, mutuelle, comparateurs d’assurance, déclarer un sinistre. Insurance contracts and claims.',
    keywords: 'assurance, assurances, assureur, mutuelle, sinistre, devis assurance, insurance',
    aliases: 'assurances, assurance, mutuelle, mutuelles, insurance',
    sites: 'axa.fr maif.fr macif.fr matmut.fr groupama.fr allianz.fr mma.fr gmf.fr lesfurets.com lelynx.fr direct-assurance.fr leocare.eu luko.eu hiscox.fr',
  },
  // Everyday life
  {
    id: 'admin', group: 'life', emoji: '🏛️', fr: 'Démarches', en: 'Paperwork',
    desc: 'Démarches administratives : impôts, sécurité sociale, allocations, retraite, papiers d’identité, permis, services publics. Government services and paperwork.',
    keywords: 'demarches, administratif, impots, impot, declaration, securite sociale, caf, retraite, allocation, permis, carte grise, passeport, carte d identite, mairie, prefecture, gouv, service public, urssaf',
    aliases: 'demarches, administratif, administration, papiers, impots, paperwork, admin, administratif et papiers, service public',
    sites: 'impots.gouv.fr ameli.fr caf.fr ants.gouv.fr service-public.fr service-public.gouv.fr urssaf.fr info-retraite.fr lassuranceretraite.fr franceconnect.gouv.fr mesdroitssociaux.gouv.fr legifrance.gouv.fr demarches-simplifiees.fr msa.fr agirc-arrco.fr interieur.gouv.fr mon.service-public.fr',
  },
  {
    id: 'health', group: 'life', emoji: '🩺', fr: 'Santé', en: 'Health',
    desc: 'Santé : prendre rendez-vous chez le médecin, médicaments, symptômes, mutuelle, bien-être. Health, doctors and medicine.',
    keywords: 'sante, health, medecin, docteur, rendez-vous medical, medicament, medicaments, maladie, symptome, symptomes, pharmacie, hopital, dentiste, kine, ophtalmo, vaccin, bien-etre',
    aliases: 'sante, health, medical, medecins, medecin, bien-etre',
    sites: 'doctolib.fr vidal.fr doctissimo.fr passeportsante.net sante.fr qare.fr maiia.com msdmanuals.com webmd.com mayoclinic.org nhs.uk santemagazine.fr harmonie-mutuelle.fr mgen.fr alan.com',
  },
  {
    id: 'jobs', group: 'life', emoji: '💼', fr: 'Emploi', en: 'Jobs',
    desc: 'Emploi et carrière : offres d’emploi, recrutement, CV, candidatures, freelance, stages. Job search and careers.',
    keywords: 'emploi, job, jobs, offre d emploi, offres d emploi, recrutement, cv, candidature, candidatures, freelance, carriere, career, stage, alternance, interim, salaire, entretien d embauche',
    aliases: 'emploi, jobs, job, recherche d emploi, cv, carriere, career, candidatures, offres d emploi',
    sites: 'indeed.fr indeed.com welcometothejungle.com apec.fr francetravail.fr pole-emploi.fr hellowork.com monster.fr glassdoor.fr glassdoor.com jobteaser.com malt.fr codeur.com cadremploi.fr meteojob.com linkedin.com/jobs',
  },
  {
    id: 'housing', group: 'life', emoji: '🏘️', fr: 'Immobilier', en: 'Real estate',
    desc: 'Immobilier et logement : annonces de location et de vente, agences, colocation, prix au mètre carré. Real estate listings and housing.',
    keywords: 'immobilier, appartement, appartements, maison a vendre, louer, loyer, achat immobilier, agence immobiliere, colocation, bail, pret immobilier, metre carre, annonce immobiliere',
    aliases: 'immobilier, logement, appartements, appartement, location, colocation, real estate, housing',
    sites: 'seloger.com pap.fr bienici.com logic-immo.com meilleursagents.com avendrealouer.fr paruvendu.fr orpi.com century21.fr laforet.com foncia.com locservice.fr lacartedescolocs.fr appartager.com leboncoin.fr/ventes_immobilieres leboncoin.fr/locations',
  },
  {
    id: 'car', group: 'life', emoji: '🚗', fr: 'Auto & moto', en: 'Cars & bikes',
    desc: 'Auto et moto : acheter une voiture, essais, entretien, pièces détachées, recharge électrique. Cars, motorbikes and maintenance.',
    keywords: 'voiture, voitures, automobile, moto, motos, scooter, garage, entretien auto, pieces auto, pneus, carburant, borne de recharge, vehicule',
    aliases: 'auto, voiture, voitures, moto, motos, automobile, cars, vehicules',
    sites: 'lacentrale.fr autoplus.fr caradisiac.com largus.fr aramisauto.com oscaro.com mister-auto.com norauto.fr feuvert.fr moto-station.com autoscout24.fr tesla.com renault.fr peugeot.fr citroen.fr toyota.fr fiches-auto.fr chargemap.com',
  },
  {
    id: 'delivery', group: 'life', emoji: '📦', fr: 'Colis', en: 'Parcels',
    desc: 'Colis et livraisons : suivre un envoi, points relais, transporteurs. Parcel tracking and deliveries.',
    keywords: 'colis, suivi de colis, suivre un colis, tracking, livraison, livraisons, expedition, paquet, parcel, shipment, point relais',
    aliases: 'colis, livraisons, livraison, suivi colis, envois',
    sites: 'laposte.fr colissimo.fr chronopost.fr mondialrelay.fr ups.com dhl.com dhl.fr fedex.com dpd.com dpd.fr gls-group.com relaiscolis.com colisprive.com 17track.net parcelsapp.com aftership.com',
  },
  {
    id: 'utilities', group: 'life', emoji: '⚡', fr: 'Énergie & télécoms', en: 'Utilities',
    desc: 'Énergie et télécoms : électricité, gaz, eau, factures, box internet, forfait mobile, opérateurs. Energy, internet and phone providers.',
    keywords: 'electricite, gaz, energie, facture, factures, box internet, fibre, forfait mobile, operateur, compteur, linky',
    aliases: 'energie, factures, abonnements, operateurs, box, telephonie, telecoms, fournisseurs',
    sites: 'edf.fr engie.fr totalenergies.fr ekwateur.fr enercoop.fr octopusenergy.fr enedis.fr grdf.fr veolia.fr orange.fr sosh.fr free.fr mobile.free.fr sfr.fr red-by-sfr.fr bouyguestelecom.fr ariase.com degrouptest.com nperf.com',
  },
  // Travel
  {
    id: 'travel', group: 'travel', emoji: '✈️', fr: 'Voyages', en: 'Travel',
    desc: 'Voyages et vacances : billets de train et d’avion, hôtels, locations de vacances, guides de voyage, itinéraires. Trips, flights, hotels and travel guides.',
    keywords: 'voyage, voyages, vacances, travel, trip, sejour, hotel, hotels, vol, vols, flight, flights, billet, billets de train, train, location de voiture, camping, itineraire, road trip, destination, guide de voyage, visa',
    aliases: 'voyages, voyage, vacances, travel, trips, sejours, week-end, weekend, destinations, road trip',
    sites: 'sncf-connect.com sncf.com ouigo.com trainline.fr trainline.com airfrance.fr airfrance.com easyjet.com ryanair.com transavia.com vueling.com volotea.com booking.com airbnb.fr airbnb.com abritel.fr gites-de-france.com expedia.fr hotels.com trivago.fr kayak.fr skyscanner.fr opodo.fr edreams.fr lastminute.com tripadvisor.fr tripadvisor.com routard.com lonelyplanet.com lonelyplanet.fr petitfute.com flixbus.fr blablacar.fr europcar.fr hertz.fr sixt.fr rentalcars.com getyourguide.fr viator.com campings.com tui.fr voyageprive.com rome2rio.com seat61.com google.com/travel',
  },
  {
    id: 'maps', group: 'travel', emoji: '🗺️', fr: 'Cartes & transports', en: 'Maps & transit',
    desc: 'Cartes, itinéraires et transports en commun : GPS, plans, trafic, horaires de métro et de bus. Maps, directions and public transport.',
    keywords: 'itineraire, gps, trafic, transports en commun, metro, bus, tram, horaires, maps, map',
    aliases: 'cartes, carte, maps, plans, transports en commun, itineraires',
    sites: 'maps.google.com google.com/maps google.fr/maps openstreetmap.org viamichelin.fr mappy.com waze.com geoportail.gouv.fr citymapper.com ratp.fr iledefrance-mobilites.fr uber.com',
  },
  // Social
  {
    id: 'social', group: 'social', emoji: '💬', fr: 'Réseaux sociaux', en: 'Social networks',
    desc: 'Réseaux sociaux et communautés : profils, publications, forums, groupes, partage. Social networks, forums and communities.',
    keywords: 'reseau social, reseaux sociaux, social, profil, followers, communaute, forum, forums, groupe, post, tweet, story, subreddit',
    aliases: 'reseaux sociaux, reseaux, social, social media, communautes, forums, forum',
    sites: 'facebook.com instagram.com x.com twitter.com linkedin.com tiktok.com snapchat.com tumblr.com mastodon.social bsky.app threads.net quora.com vk.com 9gag.com imgur.com meetup.com nextdoor.fr',
    platforms: 'reddit.com old.reddit.com pinterest.com pinterest.fr',
  },
  {
    id: 'messaging', group: 'social', emoji: '✉️', fr: 'Mail & messagerie', en: 'Mail & chat',
    desc: 'E-mail, messagerie et visioconférence : boîtes mail, webmail, chat, appels vidéo. Email, chat and video calls.',
    keywords: 'mail, email, e-mail, courriel, messagerie, webmail, boite mail, inbox, visio, visioconference, appel video',
    aliases: 'mail, mails, email, emails, messagerie, messageries, webmail, chat, visio',
    sites: 'mail.google.com gmail.com outlook.live.com outlook.office.com outlook.com mail.yahoo.com proton.me protonmail.com tuta.com tutanota.com zimbra.free.fr laposte.net messagerie.orange.fr mail.orange.fr gmx.fr gmx.com fastmail.com web.whatsapp.com whatsapp.com telegram.org web.telegram.org signal.org messenger.com discord.com slack.com teams.microsoft.com teams.live.com zoom.us meet.google.com meet.jit.si',
  },
  {
    id: 'dating', group: 'social', emoji: '💘', fr: 'Rencontres', en: 'Dating',
    desc: 'Sites et applications de rencontre. Dating sites and apps.',
    keywords: 'site de rencontre, sites de rencontre, dating, celibataire, celibataires, flirt',
    aliases: 'rencontres, rencontre, dating, love',
    sites: 'meetic.fr tinder.com badoo.com happn.com bumble.com okcupid.com adopteunmec.com fruitz.io hinge.co grindr.com elitesingles.fr',
  },
  // Learning
  {
    id: 'courses', group: 'learning', emoji: '🧑‍🏫', fr: 'Cours & tutos', en: 'Courses & tutorials',
    desc: 'Cours en ligne et tutoriels : formations, MOOC, apprendre une langue, guides pas à pas, exercices. Online courses and step-by-step tutorials.',
    keywords: 'formation, formations, tutoriel, tutoriels, tutorial, tuto, tutos, apprendre, learn, learning, mooc, lecon, lesson, exercices, quiz, langues, anglais, debutant, pas a pas',
    aliases: 'cours, formations, formation, tutoriels, tutos, tuto, tutorials, apprendre, learning, e-learning, mooc, langues, a apprendre',
    sites: 'openclassrooms.com coursera.org udemy.com edx.org khanacademy.org fun-mooc.fr futurelearn.com codecademy.com grafikart.fr zestedesavoir.com duolingo.com babbel.com busuu.com memrise.com ankiweb.net quizlet.com brilliant.org skillshare.com domestika.org masterclass.com wikihow.com wikihow.fr commentcamarche.net it-connect.fr linkedin.com/learning',
  },
  {
    id: 'reference', group: 'learning', emoji: '📖', fr: 'Wiki & dictionnaires', en: 'Reference',
    desc: 'Encyclopédies, dictionnaires, traduction, archives et travaux de recherche. Encyclopedias, dictionaries, translation and research papers.',
    keywords: 'wiki, encyclopedie, dictionnaire, dictionary, definition, traduction, translation, synonyme, synonymes, conjugaison, archive, archives, these, recherche scientifique',
    aliases: 'wiki, references, reference, dictionnaires, dictionnaire, recherche, research, archives',
    sites: 'wiktionary.org larousse.fr lerobert.com cnrtl.fr wordreference.com reverso.net linguee.fr britannica.com universalis.fr cairn.info persee.fr scholar.google.com scholar.google.fr arxiv.org researchgate.net hal.science archive.org gallica.bnf.fr bnf.fr insee.fr ourworldindata.org statista.com wolframalpha.com synonymo.fr le-conjugueur.lefigaro.fr data.gouv.fr',
    platforms: 'wikipedia.org',
  },
  {
    id: 'school', group: 'learning', emoji: '🏫', fr: 'École & études', en: 'School',
    desc: 'École et études : espace numérique de travail, notes, devoirs, Parcoursup, université, révisions. School portals, homework and university.',
    keywords: 'ecole, college, lycee, universite, fac, etudiant, etudiants, devoirs, bac, brevet, parcoursup, pronote, enseignant, revisions, scolarite',
    aliases: 'ecole, etudes, fac, universite, scolaire, lycee, college, scolarite, ent, pronote, school, university, cours fac',
    sites: 'ecoledirecte.com parcoursup.fr parcoursup.gouv.fr etudiant.gouv.fr messervices.etudiant.gouv.fr education.gouv.fr monlycee.net skolengo.com cned.fr kartable.fr schoolmouv.fr lumni.fr digischool.fr studocu.com onisep.fr letudiant.fr classroom.google.com',
  },
  // Tools
  {
    id: 'tools', group: 'tools', emoji: '🔧', fr: 'Outils en ligne', en: 'Online tools',
    desc: 'Outils en ligne : convertir, compresser, éditer un PDF, traduire, envoyer de gros fichiers, tester son débit, générer un QR code. Online utilities.',
    keywords: 'outil, outils, tool, tools, generateur, generator, convertir, convertisseur, converter, conversion, compresser, compress, pdf, calculatrice, calculator, testeur, en ligne, online, traduire, traducteur, translate, qr code, raccourcir, speedtest, transfert de fichiers',
    aliases: 'outils en ligne, outils web, online tools, web tools, utilitaires en ligne',
    sites: 'ilovepdf.com smallpdf.com tinypng.com squoosh.app remove.bg convertio.co cloudconvert.com online-convert.com deepl.com translate.google.com translate.google.fr wetransfer.com swisstransfer.com speedtest.net fast.com qr-code-generator.com bitly.com tinyurl.com timeanddate.com calculator.net lipsum.com photopea.com archive.ph 12ft.io downdetector.fr temp-mail.org yopmail.com pastebin.com excalidraw.com diagrams.net app.diagrams.net framadate.org doodle.com google.com google.fr bing.com duckduckgo.com qwant.com startpage.com ecosia.org',
  },
  {
    id: 'productivity', group: 'tools', emoji: '📝', fr: 'Productivité', en: 'Productivity',
    desc: 'Productivité et bureautique : notes, tâches, agenda, documents partagés, stockage en ligne, gestion de projet. Notes, tasks, calendars, documents and cloud storage.',
    keywords: 'productivite, productivity, taches, todo, to-do, agenda, calendrier, calendar, stockage en ligne, cloud storage, partage de fichiers, kanban, bureautique, tableur',
    aliases: 'productivite, productivity, organisation, notes, agenda, bureautique, documents, office, gestion de projet, todo',
    sites: 'notion.so notion.site trello.com asana.com todoist.com ticktick.com evernote.com onenote.com docs.google.com drive.google.com sheets.google.com slides.google.com calendar.google.com keep.google.com dropbox.com onedrive.live.com office.com microsoft365.com icloud.com airtable.com monday.com clickup.com miro.com obsidian.md logseq.com zotero.org mega.nz pcloud.com atlassian.net linear.app basecamp.com calendly.com docusign.com yousign.com',
  },
  {
    id: 'design', group: 'tools', emoji: '🎨', fr: 'Design', en: 'Design',
    desc: 'Design et création graphique : maquettes, polices, couleurs, icônes, illustrations, banques d’images, inspiration. Graphic design resources and inspiration.',
    keywords: 'design, graphisme, graphic design, ui, ux, maquette, mockup, logo, typographie, font, fonts, couleurs, palette, icones, icons, illustration, inspiration, vectoriel',
    aliases: 'design, graphisme, crea, creation, inspiration, ui, ux, ressources graphiques, polices, fonts, icones, images',
    sites: 'figma.com canva.com dribbble.com behance.net adobe.com fonts.google.com dafont.com fontsquirrel.com coolors.co colorhunt.co flaticon.com fontawesome.com unsplash.com pexels.com pixabay.com freepik.com shutterstock.com gettyimages.fr elements.envato.com awwwards.com mobbin.com lottiefiles.com spline.design framer.com webflow.com artstation.com deviantart.com',
  },
  // Adult
  {
    id: 'adult', group: 'adult', emoji: '🔞', fr: 'Porn', en: 'Porn', own: true,
    desc: 'Contenu pornographique et pour adultes : vidéos X, webcams, sites de charme. Pornographic and adult content.',
    keywords: 'porn, porno, xxx, sex, sexe, nsfw, hentai, milf, nude, nudes, naked, cam girl, camgirl, webcam sexe, erotique, erotic, adult, 18+, escort',
    aliases: 'porn, porno, pornos, adulte, adultes, adult, xxx, nsfw, 18+, sexe, sex, hot',
    sites: 'pornhub.com xvideos.com xnxx.com xhamster.com redtube.com youporn.com tube8.com spankbang.com eporner.com onlyfans.com fansly.com chaturbate.com stripchat.com bongacams.com cam4.com livejasmin.com myfreecams.com brazzers.com rule34.xxx e-hentai.org nhentai.net jacquieetmichel.net dorcelvision.com marcdorcel.com tukif.com porntrex.com txxx.com hclips.com beeg.com motherless.com porn.com sex.com literotica.com xhamster.desi pornhub.org youjizz.com hentaihaven.xxx',
  },
  // Dead links
  {
    id: 'dead', group: 'dead', emoji: '🚫', fr: 'Sites inaccessibles', en: 'Unreachable sites', own: true,
    desc: 'Sites qui ne répondent plus.',
    keywords: '',
    aliases: 'sites inaccessibles, sites morts, liens morts, liens casses, dead links, broken links, unreachable sites, dead sites, hors ligne, offline',
    sites: '',
  },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));
const GROUP_BY_ID = new Map(GROUPS.map((g) => [g.id, g]));

export function categoryById(id: string): Category | undefined {
  return BY_ID.get(id);
}

export function groupById(id: GroupId): Group {
  return GROUP_BY_ID.get(id) as Group;
}

/** Name of a category or a group in the language of the interface. */
export function localName(x: { id: string; fr: string; en: string }, lang: string): string {
  return nameIn('group' in x ? x.id : `g:${x.id}`, x.fr, x.en, lang);
}

/** Text given to the model to describe a category. */
export function categoryPrototype(c: Category, lang: string): string {
  return `${localName(c, lang)} : ${c.desc}`;
}

const list = (s: string) => s.split(',').map((x) => fold(x).trim()).filter(Boolean);

// --- Known sites ------------------------------------------------------------------------------------------

export interface SiteMatch {
  category: string;
  /** The site key that matched, shown in the reason ("netflix.com"). */
  site: string;
  platform: boolean;
}

const SITE_INDEX = new Map<string, SiteMatch>();
for (const c of CATEGORIES) {
  for (const [field, platform] of [[c.sites, false], [c.platforms ?? '', true]] as const) {
    for (const raw of field.split(/\s+/)) {
      const site = raw.trim().toLowerCase();
      if (site && !SITE_INDEX.has(site)) SITE_INDEX.set(site, { category: c.id, site, platform });
    }
  }
}

/** The known-site entry for an address, from the most precise key ("host/path") to the brand ("amazon.*"). */
export function knownSite(url: string): SiteMatch | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  const first = u.pathname.split('/').filter(Boolean)[0]?.toLowerCase() ?? '';
  const second = u.pathname.split('/').filter(Boolean)[1]?.toLowerCase() ?? '';
  const labels = host.split('.');
  const hosts = labels.slice(0, -1).map((_, i) => labels.slice(i).join('.'));
  // Paths first ("linkedin.com/jobs" beats "fr.linkedin.com"), then hosts from the most precise.
  const keys: string[] = [];
  for (const h of hosts) {
    if (first && second) keys.push(`${h}/${first}/${second}`);
    if (first) keys.push(`${h}/${first}`);
  }
  keys.push(...hosts);
  for (const k of keys) {
    const hit = SITE_INDEX.get(k);
    if (hit) return hit;
  }
  const reg = registrableDomain(host);
  const brand = reg.split('.')[0];
  if (brand) {
    const hit = SITE_INDEX.get(`${brand}.*`);
    if (hit) return { ...hit, site: reg };
  }
  return null;
}

// --- Address patterns ----------------------------------------------------------------------------------

const PATTERNS: [RegExp, string, string][] = [
  // Adult content: dedicated top-level domains and unambiguous words in the host name.
  [/\.(xxx|porn|sex|adult|sexy)$/, 'adult', '.xxx'],
  [/(porn(?!ic)|xxx|hentai|nsfw|xvideo|xnxx|xhamster|camgirl|onlyfans|fansly|jacquieetmichel|dorcel|tukif|redtube|youporn)/, 'adult', 'porn'],
  [/(^|[.-])sex(e|y)?([.-]|cam|tube|chat|toy|shop|story)/, 'adult', 'sex'],
  // Streaming and download sites change domains often but keep their names.
  [/(french-?stream|wiflix|papadustream|voir-?films?|streamcomplet|coflix|empire-?stream|anime-?sama|voiranime|vostfree|franime|streamonsport|sport-?stream|film-?streaming|serie-?streaming|streaming-?(vf|film|serie)|filmstreaming|vfstream|stream-?vf)/, 'streaming', 'streaming'],
  [/(ygg-?torrent|torrent|zone-?telechargement|wawacity|extreme-?down|annuaire-?telechargement|darkiworld)/, 'downloads', 'torrent'],
  // Government sites.
  [/(\.|^)gouv\.fr$|\.gov(\.[a-z]{2})?$|\.gc\.ca$|\.admin\.ch$|\.belgium\.be$|\.service-public\.fr$/, 'admin', '.gouv.fr'],
  // School portals and universities.
  [/(\.|^)ac-[a-z-]+\.fr$|(\.|^)univ-[a-z0-9-]+\.fr$|\.edu$|\.ac\.uk$|index-education\.net$|(^|\.)moodle\.|(^|\.)ent\.|(^|\.)pronote\./, 'school', 'école'],
  // Regional banks.
  [/(^|\.)ca-[a-z-]+\.fr$|(^|\.)credit-?agricole\.|(^|\.)banque-?populaire\.|(^|\.)caisse-?epargne\./, 'bank', 'banque'],
  // Webmail.
  [/^(webmail|mail|messagerie|courrier)\./, 'messaging', 'webmail'],
];

/** Category given by the shape of the address alone. */
export function addressPattern(host: string): { category: string; label: string } | null {
  const h = host.toLowerCase().replace(/^www\./, '');
  for (const [re, category, label] of PATTERNS) if (re.test(h)) return { category, label };
  return null;
}

/** Words that, alone in a title, make a page adult content. */
const ADULT_WORDS = /\b(porn|porno|xxx|hentai|nsfw|milf|nude|nudes|sexcam|sex cam|camgirl|camgirls|webcam sexe|video x|videos x|film x|films x)\b/;

export function adultTitle(text: string): boolean {
  return ADULT_WORDS.test(fold(text));
}

// --- Keywords --------------------------------------------------------------------------------------------

interface KeywordIndex {
  words: Map<string, string[]>;
  phrases: [string, string][];
}

const KEYWORDS: KeywordIndex = (() => {
  const words = new Map<string, string[]>();
  const phrases: [string, string][] = [];
  for (const c of CATEGORIES) {
    for (const k of list(c.keywords)) {
      if (k.includes(' ') || k.includes('-')) phrases.push([k, c.id]);
      else words.set(k, [...(words.get(k) ?? []), c.id]);
    }
  }
  return { words, phrases };
})();

/** Number of keywords of each category found in a text (folded words). */
export function keywordHits(text: string): Map<string, number> {
  const t = ` ${fold(text).replace(/[^\p{L}\p{M}\p{N}+]+/gu, ' ')} `;
  const hits = new Map<string, number>();
  const add = (id: string) => hits.set(id, (hits.get(id) ?? 0) + 1);
  for (const w of new Set(t.trim().split(' '))) for (const id of KEYWORDS.words.get(w) ?? []) add(id);
  for (const [p, id] of KEYWORDS.phrases) if (t.includes(` ${p.replace(/-/g, ' ')} `)) add(id);
  return hits;
}

// --- Folder names ------------------------------------------------------------------------------------------

const normalizeTitle = (title: string) =>
  fold(title.replace(/^[\p{Extended_Pictographic}\p{Emoji_Component}\uFE0F\u200D\s]+/u, ''))
    .replace(/[^\p{L}\p{M}\p{N}+ ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const CATEGORY_ALIASES = new Map<string, string>();
const GROUP_ALIASES = new Map<string, GroupId>();
const alias = <T>(m: Map<string, T>, name: string, value: T) => {
  const k = normalizeTitle(name);
  if (k && !m.has(k)) m.set(k, value);
};
// The names and aliases written for each folder first: a name in another language never takes one of them.
for (const c of CATEGORIES) for (const a of [c.fr, c.en, ...list(c.aliases)]) alias(CATEGORY_ALIASES, a, c.id);
for (const g of GROUPS) for (const a of [g.fr, g.en, ...list(g.aliases)]) alias(GROUP_ALIASES, a, g.id);
for (const c of CATEGORIES) for (const a of namesInEveryLanguage(c.id)) alias(CATEGORY_ALIASES, a, c.id);
for (const g of GROUPS) for (const a of namesInEveryLanguage(`g:${g.id}`)) alias(GROUP_ALIASES, a, g.id);

const CATCH_ALL = new Set(
  list(
    'divers, diverses, autre, autres, misc, miscellaneous, other, others, utile, utiles, a voir plus tard, a trier, trier, a classer, classer, non classe, non classes, unsorted, unfiled, to sort, temp, tmp, temporaire, nouveau dossier, new folder, sans titre, untitled, vrac, en vrac, bazar, fourre tout, stuff, random, old, ancien, anciens, vieux, a verifier, to check, to review, favoris, mes favoris, bookmarks, my bookmarks, liens, links, mes liens, sites, sites web, web, internet, general, nouveaux, new, recents, recent, ' +
      'varios, otros, nueva carpeta, marcadores, varie, altri, nuova cartella, segnalibri, sonstiges, verschiedenes, neuer ordner, lesezeichen, diversos, outros, nova pasta, favoritos, diversen, overig, nieuwe map, bladwijzers, różne, inne, nowy folder, zakładki, çeşitli, diğer, yeni klasör, yer imleri, ' +
      'разное, другое, новая папка, закладки, різне, інше, нова папка, متفرقات, أخرى, مجلد جديد, विविध, अन्य, नया फ़ोल्डर, বিবিধ, অন্যান্য, lain-lain, lainnya, folder baru, khác, thư mục mới, その他, 新しいフォルダ, 기타, 새 폴더, 其他, 其它, 新建文件夹, 新增資料夾',
  ).map(normalizeTitle),
);
// "To check" and "Untitled" in every language: an earlier sort's folder of bookmarks to check is sorted again.
for (const a of [...namesInEveryLanguage('review'), ...namesInEveryLanguage('untitled')]) CATCH_ALL.add(normalizeTitle(a));
const CATCH_ALL_PATTERNS = [/^(importe|importes|imported|import)\b/, /^(nouveau dossier|new folder|dossier|folder)( \d+)?$/, /^(from|depuis) (firefox|safari|edge|chrome|opera|internet explorer|ie)$/];

/** What an existing folder means, from its name. */
export type FolderRole = { kind: 'category'; category: string } | { kind: 'group'; group: GroupId } | { kind: 'catch-all' } | { kind: 'personal' };

export function folderRole(title: string): FolderRole {
  const t = normalizeTitle(title);
  if (!t) return { kind: 'catch-all' };
  if (CATCH_ALL.has(t) || CATCH_ALL_PATTERNS.some((re) => re.test(t))) return { kind: 'catch-all' };
  const category = CATEGORY_ALIASES.get(t);
  if (category) return { kind: 'category', category };
  const group = GROUP_ALIASES.get(t);
  if (group) return { kind: 'group', group };
  // A short name that contains a category ("Développement web", "Recettes de mamie"); group names only match
  // exactly, or "Projet maison" would read as a home folder.
  const words = t.split(' ');
  if (words.length <= 4) {
    for (let len = Math.min(3, words.length - 1); len >= 1; len--) {
      for (let i = 0; i + len <= words.length; i++) {
        const hit = CATEGORY_ALIASES.get(words.slice(i, i + len).join(' '));
        if (hit && words.slice(i, i + len).join('').length >= 3) return { kind: 'category', category: hit };
      }
    }
  }
  return { kind: 'personal' };
}

/** Folders created by Nidomark to back up a tree before a sort, in any language ("Nidomark – …"); never sorted again. */
export function isBackupTitle(title: string): boolean {
  return /^nidomark\b/i.test(title) && (/\s[–-]\s/.test(title) || /\b(sauvegarde|backup)\b/i.test(title));
}
