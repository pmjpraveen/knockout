/** Digits only; a pasted +91 or leading 0 is dropped so the 10 digits that remain are the number itself. */
export function mobileDigits(raw: string) {
  const digits = raw.replace(/\D/g, '');
  return (digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits).slice(0, 10);
}

/** A club's mobile number: exactly 10 digits, without the country code. */
export const mobileProblem = (value: string) => (/^\d{10}$/.test(value) ? null : 'Enter a 10-digit mobile number without the country code.');
