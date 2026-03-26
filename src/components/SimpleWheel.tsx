import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

interface WheelSlice {
  id: string;
  text: string;
  color: string;
  emoji?: string;
}

interface SimpleWheelProps {
  slices: WheelSlice[];
  size?: number;
  showLabels?: boolean;
  rotation?: number;
}

const SimpleWheel: React.FC<SimpleWheelProps> = ({
  slices,
  size = 200,
  showLabels = true,
  rotation = 0,
}) => {
  // Get screen dimensions for responsiveness
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Make wheel responsive - use smaller of screen dimensions with padding
  const responsiveSize = size || Math.min(screenWidth, screenHeight) * 0.8;

  // Create alternating red and green colors like the image
  const wheelColors = ['#DC2626', '#16A34A']; // Red and Green matching the image

  const getSliceColor = (index: number, slice: WheelSlice) => {
    // Use slice color if provided, otherwise alternate red/green
    return slice.color || wheelColors[index % 2];
  };

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
            backgroundColor: '#F5F5F5',
            borderWidth: 3,
            borderColor: '#E0E0E0',
            overflow: 'hidden',
          }
        ]}
      >
        {/* Create pie segments using positioned triangular shapes */}
        {slices.map((slice, index) => {
          const anglePerSegment = 360 / numSegments;
          const startAngle = index * anglePerSegment;
          const midAngle = startAngle + anglePerSegment / 2;

          // Calculate text position
          const textRadius = radius * 0.65;
          const textAngle = (midAngle - 90) * Math.PI / 180;
          const textX = radius + Math.cos(textAngle) * textRadius;
          const textY = radius + Math.sin(textAngle) * textRadius;

          return (
            <View key={slice.id || index}>
              {/* Create pie segment using clip-path simulation */}
              <View
                style={{
                  position: 'absolute',
                  width: radius,
                  height: radius,
                  left: radius,
                  top: radius,
                  backgroundColor: getSliceColor(index, slice),
                  transformOrigin: '0 0',
                  transform: [{ rotate: `${startAngle}deg` }],
                  borderTopWidth: radius * Math.sin((anglePerSegment * Math.PI) / 360),
                  borderTopColor: getSliceColor(index, slice),
                  borderLeftWidth: radius * Math.cos((anglePerSegment * Math.PI) / 360),
                  borderLeftColor: 'transparent',
                  borderRightWidth: radius * Math.cos((anglePerSegment * Math.PI) / 360),
                  borderRightColor: 'transparent',
                  borderBottomWidth: 0,
                  borderBottomColor: 'transparent',
                }}
              />

              {/* Segment border line */}
              <View
                style={{
                  position: 'absolute',
                  width: 2,
                  height: radius,
                  backgroundColor: '#FFFFFF',
                  left: radius - 1,
                  top: 0,
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
                    left: textX - 25,
                    top: textY - 8,
                    width: 50,
                    height: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 3,
                  }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        fontSize: Math.max(8, responsiveSize / 25),
                        textAlign: 'center',
                      }
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {slice.text.toUpperCase()}
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
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    color: '#FFFFFF',
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

export default SimpleWheel;
