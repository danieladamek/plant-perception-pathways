import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { PACK } from '../helpers';

test('every scenario in the pack has a walkthrough spec', () => {
  const specs = fs.readdirSync('tests/walkthroughs').filter((f) => f.endsWith('.spec.ts')).map((f) => fs.readFileSync(`tests/walkthroughs/${f}`, 'utf8')).join('\n');
  const missing = (PACK('scenarios.yaml') as { id: string }[]).map((s) => s.id).filter((id) => !new RegExp(`test\\(\`?'?${id} —`).test(specs) && !specs.includes(`\`${id} —`));
  expect(missing).toEqual([]);
});
