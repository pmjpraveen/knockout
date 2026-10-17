import Trophy from 'lucide-react-native/icons/trophy';
import { createContext, ReactNode, useContext, useState } from 'react';
import { PixelRatio, Pressable, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { Button } from '@/components/Button';
import { Pop, Reveal } from '@/components/Motion';
import { Text } from '@/components/Text';
import { haptic } from '@/lib/haptics';
import { pressFeedback } from '@/lib/press';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { humanize } from '@/lib/events';
import type { Outcome } from '@/lib/scoring';
import { theme } from '@/theme/tokens';

export type ScoreboardRow = {
  match_id: string;
  category_label: string;
  scoring_mode: string;
  match_seconds: number;
  judge_panel: number;
  athlete_a_id: string;
  athlete_a: string;
  athlete_b_id: string;
  athlete_b: string;
  /** Missing on rows cached before clubs were added. */
  club_a?: string | null;
  club_b?: string | null;
};

const CornerContext = createContext<string | null>(null);

/** White score-entry button on a competitor's half: 56pt+ tall, label only. */
export function ScoreButton({ title, onPress, disabled, penalty }: { title: string; onPress: () => void; disabled?: boolean; penalty?: boolean }) {
  const corner = useContext(CornerContext);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={corner ? `${title}, ${corner}` : title}
      accessibilityState={{ disabled: !!disabled }}
      onPress={() => {
        (penalty ? haptic.warning : haptic.tap)();
        onPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [{
        minHeight: theme.touchTarget.scoreButton,
        borderRadius: theme.radii.card,
        backgroundColor: theme.colors.paperWhite,
        opacity: disabled ? 0.5 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing[12],
      }, pressFeedback(pressed)]}
    >
      <Text variant="bodyLg" maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
    </Pressable>
  );
}

// Room for the clock pill above the names: its height at the largest text scale the clock is allowed.
const clockSpace = () => theme.spacing[8] + Math.ceil(theme.type.timerDisplay.fontSize * Math.min(PixelRatio.getFontScale(), 1.15)) + theme.spacing[8];

function Half({ corner, name, total, totalStyle, children }: { corner: 'aka' | 'ao'; name: string; total: string; totalStyle: 'scoreDisplay' | 'timerDisplay'; children: ReactNode }) {
  const spoken = `${corner === 'aka' ? 'Aka' : 'Ao'} corner, ${name}`;
  return (
    <CornerContext.Provider value={spoken}>
      <View style={{ flex: 1, backgroundColor: theme.colors[corner], padding: theme.spacing[12], paddingTop: clockSpace(), gap: theme.spacing[8] }}>
        <Text variant="bodyLg" color="paperWhite" numberOfLines={1} maxFontSizeMultiplier={1.2} importantForAccessibility="no" accessibilityElementsHidden>{name}</Text>
        <Pop trigger={total} style={{ alignSelf: 'flex-start' }}>
          <Text variant={totalStyle} color="paperWhite" accessibilityLabel={total ? `${spoken}: ${total}` : spoken}>{total}</Text>
        </Pop>
        {children}
      </View>
    </CornerContext.Provider>
  );
}

/** Full-width Aka | Ao split; the clock pill overlaps both halves at the top centre. */
export function ScorePanel({ clock, aka, ao, totalStyle = 'scoreDisplay' }: {
  clock?: ReactNode;
  aka: { name: string; total: string; children: ReactNode };
  ao: { name: string; total: string; children: ReactNode };
  totalStyle?: 'scoreDisplay' | 'timerDisplay';
}) {
  return (
    <View style={{ borderRadius: theme.radii.scorePanel, overflow: 'hidden', ...theme.shadows.scorePanel }}>
      <View style={{ flexDirection: 'row' }}>
        <Half corner="aka" totalStyle={totalStyle} {...aka} />
        <Half corner="ao" totalStyle={totalStyle} {...ao} />
      </View>
      {clock && <View pointerEvents="none" style={{ position: 'absolute', top: theme.spacing[8], left: 0, right: 0, alignItems: 'center' }}>{clock}</View>}
    </View>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

const ring = 8;
// A line box taller than the glyphs, so the digits are never clipped, centred in the pill both ways.
const clockText = { fontFamily: theme.fonts.monoMedium, fontSize: 32, lineHeight: 44, textAlign: 'center', includeFontPadding: false } as const;
export const clockHeight = 64;

/** Black pill whose green ring runs down with the time and is gone at 00:00. It turns Warning Amber in the final 10 seconds. */
export function MatchClock({ remaining, total }: { remaining: number; total: number }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const whole = Math.ceil(remaining);
  const low = whole <= 10;
  const { width, height } = size;
  const w = width - ring;
  const h = height - ring;
  const r = h / 2;
  const half = ring / 2;
  const length = 2 * (w - h) + Math.PI * h;
  const left = Math.max(0, Math.min(1, remaining / total)) * length;
  // Starts at the top centre and runs clockwise, so the ring shrinks back towards the top.
  const path = `M ${half + w / 2} ${half} H ${half + w - r} A ${r} ${r} 0 0 1 ${half + w - r} ${half + h} H ${half + r} A ${r} ${r} 0 0 1 ${half + r} ${half} H ${half + w / 2}`;
  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`${Math.floor(whole / 60)} minutes ${whole % 60} seconds remaining`}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={{ backgroundColor: low ? theme.colors.warning : theme.colors.inkBlack, borderRadius: theme.radii.button, height: clockHeight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing[16] + ring }}
    >
      {width > 0 && left > 0 && (
        <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Path d={path} fill="none" stroke={low ? theme.colors.paperWhite : theme.colors.success} strokeWidth={ring} strokeDasharray={`${left} ${length}`} />
        </Svg>
      )}
      <Text variant="timerDisplay" color="paperWhite" style={clockText}>{pad(Math.floor(whole / 60))}:{pad(whole % 60)}</Text>
    </View>
  );
}

export function SyncBanner() {
  const { pending, lastSync, stale, syncNow } = useSyncStatus();
  const tone = stale ? 'dangerTint' : pending ? 'warningTint' : 'successTint';
  const color = stale ? 'danger' : pending ? 'warning' : 'success';
  const message = stale
    ? `${pending} changes have not synced for over 10 minutes. Find a connection when you can.`
    : pending
      ? `${pending} change(s) saved on this device, waiting to sync.`
      : `All changes synced${lastSync ? ` at ${new Date(lastSync).toLocaleTimeString()}` : ''}.`;
  return (
    <View accessibilityLiveRegion="polite" style={{ backgroundColor: theme.colors[tone], borderRadius: theme.radii.chip, padding: theme.spacing[12], gap: theme.spacing[4] }}>
      <Text variant="body" color={color}>{message}</Text>
      {pending > 0 && <Button title="Sync now" variant="secondary" onPress={syncNow} />}
    </View>
  );
}

const methodLabel = (method: string) => humanize(method).toLowerCase();

/** Who won and how: a trophy badge, a small caption, the winner's name and the way they won. */
export function WinnerHeader({ eyebrow, name, line }: { eyebrow: string; name: string; line: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[12] }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.successTint, alignItems: 'center', justifyContent: 'center' }}>
        <Trophy size={22} color={theme.colors.success} strokeWidth={1.75} />
      </View>
      <View style={{ flex: 1, gap: theme.spacing[4] }}>
        <Text variant="label" color="slateGray" style={{ textTransform: 'uppercase' }}>{eyebrow}</Text>
        <Text variant="subheading" numberOfLines={1}>{name}</Text>
        <Text color="slateGray">{line}</Text>
      </View>
    </View>
  );
}

