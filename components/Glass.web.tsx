import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { theme } from '@/theme/tokens';

type Props = { children?: ReactNode; radius?: number; style?: StyleProp<ViewStyle> };

/** The same frosted-glass surface on web, using the browser's backdrop blur. (Native is Glass.tsx.) */
export function Glass({ children, radius = 32, style }: Props) {
  return (
    <View
      style={[
        {
          borderRadius: radius,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.8)',
          backgroundColor: 'rgba(255,255,255,0.55)',
          overflow: 'hidden',
          backdropFilter: 'blur(24px) saturate(180%)',
          ...theme.shadows.scorePanel,
        } as ViewStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}
