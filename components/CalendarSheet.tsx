import X from 'lucide-react-native/icons/x';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Modal, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { dateToIso, isDate, isoToDate } from '@/lib/events';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

type Props = {
  visible: boolean;
  title: string;
  /** ISO date (YYYY-MM-DD), or '' when empty. */
  value: string;
  /** Earlier days are greyed out and cannot be chosen, and the list starts at this month. */
  minimumDate?: Date;
  /** Later days are greyed out and cannot be chosen. */
  maximumDate?: Date;
  /** The month shown when nothing is chosen yet, e.g. a plausible birth year. */
  startAt?: Date;
  onSelect: (iso: string) => void;
  onClose: () => void;
};

const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const yearsBack = 100;
const yearsAhead = 10;
const cell = theme.touchTarget.minimum;
const titleHeight = 40;
const weeksIn = (year: number, month: number) => Math.ceil((new Date(year, month, 1).getDay() + new Date(year, month + 1, 0).getDate()) / 7);
/** The month `position` months after the given one. */
const monthAfter = (year: number, month: number, position: number) => {
  const absolute = year * 12 + month + position;
  return { year: Math.floor(absolute / 12), month: absolute % 12 };
};
const monthGap = theme.spacing[24];
const monthHeight = (year: number, month: number) => titleHeight + cell * weeksIn(year, month) + monthGap;

const monthTitle = (year: number, month: number) => new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const isoOf = (year: number, month: number, day: number) => dateToIso(new Date(year, month, day, 12));
const listHeight = titleHeight + cell * 8;
const dayWidth = `${100 / 7}%` as const;

/** A calendar in a sheet: one month at a time, with a year list for far-off dates such as birthdays. */
export function CalendarSheet({ visible, onClose, ...rest }: Props) {
  const insets = useSafeAreaInsets();
  const web = Platform.OS === 'web';
  const reduceMotion = useReduceMotion();
  const { height: windowHeight } = useWindowDimensions();
  const [rendered, setRendered] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(windowHeight);
  const progress = useRef(new Animated.Value(0)).current;

  // The scrim fades while the sheet slides, so they are animated apart (the Modal's own slide would carry the scrim
  // in with the sheet). It stays mounted through the close animation.
  useEffect(() => {
    if (visible) {
      setRendered(true);
      if (reduceMotion) return progress.setValue(1);
      Animated.timing(progress, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (reduceMotion) {
      progress.setValue(0);
      setRendered(false);
    } else {
      Animated.timing(progress, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => finished && setRendered(false));
    }
  }, [visible, reduceMotion, progress]);

  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: web ? 'center' : 'flex-end' }}>
        <Pressable accessibilityLabel="Close calendar" onPress={onClose} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
          <Animated.View style={{ flex: 1, backgroundColor: theme.colors.inkBlack, opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }} />
        </Pressable>
        <Animated.View
          onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
          style={{
            alignSelf: 'center',
            width: '100%',
            maxWidth: 420,
            backgroundColor: theme.colors.paperWhite,
            borderRadius: web ? theme.radii.sheetTop : 0,
            borderTopLeftRadius: theme.radii.sheetTop,
            borderTopRightRadius: theme.radii.sheetTop,
            paddingHorizontal: theme.spacing[16],
            paddingTop: theme.spacing[16],
            paddingBottom: (web ? 0 : insets.bottom) + theme.spacing[24],
            gap: theme.spacing[12],
            opacity: web ? progress : 1,
            transform: web ? undefined : [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] }) }],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: theme.spacing[8] }}>
            <Text variant="headingSm" accessibilityRole="header">{rest.title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close calendar" onPress={onClose} style={({ pressed }) => [{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center' }, pressFeedback(pressed)]}>
              <X size={22} color={theme.colors.inkBlack} strokeWidth={1.75} />
            </Pressable>
          </View>
          <Calendar {...rest} />
        </Animated.View>
      </View>
    </Modal>
  );
}

