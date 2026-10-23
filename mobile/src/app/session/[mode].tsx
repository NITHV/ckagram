// Focus session: one card at a time, story-style progress bars, a summary at the end.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DOMAIN_BY_ID, DOMAINS, type DomainId } from '@/content';
import type { FeedMode } from '@/engine/feed';
import { haptic } from '@/lib/haptics';
import { useCelebrate } from '@/state/celebrate';
import { useMarks } from '@/state/marks';
import { useProgress } from '@/state/progress';
import { useQueue } from '@/state/useQueue';
import { CardView } from '@/ui/cards/CardView';
import { colors, radius } from '@/ui/theme';

const SESSION_SIZE = 10;

function parseMode(mode: string, saved: Set<string>): { mode: FeedMode; title: string } {
  if (mode === 'saved') return { mode: { kind: 'ids', ids: [...saved] }, title: '🔖 Saved' };
  if (mode.startsWith('card-')) return { mode: { kind: 'ids', ids: [mode.slice(5)] }, title: 'Card' };
  if (mode.startsWith('ids-')) return { mode: { kind: 'ids', ids: mode.slice(4).split(',').filter(Boolean) }, title: '📝 Mock misses' };
  if (mode === 'labs') return { mode: { kind: 'labs' }, title: 'Phone labs' };
  if (mode === 'drill') return { mode: { kind: 'drill' }, title: 'Bonus drill' };
  if (DOMAINS.some((d) => d.id === mode)) {
    const d = DOMAIN_BY_ID[mode as DomainId];
    return { mode: { kind: 'domain', domain: d.id }, title: `${d.emoji} ${d.short}` };
  }
  return { mode: { kind: 'home' }, title: "Today's reviews" };
}

export default function Session() {
  const params = useLocalSearchParams<{ mode: string }>();
  const { saved } = useMarks();
  // Snapshot saved cards when the session opens so un-saving mid-session doesn't reshuffle it.
  const [savedAtOpen] = useState(saved);
  const { mode, title } = useMemo(() => parseMode(params.mode ?? 'due', savedAtOpen), [params.mode, savedAtOpen]);
  const q = useQueue(mode, SESSION_SIZE);
  const [index, setIndex] = useState(0);
  const [answeredHere, setAnsweredHere] = useState(false);
  const { stats } = useProgress();

  const items = q.items.slice(0, SESSION_SIZE);
  const finished = items.length > 0 && index >= items.length;
  const empty = q.exhausted && q.items.length === 0;
  const current = items[index];

  const next = () => {
    haptic.tap();
    setAnsweredHere(false);
    setIndex((i) => i + 1);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.bars}>
        {items.map((it, i) => (
          <View key={it.key} style={styles.barTrack}>
            <View style={[styles.barFill, { width: i < index || (i === index && answeredHere) ? '100%' : '0%' }]} />
          </View>
        ))}
      </View>
      <View style={styles.top}>
        <Text style={styles.title}>{title}</Text>
        {q.combo >= 3 && <Text style={styles.combo}>⚡ {q.combo} in a row</Text>}
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      {!items.length && !empty && <ActivityIndicator color={colors.muted} style={{ marginTop: 80 }} />}

      {empty && (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>🌱</Text>
          <Text style={styles.doneTitle}>Nothing waiting here</Text>
          <Text style={styles.doneText}>
            {mode.kind === 'domain'
              ? 'No reviews due in this domain and its new cards unlock later in the plan.'
              : mode.kind === 'drill'
                ? 'Answer a few cards first; drills pick your weakest known cards.'
                : mode.kind === 'ids'
                  ? 'Nothing saved yet. Tap the bookmark on any card to keep it here.'
                : "You're fully caught up. Come back later for due reviews."}
          </Text>
          <Pressable style={styles.primary} onPress={() => router.back()}>
            <Text style={styles.primaryText}>Back to feed</Text>
          </Pressable>
        </View>
      )}

      {current && !finished && (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Animated.View key={current.key} entering={SlideInRight.duration(220)}>
            <CardView
              card={current.card}
              isNew={current.isNew}
              active
              onAnswer={(correct, ms) => {
                setAnsweredHere(true);
                q.onAnswer(current, correct, ms);
              }}
              onNext={next}
            />
          </Animated.View>
        </ScrollView>
      )}

      {finished && (
        <Summary
          answered={q.answeredCount}
          correct={q.correctCount}
          xp={q.sessionXp}
          bestCombo={q.bestCombo}
          streak={stats?.streak ?? 0}
          onAgain={() => {
            setIndex(0);
            q.reset();
          }}
        />
      )}
    </SafeAreaView>
  );
}

function Summary(props: { answered: number; correct: number; xp: number; bestCombo: number; streak: number; onAgain: () => void }) {
  const celebrate = useCelebrate();
  const fired = useRef(false);
  const accuracy = props.answered ? Math.round((props.correct / props.answered) * 100) : 0;
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    celebrate({
      celebrations: [{ kind: 'goal', emoji: accuracy >= 80 ? '🏆' : '💪', title: 'Session complete', detail: `${accuracy}% correct`, big: true }],
    });
  }, [accuracy, celebrate]);

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.center}>
      <Text style={{ fontSize: 56 }}>{accuracy >= 80 ? '🏆' : '💪'}</Text>
      <Text style={styles.doneTitle}>{accuracy >= 80 ? 'Crushed it' : 'Every miss is a future win'}</Text>
      <View style={styles.statsRow}>
        <Stat label="XP" value={`+${props.xp}`} />
        <Stat label="Correct" value={`${accuracy}%`} />
        <Stat label="Best combo" value={`${props.bestCombo}`} />
        <Stat label="Streak" value={`🔥${props.streak}`} />
      </View>
      <Pressable style={styles.primary} onPress={props.onAgain}>
        <Text style={styles.primaryText}>Another round</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.link}>Done</Text>
      </Pressable>
    </Animated.View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 70 }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingTop: 6 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#3A3A3A', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: colors.text },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 },
  combo: { color: colors.gold, fontWeight: '800' },
  close: { color: colors.text, fontSize: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  doneTitle: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  doneText: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 6, marginVertical: 12 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 12 },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 26 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  link: { color: colors.accent, fontWeight: '700', marginTop: 4 },
});
