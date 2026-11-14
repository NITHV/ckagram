import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CARD_BY_ID, DOMAIN_BY_ID, DOMAINS } from '@/content';
import { LABS } from '@/content/labs';
import { setMeta } from '@/db/schema';
import type { Stats } from '@/engine/progress';
import { haptic } from '@/lib/haptics';
import { useMarks } from '@/state/marks';
import { useProgress } from '@/state/progress';
import { Mark } from '@/ui/Brand';
import { ProgressRing } from '@/ui/ProgressRing';
import { TopicTile } from '@/ui/TopicTile';
import { colors, radius } from '@/ui/theme';

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + 'T09:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Badge {
  emoji: string;
  title: string;
  got: boolean;
  hint: string;
}

function badges(s: Stats): Badge[] {
  const week1Labs = LABS.filter((l) => l.week === 1);
  return [
    { emoji: '🌱', title: 'First steps', got: s.learnedTotal >= 1, hint: 'Answer your first card' },
    { emoji: '🔥', title: 'On fire', got: s.bestStreak >= 7, hint: '7-day streak' },
    { emoji: '☄️', title: 'Unstoppable', got: s.bestStreak >= 30, hint: '30-day streak' },
    { emoji: '💻', title: 'Hands on', got: s.labsDone >= 1, hint: 'Clear a laptop lab' },
    { emoji: '🧪', title: 'Week 1 lab rat', got: week1Labs.every((l) => s.labBest[l.id] !== undefined), hint: 'Clear all week-1 labs' },
    { emoji: '👑', title: 'Boss slayer', got: LABS.filter((l) => l.boss).some((l) => s.labBest[l.id] !== undefined), hint: 'Clear a boss lab' },
    { emoji: '📚', title: 'Centurion', got: s.learnedTotal >= 100, hint: 'Learn 100 cards' },
    { emoji: '⬆️', title: 'Level 5', got: s.level >= 5, hint: 'Reach level 5' },
    { emoji: '🚀', title: 'Level 10', got: s.level >= 10, hint: 'Reach level 10' },
    ...DOMAINS.map((d) => ({ emoji: d.emoji, title: `${d.short} 50%`, got: s.domains[d.id].mastery >= 0.5, hint: `Master half of ${d.short}` })),
    { emoji: '📝', title: 'Test drive', got: s.mockCount >= 1, hint: 'Take a mock exam' },
    { emoji: '✅', title: 'Mock pass', got: (s.mockBest ?? 0) >= 66, hint: 'Score 66% in a mock' },
    { emoji: '💯', title: 'Mock ace', got: (s.mockBest ?? 0) >= 90, hint: 'Score 90% in a mock' },
    { emoji: '🎓', title: 'Exam ready', got: s.readiness >= 0.8, hint: 'Reach 80% readiness' },
  ];
}

