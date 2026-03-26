import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

interface WheelSlice {
  id: string;
  text: string;
  color: string;
  emoji?: string;
}

interface FinalWheelProps {
  slices: WheelSlice[];
  size?: number;
  showLabels?: boolean;
  rotation?: number;
}

const centerSnakeLogo = require("../../assets/images/ulo.png");

const FinalWheel: React.FC<FinalWheelProps> = ({
  slices,
  size = 200,
  showLabels = true,
  rotation = 0,
}) => {
  // Create alternating red and green colors like the image
  const wheelColors = ['#DC2626', '#16A34A']; // Red and Green matching the image

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
  const numSegments = slices.length;

  // Create a simple pie segment using border trick
  const createPieSegment = (index: number, slice: WheelSlice) => {
    const anglePerSegment = 360 / numSegments;
    const startAngle = index * anglePerSegment;
    const midAngle = startAngle + anglePerSegment / 2;

    // For simplicity, let's create segments using a different approach
    // We'll use skewed rectangles to approximate pie segments
    const segmentWidth = radius * 1.5;
    const segmentHeight = radius * 0.8;

    return {
      position: 'absolute' as const,
      width: segmentWidth,
      height: segmentHeight,
      backgroundColor: getSliceColor(index, slice),
      left: radius - segmentWidth / 2,
      top: radius - segmentHeight / 2,
      transformOrigin: 'center',
      transform: [
        { rotate: `${startAngle + anglePerSegment / 2}deg` },
        { skewY: `${45 - anglePerSegment / 4}deg` }
      ],
      borderWidth: 1,
      borderColor: '#FFFFFF',
    };
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
            overflow: 'hidden',
            backgroundColor: '#F0F0F0',
          }
        ]}
      >
        {/* Create segments using a wedge approach */}
        {slices.map((slice, index) => {
          const anglePerSegment = 360 / numSegments;
          const startAngle = index * anglePerSegment;
          const midAngle = startAngle + anglePerSegment / 2;

          // Calculate text position
          const textRadius = radius * 0.7;
          const textAngle = (midAngle - 90) * Math.PI / 180;
          const textX = radius + Math.cos(textAngle) * textRadius;
          const textY = radius + Math.sin(textAngle) * textRadius;

          // Create a wedge using clip path simulation
          const wedgeSize = radius * 0.9;

          return (
            <View key={slice.id || index}>
              {/* Wedge segment */}
              <View
                style={{
                  position: 'absolute',
                  width: wedgeSize,
                  height: wedgeSize,
                  left: radius - wedgeSize / 2,
                  top: radius - wedgeSize / 2,
                  backgroundColor: getSliceColor(index, slice),
                  transform: [{ rotate: `${startAngle}deg` }],
                  borderRadius: wedgeSize / 2,
                  overflow: 'hidden',
                }}
              >
                {/* Create the wedge shape using a rotated rectangle */}
                <View
                  style={{
                    position: 'absolute',
                    width: wedgeSize,
                    height: wedgeSize / 2,
                    backgroundColor: getSliceColor(index, slice),
                    top: 0,
                    left: 0,
                    transform: [{ rotate: `${anglePerSegment > 180 ? 180 : anglePerSegment}deg` }],
                    transformOrigin: `${wedgeSize / 2}px ${wedgeSize / 2}px`,
                  }}
                />
                {/* Add second half if angle > 180 */}
                {anglePerSegment > 180 && (
                  <View
                    style={{
                      position: 'absolute',
                      width: wedgeSize,
                      height: wedgeSize / 2,
                      backgroundColor: getSliceColor(index, slice),
                      top: 0,
                      left: 0,
                      transform: [{ rotate: `${anglePerSegment - 180}deg` }],
                      transformOrigin: `${wedgeSize / 2}px ${wedgeSize / 2}px`,
                    }}
                  />
                )}
                {/* Mask to create clean wedge */}
                <View
                  style={{
                    position: 'absolute',
                    width: wedgeSize,
                    height: wedgeSize / 2,
                    backgroundColor: '#F0F0F0',
                    bottom: 0,
                    left: 0,
                    transform: [{ rotate: `${anglePerSegment}deg` }],
                    transformOrigin: `${wedgeSize / 2}px 0px`,
                  }}
                />
              </View>

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
                  }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        fontSize: Math.max(8, size / 25),
                        textAlign: 'center',
                      }
                    ]}
                    numberOfLines={1}
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
          fontSize: Math.max(12, size / 20),
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
    backgroundColor: '#F0F0F0',
  },
  pieSegment: {
    backgroundColor: 'transparent',
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

export default FinalWheel;
