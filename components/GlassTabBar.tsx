import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from '@/components/Glass';
import { Text } from '@/components/Text';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { theme } from '@/theme/tokens';

export type TabItem<Key extends string> = { key: Key; label: string; Icon: LucideIcon };

const inset = theme.spacing[4] + 2;
const barHeight = 64;

/** How much room a screen should leave at its bottom so nothing hides behind the bar. */
export const useTabBarSpace = () => barHeight + Math.max(useSafeAreaInsets().bottom, theme.spacing[16]) + theme.spacing[32];

/** A floating glass bar. The active tab's highlight slides between tabs with a little spring, like a drop of glass. */
export function GlassTabBar<Key extends string>({ tabs, active, onChange }: { tabs: TabItem<Key>[]; active: Key; onChange: (key: Key) => void }) {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [width, setWidth] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const tabWidth = width > 0 ? (width - inset * 2) / tabs.length : 0;
  const index = Math.max(0, tabs.findIndex((tab) => tab.key === active));

  useEffect(() => {
    if (!tabWidth) return;
    if (reduce) return slide.setValue(index * tabWidth);
    Animated.spring(slide, { toValue: index * tabWidth, damping: 16, stiffness: 190, mass: 0.9, useNativeDriver: true }).start();
  }, [index, tabWidth, reduce, slide]);

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, theme.spacing[16]), alignItems: 'center', paddingHorizontal: theme.spacing[8], pointerEvents: 'box-none' }}>
      <Glass style={{ width: '100%', maxWidth: 480 }} radius={barHeight / 2}>
        <View accessibilityRole="tablist" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ flexDirection: 'row', height: barHeight, padding: inset }}>
          {tabWidth > 0 && (
            <Animated.View
              style={{
                position: 'absolute',
                top: inset,
                left: inset,
                width: tabWidth,
                height: barHeight - inset * 2,
                borderRadius: (barHeight - inset * 2) / 2,
                backgroundColor: 'rgba(17,17,17,0.09)',
                transform: [{ translateX: slide }],
              }}
            />
          )}
          {tabs.map(({ key, label, Icon }) => {
            const selected = key === active;
            const color = selected ? theme.colors.inkBlack : theme.colors.charcoal;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
                onPress={() => onChange(key)}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 }}
              >
                <Icon size={22} color={color} strokeWidth={selected ? 2 : 1.75} />
                <Text variant="label" weight={selected ? 'medium' : 'regular'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2} style={{ color }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}
