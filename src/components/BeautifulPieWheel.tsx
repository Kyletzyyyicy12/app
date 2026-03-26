import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface WheelSlice {
  id: string;
  text: string;
  color: string;
  emoji?: string;
}

interface BeautifulPieWheelProps {
  slices: WheelSlice[];
  size?: number;
  showLabels?: boolean;
  rotation?: number | Animated.Value;
}

const BeautifulPieWheel: React.FC<BeautifulPieWheelProps> = ({
  slices,
  size,
  showLabels = true,
  rotation = 0,
}) => {
  // Get screen dimensions for responsiveness
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Make wheel responsive - use smaller of screen dimensions with padding
  const responsiveSize = size || Math.min(screenWidth, screenHeight) * 0.75;

  // Create beautiful colors to match web version - SWU Red & White theme with vibrant colors
  const wheelColors = [
    '#A00000', '#FFFFFF', '#FF6B6B', '#4ECDC4',
    '#45B7D1', '#F7B731', '#A23B72', '#0077B6',
    '#0096C7', '#00B4D8', '#48CAE4', '#90E0EF'
  ];

  const getSliceColor = (index: number, slice: WheelSlice) => {
    // Use slice color if provided, otherwise use beautiful color palette
    return slice.color || wheelColors[index % wheelColors.length];
  };

  // Create proper SVG pie segments
  const pieSegments = useMemo(() => {
    if (slices.length === 0) return [];

    const radius = responsiveSize / 2;
    const centerRadius = responsiveSize * 0.2; // Larger center for better proportions
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
  }, [slices, responsiveSize]);

  if (slices.length === 0) {
    return (
      <View style={[styles.emptyWheel, { width: responsiveSize, height: responsiveSize, borderRadius: responsiveSize / 2 }]}>
        <Text style={styles.emptyText}>No slices</Text>
      </View>
    );
  }

  const radius = responsiveSize / 2;
  const centerRadius = responsiveSize * 0.2;

  // Handle both number and Animated.Value for rotation
  const wheelTransform = rotation instanceof Animated.Value
    ? [{ rotate: rotation.interpolate({
        inputRange: [0, 360],
        outputRange: ['0deg', '360deg'],
        extrapolate: 'extend'
      }) }]
    : [{ rotate: `${rotation || 0}deg` }];

  const WheelContainer = rotation instanceof Animated.Value ? Animated.View : View;

  return (
    <View style={[styles.wheelContainer, { width: responsiveSize, height: responsiveSize }]}>
      <WheelContainer
        style={[
          styles.wheel,
          {
            width: responsiveSize,
            height: responsiveSize,
            transform: wheelTransform,
          }
        ]}
      >
        {/* Beautiful SVG Pie Chart */}
        <Svg
          width={responsiveSize}
          height={responsiveSize}
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

        {/* Clean horizontal text labels positioned over the SVG */}
        {showLabels && pieSegments.map((segment, index) => {
          // More generous minimum angle for text visibility
          const minAngleForText = responsiveSize > 250 ? 8 : responsiveSize > 150 ? 15 : 25;

          // Calculate responsive text size - clean and readable
          const baseTextSize = responsiveSize / 15;
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
      </WheelContainer>

      {/* Center circle with spin text */}
      <View style={[styles.centerCircle, {
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
        zIndex: 10,
      }]}>
        <Text style={[styles.centerText, { 
          fontSize: Math.max(12, responsiveSize / 20),
          color: '#FFFFFF',
          fontWeight: 'bold'
        }]}>
          Spin
        </Text>
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
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  wheel: {
    position: 'relative',
  },
  segmentText: {
    color: '#FFFFFF',
    fontWeight: '800', // Extra bold
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 1)', // Stronger shadow
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    includeFontPadding: false,
    letterSpacing: 0.5, // Better letter spacing for readability
  },
  centerCircle: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  centerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    includeFontPadding: false,
  },
  emptyWheel: {
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default BeautifulPieWheel;
