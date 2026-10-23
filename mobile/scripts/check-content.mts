// Fails CI when a card is malformed. Run: node scripts/check-content.mts
// Imports card files directly (Node strips the TypeScript types).
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { commandMatches, tokenize } from '../src/engine/cmd.ts';
import type { Card, Question } from '../src/content/types.ts';

const DOMAINS = ['troubleshooting', 'architecture', 'networking', 'workloads', 'storage'];
const here = dirname(fileURLToPath(import.meta.url));
const cardsDir = join(here, '..', 'src', 'content', 'cards');

const errors: string[] = [];
const seen = new Set<string>();
let total = 0;

function checkQuestion(id: string, q: Question) {
  if (q.options.length < 2) errors.push(`${id}: needs at least 2 options`);
  if (new Set(q.options).size !== q.options.length) errors.push(`${id}: duplicate options`);
  if (q.answer < 0 || q.answer >= q.options.length) errors.push(`${id}: answer index out of range`);
}

for (const file of readdirSync(cardsDir).filter((f) => f.endsWith('.ts'))) {
  const mod = (await import(pathToFileURL(join(cardsDir, file)).href)) as { cards?: Card[] };
  if (!Array.isArray(mod.cards)) {
    errors.push(`${file}: must export "cards"`);
    continue;
  }
  for (const c of mod.cards) {
    total++;
    const id = `${file}:${c.id}`;
    if (seen.has(c.id)) errors.push(`${id}: duplicate id`);
    seen.add(c.id);
    if (!DOMAINS.includes(c.domain)) errors.push(`${id}: unknown domain ${c.domain}`);
    if (!(c.week >= 1 && c.week <= 14)) errors.push(`${id}: week must be 1-14`);
    if (!c.explain?.trim()) errors.push(`${id}: missing explain`);

    switch (c.type) {
      case 'concept':
        checkQuestion(id, c.check);
        break;
      case 'mcq':
        checkQuestion(id, c);
        break;
      case 'cmd': {
        const tiles = tokenize(c.answer);
        // The app pre-types kubectl and builds the rest from tiles.
        if (tiles[0] !== 'kubectl') errors.push(`${id}: answer must start with kubectl`);
        if (!commandMatches(tiles, c.answer)) errors.push(`${id}: answer does not match itself`);
        for (const d of c.distractors ?? []) {
          if (tiles.includes(d)) errors.push(`${id}: distractor "${d}" is also in the answer`);
        }
        for (const alt of c.alts ?? []) {
          const altTiles = tokenize(alt).sort().join(' ');
          if (altTiles !== [...tiles].sort().join(' ')) errors.push(`${id}: alt "${alt}" uses different tiles than the answer`);
        }
        break;
      }
      case 'yaml': {
        const lines = c.yaml.split('\n');
        if (c.bugLine < 0 || c.bugLine >= lines.length) {
          errors.push(`${id}: bugLine out of range`);
          break;
        }
        if (lines[c.bugLine] === c.fixLine) errors.push(`${id}: fixLine is the same as the bug line`);
        const fixed = [...lines];
        fixed[c.bugLine] = c.fixLine;
        try {
          parseYaml(fixed.join('\n'));
        } catch (e) {
          errors.push(`${id}: fixed YAML does not parse: ${(e as Error).message.split('\n')[0]}`);
        }
        break;
      }
      default:
        errors.push(`${id}: unknown card type`);
    }
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s) in ${total} cards:\n- ` + errors.join('\n- '));
  process.exit(1);
}
console.log(`✓ ${total} cards OK`);
