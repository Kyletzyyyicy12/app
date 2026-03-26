import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native"
import * as Haptics from "expo-haptics"
import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
  TextInput,
  Easing,
  Platform,
} from "react-native"

import ConfettiCannon from "react-native-confetti-cannon"
import { db } from "../config/firebaseConfig"
import { doc, getDoc, updateDoc, collection, addDoc, getDocs, increment, serverTimestamp, query, where, orderBy, onSnapshot } from "firebase/firestore" // cspell:disable-line
import { useAuth } from "../contexts/AuthContext"
import { useTheme } from "../contexts/ThemeContext"
import * as Sharing from "expo-sharing"
import * as Clipboard from "expo-clipboard"
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import * as XLSX from 'xlsx'

import QRCode from '../components/QRCodeWrapper'
import ReferenceWheel from '../components/ReferenceWheel'
import SpinningWheel from '../components/SpinningWheel'
import ImagePickerWheel from '../components/ImagePickerWheel'
import CrossPlatformSessionManager from '../utils/CrossPlatformSessionManager'
import AutoSpinSettings, { AutoSpinConfig, AutoSpinState } from '../components/AutoSpinSettings'
import { calculateUnifiedWinner } from '../utils/WheelSynchronizationUtils'

// Enhanced real-time synchronization state
interface SpinData {
  spinDuration: number
  totalRotation: number
  finalAngle: number
  spins: number
  winners: Participant[]
  completedAt?: number
}

// Theme palettes used in settings modal (extracted from JSX for better TS transpilation)
const THEME_PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Vibrant', colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFE66D', '#DDA0DD'] },
  { name: 'Sunset', colors: ['#ff9a9e', '#fad0c4', '#fbc2eb', '#a18cd1', '#f6d365', '#fda085'] },
  { name: 'Forest', colors: ['#2E8B57', '#3CB371', '#228B22', '#6B8E23', '#8FBC8F', '#2F4F4F'] },
  { name: 'Mono', colors: ['#111', '#333', '#555', '#777', '#999', '#BBB'] },
]

const { width, height } = Dimensions.get("window")

// Performance and responsive design optimizations
const isSmallDevice = width < 375
const isLargeDevice = width > 428
const devicePixelRatio = Dimensions.get("screen").scale || 1

// Adaptive wheel size based on device
const getAdaptiveWheelSize = () => {
  if (isSmallDevice) return Math.min(width * 0.85, 300)
  if (isLargeDevice) return Math.min(width * 0.85, 420)
  return Math.min(width * 0.85, 380)
}

// Adaptive text scaling
const getAdaptiveFontSize = (baseSize: number) => {
  const scale = Math.min(width / 375, height / 667) // Base iPhone 6/7/8 dimensions
  return Math.max(baseSize * scale, baseSize * 0.8) // Minimum 80% of base size
}

interface WheelSlice {
  id: string
  text: string
  color: string
  emoji?: string
  isWinner?: boolean
  category?: string // Added category for filtering
}

interface Participant {
  id: string
  name: string
  email?: string
  isSelected?: boolean
}

interface WheelConfig {
  id: string
  name: string
  slices: WheelSlice[]
  settings: {
    spinTime: number
    textSize: number
    sliceLayers: number
    unsaveMode: boolean
    autoHide: boolean
  }
  spins?: number
  used?: number
  userId?: string
  live?: boolean
  liveJoinCode?: string | null
  type?: string
}

interface WheelType {
  id: string
  name: string
  description: string
  icon: string
  color: string
  defaultSlices: string[]
}

