import { createContext, ReactNode, useContext } from 'react';
import { PixelRatio, Pressable, View } from 'react-native';
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
      <Text variant="bodyLg" weight="medium" maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
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
        <Text variant="bodyLg" weight="medium" color="paperWhite" numberOfLines={1} maxFontSizeMultiplier={1.2} importantForAccessibility="no" accessibilityElementsHidden>{name}</Text>
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

/** Black pill; turns Warning Amber in the final 10 seconds. */
export function MatchClock({ remaining }: { remaining: number }) {
  const whole = Math.ceil(remaining);
  const low = whole <= 10;
  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`${Math.floor(whole / 60)} minutes ${whole % 60} seconds remaining`}
      style={{ backgroundColor: low ? theme.colors.warning : theme.colors.inkBlack, borderRadius: theme.radii.button, paddingHorizontal: theme.spacing[16] }}
    >
      <Text variant="timerDisplay" color="paperWhite">{pad(Math.floor(whole / 60))}:{pad(whole % 60)}</Text>
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
      <Text variant="body" weight="medium" color={color}>{message}</Text>
      {pending > 0 && <Button title="Sync now" variant="secondary" onPress={syncNow} />}
    </View>
  );
}

const methodLabel = (method: string) => humanize(method).toLowerCase();

/** The confirm step: nothing finalizes or advances the bracket until this is accepted. */
export function ResultConfirm({ outcome, names, onConfirm, onCancel, busy }: {
  outcome: Outcome & { note?: string | null };
  names: Record<string, string>;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Reveal y={16} style={{ borderWidth: 1, borderColor: theme.colors.inkBlack, borderRadius: theme.radii.card, padding: theme.spacing[16], gap: theme.spacing[12] }}>
      <Text variant="subheading" weight="medium">Confirm result</Text>
      <Text variant="bodyLg">{names[outcome.winner]} wins by {methodLabel(outcome.method)}.</Text>
      {outcome.note ? <Text color="slateGray">{outcome.note}</Text> : null}
      <Text variant="body" color="slateGray">This ends the match and advances the bracket.</Text>
      <Button title="Confirm result" variant="success" disabled={busy} onPress={() => { haptic.success(); onConfirm(); }} />
      <Button title="Back to scoring" variant="secondary" onPress={onCancel} />
    </Reveal>
  );
}
