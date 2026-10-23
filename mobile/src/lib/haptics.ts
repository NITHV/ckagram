import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Android's recommended haptics API feels much crisper than the vibrator fallback.
function run(android: Haptics.AndroidHaptics, other: () => Promise<void>) {
  const p = Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(android) : other();
  p.catch(() => {});
}

export const haptic = {
  tap: () => run(Haptics.AndroidHaptics.Keyboard_Tap, () => Haptics.selectionAsync()),
  success: () => run(Haptics.AndroidHaptics.Confirm, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run(Haptics.AndroidHaptics.Reject, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  big: () => run(Haptics.AndroidHaptics.Long_Press, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
};
