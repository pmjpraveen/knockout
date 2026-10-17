import { useLocalSearchParams } from 'expo-router';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import FileDown from 'lucide-react-native/icons/file-down';
import Trophy from 'lucide-react-native/icons/trophy';
import { useState } from 'react';
import { View } from 'react-native';
import { BracketMatch, BracketTree } from '@/components/BracketTree';
import { Button } from '@/components/Button';
import { Podium } from '@/components/Podium';
import { ChoiceChips } from '@/components/ChoiceChips';
import { EmptyState } from '@/components/EmptyState';
import { FormSection } from '@/components/FormSection';
import { ListGroup } from '@/components/ListGroup';
import { Screen } from '@/components/Screen';
import { SkeletonScreen } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useCategoryPodium } from '@/hooks/useCategoryPodium';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useMyRoles } from '@/hooks/useMyRoles';
import { useSubmit } from '@/hooks/useSubmit';
import { buildBracketReportHtml } from '@/lib/bracketReport';
import { formatName, hasGroupStage } from '@/lib/events';
import { exportPdf, openExportWindow } from '@/lib/exportPdf';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

const noBracket = '00000000-0000-0000-0000-000000000000';

export default function Bracket() {
  const { id, categoryId } = useLocalSearchParams<{ id: string; categoryId: string }>();
  const { canOverride } = useMyRoles(id);
  const [withdrawn, setWithdrawn] = useState('');
  const [note, setNote] = useState('');
  const [showTree, setShowTree] = useState(false);
  const { run, busy, error } = useSubmit();
  const { run: runExport, busy: exporting, error: exportError } = useSubmit();

  const { rows: categories } = useFocusQuery(() => supabase.from('categories').select('label, events(name)').eq('id', categoryId));
  const { rows: brackets, loading: loadingBracket } = useFocusQuery(() => supabase.from('brackets').select('*').eq('category_id', categoryId), [], `bracket:${categoryId}`);
  const bracket = brackets[0];
  const { rows: matches, stale, reload } = useFocusQuery(
    () => supabase.rpc('bracket_matches', { p_bracket_id: bracket?.id ?? noBracket }),
    [bracket?.id],
    `matches:${bracket?.id}`,
  );
  const { rows: standings } = useFocusQuery(() => supabase.rpc('pool_standings', { p_bracket_id: bracket?.id ?? noBracket }), [bracket?.id]);
  const podium = useCategoryPodium(categoryId);

  const names = new Map<string, string>();
  matches.forEach((m) => {
    if (m.athlete_a_id && m.athlete_a) names.set(m.athlete_a_id, m.athlete_a);
    if (m.athlete_b_id && m.athlete_b) names.set(m.athlete_b_id, m.athlete_b);
  });
  const started = matches.some((m) => m.status === 'in_progress' || m.status === 'completed');

  const withdraw = async () => {
    if (await run(() => supabase.rpc('withdraw_athlete', { p_bracket_id: bracket!.id, p_athlete_id: withdrawn, p_note: note }))) {
      setNote('');
      setWithdrawn('');
      reload();
    }
  };

  const category = categories[0];
  const exportAsPdf = () => {
    const target = openExportWindow(); // opened synchronously here, in the click itself, so browsers don't treat it as a pop-up
    return runExport(async () => {
      const { data: participants, error: participantsError } = await supabase.rpc('category_participants', { p_category_id: categoryId });
      if (participantsError) return { error: participantsError };
      const html = buildBracketReportHtml({
        eventName: category?.events?.name ?? '',
        categoryLabel: category?.label ?? '',
        bracketFormat: formatName(bracket!.format),
        participants: participants ?? [],
        matches,
        podium,
      });
      try {
        await exportPdf(`${category?.label ?? 'Bracket'}.pdf`, html, target);
        return { error: null };
      } catch (e) {
        return { error: { message: (e as Error).message } };
      }
    });
  };

  if (!bracket) {
    return loadingBracket ? <SkeletonScreen /> : (
      <Screen>
        <EmptyState Icon={Trophy} title="No bracket yet" text="Draw this category from the Brackets page once registration has closed." />
      </Screen>
    );
  }

  const played = matches.filter((m) => m.status === 'completed').length;
  const playable = matches.filter((m) => m.status !== 'bye').length;
  const pools = [...new Set(standings.map((s) => s.pool))].sort();
  const done = bracket.status === 'completed';
  const tile = (value: string, label: string) => (
    <View style={{ flex: 1, gap: theme.spacing[4], padding: theme.spacing[12], borderRadius: theme.radii.card, backgroundColor: theme.colors.cloud }}>
      <Text variant="subheading" numberOfLines={1}>{value}</Text>
      <Text variant="body" color="slateGray">{label}</Text>
    </View>
  );

  return (
    <Screen wide>
      <View style={{ gap: theme.spacing[8] }}>
        <Text variant="heading">{category?.label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8] }}>
          {done && <StatusPill status="completed" />}
          <Text color="slateGray" style={{ flexShrink: 1 }}>{formatName(bracket.format)}{done ? '' : ` · ${played} of ${playable} matches played`}</Text>
        </View>
      </View>
      {stale && <Text color="warning">Offline: showing the bracket as last synced.</Text>}

      {done && (
        <View style={{ flexDirection: 'row', gap: theme.spacing[12] }}>
          {tile(String(names.size), 'Athletes')}
          {tile(String(played), 'Matches played')}
        </View>
      )}

      <Podium categoryId={categoryId} />

      <Button title="Export as PDF" variant="secondary" icon={<FileDown size={18} color={theme.colors.inkBlack} strokeWidth={1.75} />} disabled={exporting} onPress={exportAsPdf} />
      {exportError && <Text color="danger">{exportError}</Text>}

      {done && (
        <Button
          title={showTree ? 'Hide full bracket' : 'Show full bracket'}
          variant="secondary"
          icon={showTree ? <ChevronUp size={18} color={theme.colors.inkBlack} strokeWidth={1.75} /> : <ChevronDown size={18} color={theme.colors.inkBlack} strokeWidth={1.75} />}
          onPress={() => setShowTree((open) => !open)}
        />
      )}
      {(!done || showTree) && <BracketTree matches={matches as BracketMatch[]} hideByes={done} />}

      {hasGroupStage(bracket.format) && pools.length > 0 && (
        <FormSection title="Standings">
          {pools.map((pool) => (
            <ListGroup key={pool} title={`Pool ${pool}`}>
              {standings.filter((s) => s.pool === pool).map((s) => (
                <View key={s.athlete_id} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[12], paddingHorizontal: theme.spacing[16], paddingVertical: theme.spacing[12] }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.cloud, alignItems: 'center', justifyContent: 'center' }}>
                    <Text variant="label">{s.rank}</Text>
                  </View>
                  <Text style={{ flex: 1 }} numberOfLines={1}>{names.get(s.athlete_id)}</Text>
                  <Text variant="body" color="slateGray">{s.wins}W · {s.losses}L</Text>
                </View>
              ))}
            </ListGroup>
          ))}
        </FormSection>
      )}

      {canOverride && started && !done && (
        <FormSection title="Withdrawal override" hint="Unplayed matches for the athlete become walkovers. The note is logged.">
          <ChoiceChips label="Athlete" options={[...names.keys()]} value={withdrawn} onChange={setWithdrawn} labels={Object.fromEntries(names)} />
          <TextField label="Note" value={note} onChangeText={setNote} autoCapitalize="sentences" placeholder="e.g. Injured in warm-up" />
          {error && <Text color="danger">{error}</Text>}
          <Button title="Record withdrawal" variant="danger" confirmTitle="Tap again to confirm" disabled={busy || !withdrawn || !note.trim()} onPress={withdraw} />
        </FormSection>
      )}
    </Screen>
  );
}
