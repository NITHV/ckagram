// Laptop mock exam: several labs broken at once, one clock, scored like the CKA
// (each task weighted by its size, partial credit per check, pass mark 66%).
import { LAB_BY_ID, PASS_SCORE } from '../../mobile/src/content/labs.ts';
import { IMPL } from '../defs/index.mjs';
import { k } from './kube.mjs';

/** Undo a lab: its own cleanup, then its namespace. */
export async function resetLab(id) {
  const lab = IMPL[id];
  if (!lab) return;
  if (lab.cleanup) await lab.cleanup();
  if (lab.ns) k.try('delete', 'namespace', lab.ns, '--wait=true', '--timeout=120s');
}

export async function setupLab(id) {
  const lab = IMPL[id];
  await resetLab(id);
  if (lab.ns) await k.createNamespace(lab.ns);
  await lab.setup();
}

function shuffle(a, rand = Math.random) {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * n tasks. From 4 tasks up, one is a cluster-level "breaker" (scheduler, DNS, API server),
 * always set up last so the other setups still work. Labs marked mock: 'no' never join.
 */
export function pickMock(n, rand = Math.random) {
  const all = Object.values(IMPL).filter((l) => LAB_BY_ID[l.id]);
  const regular = shuffle(all.filter((l) => (l.mock ?? 'ok') === 'ok'), rand);
  const breakers = shuffle(all.filter((l) => l.mock === 'breaker'), rand);
  const withBreaker = n >= 4 && breakers.length > 0;
  const ids = regular.slice(0, withBreaker ? n - 1 : n).map((l) => l.id);
  if (withBreaker) ids.push(breakers[0].id);
  return ids;
}

/** Exam pace: the target times plus 25%. */
export function mockMinutes(ids) {
  return Math.ceil(ids.reduce((n, id) => n + LAB_BY_ID[id].minutes, 0) * 1.25);
}

export async function setupMock(ids) {
  for (const id of ids) await setupLab(id);
}

/** Grades every task. Returns per-task results and the weighted score. */
export async function gradeMock(ids) {
  const tasks = [];
  for (const id of ids) {
    const results = await IMPL[id].checks();
    const got = results.filter(([, ok]) => ok).length;
    tasks.push({ id, results, fraction: results.length ? got / results.length : 0, points: LAB_BY_ID[id].minutes });
  }
  const totalPoints = tasks.reduce((n, t) => n + t.points, 0);
  const earned = tasks.reduce((n, t) => n + t.points * t.fraction, 0);
  const score = Math.round((100 * earned) / totalPoints);
  return { tasks, score, passed: score >= PASS_SCORE, passedTasks: tasks.filter((t) => t.fraction === 1).length };
}

export async function resetMock(ids) {
  // Reverse order: the cluster-level breaker is undone first, so the others can clean up.
  for (const id of [...ids].reverse()) await resetLab(id);
}
