import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AthleteFields } from '@/components/AthleteFields';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { dateOf, formatDate } from '@/lib/events';
import { AthleteDraft, athleteProblem, emptyAthlete, toAthleteInput, toDraft } from '@/lib/athlete';
import { callRegistration, registrationUrl } from '@/lib/registration';
import { theme } from '@/theme/tokens';

type Info = {
  event: { name: string; venue: string | null; closes_at: string | null; opens_at: string | null };
  open: boolean;
  state: 'open' | 'not_open_yet' | 'closed';
};
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
  const [athletes, setAthletes] = useState<AthleteDraft[]>([emptyAthlete]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = (current: Entry) => {
    setEntry(current);
    setClubName(current.club_name);
    setContact(current.club_contact ?? '');
    setAthletes(current.athletes.length ? current.athletes.map(toDraft) : [emptyAthlete]);
  };

  useEffect(() => {
    (async () => {
      try {
        setInfo(await callRegistration<Info>({ action: 'info', token }));
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

  const update = (index: number) => (next: AthleteDraft) => setAthletes((list) => list.map((a, i) => (i === index ? next : a)));

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
      <Text variant="heading" weight="medium">{info.event.name}</Text>
      {info.event.venue && <Text color="charcoal">{info.event.venue}</Text>}
      {info.event.closes_at && <Text color="slateGray">Registration closes {formatDate(dateOf(info.event.closes_at))}</Text>}
      {entry && <StatusPill status={entry.approval_status} />}
      {entry?.rejection_reason && (
        <Card>
          <Text weight="medium" color="warning">The organizer asked for changes</Text>
          <Text>{entry.rejection_reason}</Text>
        </Card>
      )}
      {saved && reference && (
        <Card>
          <Text weight="medium">Submitted. Keep this link to edit until it is approved:</Text>
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
          {athletes.map((athlete, index) => (
            <Card key={index}>
              <View style={{ gap: theme.spacing[12] }}>
                <Text variant="subheading" weight="medium">Participant {index + 1}</Text>
                <AthleteFields value={athlete} onChange={update(index)} />
                <Suggestion token={token} athlete={athlete} />
                {athletes.length > 1 && (
                  <Button title="Remove" variant="secondary" onPress={() => setAthletes((list) => list.filter((_, i) => i !== index))} />
                )}
              </View>
            </Card>
          ))}
          <Button title="Add participant" variant="secondary" onPress={() => setAthletes((list) => [...list, emptyAthlete])} />
          {error && <Text color="danger">{error}</Text>}
          <Button title={entry ? 'Resubmit' : 'Submit registration'} disabled={busy} onPress={submit} />
        </>
      )}
    </Screen>
  );
}
