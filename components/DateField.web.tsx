import Calendar from 'lucide-react-native/icons/calendar';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { CalendarSheet } from '@/components/CalendarSheet';
import { ClearFieldButton } from '@/components/ClearFieldButton';
import type { DateFieldProps } from '@/components/DateField';
import { TextField } from '@/components/TextField';
import { formatDate, maskDate, parseDate } from '@/lib/events';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

/**
 * A masked DD-MM-YYYY input plus a calendar button that opens the calendar sheet. While the typed text
 * is incomplete the raw text is passed up, which every caller's ISO validation rejects.
 */
export function DateField({ label, value, onChange, clearable, minimumDate, maximumDate, startAt }: DateFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TextField
        label={label}
        value={formatDate(value)}
        placeholder="DD-MM-YYYY"
        keyboardType="numeric"
        onChangeText={(text) => {
          const masked = maskDate(text);
          onChange(parseDate(masked) ?? masked);
        }}
        trailing={
          <>
            {clearable && value ? <ClearFieldButton label={label} onPress={() => onChange('')} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Choose ${label} from a calendar`}
              hitSlop={theme.spacing[4]}
              onPress={() => setOpen(true)}
              style={({ pressed }) => [{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, pressFeedback(pressed)]}
            >
              <Calendar size={20} color={theme.colors.charcoal} strokeWidth={1.75} />
            </Pressable>
          </>
        }
      />
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
