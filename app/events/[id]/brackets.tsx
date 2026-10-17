import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import Trophy from 'lucide-react-native/icons/trophy';
import { Platform, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChips } from '@/components/ChoiceChips';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useMyRoles } from '@/hooks/useMyRoles';
import { formatName } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

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

  const go = (pathname: '/events/[id]/bracket' | '/events/[id]/bracket-setup' | '/events/[id]/category-groups', categoryId: string) => () => router.push({ pathname, params: { id, categoryId } });

  return (
    <Screen>
      {pending > 0 && (
        <View style={{ padding: theme.spacing[16], borderRadius: theme.radii.card, backgroundColor: theme.colors.warningTint }}>
          <Text color="warning">{pending} {pending === 1 ? 'submission is' : 'submissions are'} not approved. Their athletes are not in any draw.</Text>
        </View>
      )}
      <ChoiceChips label="Status" hideLabel options={filters} value={filter} onChange={setFilter} labels={filterLabels} wrap={Platform.OS !== 'web'} />
      {error && <Text color="danger">{error}</Text>}
      {loading && <SkeletonList />}
      {!loading && categories.length === 0 && (
        <EmptyState
          Icon={Trophy}
          title={visible.length === 0 ? 'No categories yet' : 'Nothing here'}
          text={visible.length === 0 ? 'Brackets are drawn per category. Add categories first.' : 'No brackets match this filter.'}
        />
      )}
      {categories.map((category) => {
        const athletes = category.registrations[0]?.count ?? 0;
        const ready = category.status === 'closed' || drawn.includes(category.status);
        const canManage = isOrganizer && ready && category.status !== 'completed';
        return (
          <Card key={category.id}>
            <View style={{ gap: theme.spacing[16] }}>
              <View style={{ gap: theme.spacing[8] }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing[12] }}>
                  <Text variant="bodyLg" style={{ flex: 1 }}>{category.label}</Text>
                  <StatusPill status={category.status} />
                </View>
                <Text color="slateGray">
                  {athletes} {athletes === 1 ? 'athlete' : 'athletes'} · {formatName(category.bracket_format)}
                </Text>
                {!ready && <Text variant="body" color="slateGray">Close registration to draw this category.</Text>}
              </View>
              {drawn.includes(category.status) && <Button title={category.status === 'completed' ? 'Show results' : 'View bracket'} onPress={go('/events/[id]/bracket', category.id)} />}
              {canManage && (
                <View style={{ flexDirection: 'row', gap: theme.spacing[12] }}>
                  <View style={{ flex: 1 }}><Button title="Split pools" variant="secondary" onPress={go('/events/[id]/category-groups', category.id)} /></View>
                  <View style={{ flex: 1 }}><Button title={drawn.includes(category.status) ? 'Redraw' : 'Seed & draw'} variant="secondary" onPress={go('/events/[id]/bracket-setup', category.id)} /></View>
                </View>
              )}
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
