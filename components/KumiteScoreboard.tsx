import type { LucideIcon } from 'lucide-react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import LogOut from 'lucide-react-native/icons/log-out';
import Star from 'lucide-react-native/icons/star';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import StarOff from 'lucide-react-native/icons/star-off';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Undo2 from 'lucide-react-native/icons/undo-2';
import { StatusBar } from 'expo-status-bar';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Pop, Reveal } from '@/components/Motion';
import { clockHeight, MatchClock, ResultConfirm, ScoreboardRow, MatchDone, WinnerHeader } from '@/components/ScoreboardParts';
import { Text } from '@/components/Text';
import { useMatchScoring } from '@/hooks/useMatchScoring';
import { useNavigationBarStyle } from '@/hooks/useNavigationBarStyle';
import { haptic } from '@/lib/haptics';
import { pressFeedback } from '@/lib/press';
import { activeEvents, clockState, kumiteOutcome, kumiteState, nextPenaltyLevel, Outcome, penaltyLevels, points, scoredThisPause } from '@/lib/scoring';
import { theme } from '@/theme/tokens';

const scoreTypes = [['ippon', 'Ippon +3'], ['waza_ari', 'Waza-ari +2'], ['yuko', 'Yuko +1']] as const;

const glass = 'rgba(255,255,255,0.35)'; // controls on the coloured halves
const round = theme.touchTarget.scoreButton;
const pad = Platform.OS === 'web' ? 40 : theme.spacing[16]; // web keeps the controls 40px in from every edge
const clockTop = Platform.OS === 'web' ? pad : theme.spacing[8];
const clockClearance = 72; // keeps names clear of the clock pill that overlaps both halves

/**
 * Edges: how far content stays from the screen edges (notch, home indicator).
 * Roomy: a landscape screen tall enough for the desktop layout, with the names below a top row of back button and
 * clock. `digit` is the score size that fits.
 */
const LayoutContext = createContext<{ start: number; end: number; roomy: boolean; digit: number }>({ start: pad, end: pad, roomy: false, digit: theme.type.scoreDisplay.fontSize });

const useRoomy = () => {
  const { width, height } = useWindowDimensions();
  return width >= height && height >= 600;
};

/**
 * The scoreboard is landscape. The app is locked to portrait, so on a portrait screen it is turned a quarter
 * turn instead; anything already wider than tall is shown as it is.
 */
function Fullscreen({ children }: { children: ReactNode }) {
  useNavigationBarStyle('light'); // the dark score panel needs light gesture-bar icons
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const turned = height > width;
  const edge = Platform.OS === 'web' ? pad : theme.spacing[24];
  const roomy = useRoomy();
  const sides = turned
    ? { start: Math.max(insets.top, edge), end: Math.max(insets.bottom, edge) }
    : { start: Math.max(insets.left, edge), end: Math.max(insets.right, edge) };
  const edges = { ...sides, roomy, digit: roomy ? Math.min(200, height - 420) : theme.type.scoreDisplay.fontSize };
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.inkBlack, overflow: 'hidden' }}>
      <StatusBar hidden />
      <LayoutContext.Provider value={edges}>
        {turned ? (
          <View style={{ position: 'absolute', width: height, height: width, left: (width - height) / 2, top: (height - width) / 2, transform: [{ rotate: '90deg' }] }}>{children}</View>
        ) : (
          children
        )}
      </LayoutContext.Provider>
    </View>
  );
}

function RoundButton({ label, Icon, text, onPress, filled, disabled }: { label: string; Icon?: LucideIcon; text?: string; onPress: () => void; filled?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [{ width: round, height: round, borderRadius: round / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? theme.colors.paperWhite : glass, borderWidth: filled ? 1 : 0, borderColor: theme.colors.mist, opacity: disabled ? 0.5 : 1 }, pressFeedback(pressed)]}
    >
      {Icon ? <Icon size={24} color={filled ? theme.colors.inkBlack : theme.colors.paperWhite} strokeWidth={2} /> : <Text variant="bodyLg" color="paperWhite">{text}</Text>}
    </Pressable>
  );
}

/** A labelled control on a coloured half: icon and words, so a scorer under pressure never has to guess what a round button does. */
function ActionPill({ label, spoken, Icon, onPress, disabled }: { label: string; spoken?: string; Icon: LucideIcon; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [{ height: round, paddingHorizontal: theme.spacing[16], borderRadius: round / 2, flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8], backgroundColor: glass, opacity: disabled ? 0.5 : 1 }, pressFeedback(pressed)]}
    >
      <Icon size={22} color={theme.colors.paperWhite} strokeWidth={2} />
      <Text variant="body" color="paperWhite">{label}</Text>
    </Pressable>
  );
}

