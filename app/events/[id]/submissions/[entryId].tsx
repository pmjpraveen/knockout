import { useLocalSearchParams, useRouter } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import List from 'lucide-react-native/icons/list';
import Plus from 'lucide-react-native/icons/plus';
import Table from 'lucide-react-native/icons/table';
import Users from 'lucide-react-native/icons/users';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ListGroup } from '@/components/ListGroup';
import { Screen } from '@/components/Screen';
import { SkeletonScreen } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { ViewToggle } from '@/components/ViewToggle';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { competeLabels, toDraft } from '@/lib/athlete';
import { formatDate, formatDateTime, humanize } from '@/lib/events';
import { pressFeedback } from '@/lib/press';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

type Athlete = Parameters<typeof toDraft>[0] & { id: string };
type Registered = Athlete & { registrations: { categories: { label: string } | null }[] };

function Suggested({ eventId, athlete, plain = false }: { eventId: string; athlete: Athlete; plain?: boolean }) {
  const [labels, setLabels] = useState<string[]>([]);
  useEffect(() => {
    supabase
      .rpc('suggest_categories', {
        p_event_id: eventId,
        p_date_of_birth: athlete.date_of_birth as string,
        p_gender: athlete.gender as string,
        p_weight: athlete.weight as number,
        p_belt: athlete.belt_rank as string,
        p_disciplines: athlete.disciplines ?? undefined,
      })
      .then(({ data }) => setLabels((data ?? []).map((c) => c.label)));
  }, [eventId, athlete.id, athlete.date_of_birth, athlete.gender, athlete.weight, athlete.belt_rank, athlete.disciplines]);

  return <Text variant="body" color={labels.length ? 'success' : 'warning'} numberOfLines={plain ? 1 : undefined}>{labels.length ? `${plain ? '' : 'Suggested: '}${labels.join(' · ')}` : 'No matching category'}</Text>;
}

type Withdrawal = { athlete_id?: string; athlete_name?: string; category_label?: string };
type Withdrawn = Map<string, { category?: string; reason: string }>;

const changeTitle = (action: string, details: Withdrawal) =>
  action === 'add_athlete' ? 'Participant added' : action === 'withdraw_registration' ? `${details.athlete_name ?? 'Participant'} withdrawn from ${details.category_label}` : 'Participant edited';

const views = [
  { value: 'list', label: 'List', Icon: List },
  { value: 'table', label: 'Table', Icon: Table },
] as const;

const columns = [
  ['Name', 150], ['Gender', 80], ['Born', 110], ['Weight', 80], ['Belt', 80], ['Events', 130], ['Category', 300],
] as const;
const tableWidth = columns.reduce((sum, [, width]) => sum + width, 0);
const cell = (width: number) => ({ width, paddingHorizontal: theme.spacing[12] });

