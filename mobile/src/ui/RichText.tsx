import { Text, type TextStyle, type StyleProp } from 'react-native';
import { colors, mono } from './theme';

/** Renders `backtick` spans as inline code. */
export function RichText({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const parts = children.split('`');
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ fontFamily: mono, color: colors.terminalText, backgroundColor: '#1E2A22' }}>
            {` ${p} `}
          </Text>
        ) : (
          p
        )
      )}
    </Text>
  );
}
