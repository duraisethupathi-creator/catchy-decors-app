import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Logo } from '../src/components/common/Logo';
import { useLogoSource } from '../src/context/SettingsContext';
import { colors } from '../src/constants/colors';
import { COMPANY } from '../src/constants/company';

export default function Splash() {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.86)).current;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
    Animated.timing(bar, { toValue: 1, duration: 1500, useNativeDriver: false }).start();

    const t = setTimeout(() => {
      router.replace('/(auth)/login');
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  const logoSource = useLogoSource();
  const width = Dimensions.get('window').width * 0.5;

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.center, { opacity: fade, transform: [{ scale }] }]}>
        <Logo size={110} light image={logoSource} />
        <Text style={styles.name}>CATCHY DECORS</Text>
        <Text style={styles.tag}>{COMPANY.tagline.toUpperCase()}</Text>
      </Animated.View>
      <View style={styles.loaderWrap}>
        <View style={[styles.loaderTrack, { width }]}>
          <Animated.View
            style={[
              styles.loaderBar,
              {
                width: bar.interpolate({ inputRange: [0, 1], outputRange: [0, width] }),
              },
            ]}
          />
        </View>
        <Text style={styles.loadText}>Loading…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: 4, marginTop: 20 },
  tag: { color: colors.gold, fontSize: 11, letterSpacing: 3, marginTop: 10, fontWeight: '600' },
  loaderWrap: { alignItems: 'center', paddingBottom: 70 },
  loaderTrack: { height: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  loaderBar: { height: 5, borderRadius: 999, backgroundColor: colors.orange },
  loadText: { color: 'rgba(255,255,255,0.6)', marginTop: 12, fontSize: 12, letterSpacing: 1 },
});
