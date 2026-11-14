import './fixtures/psl';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, GROUPS, addressPattern, adultTitle, folderRole, isBackupTitle, keywordHits, knownSite, knownSiteFor, namesCategory } from '../lib/taxonomy';

describe('known sites', () => {
  it.each([
    ['https://www.netflix.com/browse', 'streaming'],
    ['https://fr.pornhub.com/view_video.php?viewkey=1', 'adult'],
    ['https://korben.info/un-article.html', 'technews'],
    ['https://www.numerama.com/tech/123-iphone.html', 'technews'],
    ['https://www.amazon.co.uk/dp/B000', 'shopping'],
    ['https://www.amazon.fr/gp/video/detail/ABC', 'streaming'],
    ['https://aws.amazon.com/console/', 'cloud'],
    ['https://www.google.com/maps/place/Paris', 'maps'],
    ['https://mail.google.com/mail/u/0/', 'messaging'],
    ['https://fr.linkedin.com/jobs/view/123', 'jobs'],
    ['https://www.linkedin.com/in/someone', 'social'],
    ['https://rmcsport.bfmtv.com/football/', 'sport'],
    ['https://www.bfmtv.com/politique/', 'news'],
    ['https://www.e.leclerc/fp/123', 'shopping'],
  ])('%s → %s', (url, category) => {
    expect(knownSite(url)?.category).toBe(category);
  });

  it('counts the pages of a store, a tech news site or a course platform as a platform, never their home page', () => {
    expect([knownSiteFor('https://www.amazon.fr/Cookeo/dp/B000')?.platform, knownSiteFor('https://korben.info/un-article.html')?.platform]).toEqual([true, true]);
    expect([knownSiteFor('https://www.amazon.fr/')?.platform, knownSiteFor('https://www.netflix.com/browse')?.platform]).toEqual([false, false]);
  });

  it('marks multi-topic platforms', () => {
    expect(knownSite('https://www.youtube.com/watch?v=abc')).toMatchObject({ category: 'video', platform: true });
    expect(knownSite('https://music.youtube.com/playlist?list=1')).toMatchObject({ category: 'music', platform: false });
    expect(knownSite('https://github.com/user/repo')).toMatchObject({ category: 'dev', platform: true });
  });

  it('knows nothing about personal sites', () => {
    expect(knownSite('https://jellyfin.maison-dupont.fr/')).toBeNull();
    expect(knownSite('not a url')).toBeNull();
  });

  it('lists each site once', () => {
    const seen = new Map<string, string>();
    for (const c of CATEGORIES) for (const s of `${c.sites} ${c.platforms ?? ''}`.split(/\s+/).filter(Boolean)) {
      expect(seen.get(s), `${s} in ${c.id} and ${seen.get(s)}`).toBeUndefined();
      seen.set(s, c.id);
    }
  });
});

describe('address patterns', () => {
  it.each([
    ['www.impots.gouv.fr', 'admin'],
    ['some.service.gov.uk', 'admin'],
    ['ca-paris.fr', 'bank'],
    ['ent.ac-versailles.fr', 'school'],
    ['moodle.univ-lille.fr', 'school'],
    ['webmail.free.fr', 'messaging'],
    ['french-stream.pink', 'streaming'],
    ['something.xxx', 'adult'],
    ['hot-sexcam-live.com', 'adult'],
    ['fr.xvideos.com', 'adult'],
  ])('%s → %s', (host, category) => {
    expect(addressPattern(host)?.category).toBe(category);
  });

  it('does not mistake towns or words for adult sites', () => {
    for (const host of ['www.pornic.fr', 'ville-pornichet.fr', 'essex.ac.uk', 'sextant-voile.fr', 'middlesex.gov.uk', 'www.jeuxvideo.com']) expect(addressPattern(host)?.category).not.toBe('adult');
  });

  it('recognises explicit titles', () => {
    expect(adultTitle('Hot MILF video')).toBe(true);
    expect(adultTitle('Recette de la tarte aux pommes')).toBe(false);
  });
});

describe('keywords', () => {
  it('finds words and phrases', () => {
    const hits = keywordHits('Les meilleures recettes de gâteau au chocolat');
    expect(hits.get('cooking')).toBeGreaterThan(0);
    expect(keywordHits('Suivi de colis Chronopost').get('delivery')).toBeGreaterThan(0);
  });

  it('ignores common words that mean nothing alone', () => {
    const hits = keywordHits("J'ai un chat, en cours de route, avec un code postal");
    expect(hits.get('ai')).toBeUndefined();
    expect(hits.get('messaging')).toBeUndefined();
    expect(hits.get('dev')).toBeUndefined();
  });
});

describe('folder roles', () => {
  it.each([
    ['Séries', { kind: 'category', category: 'streaming' }],
    ['📺 Streaming', { kind: 'category', category: 'streaming' }],
    ['Domotique', { kind: 'category', category: 'home-automation' }],
    ['Loisirs', { kind: 'group', group: 'leisure' }],
    ['Divers', { kind: 'catch-all' }],
    ['Importés depuis Firefox', { kind: 'catch-all' }],
    ['Nouveau dossier (2)', { kind: 'catch-all' }],
    ['Mariage 2025', { kind: 'personal' }],
    ['Achats domotique', { kind: 'category', category: 'home-automation' }],
    ['Menu des marque-pages', { kind: 'catch-all' }],
    ['Bookmarks Toolbar', { kind: 'catch-all' }],
  ])('%s', (title, role) => {
    expect(folderRole(title)).toEqual(role);
  });

  it('lets a folder name a category, never after one site or one product', () => {
    expect(['Recettes', 'Photos', 'Cloud', 'Code', 'Météo', 'Dev', 'Actu', 'Déco', 'Impôts'].map(namesCategory)).toEqual(Array(9).fill(true));
    expect(['Netflix', 'YouTube', 'GitHub', 'Linux', 'Home Assistant'].map(namesCategory)).toEqual(Array(5).fill(false));
  });

  it('recognises its own backups', () => {
    expect(isBackupTitle('Nidomark – sauvegarde du 08/11/2026 14:10')).toBe(true);
    expect(isBackupTitle('Nidomark backup – 2026-11-08 14:10')).toBe(true);
    expect(isBackupTitle('Sauvegarde')).toBe(false);
  });

  it('has a group for every category', () => {
    const groups = new Set(GROUPS.map((g) => g.id));
    for (const c of CATEGORIES) expect(groups.has(c.group)).toBe(true);
  });
});
