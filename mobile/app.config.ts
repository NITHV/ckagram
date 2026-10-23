import type { ExpoConfig } from 'expo/config';

// CI sets BUILD_NUMBER so every APK has a higher versionCode and installs over the last one.
const buildNumber = Number(process.env.BUILD_NUMBER ?? 1);

const config: ExpoConfig = {
  name: 'CKAgram',
  slug: 'ckagram',
  scheme: 'ckagram',
  version: `0.1.${buildNumber}`,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#000000',
  android: {
    package: 'com.nithv.ckagram',
    versionCode: buildNumber,
    adaptiveIcon: {
      backgroundColor: '#000000',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: ['expo-router', 'expo-sqlite', './plugins/withReleaseSigning'],
  experiments: { typedRoutes: true },
};

export default config;
