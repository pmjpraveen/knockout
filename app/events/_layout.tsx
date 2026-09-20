import { Stack } from 'expo-router';
import { stackScreenOptions } from '@/lib/navigation';

export default function EventsLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="new" options={{ headerShown: false }} />
      <Stack.Screen name="[id]/index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Edit event' }} />
      <Stack.Screen name="[id]/belts" options={{ title: 'Belts' }} />
      <Stack.Screen name="[id]/staff" options={{ title: 'Staff' }} />
      <Stack.Screen name="[id]/import-categories" options={{ title: 'Import categories' }} />
      <Stack.Screen name="[id]/import-athletes" options={{ title: 'Import participants' }} />
      <Stack.Screen name="[id]/clone" options={{ title: 'Copy categories' }} />
      <Stack.Screen name="[id]/restructure" options={{ title: 'Merge or split' }} />
      <Stack.Screen name="[id]/split" options={{ title: 'Split category' }} />
      <Stack.Screen name="[id]/link" options={{ title: 'Registration link' }} />
      <Stack.Screen name="[id]/submissions" options={{ title: 'Submissions' }} />
      <Stack.Screen name="[id]/submissions/[entryId]" options={{ title: 'Submission' }} />
      <Stack.Screen name="[id]/athlete" options={{ title: 'Participant' }} />
      <Stack.Screen name="[id]/brackets" options={{ title: 'Brackets' }} />
      <Stack.Screen name="[id]/bracket-setup" options={{ title: 'Seed & generate' }} />
      <Stack.Screen name="[id]/bracket" options={{ title: 'Bracket' }} />
      <Stack.Screen name="[id]/schedule" options={{ title: 'Schedule' }} />
      <Stack.Screen name="[id]/tatami" options={{ title: 'Tatami queue' }} />
      <Stack.Screen name="[id]/tatamis" options={{ title: 'Tatamis & timing' }} />
      <Stack.Screen name="[id]/bracket-split" options={{ title: 'Split across tatamis' }} />
      <Stack.Screen name="[id]/scoreboard" options={{ title: 'Scoreboard' }} />
      <Stack.Screen name="[id]/match" options={{ title: 'Match' }} />
      <Stack.Screen name="[id]/match-audit" options={{ title: 'Match audit' }} />
      <Stack.Screen name="[id]/conflicts" options={{ title: 'Scoring conflicts' }} />
      <Stack.Screen name="[id]/categories/new" options={{ title: 'New category' }} />
      <Stack.Screen name="[id]/categories/[categoryId]" options={{ title: 'Edit category' }} />
    </Stack>
  );
}
