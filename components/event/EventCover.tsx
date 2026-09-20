import { useRouter } from 'expo-router';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { coverSource } from '@/components/EventCards';
import { Glass } from '@/components/Glass';
import { theme } from '@/theme/tokens';

export const goBack = (router: ReturnType<typeof useRouter>) => (router.canGoBack() ? router.back() : router.replace('/'));

/** A round back button. On a cover image it is a small piece of glass; on a plain page it is a light circle. */
export function BackButton({ onCover }: { onCover?: boolean }) {
  const router = useRouter();
  const button = (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={theme.spacing[8]} onPress={() => goBack(router)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <ArrowLeft size={20} color={theme.colors.inkBlack} strokeWidth={2} />
    </Pressable>
  );
  return onCover ? (
    <Glass radius={20} style={{ width: 40, height: 40 }}>{button}</Glass>
  ) : (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.cloud }}>{button}</View>
  );
}

/** The event's cover image, full width, with the back button over its top-left corner. */
export function EventCover({ image, height }: { image?: string; height: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ width: '100%', height, backgroundColor: theme.colors.cloud }}>
      <Image accessibilityLabel="Tournament cover image" source={coverSource(image)} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      <View style={{ position: 'absolute', left: theme.spacing[24], top: Math.max(insets.top, theme.spacing[16]) + theme.spacing[8] }}>
        <BackButton onCover />
      </View>
    </View>
  );
}
