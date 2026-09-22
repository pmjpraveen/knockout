import Download from 'lucide-react-native/icons/download';
import Upload from 'lucide-react-native/icons/upload';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { useSubmit } from '@/hooks/useSubmit';
import { AthleteDraft, toCompete } from '@/lib/athlete';
import { parseAthleteRows } from '@/lib/athleteImport';
import type { Problem } from '@/lib/categoryImport';
import { pickSheet } from '@/lib/pickSheet';
import { saveFile } from '@/lib/saveFile';
import { readSheet, sheetErrorMessage } from '@/lib/sheetRows';
import { buildTemplate, TemplateFormat } from '@/lib/sheetTemplate';
import { theme } from '@/theme/tokens';

type Outcome = { file: string; added: number; duplicates: number; overflow: number; problems: Problem[] };

const same = (a: { full_name: string; date_of_birth: string }, b: { full_name: string; date_of_birth: string }) =>
  a.full_name.trim().toLowerCase() === b.full_name.trim().toLowerCase() && a.date_of_birth === b.date_of_birth;

/**
 * A club's shortcut to adding participants one by one: download a sample sheet, fill it in, upload it. The rows
 * land in the form below for the club to check before it submits, so nothing is sent until then.
 */
export function RosterUpload({ existing, max, belts, onAdd }: { existing: AthleteDraft[]; max: number; belts: readonly string[]; onAdd: (added: AthleteDraft[]) => void }) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const { run, busy, error } = useSubmit();

  const download = (format: TemplateFormat) =>
    run(async () => {
      try {
        const template = await buildTemplate('roster', format, belts);
        await saveFile(template.name, template.bytes, template.mime);
        return { error: null };
      } catch {
        return { error: { message: 'The sample sheet could not be saved. Try again.' } };
      }
    });

  const upload = () =>
    run(async () => {
      try {
        const picked = await pickSheet();
        if (!picked) return { error: null };
        const parsed = parseAthleteRows(await readSheet(picked.bytes), belts, false);
        const seen = [...existing];
        const fresh: AthleteDraft[] = [];
        let duplicates = 0;
        for (const item of parsed.items) {
          const athlete: AthleteDraft = { full_name: item.full_name, date_of_birth: item.date_of_birth, gender: item.gender as AthleteDraft['gender'], weight: String(item.weight), belt_rank: item.belt_rank, compete: toCompete(item.disciplines) };
          if (seen.some((known) => same(known, athlete))) duplicates += 1;
          else {
            seen.push(athlete);
            fresh.push(athlete);
          }
        }
        const room = Math.max(0, max - existing.length);
        const accepted = fresh.slice(0, room);
        onAdd(accepted);
        setOutcome({ file: picked.name, added: accepted.length, duplicates, overflow: fresh.length - accepted.length, problems: parsed.problems });
        return { error: null };
      } catch (e) {
        return { error: { message: sheetErrorMessage(e) } };
      }
    });

  return (
    <Card>
      <View style={{ gap: theme.spacing[12] }}>
        <Text variant="subheading" weight="medium">Upload your participants list</Text>
        <Text color="slateGray">Skip typing each athlete. Download the sample sheet, fill in one row per participant, then upload it. You can check and change everyone below before you submit.</Text>
        <View style={{ gap: theme.spacing[8] }}>
          <Button title="Download sample sheet (.xlsx)" variant="secondary" icon={<Download size={18} color={theme.colors.inkBlack} strokeWidth={1.75} />} disabled={busy} onPress={() => download('xlsx')} />
          <Button title="Download sample sheet (.csv)" variant="secondary" icon={<Download size={18} color={theme.colors.inkBlack} strokeWidth={1.75} />} disabled={busy} onPress={() => download('csv')} />
          <Button title="Upload your list (.xlsx or .csv)" icon={<Upload size={18} color={theme.colors.paperWhite} strokeWidth={1.75} />} disabled={busy} onPress={upload} />
        </View>
        {error && <Text color="danger">{error}</Text>}
        {outcome && (
          <View style={{ gap: theme.spacing[4] }}>
            <Text weight="medium" color={outcome.added > 0 ? 'success' : 'warning'}>
              {outcome.added > 0 ? `${outcome.added} ${outcome.added === 1 ? 'participant' : 'participants'} added below from ${outcome.file}.` : `No participants were added from ${outcome.file}.`}
            </Text>
            {outcome.duplicates > 0 && <Text variant="body" color="slateGray">{outcome.duplicates} already in your list, so skipped.</Text>}
            {outcome.overflow > 0 && <Text variant="body" color="warning">A registration holds up to {max} participants, so {outcome.overflow} were left out. Submit this one, then register the rest separately.</Text>}
            {outcome.problems.slice(0, 10).map((problem) => (
              <Text key={problem.line} variant="body" color="warning">Line {problem.line}: {problem.message}</Text>
            ))}
            {outcome.problems.length > 10 && <Text variant="body" color="slateGray">and {outcome.problems.length - 10} more rows need fixing.</Text>}
            {outcome.problems.length > 0 && <Text variant="body" color="slateGray">Rows with problems were skipped. Fix them in your sheet and upload it again; anyone already added is left out the second time.</Text>}
          </View>
        )}
      </View>
    </Card>
  );
}
