import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, ringGradient } from './theme';

interface Props {
  size: number;
  stroke: number;
  /** 0–1 */
  progress: number;
  color?: string;
  /** Use the story gradient instead of a flat color. */
  gradient?: boolean;
  track?: string;
  children?: ReactNode;
}

export function ProgressRing({ size, stroke, progress, color = colors.accent, gradient, track = colors.border, children }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  const id = `g${size}${stroke}`;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {gradient && (
          <Defs>
            <LinearGradient id={id} x1="0" y1="1" x2="1" y2="0">
              {ringGradient.map((col, i) => (
                <Stop key={col} offset={i / (ringGradient.length - 1)} stopColor={col} />
              ))}
            </LinearGradient>
          </Defs>
        )}
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {p > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={gradient ? `url(#${id})` : color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - p)}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}
