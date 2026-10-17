import { useLocalSearchParams, useRouter } from 'expo-router';
import ScrollText from 'lucide-react-native/icons/scroll-text';
import { Pressable } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ListGroup } from '@/components/ListGroup';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { activityTitle } from '@/lib/activity';
import { formatDateTime } from '@/lib/events';
import { pressFeedback } from '@/lib/press';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

/** Everything the organizer and directors changed, newest first. Entries about a club or a match open it. */
export default function Activity() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // ponytail: latest 100 only; add paging if an event's log outgrows that
  const { rows, loading, error } = useFocusQuery(() => supabase.from('audit_log').select('*').eq('event_id', id).order('created_at', { ascending: false }).limit(100), [id]);

  const open = (action: string, subject: string) => {
    if (['add_athlete', 'edit_athlete', 'withdraw_registration', 'import_athletes'].includes(action)) router.push({ pathname: '/events/[id]/submissions/[entryId]', params: { id, entryId: subject } });
    else if (['override_result', 'release_scoreboard'].includes(action)) router.push({ pathname: '/events/[id]/match-audit', params: { id, matchId: subject } });
  };
  const opens = (action: string) => ['add_athlete', 'edit_athlete', 'withdraw_registration', 'import_athletes', 'override_result', 'release_scoreboard'].includes(action);

  return (
    <Screen>
      {error && <Text color="danger">{error}</Text>}
      {loading && <SkeletonList count={4} />}
      {!loading && rows.length === 0 && <EmptyState Icon={ScrollText} title="No activity yet" text="Changes to submissions, withdrawals and scoring overrides are listed here." />}
      {rows.length > 0 && (
        <ListGroup>
          {rows.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole={opens(row.action) ? 'button' : 'text'}
              disabled={!opens(row.action)}
              onPress={() => open(row.action, row.subject_id)}
              style={({ pressed }) => [{ gap: theme.spacing[4], paddingHorizontal: theme.spacing[16], paddingVertical: theme.spacing[12] }, opens(row.action) && pressFeedback(pressed)]}
            >
              <Text>{activityTitle(row.action, row.changes)}</Text>
              <Text variant="body" color="slateGray">{row.reason}</Text>
              <Text variant="body" color="steelGray">{formatDateTime(row.created_at)}</Text>
            </Pressable>
          ))}
        </ListGroup>
      )}
    </Screen>
  );
}
