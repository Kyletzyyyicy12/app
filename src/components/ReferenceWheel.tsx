
import React from 'react';
import { View, Animated, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Path, G, Text } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');

interface WheelSlice {
  id: string;
  text: string;
  color: string;
}

interface WheelTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

interface ReferenceWheelProps {
  slices: WheelSlice[];
  rotation: Animated.Value;
  size?: number;
  onSliceLongPress?: (slice: WheelSlice, index: number) => void;
  onPress?: () => void;
  onLongPress?: () => void;
  pointerColor?: string; // Color for center circle + arrow
  // Optional rotation for pointer (e.g., to animate pointer while spinning)
  pointerRotation?: Animated.Value;
  // Optional pointer style
  pointerStyle?: 'teardrop' | 'triangle';
  // Theme support for dynamic colors
  theme?: WheelTheme;
}

const ReferenceWheel: React.FC<ReferenceWheelProps> = ({
  slices,
  rotation,
  size = Math.min(screenWidth * 0.8, 300),
  onSliceLongPress,
  onPress,
  onLongPress,
  pointerColor,
  pointerRotation,
  pointerStyle = 'teardrop',
  theme,
}) => {
  const radius = size / 2;
  const centerX = radius;
  const centerY = radius;
  const wheelRadius = radius - 10; // Leave small space for border
  const centerCircleRadius = 30; // Black center circle

  // Set default pointer color if not provided
  const effectivePointerColor = pointerColor || theme?.primary || '#8E0B16';

  // Calculate slice angles
  const anglePerSlice = (2 * Math.PI) / slices.length;

  // Use theme colors or fallback to default school colors
  const wheelColors = theme ? [theme.primary, theme.secondary] : [
    '#8E0B16', // School primary (maroon)
    '#66181E', // School secondary (dark maroon)
  ];

  // Generate SVG paths for each slice with center hole for teardrop
  const generateSlicePath = (index: number) => {
    const startAngle = index * anglePerSlice - Math.PI / 2; // Start from top
    const endAngle = (index + 1) * anglePerSlice - Math.PI / 2;

    // Outer arc points
    const x1 = centerX + wheelRadius * Math.cos(startAngle);
    const y1 = centerY + wheelRadius * Math.sin(startAngle);
    const x2 = centerX + wheelRadius * Math.cos(endAngle);
    const y2 = centerY + wheelRadius * Math.sin(endAngle);

    // Inner arc points (for center hole - using larger radius to accommodate teardrop)
    const innerRadius = 40; // Larger radius to give proper space for teardrop to blend
    const x3 = centerX + innerRadius * Math.cos(endAngle);
    const y3 = centerY + innerRadius * Math.sin(endAngle);
    const x4 = centerX + innerRadius * Math.cos(startAngle);
    const y4 = centerY + innerRadius * Math.sin(startAngle);

    const largeArcFlag = anglePerSlice > Math.PI ? 1 : 0;

    // Create path with hole in center
    return `M ${x4} ${y4} L ${x1} ${y1} A ${wheelRadius} ${wheelRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
  };

  // Get slice color - alternating red and green
  const getSliceColor = (slice: WheelSlice, index: number) => {
    return slice.color || wheelColors[index % 2]; // Alternate between red and green
  };

  // Create SPIN circle with sharp triangular arrow pointer
  const createSpinCircleWithPointer = () => {
    const centerRadius = 40;
    const arrowHeight = 20;
    const arrowWidth = 12;

    // Create perfect circle
    const circle = `M ${centerX - centerRadius} ${centerY}
                   A ${centerRadius} ${centerRadius} 0 1 1 ${centerX + centerRadius} ${centerY}
                   A ${centerRadius} ${centerRadius} 0 1 1 ${centerX - centerRadius} ${centerY} Z`;

    // Create sharp triangular arrow with straight lines only
    const arrow = `M ${centerX} ${centerY - centerRadius - arrowHeight}
                  L ${centerX - arrowWidth} ${centerY - centerRadius}
                  L ${centerX + arrowWidth} ${centerY - centerRadius}
                  L ${centerX} ${centerY - centerRadius - arrowHeight} Z`;

    return circle + ' ' + arrow;
  };

  // Alternate simple triangle-only pointer (without circle)
  const createTrianglePointerOnly = () => {
    const arrowHeight = 22;
    const arrowWidth = 16;
    return `M ${centerX} ${centerY - wheelRadius - 6}
            L ${centerX - arrowWidth / 2} ${centerY - wheelRadius + arrowHeight}
            L ${centerX + arrowWidth / 2} ${centerY - wheelRadius + arrowHeight}
            Z`;
  };

  // Calculate text position for each slice (accounting for center hole)
  const getTextPosition = (index: number) => {
    const angle = (index + 0.5) * anglePerSlice - Math.PI / 2;
    // Position text between center circle and outer edge
    const textRadius = (wheelRadius + centerCircleRadius) / 2;
    const x = centerX + textRadius * Math.cos(angle);
    const y = centerY + textRadius * Math.sin(angle);

    // Calculate text rotation to be readable
    let textAngle = (angle + Math.PI / 2) * 180 / Math.PI;

    // Flip text if it would be upside down
    if (textAngle > 90 && textAngle < 270) {
      textAngle += 180;
    }

    return { x, y, angle: textAngle };
  };



  return (
    <View style={{ position: 'relative' }}>
      {/* ONLY THE WHEEL SEGMENTS ROTATE - NO TEARDROP */}
      <Animated.View
        style={{
          transform: [
            {
              rotate: rotation.interpolate({
                inputRange: [0, 360],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        }}
      >
        <Svg width={size} height={size}>
          {slices.map((slice, index) => {
            const textPos = getTextPosition(index);
            const sliceColor = getSliceColor(slice, index);

            return (
              <G key={slice.id || index}>
                {/* Slice path */}
                <Path
                  d={generateSlicePath(index)}
                  fill={sliceColor}
                  stroke="none"
                  onLongPress={() => onSliceLongPress?.(slice, index)}
                />

                {/* Text */}
                <Text
                  x={textPos.x}
                  y={textPos.y}
                  fill={theme?.accent || "#FFFFFF"}
                  fontSize={Math.max(16, size / 15)}
                  fontWeight="bold"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  transform={`rotate(${textPos.angle}, ${textPos.x}, ${textPos.y})`}
                  onLongPress={() => onSliceLongPress?.(slice, index)}
                >
                  {slice.text}
                </Text>
              </G>
            );
          })}
        </Svg>
      </Animated.View>

      {/* BEAUTIFUL UPWARD-POINTING TEARDROP - DEFAULT STATIONARY (can rotate if pointerRotation provided) */}
      <Animated.View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: size,
        height: size,
        backgroundColor: 'transparent',
        pointerEvents: 'box-none',
        transform: pointerRotation
          ? [
              {
                rotate: pointerRotation.interpolate({
                  inputRange: [0, 360],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ]
          : undefined,
      }}>
        <TouchableOpacity
          onPress={onPress}
          disabled={!onPress}
          style={{ backgroundColor: 'transparent' }}
        >
          <Svg width={size} height={size} style={{ backgroundColor: 'transparent' }}>
            {pointerStyle === 'teardrop' ? (
              <>
                {/* SPIN circle with built-in upward-pointing arrow */}
                <Path d={createSpinCircleWithPointer()} fill={effectivePointerColor} stroke="none" />
                {/* Center "SPIN" text */}
                <Text
                  x={centerX}
                  y={centerY}
                  fill="#FFFFFF"
                  fontSize="18"
                  fontWeight="bold"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  SPIN
                </Text>
              </>
            ) : (
              <Path d={createTrianglePointerOnly()} fill={pointerColor} stroke="none" />
            )}
          </Svg>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default ReferenceWheel;

