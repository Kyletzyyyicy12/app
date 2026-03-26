import type React from "react"
import { useEffect, useRef } from "react"
import { Animated, Easing, Image, StyleSheet, Text, View, Dimensions } from "react-native"
import { useTheme } from "../contexts/ThemeContext"

// Make sure you have your logo at this path or update accordingly
const logoSource = require("../../assets/images/ulo.png")

const LoadingScreen: React.FC = () => {
  const { theme } = useTheme()

  // Animation values
  const spinValue = useRef(new Animated.Value(0)).current
  const scaleValue = useRef(new Animated.Value(0.3)).current
  const fadeValue = useRef(new Animated.Value(0)).current
  const bounceValue = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Complex animation sequence
    const startAnimations = () => {
      // Fade in animation
      Animated.timing(fadeValue, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }).start()

      // Scale up animation
      Animated.spring(scaleValue, {
        toValue: 1,
        tension: 10,
        friction: 3,
        useNativeDriver: true,
      }).start()

      // Start spinning animation with varying speeds
      const spinAnimation = () => {
        Animated.sequence([
          Animated.timing(spinValue, {
            toValue: 1,
            duration: 3000,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(spinValue, {
            toValue: 0,
            duration: 3000,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          spinAnimation() // Loop the animation
        })
      }
      spinAnimation()

      // Bounce animation for text
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceValue, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bounceValue, {
            toValue: 0,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start()
    }

    startAnimations()
  }, [fadeValue, scaleValue, spinValue, bounceValue])

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  })

  const bounce = bounceValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 10],
  })

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.primary, opacity: fadeValue }]}>
      <View style={styles.logoContainer}>
        <Animated.View
          style={[
            styles.logo,
            {
              backgroundColor: '#FFFFFF',
              transform: [
                { rotate: spin },
                { scale: scaleValue }
              ],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 12,
            },
          ]}
        >
          <Image source={logoSource} style={styles.logoImage} resizeMode="contain" />
        </Animated.View>
      </View>

      <Animated.Text
        style={[
          styles.title,
          {
            color: theme.onPrimary,
            transform: [{ translateY: bounce }]
          }
        ]}
      >
        Coby Picks
      </Animated.Text>

      <Text style={[styles.subtitle, { color: theme.onPrimary }]}>Random Picker</Text>

      <View style={styles.loadingContainer}>
        <Animated.Text
          style={[
            styles.loadingText,
            {
              color: theme.onPrimary,
              opacity: fadeValue
            }
          ]}
        >
          Loading
        </Animated.Text>
        <View style={styles.dotsContainer}>
          {[0, 1, 2].map((index) => (
            <Animated.View
              key={index}
              style={[
                styles.loadingDot,
                {
                  backgroundColor: theme.onPrimary,
                  opacity: bounceValue.interpolate({
                    inputRange: [0, 0.33, 0.66, 1],
                    outputRange: [
                      index === 0 ? 1 : 0.3,
                      index === 1 ? 1 : 0.3,
                      index === 2 ? 1 : 0.3,
                      index === 0 ? 1 : 0.3
                    ],
                  }),
                  transform: [{
                    scale: bounceValue.interpolate({
                      inputRange: [0, 0.33, 0.66, 1],
                      outputRange: [
                        index === 0 ? 1.2 : 1,
                        index === 1 ? 1.2 : 1,
                        index === 2 ? 1.2 : 1,
                        index === 0 ? 1.2 : 1
                      ],
                    })
                  }]
                }
              ]}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  logoContainer: {
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: "hidden",
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 60,
  },
  // Removed progressContainer, progressBar, progressFill styles
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 6,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})

export default LoadingScreen
