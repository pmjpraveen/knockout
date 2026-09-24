import { ScrollView, View } from 'react-native';
import { Reveal } from '@/components/Motion';
import { Text } from '@/components/Text';
import { theme } from '@/theme/tokens';

export type BracketMatch = {
  id: string;
  round: number;
  position: number | null;
  bracket_side: string;
  pool: number | null;
  status: string;
  winner_id: string | null;
  athlete_a_id: string | null;
  athlete_b_id: string | null;
  athlete_a: string | null;
  athlete_b: string | null;
};

const sideOrder = ['main', 'winners', 'losers', 'grand_final', 'reset', 'repechage_top', 'repechage_bottom', 'pool'];
const sideTitle: Record<string, string> = {
  main: 'Main bracket',
  winners: 'Winners bracket',
  losers: 'Losers bracket',
  grand_final: 'Grand final',
  reset: 'Bracket reset',
  repechage_top: 'Repechage: top half',
  repechage_bottom: 'Repechage: bottom half',
};

function Side({ match, slot }: { match: BracketMatch; slot: 'a' | 'b' }) {
  const name = slot === 'a' ? match.athlete_a : match.athlete_b;
  const athleteId = slot === 'a' ? match.athlete_a_id : match.athlete_b_id;
  const decided = match.status === 'completed';
  const won = decided && match.winner_id === athleteId;
  const empty = name ? null : match.status === 'bye' ? 'Bye' : 'TBD';

  return (
    <View
      accessible
      accessibilityLabel={`${slot === 'a' ? 'Aka' : 'Ao'} corner: ${name ?? empty}${won ? ', winner' : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8], minHeight: 28 }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: name ? (slot === 'a' ? theme.colors.aka : theme.colors.ao) : 'transparent',
        }}
      />
      <Text
        variant="body"
        weight={won ? 'medium' : 'regular'}
        color={empty || (decided && !won) ? 'slateGray' : 'inkBlack'}
        numberOfLines={1}
        style={{ flex: 1 }}
      >
        {name ?? empty}
      </Text>
    </View>
  );
}

function MatchCard({ match }: { match: BracketMatch }) {
  const skipped = match.status === 'bye' && !match.athlete_a_id && !match.athlete_b_id;
  return (
    <View
      style={{
        width: 200,
        backgroundColor: theme.colors.paperWhite,
        borderWidth: 1,
        borderColor: theme.colors.mist,
        borderRadius: theme.radii.card,
        padding: theme.spacing[12],
        ...theme.shadows.subtle,
      }}
    >
      {skipped ? (
        <Text color="slateGray">Not needed</Text>
      ) : (
        <>
          <Side match={match} slot="a" />
          <View style={{ height: 1, backgroundColor: theme.colors.mist }} />
          <Side match={match} slot="b" />
        </>
      )}
    </View>
  );
}

/** Match cards in horizontally scrolling round columns, one section per bracket side (or pool). */
export function BracketTree({ matches }: { matches: BracketMatch[] }) {
  const groups = new Map<string, BracketMatch[]>();
  for (const match of matches) {
    const key = match.bracket_side === 'pool' ? `pool:${match.pool}` : match.bracket_side;
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }
  const keys = [...groups.keys()].sort((x, y) => {
    const [sx, sy] = [x.split(':')[0], y.split(':')[0]];
    return sideOrder.indexOf(sx) - sideOrder.indexOf(sy) || x.localeCompare(y);
  });

  return (
    <View style={{ gap: theme.spacing[24] }}>
      {keys.map((key) => {
        const rounds = [...new Set(groups.get(key)!.map((m) => m.round))].sort((x, y) => x - y);
        const title = key.startsWith('pool:') ? `Pool ${key.split(':')[1]}` : sideTitle[key];
        return (
          <View key={key} style={{ gap: theme.spacing[12] }}>
            <Text variant="subheading">{title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing[16] }}>
              {rounds.map((round, index) => (
                <Reveal key={round} delay={index * 0.08} style={{ gap: theme.spacing[12] }}>
                  <Text variant="label" color="slateGray" style={{ textTransform: 'uppercase' }}>
                    Round {round}
                  </Text>
                  <View style={{ flex: 1, justifyContent: 'space-around', gap: theme.spacing[12] }}>
                    {groups
                      .get(key)!
                      .filter((m) => m.round === round)
                      .sort((x, y) => (x.position ?? 0) - (y.position ?? 0))
                      .map((match) => <MatchCard key={match.id} match={match} />)}
                  </View>
                </Reveal>
              ))}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}
