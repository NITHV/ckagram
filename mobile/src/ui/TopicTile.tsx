// One topic in a grid: which domain it belongs to, how much has been seen, how well it is remembered.
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { DOMAIN_BY_ID } from '@/content';
import type { TopicStats } from '@/engine/progress';
import { colors, radius } from './theme';

export function TopicTile({ topic, onPress, style }: { topic: TopicStats; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const domain = DOMAIN_BY_ID[topic.domain];
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.tile, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: domain.color, opacity: 0.14, borderRadius: radius.sm }]} />
      {/* The domain label tells apart topics that share a name, such as "kubectl". */}
      <View style={styles.top}>
        <Text style={styles.emoji}>{domain.emoji}</Text>
        <Text style={[styles.domain, { color: domain.color }]} numberOfLines={1}>
          {domain.short}
        </Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {topic.topic}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(3, topic.mastery * 100)}%`, backgroundColor: domain.color }]} />
      </View>
      <Text style={styles.meta}>
        {topic.learned} of {topic.total} seen
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { minHeight: 104, borderRadius: radius.sm, padding: 9, gap: 5, justifyContent: 'space-between', backgroundColor: colors.surface, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  emoji: { fontSize: 14 },
  domain: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', flex: 1 },
  name: { color: colors.text, fontWeight: '800', fontSize: 13, lineHeight: 17, flex: 1 },
  track: { height: 4, borderRadius: 2, backgroundColor: '#FFFFFF1F', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  meta: { color: colors.muted, fontSize: 11 },
});
