import { describe, expect, it } from 'vitest';
import { scoreBig, sortBig } from './fixtures/big-collection';

// A large collection as people keep them: nested folders, reading lists, an old Firefox import, YouTube videos and
// GitHub repositories on every subject, shops, tech blogs, home services, adult sites and duplicates.
describe('a large, messy collection', () => {
  const { proposal } = sortBig();
  const s = scoreBig(proposal);

  it('files nine bookmarks out of ten under their subject', () => {
    expect(s.ok / s.total, s.wrong.join('\n')).toBeGreaterThanOrEqual(0.88);
  });

  it('gives each subject one place, or nearly', () => {
    expect(s.placesPerSubject, JSON.stringify(s.scattered.slice(0, 5))).toBeLessThanOrEqual(1.85);
  });

  it('never shows a folder twice, nor inside a folder of the same name', () => {
    expect([...s.twins, ...s.nested, ...s.repeated]).toEqual([]);
  });

  it('leaves only the bookmarks that say nothing to check', () => {
    expect(proposal.review.length).toBeLessThanOrEqual(8);
  });
});
