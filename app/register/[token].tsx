import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { dateOf, formatDate, humanize } from '@/lib/events';
import { AthleteDraft, athleteProblem, competeLabels, isBlank, newAthlete, toAthleteInput, toDraft } from '@/lib/athlete';
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
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [token]);

  const athletes = rows.map((row) => row.athlete);
  const update = (key: number) => (next: AthleteDraft) => setRows((list) => list.map((row) => (row.key === key ? { ...row, athlete: next } : row)));
  const addFromSheet = (added: AthleteDraft[]) => setRows((list) => [...list.filter((row) => !isBlank(row.athlete)), ...added.map((athlete) => newRow(athlete, true))]);

  const submit = async () => {
    const problem = athletes.map(athleteProblem).find(Boolean) ?? (!clubName.trim() || !contact.trim() ? 'Enter your club name and a contact.' : null);
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

  const locked = !info.open || entry?.approval_status === 'approved';

  return (
    <Screen>
      <Text variant="heading">{info.event.name}</Text>
      {info.event.venue && <Text color="charcoal">{info.event.venue}</Text>}
      {info.event.closes_at && <Text color="slateGray">Registration closes {formatDate(dateOf(info.event.closes_at))}</Text>}
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
          <TextField label="Club name" value={clubName} onChangeText={setClubName} autoCapitalize="words" />
          <TextField label="Contact (email or phone)" value={contact} onChangeText={setContact} />
          <RosterUpload existing={athletes.filter((athlete) => !isBlank(athlete))} max={maxParticipants} belts={info.event.belts} onAdd={addFromSheet} />
          {rows.length > 1 && <Text variant="subheading">Participants ({rows.length})</Text>}
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
                      <Button title="Remove" variant="secondary" onPress={() => setRows((list) => list.filter((r) => r.key !== row.key))} />
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
                  {rows.length > 1 && <Button title="Remove" variant="secondary" onPress={() => setRows((list) => list.filter((r) => r.key !== row.key))} />}
                </View>
              </Card>
            ),
          )}
          <Button title="Add participant" variant="secondary" disabled={rows.length >= maxParticipants} onPress={() => setRows((list) => [...list, newRow(newAthlete(info.event.belts))])} />
          {error && <Text color="danger">{error}</Text>}
          <Button title={entry ? 'Resubmit' : 'Submit registration'} disabled={busy} onPress={submit} />
        </>
      )}
    </Screen>
  );
}
