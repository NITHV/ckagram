import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ALL_CARDS, DOMAIN_BY_ID, DOMAINS, type Card } from '@/content';
import { REELS } from '@/content/reels';
import { haptic } from '@/lib/haptics';
import { useProgress } from '@/state/progress';
import { colors, radius } from '@/ui/theme';

function cardText(c: Card) {
  const main = c.type === 'concept' ? `${c.title} ${c.body} ${c.check.q}` : c.type === 'mcq' ? `${c.q} ${c.options.join(' ')}` : c.type === 'cmd' ? `${c.task} ${c.answer}` : `${c.task} ${c.yaml}`;
  return `${c.topic} ${main} ${c.explain}`.toLowerCase();
}
function cardHeadline(c: Card) {
  return c.type === 'concept' ? c.title : c.type === 'mcq' ? c.q : c.task;
}

const INDEX = ALL_CARDS.map((c) => ({ card: c, text: cardText(c) }));

export default function Explore() {
  const { stats } = useProgress();
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return INDEX.filter((e) => words.every((w) => e.text.includes(w))).slice(0, 40).map((e) => e.card);
  }, [query]);

  const go = (mode: string) => {
    haptic.tap();
    router.push({ pathname: '/session/[mode]', params: { mode } });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search cards: taint, rollout, secret…"
          placeholderTextColor={colors.faint}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {query ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.resultCount}>
            {results.length} {results.length === 1 ? 'card' : 'cards'}
          </Text>
          {results.map((c) => {
            const d = DOMAIN_BY_ID[c.domain];
            return (
              <Pressable key={c.id} onPress={() => go(`card-${c.id}`)} style={styles.result}>
                <View style={[styles.resultIcon, { backgroundColor: d.color + '26' }]}>
                  <Text>{d.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle} numberOfLines={2}>
                    {cardHeadline(c)}
                  </Text>
                  <Text style={styles.resultMeta}>
                    {c.topic} · week {c.week}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 16, paddingBottom: 40 }}>
          <Text style={styles.h2}>Reels for you</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {REELS.map((r) => {
              const d = DOMAIN_BY_ID[r.domain];
              return (
                <Pressable key={r.id} onPress={() => router.navigate({ pathname: '/reels', params: { start: r.id } })}>
                  <LinearGradient colors={[d.color, '#05060B']} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={styles.reelTile}>
                    <Ionicons name="play" size={16} color="#fff" style={{ position: 'absolute', top: 8, right: 8 }} />
                    <Text style={styles.reelEmoji}>{r.frames[0].kind === 'hook' ? (r.frames[0].emoji ?? d.emoji) : d.emoji}</Text>
                    <Text style={styles.reelTitle} numberOfLines={3}>
                      {r.title}
                    </Text>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.h2}>Exam domains</Text>
          <View style={styles.grid}>
            {stats &&
              DOMAINS.map((d) => {
                const s = stats.domains[d.id];
                return (
                  <Pressable key={d.id} onPress={() => go(d.id)} style={[styles.domain, { borderColor: d.color + '55' }]}>
                    <View style={styles.domainTop}>
                      <Text style={{ fontSize: 24 }}>{d.emoji}</Text>
                      <Text style={[styles.weight, { color: d.color }]}>{Math.round(d.weight * 100)}%</Text>
                    </View>
                    <Text style={styles.domainName} numberOfLines={2}>
                      {d.name}
                    </Text>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${Math.max(2, s.mastery * 100)}%`, backgroundColor: d.color }]} />
                    </View>
                    <Text style={styles.domainMeta}>
                      {s.due} due · {s.fresh} new
                    </Text>
                  </Pressable>
                );
              })}
          </View>

          <View style={styles.row}>
            <Pressable style={[styles.action, { backgroundColor: '#3D7BFF22' }]} onPress={() => go('labs')}>
              <Text style={styles.actionEmoji}>⌨️</Text>
              <Text style={styles.actionTitle}>Mini-labs</Text>
              <Text style={styles.actionSub}>kubectl + YAML</Text>
            </Pressable>
            <Pressable style={[styles.action, { backgroundColor: '#FF4F7922' }]} onPress={() => go('drill')}>
              <Text style={styles.actionEmoji}>🎯</Text>
              <Text style={styles.actionTitle}>Weak spots</Text>
              <Text style={styles.actionSub}>Drill what slips</Text>
            </Pressable>
            <Pressable style={[styles.action, { backgroundColor: '#FFB02022' }]} onPress={() => go('saved')}>
              <Text style={styles.actionEmoji}>🔖</Text>
              <Text style={styles.actionTitle}>Saved</Text>
              <Text style={styles.actionSub}>Your bookmarks</Text>
            </Pressable>
          </View>
          <Pressable style={[styles.action, styles.mockAction]} onPress={() => router.push('/mock')}>
            <Text style={styles.actionEmoji}>🎓</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Mock exam</Text>
              <Text style={styles.actionSub}>25 questions · 30 min · pass 66%</Text>
            </View>
          </Pressable>

          <Text style={styles.h2}>Topics</Text>
          <View style={styles.topics}>
            {stats?.topics.map((t) => {
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mockAction: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#B04BFF22', flex: 0 },
  screen: { flex: 1, backgroundColor: colors.bg },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, marginBottom: 4, paddingHorizontal: 12, backgroundColor: colors.surface2, borderRadius: radius.md },
  search: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 10 },
  resultCount: { color: colors.muted, paddingHorizontal: 14, paddingVertical: 8, fontSize: 12 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  resultIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { color: colors.text, fontWeight: '600', lineHeight: 19 },
  resultMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  h2: { color: colors.text, fontSize: 18, fontWeight: '800' },
  reelTile: { width: 118, height: 190, borderRadius: radius.md, padding: 10, justifyContent: 'flex-end' },
  reelEmoji: { fontSize: 30, marginBottom: 'auto', marginTop: 8 },
  reelTitle: { color: '#fff', fontWeight: '800', fontSize: 13, lineHeight: 17 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  domain: { width: '48.8%', backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, borderWidth: 1, gap: 6 },
  domainTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weight: { fontSize: 18, fontWeight: '900' },
  domainName: { color: colors.text, fontWeight: '700', fontSize: 13, minHeight: 34 },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
  domainMeta: { color: colors.muted, fontSize: 11 },
  row: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, borderRadius: radius.md, padding: 12, gap: 3 },
  actionEmoji: { fontSize: 22 },
  actionTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  actionSub: { color: colors.muted, fontSize: 11 },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  topic: { width: '32.6%', aspectRatio: 1, borderRadius: radius.sm, padding: 8, justifyContent: 'flex-end', backgroundColor: colors.surface },
  topicName: { color: colors.text, fontWeight: '800', fontSize: 13 },
  topicMeta: { color: colors.text, fontSize: 11, opacity: 0.8 },
});
