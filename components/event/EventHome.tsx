import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Circle from 'lucide-react-native/icons/circle';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import { StatusBar } from 'expo-status-bar';
import UserCheck from 'lucide-react-native/icons/user-check';
import { Fragment, ReactNode, useRef, useState } from 'react';
import { Animated, Image, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Button } from '@/components/Button';
import { BackButton, CoverBackButton, EventCover, useCoverHeader } from '@/components/event/EventCover';
import type { EventData } from '@/components/event/useEventData';
import { coverSource, StatusBadge } from '@/components/EventCards';
import { LinkCard } from '@/components/LinkCard';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { wideBreakpoint } from '@/components/LoginArtwork';
import { wideColumn } from '@/components/HomeScreen';
import { StatusPill } from '@/components/StatusPill';
import { useTabBarSpace } from '@/components/GlassTabBar';
import { Text } from '@/components/Text';
import { TopBar } from '@/components/TopBar';
import { useSubmit } from '@/hooks/useSubmit';
import { coverAspect } from '@/lib/coverImage';
import { dateOf, formatDate, formatDateRange, humanize, nextEventStep, registrationCue } from '@/lib/events';
import { pressFeedback } from '@/lib/press';
import { ensureRegistrationLink, registrationUrl } from '@/lib/registration';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

/** The width from which the event page puts its cover beside its details on web. */
const twoColumnBreakpoint = 1000;

const Divider = () => <View style={{ height: 1, backgroundColor: theme.colors.mist }} />;

function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[16], paddingVertical: theme.spacing[16] }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: theme.colors.cloud, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

type StatItem = { label: string; value: number; warn?: boolean };

function Stat({ label, value, warn }: StatItem) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: theme.spacing[4], paddingVertical: theme.spacing[4] }}>
      <Text variant="headingSm" color={warn ? 'warning' : 'inkBlack'}>{value}</Text>
      <Text variant="label" color={warn ? 'warning' : 'charcoal'}>{label}</Text>
    </View>
  );
}

/** The counts in one row, each centred, with a short rule between neighbours. */
function StatRow({ stats }: { stats: StatItem[] }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {stats.map((stat, i) => (
        <Fragment key={stat.label}>
          {i > 0 && <View style={{ width: 1, height: 40, backgroundColor: theme.colors.mist }} />}
          <Stat {...stat} />
        </Fragment>
      ))}
    </View>
  );
}

/** Clubs are waiting on the organizer: the first thing to act on, so it sits right under the counts. */
function PendingBanner({ count, onPress }: { count: number; onPress: () => void }) {
  const text = `${count} ${count === 1 ? 'submission is' : 'submissions are'} waiting for review`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      onPress={onPress}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8], minHeight: theme.touchTarget.minimum, paddingHorizontal: theme.spacing[16], paddingVertical: theme.spacing[12], borderRadius: theme.radii.card, backgroundColor: theme.colors.warningTint }, pressFeedback(pressed)]}
    >
      <Text variant="bodyLg" color="warning" style={{ flex: 1 }}>{text}</Text>
      <ChevronRight size={20} color={theme.colors.warning} strokeWidth={1.75} />
    </Pressable>
  );
}

type SetupStep = { title: string; hint: string; detail?: string; done: boolean; onPress: () => void };

/** What a draft still needs, in the order an organizer would do it; hidden once everything is done. */
function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  if (steps.every((step) => step.done)) return null;
  return (
    <ListGroup title="Set up your tournament">
      {steps.map(({ title, hint, detail, done, onPress }) => (
        <Pressable
          key={title}
          accessibilityRole="button"
          accessibilityLabel={`${title}, ${done ? `done${detail ? `, ${detail}` : ''}` : hint}`}
          onPress={onPress}
          style={({ pressed }) => ({ minHeight: theme.touchTarget.minimum, flexDirection: 'row', alignItems: 'center', gap: theme.spacing[12], paddingHorizontal: theme.spacing[16], paddingVertical: theme.spacing[12], backgroundColor: pressed ? theme.colors.cloud : theme.colors.paperWhite })}
        >
          {done ? <CircleCheck size={22} color={theme.colors.success} strokeWidth={1.75} /> : <Circle size={22} color={theme.colors.steelGray} strokeWidth={1.75} />}
          <Text variant="bodyLg" color={done ? 'slateGray' : 'inkBlack'} style={{ flex: 1 }}>{title}</Text>
          <Text variant="body" color="slateGray">{done ? detail : hint}</Text>
          <ChevronRight size={20} color={theme.colors.steelGray} strokeWidth={1.75} />
        </Pressable>
      ))}
    </ListGroup>
  );
}

