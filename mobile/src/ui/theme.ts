import { Platform } from 'react-native';

export const colors = {
  bg: '#000000',
  surface: '#121212',
  surface2: '#1C1C1E',
  border: '#262626',
  text: '#F5F5F5',
  muted: '#A8A8A8',
  faint: '#6E6E6E',
  accent: '#0095F6',
  good: '#2FD38A',
  bad: '#FF3B5C',
  gold: '#FFC83D',
  terminal: '#0B0F14',
  terminalText: '#C9F7C5',
};

/** Instagram-style story ring gradient. */
export const ringGradient = ['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5'] as const;
export const bossGradient = ['#FFE29A', '#FFB020', '#FF6A00'] as const;

export const mono = Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' });

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };
