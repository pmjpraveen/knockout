import { useLocalSearchParams, useRouter } from 'expo-router';
import House from 'lucide-react-native/icons/house';
import Layers from 'lucide-react-native/icons/layers';
import Settings2 from 'lucide-react-native/icons/settings-2';
import Trophy from 'lucide-react-native/icons/trophy';
import { View } from 'react-native';
import { EventCategories } from '@/components/event/EventCategories';
import { EventConfigure } from '@/components/event/EventConfigure';
import { EventHome } from '@/components/event/EventHome';
import { EventScoreboard } from '@/components/event/EventScoreboard';
import { EventData, useEventData } from '@/components/event/useEventData';
import { GlassTabBar, TabItem } from '@/components/GlassTabBar';
import { SkeletonScreen } from '@/components/Skeleton';
import { theme } from '@/theme/tokens';

type Tab = 'home' | 'categories' | 'scoreboard' | 'configure';

const tabs: TabItem<Tab>[] = [
  { key: 'home', label: 'Home', Icon: House },
  { key: 'categories', label: 'Categories', Icon: Layers },
  { key: 'scoreboard', label: 'Scoreboard', Icon: Trophy },
  { key: 'configure', label: 'Configure', Icon: Settings2 },
];

export default function EventScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const data = useEventData(id);
  if (!data.event) return <SkeletonScreen />;

  // The tab lives in the URL, so it survives coming back from a sub-screen and the browser's back button.
  const event = data as EventData;
  const shown = tabs.filter((item) => (item.key !== 'configure' || data.canOverride) && (item.key !== 'categories' || !data.isScorekeeperOnly));
  const tab = shown.find((item) => item.key === tabParam)?.key ?? 'home';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.paperWhite }}>
      {tab === 'home' && <EventHome data={event} />}
      {tab === 'categories' && <EventCategories data={event} />}
      {tab === 'scoreboard' && <EventScoreboard data={event} />}
      {tab === 'configure' && data.canOverride && <EventConfigure data={event} />}
      <GlassTabBar tabs={shown} active={tab} onChange={(key) => router.setParams({ tab: key })} />
    </View>
  );
}
