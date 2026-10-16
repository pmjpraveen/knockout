import { Children, ReactNode, useState } from 'react';
import { View } from 'react-native';
import { theme } from '@/theme/tokens';

const minCard = 320;
const gap = theme.spacing[16];

/** One column on a phone; cards sit side by side once the screen is wide enough for two of them. Each card's width is worked out from the grid's own width, so cards never squeeze or overlap. */
export function CardGrid({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(0);
  const columns = Math.max(1, Math.floor((width + gap) / (minCard + gap)));
  const cardWidth = width > 0 ? (width - gap * (columns - 1)) / columns : undefined;

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={{ width: cardWidth ?? '100%' }}>{child}</View>
      ))}
    </View>
  );
}