function Calendar({ value, minimumDate, maximumDate, startAt, onSelect }: Omit<Props, 'visible' | 'onClose' | 'title'>) {
  const selected = isDate(value) ? value : null;
  const opening = selected ? isoToDate(selected) : (startAt ?? new Date());
  const today = dateToIso(new Date());
  const earliest = minimumDate ? dateToIso(minimumDate) : null;
  const latest = maximumDate ? dateToIso(maximumDate) : null;

  const newest = latest ? Number(latest.slice(0, 4)) : new Date().getFullYear() + yearsAhead;
  const firstYear = minimumDate ? minimumDate.getFullYear() : newest - yearsBack - yearsAhead;
  const firstMonth = minimumDate ? minimumDate.getMonth() : 0;
  const lastMonth = latest ? Number(latest.slice(5, 7)) - 1 : 11;
  const monthAt = (position: number) => monthAfter(firstYear, firstMonth, position);
  // Each month's top edge, so the list can jump straight to any month without measuring it.
  const layout = useMemo(() => {
    const count = Math.max(1, (newest - firstYear) * 12 + lastMonth - firstMonth + 1);
    const lengths = Array.from({ length: count }, (_, i) => { const { year, month } = monthAfter(firstYear, firstMonth, i); return monthHeight(year, month); });
    let top = 0;
    const offsets = lengths.map((length) => { const offset = top; top += length; return offset; });
    return { months: Array.from({ length: count }, (_, i) => i), lengths, offsets };
  }, [newest, firstYear, firstMonth, lastMonth]);
  const indexOf = (year: number, month: number) => Math.min(Math.max((year - firstYear) * 12 + month - firstMonth, 0), layout.months.length - 1);

  const [anchor, setAnchor] = useState(indexOf(opening.getFullYear(), opening.getMonth()));
  const [choosingYearOf, setChoosingYearOf] = useState<number | null>(null);

  const pickYear = (year: number) => {
    setAnchor(indexOf(year, monthAt(choosingYearOf ?? 0).month));
    setChoosingYearOf(null);
  };

  if (choosingYearOf !== null) {
    const shownYear = monthAt(choosingYearOf).year;
    return (
      <ScrollView style={{ height: listHeight }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Array.from({ length: newest - firstYear + 1 }, (_, i) => newest - i).map((y) => (
          <Pressable key={y} accessibilityRole="button" accessibilityState={{ selected: y === shownYear }} onPress={() => pickYear(y)} style={{ width: '33.33%', height: cell, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ minWidth: 72, height: 40, borderRadius: theme.radii.button, alignItems: 'center', justifyContent: 'center', backgroundColor: y === shownYear ? theme.colors.inkBlack : 'transparent' }}>
              <Text variant="bodyLg" color={y === shownYear ? 'paperWhite' : 'inkBlack'}>{y}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {weekdays.map((letter, i) => (
          <View key={i} style={{ width: dayWidth, alignItems: 'center', paddingVertical: theme.spacing[8] }}>
            <Text variant="bodyLg" color="slateGray">{letter}</Text>
          </View>
        ))}
      </View>
      <FlatList
        data={layout.months}
        keyExtractor={String}
        style={{ height: listHeight }}
        getItemLayout={(_, index) => ({ length: layout.lengths[index], offset: layout.offsets[index], index })}
        initialScrollIndex={anchor}
        initialNumToRender={3}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <Month {...monthAt(item)} selected={selected} today={today} earliest={earliest} latest={latest} onSelect={onSelect} onTitle={() => setChoosingYearOf(item)} />}
      />
    </View>
  );
}

type MonthProps = { year: number; month: number; selected: string | null; today: string; earliest: string | null; latest: string | null; onSelect: (iso: string) => void; onTitle: () => void };

function Month({ year, month, selected, today, earliest, latest, onSelect, onTitle }: MonthProps) {
  const blanks = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();

  return (
    <View style={{ height: monthHeight(year, month) }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${monthTitle(year, month)}, choose a year`}
        onPress={onTitle}
        style={({ pressed }) => [{ height: titleHeight, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: theme.spacing[8] }, pressFeedback(pressed)]}
      >
        <Text variant="bodyLg" weight="medium">{monthTitle(year, month)}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Array.from({ length: blanks }, (_, i) => <View key={`blank-${i}`} style={{ width: dayWidth, height: cell }} />)}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const iso = isoOf(year, month, day);
          const disabled = (earliest !== null && iso < earliest) || (latest !== null && iso > latest);
          const chosen = iso === selected;
          return (
            <Pressable
              key={iso}
              accessibilityRole="button"
              accessibilityLabel={isoToDate(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              accessibilityState={{ selected: chosen, disabled }}
              disabled={disabled}
              onPress={() => onSelect(iso)}
              style={({ pressed }) => [{ width: dayWidth, height: cell, alignItems: 'center', justifyContent: 'center' }, pressFeedback(pressed)]}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: theme.radii.button,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: chosen ? theme.colors.inkBlack : 'transparent',
                  borderWidth: iso === today && !chosen ? 1 : 0,
                  borderColor: theme.colors.inkBlack,
                }}
              >
                <Text
                  variant="bodyLg"
                  weight={chosen ? 'medium' : 'regular'}
                  color={chosen ? 'paperWhite' : disabled ? 'steelGray' : 'inkBlack'}
                >
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
