import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';

const TRANSPARENT = { backgroundColor: 'transparent' };

/**
 * Sets the header to transparent on mount and keeps it that way.
 * Drop this into any screen whose header should always be transparent.
 */
export function useScrollHeader() {
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      headerStyle:         TRANSPARENT,
      headerShadowVisible: false,
    });
  }, [navigation]);

  return { onScroll: undefined, scrollEventThrottle: 16 };
}
