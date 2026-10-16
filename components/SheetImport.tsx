import CircleCheck from 'lucide-react-native/icons/circle-check';
import Download from 'lucide-react-native/icons/download';
import FileSpreadsheet from 'lucide-react-native/icons/file-spreadsheet';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Upload from 'lucide-react-native/icons/upload';
import { ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useSubmit } from '@/hooks/useSubmit';
import type { Parsed } from '@/lib/categoryImport';
import { pickSheet } from '@/lib/pickSheet';
import { pressFeedback } from '@/lib/press';
import { saveFile } from '@/lib/saveFile';
import { buildTemplate, TemplateFormat, TemplateKind } from '@/lib/sheetTemplate';
import { readSheet, SheetRow, sheetErrorMessage } from '@/lib/sheetRows';
import { theme } from '@/theme/tokens';

const listed = 8;

type Props<T> = {
  kind: TemplateKind;
  /** The event's belts, for the sample sheet. */
  belts: readonly string[];
  intro: string;
  /** What one row is called, singular and plural, e.g. ['category', 'categories']. */
  noun: [string, string];
  parse: (rows: SheetRow[]) => Parsed<T>;
  describe: (item: T) => string;
  /** Sends the rows to the database and says what happened. */
  send: (items: T[]) => PromiseLike<{ error: { message: string } | null; summary?: string }>;
  onDone: () => void;
};

const card = { backgroundColor: theme.colors.paperWhite, borderWidth: 1, borderColor: theme.colors.mist, borderRadius: theme.radii.card, overflow: 'hidden' } as const;
const circle = theme.touchTarget.minimum;

function IconCircle({ children, tint = theme.colors.cloud }: { children: ReactNode; tint?: string }) {
  return <View style={{ width: circle, height: circle, borderRadius: circle / 2, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

function Tag({ tone, Icon, text }: { tone: 'success' | 'warning'; Icon: typeof CircleCheck; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8], paddingHorizontal: theme.spacing[12], paddingVertical: theme.spacing[8], borderRadius: theme.radii.button, backgroundColor: theme.colors[`${tone}Tint`] }}>
      <Icon size={18} color={theme.colors[tone]} strokeWidth={1.75} />
      <Text color={tone}>{text}</Text>
    </View>
  );
}

