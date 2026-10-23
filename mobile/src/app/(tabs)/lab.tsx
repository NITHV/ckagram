import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ALL_CARDS } from '@/content';
import { haptic } from '@/lib/haptics';
import { colors, mono, radius } from '@/ui/theme';

export default function Lab() {
  const cmd = ALL_CARDS.filter((c) => c.type === 'cmd').length;
  const yaml = ALL_CARDS.filter((c) => c.type === 'yaml').length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 16, paddingBottom: 40 }}>
        <Text style={styles.h1}>Lab</Text>

        <View style={styles.hero}>
          <Text style={styles.term}>$ kubectl get skills</Text>
          <Text style={styles.heroTitle}>Phone mini-labs</Text>
          <Text style={styles.heroText}>
            {cmd} kubectl builders and {yaml} broken manifests. Fast answers earn 1.5× XP because the exam is a race.
          </Text>
          <Pressable
            style={styles.primary}
            onPress={() => {
              haptic.tap();
              router.push('/session/labs');
            }}
          >
            <Text style={styles.primaryText}>Start a lab round ⏎</Text>
          </Pressable>
        </View>

        <View style={styles.soon}>
          <Text style={styles.soonTag}>COMING · WEEK 3</Text>
          <Text style={styles.soonTitle}>💻 Laptop labs</Text>
          <Text style={styles.soonText}>
            Real broken clusters on your PC (kind). Fix it, the checker verifies the cluster state, then scan the QR code it shows to claim your XP here.
          </Text>
        </View>

        <View style={styles.tip}>
          <Text style={styles.tipTitle}>Exam tip</Text>
          <Text style={styles.tipText}>
            The real exam is about 2 hours of hands-on tasks in a terminal. Phone labs build recall; the laptop labs build speed. You need both.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 26, fontWeight: '800' },
  hero: { backgroundColor: colors.terminal, borderRadius: radius.lg, padding: 18, gap: 10, borderWidth: 1, borderColor: '#1F3326' },
  term: { color: colors.good, fontFamily: mono, fontSize: 13 },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  heroText: { color: colors.muted, lineHeight: 20 },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  soon: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, gap: 8, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  soonTag: { color: colors.gold, fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  soonTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  soonText: { color: colors.muted, lineHeight: 20 },
  tip: { padding: 4, gap: 4 },
  tipTitle: { color: colors.text, fontWeight: '800' },
  tipText: { color: colors.muted, lineHeight: 20 },
});
