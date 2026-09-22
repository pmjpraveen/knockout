import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChips } from '@/components/ChoiceChips';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { bracketFormatLabels, bracketFormats } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

export default function BracketSetup() {
  const { id, categoryId } = useLocalSearchParams<{ id: string; categoryId: string }>();
  const router = useRouter();
  const [format, setFormat] = useState<(typeof bracketFormats)[number]>('single_elim_repechage');
  const [seedIds, setSeedIds] = useState<string[]>([]);
  const [initialised, setInitialised] = useState(false);
  const { run, busy, error } = useSubmit();

  const { rows: categories } = useFocusQuery(() => supabase.from('categories').select('*').eq('id', categoryId));
  const { rows: registrations, reload } = useFocusQuery(() =>
    supabase.from('registrations').select('id, seed, athletes(full_name, club_entries(club_name))').eq('category_id', categoryId),
  );
  const { rows: brackets } = useFocusQuery(() => supabase.from('brackets').select('id, matches(status)').eq('category_id', categoryId));

  const category = categories[0];
  const started = brackets[0]?.matches.some((m) => m.status === 'in_progress' || m.status === 'completed') ?? false;

  useEffect(() => {
    if (initialised || !category || registrations.length === 0) return;
    setFormat((category.bracket_format as typeof format) ?? 'single_elim_repechage');
    setSeedIds([...registrations].filter((r) => r.seed !== null).sort((x, y) => x.seed! - y.seed!).map((r) => r.id));
    setInitialised(true);
  }, [category, registrations, initialised]);

  const byId = new Map(registrations.map((r) => [r.id, r]));
  const seeded = seedIds.filter((rid) => byId.has(rid));
  const unseeded = registrations.filter((r) => !seeded.includes(r.id));

  const move = (index: number, by: number) =>
    setSeedIds(() => {
      const next = [...seeded];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });

  const withdraw = async (registrationId: string) => {
    if (await run(() => supabase.from('registrations').delete().eq('id', registrationId))) reload();
  };

  const generate = () =>
    run(async () => {
      const seeds = await supabase.rpc('set_seeds', { p_category_id: categoryId, p_registration_ids: seeded });
      if (seeds.error) return seeds;
      const result = await supabase.rpc('generate_bracket', { p_category_id: categoryId, p_format: format });
      if (!result.error) router.replace({ pathname: '/events/[id]/bracket', params: { id, categoryId } });
      return result;
    });

  const row = (registrationId: string, label: string, caption: string, actions: React.ReactNode) => (
    <Card key={registrationId}>
      <Text weight="medium">{label}</Text>
      <Text variant="body" color="slateGray">{caption}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] }}>{actions}</View>
    </Card>
  );

  return (
    <Screen>
      <Text variant="heading" weight="medium">{category?.label}</Text>
      <Text color="slateGray">
        {registrations.length} athletes. Seeded athletes are placed first and byes go to the top seeds. Everyone else is drawn at random, keeping club-mates apart in round 1 where possible.
      </Text>
      {started && <Text color="warning">Matches have started, so seeds and the draw are locked. Use a withdrawal override on the bracket instead.</Text>}

      <ChoiceChips label="Format" options={bracketFormats} value={format} labels={bracketFormatLabels} onChange={setFormat} />

      <Text variant="subheading" weight="medium">Seeds</Text>
      {seeded.length === 0 && <Text color="slateGray">No manual seeds. The whole draw is random.</Text>}
      {seeded.map((rid, index) => {
        const r = byId.get(rid)!;
        return row(rid, `${index + 1}. ${r.athletes?.full_name}`, r.athletes?.club_entries?.club_name ?? '', !started && (
          <>
            <Button title="Up" variant="secondary" disabled={index === 0} onPress={() => move(index, -1)} />
            <Button title="Down" variant="secondary" disabled={index === seeded.length - 1} onPress={() => move(index, 1)} />
            <Button title="Unseed" variant="secondary" onPress={() => setSeedIds(seeded.filter((s) => s !== rid))} />
          </>
        ));
      })}

      <Text variant="subheading" weight="medium">Unseeded</Text>
      {unseeded.map((r) =>
        row(r.id, r.athletes?.full_name ?? '', r.athletes?.club_entries?.club_name ?? '', !started && (
          <>
            <Button title="Seed" variant="secondary" onPress={() => setSeedIds([...seeded, r.id])} />
            <Button title="Withdraw" variant="danger" confirmTitle="Tap again to remove" disabled={busy} onPress={() => withdraw(r.id)} />
          </>
        )),
      )}

      {error && <Text color="danger">{error}</Text>}
      <Button
        title={brackets[0] ? 'Redraw bracket' : 'Generate bracket'}
        disabled={busy || started || registrations.length < 2}
        onPress={generate}
      />
    </Screen>
  );
}
