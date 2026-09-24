import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useAccessibleSurface } from '@/hooks/useAccessibleSurface';
import { theme } from '@/theme/tokens';

type Props = { children?: ReactNode; radius?: number; style?: StyleProp<ViewStyle> };

/**
 * The same frosted-glass surface on web, using the browser's backdrop blur. Honors prefers-reduced-transparency
 * (near-solid fill, no blur) and prefers-contrast (a defined, high-contrast border). (Native is Glass.tsx.)
 */
export function Glass({ children, radius = 32, style }: Props) {
  const { reduceTransparency, increaseContrast } = useAccessibleSurface();
  return (
    <View
      style={[
        {
          borderRadius: radius,
          borderWidth: increaseContrast ? 1.5 : 1,
          borderColor: increaseContrast ? theme.colors.inkBlack : 'rgba(255,255,255,0.8)',
          backgroundColor: reduceTransparency ? theme.colors.paperWhite : 'rgba(255,255,255,0.55)',
          overflow: 'hidden',
          backdropFilter: reduceTransparency ? 'none' : 'blur(24px) saturate(180%)',
          ...theme.shadows.scorePanel,
        } as ViewStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}
