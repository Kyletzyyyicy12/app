import React from 'react'
import { View, Image, Text } from 'react-native'
import Svg, { Circle, Path, G, Text as SvgText } from 'react-native-svg'
import { useTheme } from '../contexts/ThemeContext'

const centerLogoImage = require("../../assets/images/ulo.png")

interface WheelSlice {
  id: string
  text: string
  color: string
  emoji?: string
}

interface MiniPieWheelProps {
  slices: WheelSlice[]
  size?: number
  strokeWidth?: number
}

const MiniPieWheel: React.FC<MiniPieWheelProps> = ({
  slices = [],
  size = 32,
  strokeWidth = 1
}) => {
  const { theme } = useTheme();

  // Default colors if no slices provided - use theme colors
  const defaultColors = [theme.primary, theme.secondary, theme.accent, theme.success, theme.error, theme.border]
  
  // If no slices, create default slices for visual representation
  const displaySlices = slices.length > 0 ? slices : [
    { id: '1', text: 'Option 1', color: defaultColors[0] },
    { id: '2', text: 'Option 2', color: defaultColors[1] },
    { id: '3', text: 'Option 3', color: defaultColors[2] },
    { id: '4', text: 'Option 4', color: defaultColors[3] },
  ]

  const radius = (size - strokeWidth * 2) / 2
  const centerX = size / 2
  const centerY = size / 2

  // Calculate angles for each slice
  const totalSlices = displaySlices.length
  const anglePerSlice = (2 * Math.PI) / totalSlices

  const createPath = (startAngle: number, endAngle: number) => {
    const x1 = centerX + radius * Math.cos(startAngle)
    const y1 = centerY + radius * Math.sin(startAngle)
    const x2 = centerX + radius * Math.cos(endAngle)
    const y2 = centerY + radius * Math.sin(endAngle)

    const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1"

    return [
      "M", centerX, centerY,
      "L", x1, y1,
      "A", radius, radius, 0, largeArcFlag, 1, x2, y2,
      "Z"
    ].join(" ")
  }

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G>
          {displaySlices.map((slice, index) => {
            const startAngle = index * anglePerSlice - Math.PI / 2 // Start from top
            const endAngle = (index + 1) * anglePerSlice - Math.PI / 2
            const pathData = createPath(startAngle, endAngle)

            return (
              <Path
                key={slice.id || index}
                d={pathData}
                fill={slice.color}
                stroke="#FFFFFF"
                strokeWidth={strokeWidth}
              />
            )
          })}
          {/* Center circle background for logo */}
          <Circle
            cx={centerX}
            cy={centerY}
            r={size * 0.2}
            fill={theme.surface}
            stroke={theme.border}
            strokeWidth={0.5}
          />
        </G>
      </Svg>
      {/* Snake logo in the center */}
      <Image
        source={centerLogoImage}
        style={{
          position: 'absolute',
          width: size * 0.35,
          height: size * 0.35,
          top: size * 0.325,
          left: size * 0.325,
          borderRadius: size * 0.175,
        }}
        resizeMode="contain"
      />
    </View>
  )
}

export default MiniPieWheel
