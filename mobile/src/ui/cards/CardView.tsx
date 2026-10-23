// One "post": header, the interactive body, then the explanation once answered.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { DOMAIN_BY_ID, type Card, type ConceptCard } from '@/content';
import { haptic } from '@/lib/haptics';
import { RichText } from '../RichText';
import { bossGradient, colors, radius } from '../theme';
import { CmdBlock } from './CmdBlock';
import { QuestionBlock } from './QuestionBlock';
import { YamlBlock } from './YamlBlock';

const TYPE_LABEL: Record<Card['type'], string> = {
  concept: 'Concept',
  mcq: 'Recall',
  cmd: 'Mini-lab · kubectl',
  yaml: 'Mini-lab · YAML',
};

interface Props {
  card: Card;
  /** The card is on screen; the answer timer starts the first time this is true. */
  active: boolean;
  isNew: boolean;
  onAnswer: (correct: boolean, ms: number) => void;
  onNext?: () => void;
}

export function CardView({ card, active, isNew, onAnswer, onNext }: Props) {
  const startedAt = useRef<number | null>(null);
  const [answered, setAnswered] = useState<boolean | null>(null);

  useEffect(() => {
    if (active && startedAt.current === null && card.type !== 'concept') startedAt.current = Date.now();
  }, [active, card.type]);

  const answer = (correct: boolean) => {
    if (answered !== null) return;
    const ms = Date.now() - (startedAt.current ?? Date.now());
    setAnswered(correct);
    onAnswer(correct, ms);
  };

  const domain = DOMAIN_BY_ID[card.domain];
  const body = (
    <View style={[styles.card, card.boss && styles.bossInner]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: domain.color }]}>
          <Text style={{ fontSize: 16 }}>{domain.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.topic}>{card.topic}</Text>
          <Text style={styles.meta}>
            {domain.short} · {TYPE_LABEL[card.type]}
          </Text>
        </View>
        {card.boss && <Text style={styles.bossTag}>👑 BOSS ×5</Text>}
        {!card.boss && isNew && <Text style={styles.newTag}>NEW</Text>}
      </View>

      {card.type === 'concept' && <ConceptBlock card={card} onReveal={() => (startedAt.current = Date.now())} onAnswer={answer} />}
      {card.type === 'mcq' && <QuestionBlock question={card} onAnswer={answer} />}
      {card.type === 'cmd' && <CmdBlock card={card} onAnswer={answer} />}
      {card.type === 'yaml' && <YamlBlock card={card} onAnswer={answer} />}

      {answered !== null && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.explain}>
          <Text style={[styles.verdict, { color: answered ? colors.good : colors.bad }]}>
            {answered ? '✓ Nailed it' : "✗ Not quite. It'll come back soon"}
          </Text>
          <RichText style={styles.explainText}>{card.explain}</RichText>
          {card.docs && (
            <Pressable onPress={() => Linking.openURL(card.docs!)}>
              <Text style={styles.docs}>📖 kubernetes.io docs (allowed in the exam)</Text>
            </Pressable>
          )}
          {onNext && (
            <Pressable onPress={onNext} style={styles.next}>
              <Text style={styles.nextText}>Next ↓</Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  );

  if (!card.boss) return body;
  return (
    <LinearGradient colors={bossGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bossFrame}>
      {body}
    </LinearGradient>
  );
}

function ConceptBlock({ card, onReveal, onAnswer }: { card: ConceptCard; onReveal: () => void; onAnswer: (c: boolean) => void }) {
  const [revealed, setRevealed] = useState(false);
  const lastTap = useRef(0);
  const heart = useSharedValue(0);
  const heartStyle = useAnimatedStyle(() => ({ opacity: heart.value, transform: [{ scale: 0.6 + heart.value * 0.6 }] }));

  const reveal = () => {
    if (revealed) return;
    haptic.tap();
    setRevealed(true);
    onReveal();
  };
  // Double-tap the concept like a post: "got it", then check yourself.
  const onBodyPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      heart.value = withSequence(withSpring(1, { damping: 8 }), withTiming(0, { duration: 500 }));
      reveal();
    }
    lastTap.current = now;
  };

  return (
    <View style={{ gap: 14 }}>
      <Pressable onPress={onBodyPress}>
        <View style={styles.conceptBody}>
          <Text style={styles.conceptTitle}>{card.title}</Text>
          <RichText style={styles.conceptText}>{card.body}</RichText>
          <Animated.Text style={[styles.heart, heartStyle]}>❤️</Animated.Text>
        </View>
      </Pressable>
      {revealed ? (
        <Animated.View entering={FadeIn.duration(200)}>
          <QuestionBlock question={card.check} onAnswer={onAnswer} />
        </Animated.View>
      ) : (
        <Pressable onPress={reveal} style={styles.gotIt}>
          <Text style={styles.gotItText}>Got it. Check me ✓</Text>
          <Text style={styles.gotItHint}>or double-tap the card</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.bg, padding: 16, gap: 14, borderRadius: radius.lg },
  bossFrame: { borderRadius: radius.lg + 2, padding: 2, marginHorizontal: 8 },
  bossInner: { borderRadius: radius.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  topic: { color: colors.text, fontWeight: '700', fontSize: 15 },
  meta: { color: colors.muted, fontSize: 12 },
  bossTag: { color: colors.gold, fontWeight: '900', fontSize: 12 },
  newTag: { color: colors.accent, fontWeight: '800', fontSize: 11, borderWidth: 1, borderColor: colors.accent, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  conceptBody: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 18,
    minHeight: 180,
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  conceptTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  conceptText: { color: '#DADADA', fontSize: 16, lineHeight: 24 },
  heart: { position: 'absolute', alignSelf: 'center', fontSize: 90 },
  gotIt: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  gotItText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  gotItHint: { color: '#D6ECFF', fontSize: 11, marginTop: 2 },
  explain: { gap: 8, paddingTop: 4 },
  verdict: { fontSize: 16, fontWeight: '800' },
  explainText: { color: '#DADADA', fontSize: 15, lineHeight: 22 },
  docs: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  next: { marginTop: 6, alignSelf: 'stretch', paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  nextText: { color: colors.text, fontWeight: '700' },
});
