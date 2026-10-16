import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { medal } from '@/components/Podium';
import { Text } from '@/components/Text';
import type { Tally } from '@/lib/medals';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

const shown = 5;
const column = 32;
const medals = [['gold', 1], ['silver', 2], ['bronze', 3]] as const;

/** Medals per club: rank, club and gold, silver and bronze counts. The top few show; the rest open on request. */
export function MedalTable({ tally }: { tally: Tally[] }) {
  const [all, setAll] = useState(false);
  if (tally.length === 0) return null;
  const rows = all ? tally : tally.slice(0, shown);

  return (
    <View style={{ gap: theme.spacing[8] }}>
      <Text variant="label" color="slateGray" style={{ textTransform: 'uppercase' }}>Medals by club</Text>
      <View style={{ borderWidth: 1, borderColor: theme.colors.mist, borderRadius: theme.radii.card, overflow: 'hidden', backgroundColor: theme.colors.paperWhite }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8], paddingHorizontal: theme.spacing[16], paddingVertical: theme.spacing[12], backgroundColor: theme.colors.cloud }}>
          <View style={{ width: 24 }} />
          <View style={{ flex: 1 }} />
          {medals.map(([name, place]) => (
            <View key={name} accessibilityLabel={name} style={{ width: column, alignItems: 'center' }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: medal[place].face }} />
            </View>
          ))}
        </View>
        {rows.map((row, index) => (
          <View key={row.club} accessible accessibilityLabel={`${index + 1}. ${row.club}: ${row.gold} gold, ${row.silver} silver, ${row.bronze} bronze`} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8], paddingHorizontal: theme.spacing[16], paddingVertical: theme.spacing[12], borderTopWidth: 1, borderTopColor: theme.colors.mist }}>
            <Text variant="label" color="slateGray" style={{ width: 24 }}>{index + 1}</Text>
            <Text style={{ flex: 1 }} numberOfLines={2}>{row.club}</Text>
            {medals.map(([name]) => (
              <Text key={name} weight={name === 'gold' ? 'medium' : 'regular'} color={row[name] ? 'inkBlack' : 'steelGray'} style={{ width: column, textAlign: 'center' }}>{row[name]}</Text>
            ))}
          </View>
        ))}
        {tally.length > shown && (
          <Pressable accessibilityRole="button" onPress={() => setAll((open) => !open)} style={({ pressed }) => [{ paddingVertical: theme.spacing[12], alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.colors.mist }, pressFeedback(pressed)]}>
            <Text variant="body" color="slateGray">{all ? 'Show fewer' : `Show all ${tally.length} clubs`}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