const WheelScreen: React.FC = () => {
  const route = useRoute()
  const navigation = useNavigation()
  const { theme } = useTheme()
  const { currentUser, authLoading, userProfile } = useAuth()

  const spinValue = useRef(new Animated.Value(0)).current
  const arrowSpinValue = useRef(new Animated.Value(0)).current
  
  // Enhanced animation refs for requestAnimationFrame-based spinning
  const animationRef = useRef<number | null>(null)
  const spinCompletionRef = useRef(false)
  const spinStartTime = useRef<number>(0)
  const lastSpinTimestamp = useRef<number>(0)

  const [isSpinning, setIsSpinning] = useState(false)
  const [isSpinCompleting, setIsSpinCompleting] = useState(false)
  const [spinError, setSpinError] = useState<string | null>(null)
  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const [winners, setWinners] = useState<string[]>([])
  const [numberOfWinners, setNumberOfWinners] = useState(1)
  const [currentSpinCount, setCurrentSpinCount] = useState(0)
  const [allWinners, setAllWinners] = useState<string[]>([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [usedSlices, setUsedSlices] = useState<string[]>([])
  const [wheelSlices, setWheelSlices] = useState<WheelSlice[]>([])
  const [wheelName, setWheelName] = useState("Loading Wheel...")
  const [isLoading, setIsLoading] = useState(true)
  const [currentWheelConfig, setCurrentWheelConfig] = useState<WheelConfig | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [enablePreviewEditing, setEnablePreviewEditing] = useState(true)
  const [customMessage, setCustomMessage] = useState("Well done, [Name]!")
  // State for tracking spin completion (same pattern as OrganizerLiveRoomScreen)
  const [spinCompleted, setSpinCompleted] = useState(false)
  const [showWinnerModal, setShowWinnerModal] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [resultLayout, setResultLayout] = useState<'popup' | 'confetti'>('popup')
  // Removed category filter; settings will replace it
  const [excludePreviousWinners, setExcludePreviousWinners] = useState<boolean>(false)
  const [showPreviousWinners, setShowPreviousWinners] = useState<boolean>(true)
  const [liveJoinCode, setLiveJoinCode] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveSectionMinimized, setLiveSectionMinimized] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSlice, setEditingSlice] = useState<WheelSlice | null>(null)
  const [editText, setEditText] = useState('')
  const [spinBehavior, setSpinBehavior] = useState<'normal' | 'fast' | 'slow'>('normal')
  const [spinCount, setSpinCount] = useState(1)
  const [teamMode, setTeamMode] = useState(false)
  const [numGroups, setNumGroups] = useState(2)
  const [groupSize, setGroupSize] = useState<number | null>(null)
  const [generatedTeams, setGeneratedTeams] = useState<string[][]>([])
  const [pointerStyle, setPointerStyle] = useState<'teardrop' | 'triangle'>('teardrop')
  const [pointerColor, setPointerColor] = useState<string>("#8E0B16")
  const [distributionMode, setDistributionMode] = useState<'default' | 'gender' | 'label'>('default')
  
  // Items Management State
  const [showItemsModal, setShowItemsModal] = useState(false)
  const [itemsHidden, setItemsHidden] = useState(false)
  const [customCongratulationMessage, setCustomCongratulationMessage] = useState('Congratulations! 🎉')
  const [spinModeType, setSpinModeType] = useState<'random' | 'manual'>('random')
  const [numRandomWinners, setNumRandomWinners] = useState(1)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemText, setEditingItemText] = useState('')

  // Research Participant Selection State
  const [researchParticipants, setResearchParticipants] = useState<Participant[]>([])
  const [showResearchSelection, setShowResearchSelection] = useState(false)
  const [researchStudentsToSelect, setResearchStudentsToSelect] = useState(10)
  const [isResearchMode, setIsResearchMode] = useState(false)

  // Theme state for wheel customization
  const [wheelTheme, setWheelTheme] = useState({
    primary: "#8E0B16",
    secondary: "#C41E3A",
    accent: "#A71930",
    background: "#6F0B13",
    thirdColor: "#D32F2F",
    fourthColor: "#B71C1C"
  })
  const [pickRepresentative, setPickRepresentative] = useState<boolean>(false)
  const [currentWheelType, setCurrentWheelType] = useState<string>('picker')
  const [organizerMode, setOrganizerMode] = useState<boolean>(false)

  // Auto-spin functionality state
  const [showAutoSpinSettings, setShowAutoSpinSettings] = useState(false)
  const [autoSpinConfig, setAutoSpinConfig] = useState<AutoSpinConfig>({
    enabled: false,
    interval: 5, // seconds between spins
    maxSpins: 5, // maximum number of auto-spins
    autoReset: false, // reset winners after each spin
    pauseOnWinner: false, // pause when winner is selected
    spinDuration: 3, // how long each spin lasts
    showWinnerDelay: 2, // how long to show winner before next spin
    stopConditions: {
      maxDuration: 10, // max total duration in minutes
      onEmpty: true, // stop when no more participants
      onManual: true // allow manual stop
    }
  })
  const [autoSpinState, setAutoSpinState] = useState<AutoSpinState>({
    isRunning: false,
    currentSpinCount: 0,
    startTime: 0,
    elapsedTime: 0,
    remainingParticipants: 0
  })
  const [autoSpinTimeoutId, setAutoSpinTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const [autoSpinIntervalId, setAutoSpinIntervalId] = useState<NodeJS.Timeout | null>(null)

  // Real-time synchronization state for SpinningWheel
  const [isWheelSpinning, setIsWheelSpinning] = useState(false)
  const [spinDuration, setSpinDuration] = useState(3000)
  const [totalRotation, setTotalRotation] = useState(0)
  const [finalAngle, setFinalAngle] = useState(0)
  const [spins, setSpins] = useState(5)
  const [wheelWinners, setWheelWinners] = useState<WheelSlice[]>([])
  const [resetPosition, setResetPosition] = useState<number | undefined>(undefined)
  const shouldResetWheel = useRef(false)

  // Color Theme Definitions
  const colorThemes = [
    {
      id: 'maroon',
      name: 'Maroon (School)',
      colors: ['#8E0B16', '#C41E3A', '#A71930', '#6F0B13', '#D32F2F', '#B71C1C']
    },
    {
      id: 'rainbow',
      name: 'Rainbow Bright',
      colors: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3']
    },
    {
      id: 'neon',
      name: 'Neon Electric',
      colors: ['#39FF14', '#FF006E', '#00D9FF', '#FFD60A', '#FF10F0', '#FFF94C']
    },
    {
      id: 'ocean',
      name: 'Ocean Depths',
      colors: ['#001F3F', '#0074D9', '#007EFF', '#39CCCC', '#17FF9E', '#61DAFB']
    },
    {
      id: 'sunset',
      name: 'Sunset Blaze',
      colors: ['#FF6B35', '#F7931E', '#FDB833', '#FDD835', '#FF5722', '#E64A19']
    },
    {
      id: 'purple',
      name: 'Purple Galaxy',
      colors: ['#6A0572', '#9D4EDD', '#C77DFF', '#E0AAFF', '#3A0CA3', '#7209B7']
    },
    {
      id: 'emerald',
      name: 'Emerald Forest',
      colors: ['#1B4332', '#2D6A4F', '#40916C', '#52B788', '#74C69D', '#95D5B2']
    },
    {
      id: 'hotpink',
      name: 'Hot Pink',
      colors: ['#FF1493', '#FF69B4', '#FFB6D9', '#FF00FF', '#FF007F', '#FF1E90']
    },
    {
      id: 'gold',
      name: 'Golden Luxury',
      colors: ['#FFD700', '#FFC700', '#FFB700', '#FFA500', '#FF8C00', '#FF7F00']
    },
    {
      id: 'cyber',
      name: 'Cyber Blue',
      colors: ['#0A0E27', '#0F3460', '#16213E', '#00B4D8', '#00D4FF', '#0096FF']
    },
    {
      id: 'fireice',
      name: 'Fire & Ice',
      colors: ['#FF0000', '#FF4500', '#1E90FF', '#00BFFF', '#FFD700', '#00CED1']
    },
    {
      id: 'lime',
      name: 'Lime Splash',
      colors: ['#CDDC39', '#7CB342', '#33691E', '#9CCC65', '#C6FF00', '#AEEA00']
    },
    {
      id: 'midnight',
      name: 'Midnight Dark',
      colors: ['#0B1929', '#1A2332', '#253341', '#4A5F7F', '#7E8FA3', '#2C3E50']
    },
    {
      id: 'candy',
      name: 'Cotton Candy',
      colors: ['#FFB6D9', '#FF69B4', '#FFB0FF', '#FF1493', '#FFC0CB', '#FFE4E1']
    },
    {
      id: 'volcanic',
      name: 'Volcanic Orange',
      colors: ['#FF6347', '#FF4500', '#FF8C00', '#FFA500', '#FFB347', '#CD5C5C']
    },
    {
      id: 'arctic',
      name: 'Arctic Frost',
      colors: ['#E0F7FF', '#B3E5FC', '#81D4FA', '#4FC3F7', '#29B6F6', '#03A9F4']
    },
    {
      id: 'tropical',
      name: 'Tropical Sunset',
      colors: ['#FF5E78', '#FF6B9D', '#FF8A80', '#FFD54F', '#FFE082', '#FFCA28']
    },
    {
      id: 'royal',
      name: 'Royal Crown',
      colors: ['#4B0082', '#6A0572', '#8B008B', '#9932CC', '#BA55D3', '#DA70D6']
    }
  ]

  const [currentThemeId, setCurrentThemeId] = useState('maroon')
  const [showThemeModal, setShowThemeModal] = useState(false)

  // Live Session Management States for Organizers
  const [liveParticipants, setLiveParticipants] = useState<any[]>([])
  const [liveComments, setLiveComments] = useState<any[]>([])
  const [showLiveSessionManager, setShowLiveSessionManager] = useState(false)
  const [isLiveSessionMinimized, setIsLiveSessionMinimized] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  // Function to handle wheel type changes
  const handleWheelTypeChange = async (newWheelType: WheelType) => {
    try {
      const confirmChange = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Change Wheel Type',
          `Change to ${newWheelType.name}? This will replace current slices with default slices.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Change', onPress: () => resolve(true) }
          ]
        )
      })

      if (!confirmChange) return

      // Create new slices based on the selected wheel type
      const newSlices = newWheelType.defaultSlices.map((text, index) => ({
        id: `slice_${index}_${Date.now()}`,
        text,
        color: getSliceColor(index, newWheelType.defaultSlices.length),
        emoji: ''
      }))

      // Update local state
      setWheelSlices(newSlices)
      setCurrentWheelType(newWheelType.id)
      setWheelName(newWheelType.name)

      // Enable team mode if it's a team wheel
      setTeamMode(newWheelType.id === 'team')

      // Update Firestore if wheel exists
      if (currentWheelConfig?.id) {
        const wheelDocRef = doc(collection(db, 'wheels'), currentWheelConfig.id)
        await updateDoc(wheelDocRef, {
          name: newWheelType.name,
          icon: newWheelType.icon,
          color: newWheelType.color,
          slices: newSlices.map(s => ({ id: s.id, text: s.text, color: s.color })),
          type: newWheelType.id,
          lastModified: serverTimestamp()
        })

        // Update current wheel config
        setCurrentWheelConfig(prev => prev ? {
          ...prev,
          name: newWheelType.name,
          slices: newSlices
        } : null)
      }

      Alert.alert('Success', `Wheel changed to ${newWheelType.name}!`)
    } catch (error) {
      console.error('Error changing wheel type:', error)
      Alert.alert('Error', 'Failed to change wheel type. Please try again.')
    }
  }

  // Handle color theme change
  const handleThemeChange = (themeId: string) => {
    const selectedTheme = colorThemes.find(t => t.id === themeId)
    if (!selectedTheme) return

    setCurrentThemeId(themeId)
    
    // Update wheel theme with ALL colors from the selected theme
    const newTheme = {
      primary: selectedTheme.colors[0],
      secondary: selectedTheme.colors[1] || selectedTheme.colors[0],
      accent: selectedTheme.colors[2] || selectedTheme.colors[0],
      background: selectedTheme.colors[3] || selectedTheme.colors[0],
      thirdColor: selectedTheme.colors[4] || selectedTheme.colors[0],
      fourthColor: selectedTheme.colors[5] || selectedTheme.colors[0]
    }
    
    setWheelTheme(newTheme)
    setShowThemeModal(false)

    // Re-apply colors to current wheel slices using EXACT theme colors
    if (wheelSlices.length > 0) {
      const updatedSlices = wheelSlices.map((slice, index) => ({
        ...slice,
        color: selectedTheme.colors[index % selectedTheme.colors.length]
      }))
      setWheelSlices(updatedSlices)
    }
  }

  const getSliceColor = (index: number, total: number, theme?: typeof wheelTheme) => {
    // ALWAYS use theme colors - no fallbacks to white or other colors
    const themeToUse = theme || wheelTheme
    
    // Use all 6 colors from the theme, cycling through them
    const themeColors = [
      themeToUse.primary,
      themeToUse.secondary,
      themeToUse.accent,
      themeToUse.background,
      themeToUse.thirdColor,
      themeToUse.fourthColor
    ]
    
    return themeColors[index % themeColors.length]
  }

  // Research Participant Functions
  const downloadResearchTemplate = async () => {
    try {
      const templateData = [
        ['Name', 'Email'],
        ['Student 1', 'student1@email.com'],
        ['Student 2', 'student2@email.com'],
        ['Student 3', 'student3@email.com'],
      ]
      
      const csv = templateData.map(row => row.join(',')).join('\n')
      
      // Share directly without saving to file
      await Sharing.shareAsync('data:text/csv;base64,' + btoa(csv), {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      })
    } catch (error) {
      console.error('Error downloading template:', error)
      Alert.alert('Error', 'Failed to download template')
    }
  }

  const parseResearchCSV = async (fileUri: string) => {
    try {
      const content = await FileSystem.readAsStringAsync(fileUri)
      const lines = content.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        Alert.alert('Error', 'CSV file must have at least a header and one data row')
        return
      }

      const participants: Participant[] = []
      // Skip header row (index 0)
      for (let i = 1; i < lines.length; i++) {
        const [name, email] = lines[i].split(',').map(field => field.trim())
        if (name) {
          participants.push({
            id: `participant_${i}_${Date.now()}`,
            name,
            email: email || '',
            isSelected: false
          })
        }
      }

      setResearchParticipants(participants)
      setResearchStudentsToSelect(Math.min(10, participants.length))
      Alert.alert('Success', `${participants.length} participants loaded from CSV`)
    } catch (error) {
      console.error('Error parsing CSV:', error)
      Alert.alert('Error', 'Failed to parse CSV file')
    }
  }

  const handleResearchTemplateUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv'
      })
      
      if (!result.canceled && result.assets[0]) {
        await parseResearchCSV(result.assets[0].uri)
      }
    } catch (error) {
      console.error('Error picking document:', error)
      Alert.alert('Error', 'Failed to select file')
    }
  }

  const loadWheelData = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(false)
      Alert.alert("Authentication Required", "Please log in to view wheels.")
      navigation.goBack()
      return
    }

    setIsLoading(true)
    try {
      const params = route.params as any
      const wheelId = params?.wheelId

      if (wheelId && typeof wheelId === 'string' && wheelId.trim() !== '') {
        const wheelDocRef = doc(collection(db, "wheels"), wheelId)
        const wheelDoc = await getDoc(wheelDocRef)

        if (wheelDoc.exists()) {
          const wheelData = { id: wheelDoc.id, ...wheelDoc.data() } as WheelConfig
          if (wheelData.userId && currentUser.uid && wheelData.userId !== currentUser.uid) {
            Alert.alert("Access Denied", "You do not have permission to view this wheel.")
            navigation.goBack()
            return
          }
          setWheelName(wheelData.name)
          setWheelSlices(wheelData.slices)
          setCurrentWheelConfig(wheelData)
          setCurrentWheelType((wheelData as any).type || 'picker')

          if ((wheelData as any).type === 'team') {
            setTeamMode(true)
          }
        } else {
          Alert.alert("Error", "Wheel not found.")
          navigation.goBack()
        }
      } else {
        Alert.alert("Error", "No wheel ID provided.")
        navigation.goBack()
      }
    } catch (error) {
      console.error("Error loading wheel data:", error)
      Alert.alert("Error", "Failed to load wheel data.")
      navigation.goBack()
    } finally {
      setIsLoading(false)
    }
  }, [route.params, navigation, currentUser])

  useEffect(() => {
    if (wheelSlices.length > 0) {
      const updatedSlices = wheelSlices.map((slice, index) => ({
        ...slice,
        color: getSliceColor(index, wheelSlices.length, wheelTheme)
      }))
      setWheelSlices(updatedSlices)
    }
  }, [wheelTheme])

  useFocusEffect(
    useCallback(() => {
      if (currentUser && !authLoading) {
        loadWheelData()
      } else if (!currentUser && !authLoading) {
        setIsLoading(false)
        setWheelSlices([])
        setWheelName("No Wheel Loaded")
      }
    }, [loadWheelData, currentUser, authLoading]),
  )

  // Cleanup animation on component unmount
  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [])

  // Handle spin completion (same pattern as OrganizerLiveRoomScreen)
  const handleSpinComplete = (result: any) => {
    // Safety check: Don't process if already completed
    if (spinCompleted) {
      console.log('⚠️ Spin already processed')
      return
    }

    // Immediately mark as completed to prevent double-processing
    setSpinCompleted(true)

    try {
      console.log('✅ Spin completed, result:', result)
      
      // Stop wheel spinning immediately - DO NOT RESET POSITION
      setIsSpinning(false)
      setIsWheelSpinning(false)

      // Extract winners from result or fallback
      const winnerList = result?.winners || [result?.winner] || winners || []
      const winnerObjects = (Array.isArray(winnerList) ? winnerList : [winnerList])
        .filter((w: any) => w)
        .map((winner: any, index: number) => ({
          id: `winner-${Date.now()}-${index}`,
          name: typeof winner === 'string' ? winner : winner.text || winner.name || 'Winner'
        }))

      console.log('🎯 Winners extracted:', winnerObjects)

      // Show winner immediately (no delay needed)
      setWinners(winnerObjects.map(w => w.name))
      setShowWinnerModal(true)
      setShowConfetti(true)

      // Auto-hide confetti after 3 seconds
      setTimeout(() => {
        setShowConfetti(false)
      }, 3000)

      // Update Firestore if wheel config exists
      if (currentWheelConfig?.id) {
        try {
          const wheelDocRef = doc(collection(db, "wheels"), currentWheelConfig.id)
          updateDoc(wheelDocRef, {
            spins: increment(1),
            used: increment(1),
            lastWinner: winnerObjects[0]?.name || 'Unknown',
            updatedAt: serverTimestamp()
          }).catch((error) => {
            console.error("Error updating Firestore:", error)
          })
        } catch (error) {
          console.error("Error updating Firestore:", error)
        }
      }

      // Reset spin completion flag after showing winner (allows next spin)
      setTimeout(() => {
        setSpinCompleted(false)
      }, 500) // Reset after 500ms to allow next spin
    } catch (error) {
      console.error('Error handling spin completion:', error)
      setSpinCompleted(false)
      setIsSpinning(false)
    }
  }

  // Reset spin state between spins
  const resetSpinState = () => {
    // Only close the modal, don't affect the display of new results
    // IMPORTANT: DO NOT reset wheel position - let it stay on the winner
    setShowWinnerModal(false)
  }

  const spinWheel = async () => {
    const currentTime = Date.now()
    const MIN_SPIN_INTERVAL = 4500 // Increased to allow full spin completion

    // Guards to prevent race conditions
    if (isSpinning || wheelSlices.length < 2) {
      console.log('⚠️ Spin already in progress or not enough items')
      return
    }

    if (currentTime - lastSpinTimestamp.current < MIN_SPIN_INTERVAL) {
      const remainingTime = MIN_SPIN_INTERVAL - (currentTime - lastSpinTimestamp.current)
      console.log(`⚠️ Spin rate limited - ${remainingTime}ms remaining`)
      return
    }

    if (!currentUser) {
      Alert.alert('Authentication Required', 'Please log in to spin the wheel.')
      return
    }

    // Reset modal states only (not spinning states)
    resetSpinState()
    
    // Mark spin as starting and NOT completed
    setSpinCompleted(false)
    lastSpinTimestamp.current = currentTime

    // 🎯 CONSISTENT SPIN PARAMETERS - Fixed duration for reliable spinning
    const SPIN_DURATION_MS = 4000 // Consistent 4 second spin for reliability
    const numberOfFullSpins = 8 + Math.floor(Math.random() * 4) // 8-11 full rotations (more dramatic)
    const randomAngle = Math.random() * 360 // Random angle in degrees (0-360)
    
    // Calculate total rotation in DEGREES (not radians)
    const totalRotationDegrees = numberOfFullSpins * 360 + randomAngle
    
    // Convert to radians for the unified winner calculation
    const totalRotationRadians = (totalRotationDegrees * Math.PI) / 180
    
    // 🎯 USE UNIFIED CALCULATION FOR PERFECT ACCURACY
    const { winner, winningIndex } = calculateUnifiedWinner(totalRotationRadians, wheelSlices.map(s => s.text))

    console.log('🎯 SPIN INITIATED (CONSISTENT & RELIABLE):', {
      winner,
      winningIndex,
      spinDuration: `${SPIN_DURATION_MS / 1000}s`,
      totalRotationDegrees: totalRotationDegrees.toFixed(2),
      numberOfFullSpins,
      wheelItems: wheelSlices.length,
      timestamp: currentTime
    })

    // Set all animation state at once - CRITICAL: All in one update batch
    setIsSpinning(true)
    setIsWheelSpinning(true)
    setSpinDuration(SPIN_DURATION_MS) // Consistent duration
    setTotalRotation(totalRotationDegrees) // Set in degrees for animation
    setFinalAngle(randomAngle) // Final angle in degrees (0-360)
    setSpins(numberOfFullSpins)
    
    // Set the winner slice for display
    const winnerSlice = wheelSlices[winningIndex]
    setWheelWinners([winnerSlice])
    setWinners([winner])
  }

  if (isLoading || authLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading wheel...</Text>
        </View>
      </SafeAreaView>
    )
  }

  const isTeamWheel = (currentWheelConfig as any)?.type === 'team'

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{wheelName}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Main Content Container */}
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Winner Selector Section (hidden for Team wheels) */}
        {!isTeamWheel && (
          <View style={[styles.winnerSection, { backgroundColor: theme.surface }]}>
            <View style={styles.winnerSelectorRow}>
              <Ionicons name="trophy" size={20} color={theme.primary} />
              <Text style={[styles.winnerLabel, { color: theme.text }]}>Number of Winners:</Text>
              <View style={styles.winnerControls}>
                <TouchableOpacity
                  style={[styles.winnerButton, { borderColor: theme.primary }]}
                  onPress={() => setNumberOfWinners(Math.max(1, numberOfWinners - 1))}
                >
                  <Ionicons name="remove" size={18} color={theme.primary} />
                </TouchableOpacity>
                <Text style={[styles.winnerCount, { color: theme.text }]}>
                  {numberOfWinners}
                </Text>
                <TouchableOpacity
                  style={[styles.winnerButton, { borderColor: theme.primary }]}
                  onPress={() => setNumberOfWinners(numberOfWinners + 1)}
                >
                  <Ionicons name="add" size={18} color={theme.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Wheel Display Section */}
        <View style={styles.wheelDisplaySection}>
          {currentWheelType === 'image-picker' ? (
            <ImagePickerWheel
              slices={wheelSlices}
              onSpinComplete={(result) => {
                console.log('🎯 ImagePickerWheel spin completed:', result)
                if (result.winners && result.winners.length > 0) {
                  const winner = result.winners[0]
                  setWinners([typeof winner === 'string' ? winner : winner.text || winner.name || 'Winner'])
                  setShowWinnerModal(true)
                  setShowConfetti(true)
                  setTimeout(() => setShowConfetti(false), 3000)
                }
              }}
              wheelTitle={wheelName}
              isSoloMode={!isLive}
              sessionId={currentSessionId || undefined}
              organizerMode={organizerMode}
            />
          ) : (
            <View style={styles.wheelContainer}>
              <SpinningWheel
                slices={wheelSlices}
                size={getAdaptiveWheelSize()}
                showLabels={true}
                isSpinning={isWheelSpinning}
                winners={wheelWinners}
                onSpinComplete={() => {
                  console.log('✅ SpinningWheel animation completed, calling handleSpinComplete')
                  handleSpinComplete({ winners })
                }}
                spinDuration={spinDuration}
                totalRotation={totalRotation}
                finalAngle={finalAngle}
                spins={spins}
                theme={wheelTheme}
                resetPosition={resetPosition}
              />
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => setShowPreview(true)}
          >
            <Ionicons name="eye-outline" size={20} color={theme.primary} />
            <Text style={[styles.actionButtonText, { color: theme.primary }]}>Preview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => setWheelSlices(prev => {
              const arr = [...prev]
              for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                ;[arr[i], arr[j]] = [arr[j], arr[i]]
              }
              return arr
            })}
          >
            <Ionicons name="shuffle-outline" size={20} color={theme.primary} />
            <Text style={[styles.actionButtonText, { color: theme.primary }]}>Shuffle</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => {
              // Only reset when user explicitly clicks the reset button
              shouldResetWheel.current = true
              setIsWheelSpinning(false)
              setResetPosition(0)
              setSpinDuration(3000)
              setTotalRotation(0)
              setFinalAngle(0)
              setSpins(5)
              setWheelWinners([])
              setShowWinnerModal(false)
              setShowConfetti(false)
              // Clear the reset flag after a moment
              setTimeout(() => {
                shouldResetWheel.current = false
                setResetPosition(undefined)
              }, 500)
            }}
          >
            <Ionicons name="refresh-outline" size={20} color={theme.primary} />
            <Text style={[styles.actionButtonText, { color: theme.primary }]}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Spin Button (hidden for Team wheels and Image Picker wheels) */}
        {!isTeamWheel && currentWheelType !== 'image-picker' && (
          <View style={styles.spinButtonSection}>
            <TouchableOpacity
              style={[styles.snakeSpinButton, {
                backgroundColor: isSpinning ? theme.textSecondary : theme.primary,
                opacity: isSpinning ? 0.6 : 1,
              }]}
              onPress={spinWheel}
              disabled={isSpinning}
            >
              <Image
                source={require("../../assets/images/ulo.png")}
                style={styles.spinButtonSnake}
              />
              <Text style={[styles.snakeSpinButtonText, { color: theme.surface }]}>
                {isSpinning ? "🐍 Spinning..." : `🐍 Spin`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Controls Section */}
        <View style={[styles.controlsSection, { backgroundColor: theme.surface }]}>
          {/* Settings Section */}
          <View style={styles.soundToggleSection}>
            <View style={styles.settingsRow}>
              <Text style={[styles.soundLabel, { color: theme.text }]}>⚙️ Wheel Settings</Text>
              <TouchableOpacity 
                onPress={() => setShowSettingsModal(true)}
                style={{ padding: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' }}
              >
                <Ionicons name="settings-outline" size={getAdaptiveFontSize(20)} color={theme.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Color Theme Section */}
          <View style={styles.soundToggleSection}>
            <View style={styles.settingsRow}>
              <Text style={[styles.soundLabel, { color: theme.text }]}>🎨 Color Theme</Text>
              <TouchableOpacity 
                onPress={() => setShowThemeModal(true)}
                style={{ padding: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' }}
              >
                <Ionicons name="brush-outline" size={getAdaptiveFontSize(20)} color={theme.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Exclude Previous Winners Checkbox */}
          <TouchableOpacity
            onPress={() => setExcludePreviousWinners(v => !v)}
            style={styles.checkboxRow}
          >
            <View style={[styles.checkbox, {
              borderColor: theme.primary,
              backgroundColor: excludePreviousWinners ? theme.primary : 'transparent'
            }]}>
              {excludePreviousWinners && <Ionicons name="checkmark" size={16} color={theme.surface} />}
            </View>
            <Text style={[styles.checkboxText, { color: theme.text }]}>Exclude previous winners</Text>
          </TouchableOpacity>

          {/* Sound Effects Section */}
          <View style={styles.soundToggleSection}>
            <View style={styles.soundRow}>
              <Text style={[styles.soundLabel, { color: theme.text }]}>🔊 Sound Effects</Text>
              <TouchableOpacity 
                onPress={() => setSoundEnabled(v => !v)}
                style={{ padding: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' }}
              >
                <Ionicons
                  name={soundEnabled ? "volume-high" : "volume-mute"}
                  size={getAdaptiveFontSize(20)}
                  color={theme.primary}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Winner Modal */}
      <Modal visible={showWinnerModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Winner!</Text>
            {winners.length > 0 && (
              <Text style={[styles.modalWinner, { color: theme.text }]}>
                {winners[0]}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowWinnerModal(false)}
            >
              <Text style={[styles.closeButtonText, { color: theme.surface }]}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
      <Modal visible={showPreview} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Entries Preview</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {wheelSlices.map((slice, idx) => (
                <View key={slice.id || idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: slice.color }} />
                  <Text style={{ color: theme.text }}>{slice.text}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowPreview(false)}
            >
              <Text style={[styles.closeButtonText, { color: theme.surface }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettingsModal} transparent animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={{
              backgroundColor: theme.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 16,
              paddingHorizontal: isSmallDevice ? 12 : 16,
              paddingBottom: 16,
              height: '95%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.2,
              shadowRadius: 16,
              elevation: 12,
            }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 24, fontWeight: '800' }}>📋</Text>
                    <View>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Current Items</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: theme.primary }}>{wheelSlices.length} items</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity 
                  onPress={() => setItemsHidden(!itemsHidden)}
                  style={{ padding: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' }}
                >
                  <Ionicons name={itemsHidden ? "eye-off" : "eye"} size={18} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowSettingsModal(false)} style={{ padding: 8, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 20, marginLeft: 8 }}>
                  <Ionicons name="close" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={true} scrollEventThrottle={16} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
                
                {/* Current Items List - Editable */}
                {!itemsHidden && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 10, paddingHorizontal: 4 }}>TAP TO EDIT • SWIPE LEFT TO DELETE</Text>
                    {wheelSlices.length === 0 ? (
                      <View style={{ paddingVertical: 24, paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 12, alignItems: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.1)' }}>
                        <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 14, fontWeight: '500' }}>No items yet</Text>
                        <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 12, marginTop: 4 }}>Add your first item below</Text>
                      </View>
                    ) : (
                      wheelSlices.map((slice, idx) => (
                        <View key={slice.id} style={{ marginBottom: 10 }}>
                          {editingItemId === slice.id ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 12, borderWidth: 2, borderColor: theme.primary }}>
                              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: slice.color }} />
                              <TextInput
                                style={{
                                  flex: 1,
                                  color: theme.text,
                                  fontSize: 14,
                                  fontWeight: '500',
                                  padding: 8,
                                  backgroundColor: 'rgba(0,0,0,0.03)',
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: theme.primary
                                }}
                                value={editingItemText}
                                onChangeText={setEditingItemText}
                                autoFocus
                                maxLength={50}
                              />
                              <TouchableOpacity
                                onPress={() => {
                                  const updatedSlices = wheelSlices.map(s =>
                                    s.id === slice.id ? { ...s, text: editingItemText } : s
                                  )
                                  setWheelSlices(updatedSlices)
                                  setEditingItemId(null)
                                  setEditingItemText('')
                                }}
                                style={{ padding: 8, backgroundColor: theme.primary, borderRadius: 8 }}
                              >
                                <Ionicons name="checkmark" size={16} color={theme.surface} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => {
                                  setEditingItemId(null)
                                  setEditingItemText('')
                                }}
                                style={{ padding: 8, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 8 }}
                              >
                                <Ionicons name="close" size={16} color={theme.text} />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              onPress={() => {
                                setEditingItemId(slice.id)
                                setEditingItemText(slice.text)
                              }}
                              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', gap: 12 }}
                            >
                              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: slice.color }} />
                              <Text style={{ color: theme.text, flex: 1, fontWeight: '500', fontSize: 14 }}>{slice.text}</Text>
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                  onPress={() => {
                                    setEditingItemId(slice.id)
                                    setEditingItemText(slice.text)
                                  }}
                                  style={{ padding: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 6 }}
                                >
                                  <Ionicons name="pencil" size={14} color={theme.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => {
                                    Alert.alert('Delete Item', `Remove "${slice.text}"?`, [
                                      { text: 'Cancel', style: 'cancel' },
                                      {
                                        text: 'Delete',
                                        onPress: () => setWheelSlices(wheelSlices.filter((_, i) => i !== idx)),
                                        style: 'destructive'
                                      }
                                    ])
                                  }}
                                  style={{ padding: 6, backgroundColor: 'rgba(255, 107, 107, 0.1)', borderRadius: 6 }}
                                >
                                  <Ionicons name="trash" size={14} color="#FF6B6B" />
                                </TouchableOpacity>
                              </View>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))
                    )}
                  </View>
                )}

                {/* Custom Congratulation Message */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 8 }}>Custom Congratulation Message</Text>
                  <TextInput
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.05)',
                      borderRadius: 10,
                      padding: 12,
                      color: theme.text,
                      borderWidth: 1,
                      borderColor: 'rgba(0,0,0,0.1)',
                      minHeight: 80,
                      fontSize: 14,
                      fontFamily: 'System'
                    }}
                    placeholder="e.g., Congratulations! 🎉"
                    placeholderTextColor={theme.textSecondary}
                    value={customCongratulationMessage}
                    onChangeText={setCustomCongratulationMessage}
                    multiline
                  />
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 6 }}>This message will be shown for all winners in the announce winner section.</Text>
                </View>

                {/* Spin Mode */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 8 }}>Spin Mode</Text>
                  <View style={{ flexDirection: isSmallDevice ? 'column' : 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        backgroundColor: spinModeType === 'random' ? theme.primary : 'rgba(0,0,0,0.05)',
                        alignItems: 'center',
                        borderWidth: 2,
                        borderColor: spinModeType === 'random' ? theme.primary : 'rgba(0,0,0,0.1)'
                      }}
                      onPress={() => setSpinModeType('random')}
                    >
                      <Text style={{ color: spinModeType === 'random' ? theme.surface : theme.text, fontWeight: '600', fontSize: 13 }}>🎲 Random</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        backgroundColor: spinModeType === 'manual' ? theme.primary : 'rgba(0,0,0,0.05)',
                        alignItems: 'center',
                        borderWidth: 2,
                        borderColor: spinModeType === 'manual' ? theme.primary : 'rgba(0,0,0,0.1)'
                      }}
                      onPress={() => setSpinModeType('manual')}
                    >
                      <Text style={{ color: spinModeType === 'manual' ? theme.surface : theme.text, fontWeight: '600', fontSize: 13 }}>✋ Manual</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 6 }}>Choose random spinning or manually select specific winners</Text>
                </View>

                {/* Research Participant Selection */}
                <View style={{ marginBottom: 20, paddingVertical: 16, paddingHorizontal: 12, backgroundColor: 'rgba(52, 211, 153, 0.1)', borderRadius: 12, borderWidth: 2, borderColor: '#34D399' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Text style={{ fontSize: 22, fontWeight: '800' }}>📊</Text>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>Research Participant</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#34D399' }}>Selection Tool</Text>
                    </View>
                  </View>

                  {researchParticipants.length === 0 ? (
                    <View style={{ gap: 10 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: theme.text, marginBottom: 4 }}>Upload a CSV file with student names and emails</Text>
                      <TouchableOpacity
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          borderRadius: 10,
                          backgroundColor: 'rgba(0,0,0,0.05)',
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: '#34D399'
                        }}
                        onPress={downloadResearchTemplate}
                      >
                        <Text style={{ color: '#34D399', fontWeight: '600', fontSize: 13 }}>📥 Download Template</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          borderRadius: 10,
                          backgroundColor: '#34D399',
                          alignItems: 'center'
                        }}
                        onPress={handleResearchTemplateUpload}
                      >
                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>📤 Upload CSV</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ gap: 12 }}>
                      <View style={{ backgroundColor: 'rgba(0,0,0,0.05)', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, marginBottom: 2 }}>UPLOADED</Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>✓ {researchParticipants.length} students</Text>
                      </View>

                      <View style={{ gap: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text }}>Select how many to pick:</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#34D399' }}>{researchStudentsToSelect}</Text>
                        </View>
                        <View style={{ backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 6, height: 4, overflow: 'hidden' }}>
                          <View
                            style={{
                              height: '100%',
                              backgroundColor: '#34D399',
                              width: `${(researchStudentsToSelect / researchParticipants.length) * 100}%`
                            }}
                          />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, fontWeight: '500', color: theme.text }}>1</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                            {researchStudentsToSelect} of {researchParticipants.length} ({Math.round((researchStudentsToSelect / researchParticipants.length) * 100)}%)
                          </Text>
                          <Text style={{ fontSize: 11, fontWeight: '500', color: theme.text }}>{researchParticipants.length}</Text>
                        </View>
                      </View>

                      {/* Slider for selection */}
                      <View style={{ height: 40, justifyContent: 'center' }}>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          <TouchableOpacity
                            onPress={() => {
                              if (researchStudentsToSelect > 1) {
                                setResearchStudentsToSelect(researchStudentsToSelect - 1)
                              }
                            }}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              backgroundColor: '#34D399',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Text style={{ fontSize: 20, fontWeight: '700', color: 'white' }}>−</Text>
                          </TouchableOpacity>

                          <View style={{ flex: 1, height: 6, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 3 }}>
                            <View
                              style={{
                                height: '100%',
                                backgroundColor: '#34D399',
                                borderRadius: 3,
                                width: `${(researchStudentsToSelect / researchParticipants.length) * 100}%`
                              }}
                            />
                          </View>

                          <TouchableOpacity
                            onPress={() => {
                              if (researchStudentsToSelect < researchParticipants.length) {
                                setResearchStudentsToSelect(researchStudentsToSelect + 1)
                              }
                            }}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              backgroundColor: '#34D399',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Text style={{ fontSize: 20, fontWeight: '700', color: 'white' }}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          borderRadius: 10,
                          backgroundColor: '#34D399',
                          alignItems: 'center',
                          marginTop: 4
                        }}
                        onPress={() => {
                          setIsResearchMode(true)
                          setShowSettingsModal(false)
                        }}
                      >
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>✓ Apply Selection</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 14,
                          borderRadius: 10,
                          backgroundColor: 'rgba(255, 107, 107, 0.1)',
                          alignItems: 'center'
                        }}
                        onPress={() => {
                          Alert.alert('Clear Research Data', 'Remove all uploaded participants?', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Clear',
                              onPress: () => {
                                setResearchParticipants([])
                                setIsResearchMode(false)
                              },
                              style: 'destructive'
                            }
                          ])
                        }}
                      >
                        <Text style={{ color: '#FF6B6B', fontWeight: '600', fontSize: 12 }}>🗑️ Clear Data</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Add Item & Clear All */}
                <View style={{ marginBottom: 20, flexDirection: isSmallDevice ? 'column' : 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 10, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => {
                      const newSlice: WheelSlice = {
                        id: `slice_${Date.now()}`,
                        text: 'New Item',
                        color: getSliceColor(wheelSlices.length, wheelSlices.length + 1)
                      }
                      setWheelSlices([...wheelSlices, newSlice])
                    }}
                  >
                    <Text style={{ color: theme.surface, fontWeight: '700', fontSize: 14 }}>➕ Add Item</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#FF6B6B', alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => Alert.alert('Clear All', 'Are you sure you want to clear all items?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Clear', onPress: () => setWheelSlices([]), style: 'destructive' }
                    ])}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>🗑️ Clear All</Text>
                  </TouchableOpacity>
                </View>

                {/* CSV Operations */}
                <View style={{ gap: 10 }}>
                  <TouchableOpacity
                    style={{ paddingVertical: 13, paddingHorizontal: 16, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', borderWidth: 1, borderColor: theme.primary }}
                    onPress={() => {
                      // Download template CSV
                      const csv = 'Item\nOption 1\nOption 2\nOption 3\n'
                      console.log('Download template:', csv)
                    }}
                  >
                    <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 14 }}>📥 Download Template</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ paddingVertical: 13, paddingHorizontal: 16, borderRadius: 10, backgroundColor: theme.primary, alignItems: 'center' }}
                    onPress={async () => {
                      try {
                        const result = await DocumentPicker.getDocumentAsync({ type: 'text/csv' })
                        if (!result.canceled && result.assets[0]) {
                          console.log('File selected:', result.assets[0].uri)
                          // Handle CSV upload
                        }
                      } catch (err) {
                        console.error('Error picking document:', err)
                      }
                    }}
                  >
                    <Text style={{ color: theme.surface, fontWeight: '700', fontSize: 14 }}>📤 Upload Your CSV</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, textAlign: 'center', marginTop: 4 }}>Supports Excel CSV files with any delimiter</Text>
                </View>
              </ScrollView>

              {/* Bottom Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: theme.primary,
                  marginTop: 12,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  shadowColor: theme.primary,
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.25,
                  shadowRadius: 6,
                  elevation: 3,
                }}
                onPress={() => setShowSettingsModal(false)}
                activeOpacity={0.8}
              >
                <Text style={{ color: theme.surface, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 }}>DONE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Color Theme Modal */}
      <Modal visible={showThemeModal} transparent animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={{
              backgroundColor: theme.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 20,
              paddingHorizontal: 16,
              paddingBottom: 16,
              height: '95%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.2,
              shadowRadius: 16,
              elevation: 12,
            }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 26, fontWeight: '800' }}>🎨</Text>
                <Text style={{ fontSize: 20, fontWeight: '700', color: theme.text, flex: 1, marginLeft: 12 }}>Color Themes</Text>
                <TouchableOpacity onPress={() => setShowThemeModal(false)} style={{ padding: 8, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 20 }}>
                  <Ionicons name="close" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>

              {/* Subtitle */}
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 14, fontWeight: '500', paddingHorizontal: 4 }}>
                Select a theme to customize your wheel colors
              </Text>
              
              {/* Content - Scrollable theme list */}
              <ScrollView 
                showsVerticalScrollIndicator={true}
                scrollEventThrottle={16}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                {colorThemes.map((colorTheme) => (
                  <TouchableOpacity
                    key={colorTheme.id}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 14,
                      borderRadius: 16,
                      marginBottom: 10,
                      width: '100%',
                      borderWidth: 2.5,
                      backgroundColor: currentThemeId === colorTheme.id ? colorTheme.colors[0] + '12' : 'rgba(0,0,0,0.02)',
                      borderColor: currentThemeId === colorTheme.id ? colorTheme.colors[0] : 'rgba(0,0,0,0.15)',
                      shadowColor: currentThemeId === colorTheme.id ? colorTheme.colors[0] : '#000',
                      shadowOffset: { width: 0, height: currentThemeId === colorTheme.id ? 5 : 1 },
                      shadowOpacity: currentThemeId === colorTheme.id ? 0.2 : 0.06,
                      shadowRadius: currentThemeId === colorTheme.id ? 8 : 3,
                      elevation: currentThemeId === colorTheme.id ? 5 : 1,
                    }}
                    activeOpacity={0.8}
                    onPress={() => handleThemeChange(colorTheme.id)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Text style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: theme.text,
                        flex: 1
                      }}>
                        {colorTheme.name}
                      </Text>
                      {currentThemeId === colorTheme.id && (
                        <View style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: colorTheme.colors[0],
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: 8,
                        }}>
                          <Ionicons name="checkmark" size={14} color="white" />
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {colorTheme.colors.map((color, idx) => (
                        <View
                          key={idx}
                          style={{
                            flex: 1,
                            height: 40,
                            borderRadius: 10,
                            borderWidth: 2,
                            borderColor: 'rgba(255,255,255,0.3)',
                            shadowColor: color,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 3,
                            elevation: 2,
                            backgroundColor: color
                          }}
                        />
                      ))}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              {/* Bottom Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: theme.primary,
                  marginTop: 12,
                  paddingVertical: 13,
                  borderRadius: 12,
                  alignItems: 'center',
                  shadowColor: theme.primary,
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.25,
                  shadowRadius: 6,
                  elevation: 3,
                }}
                onPress={() => setShowThemeModal(false)}
                activeOpacity={0.8}
              >
                <Text style={{ color: theme.surface, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 }}>APPLY THEME</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Confetti */}
      {showConfetti && <ConfettiCannon count={200} origin={{ x: width / 2, y: 0 }} fadeOut autoStart />}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "web" ? 0 : 25,
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: getAdaptiveFontSize(18) },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isSmallDevice ? 12 : 20,
    paddingVertical: isSmallDevice ? 12 : 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: getAdaptiveFontSize(18), fontWeight: '600', flex: 1, textAlign: 'center' },
  headerSpacer: { width: 40 },
  scrollContainer: { flex: 1 },
  winnerSection: {
    margin: isSmallDevice ? 12 : 20,
    padding: isSmallDevice ? 12 : 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  winnerSelectorRow: {
    flexDirection: isSmallDevice ? 'column' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: isSmallDevice ? 12 : 0,
  },
  winnerLabel: { fontSize: getAdaptiveFontSize(16), fontWeight: '500', flex: 1, marginLeft: isSmallDevice ? 0 : 8 },
  winnerControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  winnerButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  winnerCount: { fontSize: getAdaptiveFontSize(20), fontWeight: 'bold', minWidth: 40, textAlign: 'center' },
  wheelDisplaySection: { alignItems: 'center', paddingVertical: isSmallDevice ? 15 : 30 },
  wheelContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  quickActionsSection: { 
    flexDirection: isSmallDevice ? 'column' : 'row', 
    justifyContent: 'center', 
    gap: isSmallDevice ? 10 : 16, 
    paddingHorizontal: isSmallDevice ? 12 : 20, 
    marginBottom: isSmallDevice ? 10 : 20,
    flexWrap: 'wrap',
  },
  actionButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: isSmallDevice ? 10 : 12, 
    paddingHorizontal: isSmallDevice ? 14 : 20, 
    borderRadius: 12, 
    borderWidth: 1, 
    gap: 8,
    flex: isSmallDevice ? 1 : 0,
    minWidth: isSmallDevice ? '48%' : 'auto',
  },
  actionButtonText: { fontSize: getAdaptiveFontSize(13), fontWeight: '500' },
  spinButtonSection: { paddingHorizontal: isSmallDevice ? 12 : 20, paddingBottom: isSmallDevice ? 15 : 30, alignItems: 'center' },
  snakeSpinButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: isSmallDevice ? 14 : 16, 
    paddingHorizontal: isSmallDevice ? 20 : 40, 
    borderRadius: 30, 
    minWidth: isSmallDevice ? 140 : 180, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 12, 
    elevation: 8, 
    gap: 10 
  },
  spinButtonSnake: { width: isSmallDevice ? 24 : 30, height: isSmallDevice ? 24 : 30, resizeMode: 'contain' },
  snakeSpinButtonText: { fontSize: getAdaptiveFontSize(isSmallDevice ? 15 : 16), fontWeight: 'bold', letterSpacing: 0.5 },
  controlsSection: { 
    margin: isSmallDevice ? 12 : 20, 
    padding: isSmallDevice ? 12 : 20, 
    borderRadius: 16, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 8, 
    elevation: 4 
  },
  soundToggleSection: { 
    paddingVertical: isSmallDevice ? 10 : 12, 
    paddingHorizontal: isSmallDevice ? 12 : 16, 
    backgroundColor: 'rgba(0, 0, 0, 0.03)', 
    borderRadius: 14, 
    marginBottom: isSmallDevice ? 10 : 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  soundRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 },
  soundLabel: { fontSize: getAdaptiveFontSize(15), fontWeight: '500', flex: 1 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: isSmallDevice ? 10 : 12 },
  checkbox: { width: isSmallDevice ? 20 : 24, height: isSmallDevice ? 20 : 24, borderRadius: 6, borderWidth: 2, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  checkboxText: { fontSize: getAdaptiveFontSize(15), fontWeight: '500' },
  modalOverlay: { flex: 1, justifyContent: "flex-end", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  modalContent: { 
    backgroundColor: "white", 
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: isSmallDevice ? 16 : 24, 
    width: '100%',
    maxHeight: isSmallDevice ? '85%' : '80%',
    alignItems: "center",
  },
  modalTitle: { fontSize: getAdaptiveFontSize(24), fontWeight: "bold", marginBottom: 15 },
  modalWinner: { fontSize: getAdaptiveFontSize(18), marginBottom: 10, textAlign: "center" },
  closeButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginTop: 10, width: '100%', alignItems: 'center' },
  closeButtonText: { fontSize: getAdaptiveFontSize(18), fontWeight: "bold" },
  settingItem: { marginVertical: 12 },
  settingLabel: { fontSize: getAdaptiveFontSize(16), fontWeight: 'bold', marginBottom: 8 },
  settingDescription: { fontSize: getAdaptiveFontSize(12), marginBottom: 4 },
  wheelTypeScrollView: { maxHeight: isSmallDevice ? 100 : 120 },
  wheelTypeContainer: { paddingVertical: 8, gap: 12 },
  wheelTypeCard: { 
    width: isSmallDevice ? 70 : 80, 
    height: isSmallDevice ? 80 : 90, 
    borderRadius: 12, 
    borderWidth: 2, 
    padding: 8, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 8 
  },
  wheelTypeIcon: { fontSize: getAdaptiveFontSize(24), marginBottom: 4 },
  wheelTypeName: { fontWeight: '600', textAlign: 'center', lineHeight: 14, fontSize: getAdaptiveFontSize(10) },
  themeOption: { 
    paddingVertical: isSmallDevice ? 10 : 14, 
    paddingHorizontal: isSmallDevice ? 12 : 16, 
    borderRadius: 14, 
    marginBottom: isSmallDevice ? 10 : 12, 
    alignItems: 'flex-start',
    width: '100%',
  },
  themeOptionName: { fontSize: getAdaptiveFontSize(15), fontWeight: '600', marginBottom: 8 },
  themeColorPreview: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  colorDot: { width: isSmallDevice ? 26 : 30, height: isSmallDevice ? 26 : 30, borderRadius: isSmallDevice ? 13 : 15 },
})

export default WheelScreen
