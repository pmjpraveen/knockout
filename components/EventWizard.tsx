import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { CoverImageField } from '@/components/CoverImageField';
import { DateField } from '@/components/DateField';
import { wideBreakpoint } from '@/components/LoginArtwork';
import { LogoLockup } from '@/components/LogoLockup';
import { StepBar } from '@/components/StepBar';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { Cover, saveCover } from '@/lib/coverImage';
import { eventFields, isDate, validateEventDates } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

type Draft = { name: string; venue: string; hostClub: string; cover: Cover | null; startDate: string; endDate: string; opens: string; closes: string };
const emptyDraft: Draft = { name: '', venue: '', hostClub: '', cover: null, startDate: '', endDate: '', opens: '', closes: '' };

const steps = [
  {
    title: 'Give some basic information about your tournament',
    hint: 'You can add the information like the name of the tournament, the venue and the club or a dojo.',
  },
  { title: 'Add a cover image for the tournament', hint: 'You can add an image to get started. You can make changes later' },
  {
    title: 'When is the tournament?',
    hint: 'You can add a start and end date of the tournament along with the start and end date for tournament registration.',
  },
];

/** Creating an event, three steps at a time. "Save & exit" keeps what is filled in as a draft event. */
export function EventWizard({ userId }: { userId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width >= wideBreakpoint;
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const { run, busy, error } = useSubmit();
  const last = step === steps.length - 1;
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Registration dates are optional. Next stays pressable and says what a step still needs.
  const missing = [
    draft.name.trim() ? null : 'Enter the tournament name to continue.',
    null,
    isDate(draft.startDate) && isDate(draft.endDate) ? null : 'Choose when the tournament starts and ends.',
  ][step];

  const goTo = (next: number) => {
    setInvalid(null);
    setStep(next);
  };

  // Saves the event as a draft (creating it the first time), then its cover. A cover that fails to save after the
  // event exists is retried on the next attempt without creating the event again.
  const save = (fields: ReturnType<typeof eventFields>) =>
    run(async () => {
      let id = eventId;
      if (id) {
        const { error: failure } = await supabase.from('events').update(fields).eq('id', id);
        if (failure) return { error: failure };
      } else {
        const { data, error: failure } = await supabase.from('events').insert({ ...fields, organizer_id: userId }).select('id').single();
        if (!data) return { error: failure };
        id = data.id;
        setEventId(id);
      }
      if (draft.cover) {
        const { error: failure } = await saveCover(id, draft.cover);
        if (failure) return { error: { message: `Your tournament was saved, but the cover image could not be saved. ${failure.message}` } };
      }
      leave();
      return { error: null };
    });

  const saveAndExit = () => {
    if (!eventId && JSON.stringify(draft) === JSON.stringify(emptyDraft)) return leave();
    if (isDate(draft.startDate) && isDate(draft.endDate) && draft.endDate < draft.startDate) return setInvalid('The end date is before the start date.');
    return save({ ...eventFields(draft), name: draft.name.trim() || 'Untitled tournament' });
  };

  const advance = () => {
    if (missing) return setInvalid(missing);
    if (!last) return goTo(step + 1);
    const problem = validateEventDates(draft);
    setInvalid(problem);
    if (!problem) return save(eventFields(draft));
  };

  const saveButton = <Button title="Save & exit" variant="secondary" disabled={busy} onPress={saveAndExit} />;
  const frame = { width: '100%', alignSelf: 'center' } as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.paperWhite }}>
      {wide && (
        <View style={[frame, { maxWidth: 1200, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: theme.spacing[16] + theme.spacing[4] }]}>
          <LogoLockup />
          {saveButton}
        </View>
      )}
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <View
          style={[
            frame,
            {
              maxWidth: wide ? 680 : 640,
              padding: wide ? 0 : theme.spacing[24],
              paddingTop: wide ? theme.spacing[32] * 2 - theme.spacing[4] : insets.top + theme.spacing[8],
              gap: theme.spacing[24],
            },
          ]}
        >
          {!wide && <View style={{ alignSelf: 'flex-start' }}>{saveButton}</View>}

          <View style={{ gap: theme.spacing[8], marginTop: wide ? 0 : theme.spacing[8], marginBottom: wide ? theme.spacing[4] : 0 }}>
            <Text variant="label" weight="medium" style={{ textTransform: 'uppercase' }}>Step {step + 1}</Text>
            <Text variant="subheading">{steps[step].title}</Text>
            <Text variant="label" weight="light" color="slateGray" style={{ lineHeight: 20 }}>{steps[step].hint}</Text>
          </View>

          {step === 0 && (
            <>
              <TextField plainLabel label="Tournament name" value={draft.name} onChangeText={(name) => set({ name })} autoCapitalize="words" />
              <TextField plainLabel label="Venue" value={draft.venue} onChangeText={(venue) => set({ venue })} autoCapitalize="words" />
              <TextField plainLabel label="Host club" value={draft.hostClub} onChangeText={(hostClub) => set({ hostClub })} autoCapitalize="words" />
            </>
          )}
          {step === 1 && <CoverImageField value={draft.cover} onChange={(cover) => set({ cover })} />}
          {step === 2 && (
            <>
              <DateField plainLabel label="Tournament starts on" value={draft.startDate} onChange={(startDate) => set({ startDate })} />
              <DateField plainLabel label="Tournament ends on" value={draft.endDate} onChange={(endDate) => set({ endDate })} />
              <DateField plainLabel label="Registration starts on" value={draft.opens} onChange={(opens) => set({ opens })} clearable />
              <DateField plainLabel label="Registration ends on" value={draft.closes} onChange={(closes) => set({ closes })} clearable />
            </>
          )}
          {(invalid ?? error) && <Text color="danger">{invalid ?? error}</Text>}
        </View>
      </ScrollView>

      <StepBar steps={steps.length} step={step} />
      <View
        style={[
          frame,
          {
            maxWidth: wide ? 1200 : 640,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: wide ? 0 : theme.spacing[24],
            paddingVertical: theme.spacing[24],
            paddingBottom: wide ? theme.spacing[24] : insets.bottom + theme.spacing[16],
          },
        ]}
      >
        <View>{step > 0 && <Button title="Back" variant="ghost" onPress={() => goTo(step - 1)} />}</View>
        <View style={{ minWidth: 128 }}>
          <Button title={last ? 'Create' : 'Next'} large disabled={busy} onPress={advance} />
        </View>
      </View>
    </View>
  );
}
