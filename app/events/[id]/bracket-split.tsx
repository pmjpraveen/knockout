import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { ChoiceChips } from '@/components/ChoiceChips';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { supabase } from '@/lib/supabase';

export default function BracketSplit() {
  const { id, categoryId } = useLocalSearchParams<{ id: string; categoryId: string }>();
  const router = useRouter();
  const [chosen, setChosen] = useState<string[]>([]);
  const [home, setHome] = useState('');
  const [converge, setConverge] = useState('2');
  const { run, busy, error } = useSubmit();

  const { rows: tatamis } = useFocusQuery(() => supabase.from('tatamis').select('*').eq('event_id', id).order('name'));
  const { rows: categories } = useFocusQuery(() => supabase.from('categories').select('label').eq('id', categoryId));
  const { rows: brackets } = useFocusQuery(() => supabase.from('brackets').select('id, format').eq('category_id', categoryId));
  const bracket = brackets[0];
  // brackets.rounds also counts losers-bracket and ladder rounds; only the main/winners bracket can converge.
  const { rows: topRound } = useFocusQuery(
    () => supabase.from('matches').select('round').eq('bracket_id', bracket?.id ?? '').in('bracket_side', ['main', 'winners']).order('round', { ascending: false }).limit(1),
    [bracket?.id],
  );
  const robin = bracket?.format === 'round_robin';
  const labels = Object.fromEntries(tatamis.map((t) => [t.id, t.name]));
  const rounds = Array.from({ length: Math.max((topRound[0]?.round ?? 2) - 1, 1) }, (_, i) => String(i + 2));

  const toggle = (tatamiId: string) => setChosen((c) => (c.includes(tatamiId) ? c.filter((x) => x !== tatamiId) : [...c, tatamiId]));

  const apply = () =>
    run(async () => {
      const result = await supabase.rpc('split_bracket_across_tatamis', {
        p_category_id: categoryId,
        p_tatami_ids: chosen,
        p_home_tatami: home,
        p_converge_round: robin ? undefined : Number(converge),
      });
      if (!result.error) router.back();
      return result;
    });

  return (
    <Screen>
      <Text variant="heading">{categories[0]?.label}</Text>
      <Text color="slateGray">
        {robin
          ? 'Pools are shared out across the rings you pick. Standings stay unified.'
          : 'Early rounds run in parallel on the rings you pick, then everything converges on the home tatami. It stays one bracket, so seeding and results are unified.'}
      </Text>
      <ChoiceChips label="Run in parallel on (pick 2+)" options={tatamis.map((t) => t.id)} value="" labels={labels} onChange={toggle} />
      <Text variant="body" color="slateGray">Selected: {chosen.map((c) => labels[c]).join(', ') || 'none'}</Text>
      <ChoiceChips label="Home tatami" options={tatamis.map((t) => t.id)} value={home} labels={labels} onChange={setHome} />
      {!robin && <ChoiceChips label="Converge from round" options={rounds} value={converge} labels={Object.fromEntries(rounds.map((r) => [r, `Round ${r}`]))} onChange={setConverge} />}
      {error && <Text color="danger">{error}</Text>}
      <Button title="Split bracket" disabled={busy || chosen.length < 2 || !home} onPress={apply} />
    </Screen>
  );
}
