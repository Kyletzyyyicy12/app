import { Dimensions, Platform, PixelRatio } from 'react-native'
import { Easing } from 'react-native-reanimated'

// Device capabilities and optimization settings
export interface DeviceCapabilities {
  isHighRefreshRate: boolean
  refreshRate: number
  isIOS: boolean
  isAndroid: boolean
  screenDensity: number
  screenWidth: number
  screenHeight: number
  hasNotch: boolean
}

// Animation configurations optimized for different devices
export interface AnimationConfig {
  duration: number
  easing: any
  useNativeDriver: boolean
  frameRate: number
}

// Get device capabilities
export const getDeviceCapabilities = (): DeviceCapabilities => {
  const { width, height } = Dimensions.get('window')
  const screenDensity = PixelRatio.get()

  // Detect high refresh rate (144Hz+)
  const refreshRate = screenDensity > 3 ? 144 : 60
  const isHighRefreshRate = refreshRate >= 120

  return {
    isHighRefreshRate,
    refreshRate,
    isIOS: Platform.OS === 'ios',
    isAndroid: Platform.OS === 'android',
    screenDensity,
    screenWidth: width,
    screenHeight: height,
    hasNotch: height > width * 2, // Rough detection for devices with notch
  }
}

// Get optimized animation configuration
export const getOptimizedAnimationConfig = (): AnimationConfig => {
  const capabilities = getDeviceCapabilities()

  if (capabilities.isHighRefreshRate) {
    return {
      duration: 150, // Faster on high refresh rate
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
      frameRate: 144,
    }
  }

  // Standard 60Hz configuration
  return {
    duration: 250,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
    frameRate: 60,
  }
}

// Platform-specific optimizations
export const getPlatformOptimizations = () => {
  const capabilities = getDeviceCapabilities()

  if (capabilities.isIOS) {
    return {
      // iOS specific optimizations
      shouldRasterizeIOS: true,
      renderToHardwareTextureIOS: true,
      allowsEdgeAntialiasing: false, // Better performance
      shouldGroupAccessibilityChildren: true,
    }
  }

  if (capabilities.isAndroid) {
    return {
      // Android specific optimizations
      renderToHardwareTextureAndroid: true,
      enableHardwareAcceleration: true,
      allowFontScaling: false, // Consistent text rendering
      includeFontPadding: false,
    }
  }

  return {}
}

// High refresh rate scroll optimizations
export const getScrollOptimizationConfig = () => {
  const capabilities = getDeviceCapabilities()

  return {
    scrollEventThrottle: capabilities.isHighRefreshRate ? 8 : 16,
    maxToRenderPerBatch: capabilities.isHighRefreshRate ? 15 : 10,
    windowSize: capabilities.isHighRefreshRate ? 15 : 10,
    initialNumToRender: capabilities.isHighRefreshRate ? 12 : 8,
    updateCellsBatchingPeriod: capabilities.isHighRefreshRate ? 25 : 50,
  }
}

// Memory optimization for high refresh rate devices
export const getMemoryOptimizations = () => {
  const capabilities = getDeviceCapabilities()

  return {
    // Reduce re-renders on high refresh rate devices
    memoizationLevel: capabilities.isHighRefreshRate ? 'high' : 'standard',
    // Optimize image loading
    imageCacheSize: capabilities.isHighRefreshRate ? 50 : 30,
    // Reduce layout calculations
    enableLayoutAnimationOptimization: true,
  }
}

// Touch and gesture optimizations
export const getTouchOptimizations = () => {
  const capabilities = getDeviceCapabilities()

  return {
    // Improve touch responsiveness on high refresh rate
    touchSlop: capabilities.isHighRefreshRate ? 2 : 4,
    // Better gesture recognition
    gestureVelocityImpact: capabilities.isHighRefreshRate ? 0.3 : 0.5,
    // Smoother scrolling
    decelerationRate: capabilities.isHighRefreshRate ? 'fast' : 'normal',
  }
}

// Export utilities for use in components
export const deviceCapabilities = getDeviceCapabilities()
export const animationConfig = getOptimizedAnimationConfig()
export const platformOptimizations = getPlatformOptimizations()
export const scrollOptimizations = getScrollOptimizationConfig()
export const memoryOptimizations = getMemoryOptimizations()
export const touchOptimizations = getTouchOptimizations()