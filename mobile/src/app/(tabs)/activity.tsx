import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { startOfToday, timeAgo } from '@/lib/dates';
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
  const [wins, setWins] = useState<Win[]>([]);

  useFocusEffect(
    useCallback(() => {
      db.getAllAsync<Win>('SELECT * FROM wins ORDER BY ts DESC LIMIT 200').then(setWins);
    }, [db])
  );

  const today = startOfToday();
  const week = today - 6 * 86400000;
  const sections = [
    { title: 'Today', data: wins.filter((w) => w.ts >= today) },
    { title: 'This week', data: wins.filter((w) => w.ts < today && w.ts >= week) },
    { title: 'Earlier', data: wins.filter((w) => w.ts < week) },
  ].filter((s) => s.data.length);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.h1}>Activity</Text>
      <SectionList
        sections={sections}
        keyExtractor={(w) => String(w.id)}
        renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
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
            <Text style={{ fontSize: 44 }}>❤️</Text>
            <Text style={styles.emptyTitle}>Your wins show up here</Text>
            <Text style={styles.emptyText}>Level-ups, streaks, boss cards and mastery milestones. Go earn the first one.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 26, fontWeight: '800', paddingHorizontal: 14, paddingVertical: 8 },
  section: { color: colors.text, fontWeight: '800', fontSize: 16, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.text, flex: 1, fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: '800' },
  time: { color: colors.faint },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
});
