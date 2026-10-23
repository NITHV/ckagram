#!/usr/bin/env node
// ckalab: hands-on CKA labs on a local kind cluster, with XP claimed on your phone.
//
//   ckalab up                 create the 3-node practice cluster
//   ckalab list               labs and your best times
//   ckalab start <lab>        reset and break things for a lab, start the clock
//   ckalab check              verify your fix; prints a QR code to claim XP
//   ckalab hint | solution    nudge or full walkthrough for the current lab
//   ckalab mock [tasks]       mock exam: several labs at once on one clock (default 8)
//   ckalab submit | abort     grade the mock (QR code) | stop it without grading
//   ckalab reset | down       undo the current lab or mock | delete the cluster
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLUSTER, CONTEXT, k } from './lib/kube.mjs';
import { gradeMock, mockMinutes, pickMock, resetLab, resetMock, setupLab, setupMock } from './lib/mock.mjs';
import { IMPL } from './defs/index.mjs';
import { LABS, LAB_BY_ID, MOCK_LAB_ID, PASS_SCORE, claimPayload } from '../mobile/src/content/labs.ts';

const here = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(homedir(), '.ckagram');
const STATE_FILE = join(STATE_DIR, 'labs-state.json');
const MOCK_FILE = join(STATE_DIR, 'mock-tasks.txt');

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
    return { current: null, mock: null, best: {}, ...JSON.parse(readFileSync(STATE_FILE, 'utf8')) };
  } catch {
    return { current: null, mock: null, best: {} };
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

/** Cleans up whatever is running (a lab or a mock) and clears it from the state. */
async function clearRunning(state) {
  if (state.mock) {
    console.log(c.dim('Cleaning up the mock exam…'));
    await resetMock(state.mock.ids);
  }
  if (state.current) {
    console.log(c.dim(`Cleaning up ${state.current.id}…`));
    await resetLab(state.current.id);
  }
  state.current = null;
  state.mock = null;
  saveState(state);
}

/** Signs the claim and prints it as a QR code for the app's scanner. */
async function printClaim(lab, seconds, extraParams = {}, xpText = '') {
  const completedAt = Date.now();
  const nonce = randomBytes(6).toString('hex');
  const extra = extraParams.p !== undefined ? `${extraParams.p}|${extraParams.k}` : undefined;
  const sig = createHash('sha256').update(claimPayload(lab, seconds, completedAt, nonce, extra)).digest('hex').slice(0, 20);
  const more = Object.entries(extraParams).map(([key, v]) => `&${key}=${encodeURIComponent(v)}`).join('');
  const url = `ckagram://claim?l=${lab}&s=${seconds}&t=${completedAt}&n=${nonce}&h=${sig}${more}`;
  try {
    const QR = (await import('qrcode')).default;
    console.log(`\nScan with CKAgram (Lab tab → Scan) to claim ${c.gold(xpText)}:\n`);
    console.log(await QR.toString(url, { type: 'terminal', small: true }));
    const png = join(STATE_DIR, 'claim.png');
    await QR.toFile(png, url, { width: 480, margin: 2 });
    console.log(c.dim(`Bigger QR image: ${png}`));
  } catch {
    console.log(c.dim('\n(QR library missing: run npm install inside labs/)'));
  }
  console.log(c.dim(`Claim link: ${url}\n`));
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
    state.mock = null;
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
      console.log(` ${mark} ${c.cyan(l.id.padEnd(18))} wk${String(l.week).padEnd(3)} ${l.title}${boss}  ${c.dim(`+${l.xp} XP`)}  ${time}`);
    }
    console.log(`\nStart one: ${c.cyan('ckalab start <lab>')}    Mock exam: ${c.cyan('ckalab mock')}\n`);
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
    await clearRunning(state);
    console.log(c.dim('Preparing the lab…'));
    await setupLab(id);
    state.current = { id, startedAt: Date.now(), hints: 0 };
    saveState(state);

    console.log(`\n${c.bold(`${meta.boss ? '👑 ' : ''}${meta.title}`)}  ${c.dim(`(${meta.domain}, target ${meta.minutes} min, +${meta.xp} XP)`)}\n`);
    console.log(lab.task);
    console.log(c.dim(`\nContext: ${CONTEXT}. In the exam, always run the given use-context command first.`));
    console.log(`\nWhen you think it's fixed: ${c.cyan('ckalab check')}   Stuck? ${c.cyan('ckalab hint')}\n`);
  },

  async hint() {
    const state = loadState();
    if (state.mock) return console.log('No hints in a mock exam. Use the kubernetes.io docs, like on exam day.');
    if (!state.current) return console.log('No lab running. ckalab start <lab>');
    const lab = IMPL[state.current.id];
    const i = Math.min(state.current.hints ?? 0, lab.hints.length - 1);
    console.log(`\n💡 ${lab.hints[i]}\n`);
    state.current.hints = i + 1;
    saveState(state);
  },

  async solution() {
    const state = loadState();
    if (state.mock) return console.log('Solutions unlock after the mock: ckalab submit, then ckalab start <lab> to replay any task.');
    if (!state.current) return console.log('No lab running. ckalab start <lab>');
    console.log(`\n${c.bold('Solution')}\n${IMPL[state.current.id].solution}\n`);
    state.current.sawSolution = true;
    saveState(state);
  },

  async reset() {
    const state = loadState();
    if (!state.current && !state.mock) return console.log('Nothing running.');
    await clearRunning(state);
    console.log(c.green('✓ Cleaned up.'));
  },

  async check() {
    const state = loadState();
    if (state.mock) return console.log(`A mock exam is running. Grade it with ${c.cyan('ckalab submit')} (no partial peeks, like the exam).`);
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
    await printClaim(id, seconds, {}, `+${meta.xp} XP`);

    await resetLab(id);
    state.current = null;
    saveState(state);
  },

  async mock(arg) {
    const n = Math.max(3, Math.min(12, Number(arg) || 8));
    requireCluster();
    const state = loadState();
    await clearRunning(state);
    const ids = pickMock(n);
    const minutes = mockMinutes(ids);
    console.log(c.dim(`Setting up ${n} tasks. This takes a few minutes; the clock starts when they're ready…`));
    await setupMock(ids);
    state.mock = { ids, startedAt: Date.now(), minutes };
    saveState(state);

    // Shown in a shuffled order so the cluster-level task isn't always last.
    const shown = [...ids].sort(() => Math.random() - 0.5);
    const total = ids.reduce((s, id) => s + LAB_BY_ID[id].minutes, 0);
    const lines = [`CKAgram mock exam: ${n} tasks, ${minutes} minutes, pass mark ${PASS_SCORE}%`, `Context: ${CONTEXT}`, ''];
    shown.forEach((id, i) => {
      const meta = LAB_BY_ID[id];
      lines.push(`── Task ${i + 1} of ${n} · ${Math.round((100 * meta.minutes) / total)}% · ${meta.title} ──`, IMPL[id].task, '');
    });
    lines.push('When you are done (or time is up): ckalab submit');
    writeFileSync(MOCK_FILE, lines.join('\n'));

    console.log(`\n${c.bold(lines[0])}\n`);
    console.log(lines.slice(2).join('\n'));
    console.log(c.dim(`\nTasks saved to ${MOCK_FILE}. No hints or solutions until you submit. Time check: ckalab status\n`));
  },

  async submit() {
    const state = loadState();
    if (!state.mock) return console.log(`No mock running. Start one: ${c.cyan('ckalab mock')}`);
    requireCluster();
    const { ids, startedAt, minutes } = state.mock;
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    console.log(c.dim('Grading…'));
    const g = await gradeMock(ids);
    console.log('');
    for (const t of g.tasks) {
      const meta = LAB_BY_ID[t.id];
      const mark = t.fraction === 1 ? c.green('✓') : t.fraction > 0 ? c.gold('◐') : c.red('✗');
      console.log(`${mark} ${c.bold(meta.title)} ${c.dim(`(${t.id}, ${Math.round(t.fraction * 100)}%)`)}`);
      for (const [label, ok] of t.results) console.log(`    ${ok ? c.green('✓') : c.red('✗')} ${label}`);
    }
    const over = seconds > minutes * 60;
    console.log(`\n${c.bold(`Score ${g.score}%`)}  ${g.passed ? c.green(c.bold('PASS')) : c.gold('below the pass mark')}  ·  ${g.passedTasks}/${ids.length} tasks fully solved  ·  ${fmtTime(seconds)} of ${minutes}m`);
    if (over) console.log(c.gold('Over time: on exam day the terminal closes at the limit. Pace matters.'));
    console.log(c.dim('Replay any task with ckalab start <lab-id> (hints and solutions work there).'));
    await printClaim(MOCK_LAB_ID, seconds, { p: String(g.score), k: `${g.passedTasks}/${ids.length}` }, 'your mock XP');
    await clearRunning(state);
  },

  async abort() {
    const state = loadState();
    if (!state.mock) return console.log('No mock running.');
    await clearRunning(state);
    console.log(c.green('✓ Mock stopped and cleaned up. Nothing was graded.'));
  },

  async status() {
    const state = loadState();
    if (state.mock) {
      const used = Math.round((Date.now() - state.mock.startedAt) / 1000);
      const left = state.mock.minutes * 60 - used;
      return console.log(`Mock exam: ${state.mock.ids.length} tasks · ${fmtTime(used)} used · ${left > 0 ? `${fmtTime(left)} left` : c.red('over time')}\nTasks: ${MOCK_FILE}`);
    }
    if (!state.current) return console.log('No lab running.');
    const s = Math.round((Date.now() - state.current.startedAt) / 1000);
    console.log(`${state.current.id}: running for ${fmtTime(s)}`);
  },

  async help() {
    const src = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 12).map((l) => l.replace(/^\/\/ ?/, ''));
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
if (!existsSync(join(here, 'node_modules')) && (cmd === 'check' || cmd === 'submit')) {
  console.log(c.dim('Tip: run npm install inside labs/ once so check can draw QR codes.'));
}
try {
  await fn(arg);
} catch (e) {
  console.error(c.red(`\n${e.message}`));
  process.exit(1);
}
