import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChips } from '@/components/ChoiceChips';
import { FormSection, SectionDivider } from '@/components/FormSection';
import { Podium } from '@/components/Podium';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useMyRoles } from '@/hooks/useMyRoles';
import { useSubmit } from '@/hooks/useSubmit';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

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
  const base = groups[0]?.label.replace(/ · (?:Group|Pool) [A-Z]$/, '') ?? '';
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

  const label = count === groups.length ? (count === 1 ? 'Keep as one pool' : 'Reshuffle the athletes') : count === 1 ? 'Merge back into one pool' : `Split into ${count} pools`;
  const changes = count !== groups.length || count > 1;

  const notice = (text: string) => (
    <View style={{ padding: theme.spacing[16], borderRadius: theme.radii.card, backgroundColor: theme.colors.warningTint }}>
      <Text color="warning">{text}</Text>
    </View>
  );
  const locked = !isOrganizer || started;

  return (
    <Screen
      footer={
        <>
          {error && <Text color="danger">{error}</Text>}
          <Button
            size="large"
            title={label}
            disabled={busy || locked || !changes || total < 2}
            confirmTitle={groups.some((group) => drawnIds.has(group.id)) ? 'Tap again: this throws away the drawn brackets' : undefined}
            onPress={apply}
          />
        </>
      }
    >
      <View style={{ gap: theme.spacing[8] }}>
        <Text variant="heading">{base}</Text>
        <Text color="slateGray">{total} athletes</Text>
      </View>
      <Text color="slateGray">
        Pools run at the same time, each with its own bracket and its own 1st, 2nd and 3rd. Athletes are dealt at random and club-mates are kept in different pools. Seeds are cleared.
      </Text>
      {!isOrganizer && notice('Only the organizer can split a category.')}
      {started && notice('Matches have started, so the pools are locked.')}

      <FormSection title="Pools">
        <ChoiceChips
          label="Number of pools"
          options={Array.from({ length: Math.min(maxGroups, maxChips) }, (_, index) => String(index + 1))}
          value={String(count)}
          onChange={(next) => { setWanted(Number(next)); setPerGroup(''); setRings({}); }}
        />
        <TextField label="Or athletes per pool" value={perGroup} placeholder="e.g. 8" keyboardType="number-pad" onChangeText={(text) => { setPerGroup(text); setRings({}); if (Number(text) >= 2) setWanted(Math.ceil(total / Number(text))); }} />
        <View style={{ padding: theme.spacing[16], borderRadius: theme.radii.card, backgroundColor: theme.colors.cloud }}>
          <Text variant="bodyLg">{count === 1 ? `One pool of ${total}` : `${count} pools of ${sizes.join(', ')}`}</Text>
        </View>
      </FormSection>

      {count > 1 && tatamis.length > 0 && <SectionDivider />}
      {count > 1 && tatamis.length > 0 && (
        <FormSection title="Where each pool runs">
          {Array.from({ length: count }, (_, index) => (
            <ChoiceChips
              key={index}
              label={`Pool ${String.fromCharCode(65 + index)} runs on`}
              options={['none', ...tatamis.map((tatami) => tatami.id)]}
              value={ringOf(index)}
              labels={{ none: 'Any', ...Object.fromEntries(tatamis.map((tatami) => [tatami.id, tatami.name])) }}
              onChange={(ring) => setRings((current) => ({ ...current, [index]: ring }))}
            />
          ))}
        </FormSection>
      )}

      {groups.length > 1 && <SectionDivider />}
      {groups.length > 1 && (
        <FormSection title="Current pools">
          {groups.map((group) => (
            <Card key={group.id}>
              <View style={{ gap: theme.spacing[16] }}>
                <View style={{ gap: theme.spacing[4] }}>
                  <Text variant="bodyLg">{group.label}</Text>
                  <Text color="slateGray">
                    {group.registrations[0]?.count ?? 0} athletes · {ringName.get(group.tatami_id ?? '') ?? 'no tatami yet'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: theme.spacing[12] }}>
                  {isOrganizer && (
                    <View style={{ flex: 1 }}>
                      <Button title={drawnIds.has(group.id) ? 'Redraw' : 'Seed & draw'} variant="secondary" disabled={started} onPress={() => router.push({ pathname: '/events/[id]/bracket-setup', params: { id, categoryId: group.id } })} />
                    </View>
                  )}
                  {drawnIds.has(group.id) && (
                    <View style={{ flex: 1 }}>
                      <Button title="View bracket" variant="secondary" onPress={() => router.push({ pathname: '/events/[id]/bracket', params: { id, categoryId: group.id } })} />
                    </View>
                  )}
                </View>
                <Podium categoryId={group.id} />
              </View>
            </Card>
          ))}
          {isOrganizer && <Button title="Draw every pool" disabled={busy || started} onPress={drawAll} />}
        </FormSection>
      )}
    </Screen>
  );
}
