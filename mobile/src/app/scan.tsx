// Scan the QR code `ckalab check` prints on the laptop.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { parseClaimUrl } from '@/engine/labs';
import { haptic } from '@/lib/haptics';
import { colors, radius } from '@/ui/theme';

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.title}>Camera access</Text>
        <Text style={styles.text}>CKAgram needs the camera to scan the QR code that ckalab check shows on your laptop.</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current) return;
          const params = parseClaimUrl(data);
          if (!params) {
            setError("That's not a CKAgram lab code.");
            return;
          }
          handled.current = true;
          haptic.success();
          router.replace({ pathname: '/claim', params: params as Record<string, string> });
        }}
      />
      <View style={styles.frame} pointerEvents="none" />
      <View style={styles.hint}>
        <Text style={styles.hintText}>{error ?? 'Point at the QR code from ckalab check'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  text: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
  btn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 24, marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '800' },
  frame: { position: 'absolute', top: '22%', alignSelf: 'center', width: 250, height: 250, borderRadius: 28, borderWidth: 3, borderColor: colors.gold },
  hint: { position: 'absolute', bottom: 70, alignSelf: 'center', backgroundColor: '#000a', paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.pill },
  hintText: { color: colors.text, fontWeight: '700' },
});
