import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
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

export default function Submissions() {
  const { id } = useLocalSearchParams<{ id: string }>();
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

  return (
    <Screen>
      {notice && <Text color="success">{notice}</Text>}
      {error && <Text color="danger">{error}</Text>}
      {loading && <SkeletonList />}
      {!loading && entries.length === 0 && <Text color="slateGray">No submissions yet.</Text>}
      {entries.map((entry) => (
        <Card key={entry.id}>
          <Link href={{ pathname: '/events/[id]/submissions/[entryId]', params: { id, entryId: entry.id } }} asChild>
            <Pressable style={({ pressed }) => [{ gap: theme.spacing[4] }, pressFeedback(pressed)]}>
              <Text variant="bodyLg">{entry.club_name}</Text>
              <Text variant="body" color="slateGray">
                {entry.athletes[0]?.count ?? 0} participants · {formatDateTime(entry.submitted_at)}
              </Text>
              <StatusPill status={entry.approval_status} />
              {entry.rejection_reason && <Text variant="body" color="warning">{entry.rejection_reason}</Text>}
            </Pressable>
          </Link>
          {entry.approval_status === 'submitted' && (
            <View style={{ gap: theme.spacing[8], marginTop: theme.spacing[8] }}>
              {flagging === entry.id && (
                <>
                  <TextField label="What should the club fix?" value={reason} onChangeText={setReason} autoCapitalize="sentences" />
                  <Button title="Send back to club" variant="warning" disabled={busy || !reason.trim()} onPress={() => flag(entry.id)} />
                </>
              )}
              <View style={{ flexDirection: 'row', gap: theme.spacing[8] }}>
                <View style={{ flex: 1 }}><Button title="Approve" variant="success" disabled={busy} onPress={() => approve(entry.id)} /></View>
                <View style={{ flex: 1 }}>
                  <Button title={flagging === entry.id ? 'Cancel' : 'Flag'} variant="warning" onPress={() => setFlagging(flagging === entry.id ? null : entry.id)} />
                </View>
              </View>
            </View>
          )}
        </Card>
      ))}
    </Screen>
  );
}
