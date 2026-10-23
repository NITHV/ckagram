import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { migrate } from '@/db/schema';
import { CelebrateProvider } from '@/state/celebrate';
import { MarksProvider } from '@/state/marks';
import { ProgressProvider } from '@/state/progress';
import { colors } from '@/ui/theme';

const pushed = { headerShown: true, headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, headerShadowVisible: false } as const;

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="ckagram.db" onInit={migrate}>
      <CelebrateProvider>
        <ProgressProvider>
          <MarksProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="session/[mode]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="activity" options={{ ...pushed, title: 'Activity' }} />
              <Stack.Screen name="scan" options={{ ...pushed, title: 'Scan lab QR' }} />
              <Stack.Screen name="claim" options={{ ...pushed, title: 'Lab claim', animation: 'fade' }} />
            </Stack>
          </MarksProvider>
        </ProgressProvider>
      </CelebrateProvider>
    </SQLiteProvider>
  );
}
