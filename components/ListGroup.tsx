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
        <Text variant="label" weight="medium" color="slateGray" style={{ textTransform: 'uppercase' }}>
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

export function ListRow({ title, detail, tone = 'slateGray', onPress }: { title: string; detail?: string; tone?: 'slateGray' | 'warning'; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: theme.touchTarget.minimum,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[8],
        paddingHorizontal: theme.spacing[16],
        paddingVertical: theme.spacing[12],
        backgroundColor: pressed ? theme.colors.cloud : theme.colors.paperWhite,
      })}
    >
      <Text variant="bodyLg" style={{ flex: 1 }}>{title}</Text>
      {detail ? <Text variant="body" weight="medium" color={tone}>{detail}</Text> : null}
      <Text variant="bodyLg" color="steelGray">›</Text>
    </Pressable>
  );
}
