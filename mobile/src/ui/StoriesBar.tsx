// Stories = your due reviews. A colored ring means something is waiting.
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DOMAINS } from '@/content';
import type { Stats } from '@/engine/progress';
import { haptic } from '@/lib/haptics';
import { ProgressRing } from './ProgressRing';
import { colors, ringGradient } from './theme';

const SIZE = 68;

export function StoriesBar({ stats }: { stats: Stats }) {
  // Domains with something waiting first, like unseen stories.
  const domains = [...DOMAINS].sort((a, b) => {
    const wa = stats.domains[a.id].due + stats.domains[a.id].fresh;
    const wb = stats.domains[b.id].due + stats.domains[b.id].fresh;
    return Number(wb > 0) - Number(wa > 0);
  });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Pressable
        style={styles.item}
        onPress={() => {
          haptic.tap();
          router.push('/session/due');
        }}
      >
        <ProgressRing size={SIZE} stroke={4} progress={stats.todayXp / stats.dailyGoal} gradient>
          <View style={[styles.inner, { backgroundColor: colors.surface2 }]}>
            <Text style={styles.goalXp}>{stats.todayXp}</Text>
            <Text style={styles.goalOf}>/{stats.dailyGoal}</Text>
          </View>
        </ProgressRing>
        <Text style={styles.label}>Today</Text>
      </Pressable>

      {domains.map((d) => {
        const s = stats.domains[d.id];
        const waiting = s.due + s.fresh;
        return (
          <Pressable
            key={d.id}
            style={styles.item}
            onPress={() => {
              haptic.tap();
              router.push({ pathname: '/session/[mode]', params: { mode: d.id } });
            }}
          >
            {waiting > 0 ? (
              <LinearGradient colors={ringGradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.ring}>
                <View style={[styles.inner, { backgroundColor: d.color }]}>
                  <Text style={styles.emoji}>{d.emoji}</Text>
                </View>
              </LinearGradient>
            ) : (
              <View style={[styles.ring, { backgroundColor: colors.border }]}>
                <View style={[styles.inner, { backgroundColor: d.color, opacity: 0.55 }]}>
                  <Text style={styles.emoji}>{d.emoji}</Text>
                </View>
              </View>
            )}
            {s.due > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{s.due}</Text>
              </View>
            )}
            <Text style={[styles.label, waiting === 0 && { color: colors.faint }]}>{d.short}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 10, paddingVertical: 10, gap: 14 },
  item: { alignItems: 'center', width: SIZE + 4 },
  ring: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  inner: {
    width: SIZE - 8,
    height: SIZE - 8,
    borderRadius: (SIZE - 8) / 2,
    borderWidth: 3,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  emoji: { fontSize: 26 },
  goalXp: { color: colors.text, fontWeight: '800', fontSize: 15 },
  goalOf: { color: colors.muted, fontSize: 10, alignSelf: 'flex-end', marginBottom: 20 },
  label: { color: colors.text, fontSize: 12, marginTop: 4 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.bad,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
