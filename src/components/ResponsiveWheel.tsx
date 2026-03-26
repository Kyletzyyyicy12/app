import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

interface WheelSlice {
  id: string;
  text: string;
  color: string;
  emoji?: string;
}

interface ResponsiveWheelProps {
  slices: WheelSlice[];
  size?: number;
  showLabels?: boolean;
  rotation?: number;
}

const ResponsiveWheel: React.FC<ResponsiveWheelProps> = ({
  slices,
  size,
  showLabels = true,
  rotation = 0,
}) => {
  // Get screen dimensions for responsiveness
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  // Make wheel responsive - use smaller of screen dimensions with padding
  const responsiveSize = size || Math.min(screenWidth, screenHeight) * 0.75;
  
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
            backgroundColor: '#F8F9FA',
            borderWidth: 4,
            borderColor: '#E0E0E0',
          }
        ]}
      >
        {/* Create segments using positioned colored rectangles around the circle */}
        {slices.map((slice, index) => {
          const anglePerSegment = 360 / numSegments;
          const startAngle = index * anglePerSegment;
          const midAngle = startAngle + anglePerSegment / 2;
          
          // Calculate segment position around the circle
          const segmentRadius = radius * 0.75;
          const segmentAngle = (startAngle - 90) * Math.PI / 180;
          const segmentMidAngle = (midAngle - 90) * Math.PI / 180;
          
          // Position segments around the wheel perimeter
          const segmentWidth = (2 * Math.PI * segmentRadius) / numSegments * 0.9;
          const segmentHeight = radius * 0.4;
          
          const segmentX = radius + Math.cos(segmentMidAngle) * segmentRadius - segmentWidth / 2;
          const segmentY = radius + Math.sin(segmentMidAngle) * segmentRadius - segmentHeight / 2;
          
          // Calculate text position
          const textRadius = radius * 0.6;
          const textAngle = (midAngle - 90) * Math.PI / 180;
          const textX = radius + Math.cos(textAngle) * textRadius;
          const textY = radius + Math.sin(textAngle) * textRadius;
          
          return (
            <View key={slice.id || index}>
              {/* Colored segment */}
              <View
                style={{
                  position: 'absolute',
                  width: segmentWidth,
                  height: segmentHeight,
                  backgroundColor: getSliceColor(index, slice),
                  left: segmentX,
                  top: segmentY,
                  transform: [{ rotate: `${midAngle}deg` }],
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              />
              
              {/* Radial divider line */}
              <View
                style={{
                  position: 'absolute',
                  width: 3,
                  height: radius - centerRadius - 10,
                  backgroundColor: '#FFFFFF',
                  left: radius - 1.5,
                  top: centerRadius + 10,
                  transformOrigin: 'bottom center',
                  transform: [{ rotate: `${startAngle}deg` }],
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 2,
                  elevation: 2,
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

export default ResponsiveWheel;
