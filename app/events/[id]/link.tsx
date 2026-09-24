import { useLocalSearchParams } from 'expo-router';
import { ActionRow } from '@/components/ActionRow';
import { Button } from '@/components/Button';
import { LinkCard } from '@/components/LinkCard';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { registrationUrl } from '@/lib/registration';
import { supabase } from '@/lib/supabase';

export default function RegistrationLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rows, reload } = useFocusQuery(() => supabase.from('registration_links').select('*').eq('event_id', id));
  const { run, busy, error } = useSubmit();
  const link = rows[0];

  const generate = () => run(async () => {
    const result = await supabase.rpc('regenerate_registration_link', { p_event_id: id });
    await reload();
    return result;
  });
  const setActive = (active: boolean) => run(async () => {
    const result = await supabase.from('registration_links').update({ is_active: active }).eq('id', link!.id);
    await reload();
    return result;
  });

  return (
    <Screen>
      <Text color="slateGray">
        Share one link with every club. It needs no account. Clubs can edit their submission from the same link until you approve it.
      </Text>
      {link ? (
        <>
          <LinkCard
            url={registrationUrl(link.token)}
            note={`${link.is_active ? 'Active' : 'Deactivated'} · regenerated ${link.regenerated_count}×`}
          />
          <ActionRow>
            <Button
              title={link.is_active ? 'Deactivate link' : 'Reactivate link'}
              variant="secondary"
              disabled={busy}
              onPress={() => setActive(!link.is_active)}
            />
            <Button
              title="Regenerate link"
              variant="danger"
              confirmTitle="Tap again: the old link stops working"
              disabled={busy}
              onPress={generate}
            />
          </ActionRow>
        </>
      ) : (
        <Button title="Generate registration link" disabled={busy} onPress={generate} />
      )}
      {error && <Text color="danger">{error}</Text>}
    </Screen>
  );
}
