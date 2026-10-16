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
const sideMargin = 20;
const pillPadding = theme.spacing[16]; // the least room between a tab's content and the pill's sides
const barEdgeGap = theme.spacing[4]; // how near the pill may come to the bar's rounded end

/** How much room a screen should leave at its bottom so nothing hides behind the bar. */
export const useTabBarSpace = () => barHeight + Math.max(useSafeAreaInsets().bottom, theme.spacing[16]) + theme.spacing[32];

/** A floating glass bar. The active tab's highlight slides and resizes between tabs with a little spring, like a drop of glass: a tab's width, or wider when its label needs the room. */
export function GlassTabBar<Key extends string>({ tabs, active, onChange }: { tabs: TabItem<Key>[]; active: Key; onChange: (key: Key) => void }) {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [width, setWidth] = useState(0);
  const [contents, setContents] = useState<number[]>([]);
  const left = useRef(new Animated.Value(0)).current;
  const pillWidth = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const tabWidth = width > 0 ? (width - inset * 2) / tabs.length : 0;
  const index = Math.max(0, tabs.findIndex((tab) => tab.key === active));
  const center = inset + (index + 0.5) * tabWidth;
  const targetWidth = Math.min(Math.max(tabWidth, (contents[index] ?? 0) + pillPadding * 2), (Math.min(center, width - center) - barEdgeGap) * 2);
  const targetX = center - targetWidth / 2;

  useEffect(() => {
    if (!tabWidth) return;
    if (reduce || !placed.current) {
      left.setValue(targetX);
      pillWidth.setValue(targetWidth);
      placed.current = true;
      return;
    }
    const spring = { damping: 16, stiffness: 190, mass: 0.9, useNativeDriver: false };
    Animated.parallel([Animated.spring(left, { toValue: targetX, ...spring }), Animated.spring(pillWidth, { toValue: targetWidth, ...spring })]).start();
  }, [tabWidth, targetX, targetWidth, reduce, left, pillWidth]);

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, theme.spacing[16]), alignItems: 'center', paddingHorizontal: sideMargin, pointerEvents: 'box-none' }}>
      <Glass style={{ width: '100%', maxWidth: 480 }} radius={barHeight / 2}>
        <View accessibilityRole="tablist" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ flexDirection: 'row', height: barHeight, padding: inset }}>
          {tabWidth > 0 && (
            <Animated.View
              style={{
                position: 'absolute',
                top: inset,
                left,
                width: pillWidth,
                height: barHeight - inset * 2,
                borderRadius: (barHeight - inset * 2) / 2,
                backgroundColor: 'rgba(17,17,17,0.09)',
              }}
            />
          )}
          {tabs.map(({ key, label, Icon }, at) => {
            const selected = key === active;
            const color = selected ? theme.colors.inkBlack : theme.colors.charcoal;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
                onPress={() => onChange(key)}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 }}
              >
                <View onLayout={(event) => { const { width: contentWidth } = event.nativeEvent.layout; setContents((all) => Object.assign([...all], { [at]: contentWidth })); }} style={{ alignItems: 'center', gap: 2 }}>
                  <Icon size={22} color={color} strokeWidth={selected ? 2 : 1.75} />
                  <Text variant="label" weight={selected ? 'medium' : 'regular'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2} style={{ color }}>{label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}
