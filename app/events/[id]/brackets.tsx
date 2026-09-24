import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';
import { ActionRow } from '@/components/ActionRow';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChips } from '@/components/ChoiceChips';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useMyRoles } from '@/hooks/useMyRoles';
import { humanize } from '@/lib/events';
import { supabase } from '@/lib/supabase';

const drawn = ['bracket_generated', 'in_progress', 'completed'];
const filters = ['all', 'in_progress', 'completed'] as const;
const filterLabels = { all: 'All brackets', in_progress: 'In progress', completed: 'Completed' };

export default function Brackets() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isOrganizer, isScorekeeperOnly, memberships } = useMyRoles(id);
  const [filter, setFilter] = useState<(typeof filters)[number]>('all');
  const { rows: allCategories, error, loading } = useFocusQuery(() =>
    supabase.from('categories').select('*, registrations(count)').eq('event_id', id).order('created_at'),
  );
  const { rows: entries } = useFocusQuery(() => supabase.from('club_entries').select('id, approval_status').eq('event_id', id));
  const pending = entries.filter((e) => e.approval_status !== 'approved').length;

  const myTatamis = new Set(memberships.map((m) => m.tatami_id).filter(Boolean));
  const visible = isScorekeeperOnly ? allCategories.filter((c) => myTatamis.has(c.tatami_id)) : allCategories;
  const categories = filter === 'all' ? visible : visible.filter((c) => c.status === filter);

  return (
    <Screen>
      {pending > 0 && (
        <Text color="warning">
          {pending} submission(s) are not approved. Their athletes are not in any draw.
        </Text>
      )}
      <ChoiceChips label="Status" options={filters} value={filter} onChange={setFilter} labels={filterLabels} wrap={Platform.OS !== 'web'} />
      {error && <Text color="danger">{error}</Text>}
      {loading && <SkeletonList />}
      {categories.map((category) => {
        const athletes = category.registrations[0]?.count ?? 0;
        const ready = category.status === 'closed' || drawn.includes(category.status);
        return (
          <Card key={category.id}>
            <Text variant="bodyLg">{category.label}</Text>
            <StatusPill status={category.status} />
            <Text variant="body" color="slateGray">
              {athletes} athletes · {humanize(category.bracket_format ?? 'no format')}
            </Text>
            {!ready && <Text variant="body" color="slateGray">Close registration to draw this category.</Text>}
            <ActionRow>
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
            </ActionRow>
          </Card>
        );
      })}
    </Screen>
  );
}
