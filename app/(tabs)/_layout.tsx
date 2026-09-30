import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/colors';
import { AuthProvider } from '../../src/context/AuthContext';

function TabIcon({ name, label, focused }: { name: keyof typeof Ionicons.glyphMap; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 6 }}>
      <Ionicons name={name} size={22} color={focused ? colors.gold : 'rgba(255,255,255,0.65)'} />
      <Text style={{ fontSize: 10, color: focused ? colors.gold : 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: focused ? '800' : '500' }}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <AuthProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.navy,
            height: 62,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            position: 'absolute',
            elevation: 10,
          },
          tabBarActiveTintColor: colors.gold,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{ tabBarLabel: '', tabBarIcon: ({ focused }) => <TabIcon name="home" label="Home" focused={focused} /> }}
        />
        <Tabs.Screen
          name="customers"
          options={{ tabBarLabel: '', tabBarIcon: ({ focused }) => <TabIcon name="people" label="Customers" focused={focused} /> }}
        />
        <Tabs.Screen
          name="quotations"
          options={{ tabBarLabel: '', tabBarIcon: ({ focused }) => <TabIcon name="document-text" label="Quotation" focused={focused} /> }}
        />
        <Tabs.Screen
          name="reports"
          options={{ tabBarLabel: '', tabBarIcon: ({ focused }) => <TabIcon name="bar-chart" label="Reports" focused={focused} /> }}
        />
        <Tabs.Screen
          name="settings"
          options={{ tabBarLabel: '', tabBarIcon: ({ focused }) => <TabIcon name="settings" label="Settings" focused={focused} /> }}
        />
      </Tabs>
    </AuthProvider>
  );
}

export const unstable_settings = { initialRouteName: 'dashboard' };

const styles = StyleSheet.create({});
