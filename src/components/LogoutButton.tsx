import React, { useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  PanResponder,
  Vibration,
  Platform,
  Alert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'

interface LogoutButtonProps {
  style?: any
}

const LogoutButton: React.FC<LogoutButtonProps> = ({ style }) => {
  const { theme } = useTheme()
  const { signOut, currentUser, userProfile } = useAuth()

  // Animation values
  const scaleAnimation = useRef(new Animated.Value(1)).current
  const opacityAnimation = useRef(new Animated.Value(1)).current
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Simple press feedback
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Haptic feedback for press
        if (Platform.OS === 'android') {
          Vibration.vibrate(30)
        }
      },
      onPanResponderRelease: () => {
        // Simple press feedback animation
        Animated.spring(scaleAnimation, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 5,
        }).start()
      },
    })
  )

  const performLogout = async () => {
    if (isLoggingOut) return

    setIsLoggingOut(true)

    // Haptic feedback for logout
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 50, 50, 50])
    }

    // Scale and fade animations for smooth logout
    Animated.parallel([
      Animated.timing(scaleAnimation, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(opacityAnimation, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start()

    try {
      // Wait a moment for animations to complete
      await new Promise(resolve => setTimeout(resolve, 300))

      // Perform the actual logout
      await signOut()

      // Final animation before navigating away
      Animated.parallel([
        Animated.timing(scaleAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()

    } catch (error) {
      console.error('Logout error:', error)

      // Reset animations on error
      Animated.parallel([
        Animated.spring(scaleAnimation, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnimation, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start()

      setIsLoggingOut(false)
    }
  }

  const handlePressLogout = () => {
    Alert.alert(
      'Logout',
      `Are you sure you want to logout, ${userProfile?.fullName || currentUser?.email || 'User'}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: performLogout,
        },
      ]
    )
  }

  const handleLongPressLogout = () => {
    // Direct logout without confirmation on long press
    performLogout()
  }

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          transform: [
            { scale: scaleAnimation }
          ],
          opacity: opacityAnimation,
        }
      ]}
      {...panResponder.current.panHandlers}
    >
      <TouchableOpacity
        style={[styles.logoutButton, {
          backgroundColor: isLoggingOut ? theme.error + 'CC' : theme.error
        }]}
        onPress={handlePressLogout}
        onLongPress={handleLongPressLogout}
        delayLongPress={500}
        disabled={isLoggingOut}
        activeOpacity={0.8}
      >
        <View style={styles.buttonContent}>
          <Ionicons
            name="log-out-outline"
            size={20}
            color={theme.onError}
            style={styles.icon}
          />
          <Text style={[styles.logoutText, { color: theme.onError }]}>
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  logoutButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  logoutText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
})

export default LogoutButton