import House from 'lucide-react-native/icons/house';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AccountMenu } from '@/components/AccountMenu';
import { BracketMatch, BracketTree } from '@/components/BracketTree';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CardGrid } from '@/components/CardGrid';
import { ChoiceChips } from '@/components/ChoiceChips';
import { DateField } from '@/components/DateField';
import { EventHeroCard, EventTile } from '@/components/EventCards';
import { Glass } from '@/components/Glass';
import { GlassTabBar, TabItem } from '@/components/GlassTabBar';
import { GoogleIcon } from '@/components/GoogleIcon';
import { LinkCard } from '@/components/LinkCard';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { LogoLockup } from '@/components/LogoLockup';
import { Skeleton, SkeletonCard, SkeletonList } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { StepBar } from '@/components/StepBar';
import { TatamiQueueCard } from '@/components/TatamiQueueCard';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import type { EventRow } from '@/lib/events';
import { theme } from '@/theme/tokens';

const sampleEvent: EventRow = {
  id: 'sample', organizer_id: 'sample', name: 'Sample Open Championship',
  start_date: '2026-11-14', end_date: '2026-11-15', venue: 'City Sports Hall', host_club: 'Sample Dojo',
  status: 'registration_open', belts: ['white', 'yellow', 'orange'], kata_minutes: 3, kumite_minutes: 2, team_minutes: 5,
  created_at: '', completed_at: null, purge_at: null, registration_closes_at: null, registration_opens_at: null, schedule_token: null,
};

const sampleMatches: BracketMatch[] = [
  { id: 'm1', round: 1, position: 1, bracket_side: 'main', pool: null, status: 'bye', winner_id: 'a1', athlete_a_id: 'a1', athlete_a: 'Alex Chen', athlete_b_id: null, athlete_b: null },
  { id: 'm2', round: 1, position: 2, bracket_side: 'main', pool: null, status: 'completed', winner_id: 'a3', athlete_a_id: 'a2', athlete_a: 'Sam Rivera', athlete_b_id: 'a3', athlete_b: 'Jo Patel' },
  { id: 'm3', round: 2, position: 1, bracket_side: 'main', pool: null, status: 'in_progress', winner_id: null, athlete_a_id: 'a1', athlete_a: 'Alex Chen', athlete_b_id: 'a3', athlete_b: 'Jo Patel' },
];

const tabs: TabItem<'a' | 'b'>[] = [
  { key: 'a', label: 'Home', Icon: House },
  { key: 'b', label: 'Scoreboard', Icon: House },
];

