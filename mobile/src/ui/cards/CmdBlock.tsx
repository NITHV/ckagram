// Phone mini-lab: build the kubectl command from tiles, then "run" it.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CmdCard } from '@/content';
import { commandMatches, tokenize } from '@/engine/cmd';
import { haptic } from '@/lib/haptics';
import { RichText } from '../RichText';
import { colors, mono, radius } from '../theme';

interface Tile {
  key: number;
  text: string;
}

export function CmdBlock({ card, onAnswer }: { card: CmdCard; onAnswer: (correct: boolean) => void }) {
  const tiles = useMemo<Tile[]>(() => {
    // "kubectl" always comes first, so we pre-type it; the rest is the puzzle.
    const words = [...tokenize(card.answer).slice(1), ...(card.distractors ?? [])];
    const list = words.map((text, key) => ({ key, text }));
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }, [card]);

  const [built, setBuilt] = useState<Tile[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const used = new Set(built.map((t) => t.key));

  const add = (t: Tile) => {
    if (result !== null) return;
    haptic.tap();
    setBuilt((b) => [...b, t]);
  };
  const remove = (t: Tile) => {
    if (result !== null) return;
    haptic.tap();
    setBuilt((b) => b.filter((x) => x.key !== t.key));
  };
  const run = () => {
    if (result !== null || built.length === 0) return;
    const ok = commandMatches(['kubectl', ...built.map((t) => t.text)], card.answer, card.alts);
    setResult(ok);
    onAnswer(ok);
  };

  return (
    <View style={{ gap: 12 }}>
      <RichText style={styles.task}>{card.task}</RichText>

      <View style={[styles.terminal, result === true && { borderColor: colors.good }, result === false && { borderColor: colors.bad }]}>
        <View style={styles.cmdLine}>
          <Text style={styles.prompt}>$ kubectl</Text>
          {built.map((t) => (
            <Pressable key={t.key} onPress={() => remove(t)} hitSlop={4}>
              <Text style={styles.builtToken}>{t.text}</Text>
            </Pressable>
          ))}
          {result === null && <Text style={styles.cursor}>▌</Text>}
        </View>
        {result === true && <Text style={[styles.output, { color: colors.good }]}>✓ exit 0</Text>}
        {result === false && (
          <>
            <Text style={[styles.output, { color: colors.bad }]}>✗ not quite. Expected:</Text>
            <Text style={[styles.output, { color: colors.terminalText }]}>$ {card.answer}</Text>
          </>
        )}
      </View>

      {result === null && (
        <>
          <View style={styles.tiles}>
            {tiles.map((t) => (
              <Pressable
                key={t.key}
                disabled={used.has(t.key)}
                onPress={() => add(t)}
                style={({ pressed }) => [styles.tile, used.has(t.key) && styles.tileUsed, pressed && { transform: [{ scale: 0.95 }] }]}
              >
                <Text style={[styles.tileText, used.has(t.key) && { color: 'transparent' }]}>{t.text}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => built.length && remove(built[built.length - 1])} style={styles.secondary}>
              <Text style={styles.secondaryText}>⌫ Undo</Text>
            </Pressable>
            <Pressable onPress={run} style={[styles.runBtn, built.length === 0 && { opacity: 0.4 }]}>
              <Text style={styles.runText}>Run ⏎</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  task: { color: colors.text, fontSize: 17, fontWeight: '600', lineHeight: 24 },
  terminal: {
    backgroundColor: colors.terminal,
    borderRadius: radius.md,
    padding: 14,
    minHeight: 84,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  cmdLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  prompt: { color: colors.good, fontFamily: mono, fontSize: 15 },
  builtToken: { color: colors.terminalText, fontFamily: mono, fontSize: 15, textDecorationLine: 'underline', textDecorationColor: '#2F4A33' },
  cursor: { color: colors.terminalText, fontFamily: mono, fontSize: 15 },
  output: { fontFamily: mono, fontSize: 13 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: '#333',
  },
  tileUsed: { backgroundColor: colors.surface, borderColor: colors.surface },
  tileText: { color: colors.text, fontFamily: mono, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  secondary: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: radius.md, backgroundColor: colors.surface2 },
  secondaryText: { color: colors.text, fontWeight: '600' },
  runBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center' },
  runText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
