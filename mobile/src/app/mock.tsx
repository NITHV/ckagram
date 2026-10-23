// Mock exam: 25 questions, 30 minutes, no feedback until you submit. Pass mark 66%, like the CKA.
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInRight, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DOMAIN_BY_ID, DOMAINS, type Card } from '@/content';
import { PASS_SCORE } from '@/content/labs';
import { MOCK_MINUTES, MOCK_SIZE, buildMock, loadMockRuns, type MockAnswer, type MockResult, type MockRun } from '@/engine/mock';
import { haptic } from '@/lib/haptics';
import { useProgress } from '@/state/progress';
import { feedSignals } from '@/state/useQueue';
import { CardView } from '@/ui/cards/CardView';
import { ProgressRing } from '@/ui/ProgressRing';
import { brand, colors, mono, radius } from '@/ui/theme';

type Phase = { kind: 'intro' } | { kind: 'running'; questions: Card[]; startedAt: number } | { kind: 'done'; result: MockResult };

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function MockExam() {
  const { stats, finishMock } = useProgress();
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });

  const start = () => {
    haptic.tap();
    setPhase({ kind: 'running', questions: buildMock(stats?.unlockedWeek ?? 1), startedAt: Date.now() });
  };

  const submit = useCallback(
    async (questions: Card[], answers: MockAnswer[], startedAt: number) => {
      const seconds = Math.min(MOCK_MINUTES * 60, Math.round((Date.now() - startedAt) / 1000));
      feedSignals.dirty = true;
      const result = await finishMock(questions, answers, seconds);
      setPhase({ kind: 'done', result });
    },
    [finishMock]
  );

  return (
    <SafeAreaView style={styles.screen}>
      {phase.kind === 'intro' && <Intro onStart={start} />}
      {phase.kind === 'running' && <Running questions={phase.questions} startedAt={phase.startedAt} onSubmit={submit} />}
      {phase.kind === 'done' && <Results result={phase.result} onAgain={() => setPhase({ kind: 'intro' })} />}
    </SafeAreaView>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  const db = useSQLiteContext();
  const [runs, setRuns] = useState<MockRun[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      loadMockRuns(db, 8).then(setRuns);
    }, [db])
  );
  const best = runs?.length ? Math.max(...runs.map((r) => r.score)) : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      <View style={styles.topRow}>
        <Text style={styles.h1}>Mock exam</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
      </View>

      <LinearGradient colors={[brand.gold + '33', brand.pink + '22', brand.blue + '33']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={{ fontSize: 44 }}>🎓</Text>
        <Text style={styles.heroTitle}>Exam conditions</Text>
        <View style={styles.rules}>
          {[
            ['help-circle-outline', `${MOCK_SIZE} questions, weighted like the real exam`],
            ['timer-outline', `${MOCK_MINUTES} minutes. The clock doesn't stop`],
            ['eye-off-outline', 'No answers shown until you submit'],
            ['ribbon-outline', `Pass mark ${PASS_SCORE}%. Misses come back in your reviews`],
          ].map(([icon, text]) => (
            <View key={text} style={styles.rule}>
              <Ionicons name={icon as any} size={18} color={colors.text} />
              <Text style={styles.ruleText}>{text}</Text>
            </View>
          ))}
        </View>
        <Pressable onPress={onStart} style={styles.primary}>
          <Text style={styles.primaryText}>Start the clock</Text>
        </Pressable>
      </LinearGradient>

      <Text style={styles.h2}>💻 Full laptop mock</Text>
      <View style={styles.box}>
        <Text style={styles.body}>Several broken labs at once on your kind cluster, one time limit, scored like the real thing. Scan the QR at the end.</Text>
        <View style={styles.cmd}>
          <Text style={styles.cmdText}>{'.\\ckalab mock        # 8 tasks, ~90 min\n.\\ckalab mock 4      # quick, ~40 min\n.\\ckalab check       # grade everything'}</Text>
        </View>
      </View>

      <Text style={styles.h2}>History {best !== null ? <Text style={styles.best}>· best {best}%</Text> : null}</Text>
      {runs === null && <ActivityIndicator color={colors.muted} />}
      {runs?.length === 0 && <Text style={styles.muted}>No mocks yet. Your first one sets the baseline.</Text>}
      {runs?.map((r) => (
        <View key={r.id} style={styles.run}>
          <Text style={{ fontSize: 20 }}>{r.kind === 'laptop' ? '💻' : '📱'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.runTitle}>
              {r.score}% {r.passed ? '· passed' : ''}
            </Text>
            <Text style={styles.runMeta}>
              {new Date(r.ts).toLocaleDateString()} · {r.correct}/{r.total} {r.kind === 'laptop' ? 'tasks' : 'right'} · {Math.round(r.seconds / 60)} min
            </Text>
          </View>
          <View style={[styles.scoreBar, { width: 70 }]}>
            <View style={[styles.scoreFill, { width: `${r.score}%`, backgroundColor: r.passed ? colors.good : colors.gold }]} />
            <View style={[styles.passTick, { left: `${PASS_SCORE}%` }]} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Running({ questions, startedAt, onSubmit }: { questions: Card[]; startedAt: number; onSubmit: (q: Card[], a: MockAnswer[], startedAt: number) => Promise<void> }) {
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(MOCK_MINUTES * 60_000);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const answers = useRef<MockAnswer[]>([]);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setSubmitting(true);
    onSubmit(questions, answers.current, startedAt);
  }, [onSubmit, questions, startedAt]);

  useEffect(() => {
    const t = setInterval(() => {
      const ms = MOCK_MINUTES * 60_000 - (Date.now() - startedAt);
      setLeft(ms);
      if (ms <= 0) {
        haptic.error();
        finish();
      }
    }, 500);
    return () => clearInterval(t);
  }, [startedAt, finish]);

  const current = questions[index];
  const answeredCount = answers.current.length;
  const low = left < 5 * 60_000;

  if (submitting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.muted} />
        <Text style={styles.muted}>Grading…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.examBar}>
        <View style={[styles.timer, low && { borderColor: colors.bad }]}>
          <Ionicons name="timer-outline" size={16} color={low ? colors.bad : colors.text} />
          <Text style={[styles.timerText, low && { color: colors.bad }]}>{clock(left)}</Text>
        </View>
        <Text style={styles.qCount}>
          {Math.min(index + 1, questions.length)} / {questions.length}
        </Text>
        <Pressable
          onPress={() => {
            haptic.tap();
            setConfirm(true);
          }}
          style={styles.submitBtn}
        >
          <Text style={styles.submitText}>Submit</Text>
        </Pressable>
      </View>
      <View style={styles.dots}>
        {questions.map((q, i) => (
          <View key={q.id} style={[styles.dot, i < index && styles.dotDone, i === index && styles.dotNow]} />
        ))}
      </View>

      {confirm && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.confirm}>
          <Text style={styles.confirmText}>
            Submit now? {questions.length - answeredCount} unanswered question{questions.length - answeredCount === 1 ? '' : 's'} will count as wrong.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={() => setConfirm(false)} style={[styles.smallBtn, { backgroundColor: colors.surface2 }]}>
              <Text style={styles.smallBtnText}>Keep going</Text>
            </Pressable>
            <Pressable onPress={finish} style={[styles.smallBtn, { backgroundColor: colors.accent }]}>
              <Text style={styles.smallBtnText}>Submit</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {current && (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Animated.View key={current.id} entering={SlideInRight.duration(200)}>
            <CardView
              card={current}
              isNew={false}
              active
              exam
              onAnswer={(correct) => {
                answers.current.push({ cardId: current.id, correct });
              }}
              onNext={() => {
                haptic.tap();
                if (index + 1 >= questions.length) finish();
                else setIndex(index + 1);
              }}
            />
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

function Results({ result, onAgain }: { result: MockResult; onAgain: () => void }) {
  const pbBefore = result.bestBefore;
  return (
    <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 40, alignItems: 'stretch' }}>
      <View style={{ alignItems: 'center', gap: 6, marginTop: 10 }}>
        <Animated.View entering={ZoomIn.springify().damping(9)}>
          <ProgressRing size={170} stroke={12} progress={result.score / 100} gradient={result.passed} color={colors.gold}>
            <Text style={styles.bigScore}>{result.score}%</Text>
            <Text style={styles.muted}>{result.correct}/{result.total} right</Text>
          </ProgressRing>
        </Animated.View>
        <Text style={[styles.verdict, { color: result.passed ? colors.good : colors.gold }]}>{result.passed ? 'PASS' : 'NOT YET'}</Text>
        <Text style={styles.muted}>
          Pass mark {PASS_SCORE}% · {Math.floor(result.seconds / 60)}m {result.seconds % 60}s · +{result.xp} XP
        </Text>
        {pbBefore !== null && result.score > pbBefore && <Text style={styles.pb}>📈 New best (was {pbBefore}%)</Text>}
      </View>

      <Text style={styles.h2}>By domain</Text>
      <View style={styles.box}>
        {DOMAINS.filter((d) => result.byDomain[d.id]).map((d) => {
          const s = result.byDomain[d.id]!;
          const pct = s.correct / s.total;
          return (
            <View key={d.id} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.domainName}>
                  {d.emoji} {d.short} <Text style={styles.muted}>({Math.round(d.weight * 100)}% of exam)</Text>
                </Text>
                <Text style={styles.domainScore}>
                  {s.correct}/{s.total}
                </Text>
              </View>
              <View style={styles.scoreBar}>
                <View style={[styles.scoreFill, { width: `${pct * 100}%`, backgroundColor: pct >= PASS_SCORE / 100 ? colors.good : d.color }]} />
              </View>
            </View>
          );
        })}
      </View>

      {result.missed.length > 0 && (
        <Pressable
          onPress={() => {
            haptic.tap();
            router.replace(`/session/ids-${result.missed.join(',')}`);
          }}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>Review {result.missed.length} misses now</Text>
        </Pressable>
      )}
      <Pressable onPress={onAgain} style={[styles.primary, { backgroundColor: colors.surface2 }]}>
        <Text style={styles.primaryText}>Back to mock home</Text>
      </Pressable>
      <Text style={[styles.muted, { textAlign: 'center' }]}>
        Missed cards you've studied are due again now. {DOMAIN_BY_ID.troubleshooting.emoji} Troubleshooting is 30% of the real exam: hit it on the laptop.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: colors.text, fontSize: 28, fontWeight: '900' },
  h2: { color: colors.text, fontSize: 17, fontWeight: '800' },
  best: { color: colors.gold, fontWeight: '800' },
  hero: { borderRadius: radius.lg, padding: 20, gap: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  rules: { alignSelf: 'stretch', gap: 10, marginVertical: 4 },
  rule: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  ruleText: { color: '#D9DEEA', fontSize: 14.5, flex: 1 },
  primary: { alignSelf: 'stretch', backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  box: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 12, borderWidth: 1, borderColor: colors.border },
  body: { color: '#D9DEEA', lineHeight: 20 },
  cmd: { backgroundColor: colors.terminal, borderRadius: radius.sm, padding: 12 },
  cmdText: { color: colors.terminalText, fontFamily: mono, fontSize: 13, lineHeight: 20 },
  muted: { color: colors.muted, fontSize: 13 },
  run: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12 },
  runTitle: { color: colors.text, fontWeight: '800' },
  runMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  scoreBar: { height: 8, borderRadius: 4, backgroundColor: colors.surface2, overflow: 'hidden' },
  scoreFill: { height: 8, borderRadius: 4 },
  passTick: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.text },
  examBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  timerText: { color: colors.text, fontFamily: mono, fontWeight: '700', fontSize: 15 },
  qCount: { color: colors.muted, fontWeight: '700', flex: 1, textAlign: 'center' },
  submitBtn: { backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  submitText: { color: colors.text, fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 3, paddingHorizontal: 14, marginBottom: 6 },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#2A2F45' },
  dotDone: { backgroundColor: colors.muted },
  dotNow: { backgroundColor: colors.text },
  confirm: { marginHorizontal: 14, marginBottom: 8, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 12 },
  confirmText: { color: colors.text, lineHeight: 20 },
  smallBtn: { flex: 1, borderRadius: radius.sm, paddingVertical: 11, alignItems: 'center' },
  smallBtnText: { color: '#fff', fontWeight: '800' },
  bigScore: { color: colors.text, fontSize: 40, fontWeight: '900' },
  verdict: { fontSize: 22, fontWeight: '900', letterSpacing: 3, marginTop: 6 },
  pb: { color: colors.gold, fontWeight: '800' },
  domainName: { color: colors.text, fontWeight: '700' },
  domainScore: { color: colors.text, fontWeight: '800' },
});
