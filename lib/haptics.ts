import * as Haptics from 'expo-haptics';

// Reserved for moments that matter, always fired in the same handler as the visual change so the
// tap, the screen and the buzz land together. Fire-and-forget: nothing waits on a vibration.
export const haptic = {
  /** A point is scored, a clock is paused or resumed, something is undone. */
  tap: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  /** The match starts. */
  start: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  /** A penalty is given, time runs out, or a destructive button is armed. */
  warning: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  /** A result is confirmed. */
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  /** The server rejected something the scorekeeper did. */
  error: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};
