import React from 'react';
import { View, Image } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface TeardropPointerProps {
  size?: number;
  snakeImage?: any;
}

const TeardropPointer: React.FC<TeardropPointerProps> = ({
  size = 60,
  snakeImage
}) => {
  const arrowLength = size * 0.7;
  const arrowWidth = size * 0.4;
  const centerCircleRadius = size * 0.35;
  
  // ADJUST THESE VALUES to move arrow position
  const arrowOffsetX = size * 0.1; // Move arrow left (positive = right, negative = left)
  const arrowOffsetY = size * 0.10; // Move arrow down (positive = down, negative = up)

  // Create sharp arrow shape pointing upward
  const createArrowPath = () => {
    const centerX = size / 2;
    const centerY = size / 2;

    // ARROW POSITION: Apply offsets here
    const arrowCenterX = centerX + arrowOffsetX; // Move right
    const arrowCenterY = centerY - arrowOffsetY; // Move up

    const tipY = arrowCenterY - arrowLength / 2; // Sharp tip pointing up
    const baseY = arrowCenterY + arrowLength / 3;
    const leftX = arrowCenterX - arrowWidth / 2;
    const rightX = arrowCenterX + arrowWidth / 2;
    const shaftLeftX = arrowCenterX - arrowWidth / 3;
    const shaftRightX = arrowCenterX + arrowWidth / 3;

    return `
      M ${arrowCenterX} ${tipY}
      L ${leftX} ${arrowCenterY - arrowLength / 6}
      L ${shaftLeftX} ${arrowCenterY - arrowLength / 6}
      L ${shaftLeftX} ${baseY}
      L ${shaftRightX} ${baseY}
      L ${shaftRightX} ${arrowCenterY - arrowLength / 6}
      L ${rightX} ${arrowCenterY - arrowLength / 6}
      Z
    `;
  };

  const circleOffsetX = size * 0.2;

  return (
    <View style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: size,
      height: size,
      transform: [
        { translateX: -size / 2 },
        { translateY: -size / 2 },
      ],
      zIndex: 20,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Svg
        width={size}
        height={size}
      >
        {/* Sharp arrow pointing upward */}
        <Path
          d={createArrowPath()}
          fill="#ff4444"
          stroke="white"
          strokeWidth={2}
        />

        {/* Center circle with snake logo - centered */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={centerCircleRadius}
          fill="white"
          stroke="#333"
          strokeWidth={2}
        />
      </Svg>

      {/* Snake image in center circle - centered */}
      {snakeImage && (
        <Image
          source={snakeImage}
          style={{
            position: 'absolute',
            left: (size / 2) - (centerCircleRadius * 1.5) / 2,
            top: (size / 2) - (centerCircleRadius * 1.5) / 2,
            width: centerCircleRadius * 1.5,
            height: centerCircleRadius * 1.5,
            resizeMode: 'contain',
          }}
        />
      )}
    </View>
  );
};

export default TeardropPointer;







