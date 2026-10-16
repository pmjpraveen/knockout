import { useLocalSearchParams, useRouter } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Inbox from 'lucide-react-native/icons/inbox';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChips } from '@/components/ChoiceChips';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { formatDateTime } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';
import { pressFeedback } from '@/lib/press';

const filters = ['all', 'submitted', 'rejected', 'approved'] as const;

export default function Submissions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof filters)[number]>('all');
  const [flagging, setFlagging] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const { run, busy, error } = useSubmit();
  const { rows: entries, loading, reload } = useFocusQuery(() =>
    supabase.from('club_entries').select('*, athletes(count)').eq('event_id', id).order('submitted_at'),
  );

  const approve = async (entryId: string) => {
    let unmatched = 0;
    const ok = await run(async () => {
      const result = await supabase.rpc('approve_club_entry', { p_club_entry_id: entryId });
      unmatched = result.data ?? 0;
      return result;
    });
    if (ok) {
      setNotice(unmatched ? `Approved. ${unmatched} participant(s) matched no category. Open the submission to review.` : 'Approved and sorted into categories.');
      reload();
    }
  };

  const flag = async (entryId: string) => {
    if (await run(() => supabase.rpc('flag_club_entry', { p_club_entry_id: entryId, p_reason: reason }))) {
      setFlagging(null);
      setReason('');
      reload();
    }
  };

  const counts = { all: entries.length, submitted: 0, rejected: 0, approved: 0 };
  for (const entry of entries) if (entry.approval_status in counts) counts[entry.approval_status as keyof typeof counts] += 1;
  const shown = filter === 'all' ? entries : entries.filter((entry) => entry.approval_status === filter);

  return (
    <Screen>
      {notice && (
        <View style={{ padding: theme.spacing[16], borderRadius: theme.radii.card, backgroundColor: theme.colors.successTint }}>
          <Text color="success">{notice}</Text>
        </View>
      )}
      {error && <Text color="danger">{error}</Text>}
      {loading && <SkeletonList />}
      {!loading && entries.length === 0 && (
        <EmptyState Icon={Inbox} title="No submissions yet" text="Clubs appear here once they send in their participants through your registration link." />
      )}
      {entries.length > 0 && (
        <ChoiceChips
          label="Show"
          hideLabel
          options={filters}
          value={filter}
          onChange={setFilter}
          labels={{ all: `All ${counts.all}`, submitted: `To review ${counts.submitted}`, rejected: `Flagged ${counts.rejected}`, approved: `Approved ${counts.approved}` }}
        />
      )}
      {entries.length > 0 && shown.length === 0 && <Text color="slateGray">Nothing here.</Text>}
      {shown.map((entry) => (
        <Card key={entry.id}>
          <View style={{ gap: theme.spacing[16] }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${entry.club_name}, open submission`} onPress={() => router.push({ pathname: '/events/[id]/submissions/[entryId]', params: { id, entryId: entry.id } })} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8] }, pressFeedback(pressed)]}>
              <View style={{ flex: 1, gap: theme.spacing[8] }}>
                <Text variant="bodyLg">{entry.club_name}</Text>
                <Text color="slateGray">
                  {entry.athletes[0]?.count ?? 0} participants · {formatDateTime(entry.submitted_at)}
                </Text>
                <View style={{ alignSelf: 'flex-start' }}><StatusPill status={entry.approval_status} /></View>
              </View>
              <ChevronRight size={20} color={theme.colors.steelGray} strokeWidth={1.75} />
            </Pressable>
            {entry.rejection_reason && (
              <View style={{ gap: theme.spacing[4], padding: theme.spacing[12], borderRadius: theme.radii.button, backgroundColor: theme.colors.warningTint }}>
                <Text variant="label" color="warning">Sent back</Text>
                <Text variant="body">{entry.rejection_reason}</Text>
              </View>
            )}
            {entry.approval_status === 'submitted' && (
              <View style={{ gap: theme.spacing[12] }}>
                {flagging === entry.id && (
                  <>
                    <TextField label="What should the club fix?" value={reason} onChangeText={setReason} autoCapitalize="sentences" />
                    <Button title="Send back to club" variant="warning" disabled={busy || !reason.trim()} onPress={() => flag(entry.id)} />
                  </>
                )}
                <View style={{ flexDirection: 'row', gap: theme.spacing[12] }}>
                  <View style={{ flex: 1 }}><Button title="Approve" variant="success" disabled={busy} onPress={() => approve(entry.id)} /></View>
                  <View style={{ flex: 1 }}>
                    <Button title={flagging === entry.id ? 'Cancel' : 'Flag'} variant="warning" onPress={() => setFlagging(flagging === entry.id ? null : entry.id)} />
                  </View>
                </View>
              </View>
            )}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
