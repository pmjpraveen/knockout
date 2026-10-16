import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { CoverImageField } from '@/components/CoverImageField';
import { DateField } from '@/components/DateField';
import { wideBreakpoint } from '@/components/LoginArtwork';
import { LogoLockup } from '@/components/LogoLockup';
import { SkeletonScreen } from '@/components/Skeleton';
import { StepBar } from '@/components/StepBar';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { Cover, saveCover } from '@/lib/coverImage';
import { dateOf, eventFields, isDate, isoToDate, validateEventDates } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { setUnfinished, unfinishedDrafts, untitledEvent } from '@/lib/unfinishedDrafts';
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
    hint: 'Choose when the tournament starts and ends. The registration dates are optional.',
  },
];

/**
 * Creating an event, three steps at a time. "Save & exit" keeps what is filled in as a draft event and remembers the
 * step, so `resumeId` reopens that draft here, where it was left, instead of as a finished event.
 */
export function EventWizard({ userId, resumeId }: { userId: string; resumeId?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width >= wideBreakpoint;
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(resumeId ?? null);
  const [loadingDraft, setLoadingDraft] = useState(!!resumeId);
  const { run, busy, error } = useSubmit();
  const last = step === steps.length - 1;
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    if (!resumeId) return;
    (async () => {
      const [{ data: event }, { data: covers }, saved] = await Promise.all([
        supabase.from('events').select('*').eq('id', resumeId).single(),
        supabase.from('event_covers').select('image, thumb').eq('event_id', resumeId),
        unfinishedDrafts(),
      ]);
      if (event) {
        setDraft({
          name: event.name === untitledEvent ? '' : event.name,
          venue: event.venue ?? '',
          hostClub: event.host_club ?? '',
          cover: covers?.[0] ? { image: covers[0].image, thumb: covers[0].thumb ?? covers[0].image } : null,
          startDate: event.start_date ?? '',
          endDate: event.end_date ?? '',
          opens: dateOf(event.registration_opens_at),
          closes: dateOf(event.registration_closes_at),
        });
      }
      setStep(saved[resumeId] ?? 0);
      setLoadingDraft(false);
    })();
  }, [resumeId]);

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
  const save = (fields: ReturnType<typeof eventFields>, created = false) =>
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
      await setUnfinished(id, created ? null : step);
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
    return save({ ...eventFields(draft), name: draft.name.trim() || untitledEvent });
  };

  const advance = () => {
    if (missing) return setInvalid(missing);
    if (!last) return goTo(step + 1);
    const problem = validateEventDates(draft);
    setInvalid(problem);
    if (!problem) return save(eventFields(draft), true);
  };

  if (loadingDraft) return <SkeletonScreen />;

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
            <Text variant="label" style={{ textTransform: 'uppercase' }}>Step {step + 1}</Text>
            <Text variant="subheading">{steps[step].title}</Text>
            <Text variant="label" color="slateGray" style={{ lineHeight: 20 }}>{steps[step].hint}</Text>
          </View>

          {step === 0 && (
            <>
              <TextField label="Tournament name" value={draft.name} onChangeText={(name) => set({ name })} autoCapitalize="words" />
              <TextField label="Venue" value={draft.venue} onChangeText={(venue) => set({ venue })} autoCapitalize="words" />
              <TextField label="Host club" value={draft.hostClub} onChangeText={(hostClub) => set({ hostClub })} autoCapitalize="words" />
            </>
          )}
          {step === 1 && <CoverImageField value={draft.cover} onChange={(cover) => set({ cover })} />}
          {step === 2 && (
            <>
              <DateField label="Tournament starts on" value={draft.startDate} onChange={(startDate) => set({ startDate })} />
              <DateField label="Tournament ends on" value={draft.endDate} onChange={(endDate) => set({ endDate })} minimumDate={isDate(draft.startDate) ? isoToDate(draft.startDate) : undefined} />
              <DateField label="Registration starts on" value={draft.opens} onChange={(opens) => set({ opens })} clearable minimumDate={new Date()} />
              <DateField label="Registration ends on" value={draft.closes} onChange={(closes) => set({ closes })} clearable minimumDate={new Date()} maximumDate={isDate(draft.endDate) ? isoToDate(draft.endDate) : undefined} />
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
          <Button title={last ? 'Create' : 'Next'} size="large" disabled={busy} onPress={advance} />
        </View>
      </View>
    </View>
  );
}
