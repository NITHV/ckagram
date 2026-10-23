import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Question } from '@/content';
import { haptic } from '@/lib/haptics';
import { RichText } from '../RichText';
import { colors, radius } from '../theme';

function shuffledOrder(n: number) {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** blind: exam mode, the pick is locked in without showing right or wrong. */
export function QuestionBlock({ question, onAnswer, blind }: { question: Question; onAnswer: (correct: boolean) => void; blind?: boolean }) {
  // Content always lists the right answer first; shuffle so position never gives it away.
  const [order] = useState(() => shuffledOrder(question.options.length));
  const [picked, setPicked] = useState<number | null>(null);

  const pick = (i: number) => {
    if (picked !== null) return;
    haptic.tap();
    setPicked(i);
    onAnswer(i === question.answer);
  };

  return (
    <View style={{ gap: 10 }}>
      <RichText style={styles.q}>{question.q}</RichText>
      {order.map((i) => {
        const done = picked !== null;
        const isAnswer = i === question.answer;
        const isPicked = i === picked;
        return (
          <Pressable
            key={i}
            onPress={() => pick(i)}
            style={({ pressed }) => [
              styles.option,
              pressed && !done && { backgroundColor: colors.surface2 },
              done && blind && isPicked && styles.picked,
              done && blind && !isPicked && { opacity: 0.45 },
              done && !blind && isAnswer && styles.right,
              done && !blind && isPicked && !isAnswer && styles.wrong,
              done && !blind && !isAnswer && !isPicked && { opacity: 0.45 },
            ]}
          >
            <RichText style={styles.optionText}>{question.options[i]}</RichText>
            {done && !blind && isAnswer && <Text style={styles.mark}>✓</Text>}
            {done && !blind && isPicked && !isAnswer && <Text style={styles.mark}>✗</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  q: { color: colors.text, fontSize: 17, fontWeight: '600', lineHeight: 24, marginBottom: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionText: { color: colors.text, fontSize: 15, flex: 1, lineHeight: 21 },
  right: { borderColor: colors.good, backgroundColor: '#0F2A1E' },
  wrong: { borderColor: colors.bad, backgroundColor: '#2A0F15' },
  picked: { borderColor: colors.accent, backgroundColor: '#0F1A33' },
  mark: { color: colors.text, fontSize: 18, fontWeight: '800', marginLeft: 8 },
});
