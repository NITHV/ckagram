import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { REELS, type Reel } from '@/content/reels';
import { getMeta, setMeta } from '@/db/schema';
import { useProgress } from '@/state/progress';
import { ReelPlayer } from '@/ui/reels/ReelPlayer';
import { colors } from '@/ui/theme';

const VIEWABILITY = { itemVisiblePercentThreshold: 70 };

export default function Reels() {
  const db = useSQLiteContext();
  const { stats } = useProgress();
  const [order, setOrder] = useState<Reel[]>([]);
  const [height, setHeight] = useState(0);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(true);
  const [muted, setMuted] = useState(false);
  const { start } = useLocalSearchParams<{ start?: string }>();
  const list = useRef<FlatList<Reel>>(null);

  // Unseen reels from unlocked weeks first, then the ones you've seen longest ago.
  const load = useCallback(async () => {
    const views = await db.getAllAsync<{ reel_id: string; last_seen: number }>('SELECT reel_id, last_seen FROM reel_views');
    const seen = new Map(views.map((v) => [v.reel_id, v.last_seen]));
    const week = stats?.unlockedWeek ?? 1;
    const unlocked = REELS.filter((r) => r.week <= week + 1);
    const pool = unlocked.length ? unlocked : REELS;
    let next = [...pool.filter((r) => !seen.has(r.id)), ...pool.filter((r) => seen.has(r.id)).sort((a, b) => seen.get(a.id)! - seen.get(b.id)!)];
    // Opened from a tile in Explore: play that reel first.
    const picked = start ? REELS.find((r) => r.id === start) : undefined;
    if (picked) next = [picked, ...next.filter((r) => r.id !== picked.id)];
    setOrder(next);
    setActive(0);
    list.current?.scrollToOffset({ offset: 0, animated: false });
    setMuted((await getMeta(db, 'reels_muted')) === '1');
  }, [db, stats?.unlockedWeek, start]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        Speech.stop();
      };
    }, [])
  );

  const onViewable = useRef(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setActive(first.index);
  }).current;

  const onViewed = useCallback(
    (reelId: string, completed: boolean) => {
      const now = Date.now();
      db.runAsync(
        `INSERT INTO reel_views (reel_id, first_seen, last_seen, completions) VALUES (?, ?, ?, ?)
         ON CONFLICT(reel_id) DO UPDATE SET last_seen = excluded.last_seen, completions = completions + excluded.completions`,
        reelId,
        now,
        now,
        completed ? 1 : 0
      ).catch(() => {});
    },
    [db]
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      setMeta(db, 'reels_muted', m ? '0' : '1').catch(() => {});
      if (!m) Speech.stop();
      return !m;
    });
  }, [db]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ flex: 1 }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {height > 0 && (
          <FlatList
            ref={list}
            data={order}
            keyExtractor={(r) => r.id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
            onViewableItemsChanged={onViewable}
            viewabilityConfig={VIEWABILITY}
            windowSize={3}
            renderItem={({ item, index }) => (
              <ReelPlayer reel={item} height={height} active={focused && index === active} muted={muted} onToggleMute={toggleMute} onViewed={onViewed} />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
