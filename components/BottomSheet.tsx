import X from 'lucide-react-native/icons/x';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

type Props = { visible: boolean; title: string; onClose: () => void; children: ReactNode };

/** A sheet that slides up from the bottom of a phone (a centred card on web), over a dimmed backdrop, with a title and a close button. */
export function BottomSheet({ visible, title, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const web = Platform.OS === 'web';
  const reduceMotion = useReduceMotion();
  const { height: windowHeight } = useWindowDimensions();
  const [rendered, setRendered] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(windowHeight);
  const progress = useRef(new Animated.Value(0)).current;

  // The scrim fades while the sheet slides, so they are animated apart (the Modal's own slide would carry the scrim
  // in with the sheet). It stays mounted through the close animation.
  useEffect(() => {
    if (visible) {
      setRendered(true);
      if (reduceMotion) return progress.setValue(1);
      Animated.timing(progress, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (reduceMotion) {
      progress.setValue(0);
      setRendered(false);
    } else {
      Animated.timing(progress, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => finished && setRendered(false));
    }
  }, [visible, reduceMotion, progress]);

  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: web ? 'center' : 'flex-end' }}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
          <Animated.View style={{ flex: 1, backgroundColor: theme.colors.inkBlack, opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }} />
        </Pressable>
        <Animated.View
          onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
          style={{
            alignSelf: 'center',
            width: '100%',
            maxWidth: 420,
            backgroundColor: theme.colors.paperWhite,
            borderRadius: web ? theme.radii.sheetTop : 0,
            borderTopLeftRadius: theme.radii.sheetTop,
            borderTopRightRadius: theme.radii.sheetTop,
            paddingHorizontal: theme.spacing[16],
            paddingTop: theme.spacing[16],
            paddingBottom: (web ? 0 : insets.bottom) + theme.spacing[24],
            gap: theme.spacing[12],
            opacity: web ? progress : 1,
            transform: web ? undefined : [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] }) }],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: theme.spacing[8] }}>
            <Text variant="headingSm" accessibilityRole="header">{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={({ pressed }) => [{ width: theme.touchTarget.minimum, height: theme.touchTarget.minimum, alignItems: 'center', justifyContent: 'center' }, pressFeedback(pressed)]}>
              <X size={22} color={theme.colors.inkBlack} strokeWidth={1.75} />
            </Pressable>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
