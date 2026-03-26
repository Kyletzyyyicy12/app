import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';

interface WheelSlice {
  id: string;
  text: string;
  color: string;
  emoji?: string;
}

interface OptimizedPieWheelProps {
  slices: WheelSlice[];
  size?: number;
  showLabels?: boolean;
  rotation?: number;
}

const OptimizedPieWheel: React.FC<OptimizedPieWheelProps> = ({
  slices,
  size,
  showLabels = true,
  rotation = 0,
}) => {
  // Get screen dimensions for responsiveness
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  // Make wheel responsive - use smaller of screen dimensions with padding
  const responsiveSize = size || Math.min(screenWidth, screenHeight) * 0.75;
  
  // Updated colors to match web version - SWU Red & White theme with vibrant colors
  const wheelColors = [
    '#A00000', '#FFFFFF', '#FF6B6B', '#4ECDC4',
    '#45B7D1', '#F7B731', '#A23B72', '#0077B6',
    '#0096C7', '#00B4D8', '#48CAE4', '#90E0EF'
  ];

  const getSliceColor = (index: number, slice: WheelSlice) => {
    // Use slice color if provided, otherwise use web version color scheme
    return slice.color || wheelColors[index % wheelColors.length];
  };

  // Memoize pie segments for performance optimization
  const pieSegments = useMemo(() => {
    if (slices.length === 0) return [];

    const radius = responsiveSize / 2;
    const centerRadius = responsiveSize * 0.15;
    const numSegments = slices.length;
    const anglePerSegment = 360 / numSegments;

    return slices.map((slice, index) => {
      const startAngle = index * anglePerSegment;
      const endAngle = (index + 1) * anglePerSegment;
      const midAngle = startAngle + anglePerSegment / 2;

      // Create proper pie segment path using CSS borders
      const startAngleRad = (startAngle - 90) * Math.PI / 180;
      const endAngleRad = (endAngle - 90) * Math.PI / 180;
      
      // Calculate points for the pie slice
      const outerRadius = radius - 5;
      const innerRadius = centerRadius + 5;
      
      const x1 = radius + Math.cos(startAngleRad) * innerRadius;
      const y1 = radius + Math.sin(startAngleRad) * innerRadius;
      const x2 = radius + Math.cos(startAngleRad) * outerRadius;
      const y2 = radius + Math.sin(startAngleRad) * outerRadius;
      const x3 = radius + Math.cos(endAngleRad) * outerRadius;
      const y3 = radius + Math.sin(endAngleRad) * outerRadius;
      const x4 = radius + Math.cos(endAngleRad) * innerRadius;
      const y4 = radius + Math.sin(endAngleRad) * innerRadius;

      // Calculate text position
      const textRadius = radius * 0.65;
      const textAngle = (midAngle - 90) * Math.PI / 180;
      const textX = radius + Math.cos(textAngle) * textRadius;
      const textY = radius + Math.sin(textAngle) * textRadius;

      return {
        id: slice.id,
        text: slice.text,
        color: getSliceColor(index, slice),
        startAngle,
        endAngle,
        midAngle,
        textX,
        textY,
        points: `${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`,
        transform: `rotate(${startAngle}deg)`,
        // Create pie segment using clip-path for better performance
        clipPath: `polygon(50% 50%, ${50 + 40 * Math.cos(startAngleRad)}% ${50 + 40 * Math.sin(startAngleRad)}%, ${50 + 40 * Math.cos(endAngleRad)}% ${50 + 40 * Math.sin(endAngleRad)}%)`,
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
  const centerRadius = responsiveSize * 0.15;

  return (
    <View style={[styles.wheelContainer, { width: responsiveSize, height: responsiveSize }]}>
      <View 
        style={[
          styles.wheel,
          {
            width: responsiveSize,
            height: responsiveSize,
            borderRadius: responsiveSize / 2,
            transform: [{ rotate: `${rotation}deg` }],
            backgroundColor: '#F8F9FA',
            borderWidth: 4,
            borderColor: '#E0E0E0',
            overflow: 'hidden',
          }
        ]}
      >
        {/* Create proper pie segments */}
        {pieSegments.map((segment, index) => {
          const anglePerSegment = 360 / slices.length;
          
          return (
            <View key={segment.id}>
              {/* Pie segment using optimized approach */}
              <View
                style={[
                  styles.pieSegment,
                  {
                    position: 'absolute',
                    width: radius,
                    height: radius,
                    left: radius,
                    top: radius,
                    backgroundColor: segment.color,
                    transformOrigin: '0 0',
                    transform: [{ rotate: `${segment.startAngle}deg` }],
                    // Use border trick for pie segments
                    borderTopWidth: radius * Math.sin((anglePerSegment * Math.PI) / 360),
                    borderTopColor: segment.color,
                    borderLeftWidth: radius * Math.cos((anglePerSegment * Math.PI) / 360),
                    borderLeftColor: 'transparent',
                    borderRightWidth: radius * Math.cos((anglePerSegment * Math.PI) / 360),
                    borderRightColor: 'transparent',
                    borderBottomWidth: 0,
                    borderBottomColor: 'transparent',
                  }
                ]}
              />
              
              {/* White border line between segments */}
              <View
                style={{
                  position: 'absolute',
                  width: 3,
                  height: radius - centerRadius,
                  backgroundColor: '#FFFFFF',
                  left: radius - 1.5,
                  top: centerRadius,
                  transformOrigin: 'bottom center',
                  transform: [{ rotate: `${segment.startAngle}deg` }],
                  zIndex: 2,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 1,
                  elevation: 2,
                }}
              />
              
              {/* Text label with optimized rendering */}
              {showLabels && segment.text && (
                <View
                  style={{
                    position: 'absolute',
                    left: segment.textX - 35,
                    top: segment.textY - 12,
                    width: 70,
                    height: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 3,
                  }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { 
                        fontSize: Math.max(10, responsiveSize / 25),
                        textAlign: 'center',
                      }
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                    allowFontScaling={false} // Disable font scaling for consistent performance
                  >
                    {segment.text.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Center circle with spin text */}
      <View style={[styles.centerCircle, {
        width: centerRadius * 2,
        height: centerRadius * 2,
        borderRadius: centerRadius,
        position: 'absolute',
        top: radius - centerRadius,
        left: radius - centerRadius,
        backgroundColor: '#000000',
        borderWidth: 4,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
      }]}>
        <Text style={[styles.centerText, { 
          fontSize: Math.max(14, responsiveSize / 18),
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
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    // Optimize for high refresh rate displays
    ...(Platform.OS === 'ios' && {
      shouldRasterizeIOS: true,
      rasterizationScale: 2,
    }),
  },
  wheel: {
    position: 'relative',
    // Enable hardware acceleration for smooth animations
    ...(Platform.OS === 'android' && {
      renderToHardwareTextureAndroid: true,
    }),
  },
  pieSegment: {
    // Optimize rendering performance
    backgroundColor: 'transparent',
  },
  segmentText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    // Optimize text rendering
    includeFontPadding: false,
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
    includeFontPadding: false,
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

export default OptimizedPieWheel;
