import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useAccessibleSurface } from '@/hooks/useAccessibleSurface';
import { theme } from '@/theme/tokens';

/**
 * A frosted-glass surface: the content behind it is blurred and lightened, with a bright edge and a soft
 * highlight along the top, like Apple's liquid glass. Reduce Transparency swaps the blur for a near-solid fill;
 * Increase Contrast swaps the soft edge for a defined, high-contrast border. (The web version is Glass.web.tsx.)
 */
export function Glass({ children, radius = 32, style }: { children?: ReactNode; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { reduceTransparency, increaseContrast } = useAccessibleSurface();
  return (
    <View style={[{ borderRadius: radius, ...theme.shadows.scorePanel }, style]}>
      <View
        style={{
          borderRadius: radius,
          overflow: 'hidden',
          borderWidth: increaseContrast ? 1.5 : 1,
          borderColor: increaseContrast ? theme.colors.inkBlack : 'rgba(255,255,255,0.8)',
        }}
      >
        {!reduceTransparency && <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: reduceTransparency ? theme.colors.paperWhite : 'rgba(255,255,255,0.4)' }]} />
        {!reduceTransparency && (
          <LinearGradient colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']} style={[StyleSheet.absoluteFill, { height: '55%' }]} />
        )}
        {children}
      </View>
    </View>
  );
}
