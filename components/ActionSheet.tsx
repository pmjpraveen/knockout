import type { LucideIcon } from 'lucide-react-native';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { Pressable, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Text } from '@/components/Text';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

export type SheetAction = { title: string; description: string; Icon: LucideIcon; onPress: () => void };

const iconCircle = theme.touchTarget.minimum;

/** A bottom sheet of actions, each with a round icon, a title, a line of explanation and a chevron; choosing one closes the sheet and runs it. */
export function ActionSheet({ visible, title, actions, onClose }: { visible: boolean; title: string; actions: SheetAction[]; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <View style={{ gap: theme.spacing[8] }}>
        {actions.map(({ title: action, description, Icon, onPress }) => (
          <Pressable
            key={action}
            accessibilityRole="button"
            accessibilityLabel={`${action}. ${description}`}
            onPress={() => { onClose(); onPress(); }}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[16], paddingHorizontal: theme.spacing[8], paddingVertical: theme.spacing[12] }, pressFeedback(pressed)]}
          >
            <View style={{ width: iconCircle, height: iconCircle, borderRadius: iconCircle / 2, backgroundColor: theme.colors.cloud, alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={22} color={theme.colors.inkBlack} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1, gap: theme.spacing[4] }}>
              <Text variant="bodyLg">{action}</Text>
              <Text color="slateGray">{description}</Text>
            </View>
            <ChevronRight size={20} color={theme.colors.charcoal} strokeWidth={1.75} />
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