/** The participants as a table that scrolls sideways on narrow screens. */
function ParticipantTable({ eventId, athletes, approved, withdrawn, editable, onEdit }: { eventId: string; athletes: Registered[]; approved: boolean; withdrawn: Withdrawn; editable: boolean; onEdit: (athleteId: string) => void }) {
  return (
    <View style={{ borderWidth: 1, borderColor: theme.colors.mist, borderRadius: theme.radii.card, overflow: 'hidden', backgroundColor: theme.colors.paperWhite }}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ width: tableWidth }}>
          <View style={{ flexDirection: 'row', paddingVertical: theme.spacing[12], backgroundColor: theme.colors.cloud }}>
            {columns.map(([name, width]) => (
              <Text key={name} variant="label" color="slateGray" style={[cell(width), { textTransform: 'uppercase' }]}>{name}</Text>
            ))}
          </View>
          {athletes.map((athlete) => {
            const values = [
              athlete.gender ? humanize(athlete.gender) : '',
              athlete.date_of_birth ? formatDate(athlete.date_of_birth) : '',
              athlete.weight ? `${athlete.weight} kg` : '',
              athlete.belt_rank ? humanize(athlete.belt_rank) : '',
              competeLabels[toDraft(athlete).compete],
            ];
            return (
              <Pressable
                key={athlete.id}
                accessibilityRole="button"
                accessibilityLabel={`${athlete.full_name}, edit`}
                disabled={!editable}
                onPress={() => onEdit(athlete.id)}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing[12], borderTopWidth: 1, borderTopColor: theme.colors.mist }, editable && pressFeedback(pressed)]}
              >
                <Text numberOfLines={1} style={cell(columns[0][1])}>{athlete.full_name}</Text>
                {values.map((value, index) => (
                  <Text key={columns[index + 1][0]} numberOfLines={1} color="slateGray" style={cell(columns[index + 1][1])}>{value}</Text>
                ))}
                <View style={cell(columns[6][1])}>
                  {athlete.registrations.length === 0 && withdrawn.has(athlete.id) ? (
                    <Text variant="body" color="warning" numberOfLines={1}>Withdrawn: {withdrawn.get(athlete.id)!.reason}</Text>
                  ) : approved ? (
                    <Text variant="body" color="success" numberOfLines={1}>{athlete.registrations.map((r) => r.categories?.label).join(' · ') || 'no category'}</Text>
                  ) : (
                    <Suggested eventId={eventId} athlete={athlete} plain />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export default function SubmissionDetail() {
  const { id, entryId } = useLocalSearchParams<{ id: string; entryId: string }>();
  const router = useRouter();
  const [view, setView] = useState<(typeof views)[number]['value']>('list');
  const { rows: entries } = useFocusQuery(() =>
    supabase.from('club_entries').select('*, athletes(*, registrations(categories(label)))').eq('id', entryId),
  );
  const { rows: events } = useFocusQuery(() => supabase.from('events').select('status').eq('id', id));
  const { rows: log } = useFocusQuery(() =>
    supabase.from('audit_log').select('*').eq('subject_id', entryId).order('created_at', { ascending: false }),
  );

  const entry = entries[0];
  if (!entry) return <SkeletonScreen />;
  const archived = events[0]?.status === 'completed';
  const approved = entry.approval_status === 'approved';
  const withdrawn: Withdrawn = new Map();
  for (const change of [...log].reverse()) {
    if (change.action !== 'withdraw_registration') continue;
    const details = change.changes as Withdrawal;
    if (details.athlete_id) withdrawn.set(details.athlete_id, { category: details.category_label, reason: change.reason });
  }
  const edit = (athleteId?: string) => router.push({ pathname: '/events/[id]/athlete', params: { id, entryId, ...(athleteId && { athleteId }) } });

  const people = `${entry.athletes.length} ${entry.athletes.length === 1 ? 'participant' : 'participants'}`;

  return (
    <Screen
      footer={!archived ? <Button size="large" title="Add participant" icon={<Plus size={18} color={theme.colors.paperWhite} strokeWidth={1.75} />} onPress={() => edit()} /> : undefined}
    >
      <View style={{ gap: theme.spacing[8] }}>
        <Text variant="heading">{entry.club_name}</Text>
        <View style={{ gap: theme.spacing[4] }}>
          <Text color="slateGray">{[entry.club_contact, people].join(' · ')}</Text>
          <Text color="slateGray">Submitted {formatDateTime(entry.submitted_at)}</Text>
        </View>
        <View style={{ alignSelf: 'flex-start' }}><StatusPill status={entry.approval_status} /></View>
      </View>
      {entry.rejection_reason && (
        <View style={{ gap: theme.spacing[4], padding: theme.spacing[16], borderRadius: theme.radii.card, backgroundColor: theme.colors.warningTint }}>
          <Text variant="bodyLg" color="warning">Sent back to the club</Text>
          <Text>{entry.rejection_reason}</Text>
        </View>
      )}

      {entry.athletes.length === 0 ? (
        <EmptyState Icon={Users} title="No participants" text="This submission has no participants yet. Add the first one below." />
      ) : (
        <View style={{ gap: theme.spacing[12] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="label" color="slateGray" style={{ textTransform: 'uppercase' }}>{`Participants · ${entry.athletes.length}`}</Text>
            <ViewToggle label="View" options={views} value={view} onChange={setView} />
          </View>
          {view === 'table' ? (
            <ParticipantTable eventId={id} athletes={entry.athletes} approved={approved} withdrawn={withdrawn} editable={!archived} onEdit={edit} />
          ) : (
          <ListGroup>
            {entry.athletes.map((athlete) => (
              <Pressable
                key={athlete.id}
                accessibilityRole="button"
                accessibilityLabel={`${athlete.full_name}, edit`}
                disabled={archived}
                onPress={() => edit(athlete.id)}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8], paddingHorizontal: theme.spacing[16], paddingVertical: theme.spacing[12] }, !archived && pressFeedback(pressed)]}
              >
                <View style={{ flex: 1, gap: theme.spacing[4] }}>
                  <Text variant="bodyLg">{athlete.full_name}</Text>
                  <Text color="slateGray">{[athlete.gender && humanize(athlete.gender), athlete.date_of_birth && formatDate(athlete.date_of_birth), athlete.weight && `${athlete.weight} kg`].filter(Boolean).join(' · ')}</Text>
                  <Text color="slateGray">{[athlete.belt_rank && `${humanize(athlete.belt_rank)} belt`, competeLabels[toDraft(athlete).compete]].filter(Boolean).join(' · ')}</Text>
                  {athlete.registrations.length === 0 && withdrawn.has(athlete.id) ? (
                    <Text variant="body" color="warning">Withdrawn from {withdrawn.get(athlete.id)!.category}: {withdrawn.get(athlete.id)!.reason}</Text>
                  ) : approved ? (
                    <Text variant="body" color="success">
                      Registered: {athlete.registrations.map((r) => r.categories?.label).join(' · ') || 'no category'}
                    </Text>
                  ) : (
                    <Suggested eventId={id} athlete={athlete} />
                  )}
                </View>
                {!archived && <ChevronRight size={20} color={theme.colors.steelGray} strokeWidth={1.75} />}
              </Pressable>
            ))}
          </ListGroup>
          )}
        </View>
      )}

      {log.length > 0 && (
        <ListGroup title="Change log">
          {log.map((change) => (
            <View key={change.id} style={{ gap: theme.spacing[4], paddingHorizontal: theme.spacing[16], paddingVertical: theme.spacing[12] }}>
              <Text>{changeTitle(change.action, change.changes as Withdrawal)}</Text>
              <Text variant="body" color="slateGray">{change.reason} · {formatDateTime(change.created_at)}</Text>
            </View>
          ))}
        </ListGroup>
      )}
    </Screen>
  );
}
