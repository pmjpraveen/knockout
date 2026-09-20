import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

const aspect = 1672 / 941;
export const wideBreakpoint = 700;

/**
 * The illustration on the login page. Its sky is white, so it melts into the page. On a phone it sits in flow
 * at the foot of the form. On wide screens it spans the window behind the form card, starting halfway down
 * and cropped at the bottom edge (or pinned to it when the window is tall).
 */
export function LoginArtwork() {
  const { width, height } = useWindowDimensions();
  const wide = width >= wideBreakpoint;
  const imageHeight = width / aspect;
  const image = (
    <Image
      accessibilityElementsHidden
      importantForAccessibility="no"
      source={require('@/assets/images/login-bg.jpg')}
      resizeMode="cover"
      style={wide ? { position: 'absolute', left: 0, width, height: imageHeight, top: Math.max(height / 2, height - imageHeight) } : { width: '100%', height: '100%' }}
    />
  );

  if (wide) return <View style={StyleSheet.absoluteFill}>{image}</View>;
  return <View style={{ width: '100%', height: Math.min(imageHeight, 320) }}>{image}</View>;
}