/** Download a sample sheet, choose a filled-in .xlsx or .csv, check what will be imported, then import it. */
export function SheetImport<T>({ kind, belts, intro, noun, parse, describe, send, onDone }: Props<T>) {
  const [file, setFile] = useState<{ name: string; parsed: Parsed<T> } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const { run, busy, error } = useSubmit();

  const download = (format: TemplateFormat) =>
    run(async () => {
      try {
        const template = await buildTemplate(kind, format, belts);
        await saveFile(template.name, template.bytes, template.mime);
        return { error: null };
      } catch {
        return { error: { message: 'The sample sheet could not be saved. Try again.' } };
      }
    });

  const choose = () =>
    run(async () => {
      try {
        const picked = await pickSheet();
        if (picked) {
          setFile({ name: picked.name, parsed: parse(await readSheet(picked.bytes)) });
          setSummary(null);
        }
        return { error: null };
      } catch (e) {
        return { error: { message: sheetErrorMessage(e) } };
      }
    });

  const upload = () =>
    run(async () => {
      const result = await send(file!.parsed.items);
      if (!result.error) setSummary(result.summary ?? 'Imported.');
      return result;
    });

  const count = file?.parsed.items.length ?? 0;
  const problems = file?.parsed.problems ?? [];
  const label = (n: number) => `${n} ${n === 1 ? noun[0] : noun[1]}`;

  const footer = summary ? (
    <Button size="large" title="Done" onPress={onDone} />
  ) : file ? (
    <>
      {error && <Text color="danger">{error}</Text>}
      <Button size="large" title={`Import ${label(count)}`} disabled={busy || count === 0} onPress={upload} />
    </>
  ) : undefined;

  return (
    <Screen footer={footer}>
      {summary ? (
        <View style={{ alignItems: 'center', gap: theme.spacing[16], paddingVertical: theme.spacing[48] }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.successTint, alignItems: 'center', justifyContent: 'center' }}>
            <CircleCheck size={32} color={theme.colors.success} strokeWidth={1.5} />
          </View>
          <View style={{ alignItems: 'center', gap: theme.spacing[4] }}>
            <Text variant="subheading">Import complete</Text>
            <Text color="slateGray" style={{ textAlign: 'center' }}>{summary}</Text>
          </View>
        </View>
      ) : (
        <View style={{ gap: theme.spacing[24] }}>
          <Text color="slateGray">{intro}</Text>

          <View style={card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[16], padding: theme.spacing[16] }}>
                <IconCircle><FileSpreadsheet size={22} color={theme.colors.inkBlack} strokeWidth={1.75} /></IconCircle>
                <View style={{ flex: 1, gap: theme.spacing[4] }}>
                  <Text variant="bodyLg">Sample sheet</Text>
                  <Text color="slateGray">The right columns and two example rows. The Excel file also explains each column.</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: theme.spacing[12], padding: theme.spacing[16], backgroundColor: theme.colors.cloud }}>
                <View style={{ flex: 1 }}>
                  <Button size="medium" variant="secondary" title="Excel" icon={<Download size={18} color={theme.colors.inkBlack} strokeWidth={1.75} />} disabled={busy} onPress={() => download('xlsx')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button size="medium" variant="secondary" title="CSV" icon={<Download size={18} color={theme.colors.inkBlack} strokeWidth={1.75} />} disabled={busy} onPress={() => download('csv')} />
                </View>
              </View>
          </View>

          <View style={{ gap: theme.spacing[12] }}>
            {file ? (
              <View style={[card, { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[16], padding: theme.spacing[16] }]}>
                <IconCircle tint={theme.colors.successTint}><FileSpreadsheet size={22} color={theme.colors.success} strokeWidth={1.75} /></IconCircle>
                <View style={{ flex: 1, gap: theme.spacing[4] }}>
                  <Text variant="bodyLg" numberOfLines={2}>{file.name}</Text>
                  <Text color="slateGray">{count + problems.length} {count + problems.length === 1 ? 'row' : 'rows'} read</Text>
                </View>
                <Button size="medium" variant="secondary" title="Change" disabled={busy} onPress={choose} />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose a file, Excel or CSV"
                disabled={busy}
                onPress={choose}
                style={({ pressed }) => [{ alignItems: 'center', gap: theme.spacing[12], paddingVertical: theme.spacing[32], paddingHorizontal: theme.spacing[16], borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.steelGray, borderRadius: theme.radii.card, backgroundColor: theme.colors.cloud, opacity: busy ? 0.6 : 1 }, pressFeedback(pressed)]}
              >
                <IconCircle tint={theme.colors.paperWhite}><Upload size={22} color={theme.colors.inkBlack} strokeWidth={1.75} /></IconCircle>
                <View style={{ alignItems: 'center', gap: theme.spacing[4] }}>
                  <Text variant="bodyLg">Choose a file</Text>
                  <Text color="slateGray">Excel (.xlsx) or CSV</Text>
                </View>
              </Pressable>
            )}
            {!file && error && <Text color="danger">{error}</Text>}
          </View>

          {file && (
            <View style={{ gap: theme.spacing[12] }}>
              {count === 0 && problems.length === 0 ? (
                <View style={{ padding: theme.spacing[16], borderRadius: theme.radii.card, backgroundColor: theme.colors.warningTint }}>
                  <Text color="warning">The sheet has no rows below the header row.</Text>
                </View>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] }}>
                    <Tag tone="success" Icon={CircleCheck} text={`${count} ready to import`} />
                    {problems.length > 0 && <Tag tone="warning" Icon={TriangleAlert} text={`${problems.length} ${problems.length === 1 ? 'row needs' : 'rows need'} fixing`} />}
                  </View>

                  {problems.length > 0 && (
                    <View style={{ gap: theme.spacing[12], padding: theme.spacing[16], borderRadius: theme.radii.card, backgroundColor: theme.colors.warningTint }}>
                      <Text variant="bodyLg" color="warning">Rows that need fixing</Text>
                      {problems.slice(0, 10).map((problem) => (
                        <View key={problem.line} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[12] }}>
                          <View style={{ paddingHorizontal: theme.spacing[8], paddingVertical: theme.spacing[4], borderRadius: theme.radii.chip, backgroundColor: theme.colors.paperWhite }}>
                            <Text variant="label" color="warning">Row {problem.line}</Text>
                          </View>
                          <Text style={{ flex: 1 }}>{problem.message}</Text>
                        </View>
                      ))}
                      {problems.length > 10 && <Text color="slateGray">and {problems.length - 10} more</Text>}
                      {count > 0 && <Text variant="body" color="slateGray">These rows are skipped. Fix them in the sheet and upload it again; anything already imported is left out the second time.</Text>}
                    </View>
                  )}

                  {count > 0 && (
                    <View style={card}>
                      <Text variant="bodyLg" style={{ padding: theme.spacing[16], paddingBottom: theme.spacing[12] }}>Ready to import</Text>
                      {file.parsed.items.slice(0, listed).map((item, index) => (
                        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[12], paddingHorizontal: theme.spacing[16], paddingVertical: theme.spacing[12], borderTopWidth: 1, borderTopColor: theme.colors.mist }}>
                          <CircleCheck size={18} color={theme.colors.success} strokeWidth={1.75} />
                          <Text style={{ flex: 1 }}>{describe(item)}</Text>
                        </View>
                      ))}
                      {count > listed && (
                        <View style={{ paddingHorizontal: theme.spacing[16], paddingVertical: theme.spacing[12], borderTopWidth: 1, borderTopColor: theme.colors.mist, backgroundColor: theme.colors.cloud }}>
                          <Text color="slateGray">and {count - listed} more</Text>
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}
