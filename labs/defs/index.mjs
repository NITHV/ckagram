// Every lab implementation, keyed by id. Lab metadata (title, XP, week) lives in
// mobile/src/content/labs.ts so the app and the runner agree.
import * as w1 from './week1.mjs';
import * as w2 from './week2.mjs';
import * as w34 from './week3-4.mjs';
import * as w57 from './week5-7.mjs';
import * as w812 from './week8-12.mjs';

const labs = [w1, w2, w34, w57, w812].flatMap((m) => Object.values(m)).filter((l) => l && typeof l === 'object' && typeof l.id === 'string');

export const IMPL = Object.fromEntries(labs.map((l) => [l.id, l]));
