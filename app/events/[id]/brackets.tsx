import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useMyRoles } from '@/hooks/useMyRoles';
import { humanize } from '@/lib/events';
import { supabase } from '@/lib/supabase';

const drawn = ['bracket_generated', 'in_progress', 'completed'];

export default function Brackets() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isOrganizer, isScorekeeperOnly, memberships } = useMyRoles(id);
  const { rows: allCategories, error, loading } = useFocusQuery(() =>
    supabase.from('categories').select('*, registrations(count)').eq('event_id', id).order('created_at'),
  );
  const { rows: entries } = useFocusQuery(() => supabase.from('club_entries').select('id, approval_status').eq('event_id', id));
  const pending = entries.filter((e) => e.approval_status !== 'approved').length;

  const myTatamis = new Set(memberships.map((m) => m.tatami_id).filter(Boolean));
  const categories = isScorekeeperOnly ? allCategories.filter((c) => myTatamis.has(c.tatami_id)) : allCategories;

  return (
    <Screen>
      {pending > 0 && (
        <Text color="warning">
          {pending} submission(s) are not approved. Their athletes are not in any draw.
        </Text>
      )}
      {error && <Text color="danger">{error}</Text>}
      {loading && <SkeletonList />}
      {categories.map((category) => {
        const athletes = category.registrations[0]?.count ?? 0;
        const ready = category.status === 'closed' || drawn.includes(category.status);
        return (
          <Card key={category.id}>
            <Text variant="bodyLg" weight="medium">{category.label}</Text>
            <StatusPill status={category.status} />
            <Text variant="body" color="slateGray">
              {athletes} athletes · {humanize(category.bracket_format ?? 'no format')}
            </Text>
            {!ready && <Text variant="body" color="slateGray">Close registration to draw this category.</Text>}
            {isOrganizer && ready && category.status !== 'completed' && (
              <Button title="Split into groups" variant="secondary" onPress={() => router.push({ pathname: '/events/[id]/category-groups', params: { id, categoryId: category.id } })} />
            )}
            {isOrganizer && ready && category.status !== 'completed' && (
              <Button
                title={drawn.includes(category.status) ? 'Seed & redraw' : 'Seed & generate'}
                variant="secondary"
                onPress={() => router.push({ pathname: '/events/[id]/bracket-setup', params: { id, categoryId: category.id } })}
              />
            )}
            {drawn.includes(category.status) && (
              <Button
                title="View bracket"
                onPress={() => router.push({ pathname: '/events/[id]/bracket', params: { id, categoryId: category.id } })}
              />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
