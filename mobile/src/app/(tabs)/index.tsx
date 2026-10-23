import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { QueueItem } from '@/engine/feed';
import { useProgress } from '@/state/progress';
import { feedSignals, useQueue } from '@/state/useQueue';
import { CardView } from '@/ui/cards/CardView';
import { StoriesBar } from '@/ui/StoriesBar';
import { colors, radius } from '@/ui/theme';

const HOME = { kind: 'home' } as const;
const VIEWABILITY = { itemVisiblePercentThreshold: 40 };

export default function Home() {
  const { stats } = useProgress();
  const { items, exhausted, loadMore, reset, onAnswer, combo } = useQueue(HOME);
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const list = useRef<FlatList<QueueItem>>(null);

  const onViewable = useRef(({ viewableItems }: { viewableItems: { key: string }[] }) => {
    setVisible(new Set(viewableItems.map((v) => v.key)));
  }).current;

  // Cards answered in a focus session would be stale here, so rebuild the feed.
  useFocusEffect(
    useCallback(() => {
      if (feedSignals.dirty) {
        feedSignals.dirty = false;
        reset();
      }
    }, [reset])
  );

  const next = useCallback(
    (index: number) => {
      if (index + 1 < items.length) list.current?.scrollToIndex({ index: index + 1, viewPosition: 0, animated: true });
      else loadMore();
    },
    [items.length, loadMore]
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.logo}>CKAgram</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {combo >= 3 && (
            <View style={[styles.chip, { borderColor: colors.gold }]}>
              <Text style={[styles.chipText, { color: colors.gold }]}>⚡{combo}</Text>
            </View>
          )}
          <Pressable onPress={() => router.navigate('/profile')} style={[styles.chip, stats?.streakAtRisk && { borderColor: colors.bad }]}>
            <Text style={styles.chipText}>🔥 {stats?.streak ?? 0}</Text>
          </Pressable>
          <Pressable onPress={() => router.navigate('/profile')} style={styles.chip}>
            <Text style={styles.chipText}>Lv {stats?.level ?? 1}</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={list}
        data={items}
        keyExtractor={(i) => i.key}
        ListHeaderComponent={stats ? <StoriesBar stats={stats} /> : undefined}
        renderItem={({ item, index }) => (
          <CardView
            card={item.card}
            isNew={item.isNew}
            active={visible.has(item.key)}
            onAnswer={(correct, ms) => onAnswer(item, correct, ms)}
            onNext={() => next(index)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        onEndReached={() => loadMore()}
        onEndReachedThreshold={1.5}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={VIEWABILITY}
        onScrollToIndexFailed={({ index }) => list.current?.scrollToOffset({ offset: index * 500, animated: true })}
        ListFooterComponent={
          exhausted ? <CaughtUp onRetry={loadMore} /> : <ActivityIndicator color={colors.muted} style={{ margin: 32 }} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}

function CaughtUp({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.caught}>
      <View style={styles.caughtIcon}>
        <Text style={{ fontSize: 34, color: colors.good }}>✓</Text>
      </View>
      <Text style={styles.caughtTitle}>You're all caught up</Text>
      <Text style={styles.caughtText}>No reviews due and today's new cards are done. That's how the exam gets passed: a little every day.</Text>
      <Pressable style={styles.caughtBtn} onPress={() => router.push('/session/drill')}>
        <Text style={styles.caughtBtnText}>Bonus round: drill weak cards</Text>
      </Pressable>
      <Pressable onPress={onRetry}>
        <Text style={styles.caughtLink}>Check for new reviews</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8 },
  logo: { color: colors.text, fontSize: 26, fontWeight: '800', fontStyle: 'italic', letterSpacing: -0.5 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  sep: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  caught: { alignItems: 'center', padding: 28, gap: 10 },
  caughtIcon: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.good, alignItems: 'center', justifyContent: 'center' },
  caughtTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  caughtText: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
  caughtBtn: { backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 18, borderRadius: radius.md, marginTop: 6 },
  caughtBtnText: { color: '#fff', fontWeight: '800' },
  caughtLink: { color: colors.accent, fontWeight: '600', marginTop: 4 },
});
