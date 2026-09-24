import { useRouter } from 'expo-router';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Card } from '@/components/Card';
import { TabScreen } from '@/components/event/TabScreen';
import type { EventData } from '@/components/event/useEventData';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { SkeletonList } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { humanize, isEditable } from '@/lib/events';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

/** The event's categories. Each opens to show who is registered in it and, for the organizer, its settings. */
export function EventCategories({ data }: { data: EventData }) {
  const { event, categories, registrations, isOrganizer, canOverride, loadingCategories, categoriesError } = data;
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const editable = isOrganizer && isEditable(event.status);
  const go = (screen: string) => () => router.push({ pathname: `/events/[id]/${screen}` as '/events/[id]/edit', params: { id: event.id } });
  const participantsOf = (categoryId: string) => registrations.filter((registration) => registration.category_id === categoryId);

  return (
    <TabScreen title="Categories" subtitle={event.name}>
      {categoriesError && <Text color="danger">{categoriesError}</Text>}
      {loadingCategories && <SkeletonList count={3} />}
      {!loadingCategories && categories.length === 0 && !categoriesError && <Text color="slateGray">No categories yet.</Text>}

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

      {editable && (
        <ListGroup title="Manage categories">
          <ListRow title="Add category" onPress={() => router.push({ pathname: '/events/[id]/categories/new', params: { id: event.id } })} />
          <ListRow title="Copy categories from another event" onPress={go('clone')} />
          {event.status === 'draft' && <ListRow title="Import categories from a sheet" onPress={go('import-categories')} />}
          {event.status === 'registration_closed' && <ListRow title="Merge or split categories" onPress={go('restructure')} />}
        </ListGroup>
      )}
    </TabScreen>
  );
}
