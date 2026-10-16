import AsyncStorage from '@react-native-async-storage/async-storage';
import Clock from 'lucide-react-native/icons/clock';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AthleteFields } from '@/components/AthleteFields';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { RosterUpload } from '@/components/RosterUpload';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { dateOf, formatDate, humanize, registrationCue } from '@/lib/events';
import { AthleteDraft, athleteProblem, competeLabels, isBlank, newAthlete, toAthleteInput, toDraft } from '@/lib/athlete';
import { mobileDigits, mobileProblem } from '@/lib/mobile';
import { callRegistration, registrationUrl } from '@/lib/registration';
import { theme } from '@/theme/tokens';

type Info = {
  event: { name: string; venue: string | null; closes_at: string | null; opens_at: string | null; belts: string[] };
  open: boolean;
  state: 'open' | 'not_open_yet' | 'closed';
};
type Row = { key: number; athlete: AthleteDraft; compact: boolean };

const maxParticipants = 400; // what the submit-registration function accepts for one submission
const compactAbove = 8; // longer lists show one line per participant until someone taps Edit
let nextKey = 0;
const newRow = (athlete: AthleteDraft, compact = false): Row => ({ key: nextKey++, athlete, compact });

type Entry = {
  club_name: string;
  club_contact: string | null;
  approval_status: string;
  rejection_reason: string | null;
  athletes: Parameters<typeof toDraft>[0][];
};

/** Suggests a category once an athlete's details are complete. */
function Suggestion({ token, athlete }: { token: string; athlete: AthleteDraft }) {
  const [labels, setLabels] = useState<string[] | null>(null);
  const complete = athleteProblem(athlete) === null;
  const key = JSON.stringify(athlete);

  useEffect(() => {
    setLabels(null);
    if (!complete) return;
    const timer = setTimeout(() => {
      callRegistration<{ categories: string[] }>({ action: 'suggest', token, athlete: toAthleteInput(athlete) })
        .then((r) => setLabels(r.categories))
        .catch(() => setLabels(null));
    }, 500);
    return () => clearTimeout(timer);
  }, [token, key, complete]);

  if (!complete || labels === null) return null;
  return (
    <Text variant="body" color={labels.length ? 'success' : 'warning'}>
      {labels.length ? `Suggested: ${labels.join(' · ')}` : 'No category matches yet. The organizer will review.'}
    </Text>
  );
}

