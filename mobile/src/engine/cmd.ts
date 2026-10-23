// Checks a built kubectl command against the expected one.
// Word order matters for the command itself ("kubectl get pods"), but flags can come in any order,
// like in a real shell. Everything after "--" stays in strict order.

const FLAGS_WITH_VALUE = new Set(['-n', '-o', '-l', '-c', '-f', '-L', '--namespace', '--output', '--selector', '--container', '--filename']);

interface Parsed {
  words: string[];
  flags: string[];
  tail: string[];
}

function parse(tokens: string[]): Parsed {
  const words: string[] = [];
  const flags: string[] = [];
  const tail: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '--') {
      tail.push(...tokens.slice(i));
      break;
    }
    if (t.startsWith('-')) {
      const next = tokens[i + 1];
      if (!t.includes('=') && FLAGS_WITH_VALUE.has(t) && next !== undefined && !next.startsWith('-')) {
        flags.push(`${t} ${next}`);
        i++;
      } else {
        flags.push(t);
      }
    } else {
      words.push(t);
    }
  }
  return { words, flags: flags.sort(), tail };
}

export function tokenize(command: string): string[] {
  return command.trim().split(/\s+/);
}

// Pipes and redirects split a command into segments that are compared one by one.
const SEPARATORS = new Set(['|', '>', '>>']);

function segments(tokens: string[]): string[] {
  const out: string[] = [];
  let current: string[] = [];
  const flush = () => {
    const p = parse(current);
    out.push([p.words.join(' '), p.flags.join('\n'), p.tail.join(' ')].join('\u0000'));
    current = [];
  };
  for (const t of tokens) {
    if (SEPARATORS.has(t)) {
      flush();
      out.push(t);
    } else {
      current.push(t);
    }
  }
  flush();
  return out;
}

export function commandMatches(built: string[], answer: string, alts: string[] = []): boolean {
  const b = segments(built).join('\u0001');
  return [answer, ...alts].some((candidate) => segments(tokenize(candidate)).join('\u0001') === b);
}
