import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { can } from '../../src/services/permissions';

function TabIcon({ name, label, focused, desktop }: { name: keyof typeof Ionicons.glyphMap; label: string; focused: boolean; desktop: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: desktop ? 'row' : 'column', paddingTop: desktop ? 0 : 5, paddingHorizontal: desktop ? 18 : 0, minWidth: desktop ? 190 : 58, minHeight: desktop ? 48 : 44 }}>
      <Ionicons name={name} size={22} color={focused ? colors.gold : 'rgba(255,255,255,0.65)'} />
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={{ fontSize: desktop ? 13 : 9.5, color: focused ? colors.gold : 'rgba(255,255,255,0.65)', marginLeft: desktop ? 12 : 0, marginTop: desktop ? 0 : 2, fontWeight: focused ? '800' : '500', textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
}

function RoleAwareTabs() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const adminView = can(user?.role, 'profit.view');
  const adminSettings = can(user?.role, 'settings.manage');
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: desktop ? 'left' : 'bottom',
        tabBarStyle: desktop
          ? { backgroundColor: colors.navy, width: 230, borderTopWidth: 0, elevation: 8, paddingTop: 28, paddingHorizontal: 10 }
          : { backgroundColor: colors.navy, height: 62, borderTopLeftRadius: 20, borderTopRightRadius: 20, position: 'absolute', elevation: 10 },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.65)',
        tabBarItemStyle: desktop ? { alignItems: 'flex-start', justifyContent: 'center', height: 54 } : undefined,
        tabBarLabelStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ tabBarLabel: '', tabBarIcon: ({ focused }) => <TabIcon name="home" label="Dashboard" focused={focused} desktop={desktop} /> }} />
      <Tabs.Screen name="customers" options={{ tabBarLabel: '', tabBarIcon: ({ focused }) => <TabIcon name="people" label="Customers" focused={focused} desktop={desktop} /> }} />
      <Tabs.Screen name="quotations" options={{ tabBarLabel: '', tabBarIcon: ({ focused }) => <TabIcon name="document-text" label="Quotations" focused={focused} desktop={desktop} /> }} />
      <Tabs.Screen name="reports" options={{ href: adminView ? undefined : null, tabBarLabel: '', tabBarIcon: ({ focused }) => <TabIcon name="bar-chart" label="Reports" focused={focused} desktop={desktop} /> }} />
      <Tabs.Screen name="settings" options={{ href: adminSettings ? undefined : null, tabBarLabel: '', tabBarIcon: ({ focused }) => <TabIcon name="settings" label="Settings" focused={focused} desktop={desktop} /> }} />
    </Tabs>
  );
}

export default function TabsLayout() {
  return <RoleAwareTabs />;
}

export const unstable_settings = { initialRouteName: 'dashboard' };

const styles = StyleSheet.create({});
