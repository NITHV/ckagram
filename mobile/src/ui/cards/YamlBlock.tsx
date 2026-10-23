// Spot-the-bug: tap the broken manifest line.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { YamlCard } from '@/content';
import { haptic } from '@/lib/haptics';
import { RichText } from '../RichText';
import { colors, mono, radius } from '../theme';

export function YamlBlock({ card, onAnswer }: { card: YamlCard; onAnswer: (correct: boolean) => void }) {
  const lines = card.yaml.split('\n');
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;

  const pick = (i: number) => {
    if (done) return;
    haptic.tap();
    setPicked(i);
    onAnswer(i === card.bugLine);
  };

  return (
    <View style={{ gap: 12 }}>
      <RichText style={styles.task}>{card.task}</RichText>
      <View style={styles.code}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {lines.map((line, i) => {
              const isBug = i === card.bugLine;
              const wrongPick = done && i === picked && !isBug;
              return (
                <View key={i}>
                  <Pressable
                    onPress={() => pick(i)}
                    style={({ pressed }) => [
                      styles.line,
                      pressed && !done && { backgroundColor: '#1A2330' },
                      done && isBug && styles.bugLine,
                      wrongPick && styles.wrongLine,
                    ]}
                  >
                    <Text style={styles.num}>{i + 1}</Text>
                    <Text style={[styles.text, done && isBug && styles.struck]}>{line || ' '}</Text>
                  </Pressable>
                  {done && isBug && (
                    <View style={[styles.line, styles.fixLine]}>
                      <Text style={[styles.num, { color: colors.good }]}>+</Text>
                      <Text style={[styles.text, { color: colors.good }]}>{card.fixLine}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
      {!done && <Text style={styles.hint}>Tap the line you'd fix</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  task: { color: colors.text, fontSize: 17, fontWeight: '600', lineHeight: 24 },
  code: { backgroundColor: colors.terminal, borderRadius: radius.md, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  line: { flexDirection: 'row', paddingVertical: 4, paddingRight: 16, minHeight: 28, alignItems: 'center' },
  num: { width: 34, textAlign: 'right', paddingRight: 10, color: colors.faint, fontFamily: mono, fontSize: 12 },
  text: { color: '#D6E2F0', fontFamily: mono, fontSize: 13.5 },
  bugLine: { backgroundColor: '#3A1219' },
  wrongLine: { backgroundColor: '#2A2A2A' },
  fixLine: { backgroundColor: '#0F2A1E' },
  struck: { color: colors.bad, textDecorationLine: 'line-through' },
  hint: { color: colors.faint, fontSize: 13, textAlign: 'center' },
});
