import Calendar from 'lucide-react-native/icons/calendar';
import { useRef } from 'react';
import { Pressable } from 'react-native';
import type { DateFieldProps } from '@/components/DateField';
import { TextField } from '@/components/TextField';
import { dateToIso, formatDate, isDate, maskDate, parseDate } from '@/lib/events';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

/**
 * A masked DD-MM-YYYY input plus a calendar button that opens the browser's own date picker. While the typed text
 * is incomplete the raw text is passed up, which every caller's ISO validation rejects.
 */
export function DateField({ label, value, onChange, maximumDate }: DateFieldProps) {
  const picker = useRef<HTMLInputElement>(null);

  const open = () => {
    const input = picker.current;
    if (!input) return;
    if (input.showPicker) input.showPicker();
    else input.click();
  };

  return (
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Choose ${label} from a calendar`}
            hitSlop={theme.spacing[4]}
            onPress={open}
            style={({ pressed }) => [{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, pressFeedback(pressed)]}
          >
            <Calendar size={20} color={theme.colors.charcoal} strokeWidth={1.75} />
          </Pressable>
          <input
            ref={picker}
            type="date"
            tabIndex={-1}
            aria-hidden
            value={isDate(value) ? value : ''}
            max={maximumDate ? dateToIso(maximumDate) : undefined}
            onChange={(event) => onChange(event.target.value)}
            style={{ position: 'absolute', right: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 0, padding: 0 }}
          />
        </>
      }
    />
  );
}