/** A one-off dev screen: every presentational component with sample data, for a quick visual check. Not linked from the app. */
export default function Gallery() {
  const [chip, setChip] = useState<'kata' | 'kumite'>('kata');
  const [text, setText] = useState('');
  const [step, setStep] = useState(1);
  const [date, setDate] = useState('');
  const [tab, setTab] = useState<'a' | 'b'>('a');

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing[24], gap: theme.spacing[32], maxWidth: 640, alignSelf: 'center', width: '100%' }}>
      <Section title="Text (one shared scale — same px sizes on web and native, no platform branching)">
        {(Object.keys(theme.type) as (keyof typeof theme.type)[]).map((variant) => (
          <View key={variant} style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing[12] }}>
            <Text variant={variant}>{variant}</Text>
            <Text variant="caption" color="slateGray">{theme.type[variant].fontSize}px / {theme.type[variant].lineHeight} line</Text>
          </View>
        ))}
        <Text color="danger">Danger color (body size, danger tint)</Text>
      </Section>

      <Section title="Colors (theme.colors — same on web and native)">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[12] }}>
          {(Object.keys(theme.colors) as (keyof typeof theme.colors)[]).map((name) => (
            <View key={name} style={{ width: 96, gap: theme.spacing[4] }}>
              <View style={{ height: 56, borderRadius: theme.radii.chip, backgroundColor: theme.colors[name], borderWidth: 1, borderColor: theme.colors.mist }} />
              <Text variant="caption">{name}</Text>
              <Text variant="caption" color="slateGray">{theme.colors[name]}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="LogoLockup">
        <LogoLockup />
      </Section>

      <Section title="GoogleIcon">
        <GoogleIcon />
      </Section>

      <Section title="Button">
        <View style={{ gap: theme.spacing[8] }}>
          <Button title="Primary" variant="primary" onPress={() => {}} />
          <Button title="Secondary" variant="secondary" onPress={() => {}} />
          <Button title="Danger (tap twice)" variant="danger" confirmTitle="Tap again to confirm" onPress={() => {}} />
          <Button title="Success" variant="success" onPress={() => {}} />
          <Button title="Warning" variant="warning" onPress={() => {}} />
          <Button title="Disabled" variant="primary" disabled onPress={() => {}} />
        </View>
        <Text variant="caption" color="slateGray">Sizes: medium (36pt), normal (40pt, default), large (48pt), scoreButton (56pt, mid-match controls only)</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8] }}>
          <Button title="Medium" size="medium" variant="secondary" onPress={() => {}} />
          <Button title="Normal" size="normal" variant="secondary" onPress={() => {}} />
          <Button title="Large" size="large" variant="secondary" onPress={() => {}} />
          <Button title="ScoreButton" size="scoreButton" variant="secondary" onPress={() => {}} />
        </View>
      </Section>

      <Section title="StatusPill">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] }}>
          <StatusPill status="registration_open" />
          <StatusPill status="in_progress" />
          <StatusPill status="completed" />
          <StatusPill status="rejected" />
        </View>
      </Section>

      <Section title="Card / CardGrid">
        <CardGrid>
          <Card><Text>Card one</Text><Text color="slateGray">Some supporting text.</Text></Card>
          <Card><Text>Card two</Text><Text color="slateGray">Cards wrap onto a second column once there&apos;s room.</Text></Card>
        </CardGrid>
      </Section>

      <Section title="ListGroup / ListRow">
        <ListGroup title="Settings">
          <ListRow title="Belts" detail="8 configured" onPress={() => {}} />
          <ListRow title="Staff" detail="3 people" onPress={() => {}} />
        </ListGroup>
      </Section>

      <Section title="ChoiceChips">
        <ChoiceChips label="Discipline" options={['kata', 'kumite'] as const} value={chip} onChange={setChip} />
      </Section>

      <Section title="TextField">
        <TextField label="Athlete name" placeholder="e.g. Alex Chen" value={text} onChangeText={setText} />
      </Section>

      <Section title="DateField (platform-specific: web is a masked input, native opens the OS picker)">
        <DateField label="Start date" value={date} onChange={setDate} />
      </Section>

      <Section title="StepBar">
        <StepBar steps={4} step={step} />
        <View style={{ flexDirection: 'row', gap: theme.spacing[8] }}>
          <Button title="Back" variant="secondary" onPress={() => setStep((s) => Math.max(0, s - 1))} />
          <Button title="Next" onPress={() => setStep((s) => Math.min(4, s + 1))} />
        </View>
      </Section>

      <Section title="LinkCard">
        <LinkCard url="https://knockout.app/register/sample-token" note="Share this with clubs to let them register." />
      </Section>

      <Section title="Skeleton / SkeletonCard / SkeletonList">
        <Skeleton width={200} height={20} />
        <SkeletonCard />
        <SkeletonList count={2} />
      </Section>

      <Section title="EventHeroCard / EventTile">
        <EventHeroCard event={sampleEvent} onPress={() => {}} />
        <View style={{ flexDirection: 'row', gap: theme.spacing[16] }}>
          <EventTile event={sampleEvent} onPress={() => {}} width={160} />
        </View>
      </Section>

      <Section title="TatamiQueueCard">
        <TatamiQueueCard
          name="Tatami 1"
          items={[
            { key: 'q1', a: 'Alex Chen', b: 'Jo Patel', time: '2026-11-14T10:15:00Z', category: 'Kumite Male U16', detail: 'Round 2' },
            { key: 'q2', a: 'Sam Rivera', b: null, time: null, category: 'Kata Female Adult', detail: 'Round 1' },
          ]}
        />
      </Section>

      <Section title="BracketTree (its entrance animation is platform-specific: RN Animated on native, GSAP on web)">
        <BracketTree matches={sampleMatches} />
      </Section>

      <Section title="AccountMenu">
        <View style={{ alignItems: 'flex-end' }}>
          <AccountMenu name="Sample User" />
        </View>
      </Section>

      <Section title="GlassTabBar">
        <View style={{ height: 100 }}>
          <GlassTabBar tabs={tabs} active={tab} onChange={setTab} />
        </View>
      </Section>

      <Section title="Glass (platform-specific: native uses expo-blur + a highlight gradient, web uses backdrop-filter)">
        <View style={{ height: 120, backgroundColor: theme.colors.inkBlack, borderRadius: theme.radii.card, padding: theme.spacing[16] }}>
          <Glass><View style={{ padding: theme.spacing[16] }}><Text>Frosted content</Text></View></Glass>
        </View>
      </Section>

      <Section title="Not shown here">
        <Text color="slateGray">
          Screen-specific or data-bound components aren&apos;t included: PageHeader and WebHeader (rendered by the
          navigator/root layout, not standalone), Podium (fetches live results), KumiteScoreboard /
          KataScoreboard / WinLossScoreboard (live match state), EventWizard / EventForm / CategoryForm /
          RosterUpload / SheetImport / CoverImageField (bound to Supabase mutations and file pickers), Splash and
          LoginArtwork (full-screen launch/auth backdrops), and the `event/*` screens (each composes several of
          the above with real event data).
        </Text>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: theme.spacing[12] }}>
      <Text variant="subheading">{title}</Text>
      <View style={{ gap: theme.spacing[8] }}>{children}</View>
    </View>
  );
}
