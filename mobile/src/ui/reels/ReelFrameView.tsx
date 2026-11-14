// Renders one reel frame with its entrance animation.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInLeft, ZoomIn } from 'react-native-reanimated';
import type { ReelFrame } from '@/content/reels';
import { colors, mono, radius } from '../theme';

/** **bold** → gold highlight, `code` → mono. */
function Rich({ text, style }: { text: string; style: object }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.startsWith('**') ? (
          <Text key={i} style={{ color: colors.gold }}>
            {p.slice(2, -2)}
          </Text>
        ) : p.startsWith('`') ? (
          <Text key={i} style={{ fontFamily: mono, color: colors.terminalText, fontSize: 20 }}>
            {p.slice(1, -1)}
          </Text>
        ) : (
          p
        )
      )}
    </Text>
  );
}

function Typing({ lines }: { lines: string[] }) {
  const full = lines.join('\n');
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => setN((x) => (x >= full.length ? x : x + 2)), 28);
    return () => clearInterval(id);
  }, [full]);
  const shown = full.slice(0, n).split('\n');
  return (
    <View style={styles.terminal}>
      <View style={styles.dots}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
          <View key={c} style={[styles.dot, { backgroundColor: c }]} />
        ))}
      </View>
      {shown.map((l, i) => (
        <Text key={i} style={[styles.code, l.startsWith('$') ? { color: colors.terminalText } : { color: '#9FB3C8' }]}>
          {l}
          {i === shown.length - 1 && n < full.length ? '▌' : ''}
        </Text>
      ))}
    </View>
  );
}

export function ReelFrameView({ frame, accent }: { frame: ReelFrame; accent: string }) {
  switch (frame.kind) {
    case 'hook':
      return (
        <View style={styles.center}>
          {frame.emoji && (
            <Animated.Text entering={ZoomIn.springify().damping(9)} style={styles.emoji}>
              {frame.emoji}
            </Animated.Text>
          )}
          <Animated.Text entering={FadeInDown.delay(150).duration(400)} style={styles.hook}>
            {frame.text}
          </Animated.Text>
          {frame.sub && (
            <Animated.Text entering={FadeIn.delay(700)} style={[styles.sub, { color: accent }]}>
              {frame.sub}
            </Animated.Text>
          )}
        </View>
      );
    case 'say':
      return (
        <Animated.View entering={FadeInDown.duration(380)} style={styles.center}>
          <Rich text={frame.text} style={styles.say} />
        </Animated.View>
      );
    case 'code':
      return (
        <View style={styles.center}>
          <Animated.View entering={ZoomIn.duration(250)} style={{ alignSelf: 'stretch' }}>
            <Typing lines={frame.lines} />
          </Animated.View>
          {frame.caption && (
            <Animated.Text entering={FadeIn.delay(500)} style={[styles.caption, { color: accent }]}>
              {frame.caption}
            </Animated.Text>
          )}
        </View>
      );
    case 'flow':
      return (
        <View style={styles.center}>
          {frame.caption && <Text style={[styles.caption, { color: accent, marginBottom: 14 }]}>{frame.caption}</Text>}
          {frame.nodes.map((n, i) => (
            <Animated.View key={n} entering={FadeInDown.delay(i * 550).duration(350)} style={{ alignItems: 'center' }}>
              {i > 0 && <Text style={styles.arrow}>↓</Text>}
              <View style={[styles.node, { borderColor: accent }]}>
                <Text style={styles.nodeText}>{n}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      );
    case 'list':
      return (
        <View style={styles.center}>
          <Text style={styles.listTitle}>{frame.title}</Text>
          {frame.items.map((it, i) => (
            <Animated.View key={it} entering={FadeInLeft.delay(250 + i * 450).duration(300)} style={styles.listItem}>
              <View style={[styles.bullet, { backgroundColor: accent }]} />
              <Text style={styles.listText}>{it}</Text>
            </Animated.View>
          ))}
        </View>
      );
    case 'versus':
      return (
        <View style={[styles.center, { flexDirection: 'row', gap: 12, alignItems: 'stretch' }]}>
          {[frame.left, frame.right].map((s, i) => (
            <Animated.View key={s.title} entering={ZoomIn.delay(i * 350).duration(300)} style={[styles.vs, i === 0 ? { borderColor: accent } : { borderColor: colors.gold }]}>
              <Text style={styles.vsTitle}>{s.title}</Text>
              <Text style={styles.vsText}>{s.text}</Text>
            </Animated.View>
          ))}
        </View>
      );
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 22 },
  emoji: { fontSize: 76, marginBottom: 12 },
  hook: { color: colors.text, fontSize: 32, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, lineHeight: 38 },
  sub: { fontSize: 18, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  say: { color: colors.text, fontSize: 27, fontWeight: '800', textAlign: 'center', lineHeight: 36 },
  terminal: { backgroundColor: colors.terminal, borderRadius: radius.md, padding: 16, paddingTop: 12, borderWidth: 1, borderColor: '#1F2A3A', minHeight: 120 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  code: { fontFamily: mono, fontSize: 15, lineHeight: 23 },
  caption: { fontSize: 16, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  arrow: { color: colors.muted, fontSize: 22, marginVertical: 4 },
  node: { borderWidth: 2, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 22, backgroundColor: '#0009' },
  nodeText: { color: colors.text, fontWeight: '800', fontSize: 18 },
  listTitle: { color: colors.text, fontSize: 24, fontWeight: '900', marginBottom: 18, textAlign: 'center' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', marginVertical: 7 },
  bullet: { width: 10, height: 10, borderRadius: 5 },
  listText: { color: colors.text, fontSize: 19, fontWeight: '700', flex: 1 },
  vs: { flex: 1, borderWidth: 2, borderRadius: radius.lg, padding: 16, justifyContent: 'center', backgroundColor: '#0009', maxHeight: 220 },
  vsTitle: { color: colors.text, fontWeight: '900', fontSize: 19, marginBottom: 8 },
  vsText: { color: '#D9DEEA', fontSize: 16, lineHeight: 22 },
});
