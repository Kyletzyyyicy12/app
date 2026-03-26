import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface WheelSlice {
  id: string;
  text: string;
  color: string;
  emoji?: string;
}

interface WheelTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

interface SpinningWheelProps {
  slices: WheelSlice[];
  size?: number;
  showLabels?: boolean;
  rotation?: number;
  isSpinning?: boolean;
  winners?: WheelSlice[];
  onSpinComplete?: () => void;
  spinDuration?: number;
  totalRotation?: number;
  finalAngle?: number;
  spins?: number;
  theme?: WheelTheme;
  resetPosition?: number; // Add reset position prop for exact synchronization
}

const centerSnakeLogo = require("../../assets/images/ulo.png");

const SpinningWheel: React.FC<SpinningWheelProps> = ({
  slices,
  size = 200,
  showLabels = true,
  rotation = 0,
  isSpinning = false,
  winners = [],
  onSpinComplete,
  spinDuration = 3000,
  totalRotation = 0,
  finalAngle = 0,
  spins = 5,
  theme,
  resetPosition = 0,
}) => {
  const animatedRotation = useRef(new Animated.Value(0)).current;
  const [currentRotation, setCurrentRotation] = React.useState(0);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const hasCompletedSpin = useRef(false); // Track if spin has completed to protect final position

  // Calculate final rotation with fallback
  const finalRotation = React.useMemo(() => {
    return totalRotation > 0 ? totalRotation : (spins * 360) + (finalAngle || 0);
  }, [totalRotation, spins, finalAngle]);

  // Memoize wheel colors for better performance
  const wheelColors = useMemo(() => {
    return theme ? [
      theme.primary,
      theme.secondary,
      theme.accent,
      '#FFE66D', // Additional colors for variety
      '#DDA0DD',
      '#87CEEB'
    ] : ['#E53E3E', '#38A169', '#FF6B6B', '#4ECDC4', '#FFEAA7', '#DDA0DD'];
  }, [theme]);

  // Enhanced spinning animation to match web version exactly
  const startSpinAnimation = useCallback(() => {
    if (isAnimating) return;

    console.log('🎯 SpinningWheel: Starting synchronized animation', {
      finalRotation,
      spinDuration,
      spins,
      organizerTimestamp: Date.now()
    });

    setIsAnimating(true);

    // Reset to starting position
    animatedRotation.setValue(0);

    // Use exact timing from organizer - no minimum duration
    const exactDuration = spinDuration || 3500;

    // Use exact cubic-bezier curve to match web version: cubic-bezier(0.25, 0.1, 0.25, 1)
    Animated.timing(animatedRotation, {
      toValue: finalRotation,
      duration: exactDuration,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Exact match to web version
      useNativeDriver: true,
    }).start(() => {
      console.log('✅ SpinningWheel: Animation completed at exact time, final rotation locked:', finalRotation);
      // CRITICAL: Lock the animation value at the final position so it doesn't reset
      animatedRotation.setValue(finalRotation);
      hasCompletedSpin.current = true; // Mark that spin completed - protects final position
      setIsAnimating(false);
      setCurrentRotation(finalRotation);

      // Call completion callback
      if (onSpinComplete) {
        onSpinComplete();
      }
    });
  }, [isAnimating, finalRotation, spinDuration, onSpinComplete, animatedRotation]);

  // Handle synchronized spinning animation - improved timing
  useEffect(() => {
    if (isSpinning && !isAnimating && finalRotation > 0) {
      console.log('🎯 PARTICIPANT: Triggering synchronized spin animation', {
        isSpinning,
        finalRotation,
        spinDuration,
        timestamp: Date.now()
      });
      hasCompletedSpin.current = false; // Reset flag for new spin
      startSpinAnimation();
    }
  }, [isSpinning, finalRotation, startSpinAnimation, isAnimating, spinDuration]);

  // Update rotation when external rotation changes (for manual control)
  // Only apply external rotation if it's explicitly provided and we're not spinning
  // IMPORTANT: Do not override if spin just completed (hasCompletedSpin is true)
  useEffect(() => {
    if (!isSpinning && !isAnimating && !hasCompletedSpin.current && typeof rotation === 'number' && rotation !== undefined) {
      console.log('🔄 Applying external rotation:', rotation);
      animatedRotation.setValue(rotation);
      setCurrentRotation(rotation);
    }
  }, [rotation, isSpinning, isAnimating, animatedRotation]);

  // Handle reset position synchronization ONLY when explicitly set (not during spinning or after completed spin)
  // Use a ref to track if we should respect the reset position
  const shouldApplyReset = useRef(false);
  
  useEffect(() => {
    // Only reset if:
    // 1. resetPosition is explicitly set to something other than undefined
    // 2. AND we're not spinning
    // 3. AND we're not animating
    // 4. AND the spin hasn't recently completed (protect final position for a brief moment)
    if (resetPosition !== undefined && resetPosition !== currentRotation && !isSpinning && !isAnimating && !hasCompletedSpin.current) {
      console.log('🔄 PARTICIPANT: Resetting wheel to exact position:', resetPosition);
      shouldApplyReset.current = true;
      animatedRotation.setValue(resetPosition);
      setCurrentRotation(resetPosition);
    } else if (resetPosition === undefined) {
      shouldApplyReset.current = false;
      // Allow the completed spin flag to be cleared after a short delay
      setTimeout(() => {
        hasCompletedSpin.current = false;
      }, 100);
    }
  }, [resetPosition, isSpinning, isAnimating, currentRotation, animatedRotation]);

  const getSliceColor = useCallback((index: number, slice: WheelSlice) => {
    // Use slice color if provided, otherwise use theme colors
    return slice.color || wheelColors[index % wheelColors.length];
  }, [wheelColors]);

  // Create proper SVG pie segments
  const pieSegments = useMemo(() => {
    if (slices.length === 0) return [];

    const radius = size / 2;
    const centerRadius = size * 0.12; // Smaller center for better proportions
    const outerRadius = radius - 5; // Leave some margin
    const numSegments = slices.length;
    const anglePerSegment = 360 / numSegments;

    return slices.map((slice, index) => {
      const startAngle = index * anglePerSegment;
      const endAngle = (index + 1) * anglePerSegment;
      const midAngle = startAngle + anglePerSegment / 2;

      // Convert to radians and adjust for SVG coordinate system (start from top)
      const startAngleRad = ((startAngle - 90) * Math.PI) / 180;
      const endAngleRad = ((endAngle - 90) * Math.PI) / 180;
      const midAngleRad = ((midAngle - 90) * Math.PI) / 180;

      // Calculate arc endpoints
      const x1 = radius + Math.cos(startAngleRad) * outerRadius;
      const y1 = radius + Math.sin(startAngleRad) * outerRadius;
      const x2 = radius + Math.cos(endAngleRad) * outerRadius;
      const y2 = radius + Math.sin(endAngleRad) * outerRadius;

      // Calculate text position - positioned optimally within segment
      const textRadius = outerRadius * 0.65; // Slightly closer to center for better readability
      const textX = radius + Math.cos(midAngleRad) * textRadius;
      const textY = radius + Math.sin(midAngleRad) * textRadius;

      // Create SVG path for pie slice
      const largeArcFlag = anglePerSegment > 180 ? 1 : 0;
      const pathData = [
        `M ${radius} ${radius}`, // Move to center
        `L ${x1} ${y1}`, // Line to start point
        `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`, // Arc to end point
        'Z' // Close path back to center
      ].join(' ');

      return {
        id: slice.id,
        text: slice.text,
        color: getSliceColor(index, slice),
        startAngle,
        endAngle,
        midAngle,
        textX,
        textY,
        anglePerSegment,
        pathData,
        outerRadius,
      };
    });
  }, [slices, size, getSliceColor]);

  if (slices.length === 0) {
    return (
      <View style={[styles.emptyWheel, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.emptyText}>No slices</Text>
      </View>
    );
  }

  const radius = size / 2;
  const centerRadius = size * 0.12;

  return (
    <View style={[styles.wheelContainer, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.wheel,
          {
            width: size,
            height: size,
            transform: [{
              rotate: animatedRotation.interpolate({
                inputRange: [0, 360, 720, 1080, 1440, 1800, 2160, 2520, 2880, 3240, 3600, 3960, 4320],
                outputRange: ['0deg', '360deg', '720deg', '1080deg', '1440deg', '1800deg', '2160deg', '2520deg', '2880deg', '3240deg', '3600deg', '3960deg', '4320deg'],
                extrapolate: 'extend'
              })
            }],
          }
        ]}
      >
        {/* Beautiful SVG Pie Chart */}
        <Svg
          width={size}
          height={size}
          style={{ position: 'absolute' }}
        >
          {/* Render pie segments */}
          {pieSegments.map((segment, index) => (
            <Path
              key={segment.id}
              d={segment.pathData}
              fill={segment.color}
              stroke="#FFFFFF"
              strokeWidth="2"
            />
          ))}

          {/* Center circle for better aesthetics */}
          <Circle
            cx={radius}
            cy={radius}
            r={centerRadius}
            fill="#1F2937"
            stroke="#FFFFFF"
            strokeWidth="3"
          />
        </Svg>

        {/* Clean horizontal text labels positioned over the SVG - counter-rotate to stay upright */}
        {showLabels && pieSegments.map((segment, index) => {
          // More generous minimum angle for text visibility
          const minAngleForText = size > 250 ? 8 : size > 150 ? 15 : 25;

          // Calculate responsive text size - clean and readable
          const baseTextSize = size / 15;
          const segmentBasedSize = segment.anglePerSegment / 4;
          const fontSize = Math.max(12, Math.min(24, baseTextSize, segmentBasedSize));

          // Calculate text container dimensions
          const textContainerWidth = Math.max(60, Math.min(120, segment.anglePerSegment * 3));
          const textContainerHeight = Math.max(20, fontSize + 8);

          // Smart text handling
          const maxChars = Math.max(4, Math.floor(segment.anglePerSegment / 6));

          let displayText = segment.text;
          if (displayText.length > maxChars) {
            displayText = displayText.substring(0, maxChars - 1) + '…';
          }

          // Normalize rotation to 0-360 range for proper text counter-rotation
          const normalizedRotation = ((currentRotation % 360) + 360) % 360;

          return segment.anglePerSegment > minAngleForText && (
            <View
              key={`text-${segment.id}`}
              style={{
                position: 'absolute',
                left: segment.textX - (textContainerWidth / 2),
                top: segment.textY - (textContainerHeight / 2),
                width: textContainerWidth,
                height: textContainerHeight,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
              }}
            >
              <Text
                style={[
                  styles.segmentText,
                  {
                    fontSize: fontSize,
                    textAlign: 'center',
                    color: '#FFFFFF',
                    fontWeight: '900',
                    textShadowColor: 'rgba(0, 0, 0, 1)',
                    textShadowOffset: { width: 2, height: 2 },
                    textShadowRadius: 4,
                    letterSpacing: 0.8,
                    // Counter-rotate text inline to keep it upright
                    transform: [{ rotate: `${-normalizedRotation}deg` }],
                  }
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.6}
                allowFontScaling={false}
              >
                {displayText.toUpperCase()}
              </Text>
            </View>
          )
        })}
      </Animated.View>

      {/* Stationary arrow pointer at the top (exactly like web version) */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: radius,
        zIndex: 20,
        alignItems: 'center',
        justifyContent: 'flex-start',
        transform: [{ translateX: -10 }], // Center the arrow
      }}>
        {/* Arrow pointing down to the wheel - exact match to web version */}
        <View style={{
          width: 0,
          height: 0,
          borderLeftWidth: 10,
          borderLeftColor: 'transparent',
          borderRightWidth: 10,
          borderRightColor: 'transparent',
          borderTopWidth: 20,
          borderTopColor: '#FFD700', // Gold color like web version
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5,
        }} />
      </View>

      {/* Center circle for aesthetics (stationary) */}
      <View style={{
        width: centerRadius * 2,
        height: centerRadius * 2,
        borderRadius: centerRadius,
        position: 'absolute',
        top: radius - centerRadius,
        left: radius - centerRadius,
        backgroundColor: '#1F2937',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
      }}>
        {/* Center logo if available */}
        {centerSnakeLogo && (
          <Image
            source={centerSnakeLogo}
            style={{
              width: centerRadius * 1.2,
              height: centerRadius * 1.2,
              resizeMode: 'contain',
            }}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wheelContainer: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  wheel: {
    position: 'relative',
  },
  pieSegment: {
    position: 'absolute',
  },
  pieSlice: {
    position: 'absolute',
  },
  segmentText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  centerCircle: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  centerText: {
    color: '#333333',
    fontWeight: 'bold',
    textAlign: 'center',
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
    fontSize: 14,
    fontWeight: '500',
  },
});

export default SpinningWheel;
