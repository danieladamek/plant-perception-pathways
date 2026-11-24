import { test, expect, lintClean, treeOpen } from './_shared';
import { go, PACK, seen } from '../helpers';
const strings = PACK('ui-strings.yaml');
const pz06 = PACK('paths.yaml').paths.find((p: any) => p.path_id === 'PZ06');

test('w2 — look at a candidate sense and the About framing', async ({ page }) => {
  await seen(page);
  await go(page, '/tree');
  const tree = page.getByTestId('tree-list');
  await expect(tree).toContainText('Candidate senses (contested)');
  await treeOpen(page, 'PZ06');
  await expect(page).toHaveURL(/#\/path\/PZ06/);
  await expect(page.getByTestId('tier').first()).toContainText('B3');
  // the claim and the counter-evidence: Ahmad et al. and Harris et al.
  expect(pz06.hypothesis_group).toMatch(/CLAIM Ahmad et al\. /);
  expect(pz06.hypothesis_group).toMatch(/COUNTER Harris et al\. /);
  await expect(page.locator('main')).toContainText(pz06.hypothesis_group);
  await expect(page.getByTestId('path-panel')).toContainText('Ahmad et al.');
  await expect(page.getByTestId('path-panel')).toContainText('Harris et al.');
  // must_not: a candidate sense shown in an established branch of the tree
  await go(page, '/tree');
  const established = await page.getByTestId('tree-list').evaluate((el) => {
    const bad: string[] = [];
    el.querySelectorAll('a[href^="#/path/"]').forEach((a) => {
      const branches: string[] = [];
      for (let n = a.parentElement; n && n !== el; n = n.parentElement) {
        const s = n.querySelector(':scope > summary');
        if (s) branches.push(s.textContent ?? '');
      }
      const inCandidate = branches.some((b) => b.includes('Candidate senses'));
      const isPZ = /#\/path\/PZ/.test(a.getAttribute('href') ?? '');
      if (isPZ !== inCandidate) bad.push(`${a.textContent} under ${branches.join(' / ')}`);
    });
    return bad;
  });
  expect(established).toEqual([]);
  // About: "Is this perception? Two views"
  await go(page, '/about');
  const note = page.getByTestId('context-note');
  await expect(note).toContainText('Is this perception? Two views');
  await expect(note.getByRole('link', { name: /\[150\] Calvo et al\. 2019/ })).toHaveAttribute('href', '#/references');
  // must_not: any sentence asserting plants are conscious, feel pain, hear or learn
  await lintClean(page, 'contested-framing');
});

test('w2 — the "candidate sense — not established" badge on PZ06', async ({ page }) => {
  await seen(page);
  await go(page, '/path/PZ06');
  await expect(page.locator('main')).toContainText(strings.badges.candidate_sense);
});

test('w2 — the About framing cites both positions and states that the app does not answer the question', async ({ page }) => {
  await seen(page);
  await go(page, '/about');
  const note = page.getByTestId('context-note');
  await expect(note.getByRole('link', { name: /\[149\] Taiz et al\. 2019/ })).toHaveAttribute('href', '#/references');
  await expect(note.getByRole('link', { name: /\[150\] Calvo et al\. 2019/ })).toHaveAttribute('href', '#/references');
  await expect(note).toContainText('this app does not answer it');
});