/** What an organizer should do at this stage, above the main button. */
function StagePrompt({ text, action }: { text: string; action: { title: string; onPress: () => void } }) {
  return (
    <View style={{ gap: theme.spacing[12], padding: theme.spacing[16], borderRadius: theme.radii.card, backgroundColor: theme.colors.cloud }}>
      <Text>{text}</Text>
      <Button title={action.title} variant="secondary" onPress={action.onPress} />
    </View>
  );
}

/** The event at a glance: cover, name, dates, host, how it is going, and the next step. */
export function EventHome({ data }: { data: EventData }) {
  const { event, isOrganizer, canOverride, memberships, counts, live, unresolvedConflicts } = data;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= wideBreakpoint;
  const coverHeight = wide ? 400 : width / coverAspect;
  const cardRadius = Platform.OS === 'web' ? theme.radii.sheetTop : 32; // rounder than the shared sheet radius on native; web is unchanged
  const header = useCoverHeader();
  const scrollY = useRef(new Animated.Value(0)).current;
  // The cover is gone, and the strip behind the back button solid, by the time the card's top edge reaches that strip.
  const fadeEnd = Math.max(1, coverHeight - cardRadius - header.height);
  const coverOpacity = scrollY.interpolate({ inputRange: [0, fadeEnd], outputRange: [1, 0], extrapolate: 'clamp' });
  const stripOpacity = scrollY.interpolate({ inputRange: [fadeEnd * 0.7, fadeEnd], outputRange: [0, 1], extrapolate: 'clamp' });
  // Over a photo the status bar is light, on a soft dark scrim so it reads on any picture; once the page has faded to white it is dark.
  const hasCover = !!data.cover;
  const [overCover, setOverCover] = useState(true);
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
      const link = !result.error && step!.status === 'registration_open' ? await ensureRegistrationLink(event.id) : null;
      await Promise.all([data.reloadEvent(), data.reloadCategories(), data.reloadLink()]);
      return link?.error ? link : result;
    });

  const cue = registrationCue(event.status, event.registration_closes_at);
  const prompt =
    event.status === 'registration_closed'
      ? { text: 'Registration is closed. Review any last submissions, then draw the brackets.', action: { title: 'Draw brackets', onPress: go('brackets') } }
      : event.status === 'in_progress'
        ? { text: 'The event is running. Follow the matches on the scoreboard.', action: { title: 'Open scoreboard', onPress: go('scoreboard') } }
        : null;

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const setupSteps: SetupStep[] = [
    { title: 'Tournament dates', hint: 'Required', detail: formatDateRange(event.start_date, event.end_date), done: !missingDates, onPress: go('edit') },
    { title: 'Categories', hint: 'Needed for registration', detail: count(counts.categories, 'category', 'categories'), done: counts.categories > 0, onPress: () => router.push({ pathname: '/events/[id]/categories/new', params: { id: event.id } }) },
    { title: 'Belt system', hint: 'Review', detail: count(event.belts.length, 'belt', 'belts'), done: event.belts.length > 0, onPress: go('belts') },
    { title: 'Tatamis', hint: 'Before the event', detail: count(counts.tatamis, 'tatami', 'tatamis'), done: counts.tatamis > 0, onPress: go('tatamis') },
    { title: 'Staff', hint: 'Before the event', detail: count(counts.staff, 'person', 'people'), done: counts.staff > 0, onPress: go('staff') },
  ];

  const createLink = () =>
    run(async () => {
      const result = await ensureRegistrationLink(event.id);
      await data.reloadLink();
      return result;
    });

  const heading = (
    <View style={{ alignItems: 'center', gap: theme.spacing[8] }}>
      <Text variant="headingSm" style={{ textAlign: 'center' }}>{event.name}</Text>
      <Text color="charcoal">{formatDateRange(event.start_date, event.end_date)}</Text>
      <View style={{ alignSelf: 'center' }}>
        <StatusPill status={event.status} />
      </View>
    </View>
  );

  const body = (
    <>
      {canOverride && (
        <StatRow
          stats={[
            { label: 'Categories', value: counts.categories },
            { label: 'Participants', value: counts.participants },
            { label: 'Clubs', value: counts.clubs },
            ...(counts.pending > 0 ? [{ label: 'To review', value: counts.pending, warn: true }] : []),
          ]}
        />
      )}

      {isOrganizer && counts.pending > 0 && <PendingBanner count={counts.pending} onPress={go('submissions')} />}

      <View>
        {(event.host_club || event.venue) && (
          <>
            <Divider />
            <InfoRow icon={<Image source={require('@/assets/images/location-pin.png')} accessible={false} style={{ width: 64, height: 64 }} />}>
              {event.host_club ? <Text>Hosted by <Text>{event.host_club}</Text></Text> : <Text>{event.venue}</Text>}
              {event.host_club && event.venue ? <Text color="slateGray">{event.venue}</Text> : null}
            </InfoRow>
          </>
        )}
        {(opens || closes) && (
          <>
            <Divider />
            <InfoRow icon={<Image source={require('@/assets/images/registration-clipboard.png')} accessible={false} resizeMode="contain" style={{ width: 28, height: 28 }} />}>
              <Text>Registration</Text>
              <Text color="slateGray">{opens && closes ? formatDateRange(opens, closes) : opens ? `Opens ${formatDate(opens)}` : `Closes ${formatDate(closes)}`}</Text>
              {cue && (
                <View style={{ alignSelf: 'flex-start', marginTop: theme.spacing[4], paddingHorizontal: theme.spacing[8], paddingVertical: theme.spacing[4], borderRadius: theme.radii.chip, backgroundColor: theme.colors.warningTint }}>
                  <Text variant="label" color="warning">{cue}</Text>
                </View>
              )}
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

      {event.status === 'completed' && <Text color="warning">Archived and read-only. All data is deleted on {formatDate(dateOf(event.purge_at))}.</Text>}
      {isOrganizer && missingDates && <Text color="warning">Add the tournament dates in Configure before opening registration.</Text>}
      {isOrganizer && event.status === 'registration_open' && (
        data.registrationLink ? (
          <LinkCard url={registrationUrl(data.registrationLink.token)} note={data.registrationLink.is_active ? undefined : 'This link is turned off, so clubs cannot register with it.'} />
        ) : (
          <Button title="Create registration link" variant="secondary" disabled={busy} onPress={createLink} />
        )
      )}
      {isOrganizer && event.status === 'draft' && <SetupChecklist steps={setupSteps} />}
      {isOrganizer && prompt && <StagePrompt {...prompt} />}
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
    </>
  );

  const card = (
    <View style={{ borderTopLeftRadius: cardRadius, borderTopRightRadius: cardRadius, backgroundColor: theme.colors.paperWhite, paddingTop: theme.spacing[32] }}>
      <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: theme.spacing[24], gap: theme.spacing[16] }}>
        {heading}
        {body}
      </View>
    </View>
  );

  if (Platform.OS === 'web' && width >= twoColumnBreakpoint) {
    const frame = { width: '100%', maxWidth: wideColumn, alignSelf: 'center', paddingHorizontal: theme.spacing[24] } as const;
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.paperWhite }}>
        <View style={{ backgroundColor: theme.colors.paperWhite, zIndex: 1 }}>
          <View style={frame}>
            <TopBar />
            <View style={{ alignSelf: 'flex-start', marginTop: theme.spacing[8], marginBottom: theme.spacing[8] }}>
              <BackButton />
            </View>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: space }}>
          <View style={[frame, { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[48], paddingTop: theme.spacing[16] }]}>
            <View style={{ flex: 3, aspectRatio: coverAspect, borderRadius: theme.radii.scorePanel + theme.spacing[8], overflow: 'hidden', backgroundColor: theme.colors.cloud }}>
              <Image accessibilityLabel="Tournament cover image" source={coverSource(data.cover)} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
              <View style={{ position: 'absolute', left: theme.spacing[16], top: theme.spacing[16] }}>
                <StatusBadge status={event.status} />
              </View>
            </View>
            <View style={{ flex: 2, minWidth: 320, gap: theme.spacing[16] }}>
              <View style={{ gap: theme.spacing[8] }}>
                <Text variant="heading" weight="medium">{event.name}</Text>
                <Text variant="bodyLg" color="charcoal">{formatDateRange(event.start_date, event.end_date)}</Text>
              </View>
              {body}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: space }}>
        <View>
          <EventCover image={data.cover} height={wide ? 280 : 218} />
          <CoverBackButton />
        </View>
        <View style={{ marginTop: -cardRadius }}>{card}</View>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.paperWhite }}>
      <StatusBar style={hasCover && overCover ? 'light' : 'dark'} />
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: coverOpacity }}>
        <EventCover image={data.cover} height={coverHeight} />
        {hasCover && <LinearGradient pointerEvents="none" colors={['rgba(15,17,21,0.5)', 'rgba(15,17,21,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: header.height + theme.spacing[24] }} />}
      </Animated.View>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: space }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
          listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => setOverCover(event.nativeEvent.contentOffset.y < fadeEnd * 0.6),
        })}
      >
        <View style={{ height: coverHeight - cardRadius }} />
        {card}
      </Animated.ScrollView>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: header.height, backgroundColor: theme.colors.paperWhite, opacity: stripOpacity }} />
      <CoverBackButton />
    </View>
  );
}
