import { useLocalSearchParams, useRouter } from 'expo-router';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import { useState } from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FormSection } from '@/components/FormSection';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { formatDateTime, humanize } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

const explanations: Record<string, string> = {
  match_not_found: 'The bracket was redrawn while a device was offline, so this match no longer exists.',
  match_finalized: 'The match already has a result (another device or an override).',
  device_mismatch: 'A different scoreboard device holds this match.',
  not_authorized: 'The scorekeeper is not assigned to this match’s tatami.',
  not_ready: 'The match was not ready to be scored.',
  not_started: 'Scores arrived for a match that was never started.',
};

export default function Conflicts() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [note, setNote] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const { run, busy, error } = useSubmit();
  const { rows, loading, reload } = useFocusQuery(() =>
    supabase.from('scoring_conflicts').select('*').eq('event_id', id).is('resolved_at', null).order('created_at', { ascending: false }),
  );

  const resolve = async (conflictId: string) => {
    if (await run(() => supabase.rpc('resolve_scoring_conflict', { p_conflict_id: conflictId, p_note: note }))) {
      setOpen(null);
      setNote('');
      reload();
    }
  };

  const selected = rows.find((conflict) => conflict.id === open);
  const closeSheet = () => {
    setOpen(null);
    setNote('');
  };

  return (
    <Screen>
      {error && <Text color="danger">{error}</Text>}
      {loading && <SkeletonList count={2} />}
      {!loading && rows.length === 0 && (
        <EmptyState Icon={CircleCheck} title="No unresolved conflicts" text="Operations a scoreboard device sent that the server could not apply show up here for review." />
      )}
      {rows.length > 0 && (
        <FormSection title={`Needs review · ${rows.length}`} hint="Nothing is applied automatically. Review the match, set the result if needed, then resolve.">
          <ListGroup>
            {rows.map((conflict) => (
              <ListRow
                key={conflict.id}
                Icon={TriangleAlert}
                title={humanize(conflict.reason)}
                subtitle={formatDateTime(conflict.created_at)}
                onPress={() => setOpen(conflict.id)}
              />
            ))}
          </ListGroup>
        </FormSection>
      )}

      <BottomSheet visible={!!selected} title={selected ? humanize(selected.reason) : ''} onClose={closeSheet}>
        {selected && (
          <View style={{ gap: theme.spacing[16] }}>
            <Text>{explanations[selected.reason] ?? 'The server rejected this operation.'}</Text>
            <Text variant="body" color="slateGray">
              {formatDateTime(selected.created_at)} · device {selected.device_id.slice(0, 8)} · {(selected.op as { kind?: string }).kind}
            </Text>
            {selected.match_id && selected.reason !== 'match_not_found' && (
              <Button title="Open match audit" variant="secondary" onPress={() => { closeSheet(); router.push({ pathname: '/events/[id]/match-audit', params: { id, matchId: selected.match_id! } }); }} />
            )}
            <TextField label="How was this resolved?" value={note} onChangeText={setNote} autoCapitalize="sentences" />
            <Button size="large" title="Mark resolved" disabled={busy || !note.trim()} onPress={() => resolve(selected.id)} />
          </View>
        )}
      </BottomSheet>
    </Screen>
  );
}
