// One card, laid out like a post: header, interactive body, action bar, XP line, caption.
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { DOMAIN_BY_ID, type Card, type ConceptCard } from '@/content';
import type { AnswerResult } from '@/engine/record';
import { haptic } from '@/lib/haptics';
import { useMarks } from '@/state/marks';
import { RichText } from '../RichText';
import { StoryRing } from '../StoryRing';
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
  /** On screen; the answer timer starts the first time this is true. */
  active: boolean;
  isNew: boolean;
  onAnswer: (correct: boolean, ms: number) => Promise<AnswerResult | null> | void;
  onNext?: () => void;
}

export function CardView({ card, active, isNew, onAnswer, onNext }: Props) {
  const startedAt = useRef<number | null>(null);
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [earned, setEarned] = useState<AnswerResult['xp'] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const { liked, saved, toggle } = useMarks();
  const isLiked = liked.has(card.id);
  const isSaved = saved.has(card.id);

  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const likeScale = useSharedValue(1);
  const likeStyle = useAnimatedStyle(() => ({ transform: [{ scale: likeScale.value }] }));

  useEffect(() => {
    if (active && startedAt.current === null && card.type !== 'concept') startedAt.current = Date.now();
  }, [active, card.type]);

  const answer = (correct: boolean) => {
    if (answered !== null) return;
    const ms = Date.now() - (startedAt.current ?? Date.now());
    setAnswered(correct);
    if (!correct) shake.value = withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 }));
    Promise.resolve(onAnswer(correct, ms)).then((r) => r && setEarned(r.xp));
  };

  const like = () => {
    likeScale.value = withSequence(withSpring(1.35, { damping: 6 }), withSpring(1));
    toggle(card.id, 'like');
  };

  const share = () => {
    haptic.tap();
    const q =
      card.type === 'concept' ? card.check.q : card.type === 'mcq' ? card.q : card.task;
    Share.share({ message: `CKA practice: ${q}\n\n${card.explain}\n\n#CKAgram #Kubernetes` }).catch(() => {});
  };

  const domain = DOMAIN_BY_ID[card.domain];
  const post = (
    <View style={[styles.post, card.boss && styles.bossInner]}>
      <View style={styles.header}>
        <StoryRing size={38} active={isNew || !!card.boss}>
          <View style={[styles.avatar, { backgroundColor: domain.color }]}>
            <Text style={{ fontSize: 15 }}>{domain.emoji}</Text>
          </View>
        </StoryRing>
        <View style={{ flex: 1 }}>
          <Text style={styles.topic}>{card.topic}</Text>
          <Text style={styles.meta}>
            {domain.short} · {TYPE_LABEL[card.type]}
          </Text>
        </View>
        {card.boss && <Text style={styles.bossTag}>👑 BOSS</Text>}
        {!card.boss && isNew && <Text style={styles.newTag}>NEW</Text>}
      </View>

      <Animated.View style={[styles.body, shakeStyle]}>
        {card.type === 'concept' && <ConceptBlock card={card} onReveal={() => (startedAt.current = Date.now())} onAnswer={answer} onLike={() => !isLiked && like()} />}
        {card.type === 'mcq' && <QuestionBlock question={card} onAnswer={answer} />}
        {card.type === 'cmd' && <CmdBlock card={card} onAnswer={answer} />}
        {card.type === 'yaml' && <YamlBlock card={card} onAnswer={answer} />}
      </Animated.View>

      <View style={styles.actions}>
        <Pressable onPress={like} hitSlop={8}>
          <Animated.View style={likeStyle}>
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={27} color={isLiked ? colors.pink : colors.text} />
          </Animated.View>
        </Pressable>
        <Pressable onPress={() => answered !== null && setExpanded((e) => !e)} hitSlop={8} disabled={answered === null}>
          <Ionicons name="chatbubble-outline" size={24} color={answered === null ? colors.faint : colors.text} />
        </Pressable>
        <Pressable onPress={share} hitSlop={8}>
          <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => toggle(card.id, 'save')} hitSlop={8}>
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={24} color={isSaved ? colors.gold : colors.text} />
        </Pressable>
      </View>

      {answered !== null && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.explain}>
          <Text style={styles.xpLine}>
            {answered ? (
              <>
                <Text style={{ color: colors.gold }}>{earned ? `+${earned.total} XP` : '✓ Correct'}</Text>
                {earned?.fast ? <Text style={{ color: colors.text }}>  ⚡ fast</Text> : null}
                {earned && earned.multiplier > 1 ? <Text style={{ color: colors.text }}>  ×{earned.multiplier}</Text> : null}
              </>
            ) : (
              <Text style={{ color: colors.bad }}>Not quite. It'll be back soon</Text>
            )}
          </Text>
          <Pressable onPress={() => setExpanded((e) => !e)}>
            <Text style={styles.caption} numberOfLines={expanded ? undefined : 3}>
              <Text style={styles.captionUser}>ckagram </Text>
              <RichText style={styles.caption}>{card.explain}</RichText>
            </Text>
          </Pressable>
          {card.docs && (
            <Pressable onPress={() => Linking.openURL(card.docs!)}>
              <Text style={styles.docs}>📖 Open in kubernetes.io docs (allowed in the exam)</Text>
            </Pressable>
          )}
          {onNext && (
            <Pressable onPress={onNext} style={styles.next}>
              <Text style={styles.nextText}>Next</Text>
              <Ionicons name="chevron-down" size={16} color={colors.text} />
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  );

  if (!card.boss) return post;
  return (
    <LinearGradient colors={bossGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bossFrame}>
      {post}
    </LinearGradient>
  );
}

