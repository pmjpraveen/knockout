import { useLocalSearchParams, useRouter } from 'expo-router';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import Trash from 'lucide-react-native/icons/trash';
import X from 'lucide-react-native/icons/x';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ChoiceChips } from '@/components/ChoiceChips';
import { FormSection, SectionDivider } from '@/components/FormSection';
import { IconAction } from '@/components/IconAction';
import { ListGroup } from '@/components/ListGroup';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { BracketFormat, bracketFormatLabels, formatOptions } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

export default function BracketSetup() {
  const { id, categoryId } = useLocalSearchParams<{ id: string; categoryId: string }>();
  const router = useRouter();
  const [format, setFormat] = useState<BracketFormat>('single_elim_repechage');
  const [seedIds, setSeedIds] = useState<string[]>([]);
  const [initialised, setInitialised] = useState(false);
  const [withdrawing, setWithdrawing] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState('');
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

  const closeWithdraw = () => {
    setWithdrawing(null);
    setReason('');
  };

  const withdraw = async () => {
    if (await run(() => supabase.rpc('withdraw_registration', { p_registration_id: withdrawing!.id, p_reason: reason }))) {
      closeWithdraw();
      reload();
    }
  };

  const generate = () =>
    run(async () => {
      const seeds = await supabase.rpc('set_seeds', { p_category_id: categoryId, p_registration_ids: seeded });
      if (seeds.error) return seeds;
      const result = await supabase.rpc('generate_bracket', { p_category_id: categoryId, p_format: format });
      if (!result.error) router.replace({ pathname: '/events/[id]/bracket', params: { id, categoryId } });
      return result;
    });

  const person = (name: string, club: string) => (
    <View style={{ flex: 1, gap: theme.spacing[4] }}>
      <Text numberOfLines={1}>{name}</Text>
      <Text variant="body" color="slateGray" numberOfLines={1}>{club}</Text>
    </View>
  );
  const rowStyle = { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[12], paddingLeft: theme.spacing[16], paddingRight: theme.spacing[8], paddingVertical: theme.spacing[8], minHeight: 64 } as const;

  return (
    <Screen
      footer={
        <>
          {error && <Text color="danger">{error}</Text>}
          <Button size="large" title={brackets[0] ? 'Redraw bracket' : 'Generate bracket'} disabled={busy || started || registrations.length < 2} onPress={generate} />
        </>
      }
    >
      <View style={{ gap: theme.spacing[8] }}>
        <Text variant="heading">{category?.label}</Text>
        <Text color="slateGray">{registrations.length} athletes</Text>
      </View>
      <Text color="slateGray">Seeded athletes are placed first and byes go to the top seeds. Everyone else is drawn at random, keeping club-mates apart in round 1 where possible.</Text>
      {started && (
        <View style={{ padding: theme.spacing[16], borderRadius: theme.radii.card, backgroundColor: theme.colors.warningTint }}>
          <Text color="warning">Matches have started, so seeds and the draw are locked. Use a withdrawal override on the bracket instead.</Text>
        </View>
      )}

      <ChoiceChips label="Format" options={formatOptions(category?.bracket_format)} value={format} labels={bracketFormatLabels} onChange={setFormat} />

      <SectionDivider />
      <FormSection title={`Seeds · ${seeded.length}`} hint={seeded.length === 0 ? 'No manual seeds. The whole draw is random.' : undefined}>
        {seeded.length > 0 && (
          <ListGroup>
            {seeded.map((rid, index) => {
              const r = byId.get(rid)!;
              return (
                <View key={rid} style={rowStyle}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.cloud, alignItems: 'center', justifyContent: 'center' }}>
                    <Text variant="label">{index + 1}</Text>
                  </View>
                  {person(r.athletes?.full_name ?? '', r.athletes?.club_entries?.club_name ?? '')}
                  {!started && (
                    <View style={{ flexDirection: 'row' }}>
                      <IconAction label={`Move ${r.athletes?.full_name} up`} Icon={ArrowUp} disabled={index === 0} onPress={() => move(index, -1)} />
                      <IconAction label={`Move ${r.athletes?.full_name} down`} Icon={ArrowDown} disabled={index === seeded.length - 1} onPress={() => move(index, 1)} />
                      <IconAction label={`Unseed ${r.athletes?.full_name}`} Icon={X} onPress={() => setSeedIds(seeded.filter((s) => s !== rid))} />
                    </View>
                  )}
                </View>
              );
            })}
          </ListGroup>
        )}
      </FormSection>

      <SectionDivider />
      <FormSection title={`Unseeded · ${unseeded.length}`} hint={unseeded.length === 0 ? 'Everyone is seeded.' : undefined}>
        {unseeded.length > 0 && (
          <ListGroup>
            {unseeded.map((r) => (
              <View key={r.id} style={rowStyle}>
                {person(r.athletes?.full_name ?? '', r.athletes?.club_entries?.club_name ?? '')}
                {!started && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] }}>
                    <Button size="medium" title="Seed" variant="secondary" onPress={() => setSeedIds([...seeded, r.id])} />
                    <IconAction label={`Withdraw ${r.athletes?.full_name}`} Icon={Trash} onPress={() => setWithdrawing({ id: r.id, name: r.athletes?.full_name ?? '' })} />
                  </View>
                )}
              </View>
            ))}
          </ListGroup>
        )}
      </FormSection>
      <BottomSheet visible={!!withdrawing} title={`Withdraw ${withdrawing?.name ?? ''}`} onClose={closeWithdraw}>
        <View style={{ gap: theme.spacing[16] }}>
          <Text color="slateGray">They are taken out of this category, and the submission records why. Say what happened.</Text>
          <TextField label="Reason" value={reason} onChangeText={setReason} autoCapitalize="sentences" placeholder="e.g. Injured in warm-up" />
          {error && <Text color="danger">{error}</Text>}
          <Button size="large" title="Withdraw athlete" variant="danger" disabled={busy || !reason.trim()} onPress={withdraw} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
