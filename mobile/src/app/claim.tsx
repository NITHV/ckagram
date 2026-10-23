// Lands here from the in-app scanner, or straight from the phone camera via the ckagram:// link.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { DOMAIN_BY_ID } from '@/content';
import type { ClaimParams, ClaimResult } from '@/engine/labs';
import { LAB_BY_ID } from '@/content/labs';
import { useProgress } from '@/state/progress';
import { colors, radius } from '@/ui/theme';

export default function ClaimScreen() {
  const params = useLocalSearchParams<Required<ClaimParams>>();
  const { claim } = useProgress();
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    claim(params)
      .then(setResult)
      .catch((e: Error) => setError(e.message));
  }, [claim, params]);

  const lab = params.l ? LAB_BY_ID[params.l] : undefined;
  const secs = Number(params.s);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 52 }}>🤔</Text>
        <Text style={styles.title}>Couldn't claim this one</Text>
        <Text style={styles.text}>{error}</Text>
        <Pressable style={styles.btn} onPress={() => router.replace('/lab')}>
          <Text style={styles.btnText}>Back to Lab</Text>
        </Pressable>
      </View>
    );
  }
  if (!result || !lab) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }

  const domain = DOMAIN_BY_ID[lab.domain];
  return (
    <View style={styles.center}>
      <Animated.Text entering={ZoomIn.springify().damping(8)} style={{ fontSize: 72 }}>
        {lab.boss ? '👑' : '🧪'}
      </Animated.Text>
      <Text style={styles.kicker}>{result.firstClear ? 'LAB CLEARED' : 'CLEARED AGAIN'}</Text>
      <Text style={styles.title}>{lab.title}</Text>
      <Text style={[styles.text, { color: domain.color }]}>
        {domain.emoji} {domain.short} · {Math.floor(secs / 60)}m {secs % 60}s
      </Text>
      <Animated.Text entering={ZoomIn.delay(250)} style={styles.xp}>
        +{result.xp.total} XP
      </Animated.Text>
      <View style={styles.badges}>
        {result.underTarget && <Text style={styles.badge}>⚡ Under {lab.minutes} min</Text>}
        {result.personalBest && <Text style={styles.badge}>⏱️ Personal best</Text>}
      </View>
      <Pressable style={styles.btn} onPress={() => router.replace('/lab')}>
        <Text style={styles.btnText}>Next lab</Text>
      </Pressable>
      <Pressable onPress={() => router.replace('/')}>
        <Text style={styles.link}>Back to feed</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  kicker: { color: colors.gold, fontWeight: '900', letterSpacing: 2, fontSize: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  text: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
  xp: { color: colors.gold, fontSize: 44, fontWeight: '900', marginVertical: 8 },
  badges: { flexDirection: 'row', gap: 8 },
  badge: { color: colors.text, backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, fontWeight: '700', overflow: 'hidden' },
  btn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 28, marginTop: 14 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  link: { color: colors.accent, fontWeight: '700', marginTop: 6 },
});
