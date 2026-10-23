import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DOMAIN_BY_ID, DOMAINS } from '@/content';
import { setMeta } from '@/db/schema';
import { useProgress } from '@/state/progress';
import { ProgressRing } from '@/ui/ProgressRing';
import { colors, radius } from '@/ui/theme';

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + 'T09:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function Profile() {
  const db = useSQLiteContext();
  const { stats, refresh } = useProgress();
  if (!stats) return <SafeAreaView style={styles.screen} />;

  const moveExam = async (days: number) => {
    await setMeta(db, 'exam_date', shiftDate(stats.examDate, days));
    refresh();
  };
  const examLabel = new Date(stats.examDate + 'T09:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.handle}>cka.candidate</Text>

        <View style={styles.header}>
          <ProgressRing size={92} stroke={5} progress={stats.levelProgress} gradient>
            <View style={styles.avatar}>
              <Text style={styles.avatarLevel}>{stats.level}</Text>
              <Text style={styles.avatarLabel}>LEVEL</Text>
            </View>
          </ProgressRing>
          <View style={styles.counts}>
            <Count value={stats.xp.toLocaleString()} label="XP" />
            <Count value={`${stats.streak}`} label="Streak" />
            <Count value={`${stats.learnedTotal}`} label="Learned" />
          </View>
        </View>

        <View style={{ paddingHorizontal: 14, gap: 2 }}>
          <Text style={styles.title}>{stats.title}</Text>
          <Text style={styles.bio}>
            🎯 CKA in {Math.max(0, stats.daysToExam)} days · Week {stats.studyWeek} of 14
          </Text>
          <Text style={styles.bio}>
            {stats.xpToNext} XP to level {stats.level + 1} · best streak {stats.bestStreak} days
          </Text>
        </View>

        <View style={styles.examRow}>
          <Text style={styles.examText}>Exam date: {examLabel}</Text>
          <Pressable style={styles.smallBtn} onPress={() => moveExam(-7)}>
            <Text style={styles.smallBtnText}>−1w</Text>
          </Pressable>
          <Pressable style={styles.smallBtn} onPress={() => moveExam(7)}>
            <Text style={styles.smallBtnText}>+1w</Text>
          </Pressable>
        </View>

        <View style={styles.readiness}>
          <ProgressRing size={130} stroke={10} progress={stats.readiness} gradient>
            <Text style={styles.readyPct}>{Math.round(stats.readiness * 100)}%</Text>
            <Text style={styles.readyLabel}>exam ready</Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: 10 }}>
            {DOMAINS.map((d) => {
              const m = stats.domains[d.id].mastery;
              return (
                <View key={d.id} style={{ gap: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.domName}>
                      {d.emoji} {d.short}
                    </Text>
                    <Text style={styles.domPct}>
                      {Math.round(m * 100)}% · w{Math.round(d.weight * 100)}
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.max(2, m * 100)}%`, backgroundColor: d.color }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
        <Text style={styles.note}>A card counts as exam-ready once you'd remember it for 3+ weeks. Readiness is weighted like the real exam.</Text>

        <Text style={styles.gridTitle}>Topics</Text>
        <View style={styles.grid}>
          {stats.topics.map((t) => (
            <View key={`${t.domain}:${t.topic}`} style={styles.tile}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: DOMAIN_BY_ID[t.domain].color, opacity: 0.12 + t.mastery * 0.75 }]} />
              <Text style={styles.tileText}>{t.topic}</Text>
              <Text style={styles.tileSub}>{Math.round(t.mastery * 100)}%</Text>
            </View>
          ))}
        </View>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  handle: { color: colors.text, fontSize: 22, fontWeight: '800', padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 16, marginBottom: 10 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  avatarLevel: { color: colors.text, fontSize: 28, fontWeight: '900' },
  avatarLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  counts: { flex: 1, flexDirection: 'row' },
  countValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  countLabel: { color: colors.text, fontSize: 13 },
  title: { color: colors.text, fontWeight: '800', fontSize: 15 },
  bio: { color: colors.text, fontSize: 14, lineHeight: 20 },
  examRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginTop: 10 },
  examText: { color: colors.muted, flex: 1, fontSize: 13 },
  smallBtn: { backgroundColor: colors.surface2, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  smallBtnText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  readiness: { flexDirection: 'row', alignItems: 'center', gap: 16, margin: 14, padding: 14, backgroundColor: colors.surface, borderRadius: radius.lg },
  readyPct: { color: colors.text, fontSize: 30, fontWeight: '900' },
  readyLabel: { color: colors.muted, fontSize: 11 },
  domName: { color: colors.text, fontSize: 12, fontWeight: '700' },
  domPct: { color: colors.muted, fontSize: 11 },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
  note: { color: colors.faint, fontSize: 12, paddingHorizontal: 16, marginTop: -4, lineHeight: 17 },
  gridTitle: { color: colors.text, fontWeight: '800', fontSize: 16, padding: 14, paddingBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  tile: { width: '33.1%', aspectRatio: 1, padding: 8, justifyContent: 'flex-end', backgroundColor: colors.surface },
  tileText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  tileSub: { color: colors.text, fontSize: 11, opacity: 0.8 },
});
