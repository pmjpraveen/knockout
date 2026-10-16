import type { CategoryCriteria } from './categoryLabel.ts';

/** What is wrong with a category's limits, in words, or null when they are fine. `belts` is the event's ladder, lowest first. */
export function categoryProblem(c: CategoryCriteria, belts: readonly string[]) {
  const ages = [c.age_min, c.age_max];
  const numbers = [...ages, c.weight_min, c.weight_max];
  if (numbers.some((n) => n !== null && Number.isNaN(n))) return 'Age and weight must be numbers.';
  if (numbers.some((n) => n !== null && n < 0)) return 'Age and weight cannot be negative.';
  if (ages.some((n) => n !== null && !Number.isInteger(n))) return 'Age must be a whole number of years.';
  if (c.age_min !== null && c.age_max !== null && c.age_min > c.age_max) return 'Minimum age is above the maximum.';
  if (c.weight_min !== null && c.weight_max !== null && c.weight_min > c.weight_max) return 'Minimum weight is above the maximum.';
  const [from, to] = [c.belt_min, c.belt_max].map((belt) => (belt ? belts.indexOf(belt) : -1));
  if (from >= 0 && to >= 0 && from > to) return 'Belt from is above belt to.';
  return null;
}

/** True when another category of the event already has this label (ignoring case and surrounding spaces). */
export const labelTaken = (label: string, others: readonly { label: string }[]) => others.some((other) => other.label.trim().toLowerCase() === label.trim().toLowerCase());
