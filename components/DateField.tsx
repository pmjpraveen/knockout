import { useState } from 'react';
import { Pressable } from 'react-native';
import { CalendarSheet } from '@/components/CalendarSheet';
import { ClearFieldButton } from '@/components/ClearFieldButton';
import { TextField } from '@/components/TextField';
import { formatDate } from '@/lib/events';

export type DateFieldProps = {
  label: string;
  /** ISO date (YYYY-MM-DD), or '' when empty. */
  value: string;
  onChange: (value: string) => void;
  /** Shows a cross in the field that empties it. */
  clearable?: boolean;
  /** Earlier days are disabled and the calendar starts at this month. */
  minimumDate?: Date;
  maximumDate?: Date;
  /** Where the calendar opens when nothing is chosen yet, e.g. a plausible birth year. */
  startAt?: Date;
};

/** Tapping the field opens the calendar sheet; the field shows DD-MM-YYYY. (The web version is DateField.web.tsx.) */
export function DateField({ label, value, onChange, clearable, minimumDate, maximumDate, startAt }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const clear = clearable && value ? () => onChange('') : null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value ? formatDate(value) : 'not set'}`}
        accessibilityActions={clear ? [{ name: 'clear', label: `Clear ${label}` }] : undefined}
        onAccessibilityAction={clear ?? undefined}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        onPress={() => setOpen(true)}
      >
        <TextField
          label={label}
          value={formatDate(value)}
          placeholder="DD-MM-YYYY"
          editable={false}
          pointerEvents="none"
          trailing={clear ? <ClearFieldButton label={label} onPress={clear} /> : undefined}
        />
      </Pressable>
      <CalendarSheet
        visible={open}
        title={label}
        value={value}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        startAt={startAt}
        onSelect={(iso) => { onChange(iso); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
