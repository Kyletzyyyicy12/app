import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';

interface WheelSlice {
  id: string;
  text: string;
  color: string;
  emoji?: string;
}

interface CircularWheelProps {
  slices: WheelSlice[];
  size?: number;
  showLabels?: boolean;
  centerText?: string;
  rotation?: number;
}

const centerSnakeLogo = require("../../assets/images/ulo.png");

const CircularWheel: React.FC<CircularWheelProps> = ({
  slices,
  size = 200,
  showLabels = true,
  centerText,
  rotation = 0,
}) => {
  // Create alternating red and green colors like the image
  const wheelColors = ['#E53E3E', '#38A169']; // Red and Green

  const getSliceColor = (index: number, slice: WheelSlice) => {
    // Use slice color if provided, otherwise alternate red/green
    return slice.color || wheelColors[index % 2];
  };

  if (slices.length === 0) {
    return (
      <View style={[styles.emptyWheel, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.emptyText}>No slices</Text>
      </View>
    );
  }

  const radius = size / 2;
  const centerRadius = size * 0.15;

  // Create wheel segments using a radial pattern
  const createWheelSegments = () => {
    const segments = [];
    const numSegments = slices.length;
    const anglePerSegment = 360 / numSegments;

    // Create radial segments
    for (let i = 0; i < numSegments; i++) {
      const slice = slices[i];
      const startAngle = i * anglePerSegment;
      const midAngle = startAngle + anglePerSegment / 2;

      // Create segment using a wedge approach
      segments.push(
        <View
          key={slice.id || i}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            transform: [{ rotate: `${startAngle}deg` }],
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: radius - 1,
              width: 2,
              height: radius - centerRadius * 2,
              backgroundColor: getSliceColor(i, slice),
              transformOrigin: 'bottom center',
              transform: [{ scaleX: radius * 0.8 }],
            }}
          />
        </View>
      );

      // Add text labels
      if (showLabels && slice.text) {
        const textRadius = radius * 0.7;
        const textAngle = (midAngle - 90) * (Math.PI / 180);
        const textX = radius + Math.cos(textAngle) * textRadius;
        const textY = radius + Math.sin(textAngle) * textRadius;

        segments.push(
          <View
            key={`text-${slice.id || i}`}
            style={{
              position: 'absolute',
              left: textX - 25,
              top: textY - 8,
              width: 50,
              height: 16,
              justifyContent: 'center',
              alignItems: 'center',
              transform: [
                { rotate: `${midAngle > 90 && midAngle < 270 ? midAngle + 180 : midAngle}deg` }
              ],
              zIndex: 5,
            }}
          >
            <Text
              style={[
                styles.segmentText,
                { fontSize: Math.max(8, size / 30) }
              ]}
              numberOfLines={1}
            >
              {slice.text.toUpperCase()}
            </Text>
          </View>
        );
      }
    }

    return segments;
  };

  return (
    <View style={[styles.wheelContainer, { width: size, height: size }]}>
      <View
        style={[
          styles.wheel,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ rotate: `${rotation}deg` }],
            backgroundColor: '#F8F9FA',
            borderWidth: 4,
            borderColor: '#E0E0E0',
          }
        ]}
      >
        {/* Render wheel segments */}
        {createWheelSegments()}

        {/* Center circle with snake logo and spin text */}
        <View style={[styles.centerCircle, {
          width: centerRadius * 2,
          height: centerRadius * 2,
          borderRadius: centerRadius,
          position: 'absolute',
          top: radius - centerRadius,
          left: radius - centerRadius,
          backgroundColor: '#333333',
          borderWidth: 3,
          borderColor: '#FFFFFF',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
        }]}>
          <Text style={[styles.centerText, {
            fontSize: Math.max(10, size / 20),
            color: '#FFFFFF',
            fontWeight: 'bold'
          }]}>
            Spin
          </Text>
          <Image
            source={centerSnakeLogo}
            style={{
              width: centerRadius * 0.6,
              height: centerRadius * 0.6,
              resizeMode: 'contain',
              position: 'absolute',
              bottom: 3,
            }}
          />
        </View>
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
    backgroundColor: '#FFFFFF',
  },
  segment: {
    position: 'absolute',
  },
  segmentShape: {
    position: 'relative',
  },
  segmentMask: {
    backgroundColor: '#FFFFFF',
  },
  segmentTextContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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

export default CircularWheel;
