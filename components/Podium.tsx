import { LinearGradient } from 'expo-linear-gradient';
import Crown from 'lucide-react-native/icons/crown';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Reveal } from '@/components/Motion';
import { Text } from '@/components/Text';
import { useCategoryPodium } from '@/hooks/useCategoryPodium';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { theme } from '@/theme/tokens';

type Place = 1 | 2 | 3;
const labels: Record<Place, string> = { 1: '1st', 2: '2nd', 3: '3rd' };
// One-off celebration colors: not part of the design system's palette, used only for medals and confetti.
const medal: Record<Place, { face: string; tint: string; text: string }> = {
  1: { face: '#F2B33D', tint: '#FFF7E0', text: '#6B4A05' },
  2: { face: '#AEB7C2', tint: '#F1F3F6', text: '#3F4552' },
  3: { face: '#C97F45', tint: '#FBEEE3', text: '#4A2E12' },
};
const confettiColors = ['#F2B33D', '#0B57D0', '#15803D', '#E11D2E', '#AEB7C2', '#C97F45'];

type Finisher = { place: number; athlete_name: string; club_name: string | null };

/** A round medal with the place number inside, or a crown for the champion. */
function Medal({ place, size = 36 }: { place: Place; size?: number }) {
  const colors = medal[place];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.face, alignItems: 'center', justifyContent: 'center' }}>
      {place === 1 ? <Crown size={size * 0.55} color={colors.text} strokeWidth={2} /> : <Text variant="label" style={{ color: colors.text }}>{place}</Text>}
    </View>
  );
}

/** One finisher: medal, name, club and place. */
function Row({ place, name, club }: { place: Place; name: string; club: string | null }) {
  return (
    <View accessible accessibilityLabel={`${labels[place]} place: ${name}${club ? `, ${club}` : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[12], paddingHorizontal: theme.spacing[16], paddingVertical: theme.spacing[12] }}>
      <Medal place={place} />
      <View style={{ flex: 1, gap: theme.spacing[4] }}>
        <Text variant="bodyLg" numberOfLines={1}>{name}</Text>
        {club ? <Text variant="body" color="slateGray" numberOfLines={1}>{club}</Text> : null}
      </View>
      <Text variant="label" color="slateGray" style={{ textTransform: 'uppercase' }}>{labels[place]}</Text>
    </View>
  );
}

/** A burst of falling confetti, played once when `play` turns true. One shared Animated.Value drives every piece, each reading it through its own delay and drift. */
function Confetti({ play }: { play: boolean }) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const pieces = useRef(
    Array.from({ length: 36 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.3,
      drift: (Math.random() - 0.5) * 80,
      spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360),
      size: 6 + Math.random() * 5,
      color: confettiColors[i % confettiColors.length],
    })),
  ).current;

  useEffect(() => {
    if (!play || reduce) return;
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [play, reduce, progress]);

  if (!play || reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => {
        const start = p.delay;
        const end = Math.min(start + 0.75, 1);
        const translateY = progress.interpolate({ inputRange: [start, 1], outputRange: [-16, 230], extrapolate: 'clamp' });
        const translateX = progress.interpolate({ inputRange: [start, 1], outputRange: [0, p.drift], extrapolate: 'clamp' });
        const rotate = progress.interpolate({ inputRange: [start, 1], outputRange: ['0deg', `${p.spin}deg`], extrapolate: 'clamp' });
        const opacity = progress.interpolate({ inputRange: [0, start, end, 1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={p.id}
            style={{
              position: 'absolute', top: 0, left: `${p.left}%`, width: p.size, height: p.size * 0.4,
              backgroundColor: p.color, borderRadius: 1, opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

const goldInk = '#3D2A03';
const shineBand = 96;

/** A soft diagonal band of light that sweeps across its parent every few seconds. Still when the system asks for less motion. */
function Shine({ width, height }: { width: number; height: number }) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce || width === 0) return;
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(progress, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, width, progress]);

  if (reduce || width === 0) return null;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-shineBand * 2, width + shineBand] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -height * 0.4, left: 0, width: shineBand, height: height * 1.8, transform: [{ translateX }, { rotate: '18deg' }] }}>
      <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/** The winner in a gold card: a crown badge, their name and club, a slow shine, and the confetti. */
function ChampionCard({ name, club, celebrate }: { name: string; club: string | null; celebrate: boolean }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <View
      accessible
      accessibilityLabel={`Champion: ${name}${club ? `, ${club}` : ''}`}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={{ overflow: 'hidden', borderRadius: theme.radii.card, ...theme.shadows.scorePanel }}
    >
      <LinearGradient colors={['#FDE9AE', '#F6C55E', '#E5A726']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ alignItems: 'center', gap: theme.spacing[8], padding: theme.spacing[24] }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }}>
          <Crown size={30} color={goldInk} strokeWidth={2} />
        </View>
        <Text variant="label" style={{ textTransform: 'uppercase', color: goldInk, letterSpacing: 1.5 }}>Champion</Text>
        <Text variant="heading" style={{ textAlign: 'center', color: goldInk }}>{name}</Text>
        {club ? <Text style={{ textAlign: 'center', color: goldInk }}>{club}</Text> : null}
      </LinearGradient>
      <Shine width={size.width} height={size.height} />
      <Confetti play={celebrate} />
    </View>
  );
}

/**
 * A category's 1st, 2nd and 3rd place (two athletes share 3rd when the bracket has bronze bouts). The champion gets a
 * card of their own, with confetti played once the first time a place is decided; 2nd and 3rd are rows beneath it.
 * `compact` lists all three as plain rows, for use inside another card. Nothing is shown until a place is decided.
 */
export function Podium({ categoryId, compact = false }: { categoryId: string; compact?: boolean }) {
  const rows: Finisher[] = useCategoryPodium(categoryId);
  const [celebrate, setCelebrate] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    if (rows.length > 0 && !shown.current) {
      shown.current = true;
      setCelebrate(!compact);
    }
  }, [rows.length, compact]);

  if (rows.length === 0) return null;
  const byPlace = (place: Place) => rows.filter((row) => row.place === place);
  const champion = byPlace(1)[0];
  const rest = ([compact ? 1 : 2, 2, 3] as Place[]).filter((place, index, all) => all.indexOf(place) === index).flatMap((place) => byPlace(place).map((row) => ({ place, row })));

  return (
    <View style={{ gap: theme.spacing[12], marginBottom: theme.spacing[16] }}>
      <Text variant="label" color="slateGray" style={{ textTransform: 'uppercase' }}>Podium</Text>
      {!compact && champion && (
        <Reveal y={16}>
          <ChampionCard name={champion.athlete_name} club={champion.club_name} celebrate={celebrate} />
        </Reveal>
      )}
      {rest.length > 0 && (
        <View style={{ borderWidth: 1, borderColor: theme.colors.mist, borderRadius: theme.radii.card, overflow: 'hidden', backgroundColor: theme.colors.paperWhite }}>
          {rest.map(({ place, row }, index) => (
            <View key={`${place}-${row.athlete_name}`} style={{ borderTopWidth: index ? 1 : 0, borderTopColor: theme.colors.mist }}>
              <Row place={place} name={row.athlete_name} club={row.club_name} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
