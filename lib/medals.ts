export type Finisher = { place: number; athlete: string; club: string | null };

export type Tally = { club: string; gold: number; silver: number; bronze: number };

const noClub = 'No club';

/** Medals per club: 1st is gold, 2nd silver, 3rd bronze (two athletes sharing 3rd each bring one). Most golds first, then silvers, then bronzes. */
export function medalTally(results: { finishers: Finisher[] }[]): Tally[] {
  const clubs = new Map<string, Tally>();
  for (const { finishers } of results) {
    for (const { place, club } of finishers) {
      if (place < 1 || place > 3) continue;
      const name = club?.trim() || noClub;
      const tally = clubs.get(name) ?? { club: name, gold: 0, silver: 0, bronze: 0 };
      if (place === 1) tally.gold += 1;
      else if (place === 2) tally.silver += 1;
      else tally.bronze += 1;
      clubs.set(name, tally);
    }
  }
  return [...clubs.values()].sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.club.localeCompare(b.club));
}
