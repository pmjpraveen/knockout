import { useRouter } from 'expo-router';
import { ReactNode, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { ChoiceChips } from '@/components/ChoiceChips';
import { FormSection, SectionDivider } from '@/components/FormSection';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useEventBelts } from '@/hooks/useEventBelts';
import { useEventDays } from '@/hooks/useEventDays';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { defaultLabel } from '@/lib/categoryLabel';
import { categoryProblem, labelTaken } from '@/lib/categoryRules';
import { dayLabels } from '@/lib/schedule';
import { bracketFormatLabels, bracketFormats, CategoryRow, disciplines, genders, scoringModes, toNumber } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

type Props = { eventId: string; category?: CategoryRow; initialStatus?: string; header?: ReactNode };

const text = (value: number | string | null | undefined) => (value === null || value === undefined ? '' : String(value));

export function CategoryForm({ eventId, category, initialStatus, header }: Props) {
  const router = useRouter();
  const belts = useEventBelts(eventId);
  const single = belts.length === 1; // "Any" would just repeat the only belt
  const beltOptions = single ? belts : ['', ...belts];
  const beltLabels = { '': 'Any' };
  const [label, setLabel] = useState(category?.label ?? '');
  const [discipline, setDiscipline] = useState<(typeof disciplines)[number]>((category?.discipline as (typeof disciplines)[number]) ?? 'kumite');
  const [gender, setGender] = useState<(typeof genders)[number]>((category?.gender as (typeof genders)[number]) ?? 'any');
  const [ageMin, setAgeMin] = useState(text(category?.age_min));
  const [ageMax, setAgeMax] = useState(text(category?.age_max));
  const [weightMin, setWeightMin] = useState(text(category?.weight_min));
  const [weightMax, setWeightMax] = useState(text(category?.weight_max));
  const [beltMin, setBeltMin] = useState(category?.belt_min ?? '');
  const [beltMax, setBeltMax] = useState(category?.belt_max ?? '');
  const [format, setFormat] = useState<(typeof bracketFormats)[number]>((category?.bracket_format as (typeof bracketFormats)[number]) ?? 'single_elim_repechage');
  const [scoringMode, setScoringMode] = useState(category?.scoring_mode ?? '');
  const [panel, setPanel] = useState(String(category?.judge_panel ?? 5));
  const [matchSeconds, setMatchSeconds] = useState(text(category?.match_seconds));
  const days = useEventDays(eventId, [category?.event_day ?? null]);
  const [pickedDay, setPickedDay] = useState<string | null>(category?.event_day ?? null);
  const day = pickedDay ?? days[0] ?? null;
  const [invalid, setInvalid] = useState<string | null>(null);
  const { run, busy, error } = useSubmit();
  const { rows: siblings } = useFocusQuery(() => supabase.from('categories').select('id, label').eq('event_id', eventId), [eventId]);
  const others = siblings.filter((sibling) => sibling.id !== category?.id);
  const { rows: entered } = useFocusQuery(() => supabase.from('registrations').select('id').eq('category_id', category!.id), [category?.id], undefined, !!category);
  const hasBracket = ['bracket_generated', 'in_progress', 'completed'].includes(category?.status ?? '');
  const loses = [entered.length ? `${entered.length} ${entered.length === 1 ? 'participant' : 'participants'}` : null, hasBracket ? 'its bracket' : null].filter(Boolean).join(' and ');

  const criteria = {
    discipline,
    gender: gender === 'any' ? null : gender,
    age_min: toNumber(ageMin),
    age_max: toNumber(ageMax),
    weight_min: toNumber(weightMin),
    weight_max: toNumber(weightMax),
    belt_min: beltMin || null,
    belt_max: beltMax || null,
  };
  const suggested = defaultLabel(criteria);
  const modes = scoringModes[discipline];
  const mode = (modes as readonly string[]).includes(scoringMode) ? scoringMode : modes[0];

  const save = () => {
    const found = categoryProblem(criteria, belts);
    setInvalid(found);
    if (found) return;
    const seconds = toNumber(matchSeconds);
    if (seconds !== null && !(seconds > 0)) return setInvalid('Match time must be a number of seconds.');
    const finalLabel = label.trim() || suggested;
    if (labelTaken(finalLabel, others)) return setInvalid(`This tournament already has a category called "${finalLabel}". Change the label or the limits.`);
    const fields = {
      ...criteria, label: finalLabel, bracket_format: format,
      scoring_mode: mode, judge_panel: Number(panel), match_seconds: seconds,
      ...(day && { event_day: day }),
    };
    return run(async () => {
      const result = category
        ? await supabase.from('categories').update(fields).eq('id', category.id)
        : await supabase.from('categories').insert({ ...fields, event_id: eventId, status: initialStatus });
      if (!result.error) router.back();
      return result;
    });
  };

  const remove = () =>
    run(async () => {
      const result = await supabase.from('categories').delete().eq('id', category!.id);
      if (!result.error) router.back();
      return result;
    });

  const pair = (a: [string, (v: string) => void, string], b: [string, (v: string) => void, string]) => (
    <View style={{ flexDirection: 'row', gap: theme.spacing[16] }}>
      {[a, b].map(([value, set, name]) => (
        <View key={name} style={{ flex: 1 }}>
          <TextField label={name} value={value} onChangeText={set} keyboardType="numeric" />
        </View>
      ))}
    </View>
  );

  return (
    <Screen
      footer={
        <>
          {(invalid ?? error) && <Text color="danger">{invalid ?? error}</Text>}
          <Button size="large" title={category ? 'Save changes' : 'Add category'} disabled={busy} onPress={save} />
        </>
      }
    >
      {header && <View style={{ marginBottom: theme.spacing[8] }}>{header}</View>}
      <FormSection title="Category">
        <TextField label="Label" value={label} onChangeText={setLabel} autoCapitalize="sentences" placeholder={suggested} />
        <ChoiceChips label="Discipline" options={disciplines} value={discipline} onChange={setDiscipline} />
        <ChoiceChips label="Gender" options={genders} value={gender} onChange={setGender} />
      </FormSection>
      <SectionDivider />
      <FormSection title="Who can enter">
        {pair([ageMin, setAgeMin, 'Age min'], [ageMax, setAgeMax, 'Age max'])}
        {pair([weightMin, setWeightMin, 'Weight min (kg)'], [weightMax, setWeightMax, 'Weight max (kg)'])}
        <ChoiceChips label="Belt from" options={beltOptions} value={single ? belts[0] : beltMin} onChange={setBeltMin} labels={beltLabels} />
        <ChoiceChips label="Belt to" options={beltOptions} value={single ? belts[0] : beltMax} onChange={setBeltMax} labels={beltLabels} />
      </FormSection>
      <SectionDivider />
      <FormSection title="How it runs">
        {days.length > 1 && day && <ChoiceChips label="Runs on" options={days} value={day} labels={dayLabels(days)} onChange={setPickedDay} />}
        <ChoiceChips label="Bracket format" options={bracketFormats} value={format} labels={bracketFormatLabels} onChange={setFormat} />
        <ChoiceChips label="Scoring" options={modes} value={mode as (typeof modes)[number]} onChange={setScoringMode} />
        {mode.startsWith('kata') && <ChoiceChips label="Judges" options={['5', '7']} value={panel} onChange={setPanel} />}
        <TextField label="Match time (seconds, blank = default)" value={matchSeconds} onChangeText={setMatchSeconds} keyboardType="numeric" />
      </FormSection>
      {category && <Button title="Delete category" variant="danger" confirmTitle={loses ? `Tap again: this also deletes ${loses}` : 'Tap again to delete'} disabled={busy} onPress={remove} />}
    </Screen>
  );
}
