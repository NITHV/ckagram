import { Image, type ImageStyle, type StyleProp } from 'react-native';

const WORDMARK = require('../../assets/brand/wordmark.png');
const MARK = require('../../assets/brand/mark.png');

/** "CKAgram" wordmark; 640×180 source. */
export function Wordmark({ height = 30, style }: { height?: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={WORDMARK} style={[{ height, width: (height * 640) / 180 }, style]} resizeMode="contain" accessibilityLabel="CKAgram" />;
}

/** Square logo tile. */
export function Mark({ size = 40, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={MARK} style={[{ width: size, height: size, borderRadius: size * 0.23 }, style]} />;
}
