import { useRouter } from 'expo-router';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { coverSource } from '@/components/EventCards';
import { theme } from '@/theme/tokens';

export const goBack = (router: ReturnType<typeof useRouter>) => (router.canGoBack() ? router.back() : router.replace('/'));

/** A round back button. On a cover image it is solid white so it reads on any picture; on a plain page it is a light circle. */
export function BackButton({ onCover }: { onCover?: boolean }) {
  const router = useRouter();
  const button = (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={theme.spacing[8]} onPress={() => goBack(router)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <ArrowLeft size={20} color={theme.colors.inkBlack} strokeWidth={2} />
    </Pressable>
  );
  return (
    <View style={[{ width: 40, height: 40, borderRadius: 20, backgroundColor: onCover ? theme.colors.paperWhite : theme.colors.cloud }, onCover && theme.shadows.subtle]}>{button}</View>
  );
}

/** The event's cover image, full width. */
export function EventCover({ image, height }: { image?: string; height: number }) {
  return (
    <View style={{ width: '100%', height, backgroundColor: theme.colors.cloud }}>
      <Image accessibilityLabel="Tournament cover image" source={coverSource(image)} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

const backButtonSize = 40;

/** Where the back button sits, and how tall the strip is that keeps scrolling content from running under it. */
export function useCoverHeader() {
  const insets = useSafeAreaInsets();
  const buttonTop = Math.max(insets.top, theme.spacing[16]) + theme.spacing[8];
  return { buttonTop, height: buttonTop + backButtonSize + theme.spacing[8] };
}

/** The back button over the cover's top-left corner. Its own layer, so it stays tappable above a scroll view that covers the image. */
export function CoverBackButton() {
  const { buttonTop } = useCoverHeader();
  return (
    <View style={{ position: 'absolute', left: theme.spacing[24], top: buttonTop }}>
      <BackButton onCover />
    </View>
  );
}
