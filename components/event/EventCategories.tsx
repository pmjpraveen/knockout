import { useRouter } from 'expo-router';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Copy from 'lucide-react-native/icons/copy';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import FileSpreadsheet from 'lucide-react-native/icons/file-spreadsheet';
import Layers from 'lucide-react-native/icons/layers';
import Plus from 'lucide-react-native/icons/plus';
import Split from 'lucide-react-native/icons/split';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ActionSheet, SheetAction } from '@/components/ActionSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { TabScreen } from '@/components/event/TabScreen';
import type { EventData } from '@/components/event/useEventData';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { SkeletonList } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { humanize, isEditable } from '@/lib/events';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

/** Nothing added yet: what categories are for, and for the organizer the way to add the first one. */
function EmptyCategories({ canAdd, onAdd }: { canAdd: boolean; onAdd: () => void }) {
  return (
    <EmptyState
      Icon={Layers}
      title="No categories yet"
      text={canAdd ? 'Categories group athletes by age, weight and belt. Add the first one so clubs have somewhere to register.' : 'The organizer has not added any categories yet.'}
    >
      {canAdd && <Button size="large" title="Add category" onPress={onAdd} />}
    </EmptyState>
  );
}

/** The event's categories. Each opens to show who is registered in it and, for the organizer, its settings. */
export function EventCategories({ data }: { data: EventData }) {
  const { event, categories, registrations, isOrganizer, canOverride, loadingCategories, categoriesError } = data;
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const editable = isOrganizer && isEditable(event.status);
  const go = (screen: string) => () => router.push({ pathname: `/events/[id]/${screen}` as '/events/[id]/edit', params: { id: event.id } });
  const participantsOf = (categoryId: string) => registrations.filter((registration) => registration.category_id === categoryId);

  const addCategory = () => router.push({ pathname: '/events/[id]/categories/new', params: { id: event.id } });
  const draft = event.status === 'draft';
  const manageActions: SheetAction[] = [
    { title: 'Add category', description: 'Create one category by hand', Icon: Plus, onPress: addCategory },
    { title: 'Copy categories from another event', description: 'Reuse the setup of a past event', Icon: Copy, onPress: go('clone') },
    {
      title: 'Import categories from a sheet',
      description: draft ? 'Add many at once from Excel or CSV' : 'Only available while the event is a draft',
      Icon: FileSpreadsheet,
      onPress: go('import-categories'),
    },
    ...(event.status === 'registration_closed' ? [{ title: 'Merge or split categories', description: 'Combine or divide categories before the draw', Icon: Split, onPress: go('restructure') }] : []),
  ];

  return (
    <TabScreen
      title="Categories"
      subtitle={event.name}
      action={
        editable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage categories"
            onPress={() => setManageOpen(true)}
            style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.cloud, alignItems: 'center', justifyContent: 'center' }, pressFeedback(pressed)]}
          >
            <Ellipsis size={20} color={theme.colors.inkBlack} strokeWidth={1.75} />
          </Pressable>
        ) : undefined
      }
    >
      <ActionSheet visible={manageOpen} title="Manage categories" actions={manageActions} onClose={() => setManageOpen(false)} />
      {categoriesError && <Text color="danger">{categoriesError}</Text>}
      {loadingCategories && <SkeletonList count={3} />}
      {!loadingCategories && categories.length === 0 && !categoriesError && <EmptyCategories canAdd={editable} onAdd={addCategory} />}

      {categories.map((category) => {
        const people = participantsOf(category.id);
        const expanded = open === category.id;
        return (
          <Card key={category.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : category.id)}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[12] }, pressFeedback(pressed)]}
            >
              <View style={{ flex: 1, gap: theme.spacing[8] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[12] }}>
                  <Text variant="bodyLg" style={{ flex: 1 }}>{category.label}</Text>
                  <StatusPill status={category.status} />
                </View>
                <Text variant="body" color="slateGray">
                  {humanize(category.bracket_format ?? '')}{canOverride ? ` · ${people.length} ${people.length === 1 ? 'participant' : 'participants'}` : ''}
                </Text>
              </View>
              <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
                <ChevronDown size={20} color={theme.colors.steelGray} strokeWidth={1.75} />
              </View>
            </Pressable>

            {expanded && (
              <View style={{ gap: theme.spacing[8], paddingTop: theme.spacing[8] }}>
                {isOrganizer ? (
                  people.length === 0 ? (
                    <Text color="slateGray">No participants in this category yet.</Text>
                  ) : (
                    people
                      .map((registration) => registration.athletes)
                      .sort((a, b) => (a?.full_name ?? '').localeCompare(b?.full_name ?? ''))
                      .map((athlete, index) => (
                        <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing[12], paddingVertical: theme.spacing[4] }}>
                          <View style={{ flex: 1 }}>
                            <Text>{athlete?.full_name}</Text>
                            <Text variant="body" color="slateGray">{athlete?.club_entries?.club_name}</Text>
                          </View>
                          <Text variant="body" color="charcoal">{[athlete?.weight ? `${athlete.weight} kg` : null, athlete?.belt_rank].filter(Boolean).join(' · ')}</Text>
                        </View>
                      ))
                  )
                ) : (
                  <Text color="slateGray">Participant names are visible to the organizer.</Text>
                )}
                {editable && (
                  <ListGroup>
                    <ListRow
                      title="Category settings"
                      onPress={() => router.push({ pathname: '/events/[id]/categories/[categoryId]', params: { id: event.id, categoryId: category.id } })}
                    />
                  </ListGroup>
                )}
              </View>
            )}
          </Card>
        );
      })}

    </TabScreen>
  );
}
