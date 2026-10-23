import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { migrate } from '@/db/schema';
import { CelebrateProvider } from '@/state/celebrate';
import { ProgressProvider } from '@/state/progress';
import { colors } from '@/ui/theme';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="ckagram.db" onInit={migrate}>
      <CelebrateProvider>
        <ProgressProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="session/[mode]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          </Stack>
        </ProgressProvider>
      </CelebrateProvider>
    </SQLiteProvider>
  );
}
