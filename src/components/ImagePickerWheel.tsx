import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  Image,
} from 'react-native'
import Svg, { G, Path, Circle, Text as SvgText, Image as SvgImage, ClipPath, Defs, Pattern, Rect } from 'react-native-svg'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import ConfettiCannon from 'react-native-confetti-cannon'
import { db } from '../config/firebaseConfig'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { calculateUnifiedWinner } from '../utils/WheelSynchronizationUtils'

const { width, height } = Dimensions.get('window')
const isTablet = width > 768

interface ImageWheelSlice {
  id: string
  text: string
  color: string
  image?: {
    url: string
    alt?: string
    isLoaded?: boolean
    error?: boolean
  }
}

interface ImagePickerWheelProps {
  slices?: ImageWheelSlice[]
  onSpinComplete?: (result: any) => void
  onSettingsChange?: (settings: any) => void
  wheelTitle?: string
  disabled?: boolean
  isSoloMode?: boolean
  sessionId?: string
  organizerMode?: boolean
}

export const ImagePickerWheel: React.FC<ImagePickerWheelProps> = ({
  slices: initialSlices = [],
  onSpinComplete,
  onSettingsChange,
  wheelTitle = "Image Picker Wheel",
  disabled = false,
  isSoloMode = true,
  sessionId,
  organizerMode = false,
}) => {
  const { theme } = useTheme()
  const { userProfile } = useAuth()
  const canvasRef = useRef<any>(null)

  const [isSpinning, setIsSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [winners, setWinners] = useState<ImageWheelSlice[]>([])
  const [showWinnerPopup, setShowWinnerPopup] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [isSpinCompleting, setIsSpinCompleting] = useState(false)
  const [lastSpinTimestamp, setLastSpinTimestamp] = useState<number>(0)
  const [lastWinnerAnnounced, setLastWinnerAnnounced] = useState<string>('')

  // Animation refs
  const animationRef = useRef<number | null>(null)
  const spinStartTime = useRef<number | null>(null)
  const spinCompletionRef = useRef<boolean>(false)

  // Image slice management - Updated to match OrganizerLiveRoomScreen pattern
  const [slices, setSlices] = useState<ImageWheelSlice[]>(initialSlices)
  const [isEditingImages, setIsEditingImages] = useState(false)
  const [imageUrls, setImageUrls] = useState<{[key: string]: string}>({
    'image-1': '',
    'image-2': '',
    'image-3': '',
    'image-4': '',
    'image-5': ''
  })
  const [imageLoadStates, setImageLoadStates] = useState<{[key: string]: 'loading' | 'loaded' | 'error'}>({})

  // Wheel theme
  const wheelTheme = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff",
    background: "#ffffff"
  }

  // Initialize slices with default data if none provided
  useEffect(() => {
    if (initialSlices.length === 0) {
      const defaultSlices: ImageWheelSlice[] = Array.from({ length: 6 }, (_, index) => ({
        id: `slice-${index}`,
        text: `Option ${index + 1}`,
        color: wheelTheme.primary,
      }))
      setSlices(defaultSlices)
    } else {
      setSlices(initialSlices)
    }
  }, [initialSlices, wheelTheme.primary])

  // Add one slice dynamically
  const addSlice = useCallback(() => {
    if (slices.length >= 20) {
      Alert.alert("Maximum Reached", "Wheel can have a maximum of 20 slices")
      return
    }

    const sliceNumber = slices.length + 1
    const newSlice: ImageWheelSlice = {
      id: `slice-${Date.now()}`,
      text: `Option ${sliceNumber}`,
      color: wheelTheme.primary,
    }

    setSlices(prev => [...prev, newSlice])
  }, [slices.length, wheelTheme.primary, wheelTheme.secondary])

  // Remove slices dynamically
  const removeSlice = useCallback((sliceId: string) => {
    if (slices.length <= 2) {
      Alert.alert("Cannot Remove Slice", "Wheel must have at least 2 slices")
      return
    }

    setSlices(prev => prev.filter(slice => slice.id !== sliceId))

    // Clean up related state
    setImageLoadStates(prev => {
      const newStates = { ...prev }
      delete newStates[sliceId]
      return newStates
    })
  }, [slices.length])

  // Enhanced spinning function - Based on OrganizerWheel implementation
  const spinWheel = useCallback(() => {
    const currentTime = Date.now()
    const MIN_SPIN_INTERVAL = 3000 // Minimum 3 seconds between spins

    // Enhanced guards to prevent race conditions and spam
    if (isSpinning || slices.length === 0 || animationRef.current !== null) {
      console.log('⚠️ Spin already in progress or wheel not ready')
      return
    }

    // Prevent rapid successive spins
    if (currentTime - lastSpinTimestamp < MIN_SPIN_INTERVAL) {
      const remainingTime = MIN_SPIN_INTERVAL - (currentTime - lastSpinTimestamp)
      console.log(`⚠️ Spin rate limited - ${remainingTime}ms remaining`)
      return
    }

    // Prevent spin completion conflicts
    if (isSpinCompleting || spinCompletionRef.current) {
      console.log('⚠️ Spin completion in progress - ignoring new spin request')
      return
    }

    console.log('🎯 PRE-CALCULATE SPIN PARAMETERS FOR PERFECT SYNC (FIXED ORDER)')
    const spinDuration = Math.random() * 2000 + 3000 // 3-5 seconds
    const totalRotation = Math.random() * 4 * 2 * Math.PI + 6 * 2 * Math.PI // 6-10 full rotations
    const { winner, winningIndex } = calculateUnifiedWinner(totalRotation, slices.map(s => s.text))

    console.log('🎯 PRE-CALCULATED WINNER BEFORE BROADCAST:', {
      winner: winner,
      winningIndex: winningIndex,
      spinDuration: spinDuration.toFixed(2) + 's',
      totalRotation: totalRotation.toFixed(6)
    })

    setIsSpinning(true)
    setLastSpinTimestamp(currentTime)
    spinStartTime.current = currentTime

    let currentRotation = 0
    const startTime = performance.now() // Use high-precision timing for smoothness
    let lastFrameTime = startTime - 16 // Ensure first frame runs immediately

    const animate = (currentTime: number) => {
      // Calculate delta time for consistent frame rate
      const deltaTime = currentTime - lastFrameTime
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / spinDuration, 1)

      // ULTRA-SMOOTH EASING: Premium wheel feel (same as participant view)
      // Fast acceleration, smooth constant speed, gentle deceleration
      const easedProgress = progress < 0.25
        ? Math.pow(progress / 0.25, 2.2) * 0.25  // Rapid acceleration start
        : progress < 0.75
        ? 0.25 + (progress - 0.25) / 0.5 * 0.5   // Smooth constant speed
        : 0.75 + Math.pow((progress - 0.75) / 0.25, 0.4) * 0.25 // Gentle deceleration

      // Calculate precise rotation with sub-pixel accuracy
      currentRotation = totalRotation * easedProgress
      setWheelRotation(currentRotation)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
        lastFrameTime = currentTime
      } else {
        // Spin completed - set final position and stop spinning
        setWheelRotation(totalRotation)
        setIsSpinning(false)
        setIsSpinCompleting(true)
        spinCompletionRef.current = true

        // Clear animation reference to prevent conflicts
        animationRef.current = null

        // Calculate winner immediately but wait for visual to settle
        const { winner } = calculateUnifiedWinner(totalRotation, slices.map(s => s.text))

        // Guard against duplicate winner announcements
        const winnerObject = {
          id: `winner-${Date.now()}`,
          name: winner
        }

        // Wait for visual to settle before calling completion callback
        setTimeout(async () => {
          // Double-check winner calculation after visual has settled
          const { winner: finalWinner } = calculateUnifiedWinner(totalRotation, slices.map(s => s.text))

          // Only proceed if this completion hasn't been cancelled
          if (spinCompletionRef.current) {
            const currentTime = Date.now()
            const MIN_WINNER_INTERVAL = 1000 // Minimum 1 second between same winner announcements

            // Prevent redundant winner announcements for the same winner
            if (finalWinner === lastWinnerAnnounced &&
                currentTime - (typeof lastWinnerAnnounced === 'string' ? 0 : lastWinnerAnnounced) < MIN_WINNER_INTERVAL) {
              setIsSpinCompleting(false)
              spinCompletionRef.current = false
              return
            }

            // Update last winner tracking
            setLastWinnerAnnounced(finalWinner)

            // Find the winning slice object
            const winningSlice = slices.find(slice => slice.text === finalWinner) || slices[0]

            // Show winner popup and confetti
            setWinners([winningSlice])
            setShowWinnerPopup(true)
            setShowConfetti(true)

            // Trigger confetti
            setTimeout(() => setShowConfetti(false), 3000)

            // Call completion callback with final winner
            if (onSpinComplete) {
              onSpinComplete({
                winners: [finalWinner],
                winner: finalWinner,
                spinDuration: spinDuration,
                totalRotation: totalRotation,
                originalWinner: winner
              })
            }

            // Mark completion as finished
            setIsSpinCompleting(false)
            spinCompletionRef.current = false
          }
        }, 500) // Increased delay for better stability
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [isSpinning, slices, onSpinComplete, lastSpinTimestamp, isSpinCompleting, lastWinnerAnnounced])

  // Add image URL to slice
  const addImageToSlice = async (sliceId: string, imageUrl: string) => {
    if (!imageUrl.trim()) return

    let trimmedUrl = imageUrl.trim()

    // Basic URL validation
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      if (trimmedUrl.includes('.') || trimmedUrl.includes('/')) {
        trimmedUrl = 'https://' + trimmedUrl
      } else {
        Alert.alert("Invalid URL", "Please enter a valid image URL")
        return
      }
    }

    setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loading' }))

    // Update slice with image URL immediately
    setSlices(prev => prev.map(slice => {
      if (slice.id === sliceId) {
        return {
          ...slice,
          image: {
            url: trimmedUrl,
            isLoaded: true,
            error: false
          }
        }
      }
      return slice
    }))

    // Mark as loaded immediately for better UX
    setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loaded' }))

    Alert.alert("Success", "Image added to slice!")
  }

  // Pick image from device
  const pickImageFromDevice = async (sliceId: string) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (permissionResult.granted === false) {
        Alert.alert("Permission Required", "Permission to access camera roll is required!")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 4],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri

        // Convert to base64 for storage
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: 'base64',
        })

        const dataUrl = `data:image/jpeg;base64,${base64}`

        setSlices(prev => prev.map(slice => {
          if (slice.id === sliceId) {
            return {
              ...slice,
              image: {
                url: dataUrl,
                isLoaded: true,
                error: false
              }
            }
          }
          return slice
        }))

        setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loaded' }))
      }
    } catch (error) {
      console.error('Error picking image:', error)
      Alert.alert("Error", "Failed to pick image")
    }
  }

  // Remove image from slice
  const removeImageFromSlice = (sliceId: string) => {
    setSlices(prev => prev.map(slice => {
      if (slice.id === sliceId) {
        const { image, ...sliceWithoutImage } = slice
        return sliceWithoutImage
      }
      return slice
    }))

    setImageLoadStates(prev => {
      const newStates = { ...prev }
      delete newStates[sliceId]
      return newStates
    })
  }

  // Handle URL change for image slots (like OrganizerLiveRoomScreen)
  const handleImageUrlChange = (slotKey: string, url: string) => {
    // Update imageUrls state directly
    setImageUrls(prev => ({ ...prev, [slotKey]: url }))

    // Update slice with image URL immediately for better UX
    const sliceIndex = parseInt(slotKey.split('-')[1]) - 1
    if (sliceIndex >= 0 && sliceIndex < slices.length) {
      const sliceId = slices[sliceIndex].id

      if (url.trim()) {
        // Enhanced URL validation - allow data URLs
        let trimmedUrl = url.trim()
        if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('data:')) {
          if (trimmedUrl.includes('.') || trimmedUrl.includes('/')) {
            trimmedUrl = 'https://' + trimmedUrl
          }
        }

        setSlices(prev => prev.map(slice => {
          if (slice.id === sliceId) {
            return {
              ...slice,
              image: {
                url: trimmedUrl,
                isLoaded: true,
                error: false
              }
            }
          }
          return slice
        }))

        setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loaded' }))

        // Check for problematic social media URLs
        if (url.includes('facebook.com') || url.includes('fbcdn.net')) {
          Alert.alert(
            'Facebook Image Detected',
            'Facebook images are often blocked by browser security. Try using:\n\n• Direct image URLs from other sources\n• PP, Flickr, or direct image hosting\n• Upload images to a different service\n\nWould you like to continue anyway?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Continue',
                onPress: () => Alert.alert('Success', `Image URL for slot ${slotKey.split('-')[1]} updated! Note: Facebook images may not display due to browser security.`)
              }
            ]
          )
          return
        }

        if (url.includes('instagram.com')) {
          Alert.alert(
            'Instagram Image Detected',
            'Instagram images are often blocked by browser security. Try using:\n\n• Direct image URLs from other sources\n• Imgur, Flickr, or direct image hosting\n\nWould you like to continue anyway?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Continue',
                onPress: () => Alert.alert('Success', `Image URL for slot ${slotKey.split('-')[1]} updated! Note: Instagram images may not display due to browser security.`)
              }
            ]
          )
          return
        }

        Alert.alert('Success', `Image URL for slot ${slotKey.split('-')[1]} updated!`)
      } else {
        // Clear image if URL is empty
        setSlices(prev => prev.map(slice => {
          if (slice.id === sliceId) {
            const { image, ...sliceWithoutImage } = slice
            return sliceWithoutImage
          }
          return slice
        }))

        setImageLoadStates(prev => {
          const newStates = { ...prev }
          delete newStates[sliceId]
          return newStates
        })
      }
    }
  }

  // Clear all images
  const clearAllImages = () => {
    setImageUrls({
      'image-1': '',
      'image-2': '',
      'image-3': '',
      'image-4': '',
      'image-5': ''
    })

    // Clear images from slices
    setSlices(prev => prev.map(slice => {
      const { image, ...sliceWithoutImage } = slice
      return sliceWithoutImage
    }))

    setImageLoadStates({})

    // Sync with session
    if (sessionId) {
      updateDoc(doc(db, 'liveDrawSessions', sessionId), {
        wheelItems: slices.map(s => s.text),
        imageUrls: {
          'image-1': '',
          'image-2': '',
          'image-3': '',
          'image-4': '',
          'image-5': ''
        },
        updatedAt: serverTimestamp()
      }).catch((error) => {
        console.error('Error clearing images:', error)
      })
    }

    Alert.alert('Success', 'All image URLs cleared!')
  }

  // Reset wheel
  const resetWheel = () => {
    setWheelRotation(0)
    setWinners([])
    setShowWinnerPopup(false)
    setShowConfetti(false)
    setIsSpinning(false)
  }

  return (
    <View style={styles.container}>
      {/* Wheel Display */}
      <View style={[styles.wheelContainer, {
        borderColor: wheelTheme.primary,
        backgroundColor: wheelTheme.background
      }]}>
        {/* Simple wheel visualization - in a real implementation, you'd use a proper canvas or SVG */}
        <View style={[styles.wheelVisualization, {
          transform: [{ rotate: `${wheelRotation}rad` }]
        }]}>
          {slices.map((slice, index) => {
            const angle = (360 / slices.length) * index
            return (
              <View
                key={slice.id}
                style={[
                  styles.wheelSlice,
                  {
                    backgroundColor: slice.color,
                    transform: [{ rotate: `${angle}deg` }],
                  }
                ]}
              >
                {slice.image?.url && (
                  <View style={styles.sliceImageContainer}>
                    {imageLoadStates[slice.id] === 'loading' && (
                      <Text style={styles.loadingText}>Loading...</Text>
                    )}
                    {imageLoadStates[slice.id] === 'loaded' && slice.image.isLoaded && (
                      <Image
                        source={{ uri: slice.image.url }}
                        style={styles.sliceImage}
                        resizeMode="cover"
                        onError={() => {
                          setImageLoadStates(prev => ({ ...prev, [slice.id]: 'error' }))
                        }}
                        onLoad={() => {
                          setImageLoadStates(prev => ({ ...prev, [slice.id]: 'loaded' }))
                        }}
                      />
                    )}
                    {imageLoadStates[slice.id] === 'error' && (
                      <View style={styles.imagePlaceholder}>
                        <Ionicons name="image" size={20} color="#fff" />
                      </View>
                    )}
                  </View>
                )}
                <Text style={[styles.sliceText, {
                  transform: [{ rotate: `${-angle}deg` }]
                }]}>
                  {slice.text}
                </Text>
              </View>
            )
          })}
        </View>

        {/* Center circle */}
        <View style={[styles.centerCircle, {
          backgroundColor: wheelTheme.accent,
          borderColor: wheelTheme.primary
        }]}>
          <Text style={{ fontSize: 24 }}></Text>
        </View>

        {/* Pointer */}
        <View style={[styles.pointer, {
          borderRightColor: '#000000'
        }]} />
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.spinButton, {
            backgroundColor: isSpinning ? theme.textSecondary : wheelTheme.primary,
            opacity: isSpinning ? 0.6 : 1,
          }]}
          onPress={spinWheel}
          disabled={isSpinning || disabled}
        >
          <Ionicons name="refresh" size={20} color={wheelTheme.accent} />
          <Text style={[styles.spinButtonText, { color: wheelTheme.accent }]}>
            {isSpinning ? "Spinning..." : "Spin Wheel"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.editButton, {
            borderColor: wheelTheme.primary
          }]}
          onPress={() => setIsEditingImages(true)}
          disabled={isSpinning || disabled}
        >
          <Ionicons name="images" size={20} color={wheelTheme.primary} />
          <Text style={[styles.editButtonText, { color: wheelTheme.primary }]}>
            Add Images
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resetButton, {
            borderColor: wheelTheme.primary
          }]}
          onPress={resetWheel}
          disabled={isSpinning}
        >
          <Ionicons name="refresh" size={20} color={wheelTheme.primary} />
          <Text style={[styles.resetButtonText, { color: wheelTheme.primary }]}>
            Reset
          </Text>
        </TouchableOpacity>
      </View>

      {/* Winner Popup */}
      <Modal
        visible={showWinnerPopup}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWinnerPopup(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.winnerModal, { backgroundColor: theme.surface }]}>
            <View style={styles.winnerHeader}>
              <Text style={[styles.winnerTitle, { color: theme.text }]}>🎉 Winner! 🎉</Text>
            </View>

            {winners.length > 0 && (
              <View style={styles.winnerContent}>
                {winners[0].image?.url && (
                  <View style={styles.winnerImageContainer}>
                    <View style={styles.winnerImagePlaceholder}>
                      <Ionicons name="image" size={40} color="#fff" />
                    </View>
                  </View>
                )}
                <Text style={[styles.winnerText, { color: theme.text }]}>
                  {winners[0].text}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.closeWinnerButton, { backgroundColor: wheelTheme.primary }]}
              onPress={() => setShowWinnerPopup(false)}
            >
              <Text style={[styles.closeWinnerText, { color: wheelTheme.accent }]}>
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Image Editing Modal - Updated to match OrganizerLiveRoomScreen pattern */}
      <Modal
        visible={isEditingImages}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditingImages(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.editModal, { backgroundColor: theme.surface }]}>
            <View style={styles.editHeader}>
              <Text style={[styles.editTitle, { color: theme.text }]}>Image URLs ({Object.values(imageUrls).filter(url => url.trim()).length}/5)</Text>
              <TouchableOpacity
                onPress={() => setIsEditingImages(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editContent}>
              <Text style={[styles.itemsDescription, { color: theme.textSecondary }]}>
                Paste image URLs for each wheel slot. Images will be displayed on the wheel.
              </Text>

              {/* Image URL Inputs - Direct input like OrganizerLiveRoomScreen */}
              {[1, 2, 3, 4, 5].map((slotNumber) => {
                const slotKey = `image-${slotNumber}`;
                return (
                  <View key={slotKey} style={{ marginBottom: 16 }}>
                    <Text style={{
                      fontSize: Dimensions.get('window').width * 0.035,
                      fontWeight: '600',
                      color: theme.text,
                      marginBottom: 8
                    }}>
                      Image {slotNumber}
                    </Text>
                    <TextInput
                      style={[styles.urlInput, {
                        borderColor: theme.border,
                        color: theme.text,
                        backgroundColor: '#f8fafc'
                      }]}
                      value={imageUrls[slotKey]}
                      onChangeText={(text) => handleImageUrlChange(slotKey, text)}
                      placeholder={`Paste image URL for slot ${slotNumber}...`}
                      placeholderTextColor={theme.textSecondary}
                      maxLength={10000} // Increased to support data URLs and long image URLs
                      multiline={true} // Allow multiline for long URLs
                      numberOfLines={2} // Show 2 lines by default
                      onSubmitEditing={() => {
                        // Handle URL submission with validation
                        const url = imageUrls[slotKey].trim();
                        if (url) {
                          // Enhanced URL validation - allow data URLs
                          if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
                            Alert.alert('Invalid URL', 'Please enter a valid URL starting with http://, https://, or data:');
                            return;
                          }

                          Alert.alert('Success', `Image URL ${slotNumber} updated!`);
                        }
                      }}
                    />
                    {imageUrls[slotKey].trim() && (
                      <Text style={{
                        fontSize: Dimensions.get('window').width * 0.028,
                        color: theme.textSecondary,
                        marginTop: 4,
                        fontStyle: 'italic'
                      }}>
                        URL set ✓
                      </Text>
                    )}
                  </View>
                );
              })}

              {/* Action Buttons */}
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={[styles.wheelActionButton, styles.resetButton]}
                  onPress={clearAllImages}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="refresh"
                    size={Dimensions.get('window').width * 0.04}
                    color={theme.text}
                  />
                  <Text style={styles.actionButtonText}>Clear All</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.wheelActionButton]}
                  onPress={() => setIsEditingImages(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="checkmark"
                    size={Dimensions.get('window').width * 0.04}
                    color={theme.text}
                  />
                  <Text style={styles.actionButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confetti */}
      {showConfetti && (
        <ConfettiCannon
          count={200}
          origin={{ x: width / 2, y: height / 2 }}
          fadeOut
          autoStart
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },
  wheelContainer: {
    width: Math.min(width * 0.85, 320),
    height: Math.min(width * 0.85, 320),
    borderRadius: Math.min(width * 0.85, 320) / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 30,
  },
  wheelVisualization: {
    width: '100%',
    height: '100%',
    borderRadius: Math.min(width * 0.85, 320) / 2,
    position: 'relative',
    overflow: 'hidden',
  },
  wheelSlice: {
    position: 'absolute',
    width: '50%',
    height: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    right: 0,
    top: 0,
    transformOrigin: 'bottom left',
    overflow: 'hidden',
  },
  sliceImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliceImage: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  imagePlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 10,
    fontWeight: 'bold',
  },
  sliceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  centerCircle: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointer: {
    position: 'absolute',
    top: '50%',
    left: 293,
    marginTop: -10,
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderRightWidth: 20,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  controlsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
  },
  spinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  spinButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    backgroundColor: 'transparent',
    gap: 8,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    backgroundColor: 'transparent',
    gap: 8,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  winnerModal: {
    margin: 20,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    maxWidth: 300,
    width: '90%',
  },
  winnerHeader: {
    marginBottom: 20,
  },
  winnerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  winnerContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  winnerImageContainer: {
    marginBottom: 15,
  },
  winnerImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#8e0b16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerText: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  closeWinnerButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  closeWinnerText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  editModal: {
    margin: 20,
    borderRadius: 20,
    maxHeight: height * 0.8,
    width: isTablet ? '60%' : '90%',
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  editTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  editContent: {
    padding: 20,
  },
  sliceCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  sliceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sliceColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 10,
  },
  sliceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  removeButton: {
    padding: 5,
  },
  imageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageStatus: {
    fontSize: 14,
  },
  removeImageButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ff4444',
    borderRadius: 6,
  },
  removeImageText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  imageInputContainer: {
    gap: 10,
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  imageButton: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addSliceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
  },
  addSliceText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  applyAllButton: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 15,
  },
  applyAllText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemsDescription: {
    fontSize: Dimensions.get('window').width * 0.035,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: Dimensions.get('window').width * 0.045,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Dimensions.get('window').width * 0.02,
    marginBottom: 16,
  },
  wheelActionButton: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: Dimensions.get('window').height * 0.015,
    paddingHorizontal: Dimensions.get('window').width * 0.03,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: Dimensions.get('window').height * 0.06,
  },
  actionButtonText: {
    fontSize: Dimensions.get('window').width * 0.032,
    fontWeight: '600',
    color: '#1e293b',
  },
})

export default ImagePickerWheel
