import React from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

/**
 * PressableScale — drop-in replacement for TouchableOpacity that
 * springs to `activeScale` on press-in and bounces back on press-out.
 *
 * Props:
 *   style          – visual styles applied to the inner Animated.View
 *   pressableStyle – layout styles applied to the outer Pressable
 *                    (use when you need flex:1, width, margin, etc.)
 *   activeScale    – scale on press (default 0.96)
 *   onPress        – tap handler
 *   disabled       – disables animation + press
 */
export default function PressableScale({
  children,
  style,
  pressableStyle,
  onPress,
  onLongPress,
  disabled,
  activeScale = 0.96,
  ...rest
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const springCfg = { damping: 15, stiffness: 300 };

  return (
    <Pressable
      style={pressableStyle}
      onPressIn={() => {
        if (!disabled) scale.value = withSpring(activeScale, springCfg);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, springCfg);
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
