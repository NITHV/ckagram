import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DOMAIN_BY_ID, DOMAINS } from '@/content';
import { haptic } from '@/lib/haptics';
import { useProgress } from '@/state/progress';
import { colors, radius } from '@/ui/theme';

export default function Explore() {
  const { stats } = useProgress();
  if (!stats) return <SafeAreaView style={styles.screen} />;

  const go = (mode: string) => {
    haptic.tap();
    router.push({ pathname: '/session/[mode]', params: { mode } });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 16, paddingBottom: 40 }}>
        <Text style={styles.h1}>Explore</Text>
        <Text style={styles.sub}>CKA domains, sized by how much of the exam they're worth.</Text>

        <View style={styles.grid}>
          {DOMAINS.map((d) => {
            const s = stats.domains[d.id];
            return (
              <Pressable key={d.id} onPress={() => go(d.id)} style={[styles.domain, { borderColor: d.color + '66' }]}>
                <View style={styles.domainTop}>
                  <Text style={{ fontSize: 26 }}>{d.emoji}</Text>
                  <Text style={[styles.weight, { color: d.color }]}>{Math.round(d.weight * 100)}%</Text>
                </View>
                <Text style={styles.domainName}>{d.name}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.max(2, s.mastery * 100)}%`, backgroundColor: d.color }]} />
                </View>
                <Text style={styles.domainMeta}>
                  {Math.round(s.mastery * 100)}% mastered · {s.due} due · {s.fresh} new
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.row}>
          <Pressable style={[styles.action, { backgroundColor: '#0E2235' }]} onPress={() => go('labs')}>
            <Text style={styles.actionEmoji}>⌨️</Text>
            <Text style={styles.actionTitle}>Phone labs</Text>
            <Text style={styles.actionSub}>kubectl + YAML only</Text>
          </Pressable>
          <Pressable style={[styles.action, { backgroundColor: '#2A1530' }]} onPress={() => go('drill')}>
            <Text style={styles.actionEmoji}>🎯</Text>
            <Text style={styles.actionTitle}>Weak spots</Text>
            <Text style={styles.actionSub}>Drill what you forget</Text>
          </Pressable>
        </View>

        <Text style={styles.h2}>Topics</Text>
        <View style={styles.topics}>
          {stats.topics.map((t) => {
            const color = DOMAIN_BY_ID[t.domain].color;
            return (
              <Pressable key={`${t.domain}:${t.topic}`} onPress={() => go(t.domain)} style={styles.topic}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: 0.12 + t.mastery * 0.75, borderRadius: radius.sm }]} />
                <Text style={styles.topicName}>{t.topic}</Text>
                <Text style={styles.topicMeta}>
                  {t.learned}/{t.total} · {Math.round(t.mastery * 100)}%
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 26, fontWeight: '800' },
  h2: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 4 },
  sub: { color: colors.muted, marginTop: -8 },
  grid: { gap: 10 },
  domain: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, borderWidth: 1, gap: 8 },
  domainTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weight: { fontSize: 20, fontWeight: '900' },
  domainName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  domainMeta: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, borderRadius: radius.md, padding: 14, gap: 4 },
  actionEmoji: { fontSize: 26 },
  actionTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  actionSub: { color: colors.muted, fontSize: 12 },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  topic: { width: '32.6%', aspectRatio: 1, borderRadius: radius.sm, padding: 8, justifyContent: 'flex-end', backgroundColor: colors.surface },
  topicName: { color: colors.text, fontWeight: '800', fontSize: 13 },
  topicMeta: { color: colors.text, fontSize: 11, opacity: 0.8 },
});
