import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

interface WheelSlice {
  id: string;
  text: string;
  color: string;
  emoji?: string;
}

interface ProperWheelProps {
  slices: WheelSlice[];
  size?: number;
  showLabels?: boolean;
  rotation?: number;
}

const centerSnakeLogo = require("../../assets/images/ulo.png");

const ProperWheel: React.FC<ProperWheelProps> = ({
  slices,
  size = 200,
  showLabels = true,
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
  const centerRadius = size * 0.12;
  const numSegments = slices.length;

  // Create a simple but effective wheel
  const createWheelSegments = () => {
    const segments = [];
    const anglePerSegment = 360 / numSegments;

    // Create segments using a simple approach that works
    for (let i = 0; i < numSegments; i++) {
      const slice = slices[i];
      const startAngle = i * anglePerSegment;
      const midAngle = startAngle + anglePerSegment / 2;

      // Create segment using positioned rectangles that form a circle
      const segmentRadius = radius * 0.8;
      const segmentWidth = (2 * Math.PI * segmentRadius) / numSegments;
      const segmentHeight = radius * 0.3;

      const radians = (startAngle - 90) * (Math.PI / 180);
      const x = radius + Math.cos(radians) * (segmentRadius - segmentHeight / 2) - segmentWidth / 2;
      const y = radius + Math.sin(radians) * (segmentRadius - segmentHeight / 2) - segmentHeight / 2;

      segments.push(
        <View
          key={`segment-${slice.id || i}`}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: segmentWidth,
            height: segmentHeight,
            backgroundColor: getSliceColor(i, slice),
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#FFFFFF',
            transform: [{ rotate: `${startAngle}deg` }],
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 3,
            elevation: 3,
          }}
        >
          {showLabels && slice.text && (
            <Text
              style={[
                styles.segmentText,
                { fontSize: Math.max(8, size / 35) }
              ]}
              numberOfLines={1}
            >
              {slice.text.length > 4 ? slice.text.substring(0, 4) : slice.text}
            </Text>
          )}
        </View>
      );
    }

    // Add radial lines to make it look more like a wheel
    for (let i = 0; i < numSegments; i++) {
      const angle = (i * 360) / numSegments;

      segments.push(
        <View
          key={`line-${i}`}
          style={{
            position: 'absolute',
            left: radius - 1,
            top: centerRadius * 2,
            width: 2,
            height: radius - centerRadius * 2,
            backgroundColor: '#E0E0E0',
            transformOrigin: 'top center',
            transform: [{ rotate: `${angle}deg` }],
            zIndex: 5,
          }}
        />
      );
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
            backgroundColor: '#FFFFFF',
            borderWidth: 4,
            borderColor: '#E0E0E0',
            overflow: 'hidden',
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
          zIndex: 15,
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

export default ProperWheel;
