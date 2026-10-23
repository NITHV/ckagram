import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { colors, ringGradient } from './theme';

/** Avatar with a gradient ring when "unseen", a thin gray ring when not. */
export function StoryRing({ size, active, children, thickness = 2.5 }: { size: number; active: boolean; children: ReactNode; thickness?: number }) {
  const inner = size - thickness * 2;
  const content = (
    <View
      style={{
        width: inner,
        height: inner,
        borderRadius: inner / 2,
        borderWidth: Math.max(2, thickness),
        borderColor: colors.bg,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
  if (!active) {
    return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>{content}</View>;
  }
  return (
    <LinearGradient colors={ringGradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      {content}
    </LinearGradient>
  );
}