export default function Register() {
  const { token, ref } = useLocalSearchParams<{ token: string; ref?: string }>();
  const storageKey = `registration:${token}`;
  const [info, setInfo] = useState<Info | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [reference, setReference] = useState<string | undefined>(ref);
  const [clubName, setClubName] = useState('');
  const [contact, setContact] = useState('');
  const [rows, setRows] = useState<Row[]>(() => [newRow(newAthlete())]);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = (current: Entry) => {
    setEntry(current);
    setClubName(current.club_name);
    setContact(current.club_contact ?? '');
    setRows((current.athletes.length ? current.athletes.map(toDraft) : [newAthlete(info?.event.belts)]).map((athlete) => newRow(athlete, current.athletes.length > compactAbove)));
  };

  useEffect(() => {
    (async () => {
      try {
        const loaded = await callRegistration<Info>({ action: 'info', token });
        setInfo(loaded);
        setRows((list) => list.map((row) => (isBlank(row.athlete) ? { ...row, athlete: newAthlete(loaded.event.belts) } : row)));
        const remembered = ref ?? (await AsyncStorage.getItem(storageKey)) ?? undefined;
        if (!remembered) return;
        const found = await callRegistration<{ entry: Entry }>({ action: 'load', token, reference: remembered }).catch(() => null);
        if (found) {
          setReference(remembered);
          load(found.entry);
          setStep(1);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [token]);

  const athletes = rows.map((row) => row.athlete);
  const update = (key: number) => (next: AthleteDraft) => setRows((list) => list.map((row) => (row.key === key ? { ...row, athlete: next } : row)));
  const addFromSheet = (added: AthleteDraft[]) => setRows((list) => [...list.filter((row) => !isBlank(row.athlete)), ...added.map((athlete) => newRow(athlete, true))]);

  const clubProblem = !clubName.trim() ? 'Enter your club name.' : mobileProblem(contact);

  const recall = async (id: string) => {
    const found = await callRegistration<{ entry: Entry }>({ action: 'load', token, reference: id });
    await AsyncStorage.setItem(storageKey, id);
    setReference(id);
    load(found.entry);
    setNotice('We found your earlier submission, so you can update it.');
  };

  const next = async () => {
    setError(clubProblem);
    if (clubProblem) return;
    if (!reference) {
      setBusy(true);
      try {
        const { reference: id } = await callRegistration<{ reference: string | null }>({ action: 'find', token, mobile: contact });
        if (id) await recall(id);
      } catch (e) {
        setError((e as Error).message);
        return setBusy(false);
      }
      setBusy(false);
    }
    setStep(1);
  };

  const submit = async () => {
    const problem = athletes.map(athleteProblem).find(Boolean);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const result = await callRegistration<{ reference: string }>({
        action: 'save',
        token,
        reference,
        club_name: clubName,
        club_contact: contact,
        athletes: athletes.map(toAthleteInput),
      });
      await AsyncStorage.setItem(storageKey, result.reference);
      setReference(result.reference);
      setEntry((current) => ({ ...(current ?? { club_contact: contact, athletes: [] }), club_name: clubName, approval_status: 'submitted', rejection_reason: null }) as Entry);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  if (!info) return <Screen>{error ? <Text color="danger">{error}</Text> : <SkeletonList count={3} />}</Screen>;

  const cue = info.open ? registrationCue('registration_open', info.event.closes_at) : null;
  const urgent = cue !== null;
  const locked = !info.open || entry?.approval_status === 'approved';

  return (
    <Screen
      footer={
        locked ? undefined : (
          <>
            {error && <Text color="danger">{error}</Text>}
            {step === 1 && !error && entry?.rejection_reason && (
              <Text variant="body" color="warning" numberOfLines={2}>Organizer asked for changes: {entry.rejection_reason}</Text>
            )}
            {step === 0 ? (
              <Button size="large" title="Next" disabled={busy} onPress={next} />
            ) : (
              <View style={{ flexDirection: 'row', gap: theme.spacing[12] }}>
                <Button size="large" variant="secondary" title="Back" onPress={() => { setError(null); setStep(0); }} />
                <View style={{ flex: 1 }}>
                  <Button size="large" title={entry ? 'Resubmit' : 'Submit registration'} disabled={busy} onPress={submit} />
                </View>
              </View>
            )}
          </>
        )
      }
    >
      <Text variant="heading">{info.event.name}</Text>
      {info.event.venue && <Text color="charcoal">{info.event.venue}</Text>}
      {info.event.closes_at && (
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: theme.spacing[8], paddingHorizontal: theme.spacing[12], paddingVertical: theme.spacing[8], borderRadius: theme.radii.button, backgroundColor: theme.colors[urgent ? 'warningTint' : 'cloud'] }}>
          <Clock size={18} color={theme.colors[urgent ? 'warning' : 'inkBlack']} strokeWidth={1.75} />
          <Text color={urgent ? 'warning' : 'inkBlack'}>
            Registration closes {formatDate(dateOf(info.event.closes_at))}{cue ? ` · ${cue.replace(/^Closes /, '')}` : ''}
          </Text>
        </View>
      )}
      {entry && <StatusPill status={entry.approval_status} />}
      {entry?.rejection_reason && (
        <Card>
          <Text color="warning">The organizer asked for changes</Text>
          <Text>{entry.rejection_reason}</Text>
        </Card>
      )}
      {saved && reference && (
        <Card>
          <Text>Submitted. Keep this link to edit until it is approved:</Text>
          <Text selectable color="charcoal">{registrationUrl(token, reference)}</Text>
        </Card>
      )}

      {locked ? (
        <Text color="slateGray">
          {entry?.approval_status === 'approved'
            ? 'Your submission is approved. Contact the organizer for changes.'
            : info.state === 'not_open_yet'
              ? `Registration has not opened yet${info.event.opens_at ? ` (opens ${formatDate(dateOf(info.event.opens_at))})` : ''}. Please check back later.`
              : 'Registration is closed. Contact the organizer to make changes.'}
        </Text>
      ) : (
        <>
          {step === 0 ? (
            <>
              <Text variant="label" color="slateGray" style={{ textTransform: 'uppercase', marginTop: theme.spacing[8], marginBottom: theme.spacing[8] }}>Step 1 of 2 · Your club</Text>
              <TextField label="Club name" value={clubName} onChangeText={setClubName} autoCapitalize="words" />
              <TextField label="Mobile number" value={contact} onChangeText={(value) => setContact(mobileDigits(value))} keyboardType="number-pad" placeholder="9876543210" />
              <Text variant="body" color="slateGray" style={{ marginTop: -theme.spacing[8] }}>10 digits, without the country code (+91 or 0). We use it to find your entry if you come back to edit it.</Text>
            </>
          ) : (
            <>
              {notice && <Text color="success">{notice}</Text>}
              <Text variant="label" color="slateGray" style={{ textTransform: 'uppercase', marginTop: theme.spacing[8], marginBottom: theme.spacing[8] }}>Step 2 of 2 · Participants</Text>
            <RosterUpload existing={athletes.filter((athlete) => !isBlank(athlete))} max={maxParticipants} belts={info.event.belts} onAdd={addFromSheet} />
            {rows.map((row, index) =>
              row.compact ? (
                <Card key={row.key}>
                  <View style={{ gap: theme.spacing[8] }}>
                    <Text>{row.athlete.full_name}</Text>
                    <Text variant="body" color="slateGray">
                      {[formatDate(row.athlete.date_of_birth), humanize(row.athlete.gender), `${row.athlete.weight} kg`, humanize(row.athlete.belt_rank), competeLabels[row.athlete.compete]].join(' · ')}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: theme.spacing[8] }}>
                      <View style={{ flex: 1 }}>
                        <Button title="Edit" variant="secondary" onPress={() => setRows((list) => list.map((r) => (r.key === row.key ? { ...r, compact: false } : r)))} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button title="Remove" variant="danger" onPress={() => setRows((list) => list.filter((r) => r.key !== row.key))} />
                      </View>
                    </View>
                  </View>
                </Card>
              ) : (
                <Card key={row.key}>
                  <View style={{ gap: theme.spacing[12] }}>
                    <Text variant="subheading">Participant {index + 1}</Text>
                    <AthleteFields value={row.athlete} onChange={update(row.key)} belts={info.event.belts} />
                    <Suggestion token={token} athlete={row.athlete} />
                    {rows.length > 1 && <Button title="Remove" variant="danger" onPress={() => setRows((list) => list.filter((r) => r.key !== row.key))} />}
                  </View>
                </Card>
              ),
            )}
            <Button title="Add participant" variant="secondary" disabled={rows.length >= maxParticipants} onPress={() => setRows((list) => [...list, newRow(newAthlete(info.event.belts))])} />
            </>
          )}
        </>
      )}
    </Screen>
  );
}
