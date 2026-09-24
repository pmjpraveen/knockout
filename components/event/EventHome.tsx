import { useRouter } from 'expo-router';
import Building from 'lucide-react-native/icons/building';
import CalendarRange from 'lucide-react-native/icons/calendar-range';
import UserCheck from 'lucide-react-native/icons/user-check';
import { ReactNode } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { Button } from '@/components/Button';
import { EventCover } from '@/components/event/EventCover';
import type { EventData } from '@/components/event/useEventData';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { wideBreakpoint } from '@/components/LoginArtwork';
import { StatusPill } from '@/components/StatusPill';
import { useTabBarSpace } from '@/components/GlassTabBar';
import { Text } from '@/components/Text';
import { useSubmit } from '@/hooks/useSubmit';
import { dateOf, formatDate, formatDateRange, humanize, nextEventStep } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

const Divider = () => <View style={{ height: 1, backgroundColor: theme.colors.mist }} />;

function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[16], paddingVertical: theme.spacing[16] }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.cloud, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 132, gap: theme.spacing[4], padding: theme.spacing[12], borderRadius: theme.radii.card, backgroundColor: warn ? theme.colors.warningTint : theme.colors.cloud }}>
      <Text variant="headingSm" color={warn ? 'warning' : 'inkBlack'}>{value}</Text>
      <Text variant="label" color={warn ? 'warning' : 'charcoal'}>{label}</Text>
    </View>
  );
}

/** The event at a glance: cover, name, dates, host, how it is going, and the next step. */
export function EventHome({ data }: { data: EventData }) {
  const { event, isOrganizer, canOverride, memberships, counts, live, unresolvedConflicts } = data;
  const router = useRouter();
  const wide = useWindowDimensions().width >= wideBreakpoint;
  const space = useTabBarSpace();
  const { run, busy, error } = useSubmit();
  const step = nextEventStep[event.status];
  const missingDates = !event.start_date || !event.end_date; // only a saved draft can lack them
  const go = (screen: string) => () => router.push({ pathname: `/events/[id]/${screen}` as '/events/[id]/edit', params: { id: event.id } });
  const [opens, closes] = [event.registration_opens_at, event.registration_closes_at].map((at) => dateOf(at));

  const advance = () =>
    run(async () => {
      const result =
        step!.status === 'completed'
          ? await supabase.rpc('complete_event', { p_event_id: event.id })
          : await supabase.from('events').update({ status: step!.status }).eq('id', event.id);
      await Promise.all([data.reloadEvent(), data.reloadCategories()]);
      return result;
    });

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: space }}>
      <EventCover image={data.cover} height={wide ? 280 : 218} />
      <View style={{ marginTop: -theme.radii.sheetTop, borderTopLeftRadius: theme.radii.sheetTop, borderTopRightRadius: theme.radii.sheetTop, backgroundColor: theme.colors.paperWhite, paddingTop: theme.spacing[32] }}>
        <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: theme.spacing[24], gap: theme.spacing[16] }}>
          <View style={{ alignItems: 'center', gap: theme.spacing[8] }}>
            <Text variant="headingSm" style={{ textAlign: 'center' }}>{event.name}</Text>
            <Text color="charcoal">{formatDateRange(event.start_date, event.end_date)}</Text>
            <View style={{ alignSelf: 'center' }}>
              <StatusPill status={event.status} />
            </View>
          </View>

          <View>
            {(event.host_club || event.venue) && (
              <>
                <Divider />
                <InfoRow icon={<Building size={20} color={theme.colors.charcoal} strokeWidth={1.75} />}>
                  {event.host_club ? <Text>Hosted by <Text>{event.host_club}</Text></Text> : <Text>{event.venue}</Text>}
                  {event.host_club && event.venue ? <Text color="slateGray">{event.venue}</Text> : null}
                </InfoRow>
              </>
            )}
            {(opens || closes) && (
              <>
                <Divider />
                <InfoRow icon={<CalendarRange size={20} color={theme.colors.charcoal} strokeWidth={1.75} />}>
                  <Text>Registration</Text>
                  <Text color="slateGray">{opens && closes ? formatDateRange(opens, closes) : opens ? `Opens ${formatDate(opens)}` : `Closes ${formatDate(closes)}`}</Text>
                </InfoRow>
              </>
            )}
            {!isOrganizer && memberships.length > 0 && (
              <>
                <Divider />
                <InfoRow icon={<UserCheck size={20} color={theme.colors.charcoal} strokeWidth={1.75} />}>
                  <Text>Your role</Text>
                  {memberships.map((m, index) => (
                    <Text key={index} color="slateGray">{humanize(m.role)}{m.tatamis ? ` · ${m.tatamis.name}` : ''}</Text>
                  ))}
                </InfoRow>
              </>
            )}
            <Divider />
          </View>

          {canOverride && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] }}>
              <Stat label="Categories" value={counts.categories} />
              <Stat label="Participants" value={counts.participants} />
              <Stat label="Clubs" value={counts.clubs} />
              {counts.pending > 0 && <Stat label="To review" value={counts.pending} warn />}
            </View>
          )}

          {event.status === 'completed' && <Text color="warning">Archived and read-only. All data is deleted on {formatDate(dateOf(event.purge_at))}.</Text>}
          {isOrganizer && missingDates && <Text color="warning">Add the tournament dates in Configure before opening registration.</Text>}
          {isOrganizer && step ? (
            <Button
              size="large"
              title={step.action}
              confirmTitle={step.status === 'completed' ? 'Tap again: data is deleted in 7 days' : undefined}
              disabled={busy || (step.status === 'registration_open' && missingDates)}
              onPress={advance}
            />
          ) : (
            live && memberships.length > 0 && <Button size="large" title="Open scoreboard" onPress={go('scoreboard')} />
          )}
          {error && <Text color="danger">{error}</Text>}

          <ListGroup>
            {canOverride && unresolvedConflicts > 0 && <ListRow title="Scoring conflicts" detail={`${unresolvedConflicts} unresolved`} tone="warning" onPress={go('conflicts')} />}
            {isOrganizer && event.status !== 'completed' && <ListRow title="Registration link" onPress={go('link')} />}
            {isOrganizer && <ListRow title="Review submissions" detail={counts.pending ? `${counts.pending} pending` : undefined} tone="warning" onPress={go('submissions')} />}
          </ListGroup>
        </View>
      </View>
    </ScrollView>
  );
}
