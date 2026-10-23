// A full-screen reel: auto-advancing frames with narration, tap to skip, hold to pause,
// right-side actions, and a quiz at the end that pays XP.
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Speech from 'expo-speech';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { CARD_BY_ID, DOMAIN_BY_ID } from '@/content';
import { frameDuration, frameVoice, type Reel } from '@/content/reels';
import type { QueueItem } from '@/engine/feed';
import type { AnswerResult } from '@/engine/record';
import { haptic } from '@/lib/haptics';
import { useMarks } from '@/state/marks';
import { useProgress } from '@/state/progress';
import { CmdBlock } from '../cards/CmdBlock';
import { QuestionBlock } from '../cards/QuestionBlock';
import { YamlBlock } from '../cards/YamlBlock';
import { RichText } from '../RichText';
import { colors, radius } from '../theme';
import { ReelFrameView } from './ReelFrameView';

interface Props {
  reel: Reel;
  height: number;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onViewed: (reelId: string, completed: boolean) => void;
}

export function ReelPlayer({ reel, height, active, muted, onToggleMute, onViewed }: Props) {
  const { answer } = useProgress();
  const { liked, saved, toggle } = useMarks();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [quizResult, setQuizResult] = useState<{ correct: boolean; xp?: AnswerResult['xp'] } | null>(null);
  const quizStart = useRef(0);
  const frames = reel.frames;
  const onQuiz = index >= frames.length;
  const domain = DOMAIN_BY_ID[reel.domain];
  const quizCard = CARD_BY_ID[reel.quiz];
  const likeId = `reel:${reel.id}`;
  const likeScale = useSharedValue(1);
  const likeStyle = useAnimatedStyle(() => ({ transform: [{ scale: likeScale.value }] }));

  // Restart when scrolled away; count a view when it becomes active.
  useEffect(() => {
    if (!active) {
      setIndex(0);
      setPaused(false);
      Speech.stop();
    } else {
      onViewed(reel.id, false);
    }
  }, [active, reel.id, onViewed]);

  // Drive the current frame: narration (unless muted) plus a reading-time timer.
  useEffect(() => {
    if (!active || paused || onQuiz) return;
    const frame = frames[index];
    const ms = frameDuration(frame);
    let spoke = muted;
    let timeUp = false;
    let cancelled = false;
    const advance = () => !cancelled && spoke && timeUp && setIndex((i) => i + 1);
    const timer = setTimeout(() => {
      timeUp = true;
      advance();
    }, ms);
    // Safety net in case the speech engine never reports back.
    const fallback = setTimeout(() => setIndex((i) => (i === index ? i + 1 : i)), ms + 9000);
    if (!muted) {
      const text = frameVoice(frame);
      if (text) {
        Speech.speak(text, {
          rate: 1.05,
          onDone: () => {
            spoke = true;
            advance();
          },
          onError: () => {
            spoke = true;
            advance();
          },
        });
      } else spoke = true;
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(fallback);
      Speech.stop();
    };
  }, [active, paused, index, onQuiz, muted, frames]);

  useEffect(() => {
    if (onQuiz) quizStart.current = Date.now();
  }, [onQuiz]);

  const go = (delta: number) => {
    haptic.tap();
    Speech.stop();
    setIndex((i) => Math.max(0, Math.min(frames.length, i + delta)));
  };

  const answerQuiz = (correct: boolean) => {
    const item: QueueItem = { key: `reel-${reel.id}-${Date.now()}`, card: quizCard, isNew: false, bonus: false };
    setQuizResult({ correct });
    answer(item, correct, Date.now() - quizStart.current, correct ? 1 : 0).then((r) => setQuizResult({ correct, xp: r.xp }));
    onViewed(reel.id, true);
  };

  const like = () => {
    likeScale.value = withSequence(withSpring(1.35, { damping: 6 }), withSpring(1));
    toggle(likeId, 'like');
  };

  return (
    <View style={{ height, backgroundColor: colors.bg }}>
      <LinearGradient colors={[domain.color + '55', '#05060B', '#05060B']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />

      {/* Story-style progress segments: one per frame plus the quiz. */}
      <View style={styles.bars}>
        {[...frames, null].map((_, i) => (
          <View key={i} style={styles.barTrack}>
            <View style={[styles.barFill, { width: i < index ? '100%' : i === index ? '50%' : '0%', opacity: i === index ? 0.9 : 1 }]} />
          </View>
        ))}
      </View>

      <View style={styles.topRow}>
        <Text style={styles.reelsTitle}>Reels</Text>
        <Pressable onPress={onToggleMute} hitSlop={10}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={22} color={colors.text} />
        </Pressable>
      </View>

      {!onQuiz ? (
        <Pressable
          style={styles.stage}
          onPress={(e) => go(e.nativeEvent.locationX < 120 ? -1 : 1)}
          onLongPress={() => setPaused(true)}
          onPressOut={() => paused && setPaused(false)}
          delayLongPress={250}
        >
          <View key={index} style={{ flex: 1 }}>
            <ReelFrameView frame={frames[index]} accent={domain.color} />
          </View>
          {paused && (
            <View style={styles.pausedBadge}>
              <Ionicons name="pause" size={28} color={colors.text} />
            </View>
          )}
        </Pressable>
      ) : (
        <Animated.View entering={FadeIn.duration(300)} style={styles.quiz}>
          <Text style={[styles.quizTag, { color: domain.color }]}>QUICK CHECK</Text>
          {quizCard.type === 'concept' && <QuestionBlock question={quizCard.check} onAnswer={answerQuiz} />}
          {quizCard.type === 'mcq' && <QuestionBlock question={quizCard} onAnswer={answerQuiz} />}
          {quizCard.type === 'cmd' && <CmdBlock card={quizCard} onAnswer={answerQuiz} />}
          {quizCard.type === 'yaml' && <YamlBlock card={quizCard} onAnswer={answerQuiz} />}
          {quizResult && (
            <Animated.View entering={FadeIn} style={{ gap: 6, marginTop: 6 }}>
              <Text style={{ fontWeight: '900', color: quizResult.correct ? colors.gold : colors.bad }}>
                {quizResult.correct ? (quizResult.xp ? `+${quizResult.xp.total} XP` : '✓ Correct') : 'Not quite. Watch it again?'}
              </Text>
              <RichText style={styles.explain}>{quizCard.explain}</RichText>
              <Text style={styles.swipe}>Swipe up for the next reel ↑</Text>
            </Animated.View>
          )}
          {!quizResult && (
            <Pressable onPress={() => setIndex(0)}>
              <Text style={styles.replay}>↺ Replay</Text>
            </Pressable>
          )}
        </Animated.View>
      )}

      <View style={styles.rail}>
        <Pressable onPress={like} style={styles.railBtn} hitSlop={6}>
          <Animated.View style={likeStyle}>
            <Ionicons name={liked.has(likeId) ? 'heart' : 'heart-outline'} size={30} color={liked.has(likeId) ? colors.pink : colors.text} />
          </Animated.View>
        </Pressable>
        <Pressable
          onPress={() => {
            haptic.tap();
            Share.share({ message: `${reel.title}: ${reel.caption}\n\n#CKAgram #Kubernetes` }).catch(() => {});
          }}
          style={styles.railBtn}
          hitSlop={6}
        >
          <Ionicons name="paper-plane-outline" size={27} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => toggle(reel.quiz, 'save')} style={styles.railBtn} hitSlop={6}>
          <Ionicons name={saved.has(reel.quiz) ? 'bookmark' : 'bookmark-outline'} size={27} color={saved.has(reel.quiz) ? colors.gold : colors.text} />
        </Pressable>
      </View>

      <View style={styles.footer}>
        <View style={styles.author}>
          <View style={[styles.avatar, { backgroundColor: domain.color }]}>
            <Text>{domain.emoji}</Text>
          </View>
          <Text style={styles.authorName}>{domain.short}</Text>
          <Text style={styles.week}>· Week {reel.week}</Text>
        </View>
        <Text style={styles.reelTitle}>{reel.title}</Text>
        <Text style={styles.caption} numberOfLines={2}>
          {reel.caption}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingTop: 8 },
  barTrack: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: '#FFFFFF33', overflow: 'hidden' },
  barFill: { height: 2.5, backgroundColor: colors.text },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10 },
  reelsTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  stage: { flex: 1, paddingBottom: 120, paddingRight: 40 },
  pausedBadge: { position: 'absolute', top: '42%', alignSelf: 'center', backgroundColor: '#0008', borderRadius: 40, padding: 16 },
  quiz: { flex: 1, justifyContent: 'center', paddingHorizontal: 18, paddingRight: 64, paddingBottom: 120, gap: 10 },
  quizTag: { fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
  explain: { color: '#D9DEEA', fontSize: 14, lineHeight: 20 },
  swipe: { color: colors.muted, fontSize: 12, marginTop: 4 },
  replay: { color: colors.muted, fontWeight: '700', marginTop: 4 },
  rail: { position: 'absolute', right: 10, bottom: 130, gap: 22, alignItems: 'center' },
  railBtn: { alignItems: 'center' },
  footer: { position: 'absolute', left: 14, right: 70, bottom: 22, gap: 6 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.text },
  authorName: { color: colors.text, fontWeight: '800' },
  week: { color: colors.muted },
  reelTitle: { color: colors.text, fontWeight: '900', fontSize: 16 },
  caption: { color: '#D9DEEA', fontSize: 13.5, lineHeight: 19 },
});
