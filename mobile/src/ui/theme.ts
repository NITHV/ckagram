import { Platform } from 'react-native';

// Brand palette from the Level-Up Stack logo: gold → pink → blue on deep navy.
export const brand = {
  gold: '#FFB020',
  goldLight: '#FFE08A',
  pink: '#FF4F79',
  pinkLight: '#FFA3BC',
  blue: '#3D7BFF',
  blueLight: '#A9C4FF',
  navy: '#101426',
};

export const colors = {
  bg: '#05060B',
  surface: '#0F1220',
  surface2: '#181C2F',
  border: '#22273B',
  text: '#F4F6FB',
  muted: '#9AA3B8',
  faint: '#5E6680',
  accent: brand.blue,
  good: '#2FD38A',
  bad: '#FF4F5E',
  gold: brand.gold,
  pink: brand.pink,
  terminal: '#0A0E16',
  terminalText: '#C9F7C5',
};

/** Story ring / highlight gradient: the three logo cubes. */
export const ringGradient = [brand.gold, brand.pink, brand.blue] as const;
export const bossGradient = ['#FFE29A', '#FFB020', '#FF6A00'] as const;

export const mono = Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' });

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };
