// The reward layer: XP pops, win toasts and confetti, drawn above every screen.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Celebration } from '@/engine/record';
import type { XpBreakdown } from '@/engine/rewards';
import { haptic } from '@/lib/haptics';
import { colors, radius } from '@/ui/theme';

type CelebrateFn = (result: { xp?: XpBreakdown; celebrations: Celebration[] }) => void;
const CelebrateContext = createContext<CelebrateFn>(() => {});

export function useCelebrate() {
  return useContext(CelebrateContext);
}

interface Toast extends Celebration {
  id: number;
}

let nextId = 1;

export function CelebrateProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [pop, setPop] = useState<{ id: number; text: string; sub?: string } | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const queue = useRef<Toast[]>([]);
  const showing = useRef(false);

  const showNext = useCallback(() => {
    const t = queue.current.shift();
    if (!t) {
      showing.current = false;
      setToast(null);
      return;
    }
    showing.current = true;
    setToast(t);
    if (t.big) {
      haptic.big();
      setConfettiKey((k) => k + 1);
    }
    setTimeout(showNext, t.big ? 2600 : 1800);
  }, []);

  const celebrate = useCallback<CelebrateFn>(
    (result) => {
      if (result.xp && result.xp.total > 0) {
        const tags = [result.xp.fast && 'fast', result.xp.multiplier > 1 && `×${result.xp.multiplier}`].filter(Boolean);
        setPop({ id: nextId++, text: `+${result.xp.total} XP`, sub: tags.join(' · ') || undefined });
      }
      queue.current.push(...result.celebrations.map((c) => ({ ...c, id: nextId++ })));
      if (!showing.current) showNext();
    },
    [showNext]
  );

  return (
    <CelebrateContext.Provider value={celebrate}>
      {children}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {confettiKey > 0 && <Confetti key={confettiKey} />}
        {pop && <XpPop key={pop.id} text={pop.text} sub={pop.sub} />}
        {toast && <WinToast key={toast.id} toast={toast} />}
      </View>
    </CelebrateContext.Provider>
  );
}

function WinToast({ toast }: { toast: Toast }) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(14)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.toast, { top: insets.top + 8 }, toast.big && styles.toastBig]}
    >
      <Text style={styles.toastEmoji}>{toast.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.toastTitle}>{toast.title}</Text>
        {!!toast.detail && <Text style={styles.toastDetail}>{toast.detail}</Text>}
      </View>
    </Animated.View>
  );
}

function XpPop({ text, sub }: { text: string; sub?: string }) {
  const y = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);
  useEffect(() => {
    opacity.value = withSequence(withTiming(1, { duration: 120 }), withDelay(700, withTiming(0, { duration: 300 })));
    scale.value = withSequence(withTiming(1.15, { duration: 160 }), withTiming(1, { duration: 120 }));
    y.value = withTiming(-90, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [opacity, scale, y]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }, { scale: scale.value }],
  }));
  return (
    <Animated.View style={[styles.pop, style]}>
      <Text style={styles.popText}>{text}</Text>
      {!!sub && <Text style={styles.popSub}>{sub}</Text>}
    </Animated.View>
  );
}

const CONFETTI_COLORS = ['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5', '#2FD38A', '#0095F6'];
const { width: W, height: H } = Dimensions.get('window');

function Confetti() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 1800, easing: Easing.linear });
  }, [t]);
  const pieces = useRef(
    Array.from({ length: 48 }, (_, i) => ({
      x: W / 2 + (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * W * 1.4,
      vy: -(H * 0.55 + Math.random() * H * 0.45),
      spin: (Math.random() - 0.5) * 1440,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 6,
    }))
  ).current;
  return (
    <>
      {pieces.map((p, i) => (
        <Piece key={i} t={t} {...p} />
      ))}
    </>
  );
}

function Piece({ t, x, vx, vy, spin, color, size }: { t: SharedValue<number>; x: number; vx: number; vy: number; spin: number; color: string; size: number }) {
  const style = useAnimatedStyle(() => {
    const s = t.value;
    const g = H * 2.2;
    return {
      opacity: s < 0.8 ? 1 : (1 - s) * 5,
      transform: [
        { translateX: x + vx * s },
        { translateY: H * 0.62 + vy * s + 0.5 * g * s * s },
        { rotate: `${spin * s}deg` },
      ],
    };
  });
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size * 0.5, backgroundColor: color, borderRadius: 2 }, style]} />;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toastBig: { borderColor: colors.gold },
  toastEmoji: { fontSize: 28 },
  toastTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  toastDetail: { color: colors.muted, fontSize: 13, marginTop: 2 },
  pop: { position: 'absolute', alignSelf: 'center', top: '58%', alignItems: 'center' },
  popText: { color: colors.gold, fontSize: 34, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 8 },
  popSub: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 2 },
});
