import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useProgress } from '@/state/progress';
import { colors } from '@/ui/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(active: IconName, inactive: IconName, size = 27) {
  return ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color as string} />
  );
}

export default function TabsLayout() {
  const { stats } = useProgress();
  const due = stats?.dueTotal ?? 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: icon('home', 'home-outline'),
          tabBarBadge: due > 0 ? due : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.bad, fontSize: 10 },
        }}
      />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: icon('search', 'search-outline') }} />
      <Tabs.Screen name="lab" options={{ title: 'Lab', tabBarIcon: icon('add-circle', 'add-circle-outline', 30) }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: icon('heart', 'heart-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle', 'person-circle-outline', 29) }} />
    </Tabs>
  );
}
