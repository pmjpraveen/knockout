import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stagger } from '@/components/Motion';
import { theme } from '@/theme/tokens';

const content = { paddingHorizontal: theme.spacing[24], paddingVertical: theme.spacing[16], gap: theme.spacing[16], width: '100%', alignSelf: 'center' } as const;
const maxWidth = { narrow: 640, wide: 1120 };

/**
 * Content is a centred column: 640pt for forms and lists, 1120pt with `wide` for dense screens (schedules,
 * brackets). Phones are narrower than either, so they are unaffected.
 * `animate={false}` skips the staggered entrance. Use it where a tap must never wait on motion (scoring).
 * The page header already covers the top inset.
 */
export function Screen({ children, animate = true, wide = false }: { children?: ReactNode; animate?: boolean; wide?: boolean }) {
  const style = { ...content, maxWidth: wide ? maxWidth.wide : maxWidth.narrow };
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.colors.paperWhite }}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        {animate ? <Stagger style={style}>{children}</Stagger> : <View style={style}>{children}</View>}
      </ScrollView>
    </SafeAreaView>
  );
}
