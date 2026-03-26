import React, { useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Easing, Vibration, Platform, TouchableOpacity, PanResponder } from 'react-native';
import { deviceCapabilities } from '../utils/DeviceOptimization';
import { useTheme } from '../contexts/ThemeContext';

interface WheelSlice {
  id: string;
  text: string;
  color: string;
  emoji?: string;
}

interface PieWheelProps {
   slices: WheelSlice[];
   size?: number;
   showLabels?: boolean;
   themeName?: string; // Add theme name prop for dynamic theming
}

const PieWheel: React.FC<PieWheelProps> = ({
  slices,
  size,
  showLabels = true,
  themeName,
}) => {
  const { theme } = useTheme();

  // Animation refs
  const spinAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const isSpinning = useRef(false);

  // Get screen dimensions for responsiveness
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Make wheel responsive - use smaller of screen dimensions with padding
  const responsiveSize = size || Math.min(screenWidth, screenHeight) * 0.75;
  
  // Updated colors to match web version - SWU Red & White theme with vibrant colors
  const wheelColors = useMemo(() => [
    '#A00000', '#FFFFFF', '#FF6B6B', '#4ECDC4',
    '#45B7D1', '#F7B731', '#A23B72', '#0077B6',
    '#0096C7', '#00B4D8', '#48CAE4', '#90E0EF'
  ], []);

  const getSliceColor = useCallback((index: number, slice: WheelSlice) => {
    // Use slice color if provided, otherwise use web version color scheme
    return slice.color || wheelColors[index % wheelColors.length];
  }, [wheelColors]);

  // Smooth spin animation function
  const spinWheel = useCallback(() => {
    if (isSpinning.current || slices.length === 0) return;

    isSpinning.current = true;

    // Haptic feedback
    if (Platform.OS === 'ios') {
      // iOS haptic feedback
    } else if (Platform.OS === 'android') {
      Vibration.vibrate([0, 50, 50, 50]); // Pattern vibration for better feedback
    }

    // Device-optimized scale animation for press effect
    const pressDuration = deviceCapabilities.isHighRefreshRate ? 80 : 100;
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.95,
        duration: pressDuration,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: pressDuration,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();

    // Calculate random spin with realistic physics
    const randomSpins = 5 + Math.random() * 10; // 5-15 full rotations
    const randomExtraRotation = Math.random() * 360; // Random final position
    const totalRotation = randomSpins * 360 + randomExtraRotation;

    // Device-optimized spin animation
    const spinDuration = deviceCapabilities.isHighRefreshRate ? 2500 : 3000;
    Animated.timing(spinAnimation, {
      toValue: totalRotation,
      duration: spinDuration,
      useNativeDriver: true,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Optimized easing for all devices
    }).start(() => {
      isSpinning.current = false;
      // Optional: callback for when spin completes
    });
  }, [slices.length, scaleAnimation, spinAnimation]);

  // Pan responder for gesture-based interactions
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isSpinning.current,
      onMoveShouldSetPanResponder: () => !isSpinning.current,
      onPanResponderGrant: () => {
        // Provide immediate haptic feedback
        if (Platform.OS === 'android') {
          Vibration.vibrate(30);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Trigger spin if gesture is quick or if user taps
        if (Math.abs(gestureState.vx) > 0.5 || Math.abs(gestureState.vy) > 0.5) {
          spinWheel();
        }
      },
    })
  );

  if (slices.length === 0) {
    return (
      <View style={[styles.emptyWheel, { width: responsiveSize, height: responsiveSize, borderRadius: responsiveSize / 2 }]}>
        <Text style={styles.emptyText}>No slices</Text>
      </View>
    );
  }

  const radius = responsiveSize / 2;
  const centerRadius = responsiveSize * 0.15;
  const numSegments = slices.length;

  // Memoize wheel dimensions to prevent unnecessary recalculations
  const wheelDimensions = useMemo(() => ({
    radius,
    centerRadius,
    numSegments,
    responsiveSize
  }), [radius, centerRadius, numSegments, responsiveSize]);

  // Memoize segment data to prevent expensive calculations on every render
  const segmentData = useMemo(() => {
    return slices.map((slice, index) => {
      const anglePerSegment = 360 / numSegments;
      const startAngle = index * anglePerSegment;
      const midAngle = startAngle + anglePerSegment / 2;
      const textRadius = radius * 0.6;
      const textAngle = (midAngle - 90) * Math.PI / 180;
      const textX = radius + Math.cos(textAngle) * textRadius;
      const textY = radius + Math.sin(textAngle) * textRadius;

      return {
        slice,
        index,
        startAngle,
        midAngle,
        textX,
        textY,
        anglePerSegment
      };
    });
  }, [slices, numSegments, radius]);

  const animatedStyle = {
    transform: [
      { rotate: spinAnimation.interpolate({
        inputRange: [0, 360],
        outputRange: ['0deg', '360deg']
      })},
      { scale: scaleAnimation }
    ]
  };

  return (
   <View style={[styles.wheelContainer, { width: responsiveSize, height: responsiveSize }]}>
     <Animated.View
       style={[
         styles.wheel,
         {
           width: responsiveSize,
           height: responsiveSize,
           borderRadius: responsiveSize / 2,
           backgroundColor: theme.surface,
           borderWidth: 4,
           borderColor: theme.border,
           overflow: 'hidden',
           shadowColor: theme.primary,
           shadowOffset: {
             width: 0,
             height: 6,
           },
           shadowOpacity: 0.3,
           shadowRadius: 10,
           elevation: 10,
         },
         animatedStyle
       ]}
     >
        {/* Create pie segments using positioned views */}
        {segmentData.map((data) => {
          const { slice, index, startAngle, midAngle, textX, textY, anglePerSegment } = data;

          // Create a pie segment using a clever CSS trick with borders
          const segmentStyle = {
            position: 'absolute' as const,
            width: 0,
            height: 0,
            left: wheelDimensions.radius,
            top: wheelDimensions.radius,
            transformOrigin: '0 0',
            transform: [{ rotate: `${startAngle}deg` }],
            borderLeftWidth: wheelDimensions.radius * Math.sin((anglePerSegment * Math.PI) / 360),
            borderLeftColor: 'transparent',
            borderRightWidth: wheelDimensions.radius * Math.sin((anglePerSegment * Math.PI) / 360),
            borderRightColor: 'transparent',
            borderTopWidth: wheelDimensions.radius * Math.cos((anglePerSegment * Math.PI) / 360),
            borderTopColor: getSliceColor(index, slice),
            borderBottomWidth: 0,
            borderBottomColor: 'transparent',
          };
          
          return (
            <View key={slice.id || index}>
              {/* Pie segment */}
              <View style={segmentStyle} />
              
              {/* White border line between segments */}
              <View
                style={{
                  position: 'absolute',
                  width: 3,
                  height: wheelDimensions.radius - wheelDimensions.centerRadius,
                  backgroundColor: '#FFFFFF',
                  left: wheelDimensions.radius - 1.5,
                  top: wheelDimensions.centerRadius,
                  transformOrigin: 'bottom center',
                  transform: [{ rotate: `${startAngle}deg` }],
                  zIndex: 2,
                }}
              />

              {/* Text label */}
              {showLabels && slice.text && (
                <View
                  style={{
                    position: 'absolute',
                    left: textX - 30,
                    top: textY - 10,
                    width: 60,
                    height: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 3,
                  }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        fontSize: Math.max(10, wheelDimensions.responsiveSize / 25),
                        textAlign: 'center',
                      }
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                  >
                    {slice.text.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </Animated.View>

      {/* Center circle with spin text - now interactive */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={spinWheel}
        {...panResponder.current.panHandlers}
        style={{
          position: 'absolute',
          top: wheelDimensions.radius - wheelDimensions.centerRadius,
          left: wheelDimensions.radius - wheelDimensions.centerRadius,
          zIndex: 10,
        }}
      >
        <Animated.View style={[styles.centerCircle, {
          width: wheelDimensions.centerRadius * 2,
          height: wheelDimensions.centerRadius * 2,
          borderRadius: wheelDimensions.centerRadius,
          backgroundColor: '#333333', // Match web version center circle color
          borderWidth: 4,
          borderColor: '#FFFFFF', // White border like web version
          justifyContent: 'center',
          alignItems: 'center',
          transform: [{ scale: scaleAnimation }]
        }]}>
          <Text style={[styles.centerText, {
            fontSize: Math.max(14, wheelDimensions.responsiveSize / 18),
            color: '#FFFFFF', // White text to match web version
            fontWeight: 'bold'
          }]}>
            Spin
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wheelContainer: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  wheel: {
    position: 'relative',
  },
  segmentText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  centerCircle: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  centerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  emptyWheel: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#DDDDDD',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#999999',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PieWheel;

