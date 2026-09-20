import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { dateToIso, formatDate, isDate, isoToDate } from '@/lib/events';
import { theme } from '@/theme/tokens';

export type DateFieldProps = {
  label: string;
  /** ISO date (YYYY-MM-DD), or '' when empty. */
  value: string;
  onChange: (value: string) => void;
  plainLabel?: boolean;
  clearable?: boolean;
  maximumDate?: Date;
  /** Where the picker opens when nothing is chosen yet, e.g. a plausible birth year. */
  startAt?: Date;
};

/** Native date picker on iOS and Android; the field shows DD-MM-YYYY. (The web version is DateField.web.tsx.) */
export function DateField({ label, value, onChange, plainLabel, clearable, maximumDate, startAt }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const ios = Platform.OS === 'ios';
  const shownInPicker = isDate(value) ? isoToDate(value) : (startAt ?? maximumDate ?? new Date());

  return (
    <View style={{ gap: theme.spacing[8] }}>
      <Pressable accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })} accessibilityLabel={`${label}, ${value ? formatDate(value) : 'not set'}`} onPress={() => setOpen((o) => !o)}>
        <View style={{ pointerEvents: 'none' }}>
          <TextField label={label} plainLabel={plainLabel} value={formatDate(value)} placeholder="DD-MM-YYYY" editable={false} />
        </View>
      </Pressable>
      {open && (
        <DateTimePicker
          mode="date"
          display={ios ? 'spinner' : 'default'}
          value={shownInPicker}
          maximumDate={maximumDate}
          onChange={(event, date) => {
            if (!ios) setOpen(false);
            if (event.type === 'set' && date) onChange(dateToIso(date));
          }}
        />
      )}
      {open && ios && <Button
          title="Done"
          variant="secondary"
          onPress={() => {
            if (!isDate(value)) onChange(dateToIso(shownInPicker)); // closing on the date the spinner shows accepts it
            setOpen(false);
          }}
        />}
      {clearable && value ? <Button title="Clear date" variant="secondary" onPress={() => onChange('')} /> : null}
    </View>
  );
}
