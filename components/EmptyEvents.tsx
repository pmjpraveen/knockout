import { useRouter } from 'expo-router';
import { Image, ImageSourcePropType, View } from 'react-native';
import { Button } from '@/components/Button';
import { HomeScreen } from '@/components/HomeScreen';
import { Reveal } from '@/components/Motion';
import { Text } from '@/components/Text';
import { theme } from '@/theme/tokens';

const cardWidth = 120;
const cardHeight = 166;
const border = 3;
const artWidth = (cardHeight - border * 2) * 1.5; // the covers are 3:2 landscape, shown as a portrait crop
const stage = { width: 260, height: 232 };
const revealGap = 0.45;

// Placed back to front. `pan` is how much of the picture is slid off the left edge, choosing which part shows.
const cards: { source: ImageSourcePropType; left: number; top: number; rotate: string; pan: number }[] = [
  { source: require('@/assets/images/cover-1.jpg'), left: 66, top: 0, rotate: '-2deg', pan: 75 },
  { source: require('@/assets/images/cover-2.jpg'), left: 12, top: 50, rotate: '-10deg', pan: 10 },
  { source: require('@/assets/images/cover-3.jpg'), left: 128, top: 46, rotate: '12deg', pan: 112 },
];

/** What an organizer sees before creating their first event: three cover cards that land one by one, and the way in. */
export function EmptyEvents() {
  const router = useRouter();

  return (
    <HomeScreen>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: stage.width, height: stage.height, alignSelf: 'center', marginTop: theme.spacing[48] * 2 + theme.spacing[32] }}>
        {cards.map((card, index) => (
          <Reveal key={index} delay={index * revealGap} y={28} style={{ position: 'absolute', left: card.left, top: card.top, width: cardWidth, height: cardHeight }}>
            <View
              style={{
                flex: 1,
                padding: border,
                borderRadius: theme.radii.card,
                backgroundColor: theme.colors.paperWhite,
                transform: [{ rotate: card.rotate }],
                ...theme.shadows.subtle,
              }}
            >
              <View style={{ flex: 1, overflow: 'hidden', borderRadius: theme.radii.card - border }}>
                <Image source={card.source} resizeMode="cover" style={{ height: '100%', width: artWidth, marginLeft: -card.pan }} />
              </View>
            </View>
          </Reveal>
        ))}
      </View>

      <View style={{ alignItems: 'center', gap: theme.spacing[8], marginTop: theme.spacing[8] }}>
        <Text variant="headingSm" style={{ textAlign: 'center' }}>Host your first tournament</Text>
        <Text variant="bodyLg" color="slateGray" style={{ textAlign: 'center' }}>Create your tournament and invite clubs</Text>
      </View>

      <View style={{ marginTop: theme.spacing[32] }}>
        <Button title="Create a tournament" onPress={() => router.push('/events/new')} />
      </View>
    </HomeScreen>
  );
}
