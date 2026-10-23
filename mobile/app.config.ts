import type { ExpoConfig } from 'expo/config';

// CI sets BUILD_NUMBER so every APK has a higher versionCode and installs over the last one.
const buildNumber = Number(process.env.BUILD_NUMBER ?? 1);

const config: ExpoConfig = {
  name: 'CKAgram',
  slug: 'ckagram',
  scheme: 'ckagram',
  version: `0.2.${buildNumber}`,
  orientation: 'portrait',
  icon: './assets/brand/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#000000',
  android: {
    package: 'com.nithv.ckagram',
    versionCode: buildNumber,
    adaptiveIcon: {
      backgroundImage: './assets/brand/android-icon-background.png',
      foregroundImage: './assets/brand/android-icon-foreground.png',
      monochromeImage: './assets/brand/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    [
      'expo-splash-screen',
      { image: './assets/brand/splash-icon.png', imageWidth: 180, backgroundColor: '#000000' },
    ],
    ['expo-camera', { cameraPermission: 'CKAgram uses the camera to scan lab QR codes.', barcodeScannerEnabled: true }],
    './plugins/withReleaseSigning',
  ],
  experiments: { typedRoutes: true },
};

export default config;
