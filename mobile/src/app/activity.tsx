import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { getMeta } from '@/db/schema';
import { startOfToday, timeAgo } from '@/lib/dates';
import { useProgress } from '@/state/progress';
import { Mark } from '@/ui/Brand';
import { colors } from '@/ui/theme';

interface Win {
  id: number;
  ts: number;
  kind: string;
  emoji: string;
  title: string;
  detail: string;
}

export default function Activity() {
  const db = useSQLiteContext();
  const { markWinsSeen } = useProgress();
  const [wins, setWins] = useState<Win[]>([]);
  const seenAt = useRef(0);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        seenAt.current = Number((await getMeta(db, 'wins_seen_at')) ?? 0);
        setWins(await db.getAllAsync<Win>('SELECT * FROM wins ORDER BY ts DESC LIMIT 300'));
        await markWinsSeen();
      })();
    }, [db, markWinsSeen])
  );

  const today = startOfToday();
  const week = today - 6 * 86400000;
  const sections = [
    { title: 'New', data: wins.filter((w) => w.ts > seenAt.current) },
    { title: 'Today', data: wins.filter((w) => w.ts <= seenAt.current && w.ts >= today) },
    { title: 'This week', data: wins.filter((w) => w.ts <= seenAt.current && w.ts < today && w.ts >= week) },
    { title: 'Earlier', data: wins.filter((w) => w.ts <= seenAt.current && w.ts < week) },
  ].filter((s) => s.data.length);

  return (
    <SectionList
      style={{ backgroundColor: colors.bg }}
      sections={sections}
      keyExtractor={(w) => String(w.id)}
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderItem={({ item }) => (
        <View style={[styles.row, item.ts > seenAt.current && styles.rowNew]}>
          <View style={styles.avatar}>
            <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
          </View>
          <Text style={styles.text}>
            <Text style={styles.bold}>{item.title}</Text>
            {item.detail ? ` ${item.detail}` : ''} <Text style={styles.time}>{timeAgo(item.ts)}</Text>
          </Text>
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Mark size={64} />
          <Text style={styles.emptyTitle}>Your wins show up here</Text>
          <Text style={styles.emptyText}>Level-ups, streaks, boss cards, cleared labs and mastery milestones. Go earn the first one.</Text>
        </View>
      }
      contentContainerStyle={{ paddingBottom: 40 }}
      stickySectionHeadersEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  section: { color: colors.text, fontWeight: '800', fontSize: 16, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 9 },
  rowNew: { backgroundColor: '#3D7BFF14' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.text, flex: 1, fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: '800' },
  time: { color: colors.faint },
  empty: { alignItems: 'center', padding: 40, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
});
