import type { LucideIcon } from 'lucide-react-native';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { Children, ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/theme/tokens';

/** Rows in one hairline-bordered card; falsy children are skipped so callers can gate rows inline. */
export function ListGroup({ title, children }: { title?: string; children: ReactNode }) {
  const rows = Children.toArray(children);
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: theme.spacing[8] }}>
      {title && (
        <Text variant="label" color="slateGray" style={{ textTransform: 'uppercase' }}>
          {title}
        </Text>
      )}
      <View style={{ borderWidth: 1, borderColor: theme.colors.mist, borderRadius: theme.radii.card, overflow: 'hidden', backgroundColor: theme.colors.paperWhite }}>
        {rows.map((row, index) => (
          <View key={index} style={{ borderTopWidth: index ? 1 : 0, borderTopColor: theme.colors.mist }}>
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

type RowProps = { title: string; subtitle?: string; Icon?: LucideIcon; detail?: string; tone?: 'slateGray' | 'warning'; onPress: () => void };

/** One tappable row. With an `Icon` it leads with a soft circle, and a `subtitle` explains what the row opens. */
export function ListRow({ title, subtitle, Icon, detail, tone = 'slateGray', onPress }: RowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, detail].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: theme.touchTarget.minimum,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[16],
        paddingHorizontal: theme.spacing[16],
        paddingVertical: theme.spacing[12],
        backgroundColor: pressed ? theme.colors.cloud : theme.colors.paperWhite,
      })}
    >
      {Icon && (
        <View style={{ width: theme.touchTarget.minimum, height: theme.touchTarget.minimum, borderRadius: theme.touchTarget.minimum / 2, backgroundColor: theme.colors.cloud, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={22} color={theme.colors.inkBlack} strokeWidth={1.75} />
        </View>
      )}
      <View style={{ flex: 1, gap: theme.spacing[4] }}>
        <Text variant="bodyLg">{title}</Text>
        {subtitle ? <Text color="slateGray">{subtitle}</Text> : null}
      </View>
      {detail ? <Text variant="body" color={tone}>{detail}</Text> : null}
      <ChevronRight size={20} color={theme.colors.steelGray} strokeWidth={1.75} />
    </Pressable>
  );
}
