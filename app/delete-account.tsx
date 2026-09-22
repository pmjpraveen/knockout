import { useState } from 'react';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { deleteAccount } from '@/lib/deleteAccount';

export default function DeleteAccount() {
  const [typed, setTyped] = useState('');
  const { run, busy, error } = useSubmit();

  return (
    <Screen>
      <Text variant="subheading" weight="medium">Delete your account</Text>
      <Text color="charcoal">This cannot be undone. When you delete your account:</Text>
      <Text color="charcoal">• Your login is removed and you are signed out.</Text>
      <Text color="charcoal">• If you are an organizer, every tournament you created is deleted with everything in it: categories, participants, brackets, schedules, results and cover images.</Text>
      <Text color="charcoal">• If you are a tournament director or scorekeeper, you lose access to the tournaments you worked on. The tournaments themselves stay.</Text>
      <TextField label="Type DELETE to confirm" value={typed} onChangeText={setTyped} autoCapitalize="characters" />
      {error && <Text color="danger">{error}</Text>}
      <Button title="Delete my account" variant="danger" disabled={busy || typed.trim() !== 'DELETE'} onPress={() => run(deleteAccount)} />
    </Screen>
  );
}
