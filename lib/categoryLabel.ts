export type CategoryCriteria = {
  discipline: string;
  gender: string | null;
  age_min: number | null;
  age_max: number | null;
  weight_min: number | null;
  weight_max: number | null;
  belt_min: string | null;
  belt_max: string | null;
};

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

const range = (min: number | null, max: number | null, unit: string) => {
  if (min !== null && max !== null) return `${min}–${max}${unit}`;
  if (max !== null) return `-${max}${unit}`;
  if (min !== null) return `+${min}${unit}`;
  return null;
};

/** Suggested label when the Organizer doesn't type one, e.g. "Kumite Male 12–14y -40kg Orange–Green". */
export function defaultLabel(c: CategoryCriteria) {
  const belts = c.belt_min && c.belt_max && c.belt_min !== c.belt_max ? `${c.belt_min}–${c.belt_max}` : c.belt_min || c.belt_max;
  return [
    capitalize(c.discipline),
    c.gender && capitalize(c.gender),
    range(c.age_min, c.age_max, 'y'),
    range(c.weight_min, c.weight_max, 'kg'),
    belts,
  ]
    .filter(Boolean)
    .join(' ');
}
