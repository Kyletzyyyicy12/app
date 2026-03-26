import React from "react"
import { ImageBackground, View, StyleSheet } from "react-native"
import { useTheme } from "../contexts/ThemeContext"

interface BackgroundWrapperProps {
  children: React.ReactNode
  style?: any
}

const BackgroundWrapper: React.FC<BackgroundWrapperProps> = ({ children, style }) => {
  const { theme } = useTheme()

  if (theme.backgroundImage) {
    return (
      <ImageBackground
        source={{ uri: theme.backgroundImage }}
        style={[styles.container, style]}
        resizeMode="cover"
      >
        <View style={[styles.overlay, { backgroundColor: `${theme.background}20` }]}>
          {children}
        </View>
      </ImageBackground>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
})

export default BackgroundWrapper
