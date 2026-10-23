import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ALL_CARDS, DOMAIN_BY_ID } from '@/content';
import { LABS } from '@/content/labs';
import { haptic } from '@/lib/haptics';
import { useProgress } from '@/state/progress';
import { brand, colors, mono, radius } from '@/ui/theme';

const fmt = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;

export default function Lab() {
  const { stats } = useProgress();
  const [open, setOpen] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const best = stats?.labBest ?? {};
  const unlocked = stats?.unlockedWeek ?? 1;
  const miniLabs = ALL_CARDS.filter((c) => c.type === 'cmd' || c.type === 'yaml').length;
  const done = LABS.filter((l) => best[l.id] !== undefined).length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 16, paddingBottom: 40 }}>
        <View style={styles.headerRow}>
          <Text style={styles.h1}>Lab</Text>
          <Text style={styles.count}>
            {done}/{LABS.length} cleared
          </Text>
        </View>

        <Pressable
          onPress={() => {
            haptic.tap();
            router.push('/scan');
          }}
        >
          <LinearGradient colors={[brand.gold, brand.pink, brand.blue]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.scan}>
            <Ionicons name="qr-code" size={34} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.scanTitle}>Scan to claim</Text>
              <Text style={styles.scanSub}>Cleared a lab on your laptop? Scan its QR code for XP.</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={() => {
            haptic.tap();
            router.push('/mock');
          }}
          style={styles.mock}
        >
          <Text style={{ fontSize: 30 }}>🎓</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.mockTitle}>Mock exam</Text>
            <Text style={styles.mockSub}>
              {stats?.mockLast
                ? `Last ${stats.mockLast.score}%${stats.mockLast.passed ? ' ✓ pass' : ''} · best ${stats.mockBest}% · ${stats.mockCount} taken`
                : 'Timed, no feedback until the end. Pass mark 66%.'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        <Text style={styles.h2}>💻 Laptop labs</Text>
        <View style={styles.list}>
          {LABS.map((l) => {
            const d = DOMAIN_BY_ID[l.domain];
            const cleared = best[l.id] !== undefined;
            const ahead = l.week > unlocked + 1;
            const isOpen = open === l.id;
            return (
              <Pressable
                key={l.id}
                onPress={() => {
                  haptic.tap();
                  setOpen(isOpen ? null : l.id);
                }}
                style={[styles.lab, ahead && { opacity: 0.5 }]}
              >
                <View style={styles.labRow}>
                  <View style={[styles.labIcon, { backgroundColor: d.color + '26', borderColor: cleared ? colors.good : d.color + '66' }]}>
                    <Text style={{ fontSize: 18 }}>{cleared ? '✅' : l.boss ? '👑' : d.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labTitle}>{l.title}</Text>
                    <Text style={styles.labMeta}>
                      Week {l.week} · {d.short} · +{l.xp} XP
                    </Text>
                  </View>
                  <Text style={[styles.labTime, cleared && { color: colors.good }]}>{cleared ? fmt(best[l.id]) : `${l.minutes}m`}</Text>
                </View>
                {isOpen && (
                  <Animated.View entering={FadeIn.duration(180)} style={styles.labMore}>
                    <Text style={styles.labSummary}>{l.summary}</Text>
                    <View style={styles.cmd}>
                      <Text style={styles.cmdText}>.\ckalab start {l.id}</Text>
                    </View>
                    <Text style={styles.labHint}>Run it in the CKAgram folder on your laptop, fix it, then `ckalab check`.</Text>
                  </Animated.View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={() => setShowSetup((s) => !s)} style={styles.setupHead}>
          <Text style={styles.h3}>First time on the laptop?</Text>
          <Ionicons name={showSetup ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </Pressable>
        {showSetup && (
          <View style={styles.setup}>
            {[
              ['Install Docker Desktop and start it', null],
              ['Install kind', 'winget install Kubernetes.kind'],
              ['Create the practice cluster (once)', '.\\ckalab up'],
              ['Pick a lab', '.\\ckalab list'],
              ['Start, fix, verify', '.\\ckalab start first-deploy\n.\\ckalab check'],
            ].map(([step, cmd], i) => (
              <View key={i} style={{ gap: 6 }}>
                <Text style={styles.step}>
                  {i + 1}. {step}
                </Text>
                {cmd && (
                  <View style={styles.cmd}>
                    <Text style={styles.cmdText}>{cmd}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <Text style={styles.h2}>📱 Phone mini-labs</Text>
        <Pressable
          style={styles.mini}
          onPress={() => {
            haptic.tap();
            router.push('/session/labs');
          }}
        >
          <Text style={styles.term}>$ kubectl get skills</Text>
          <Text style={styles.miniText}>{miniLabs} kubectl builders and broken manifests. Fast answers earn 1.5× XP.</Text>
          <View style={styles.primary}>
            <Text style={styles.primaryText}>Start a round</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mock: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.border },
  mockTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
  mockSub: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
  screen: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  h1: { color: colors.text, fontSize: 28, fontWeight: '900' },
  count: { color: colors.muted, fontWeight: '700' },
  h2: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 4 },
  h3: { color: colors.text, fontSize: 15, fontWeight: '800' },
  scan: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg, padding: 18 },
  scanTitle: { color: '#fff', fontSize: 19, fontWeight: '900' },
  scanSub: { color: '#FFFFFFDD', fontSize: 13, marginTop: 2 },
  list: { gap: 8 },
  lab: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border },
  labRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  labIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  labTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  labMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  labTime: { color: colors.muted, fontWeight: '800', fontSize: 13 },
  labMore: { marginTop: 10, gap: 8 },
  labSummary: { color: '#D9DEEA', lineHeight: 20 },
  labHint: { color: colors.faint, fontSize: 12 },
  cmd: { backgroundColor: colors.terminal, borderRadius: radius.sm, padding: 10, borderWidth: 1, borderColor: '#1F3326' },
  cmdText: { color: colors.terminalText, fontFamily: mono, fontSize: 13 },
  setupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  setup: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 12 },
  step: { color: colors.text, fontWeight: '700' },
  mini: { backgroundColor: colors.terminal, borderRadius: radius.lg, padding: 18, gap: 8, borderWidth: 1, borderColor: '#1F3326' },
  term: { color: colors.good, fontFamily: mono, fontSize: 13 },
  miniText: { color: colors.muted, lineHeight: 20 },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