/** Five pips for the penalty ladder: three Chui, Hansoku chui, Hansoku. They fill as penalties are given. */
function PenaltyPips({ count, level }: { count: number; level: string }) {
  return (
    <View accessible accessibilityLabel={count ? `Penalty: ${level}` : 'No penalties'} style={{ gap: theme.spacing[8], minHeight: count ? undefined : 0 }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing[8] }}>
        {penaltyLevels.map((name, index) => (
          <View key={name} style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: theme.colors.paperWhite, backgroundColor: index < count ? theme.colors.paperWhite : 'transparent', opacity: index < count ? 1 : 0.5 }} />
        ))}
      </View>
      {count > 0 && <Text variant="bodyLg" color="paperWhite" maxFontSizeMultiplier={1.2}>{level}</Text>}
    </View>
  );
}

type Corner = {
  side: 'aka' | 'ao';
  name: string;
  club: string;
  total: string;
  senshu: boolean;
  /** The penalty reached so far, or empty. */
  penalty: string;
  penaltyCount: number;
  live: boolean;
  disabled: boolean;
  /** This athlete already has a score in the current pause; the next one waits for the clock to resume. */
  scored: boolean;
  onScore: (type: (typeof scoreTypes)[number][0]) => void;
  onPenalty: () => void;
  onMore: () => void;
  nextLevel: string;
};