/** The match is over: who won, that it is saved on this device, the sync state and the way back to the queue. */
export function MatchDone({ winner, onDone }: { winner: string; onDone: () => void }) {
  return (
    <View style={{ alignItems: 'center', gap: theme.spacing[16] }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.successTint, alignItems: 'center', justifyContent: 'center' }}>
        <Trophy size={30} color={theme.colors.success} strokeWidth={1.75} />
      </View>
      <View style={{ alignItems: 'center', gap: theme.spacing[4] }}>
        <Text variant="heading" style={{ textAlign: 'center' }}>{winner} wins</Text>
        <Text color="slateGray" style={{ textAlign: 'center' }}>Recorded on this device. It syncs when a connection is available.</Text>
      </View>
      <View style={{ alignSelf: 'stretch' }}><SyncBanner /></View>
      <View style={{ alignSelf: 'stretch' }}><Button size="large" title="Back to the queue" onPress={onDone} /></View>
    </View>
  );
}

/** The confirm step: nothing finalizes or advances the bracket until this is accepted. */
export function ResultConfirm({ outcome, names, onConfirm, onCancel, busy, framed = true }: {
  outcome: Outcome;
  names: Record<string, string>;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  /** False when it already sits inside a card (the scoring overlay), so it adds no border of its own. */
  framed?: boolean;
}) {
  const frame = framed ? { borderWidth: 1, borderColor: theme.colors.mist, borderRadius: theme.radii.card, padding: theme.spacing[16], backgroundColor: theme.colors.paperWhite } : {};
  return (
    <Reveal y={16} style={{ gap: theme.spacing[16], ...frame }}>
      <WinnerHeader eyebrow="Confirm result" name={names[outcome.winner]} line={`wins by ${methodLabel(outcome.method)}`} />
      {outcome.note ? <Text color="slateGray">{outcome.note}</Text> : null}
      <Text variant="body" color="slateGray">This ends the match and advances the bracket.</Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing[12] }}>
        <View style={{ flex: 1 }}><Button size="large" title="Back" variant="secondary" onPress={onCancel} /></View>
        <View style={{ flex: 2 }}><Button size="large" title="Confirm result" variant="success" disabled={busy} onPress={() => { haptic.success(); onConfirm(); }} /></View>
      </View>
    </Reveal>
  );
}
