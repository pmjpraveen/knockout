import Download from 'lucide-react-native/icons/download';
import Upload from 'lucide-react-native/icons/upload';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { useSubmit } from '@/hooks/useSubmit';
import type { Parsed } from '@/lib/categoryImport';
import { pickSheet } from '@/lib/pickSheet';
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

  return (
    <>
      <Text color="slateGray">{intro}</Text>
      <View style={{ gap: theme.spacing[8] }}>
        <Button title="Download sample sheet (.xlsx)" variant="secondary" icon={<Download size={18} color={theme.colors.inkBlack} strokeWidth={1.75} />} disabled={busy} onPress={() => download('xlsx')} />
        <Button title="Download sample sheet (.csv)" variant="secondary" icon={<Download size={18} color={theme.colors.inkBlack} strokeWidth={1.75} />} disabled={busy} onPress={() => download('csv')} />
      </View>
      <Button
        title={file ? 'Choose a different file' : 'Choose a file (.xlsx or .csv)'}
        variant={file ? 'secondary' : 'primary'}
        icon={<Upload size={18} color={file ? theme.colors.inkBlack : theme.colors.paperWhite} strokeWidth={1.75} />}
        disabled={busy || !!summary}
        onPress={choose}
      />
      {error && <Text color="danger">{error}</Text>}

      {file && !summary && (
        <>
          <Text weight="medium">{file.name}</Text>
          {count === 0 && problems.length === 0 ? (
            <Text color="warning">The sheet has no rows below the header row.</Text>
          ) : (
            <Text>
              {label(count)} ready to import{problems.length > 0 ? ` · ${problems.length} ${problems.length === 1 ? 'row needs' : 'rows need'} fixing` : ''}
            </Text>
          )}
          {problems.length > 0 && (
            <Card>
              {problems.slice(0, 10).map((problem) => (
                <Text key={problem.line} variant="body" color="warning">Line {problem.line}: {problem.message}</Text>
              ))}
              {problems.length > 10 && <Text variant="body" color="slateGray">and {problems.length - 10} more</Text>}
              {count > 0 && <Text variant="body" color="slateGray">These rows are skipped. Fix them in the sheet and upload it again; anything already imported is left out the second time.</Text>}
            </Card>
          )}
          {count > 0 && (
            <Card>
              {file.parsed.items.slice(0, listed).map((item, index) => <Text key={index} variant="body">{describe(item)}</Text>)}
              {count > listed && <Text variant="body" color="slateGray">and {count - listed} more</Text>}
            </Card>
          )}
          <Button title={`Import ${label(count)}`} disabled={busy || count === 0} onPress={upload} />
        </>
      )}

      {summary && (
        <>
          <Text color="success">{summary}</Text>
          <Button title="Done" onPress={onDone} />
        </>
      )}
    </>
  );
}