function ConceptBlock({ card, onReveal, onAnswer, onLike }: { card: ConceptCard; onReveal: () => void; onAnswer: (c: boolean) => void; onLike: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const lastTap = useRef(0);
  const heart = useSharedValue(0);
  const heartStyle = useAnimatedStyle(() => ({ opacity: heart.value, transform: [{ scale: 0.5 + heart.value * 0.7 }] }));
  const domain = DOMAIN_BY_ID[card.domain];

  const reveal = () => {
    if (revealed) return;
    haptic.tap();
    setRevealed(true);
    onReveal();
  };
  // Double-tap the concept like a post: heart, "got it", then check yourself.
  const onBodyPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      heart.value = withSequence(withSpring(1, { damping: 7 }), withTiming(0, { duration: 450 }));
      onLike();
      reveal();
    }
    lastTap.current = now;
  };

  return (
    <View style={{ gap: 14 }}>
      <Pressable onPress={onBodyPress}>
        <LinearGradient colors={[domain.color + '33', colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.conceptBody}>
          <Text style={styles.conceptTitle}>{card.title}</Text>
          <RichText style={styles.conceptText}>{card.body}</RichText>
          <Animated.View style={[styles.heart, heartStyle]} pointerEvents="none">
            <Ionicons name="heart" size={110} color={colors.pink} />
          </Animated.View>
        </LinearGradient>
      </Pressable>
      {revealed ? (
        <Animated.View entering={FadeIn.duration(200)}>
          <QuestionBlock question={card.check} onAnswer={onAnswer} />
        </Animated.View>
      ) : (
        <Pressable onPress={reveal} style={styles.gotIt}>
          <Text style={styles.gotItText}>Got it. Check me</Text>
          <Text style={styles.gotItHint}>or double-tap the card</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  post: { backgroundColor: colors.bg, paddingVertical: 12, gap: 12 },
  bossFrame: { borderRadius: radius.lg + 2, padding: 2, marginHorizontal: 8 },
  bossInner: { borderRadius: radius.lg, paddingHorizontal: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  avatar: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  topic: { color: colors.text, fontWeight: '700', fontSize: 14 },
  meta: { color: colors.muted, fontSize: 12 },
  bossTag: { color: colors.gold, fontWeight: '900', fontSize: 12 },
  newTag: { color: colors.accent, fontWeight: '800', fontSize: 11, borderWidth: 1, borderColor: colors.accent, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  body: { paddingHorizontal: 12 },
  conceptBody: { borderRadius: radius.lg, padding: 20, minHeight: 200, justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: colors.border },
  conceptTitle: { color: colors.text, fontSize: 23, fontWeight: '800', letterSpacing: -0.3 },
  conceptText: { color: '#D9DEEA', fontSize: 16, lineHeight: 24 },
  heart: { position: 'absolute', alignSelf: 'center', top: '30%' },
  gotIt: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  gotItText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  gotItHint: { color: '#D6E4FF', fontSize: 11, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 14 },
  explain: { gap: 6, paddingHorizontal: 14 },
  xpLine: { fontWeight: '800', fontSize: 14 },
  caption: { color: '#D9DEEA', fontSize: 14, lineHeight: 20 },
  captionUser: { color: colors.text, fontWeight: '800' },
  docs: { color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: 2 },
  next: { marginTop: 6, flexDirection: 'row', gap: 4, alignSelf: 'stretch', justifyContent: 'center', paddingVertical: 11, borderRadius: radius.md, backgroundColor: colors.surface2 },
  nextText: { color: colors.text, fontWeight: '700' },
});
