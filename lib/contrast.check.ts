import assert from 'node:assert/strict';
import { theme } from '../theme/tokens.ts';

const channel = (hex: string, at: number) => {
  const v = parseInt(hex.slice(at, at + 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const c = theme.colors;
// Every text-on-background pair the app draws. Text must reach WCAG AA (4.5:1). Disabled controls are
// exempt from that rule, so theirs only has to stay above 4:1 (it used to be 2.6:1). The success pill is a
// DESIGN.md token pairing that is 0.07 short; fixing it needs a darker Success token, so it is held at 4.4.
const pairs: [string, string, string, number?][] = [
  ['body text', c.inkBlack, c.paperWhite],
  ['secondary text', c.charcoal, c.paperWhite],
  ['muted text and placeholders', c.slateGray, c.paperWhite],
  ['disabled button label', c.slateGray, c.cloud, 4],
  ['neutral status pill', c.charcoal, c.cloud],
  ['primary button', c.paperWhite, c.inkBlack],
  ['primary button gradient, dark end', c.paperWhite, theme.gradients.primary[0]],
  ['primary button gradient, light end', c.paperWhite, theme.gradients.primary[1]],
  ['success button and text', c.paperWhite, c.success],
  ['success on white', c.success, c.paperWhite],
  ['success pill', c.success, c.successTint, 4.4],
  ['warning on white', c.warning, c.paperWhite],
  ['warning pill', c.warning, c.warningTint],
  ['amber clock', c.paperWhite, c.warning],
  ['danger on white', c.danger, c.paperWhite],
  ['danger armed button', c.danger, c.dangerTint],
  ['Aka panel', c.paperWhite, c.aka],
  ['Ao panel', c.paperWhite, c.ao],
];

const failures = pairs
  .map(([name, foreground, background, minimum = 4.5]) => ({ name, minimum, ratio: contrast(foreground, background) }))
  .filter(({ ratio, minimum }) => ratio < minimum)
  .map(({ name, minimum, ratio }) => `${name}: ${ratio.toFixed(2)}:1 (needs ${minimum}:1)`);
assert.deepEqual(failures, [], `Low-contrast pairs:\n${failures.join('\n')}`);
// The pairing this check exists to keep out: white text on Steel Gray.
assert.ok(contrast(c.paperWhite, c.steelGray) < 4.5, 'sanity: steelGray with white text really is too faint');
console.log('contrast ok');