export default function Profile() {
  const db = useSQLiteContext();
  const { stats, refresh } = useProgress();
  const { saved } = useMarks();
  const [tab, setTab] = useState<'topics' | 'saved' | 'badges'>('topics');
  if (!stats) return <SafeAreaView style={styles.screen} />;

  const moveExam = async (days: number) => {
    haptic.tap();
    await setMeta(db, 'exam_date', shiftDate(stats.examDate, days));
    refresh();
  };
  const examLabel = new Date(stats.examDate + 'T09:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const savedCards = [...saved].map((id) => CARD_BY_ID[id]).filter(Boolean);
  const allBadges = badges(stats);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.topBar}>
          <Text style={styles.handle}>cka.candidate</Text>
          <Pressable onPress={() => router.push('/activity')} hitSlop={8}>
            <Ionicons name="heart-outline" size={26} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.header}>
          <ProgressRing size={96} stroke={5} progress={stats.levelProgress} gradient>
            <View style={styles.avatar}>
              <Mark size={58} />
            </View>
            <View style={styles.levelPill}>
              <Text style={styles.levelPillText}>LV {stats.level}</Text>
            </View>
          </ProgressRing>
          <View style={styles.counts}>
            <Count value={stats.xp.toLocaleString()} label="XP" />
            <Count value={`${stats.streak}`} label="Streak" />
            <Count value={`${stats.labsDone}`} label="Labs" />
          </View>
        </View>

        <View style={styles.bio}>
          <Text style={styles.title}>{stats.title}</Text>
          <Text style={styles.bioText}>
            🎯 CKA in {Math.max(0, stats.daysToExam)} days · Week {stats.studyWeek} of 14
          </Text>
          <Text style={styles.bioText}>
            {stats.xpToNext.toLocaleString()} XP to level {stats.level + 1} · best streak {stats.bestStreak}d · {stats.learnedTotal} cards learned
          </Text>
        </View>

        <View style={styles.examRow}>
          <Text style={styles.examText}>Exam date · {examLabel}</Text>
          <Pressable style={styles.smallBtn} onPress={() => moveExam(-7)}>
            <Text style={styles.smallBtnText}>−1 week</Text>
          </Pressable>
          <Pressable style={styles.smallBtn} onPress={() => moveExam(7)}>
            <Text style={styles.smallBtnText}>+1 week</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
          {DOMAINS.map((d) => (
            <Pressable key={d.id} style={styles.highlight} onPress={() => router.push({ pathname: '/session/[mode]', params: { mode: d.id } })}>
              <ProgressRing size={66} stroke={3} progress={stats.domains[d.id].mastery} color={d.color}>
                <View style={[styles.hlInner, { backgroundColor: d.color + '22' }]}>
                  <Text style={{ fontSize: 22 }}>{d.emoji}</Text>
                </View>
              </ProgressRing>
              <Text style={styles.hlLabel}>{d.short}</Text>
              <Text style={styles.hlPct}>{Math.round(stats.domains[d.id].mastery * 100)}%</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.readiness}>
          <ProgressRing size={118} stroke={10} progress={stats.readiness} gradient>
            <Text style={styles.readyPct}>{Math.round(stats.readiness * 100)}%</Text>
            <Text style={styles.readyLabel}>exam ready</Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: 12 }}>
            <Split label="🧠 Knowledge" value={stats.knowledge} hint="cards you'd remember 3+ weeks" color={colors.accent} />
            <Split label="💻 Hands-on" value={stats.handsOn} hint={`${stats.labsDone} labs cleared`} color={colors.gold} />
          </View>
        </View>

        <View style={styles.tabs}>
          {(
            [
              ['topics', 'grid-outline', 'grid'],
              ['saved', 'bookmark-outline', 'bookmark'],
              ['badges', 'trophy-outline', 'trophy'],
            ] as const
          ).map(([key, off, on]) => (
            <Pressable key={key} style={[styles.tab, tab === key && styles.tabOn]} onPress={() => setTab(key)}>
              <Ionicons name={tab === key ? on : off} size={22} color={tab === key ? colors.text : colors.muted} />
            </Pressable>
          ))}
        </View>

        {tab === 'topics' && (
          <View style={styles.grid}>
            {stats.topics.map((t) => (
              <TopicTile key={`${t.domain}:${t.topic}`} topic={t} style={styles.tile} />
            ))}
          </View>
        )}

        {tab === 'saved' &&
          (savedCards.length ? (
            <View>
              <Pressable style={styles.practiceSaved} onPress={() => router.push('/session/saved')}>
                <Text style={styles.practiceSavedText}>Practice all {savedCards.length} saved</Text>
              </Pressable>
              {savedCards.map((c) => (
                <Pressable key={c.id} style={styles.savedRow} onPress={() => router.push({ pathname: '/session/[mode]', params: { mode: `card-${c.id}` } })}>
                  <Text style={{ fontSize: 18 }}>{DOMAIN_BY_ID[c.domain].emoji}</Text>
                  <Text style={styles.savedText} numberOfLines={2}>
                    {c.type === 'concept' ? c.title : c.type === 'mcq' ? c.q : c.task}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>Tap the bookmark on any card or reel to save it here.</Text>
          ))}

        {tab === 'badges' && (
          <View style={styles.badges}>
            {allBadges.map((b) => (
              <View key={b.title} style={[styles.badge, !b.got && { opacity: 0.35 }]}>
                <Text style={{ fontSize: 30 }}>{b.got ? b.emoji : '🔒'}</Text>
                <Text style={styles.badgeTitle}>{b.title}</Text>
                <Text style={styles.badgeHint}>{b.hint}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Count({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={styles.countValue}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

function Split({ label, value, hint, color }: { label: string; value: number; hint: string; color: string }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.splitLabel}>{label}</Text>
        <Text style={styles.splitValue}>{Math.round(value * 100)}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(2, value * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.splitHint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  handle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 16, marginBottom: 10 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  levelPill: { position: 'absolute', bottom: -4, backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 2, borderColor: colors.bg },
  levelPillText: { color: '#1A1200', fontWeight: '900', fontSize: 11 },
  counts: { flex: 1, flexDirection: 'row' },
  countValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  countLabel: { color: colors.text, fontSize: 13 },
  bio: { paddingHorizontal: 14, gap: 2 },
  title: { color: colors.text, fontWeight: '800', fontSize: 15 },
  bioText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  examRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginTop: 12 },
  examText: { color: colors.muted, flex: 1, fontSize: 13 },
  smallBtn: { backgroundColor: colors.surface2, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 7 },
  smallBtnText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  highlights: { paddingHorizontal: 12, paddingVertical: 16, gap: 14 },
  highlight: { alignItems: 'center', width: 70 },
  hlInner: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  hlLabel: { color: colors.text, fontSize: 12, marginTop: 4 },
  hlPct: { color: colors.muted, fontSize: 11 },
  readiness: { flexDirection: 'row', alignItems: 'center', gap: 16, marginHorizontal: 14, padding: 14, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  readyPct: { color: colors.text, fontSize: 28, fontWeight: '900' },
  readyLabel: { color: colors.muted, fontSize: 11 },
  splitLabel: { color: colors.text, fontWeight: '800', fontSize: 13 },
  splitValue: { color: colors.text, fontWeight: '800', fontSize: 13 },
  splitHint: { color: colors.faint, fontSize: 11 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  tabs: { flexDirection: 'row', marginTop: 18, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabOn: { borderBottomWidth: 2, borderBottomColor: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 12 },
  tile: { width: '32.6%' },
  practiceSaved: { margin: 14, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  practiceSavedText: { color: '#fff', fontWeight: '800' },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  savedText: { color: colors.text, flex: 1, lineHeight: 19 },
  empty: { color: colors.muted, textAlign: 'center', padding: 30 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 8 },
  badge: { width: '31.5%', backgroundColor: colors.surface, borderRadius: radius.md, padding: 10, alignItems: 'center', gap: 4 },
  badgeTitle: { color: colors.text, fontWeight: '800', fontSize: 12, textAlign: 'center' },
  badgeHint: { color: colors.muted, fontSize: 10, textAlign: 'center' },
});
