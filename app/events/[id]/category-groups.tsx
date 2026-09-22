import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChips } from '@/components/ChoiceChips';
import { Podium } from '@/components/Podium';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useMyRoles } from '@/hooks/useMyRoles';
import { useSubmit } from '@/hooks/useSubmit';
import { supabase } from '@/lib/supabase';

const maxChips = 8;

/** Group sizes when `total` athletes are dealt into `count` groups: they differ by at most one. */
const sizesOf = (total: number, count: number) => Array.from({ length: count }, (_, i) => Math.floor(total / count) + (i < total % count ? 1 : 0));

export default function CategoryGroups() {
  const { id, categoryId } = useLocalSearchParams<{ id: string; categoryId: string }>();
  const router = useRouter();
  const { isOrganizer } = useMyRoles(id);
  const { run, busy, error } = useSubmit();
  const [wanted, setWanted] = useState<number | null>(null);
  const [perGroup, setPerGroup] = useState('');
  const [rings, setRings] = useState<Record<number, string>>({});

  const { rows: tapped } = useFocusQuery(() => supabase.from('categories').select('id, split_root').eq('id', categoryId), [categoryId]);
  const root = tapped[0] ? (tapped[0].split_root ?? tapped[0].id) : null;
  const { rows: groups, reload } = useFocusQuery(
    () => supabase.from('categories').select('*, registrations(count)').or(`id.eq.${root},split_root.eq.${root}`).order('split_index', { nullsFirst: true }).order('created_at'),
    [root],
    undefined,
    !!root,
  );
  const groupIds = groups.map((group) => group.id);
  const { rows: brackets, reload: reloadBrackets } = useFocusQuery(() => supabase.from('brackets').select('category_id, matches(status)').in('category_id', groupIds), [groupIds.join()], undefined, groupIds.length > 0);
  const { rows: tatamis } = useFocusQuery(() => supabase.from('tatamis').select('id, name').eq('event_id', id).order('name'), [id]);

  const total = groups.reduce((sum, group) => sum + (group.registrations[0]?.count ?? 0), 0);
  const base = groups[0]?.label.replace(/ · Group [A-Z]$/, '') ?? '';
  const maxGroups = Math.max(1, Math.floor(total / 2));
  const count = Math.min(wanted ?? groups.length, maxGroups);
  const sizes = sizesOf(total, count);
  const started = brackets.some((bracket) => bracket.matches.some((match) => match.status === 'in_progress' || match.status === 'completed'));
  const drawnIds = new Set(brackets.map((bracket) => bracket.category_id));
  const ringName = new Map(tatamis.map((tatami) => [tatami.id, tatami.name]));
  const ringOf = (index: number) => rings[index] ?? (count > 1 && tatamis.length ? tatamis[index % tatamis.length].id : (groups[index]?.tatami_id ?? 'none'));

  const apply = () =>
    run(async () => {
      const chosen = Array.from({ length: count }, (_, index) => ringOf(index)).filter((ring) => ring !== 'none');
      const result = await supabase.rpc('set_category_groups', { p_category_id: categoryId, p_groups: count, p_tatami_ids: chosen.length === count ? chosen : undefined });
      setRings({});
      await Promise.all([reload(), reloadBrackets()]);
      return result;
    });

  const drawAll = () =>
    run(async () => {
      for (const group of groups) {
        if ((group.registrations[0]?.count ?? 0) < 2) continue;
        const result = await supabase.rpc('generate_bracket', { p_category_id: group.id });
        if (result.error) return result;
      }
      await reloadBrackets();
      return { error: null };
    });

  const label = count === groups.length ? (count === 1 ? 'Keep as one group' : 'Reshuffle the athletes') : count === 1 ? 'Merge back into one group' : `Split into ${count} groups`;
  const changes = count !== groups.length || count > 1;

  return (
    <Screen>
      <Text variant="heading" weight="medium">{base}</Text>
      <Text color="slateGray">
        {total} athletes. Split them into groups that run at the same time, each with its own bracket and its own 1st, 2nd and 3rd. Athletes are dealt at random and club-mates are kept in different groups. Seeds are cleared.
      </Text>
      {!isOrganizer && <Text color="warning">Only the organizer can split a category.</Text>}
      {started && <Text color="warning">Matches have started, so the groups are locked.</Text>}

      <ChoiceChips
        label="Number of groups"
        options={Array.from({ length: Math.min(maxGroups, maxChips) }, (_, index) => String(index + 1))}
        value={String(count)}
        onChange={(next) => { setWanted(Number(next)); setPerGroup(''); setRings({}); }}
      />
      <TextField label="Or athletes per group" value={perGroup} placeholder="e.g. 8" keyboardType="number-pad" onChangeText={(text) => { setPerGroup(text); setRings({}); if (Number(text) >= 2) setWanted(Math.ceil(total / Number(text))); }} />
      <Text color="charcoal">{count === 1 ? `One group of ${total}` : `${count} groups of ${sizes.join(', ')}`}</Text>

      {count > 1 && tatamis.length > 0 && Array.from({ length: count }, (_, index) => (
        <ChoiceChips
          key={index}
          label={`Group ${String.fromCharCode(65 + index)} runs on`}
          options={['none', ...tatamis.map((tatami) => tatami.id)]}
          value={ringOf(index)}
          labels={{ none: 'Any', ...Object.fromEntries(tatamis.map((tatami) => [tatami.id, tatami.name])) }}
          onChange={(ring) => setRings((current) => ({ ...current, [index]: ring }))}
        />
      ))}

      {error && <Text color="danger">{error}</Text>}
      <Button
        title={label}
        disabled={busy || !isOrganizer || started || !changes || total < 2}
        confirmTitle={groups.some((group) => drawnIds.has(group.id)) ? 'Tap again: this throws away the drawn brackets' : undefined}
        onPress={apply}
      />

      {groups.length > 1 && (
        <>
          <Text variant="subheading" weight="medium">Groups</Text>
          {groups.map((group) => (
            <Card key={group.id}>
              <Text variant="bodyLg" weight="medium">{group.label}</Text>
              <Text variant="body" color="slateGray">
                {group.registrations[0]?.count ?? 0} athletes · {ringName.get(group.tatami_id ?? '') ?? 'no tatami yet'}
              </Text>
              {isOrganizer && (
                <Button title={drawnIds.has(group.id) ? 'Seed & redraw' : 'Seed & generate'} variant="secondary" disabled={started} onPress={() => router.push({ pathname: '/events/[id]/bracket-setup', params: { id, categoryId: group.id } })} />
              )}
              {drawnIds.has(group.id) && <Button title="View bracket" variant="secondary" onPress={() => router.push({ pathname: '/events/[id]/bracket', params: { id, categoryId: group.id } })} />}
              <Podium categoryId={group.id} />
            </Card>
          ))}
          {isOrganizer && <Button title="Draw every group" disabled={busy || started} onPress={drawAll} />}
        </>
      )}
    </Screen>
  );
}
