import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';

interface WheelSlice {
  id: string;
  text: string;
  color: string;
  emoji?: string;
}

interface TruePieWheelProps {
  slices: WheelSlice[];
  size?: number;
  showLabels?: boolean;
  rotation?: number;
}

const TruePieWheel: React.FC<TruePieWheelProps> = ({
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
        anglePerSegment,
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
        {/* Create proper pie segments using CSS clip-path simulation */}
        {pieSegments.map((segment, index) => {
          // Create a proper pie segment using multiple overlapping views
          const segmentViews = [];
          
          // For each segment, create multiple thin slices to approximate a pie segment
          const slicesPerSegment = Math.max(4, Math.ceil(segment.anglePerSegment / 10));
          const sliceAngle = segment.anglePerSegment / slicesPerSegment;
          
          for (let i = 0; i < slicesPerSegment; i++) {
            const currentAngle = segment.startAngle + (i * sliceAngle);
            const nextAngle = segment.startAngle + ((i + 1) * sliceAngle);
            
            // Calculate the width of this slice
            const sliceWidth = (2 * Math.PI * (radius * 0.8)) / (360 / sliceAngle);
            const sliceHeight = radius * 0.6;
            
            // Position the slice
            const sliceRadius = radius * 0.7;
            const sliceMidAngle = currentAngle + (sliceAngle / 2);
            const sliceAngleRad = (sliceMidAngle - 90) * Math.PI / 180;
            const sliceX = radius + Math.cos(sliceAngleRad) * sliceRadius - sliceWidth / 2;
            const sliceY = radius + Math.sin(sliceAngleRad) * sliceRadius - sliceHeight / 2;
            
            segmentViews.push(
              <View
                key={`${segment.id}-slice-${i}`}
                style={{
                  position: 'absolute',
                  width: sliceWidth,
                  height: sliceHeight,
                  backgroundColor: segment.color,
                  left: sliceX,
                  top: sliceY,
                  transform: [{ rotate: `${sliceMidAngle}deg` }],
                  borderRadius: 2,
                  borderWidth: 0.5,
                  borderColor: '#FFFFFF',
                }}
              />
            );
          }
          
          return (
            <View key={segment.id}>
              {segmentViews}
              
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
                    allowFontScaling={false}
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
  segmentText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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

export default TruePieWheel;
