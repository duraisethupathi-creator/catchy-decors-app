import React from 'react';
import { Image, Text, View, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';
import { COMPANY } from '../../constants/company';

/**
 * Brand logo.
 * If `image` prop is supplied, renders the uploaded brand logo image.
 * Otherwise falls back to a pure-text "CD" monogram (offline-safe).
 */
export function Logo({
  size = 56,
  light = false,
  image,
}: {
  size?: number;
  light?: boolean;
  image?: any;
}) {
  if (image) {
    return (
      <Image
        source={image}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
        resizeMode="contain"
      />
    );
  }
  return (
    <View
      style={[
        logoStyles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size * 0.24,
          backgroundColor: light ? '#FFFFFF' : colors.navy,
        },
      ]}
    >
      <Text style={[logoStyles.mark, { fontSize: size * 0.32, color: light ? colors.navy : colors.gold }]}>CD</Text>
    </View>
  );
}

/** Brand block (logo + wordmark + tagline) — uses uploaded image when available. */
export function BrandBlock({ light = false, image }: { light?: boolean; image?: any }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Logo size={72} light={light} image={image} />
      <Text style={[logoStyles.name, { color: light ? '#FFFFFF' : colors.navy }]}>CATCHY DECORS</Text>
      <Text style={[logoStyles.tag, { color: light ? colors.gold : colors.orange }]}>
        {COMPANY.tagline.toUpperCase()}
      </Text>
    </View>
  );
}

const logoStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', elevation: 6 },
  mark: { fontWeight: '900', letterSpacing: 1 },
  name: { fontSize: 26, fontWeight: '900', letterSpacing: 3, marginTop: 16 },
  tag: { fontSize: 11, letterSpacing: 3, marginTop: 8, fontWeight: '600' },
});
