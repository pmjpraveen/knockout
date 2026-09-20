import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { coverSource } from '@/components/EventCards';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { Screen } from '@/components/Screen';
import { SkeletonList, SkeletonScreen } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useMyRoles } from '@/hooks/useMyRoles';
import { useSubmit } from '@/hooks/useSubmit';
import { coverAspect } from '@/lib/coverImage';
import { dateOf, formatDate, formatDateRange, humanize, isEditable, nextEventStep } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { memberships, isOrganizer, canOverride } = useMyRoles(id);
  const { rows: events, reload: reloadEvent } = useFocusQuery(() => supabase.from('events').select('*').eq('id', id));
  const { rows: categories, error, loading: loadingCategories, reload: reloadCategories } = useFocusQuery(() =>
    supabase.from('categories').select('*').eq('event_id', id).order('created_at'),
  );
  const { rows: entries } = useFocusQuery(() => supabase.from('club_entries').select('id, approval_status').eq('event_id', id));
  const { rows: covers } = useFocusQuery(() => supabase.from('event_covers').select('image').eq('event_id', id));
  const { rows: conflicts } = useFocusQuery(() => supabase.from('scoring_conflicts').select('id').eq('event_id', id).is('resolved_at', null));
  const { run, busy, error: stepError } = useSubmit();

  const event = events[0];
  if (!event) return <SkeletonScreen />;

  const step = nextEventStep[event.status];
  const missingDates = !event.start_date || !event.end_date; // only a saved draft can lack them
  const editable = isOrganizer && isEditable(event.status);
  const live = ['registration_closed', 'in_progress'].includes(event.status);
  const go = (screen: string) => () => router.push({ pathname: `/events/[id]/${screen}` as '/events/[id]/edit', params: { id } });
  const pending = entries.filter((e) => e.approval_status === 'submitted').length;
  const window = [event.registration_opens_at, event.registration_closes_at].map((at) => formatDate(dateOf(at)));

  const advance = () =>
    run(async () => {
      const result =
        step!.status === 'completed'
          ? await supabase.rpc('complete_event', { p_event_id: id })
          : await supabase.from('events').update({ status: step!.status }).eq('id', id);
      await Promise.all([reloadEvent(), reloadCategories()]);
      return result;
    });

  return (
    <Screen>
      <View style={{ width: '100%', aspectRatio: coverAspect, borderRadius: theme.radii.card, overflow: 'hidden' }}>
        <Image accessibilityLabel="Tournament cover image" source={coverSource(covers[0]?.image)} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      </View>
      <Text variant="heading" weight="medium">{event.name}</Text>
      <StatusPill status={event.status} />
      <Text color="charcoal">
        {[event.venue, event.host_club && `Hosted by ${event.host_club}`, formatDateRange(event.start_date, event.end_date)].filter(Boolean).join(' · ')}
      </Text>
      {window[0] || window[1] ? <Text color="slateGray">Registration {window[0] || '…'} → {window[1] || '…'}</Text> : null}
      {!isOrganizer &&
        memberships.map((m, i) => (
          <Text key={i} color="slateGray">
            Your role: {humanize(m.role)}{m.tatamis ? ` · ${m.tatamis.name}` : ''}
          </Text>
        ))}
      {event.status === 'completed' && (
        <Text color="warning">Archived and read-only. All data is deleted on {formatDate(dateOf(event.purge_at))}.</Text>
      )}

      {isOrganizer && step ? (
        <Button
          title={step.action}
          confirmTitle={step.status === 'completed' ? 'Tap again: data is deleted in 7 days' : undefined}
          disabled={busy || (step.status === 'registration_open' && missingDates)}
          onPress={advance}
        />
      ) : (
        live && memberships.length > 0 && <Button title="Open scoreboard" onPress={go('scoreboard')} />
      )}
      {isOrganizer && missingDates && <Text color="warning">Add the tournament dates in Edit event before opening registration.</Text>}
      {stepError && <Text color="danger">{stepError}</Text>}

      <ListGroup title="Run the event">
        {isOrganizer && live && memberships.length > 0 && <ListRow title="Scoreboard" onPress={go('scoreboard')} />}
        {live && <ListRow title="Schedule" onPress={go('schedule')} />}
        {['registration_closed', 'in_progress', 'completed'].includes(event.status) && <ListRow title="Brackets" onPress={go('brackets')} />}
        {canOverride && conflicts.length > 0 && <ListRow title="Scoring conflicts" detail={`${conflicts.length} unresolved`} tone="warning" onPress={go('conflicts')} />}
      </ListGroup>

      {isOrganizer && (
        <ListGroup title="Registration">
          {event.status !== 'completed' && <ListRow title="Registration link" onPress={go('link')} />}
          <ListRow title="Review submissions" detail={pending ? `${pending} pending` : undefined} tone="warning" onPress={go('submissions')} />
        </ListGroup>
      )}

      {canOverride && event.status !== 'completed' && (
        <ListGroup title="Set up">
          {editable && <ListRow title="Edit event" onPress={go('edit')} />}
          {isOrganizer && <ListRow title="Staff" onPress={go('staff')} />}
          <ListRow title="Tatamis" onPress={go('tatamis')} />
        </ListGroup>
      )}

      <Text variant="subheading" weight="medium">Categories</Text>
      {error && <Text color="danger">{error}</Text>}
      {loadingCategories && <SkeletonList count={2} />}
      {!loadingCategories && categories.length === 0 && !error && <Text color="slateGray">No categories yet.</Text>}
      {categories.map((category) => {
        const card = (
          <Card>
            <Text variant="bodyLg" weight="medium">{category.label}</Text>
            <StatusPill status={category.status} />
            <Text variant="body" color="slateGray">{humanize(category.bracket_format ?? '')}</Text>
          </Card>
        );
        return editable ? (
          <Link key={category.id} href={{ pathname: '/events/[id]/categories/[categoryId]', params: { id, categoryId: category.id } }} asChild>
            <Pressable style={({ pressed }) => pressFeedback(pressed)}>{card}</Pressable>
          </Link>
        ) : (
          <View key={category.id}>{card}</View>
        );
      })}

      {editable && (
        <ListGroup>
          <ListRow title="Add category" onPress={() => router.push({ pathname: '/events/[id]/categories/new', params: { id } })} />
          <ListRow title="Copy categories from another event" onPress={go('clone')} />
          {event.status === 'registration_closed' && <ListRow title="Merge or split categories" onPress={go('restructure')} />}
        </ListGroup>
      )}
    </Screen>
  );
}
