#!/usr/bin/env node
// ckalab: hands-on CKA labs on a local kind cluster, with XP claimed on your phone.
//
//   ckalab up                 create the 3-node practice cluster
//   ckalab list               labs and your best times
//   ckalab start <lab>        reset and break things for a lab, start the clock
//   ckalab check              verify your fix; prints a QR code to claim XP
//   ckalab hint | solution    nudge or full walkthrough for the current lab
//   ckalab reset              undo the current lab
//   ckalab down               delete the cluster
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLUSTER, CONTEXT, k } from './lib/kube.mjs';
import * as w1 from './defs/week1.mjs';
import * as w2 from './defs/week2.mjs';
import * as w34 from './defs/week3-4.mjs';
import { LABS, LAB_BY_ID, claimPayload } from '../mobile/src/content/labs.ts';

const here = dirname(fileURLToPath(import.meta.url));
const IMPL = Object.fromEntries([...Object.values(w1), ...Object.values(w2), ...Object.values(w34)].map((l) => [l.id, l]));
const STATE_DIR = join(homedir(), '.ckagram');
const STATE_FILE = join(STATE_DIR, 'labs-state.json');

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  gold: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { current: null, best: {} };
  }
}
function saveState(s) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

function kindBin() {
  const winget = join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Links', 'kind.exe');
  for (const bin of ['kind', winget]) {
    const r = spawnSync(bin, ['version'], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return bin;
  }
  throw new Error('kind is not installed. Windows: winget install Kubernetes.kind');
}

function clusterExists() {
  const r = spawnSync(kindBin(), ['get', 'clusters'], { encoding: 'utf8' });
  return (r.stdout ?? '').split(/\s+/).includes(CLUSTER);
}

function requireCluster() {
  if (!clusterExists()) {
    console.log(c.red('No lab cluster yet. Run: ckalab up'));
    process.exit(1);
  }
}

const fmtTime = (s) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;

async function resetLab(id) {
  const lab = IMPL[id];
  if (!lab) return;
  if (lab.cleanup) await lab.cleanup();
  if (lab.ns) k.try('delete', 'namespace', lab.ns, '--wait=true', '--timeout=90s');
}

const commands = {
  async up() {
    if (clusterExists()) {
      console.log(c.green(`✓ Cluster ${CLUSTER} already exists (context ${CONTEXT}).`));
      return;
    }
    console.log(c.bold('Creating a 3-node cluster (1 control plane, 2 workers). First run takes a few minutes…'));
    const r = spawnSync(kindBin(), ['create', 'cluster', '--config', join(here, 'kind-config.yaml'), '--wait', '180s'], { stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
    console.log(c.green(`\n✓ Ready. kubectl now points at ${CONTEXT}.`));
    console.log(`Next: ${c.cyan('ckalab list')}`);
  },

  async down() {
    const state = loadState();
    state.current = null;
    saveState(state);
    spawnSync(kindBin(), ['delete', 'cluster', '--name', CLUSTER], { stdio: 'inherit' });
  },

  async list() {
    const state = loadState();
    console.log(c.bold('\nCKAgram laptop labs\n'));
    for (const l of LABS) {
      const best = state.best[l.id];
      const mark = best !== undefined ? c.green('✓') : ' ';
      const time = best !== undefined ? c.green(`best ${fmtTime(best)}`) : c.dim(`target ${l.minutes}m`);
      const boss = l.boss ? c.gold(' 👑') : '';
      console.log(` ${mark} ${c.cyan(l.id.padEnd(18))} wk${l.week}  ${l.title}${boss}  ${c.dim(`+${l.xp} XP`)}  ${time}`);
    }
    console.log(`\nStart one: ${c.cyan('ckalab start <lab>')}\n`);
  },

  async start(id) {
    const meta = LAB_BY_ID[id];
    const lab = IMPL[id];
    if (!meta || !lab) {
      console.log(c.red(`Unknown lab "${id}". Run ckalab list.`));
      process.exit(1);
    }
    requireCluster();
    const state = loadState();
    if (state.current) {
      console.log(c.dim(`Cleaning up ${state.current.id}…`));
      await resetLab(state.current.id);
    }
    console.log(c.dim('Preparing the lab…'));
    await resetLab(id);
    if (lab.ns) await k.createNamespace(lab.ns);
    await lab.setup();
    state.current = { id, startedAt: Date.now(), hints: 0 };
    saveState(state);

    console.log(`\n${c.bold(`${meta.boss ? '👑 ' : ''}${meta.title}`)}  ${c.dim(`(${meta.domain}, target ${meta.minutes} min, +${meta.xp} XP)`)}\n`);
    console.log(lab.task);
    console.log(c.dim(`\nContext: ${CONTEXT}. In the exam, always run the given use-context command first.`));
    console.log(`\nWhen you think it's fixed: ${c.cyan('ckalab check')}   Stuck? ${c.cyan('ckalab hint')}\n`);
  },

  async hint() {
    const state = loadState();
    if (!state.current) return console.log('No lab running. ckalab start <lab>');
    const lab = IMPL[state.current.id];
    const i = Math.min(state.current.hints ?? 0, lab.hints.length - 1);
    console.log(`\n💡 ${lab.hints[i]}\n`);
    state.current.hints = i + 1;
    saveState(state);
  },

  async solution() {
    const state = loadState();
    if (!state.current) return console.log('No lab running. ckalab start <lab>');
    console.log(`\n${c.bold('Solution')}\n${IMPL[state.current.id].solution}\n`);
    state.current.sawSolution = true;
    saveState(state);
  },

  async reset() {
    const state = loadState();
    if (!state.current) return console.log('No lab running.');
    await resetLab(state.current.id);
    console.log(c.green(`✓ ${state.current.id} cleaned up.`));
    state.current = null;
    saveState(state);
  },

  async check() {
    const state = loadState();
    if (!state.current) return console.log('No lab running. ckalab start <lab>');
    requireCluster();
    const { id, startedAt } = state.current;
    const results = await IMPL[id].checks();
    console.log('');
    for (const [label, ok] of results) console.log(`  ${ok ? c.green('✓') : c.red('✗')} ${label}`);
    if (!results.every(([, ok]) => ok)) {
      console.log(c.dim('\nNot yet. Keep going (ckalab hint if stuck).\n'));
      return;
    }

    const seconds = Math.round((Date.now() - startedAt) / 1000);
    const meta = LAB_BY_ID[id];
    const prev = state.best[id];
    const pb = prev === undefined || seconds < prev;
    if (pb) state.best[id] = seconds;
    console.log(`\n${c.green(c.bold('🎉 Lab cleared!'))}  ${fmtTime(seconds)}${pb && prev !== undefined ? c.gold('  ⏱ new personal best') : ''}${seconds <= meta.minutes * 60 ? c.gold('  ⚡ under target') : ''}`);
    if (state.current.sawSolution) console.log(c.dim('(You opened the solution: XP still counts, but try it again cold later.)'));

    const completedAt = Date.now();
    const nonce = randomBytes(6).toString('hex');
    const sig = createHash('sha256').update(claimPayload(id, seconds, completedAt, nonce)).digest('hex').slice(0, 20);
    const url = `ckagram://claim?l=${id}&s=${seconds}&t=${completedAt}&n=${nonce}&h=${sig}`;

    try {
      const QR = (await import('qrcode')).default;
      console.log(`\nScan with CKAgram (Lab tab → Scan) to claim ${c.gold(`+${meta.xp} XP`)}:\n`);
      console.log(await QR.toString(url, { type: 'terminal', small: true }));
      const png = join(STATE_DIR, 'claim.png');
      await QR.toFile(png, url, { width: 480, margin: 2 });
      console.log(c.dim(`Bigger QR image: ${png}`));
    } catch {
      console.log(c.dim('\n(QR library missing: run npm install inside labs/)'));
    }
    console.log(c.dim(`Claim link: ${url}\n`));

    await resetLab(id);
    state.current = null;
    saveState(state);
  },

  async status() {
    const state = loadState();
    if (!state.current) return console.log('No lab running.');
    const s = Math.round((Date.now() - state.current.startedAt) / 1000);
    console.log(`${state.current.id}: running for ${fmtTime(s)}`);
  },

  async help() {
    const src = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 10).map((l) => l.replace(/^\/\/ ?/, ''));
    console.log(src.join('\n'));
  },
};

const [cmd = 'help', arg] = process.argv.slice(2);
const fn = commands[cmd];
if (!fn) {
  console.log(c.red(`Unknown command "${cmd}".`));
  await commands.help();
  process.exit(1);
}
if (!existsSync(join(here, 'node_modules')) && cmd === 'check') {
  console.log(c.dim('Tip: run npm install inside labs/ once so check can draw QR codes.'));
}
try {
  await fn(arg);
} catch (e) {
  console.error(c.red(`\n${e.message}`));
  process.exit(1);
}
