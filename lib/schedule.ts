export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const sideLabel: Record<string, string> = {
  repechage_top: 'Repechage',
  repechage_bottom: 'Repechage',
  grand_final: 'Grand final',
  reset: 'Bracket reset',
};

export function matchLabel(side: string, round: number) {
  if (sideLabel[side]) return sideLabel[side];
  if (side === 'winners') return `Winners round ${round}`;
  if (side === 'losers') return `Losers round ${round}`;
  return `Round ${round}`;
}

export const queueLabels = ['Current', 'On deck', 'Up next'];
