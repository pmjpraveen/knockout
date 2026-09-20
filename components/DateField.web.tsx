import type { DateFieldProps } from '@/components/DateField';
import { TextField } from '@/components/TextField';
import { formatDate, maskDate, parseDate } from '@/lib/events';

/**
 * Web has no native picker in React Native, so this is a masked DD-MM-YYYY input. While the text is
 * incomplete the raw text is passed up, which every caller's ISO validation rejects.
 */
export function DateField({ label, value, onChange, plainLabel }: DateFieldProps) {
  return (
    <TextField
      label={label}
      plainLabel={plainLabel}
      value={formatDate(value)}
      placeholder="DD-MM-YYYY"
      keyboardType="numeric"
      onChangeText={(text) => {
        const masked = maskDate(text);
        onChange(parseDate(masked) ?? masked);
      }}
    />
  );
}