function Half({ side, name, club, total, senshu, penalty, penaltyCount, live, disabled, scored, onScore, onPenalty, onMore, nextLevel }: Corner) {
  const { start, end, roomy, digit } = useContext(LayoutContext);
  const gap = roomy ? theme.spacing[8] : theme.spacing[16];
  const seam = roomy ? pad : theme.spacing[32];
  const aka = side === 'aka';
  const spoken = `${aka ? 'Aka' : 'Ao'} corner, ${name}`;
  const align = aka ? 'flex-start' : 'flex-end';
  const buttons = (
    <View style={{ width: 136, justifyContent: 'center', gap: theme.spacing[12] }}>
      {scoreTypes.map(([type, label]) => (
        <Pressable
          key={type}
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${spoken}`}
          accessibilityState={{ disabled: disabled || scored }}
          accessibilityHint={scored ? 'Already scored in this pause. Resume the clock to score again.' : undefined}
          disabled={disabled || scored}
          onPress={() => { haptic.tap(); onScore(type); }}
          style={({ pressed }) => [{ height: 48, borderRadius: 24, backgroundColor: theme.colors.paperWhite, alignItems: 'center', justifyContent: 'center', opacity: disabled || scored ? 0.4 : 1 }, pressFeedback(pressed)]}
        >
          <Text variant="body" weight="medium" style={{ color: theme.colors[side] }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
  const actions = [
    <ActionPill key="penalty" label="Penalty" Icon={TriangleAlert} disabled={disabled} onPress={() => { haptic.warning(); onPenalty(); }} />,
    <RoundButton key="more" label={`More actions, ${spoken}`} Icon={Ellipsis} disabled={disabled} onPress={onMore} />,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors[side], paddingTop: roomy ? pad + clockHeight + pad : pad, paddingBottom: pad, paddingStart: aka ? start : seam, paddingEnd: aka ? seam : end }}>
      <View importantForAccessibility="no" accessibilityElementsHidden style={{ alignItems: align, paddingStart: aka || roomy ? 0 : clockClearance, paddingEnd: aka && !roomy ? clockClearance : 0, gap: theme.spacing[4] }}>
        <Text variant="body" color="paperWhite">{aka ? 'Aka' : 'Ao'}</Text>
        <Text variant="headingSm" color="paperWhite" numberOfLines={1} maxFontSizeMultiplier={1.2}>{name}</Text>
        <Text variant="body" color="paperWhite" numberOfLines={1} maxFontSizeMultiplier={1.2}>{club}</Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
      <View style={{ flexDirection: aka ? 'row' : 'row-reverse', alignItems: roomy ? 'flex-end' : 'center', gap: theme.spacing[16] }}>
        <View style={{ flex: 1, alignItems: align, gap: theme.spacing[4] }}>
          <Pop trigger={total}>
            <Text variant="scoreDisplay" color="paperWhite" style={{ fontSize: digit, lineHeight: Math.round(digit * 1.25), includeFontPadding: false }} accessibilityLabel={`${spoken}: ${total}${senshu ? ', Senshu' : ''}`}>{total}</Text>
          </Pop>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8], minHeight: 32, opacity: senshu ? 1 : 0 }} accessibilityElementsHidden={!senshu}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4], paddingHorizontal: theme.spacing[12], paddingVertical: theme.spacing[4], borderRadius: 16, backgroundColor: theme.colors.paperWhite }}>
              <Star size={16} color={theme.colors[side]} fill={theme.colors[side]} strokeWidth={2} />
              <Text variant="label" weight="medium" style={{ color: theme.colors[side], textTransform: 'uppercase' }}>Senshu</Text>
            </View>
          </View>
          {penaltyCount > 0 && (
            <View style={{ marginTop: theme.spacing[8] }}>
              <PenaltyPips count={penaltyCount} level={penalty} />
            </View>
          )}
        </View>
        {live && buttons}
      </View>
      </View>

      <View style={{ height: round, flexDirection: 'row', justifyContent: aka ? 'flex-start' : 'flex-end', gap }}>
        {live && (aka ? actions : [...actions].reverse())}
      </View>
    </View>
  );
}

/** Top left on a roomy screen, level with the clock; on a small one it sits under the clock, out of the names' way. */
function LeaveButton({ onPress }: { onPress: () => void }) {
  const { start, roomy } = useContext(LayoutContext);
  return (
    <View
      pointerEvents="box-none"
      style={roomy ? { position: 'absolute', top: clockTop + (clockHeight - round) / 2, left: start } : { position: 'absolute', top: clockTop + clockHeight + theme.spacing[16], left: 0, right: 0, alignItems: 'center' }}
    >
      <RoundButton label="Leave the scoreboard" Icon={ArrowLeft} onPress={onPress} />
    </View>
  );
}

export function KumiteScoreboard({ row, eventId, onDone }: { row: ScoreboardRow; eventId: string; onDone: () => void }) {
  const scoring = useMatchScoring({ eventId, matchId: row.match_id });
  const [now, setNow] = useState(Date.now());
  const [confirming, setConfirming] = useState<Outcome | null>(null);
  const [menu, setMenu] = useState<'a' | 'b' | null>(null);
  const { athlete_a_id: a, athlete_b_id: b } = row;
  const names = { [a]: row.athlete_a, [b]: row.athlete_b };

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const state = kumiteState(scoring.events, a, b);
  const clock = clockState(scoring.events, row.match_seconds, now);
  const outcome = scoring.started && !scoring.finalized ? kumiteOutcome(state, a, b, clock.remaining) : null;
  const timeUp = clock.started && clock.remaining <= 0;

  // Time expiry is logged once, when the running clock reaches zero.
  useEffect(() => {
    if (clock.running && clock.remaining <= 0) {
      haptic.warning();
      scoring.record('clock', null, 0, { action: 'expire' });
    }
  }, [clock.running, clock.remaining <= 0]);

  const undoTarget = [...activeEvents(scoring.events)].reverse().find((e) => e.type !== 'clock');
  const remainingNow = Math.round(clock.remaining);
  const roomy = useRoomy();
  const live = scoring.started && !scoring.finalized;
  const scoringOpen = live && !outcome && !confirming && !timeUp;

  const corner = (side: 'a' | 'b'): Corner => {
    const id = side === 'a' ? a : b;
    return {
      side: side === 'a' ? 'aka' : 'ao',
      name: names[id],
      club: (side === 'a' ? row.club_a : row.club_b) ?? '',
      total: String(state.points[side]),
      senshu: state.senshu === side,
      penalty: state.penalties[side] ? penaltyLevels[Math.min(state.penalties[side], penaltyLevels.length) - 1] : '',
      penaltyCount: state.penalties[side],
      live,
      disabled: !scoringOpen,
      scored: scoredThisPause(scoring.events, id),
      onScore: async (type) => {
        await scoring.record(type, id, points[type]);
        // A score stops play: the referee calls YAME, so the clock pauses at once and the next score waits for it to resume.
        if (clock.running) await scoring.record('clock', null, Math.round(clock.remaining), { action: 'pause' });
      },
      onPenalty: () => scoring.record('penalty', id, 0, { category: 1 }),
      onMore: () => setMenu(side),
      nextLevel: nextPenaltyLevel(state.penalties[side]),
    };
  };

  const overlay = (content: ReactNode) => (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,17,21,0.55)' }}>
      <Reveal y={16} style={{ width: 420, maxWidth: '92%', gap: theme.spacing[16], padding: theme.spacing[16], backgroundColor: theme.colors.paperWhite, borderRadius: theme.radii.card }}>{content}</Reveal>
    </View>
  );

  // Withdrawal and the referee's TORIMASEN (which takes Senshu away) are rare, so they sit behind one button instead of on the half.
  const menuSide = menu && scoringOpen ? menu : null;
  const menuId = menuSide === 'a' ? a : b;
  const menuOther = menuSide === 'a' ? b : a;
  const menuOverlay = menuSide && overlay(
    <>
      <Text variant="subheading">{names[menuId]}</Text>
      {state.senshu === menuSide && (
        <Button size="large" variant="secondary" title="Cancel Senshu (referee's TORIMASEN)" icon={<StarOff size={18} color={theme.colors.inkBlack} strokeWidth={1.75} />} onPress={() => { haptic.warning(); scoring.record('penalty', menuId, 0, { category: 1, kind: 'senshu_annulled' }); setMenu(null); }} />
      )}
      <Button size="large" variant="danger" title={`${names[menuId]} withdraws`} icon={<LogOut size={18} color={theme.colors.danger} strokeWidth={1.75} />} onPress={() => { setMenu(null); setConfirming({ winner: menuOther, method: 'withdrawal' }); }} />
      <Button variant="ghost" title="Close" onPress={() => setMenu(null)} />
    </>,
  );

  let prompt: ReactNode = null;
  if (scoring.finalized) {
    prompt = overlay(<MatchDone winner={names[scoring.finalized.winner]} onDone={onDone} />);
  } else if (confirming) {
    prompt = overlay(<ResultConfirm framed={false} outcome={confirming} names={names} onCancel={() => setConfirming(null)} onConfirm={async () => { await scoring.finalize(confirming.winner, confirming.method, confirming.note); }} />);
  } else if (outcome) {
    prompt = overlay(
      <>
        <WinnerHeader
          eyebrow="Match decided"
          name={names[outcome.winner]}
          line={`wins by ${outcome.note ? outcome.note.split(':')[0] : outcome.method === 'lead' ? 'an 8-point lead' : outcome.method}`}
        />
        <View style={{ flexDirection: 'row', gap: theme.spacing[12] }}>
          <View style={{ flex: 1 }}><Button size="large" title="Undo last" variant="secondary" disabled={!undoTarget} onPress={() => scoring.record('void', null, null, null, undoTarget!.id)} /></View>
          <View style={{ flex: 1 }}><Button size="large" title="Review result" onPress={() => setConfirming(outcome)} /></View>
        </View>
      </>,
    );
  } else if (timeUp) {
    prompt = overlay(
      <>
        <View style={{ gap: theme.spacing[4] }}>
          <Text variant="label" color="slateGray" style={{ textTransform: 'uppercase' }}>Time is up</Text>
          <Text variant="subheading">Level on every count</Text>
          <Text color="slateGray">Same points, no Senshu, and the same Ippon and Waza-ari. The referee panel decides by Hantei: record its vote.</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing[12] }}>
          {[a, b].map((id) => (
            <View key={id} style={{ flex: 1 }}>
              <Button size="large" title={names[id]} variant="secondary" onPress={() => setConfirming({ winner: id, method: 'decision', note: 'Hantei: majority of the referee panel' })} />
            </View>
          ))}
        </View>
        <Button title="Undo last" variant="ghost" disabled={!undoTarget} onPress={() => scoring.record('void', null, null, null, undoTarget!.id)} />
      </>,
    );
  }

  return (
    <Fullscreen>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Half {...corner('a')} />
        <Half {...corner('b')} />
      </View>

      <View pointerEvents="none" style={{ position: 'absolute', top: clockTop, left: 0, right: 0, alignItems: 'center' }}>
        <MatchClock remaining={clock.remaining} total={row.match_seconds} />
      </View>
      <LeaveButton onPress={onDone} />

      <View pointerEvents="box-none" style={{ position: 'absolute', bottom: pad, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: roomy ? theme.spacing[8] : theme.spacing[16] }}>
        {!scoring.started ? (
          <Button
            title="Start match"
            size="scoreButton"
            onPress={async () => {
              haptic.start();
              await scoring.start();
              await scoring.record('clock', null, row.match_seconds, { action: 'start' });
            }}
          />
        ) : (
          <>
            <View style={{ minWidth: roomy ? 190 : 160 }}>
              <Button
                title={clock.running ? 'Pause clock' : 'Resume clock'}
                variant="secondary"
                size="scoreButton"
                disabled={timeUp || !!outcome || !live}
                onPress={() => {
                  haptic.tap();
                  scoring.record('clock', null, remainingNow, { action: clock.running ? 'pause' : 'resume' });
                }}
              />
            </View>
            <RoundButton
              label={undoTarget ? 'Undo last' : 'Nothing to undo'}
              Icon={Undo2}
              filled
              disabled={!undoTarget || !live}
              onPress={() => {
                haptic.tap();
                scoring.record('void', null, null, null, undoTarget!.id);
              }}
            />
          </>
        )}
      </View>

      {prompt ?? menuOverlay}
      {scoring.conflict && (
        <View pointerEvents="none" style={{ position: 'absolute', top: theme.spacing[8], left: 0, right: 0, alignItems: 'center' }}>
          <Text color="paperWhite" style={{ backgroundColor: theme.colors.danger, padding: theme.spacing[8], borderRadius: theme.radii.chip }}>This match conflicted with the server ({scoring.conflict}). A tournament director will review it.</Text>
        </View>
      )}
    </Fullscreen>
  );
}
