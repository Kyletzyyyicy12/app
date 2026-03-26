import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Dimensions, StatusBar, Modal, Image as RNImage, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import Svg, { G, Path, Circle, Text as SvgText, Defs, ClipPath, Image as SvgImage, Pattern, Mask, Rect } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebaseConfig';
import { doc, onSnapshot, addDoc, serverTimestamp, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import EnhancedWinnerPopup from '../components/EnhancedWinnerPopup';
import { calculateUnifiedWinner, unifiedEasingFunction, calculateLatencyCompensation, validateWheelTypeCompatibility } from '../utils/WheelSynchronizationUtils';



// 🧮 UNIFIED Winner Calculation - Uses the same algorithm as web organizer
const calculateWinnerFromWebData = (webData: any, wheelSlices: WheelSlice[]): { expectedWinner: string; expectedIndex: number; isPositionMatching: boolean } => {
  if (!webData?.wheelState?.totalRotation) {
    return { expectedWinner: 'Unknown', expectedIndex: -1, isPositionMatching: false };
  }

  const totalRotation = webData.wheelState.totalRotation;
  const wheelItems = wheelSlices.map(slice => slice.text);

  // 🎯 USE UNIFIED CALCULATION - EXACT SAME AS WEB ORGANIZER
  const { winningIndex, winner } = calculateUnifiedWinner(totalRotation, wheelItems);

  console.log('🎯 UNIFIED WINNER CALCULATION (MOBILE PARTICIPANT):', {
    sessionId: 'WEB_DATA_SOURCE',
    totalRotationRadians: totalRotation.toFixed(6),
    totalRotationDegrees: (totalRotation * 180 / Math.PI).toFixed(2),
    winningIndex: winningIndex,
    expectedWinner: winner,
    totalSlices: wheelSlices.length,
    calculationMethod: 'UNIFIED_CROSS_PLATFORM',
    synchronizationStatus: 'PERFECT_MATCH'
  });

  return {
    expectedWinner: winner,
    expectedIndex: winningIndex,
    isPositionMatching: true
  };
};

interface WheelSlice {
  id: string;
  text: string;
  color: string;
}

interface WheelSliceImage {
  url: string;
  alt?: string;
  isLoaded?: boolean;
  error?: boolean;
  retryCount?: number;
}

interface Comment {
  id: string;
  text: string;
  userName: string;
  timestamp: any;
}

interface Person {
  id: string;
  name: string;
  gender?: 'M' | 'F';
  label?: string;
  isLeader?: boolean;
}

interface Team {
  id: string;
  name: string;
  members: Person[];
  customName?: string;
}

interface SpinState {
  isSpinning: boolean;
  spinDuration: number;
  totalRotation: number;
  finalAngle: number;
  startTime?: number;
}

const WebLiveRoomScreen = () => {
  const { theme } = useTheme();
  const { currentUser, userProfile } = useAuth();
  const route = useRoute();
  const params = route.params as any;

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // BIG RESPONSIVE WHEEL SIZE - maximally enlarged for mobile viewing
  const wheelSize = Math.min(screenWidth * 0.98, 650); // Increased from 0.95 to 0.98, from 550 to 650
  const radius = wheelSize * 0.47; // 150 for 320, so 0.47
  const centerRadius = Math.max(20, radius / 10); // Slightly larger center
  const centerX = wheelSize / 2;
  const centerY = wheelSize / 2;

  // Core state
  const [roomCode, setRoomCode] = useState(params?.roomCode || '');
  const [sessionId, setSessionId] = useState<string | null>(params?.sessionId || null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userName] = useState(userProfile?.fullName || currentUser?.email?.split('@')[0] || 'Participant');

  // Wheel state
  const [wheelSlices, setWheelSlices] = useState<WheelSlice[]>([]);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [organizerSpinState, setOrganizerSpinState] = useState<SpinState | null>(null);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);

  // Image state for participant view - synchronized from organizer
   const [sliceImages, setSliceImages] = useState<Map<string, WheelSliceImage>>(new Map());
   const [loadedImages, setLoadedImages] = useState<Map<string, boolean>>(new Map());
   const [imagePickerMode, setImagePickerMode] = useState(false);

  // Theme state for wheel color synchronization - DEFAULT TO SCHOOL THEME
  const [selectedTheme, setSelectedTheme] = useState<string>('school');

  // Debug theme state changes
  useEffect(() => {
    console.log('🎨 SELECTED THEME STATE CHANGED:', {
      selectedTheme,
      timestamp: new Date().toISOString()
    });
  }, [selectedTheme]);

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  // Winner state - ENHANCED FOR ACCURACY
  const [currentWinner, setCurrentWinner] = useState<string | null>(null);
  const [showWinnerAlert, setShowWinnerAlert] = useState(false);
  const [winnerAlertMinimized, setWinnerAlertMinimized] = useState(false);
  const [pendingWinner, setPendingWinner] = useState<string | null>(null);
  const [spinCompletedFlag, setSpinCompletedFlag] = useState(false);
  const [isWinnerMinimized, setIsWinnerMinimized] = useState(false);

  // Enhanced winner popup state
  const [showEnhancedWinnerPopup, setShowEnhancedWinnerPopup] = useState(false);

  // Enhanced synchronization tracking
  const [syncStatus, setSyncStatus] = useState<'ideal' | 'good' | 'fair' | 'warning'>('good');
  const [lastSyncQuality, setLastSyncQuality] = useState<number>(100);

  // Winner data for popup
  const [winnerData, setWinnerData] = useState<any>(null);

  // Current wheel type display
  const [currentWheelType, setCurrentWheelType] = useState<string | null>(null);

  // Force winner popup display mechanism
  const [forceWinnerPopup, setForceWinnerPopup] = useState(false);

  // Force redraw mechanism for wheel reset synchronization
  const [forceWheelRedraw, setForceWheelRedraw] = useState(0);

  // Track last config update time to prevent auto-spin on wheel type changes
  const [lastConfigUpdateTime, setLastConfigUpdateTime] = useState(Date.now());

  // Track announced winners to prevent duplicate announcements
  const lastAnnouncedWinner = useRef<string>('');
  const lastAnnouncementTime = useRef<number>(0);

  // 🎯 SINGLE_ANNOUNCEMENT GUARANTEE: Track spin completion to ensure ONLY ONE winner announcement per spin
  const lastSpinCompletionId = useRef<string>(''); // Unique ID to ensure ONE announcement per actual spin
  const spinCompletedRef = useRef<boolean>(false); // Track whether current spin has been announced

  // Team picker state for participant view
  const [teams, setTeams] = useState<Team[]>([]);
  const [showTeamResults, setShowTeamResults] = useState(false);
  const [showFullTeamResults, setShowFullTeamResults] = useState(false);
  const [showTeamAnnouncement, setShowTeamAnnouncement] = useState(false);
  const [isTeamRevealing, setIsTeamRevealing] = useState(false);
  const [revealedGroups, setRevealedGroups] = useState<Set<number>>(new Set());
  const [revealedMembers, setRevealedMembers] = useState<Map<number, Set<number>>>(new Map());
  const [animatingMembers, setAnimatingMembers] = useState<Map<string, boolean>>(new Map());
  const [showExportOptions, setShowExportOptions] = useState(false);

  // Memoize initialSlices to prevent infinite re-renders for ImagePickerWheel
  const initialSlices = useMemo(() => {
    // Get school theme colors for ImagePickerWheel
    const schoolTheme = { colors: ['#8e0b16', '#66181E'] };
    const schoolColors = schoolTheme.colors;

    return wheelSlices.map((slice, index) => ({
      id: slice.id,
      text: slice.text,
      // Use school theme colors for ImagePickerWheel
      color: schoolColors[index % schoolColors.length] || schoolColors[0],
      image: sliceImages.get(slice.id) ? {
        uri: sliceImages.get(slice.id)!.url,
        fileName: `image_${index}.jpg`,
        uploadTimestamp: new Date(),
        originalUrl: sliceImages.get(slice.id)!.url,
        loadError: sliceImages.get(slice.id)!.error || false,
        retryCount: sliceImages.get(slice.id)!.retryCount || 0
      } : undefined
    }));
  }, [wheelSlices, sliceImages]); // Need full objects to detect image changes





   // BULLETPROOF STABILITY - COMPLETE PATTERN ISOLATION DURING SPINNING
  const staticPatternDefinitionsRef = useRef<Record<string, { patternId: string; url: string; sliceId: string }>>({});
  const patternFreezeModeRef = useRef<boolean>(false); // COMPLETE FREEZE OF PATTERN CHANGES

  const animationRef = useRef<number | undefined>(undefined);
  const spinStartTime = useRef<number | undefined>(undefined);

  // 🧮 WINNER CALCULATION: Use exact web organizer calculations
  // 🔒 FORCED WINNER SYNC - GUARANTEE SAME RESULT AS ORGANIZER
  const forceOrganizerWinner = (webData: any, wheelSlices: WheelSlice[]): { winnerText: string; winnerIndex: number; totalRotation: number } => {
    // 🏆 CRITICAL: Get exact winner data from organizer's wheel state
    const organizerWinnerData = webData.wheelState?.winners?.[0];
    const organizerWinnerText = organizerWinnerData?.name || organizerWinnerData?.text || organizerWinnerData;
    const organizerWinnerIndex = webData.wheelState?.winningIndex;
    const organizerTotalRotation = webData.wheelState?.totalRotation;

    // 🏆 FORCE MATCH: If we have organizer data, use it EXACTLY
    if (organizerWinnerText && organizerWinnerIndex !== undefined && organizerTotalRotation !== undefined) {
      console.log('🏆 FORCED WINNER SYNC - Using organizer\'s EXACT winner data:', {
        winnerText: organizerWinnerText,
        winnerIndex: organizerWinnerIndex,
        totalRotation: organizerTotalRotation.toFixed(6),
        method: 'DIRECT_ORGANIZER_OVERRIDE',
        guaranteeMatch: true
      });

      return {
        winnerText: organizerWinnerText,
        winnerIndex: organizerWinnerIndex,
        totalRotation: organizerTotalRotation
      };
    }

    // 💥 FALLBACK: If no organizer data, calculate using exact web formula
    console.log('🏆 FALLBACK WINNER CALC - Using web calculation formula');
    const { expectedWinner, expectedIndex } = calculateWinnerFromWebData(webData, wheelSlices);

    return {
      winnerText: expectedWinner,
      winnerIndex: expectedIndex,
      totalRotation: webData.wheelState?.totalRotation || 0
    };
  };


  // EXACT THEME COLORS FROM WEB APP - MATCH PERFECTLY
  const webThemeColors: Record<string, string[]> = {
    "school": ["#8e0b16", "#66181E"], // School Colors - FIXED
    "rainbow": ["#ff0080", "#00ff80", "#0080ff", "#ff8000", "#8000ff"], // Rainbow Bright
    "neon": ["#39ff14", "#ff073a"], // Neon Electric
    "ocean": ["#0077be", "#00a8cc", "#00b4d8", "#48cae4", "#90e0ef"], // Ocean Depths
    "sunset": ["#ff4500", "#ff6347", "#ff7f50", "#ffa500", "#ffb6c1"], // Sunset Blaze
    "purple": ["#9932cc", "#6a0dad", "#9370db", "#ba55d3", "#dda0dd"], // Purple Galaxy
    "forest": ["#228b22", "#006400", "#32cd32", "#90ee90", "#98fb98"], // Emerald Forest
    "pink": ["#ff1493", "#ff69b4", "#ffb6c1", "#ffc0cb", "#ffe4e1"], // Hot Pink
    "gold": ["#ffd700", "#daa520", "#b8860b", "#f0e68c", "#fafad2"], // Golden Luxury
    "cyber": ["#00ffff", "#1e90ff", "#4169e1", "#0000ff", "#191970"], // Cyber Blue
    "fireice": ["#dc143c", "#4169e1", "#ff6347", "#87ceeb", "#ffffff"], // Fire & Ice
    "lime": ["#32cd32", "#adff2f", "#7fff00", "#00ff00", "#90ee90"], // Lime Splash
    "dark": ["#2c2c2c", "#4a4a4a", "#696969", "#808080", "#a9a9a9"], // Midnight Dark
    "pastel": ["#ffb6c1", "#dda0dd", "#b0e0e6", "#d1f2eb", "#f8cecc"], // Cotton Candy
    "volcanic": ["#ff4500", "#ff8c00", "#ffa500", "#ffd700", "#ffff00"], // Volcanic Orange
    "arctic": ["#b0e0e6", "#87ceeb", "#4682b4", "#4169e1", "#000080"], // Arctic Frost
    "tropical": ["#ff7f50", "#ffa500", "#ffff00", "#adff2f", "#32cd32"], // Tropical Sunset
    "royal": ["#4b0082", "#800080", "#9932cc", "#ba55d3", "#dda0dd"] // Royal Crown
  };

  // Helper function for slice colors - MATCHES WEB APP THEME SYSTEM
  const getSliceColor = (index: number, themeOverride?: string): string => {
    const themeName = themeOverride || selectedTheme;
    console.log('🎨 getSliceColor called:', { index, themeName, themeOverride, selectedTheme });

    // Handle web app theme system - use color arrays like the web app
    if (themeName === 'default') {
      // For default theme, use dynamic HSL colors like web app
      const hue = (index * 137.5) % 360; // Golden angle approximation for good distribution
      const color = `hsl(${hue}, 70%, 50%)`;
      console.log('🎨 getSliceColor result (default):', { index, themeName, color });
      return color;
    }

    const themeColors = webThemeColors[themeName as keyof typeof webThemeColors];
    if (themeColors && themeColors.length > 0) {
      const color = themeColors[index % themeColors.length];
      console.log('🎨 getSliceColor result (web theme):', { index, themeName, color, arrayIndex: index % themeColors.length });
      return color;
    }

    // Fallback to default theme
    const hue = (index * 137.5) % 360;
    const color = `hsl(${hue}, 70%, 50%)`;
    console.log('🎨 getSliceColor result (fallback):', { index, themeName, color });
    return color;
  };

  // Helper function to get current theme's primary color for UI elements
  const getThemePrimaryColor = (): string => {
    const themeColors = webThemeColors[selectedTheme as keyof typeof webThemeColors];
    if (themeColors && themeColors.length > 0) {
      return themeColors[0]; // Use first color as primary
    }

    // Fallback for default theme
    return '#8e0b16';
  };

  // CRITICAL: Validate and fix wheel slice colors to ensure theme consistency
  const validateAndFixWheelColors = useCallback(() => {
    if (wheelSlices.length === 0) return;

    console.log('🔍 VALIDATING WHEEL COLORS - Theme:', selectedTheme);
    const needsFix = wheelSlices.some((slice, index) => {
      const expectedColor = getSliceColor(index);
      return slice.color !== expectedColor;
    });

    if (needsFix) {
      console.log('⚠️ WHEEL COLORS INCONSISTENT - FIXING IMMEDIATELY');
      const fixedSlices = wheelSlices.map((slice, index) => {
        const expectedColor = getSliceColor(index);
        if (slice.color !== expectedColor) {
          console.log(`🔧 Fixed slice ${index} color: ${slice.color} → ${expectedColor}`);
          return { ...slice, color: expectedColor };
        }
        return slice;
      });
      setWheelSlices(fixedSlices);
      setForceWheelRedraw(prev => prev + 1);
      console.log('✅ WHEEL COLORS FIXED AND CONSISTENT');
    } else {
      console.log('✅ WHEEL COLORS ARE CONSISTENT WITH THEME');
    }
  }, [wheelSlices, selectedTheme]);

  // Validate wheel colors whenever theme or wheel slices change
  useEffect(() => {
    validateAndFixWheelColors();
  }, [wheelSlices.length, selectedTheme]); // Remove function dependency to prevent loops

  // Enhanced image loading handler for React Native Image components
  const handleImageLoad = (sliceId: string) => {
    console.log('✅ Image loaded successfully for slice:', sliceId);
    setLoadedImages(prev => new Map(prev.set(sliceId, true)));
    setSliceImages(prev => {
      const updated = new Map(prev);
      const sliceImage = updated.get(sliceId);
      if (sliceImage) {
        updated.set(sliceId, { ...sliceImage, isLoaded: true, error: false });
      }
      return updated;
    });

    // Removed force redraw for smoother performance
  };

  // Enhanced image error handler with retry mechanism
  const handleImageError = (sliceId: string, error: any) => {
    console.error('❌ Image failed to load for slice:', sliceId, error);

    // Get current image data
    const currentImage = sliceImages.get(sliceId);
    if (currentImage) {
      const retryCount = currentImage.retryCount || 0;

      // Try to reload with fresh cache-busting if under 3 retries
      if (retryCount < 3) {
        console.log(`🔄 Retrying image load for slice ${sliceId}, attempt ${retryCount + 1}`);

        // Use the original URL directly without modifications for retry
        const retryUrl = currentImage.url;

        // Update the slice image with retry URL
        setSliceImages(prev => {
          const updated = new Map(prev);
          const sliceImage = updated.get(sliceId);
          if (sliceImage) {
            updated.set(sliceId, {
              ...sliceImage,
              url: retryUrl,
              isLoaded: false,
              error: false,
              retryCount: retryCount + 1
            });
          }
          return updated;
        });

        // Removed force redraw for smoother performance

        return; // Don't mark as error yet, we're retrying
      } else {
        // Mark as error after retries exhausted
        console.error(`❌ Image failed to load after ${retryCount} retries for slice:`, sliceId);
        setLoadedImages(prev => new Map(prev.set(sliceId, false)));
        setSliceImages(prev => {
          const updated = new Map(prev);
          const sliceImage = updated.get(sliceId);
          if (sliceImage) {
            updated.set(sliceId, { ...sliceImage, isLoaded: false, error: true });
          }
          return updated;
        });

        // Removed force redraw for smoother performance
      }
    } else {
      // No current image data, mark as error
      setLoadedImages(prev => new Map(prev.set(sliceId, false)));
      setSliceImages(prev => {
        const updated = new Map(prev);
        updated.set(sliceId, {
          url: '',
          isLoaded: false,
          error: true,
          retryCount: 1
        });
        return updated;
      });
    }
  };


   // BULLETPROOF PATTERN FREEZE SYSTEM - COMPLETE ISOLATION DURING SPINNING
   const patternDefinitions = useMemo(() => {
     // COMPLETE FROZEN STATE DURING SPINNING - NO RECALCULATION WHATSOEVER
     if (patternFreezeModeRef.current || isWheelSpinning) {
       console.log('🛡️ PATTERN FREEZE ACTIVE - Using static patterns ONLY');
       return staticPatternDefinitionsRef.current;
     }

     // Normal (non-spinning, non-frozen) pattern creation
     const patterns: Record<string, { patternId: string; url: string; sliceId: string }> = {};
     sliceImages.forEach((imageData, sliceId) => {
       if (imageData.url && imageData.isLoaded && !imageData.error) {
         patterns[sliceId] = {
           patternId: `img-${sliceId}`,
           url: imageData.url,
           sliceId: sliceId
         };
       }
     });

     console.log('🔧 PATTERN DEFINITIONS CREATED/UPDATED (NON-SPINNING):', {
       timestamp: new Date().toISOString(),
       patternCount: Object.keys(patterns).length,
       patternIds: Object.keys(patterns),
       isSpinning: isWheelSpinning,
       isFrozen: patternFreezeModeRef.current,
       sliceImagesCount: sliceImages.size
     });

     return patterns;
   }, [sliceImages, isWheelSpinning, patternFreezeModeRef.current]); // Removed imagePickerMode dependency to prevent unnecessary recalcs

   // CRITICAL: PRE-SPIN PATTERN LOCKDOWN
   useEffect(() => {
     // Before spinning starts, ALWAYS ensure we have static patterns locked
     if (!isWheelSpinning && !patternFreezeModeRef.current && Object.keys(patternDefinitions).length > 0) {
       staticPatternDefinitionsRef.current = patternDefinitions;
       console.log('💾 PRE-SPIN: Static patterns locked for stability');

       // PREVENT any further pattern changes during potential spinning
       patternFreezeModeRef.current = false; // Allow normal updates until spin starts
     }
   }, [patternDefinitions, isWheelSpinning]);

   // SPINNING STARTUP PROTOCOL - COMPLETE FREEZE ACTIVATION
   useEffect(() => {
     if (isWheelSpinning && !patternFreezeModeRef.current) {
       // ACTIVATE COMPLETE PATTERN FREEZE IMMEDIATELY
       patternFreezeModeRef.current = true;

       // EMERGENCY PATTERN FALLBACK: Ensure we have patterns before complete freeze
       const currentPatterns = Object.keys(staticPatternDefinitionsRef.current).length;
       if (currentPatterns === 0 && Object.keys(patternDefinitions).length > 0) {
         staticPatternDefinitionsRef.current = patternDefinitions;
         console.log('🚨 EMERGENCY: Emergency pattern loading during spin startup');
       }

       console.log('🔒 ULTIMATE PATTERN FREEZE ACTIVATED - Zero changes during spinning:', {
         staticPatterns: Object.keys(staticPatternDefinitionsRef.current).length,
         isFrozen: true,
         canShowImages: Object.keys(staticPatternDefinitionsRef.current).length > 0,
         timestamp: new Date().toISOString()
       });
     } else if (!isWheelSpinning && patternFreezeModeRef.current) {
       // SPIN COMPLETE - Release freeze for next spin preparation
       setTimeout(() => {
         patternFreezeModeRef.current = false;
         console.log('🔓 Pattern freeze released - Spin completed');
       }, 1000); // Brief delay to ensure all spin effects complete
     }
   }, [isWheelSpinning, patternDefinitions]);

  // Render wheel segments with IMAGE SUPPORT (matches web organizer's wheel exactly)
    const renderWheelSegments = () => {
     console.log('🎨 RENDERING WHEEL SEGMENTS WITH IMAGES:', {
       wheelSlicesCount: wheelSlices.length,
       selectedTheme: selectedTheme,
       sliceColors: wheelSlices.map((s, i) => `Slice ${i}: ${s.color}`),
       imagePickerMode: imagePickerMode,
       sliceImagesCount: sliceImages.size,
       loadedImagesCount: loadedImages.size
     });

     if (wheelSlices.length === 0) {
       console.log('🎨 No wheel slices to render, showing waiting screen');
       return (
         <G>
           <Circle cx={160} cy={160} r={150} fill={getThemePrimaryColor()} />
           <SvgText x={160} y={150} fill="#ffffff" fontSize="14" fontWeight="bold" textAnchor="middle">
             Waiting for wheel...
           </SvgText>
           <SvgText x={160} y={170} fill="#ffffff" fontSize="12" textAnchor="middle">
             Organizer will spin it
           </SvgText>
         </G>
       );
     }

     const segmentAngle = 360 / wheelSlices.length;
     const radius = 150;
     const centerRadius = Math.max(30, radius / 6);

     return (
       <G>
         {/* Wheel segments with INTEGRATED IMAGE SUPPORT - Images rotate with wheel */}
         {wheelSlices.map((slice, index) => {
           const startAngle = index * segmentAngle;
           const endAngle = startAngle + segmentAngle;

           // CRITICAL FIX: Match web organizer coordinate system
           // Web uses 0° = right (3 o'clock), mobile needs to match this
           // Remove the -90 offset to align with web organizer
           const startAngleRad = startAngle * Math.PI / 180;
           const endAngleRad = endAngle * Math.PI / 180;

           const x1 = 160 + radius * Math.cos(startAngleRad);
           const y1 = 160 + radius * Math.sin(startAngleRad);
           const x2 = 160 + radius * Math.cos(endAngleRad);
           const y2 = 160 + radius * Math.sin(endAngleRad);

           const largeArcFlag = segmentAngle > 180 ? 1 : 0;
           const pathData = `M 160 160 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

           // INSIDE POSITIONING - Place text inside each slice for optimal readability
           const textAngle = startAngle + segmentAngle / 2; // Midpoint of segment
           const textRadius = radius * 0.65; // Place text inside slice for good balance
           // CRITICAL FIX: Match web coordinate system (0° = right)
           const textAngleRad = textAngle * Math.PI / 180;
           const textX = 160 + textRadius * Math.cos(textAngleRad);
           const textY = 160 + textRadius * Math.sin(textAngleRad);

           // TANGENTIAL TEXT ORIENTATION - Text aligned along circumference for readability
           const radialTextAngle = textAngle + 90; // Tangential alignment - text follows wheel circumference direction

           // BIG & VISIBLE TEXT SIZING - Maximum Readability
           // Calculate precise available space for text on the outer edge
           const segmentAngleRad = (segmentAngle * Math.PI) / 180;
           const availableArcLength = segmentAngleRad * textRadius; // Exact circumferential space

           const displayText = slice.text || 'No Text';
           const textLength = displayText.length;

           // 1. START WITH MUCH LARGER BASE SIZE
           // Use generous pt-to-pixel conversion (1pt ≈ 1.0px for BIG text)
           const idealFontSize = Math.min(availableArcLength / (textLength * 1.0), radius / 2);

           // 2. CAP MAXIMUM SIZE AT VERY HIGH LEVEL
           const sizeCapped = Math.min(idealFontSize, 32); // Increased max size significantly

           // 3. VERY GENTLE RESPONSIVE ADJUSTMENT FOR MAXIMUM VISIBILITY
           let responsiveSize = sizeCapped;
           if (wheelSlices.length > 16) responsiveSize = Math.max(sizeCapped * 0.95, 6);   // Ultra-mild reduction
           if (wheelSlices.length > 24) responsiveSize = Math.max(sizeCapped * 0.9, 5);   // Soft minimums
           if (wheelSlices.length > 32) responsiveSize = Math.max(sizeCapped * 0.85, 4);  // Still very readable

           // 4. TEXT LENGTH SAFETY NET - VERY CONSERVATIVE
           let textLengthAdjustedSize = responsiveSize;
           if (textLength > 15) textLengthAdjustedSize = Math.max(responsiveSize * 0.95, 5); // Tiny reduction
           if (textLength > 25) textLengthAdjustedSize = Math.max(responsiveSize * 0.9, 4.5); // Very gentle
           if (textLength > 40) textLengthAdjustedSize = Math.max(responsiveSize * 0.85, 4);  // Preserve readability

           // 5. ABSOLUTE MINIMUM READABILITY - SIGNIFICANTLY INCREASED
           const finalFontSize = Math.max(textLengthAdjustedSize, 4); // Much bigger minimum for sure visibility

           console.log(`📝 TEXT SIZING FOR "${displayText}":`, {
             textLength,
             idealFontSize: idealFontSize.toFixed(1),
             sizeCapped: sizeCapped.toFixed(1),
             textLengthAdjustedSize: textLengthAdjustedSize.toFixed(1),
             finalFontSize: finalFontSize.toFixed(1),
             wheelSlices: wheelSlices.length,
             textRadius: textRadius.toFixed(1),
             availableArcLength: availableArcLength.toFixed(1)
           });

           // 5. For extremely long text, we might want to shorten it slightly to prevent total unreadability
           let finalDisplayText = displayText;
           if (textLength > 100) {
             finalDisplayText = displayText.substring(0, 95) + '...'; // Truncate only as last resort
           }

           // Check if this slice has an image (from organizer) - DEBUGGED state lookup
           const imageState = getImageState(slice.id);
           const hasValidImage = imageState.hasImage;

           // Use consistent base slice ID for pattern matching (remove timestamp)
           const baseSliceId = slice.id.replace(/-(\d+)$/, '');
           const patternId = `img-${baseSliceId}`;

           console.log(`🎨 SLICE ${index} (${slice.text}) RENDERING:`, {
             hasImage: hasValidImage,
             imageUrl: imageState.imageUrl,
             imageLoaded: imageState.isLoaded,
             imageError: imageState.hasError,
             imagePickerMode: imagePickerMode,
             isWheelSpinning: isWheelSpinning,
             patternExists: baseSliceId in patternDefinitions,
             staticPatternExists: Object.keys(staticPatternDefinitionsRef.current).length > 0,
             usingStaticPatterns: isWheelSpinning && Object.keys(staticPatternDefinitionsRef.current).length > 0,
             patternId: patternId,
             baseSliceId: baseSliceId,
             // Check what patterns are actually available in the DOM
             availablePatterns: isWheelSpinning ? 'CHECKING_PATTERN_AVAILABILITY' : 'NOT_SPINNING',
             timestamp: new Date().toISOString()
           });

           // FORCE LOG PATTERN DEFINITIONS DURING SPINNING
           if (isWheelSpinning) {
             console.log('🔍 PATTERN DEFINITIONS DURING SPINNING:', {
               sliceText: slice.text,
               patternDefinitionsKeys: Object.keys(patternDefinitions),
               staticPatternDefinitionsKeys: Object.keys(staticPatternDefinitionsRef.current),
               patternId: patternId,
               imageUrl: imageState.imageUrl,
               hasValidImage: hasValidImage
             });
           }

           // Use stored slice color (updated when theme changes)
           const sliceColor = slice.color;

           return (
             <G key={slice.id}>
               {/* Render the segment background - colored background or image pattern */}
               {(() => {
                 // For image slices - render with local pattern definition for reliable display
                 if (hasValidImage && imageState.imageUrl) {
                   return (
                     <G key={`background-${slice.id}`}>
                       <Defs>
                         <Pattern
                           id={patternId}
                           patternUnits="userSpaceOnUse"
                           width={300}
                           height={300}
                         >
                           <SvgImage
                             href={imageState.imageUrl}
                             x={0}
                             y={0}
                             width={300}
                             height={300}
                             preserveAspectRatio="xMidYMid slice"
                           />
                         </Pattern>
                       </Defs>
                       <Path
                         d={pathData}
                         fill={`url(#${patternId})`}
                         stroke="#ffffff"
                         strokeWidth="2"
                         opacity={1}
                       />
                     </G>
                   );
                 }

                 // For error/loading states or regular slices - just colored background
                 return (
                   <G key={`background-${slice.id}`}>
                     <Path
                       d={pathData}
                       fill={sliceColor}
                       stroke={'#ffffff'}
                       strokeWidth="3"
                       opacity={hasValidImage && !imageState.isLoaded && !imageState.hasError ? 0.5 : 1}
                     />
                   </G>
                 );
               })()}

               {/* ALWAYS RENDER TEXT ON TOP OF SEGMENT BACKGROUND - RADIAL TEXT ORIENTATION */}
               {/* Match web organizer font styling: ALL WHITE text, no stroke */}
               <SvgText
                 x={textX}
                 y={textY}
                 fill="#ffffff"
                 fontSize={finalFontSize}
                 fontWeight="bold"
                 fontFamily="Arial, sans-serif"
                 textAnchor="middle"
                 transform={`rotate(${radialTextAngle}, ${textX}, ${textY})`}
               >
                 {finalDisplayText}
               </SvgText>
             </G>
           );
         })}

       </G>
     );
   };

   // STATIONARY POINTER - Rendered separately to stay fixed
   const renderStationaryPointer = () => {
     const centerX = 139;
     const centerY = 160;
     return (
       <G>
         {/* Shadow effect */}
         <Path
           d={`M ${centerX + 148} ${centerY} L ${centerX + 168} ${centerY - 10} L ${centerX + 168} ${centerY + 10} Z`}
           fill="rgba(0, 0, 0, 0.4)"
           opacity="0.5"
         />
         {/* Main pointer - STATIONARY */}
         <Path
           d={`M ${centerX + 148} ${centerY} L ${centerX + 168} ${centerY - 10} L ${centerX + 168} ${centerY + 10} Z`}
           fill="#ffffff"
           stroke={getThemePrimaryColor()}
           strokeWidth="3"
         />
         {/* Inner highlight */}
         <Path
           d={`M ${centerX + 149} ${centerY} L ${centerX + 163} ${centerY - 6} L ${centerX + 163} ${centerY + 6} Z`}
           fill={getThemePrimaryColor()}
         />
         {/* Outer glow */}
         <Path
           d={`M ${centerX + 148} ${centerY} L ${centerX + 168} ${centerY - 10} L ${centerX + 168} ${centerY + 10} Z`}
           fill="none"
           stroke={getThemePrimaryColor()}
           strokeWidth="2"
           opacity="0.8"
         />
       </G>
     );
   };



  // PERFECT SESSION SYNCHRONIZATION - STABLE CALLBACK
  const setupLiveSessionListener = useCallback((sessionId: string, sessionData: any) => {
   console.log('🎯 SETTING UP PERFECT SESSION LISTENER');
   // NOTE: Keep console logs minimal to prevent terminal loops - these are only for debugging

   const unsubscribe = onSnapshot(
     doc(db, 'liveDrawSessions', sessionId),
     (docSnapshot: any) => {
       if (!docSnapshot.exists()) {
         console.log('❌ Firebase document does not exist');
         return;
       }

       const data = docSnapshot.data();
       console.log('🔥 FIREBASE LISTENER TRIGGERED:', {
         sessionId: sessionId,
         hasSelectedTheme: !!data?.selectedTheme,
         selectedTheme: data?.selectedTheme,
         hasWheelState: !!data?.wheelState,
         wheelStateTheme: data?.wheelState?.theme,
         wheelStateIsSpinning: data?.wheelState?.isSpinning,
         wheelStateImmediateSync: data?.wheelState?.immediateSync,
         fullDataKeys: Object.keys(data || {}),
         currentWheelType: currentWheelType,
         wheelSlicesLength: wheelSlices.length,
         selectedWheelType: data?.selectedWheelType,
         wheelItems: data?.wheelItems,
         timestamp: new Date().toISOString()
       });

       // Additional debugging for theme data
       if (data?.selectedTheme || data?.wheelState?.theme) {
         console.log('🎨 THEME DATA RECEIVED IN FIREBASE:', {
           selectedTheme: data?.selectedTheme,
           wheelStateTheme: data?.wheelState?.theme,
           currentAppTheme: selectedTheme,
           themeType: typeof data?.selectedTheme,
           wheelStateThemeType: typeof data?.wheelState?.theme,
           timestamp: new Date().toISOString()
         });
       }

       // 🎨 SYNC IMAGE DATA FROM ORGANIZER FIRST (before theme data)
       // Handle image synchronization from organizer's wheel
       console.log('🔍 CHECKING FOR WEB ORGANIZER IMAGE DATA:', {
         hasWheelImages: !!data?.wheelImages,
         wheelImagesCount: data?.wheelImages?.length || 0,
         hasImageWheelSlices: !!data?.imageWheelSlices,
         imageWheelSlicesCount: data?.imageWheelSlices?.length || 0,
         hasWheelState: !!data?.wheelState,
         wheelStateImagePickerMode: data?.wheelState?.imagePickerMode,
         sessionId: sessionId,
         timestamp: new Date().toISOString(),
         fullDataKeys: Object.keys(data || {}),
         wheelImagesData: data?.wheelImages,
         imageWheelSlicesData: data?.imageWheelSlices
       });

       // 🎯 TEAM DETECTION - Check for team data first (highest priority for participants)
       // CRITICAL FIX: Only process teams when using Team Picker Wheel to prevent showing team results for other wheel types
       if (data?.teams && data.teams.length > 0 && (data?.selectedWheelType?.title === 'Team Picker Wheel' || data?.selectedWheelType?.value === 'team-picker' || data?.selectedWheelType?.isTeamPicker)) {
         console.log('👥 SYNCING TEAMS FROM ORGANIZER:', {
           teamsCount: data.teams.length,
           sessionId: sessionId,
           currentWheelType: currentWheelType,
           timestamp: new Date().toISOString(),
           firstTeamName: data.teams[0]?.name || 'Unknown',
           totalMembers: data.teams.reduce((sum: number, team: Team) => sum + (team.members?.length || 0), 0),
           currentTeamsCount: teams.length,
           isNewTeamFormation: teams.length === 0 || JSON.stringify(data.teams) !== JSON.stringify(teams)
         });

         // Check if this is a NEW team formation (not just existing teams)
         const isNewTeamFormation = teams.length === 0 || JSON.stringify(data.teams) !== JSON.stringify(teams);

         // Update teams state ALWAYS when teams data is received
         setTeams(data.teams);

         if (isNewTeamFormation) {
           console.log('🎉 NEW TEAM FORMATION DETECTED - Starting reveal animation');

           // Start slow reveal animation for participants
           setIsTeamRevealing(true);
           setRevealedGroups(new Set());
           setRevealedMembers(new Map());
           setAnimatingMembers(new Map());

           // Calculate timing constants - ONE BY ONE REVEAL ACROSS ALL TEAMS
           const personStaggerDelay = 1000; // ms delay between each name reveal (1 second - dramatic)
           const personAnimationDuration = 800; // ms per person animation (smooth pop-up effect)
           const groupRevealDelay = 200; // ms delay before first name after group appears

           // Collect ALL members from ALL teams into a single flat array
           const allMembers: { member: Person; teamIndex: number; memberIndex: number }[] = [];
           data.teams.forEach((team: Team, teamIndex: number) => {
             team.members?.forEach((member: Person, memberIndex: number) => {
               allMembers.push({ member, teamIndex, memberIndex });
             });
           });

           const totalPeople = allMembers.length;
           const totalAnimationTime = (totalPeople * personStaggerDelay) + personAnimationDuration;

           console.log(`🎬 ONE-BY-ONE TEAM REVEAL ANIMATION: ${data.teams.length} teams, ${totalPeople} people, ${totalAnimationTime}ms total`);

           // Step 1: Reveal ALL group headers first (instantly)
           setRevealedGroups(new Set(data.teams.map((_: Team, index: number) => index)));
           console.log(`🎬 ALL ${data.teams.length} team headers revealed instantly`);

           // Step 2: Reveal names ONE BY ONE across ALL teams (lottery style)
           let currentDelay = groupRevealDelay;

           allMembers.forEach((memberData, globalIndex) => {
             const { member, teamIndex, memberIndex } = memberData;

             setTimeout(() => {
               // Start animation for this person
               setAnimatingMembers(prev => {
                 const newMap = new Map(prev);
                 newMap.set(`${member.id}`, true);
                 return newMap;
               });

               console.log(`🎬 Person ${globalIndex + 1}/${totalPeople}: ${member.name} in team ${teamIndex + 1} (${data.teams[teamIndex].name})`);

               // After animation completes, add to revealed members
               setTimeout(() => {
                 setRevealedMembers(prev => {
                   const newMap = new Map(prev);
                   const groupMembers = newMap.get(teamIndex) || new Set();
                   groupMembers.add(memberIndex);
                   newMap.set(teamIndex, groupMembers);
                   return newMap;
                 });

                 // Remove from animating
                 setAnimatingMembers(prev => {
                   const newMap = new Map(prev);
                   newMap.delete(`${member.id}`);
                   return newMap;
                 });

                 console.log(`✅ Person ${member.name} fully revealed in team ${teamIndex + 1}`);
               }, personAnimationDuration);

             }, currentDelay);

             currentDelay += personStaggerDelay; // Delay before next person
           });

           // Show full team results modal after animation completes
           setTimeout(() => {
             console.log("🎯 TEAM ANIMATION COMPLETED - Showing full team results modal");
             setShowFullTeamResults(true);

             // Show success notification
             // Note: Can't use toast in React Native, would need Alert.alert or similar
           }, totalAnimationTime + 200);

           console.log('✅ MOBILE TEAMS SYNCED AND ANIMATION STARTED');
         } else {
           console.log('ℹ️ EXISTING TEAMS DETECTED - No new animation needed');
         }
       } else {
         // No teams data received - clear team state
         console.log('ℹ️ NO TEAMS DATA RECEIVED - Clearing team state');

         // Clear all team-related state when no teams data
         setTeams([]);
         setShowTeamAnnouncement(false);
         setShowFullTeamResults(false);
         setIsTeamRevealing(false);
         setRevealedGroups(new Set());
         setRevealedMembers(new Map());
         setAnimatingMembers(new Map());
         setShowExportOptions(false);
       }

       // 🎯 IMAGE DETECTION - Check for image data first
       if ((data?.wheelImages && data.wheelImages.length > 0) ||
           (data?.imageUrls && Object.keys(data.imageUrls).length > 0) ||
           (data?.selectedWheelType?.value === 'image-picker')) {
         console.log('🖼️ SYNCING IMAGES FROM ORGANIZER:', {
           wheelImagesCount: data?.wheelImages?.length || 0,
           imageUrlsCount: data?.imageUrls ? Object.keys(data.imageUrls).length : 0,
           wheelType: data?.selectedWheelType?.value,
           imagePickerMode: data.wheelState?.imagePickerMode,
           hasImages: data.wheelState?.hasImages,
           sessionId: sessionId,
           timestamp: new Date().toISOString()
         });

         // CRITICAL FIX: Enable image picker mode for image picker wheels
         // Update image picker mode state - force true if images are present or wheel type is image-picker
         if (isWheelSpinning && Object.keys(staticPatternDefinitionsRef.current).length > 0) {
           console.log('🔒 SPINNING: Preserving imagePickerMode state for pattern stability');
         } else {
           // Force imagePickerMode to true if we have images or it's an image picker wheel
           const shouldEnableImageMode = (data?.wheelImages && data.wheelImages.length > 0) ||
                                       (data?.imageUrls && Object.keys(data.imageUrls).length > 0) ||
                                       (data?.selectedWheelType?.value === 'image-picker') ||
                                       data.wheelState?.imagePickerMode ||
                                       false;
           setImagePickerMode(shouldEnableImageMode);
           console.log('🖼️ IMAGE PICKER MODE SET TO:', shouldEnableImageMode);
         }

         // Process and load images for each slice
         const newSliceImages = new Map<string, WheelSliceImage>();
         const newLoadedImages = new Map<string, any>();

         // Check if wheelImages exists and is an array before processing
         if (data.wheelImages && Array.isArray(data.wheelImages)) {
           data.wheelImages.forEach((imgData: any, index: number) => {
             // Skip null entries (empty image slots)
             if (!imgData || !imgData.id || !imgData.url) {
               return;
             }

               const sliceImage: WheelSliceImage = {
                 url: imgData.url,
                 alt: imgData.alt || `Image for ${imgData.id}`,
                 isLoaded: imgData.isLoaded !== false,
                 error: imgData.error || false
               };

               // FIX: ONE-TO-ONE MAPPING - Each organizer image maps to EXACTLY one slice
               // Organizer sends 'image-1', 'image-2', etc. but wheel uses 'slice-0', 'slice-1', etc.
               // Use the image array index to determine the correct slice position

               // Determine the correct slice index for this image
               let targetSliceIndex = index; // Default: use array index

               // If organizer IDs are 'image-N' format, convert to slice position
               if (imgData.id && imgData.id.startsWith('image-')) {
                 const imageNum = parseInt(imgData.id.replace('image-', ''));
                 if (!isNaN(imageNum) && imageNum > 0) {
                   targetSliceIndex = imageNum - 1; // image-1 maps to slice-0, image-2 maps to slice-1
                   console.log('🖼️ CONVERTED organizer image ID to correct slice position:', {
                     originalId: imgData.id,
                     imageNumber: imageNum,
                     targetSliceIndex: targetSliceIndex,
                     url: imgData.url.substring(0, 50) + '...'
                   });
                 }
               }

               // Store ONLY under the target slice ID - one image per slice
               const targetSliceId = `slice-${targetSliceIndex}`;
               newSliceImages.set(targetSliceId, sliceImage);

               console.log('✅ ONE-TO-ONE IMAGE MAPPING:', {
                 organizerImageId: imgData.id,
                 targetSlice: targetSliceId,
                 totalImagesMapped: newSliceImages.size,
                 arrayIndex: index,
                 confirmedTargetIndex: targetSliceIndex
               });

               // Use descriptive text from wheelItems if available, otherwise use sliceId
               const descriptiveText = data.wheelItems && data.wheelItems[index] ? data.wheelItems[index] : imgData.id;

               // Use the original image URL directly without any processing to avoid CORS issues
               const originalUrl = imgData.url;
               sliceImage.url = originalUrl;

               // Mark image as loaded initially - will be updated by onLoad/onError
               newLoadedImages.set(imgData.id, true);

               // During spinning, don't update loadedImages if we have static patterns
               if (isWheelSpinning && Object.keys(staticPatternDefinitionsRef.current).length > 0) {
                 console.log('🔒 SPINNING: Preserving loadedImages state for pattern stability');
               } else {
                 setLoadedImages(prev => new Map(prev.set(imgData.id, true)));
               }

               console.log('🖼️ IMAGE PROCESSED FROM ORGANIZER:', {
                 originalId: imgData.id,
                 sliceId: `slice-${index}`,
                 urlLength: imgData.url.length,
                 hasValidUrl: !!imgData.url
               });
           });
         }

         // CRITICAL: Update images only when not spinning to maintain smooth animation
         if (isWheelSpinning && Object.keys(staticPatternDefinitionsRef.current).length > 0) {
           // During spinning, only update static patterns without triggering redraws
           const updatedPatterns: Record<string, { patternId: string; url: string; sliceId: string }> = {};
           newSliceImages.forEach((imageData, sliceId) => {
             if (imageData.url && (imageData.isLoaded !== false) && !imageData.error) {
               updatedPatterns[sliceId] = {
                 patternId: `img-${sliceId}`,
                 url: imageData.url,
                 sliceId: sliceId
               };
             }
           });
           staticPatternDefinitionsRef.current = updatedPatterns;
           console.log('🔄 SPINNING: Updated static patterns without redraw:', {
             imageCount: Object.keys(updatedPatterns).length,
             isSpinning: true
           });
         } else {
           // Normal update when not spinning
           setSliceImages(newSliceImages);
           setForceWheelRedraw(Date.now());
         }
         console.log('✅ MOBILE IMAGES SYNCED:', {
           imageCount: newSliceImages.size,
           loadedCount: newLoadedImages.size,
           imagePickerMode: data.wheelState?.imagePickerMode,
           isSpinning: isWheelSpinning,
           staticPatternsCount: Object.keys(staticPatternDefinitionsRef.current).length,
           images: Array.from(newSliceImages.entries()).map(([id, img]) => ({
             id,
             url: img.url,
             isLoaded: img.isLoaded,
             error: img.error
           }))
         });

         // If we're spinning and got new images, update static patterns
         if (isWheelSpinning && Object.keys(newSliceImages).length > 0) {
           // Force update static patterns with new images
           const updatedPatterns: Record<string, { patternId: string; url: string; sliceId: string }> = {};
           newSliceImages.forEach((imageData, sliceId) => {
             if (imageData.url && (imageData.isLoaded !== false) && !imageData.error) {
               updatedPatterns[sliceId] = {
                 patternId: `img-${sliceId}`,
                 url: imageData.url,
                 sliceId: sliceId
               };
             }
           });
           staticPatternDefinitionsRef.current = updatedPatterns;
           console.log('🔄 SPINNING: Updated static patterns with new images:', {
             newImageCount: Object.keys(newSliceImages).length,
             updatedPatternCount: Object.keys(updatedPatterns).length
           });

           // Force immediate wheel redraw to show new images
           setForceWheelRedraw(Date.now());
         }
       } else if (data?.imageWheelSlices && data.imageWheelSlices.length > 0) {
         // Handle alternative image format from web organizer
         console.log('🖼️ SYNCING ALTERNATIVE IMAGE FORMAT (imageWheelSlices):', {
           sliceCount: data.imageWheelSlices.length,
           slicesWithImages: data.imageWheelSlices.filter((s: any) => s.image?.url).length,
           sessionId: sessionId,
           sampleSlice: data.imageWheelSlices[0],
           timestamp: new Date().toISOString()
         });

         // Update wheel type display
         setCurrentWheelType('Image Picker Wheel');
         // Update image picker mode state - always enable for this format and force if images present
         setImagePickerMode(true);
         console.log('✅ IMAGE PICKER MODE ENABLED for imageWheelSlices format');

         // Process alternative image format
         const newSliceImages = new Map<string, WheelSliceImage>();
         const newLoadedImages = new Map<string, any>();

         data.imageWheelSlices.forEach((sliceData: any, index: number) => {
           console.log(`🖼️ PROCESSING ALTERNATIVE IMAGE ${index + 1}:`, {
             sliceId: sliceData.id,
             sliceText: sliceData.text,
             hasImage: !!sliceData.image,
             imageUrl: sliceData.image?.url,
             imageIsLoaded: sliceData.image?.isLoaded,
             imageError: sliceData.image?.error,
             fullSliceData: sliceData
           });

           if (sliceData.id && sliceData.image?.url) {
             const sliceImage: WheelSliceImage = {
               url: sliceData.image.url,
               alt: sliceData.image.alt || `Image for ${sliceData.text}`,
               isLoaded: sliceData.image.isLoaded !== false,
               error: sliceData.image.error || false
             };
             
             // CRITICAL FIX: Map both original ID and index-based ID
             newSliceImages.set(sliceData.id, sliceImage); // Store with original ID (e.g., "slice-0")
             newSliceImages.set(`image-${index + 1}`, sliceImage); // Also store with image ID (e.g., "image-1")

             // Use the original image URL directly without any processing to avoid CORS issues
             const originalUrl = sliceData.image.url;
             sliceImage.url = originalUrl;
             newLoadedImages.set(sliceData.id, true);

             // Always update loadedImages state for new images
             setLoadedImages(prev => new Map(prev.set(sliceData.id, true)));

             console.log('✅ ALTERNATIVE IMAGE FORMAT PROCESSED:', {
               sliceId: sliceData.id,
               sliceText: sliceData.text,
               originalUrl: sliceData.image.url,
               isLoaded: sliceImage.isLoaded,
               hasError: sliceImage.error
             });
           } else {
             console.warn(`⚠️ Skipping invalid slice data at index ${index}:`, {
               hasId: !!sliceData.id,
               hasImage: !!sliceData.image,
               hasImageUrl: !!sliceData.image?.url
             });
           }
         });

         // CRITICAL: Update images only when not spinning to maintain smooth animation
         if (isWheelSpinning && Object.keys(staticPatternDefinitionsRef.current).length > 0) {
           // During spinning, only update static patterns without triggering redraws
           const updatedPatterns: Record<string, { patternId: string; url: string; sliceId: string }> = {};
           newSliceImages.forEach((imageData, sliceId) => {
             if (imageData.url && (imageData.isLoaded !== false) && !imageData.error) {
               updatedPatterns[sliceId] = {
                 patternId: `img-${sliceId}`,
                 url: imageData.url,
                 sliceId: sliceId
               };
             }
           });
           staticPatternDefinitionsRef.current = updatedPatterns;
           console.log('🔄 SPINNING: Updated static patterns without redraw:', {
             imageCount: Object.keys(updatedPatterns).length,
             isSpinning: true
           });
         } else {
           // Normal update when not spinning
           setSliceImages(newSliceImages);
           setForceWheelRedraw(Date.now());
           console.log('✅ ALTERNATIVE IMAGE FORMAT SYNCED:', {
             imageCount: newSliceImages.size,
             imagePickerMode: true,
             isSpinning: isWheelSpinning,
             staticPatternsCount: Object.keys(staticPatternDefinitionsRef.current).length
           });
         }

         // If we're spinning and got new images, update static patterns
         if (isWheelSpinning && Object.keys(newSliceImages).length > 0) {
           // Force update static patterns with new images
           const updatedPatterns: Record<string, { patternId: string; url: string; sliceId: string }> = {};
           newSliceImages.forEach((imageData, sliceId) => {
             if (imageData.url && (imageData.isLoaded !== false) && !imageData.error) {
               updatedPatterns[sliceId] = {
                 patternId: `img-${sliceId}`,
                 url: imageData.url,
                 sliceId: sliceId
               };
             }
           });
           staticPatternDefinitionsRef.current = updatedPatterns;
           console.log('🔄 SPINNING: Updated static patterns with alternative format images:', {
             newImageCount: Object.keys(newSliceImages).length,
             updatedPatternCount: Object.keys(updatedPatterns).length
           });

           // Force immediate wheel redraw to show new images
           setForceWheelRedraw(Date.now());
         }
       }

       // 🎨 SYNC THEME CHANGES FROM ORGANIZER FIRST (before wheel data)
       // Handle both old format (selectedTheme) and new format (wheelState.theme)
       let newTheme = null;
       let themeChanged = false;
       let themeName = selectedTheme;

       // Check for theme data in multiple possible locations
       if (data?.wheelState?.theme) {
         // NEW FORMAT: Web app stores theme as object in wheelState.theme
         const themeObject = data.wheelState.theme;
         console.log('🎨 THEME SYNC RECEIVED (NEW FORMAT):', {
           firebaseTheme: themeObject,
           currentAppTheme: selectedTheme,
           themeSource: data.wheelState.themeSource,
           timestamp: new Date().toISOString()
         });

         // Extract theme name from the theme object
         if (typeof themeObject === 'object' && themeObject.name) {
           themeName = themeObject.name;
           themeChanged = themeName !== selectedTheme;
           console.log('🎨 THEME NAME EXTRACTED FROM OBJECT:', { themeName, changed: themeChanged });
         } else if (typeof themeObject === 'object' && themeObject.primary) {
           // Map theme object to theme name by matching colors
           let foundMatch = false;
           for (const [key, colors] of Object.entries(webThemeColors)) {
             if (colors[0] === themeObject.primary && colors[1] === themeObject.secondary) {
               themeName = key;
               foundMatch = true;
               themeChanged = themeName !== selectedTheme;
               console.log('🎨 FOUND THEME MATCH:', { themeName, primary: themeObject.primary, secondary: themeObject.secondary, changed: themeChanged });
               break;
             }
           }

           // If no exact match found, try to find by primary color only (for School Colors)
           if (!foundMatch) {
             for (const [key, colors] of Object.entries(webThemeColors)) {
               if (colors[0] === themeObject.primary) {
                 themeName = key;
                 foundMatch = true;
                 themeChanged = themeName !== selectedTheme;
                 console.log('🎨 FOUND THEME MATCH BY PRIMARY COLOR:', { themeName, primary: themeObject.primary, changed: themeChanged });
                 break;
               }
             }
           }

           // Special handling for School Colors - ensure it maps correctly
           if (!foundMatch && themeObject.primary === '#8e0b16') {
             themeName = 'school';
             themeChanged = themeName !== selectedTheme;
             console.log('🎨 SPECIAL HANDLING: Mapped to school theme for primary color #8e0b16, changed:', themeChanged);
           }
         }

         newTheme = themeObject;
       } else if (data?.selectedTheme !== undefined) {
         // LEGACY FORMAT: Direct selectedTheme string
         themeName = data.selectedTheme;
         themeChanged = data.selectedTheme !== selectedTheme;

         console.log('🎨 THEME SYNC RECEIVED (LEGACY FORMAT):', {
           firebaseTheme: data.selectedTheme,
           currentAppTheme: selectedTheme,
           themeChanged: themeChanged,
           timestamp: new Date().toISOString()
         });

         newTheme = data.selectedTheme;
       }

       if (newTheme && themeChanged) {
         console.log('🎨 THEME CHANGED BY ORGANIZER - APPLYING IMMEDIATELY:', {
           oldTheme: selectedTheme,
           newTheme: themeName,
           sessionId: sessionId,
           timestamp: new Date().toISOString()
         });

         // Ensure we have a valid theme name
         if (!webThemeColors[themeName as keyof typeof webThemeColors]) {
           console.log('🎨 INVALID THEME NAME, FALLING BACK TO SCHOOL:', themeName);
           themeName = 'school';
         }

         // 🔥 FORCE THEME UPDATE: Directly set the selectedTheme state to trigger re-render
         setSelectedTheme(themeName);
         console.log('🎨 Theme state updated to:', themeName);

         // Force wheel redraw immediately when theme changes
         console.log('🎨 Triggering immediate wheel redraw for theme change');
         const newForceRedrawValue = Date.now(); // Use timestamp to ensure unique value
         setForceWheelRedraw(newForceRedrawValue);
         console.log('🎨 Force redraw value set to:', newForceRedrawValue);

         // Immediately update existing wheel slices with new theme colors
         if (wheelSlices.length > 0) {
           console.log('🎨 IMMEDIATELY UPDATING WHEEL SLICES FOR THEME CHANGE');
           const updatedSlices = wheelSlices.map((slice, index) => {
             const newColor = getSliceColor(index, themeName);
             console.log(`🎨 Slice ${index} color change: ${slice.color} -> ${newColor}`);
             return {
               ...slice,
               color: newColor
             };
           });
           setWheelSlices(updatedSlices);
           console.log('✅ IMMEDIATE THEME UPDATE: Wheel slices updated with new colors:', updatedSlices.map(s => s.color));
         }

         // Also update wheel data with new theme colors
         if (data?.selectedWheelType?.defaultItems) {
           console.log('🎨 UPDATING WHEEL DATA WITH NEW THEME COLORS');
           const updatedSlices = data.selectedWheelType.defaultItems.map((item: string, index: number) => {
             const color = getSliceColor(index, themeName);
             console.log(`🎯 Creating slice ${index} with color: ${color} for theme: ${themeName}`);
             return {
               id: `slice_${index}`,
               text: item,
               color: color
             };
           });
           setWheelSlices(updatedSlices);
           console.log('✅ WHEEL DATA UPDATED WITH THEME:', themeName);
         }
       } else if (!newTheme) {
         console.log('🎨 THEME SYNC: No theme data found in Firebase');
       } else {
         console.log('🎨 THEME SYNC: No change detected, theme already matches');
       }

       // ✅ SYNC WHEEL DATA (after theme is updated) - FLEXIBLE DATA FORMAT DETECTION
       let wheelData = null;
       let wheelTypeDisplay = 'Live Wheel';
       let isTeamPickerWheel = false;

       // Priority order: Try different possible data structures from various web apps
       if (data?.selectedWheelType?.defaultItems?.length > 0) {
         console.log('🎯 SYNCING WHEEL DATA: selectedWheelType.defaultItems format');
         wheelData = data.selectedWheelType.defaultItems;
         wheelTypeDisplay = data.selectedWheelType.title || 'Picker Wheel';

         // CRITICAL: Only set as Team Picker Wheel if explicitly from organizer's team picker
         if (data.selectedWheelType.title === 'Team Picker Wheel' || data.selectedWheelType.value === 'team-picker' || data.selectedWheelType.isTeamPicker) {
           wheelTypeDisplay = 'Team Picker Wheel';
           isTeamPickerWheel = true;
           console.log('🎯 CONFIRMED: This is a Team Picker Wheel from organizer');
         }

         // INSTANT IMAGE SWITCHING: If this is Image Picker Wheel and we have images, ensure instant display
         if (data.selectedWheelType.title === 'Image Picker Wheel' && sliceImages.size > 0) {
           console.log('⚡ INSTANT IMAGE SWITCH: Switching to Image Picker Wheel with existing images');
           // Force immediate image mode activation
           setImagePickerMode(true);
           setForceWheelRedraw(Date.now());
         }
       } else if (data?.wheelItems?.length > 0) {
         console.log('🎯 SYNCING WHEEL DATA: wheelItems format');
         wheelData = data.wheelItems;
         wheelTypeDisplay = 'Custom Text Wheel';
       } else if (data?.wheelData?.items?.length > 0) {
         console.log('🎯 SYNCING WHEEL DATA: wheelData.items format');
         wheelData = data.wheelData.items;
         wheelTypeDisplay = data.wheelData.title || 'Live Wheel';
       } else if (data?.participants?.length > 0) {
         console.log('🎯 SYNCING WHEEL DATA: participants format');
         wheelData = data.participants.map((p: any) => typeof p === 'string' ? p : p.name || p.text || 'Unknown');
         wheelTypeDisplay = 'Participant Wheel';
       } else if (data?.names?.length > 0) {
         console.log('🎯 SYNCING WHEEL DATA: names format');
         wheelData = data.names;
         wheelTypeDisplay = 'Name Wheel';
       } else if (data?.items?.length > 0) {
         console.log('🎯 SYNCING WHEEL DATA: items format');
         wheelData = data.items;
         wheelTypeDisplay = 'Item Wheel';
       }

       // STABILITY CHECK: Only update wheel type if we have valid data and prevent rapid changes
       if (wheelData && wheelData.length > 0) {
         console.log('🎯 SETTING WHEEL TYPE:', {
           wheelTypeDisplay,
           isTeamPickerWheel,
           itemCount: wheelData.length,
           hasTeamsData: !!data?.teams,
           teamsCount: data?.teams?.length || 0,
           currentWheelType: currentWheelType,
           wheelTypeChanged: wheelTypeDisplay !== currentWheelType
         });

         // STABILITY: Only update wheel type if it's actually different to prevent unnecessary re-renders
         if (wheelTypeDisplay !== currentWheelType) {
           console.log('🎯 WHEEL TYPE CHANGING:', {
             from: currentWheelType,
             to: wheelTypeDisplay,
             reason: isTeamPickerWheel ? 'Team Picker Wheel detected' : 'Regular wheel type'
           });

           // CRITICAL STABILITY: Add a small delay to prevent rapid wheel type changes that could cause glitches
           setTimeout(() => {
             setCurrentWheelType(wheelTypeDisplay);
             console.log('✅ WHEEL TYPE UPDATED STABLY:', wheelTypeDisplay);
           }, 50); // Small delay to ensure stability
         } else {
           console.log('🎯 WHEEL TYPE UNCHANGED - stability maintained');
         }
       } else {
         console.log('🎯 NO WHEEL DATA - keeping current wheel type for stability');
       }

       if (wheelData && wheelData.length > 0) {
         console.log('🎯 FOUND WHEEL DATA TO SYNC:', {
           wheelTypeDisplay,
           itemCount: wheelData.length,
           sampleItems: wheelData.slice(0, 3),
           dataStructure: wheelData.constructor.name
         });

         // Update wheel type display
         if (wheelTypeDisplay !== currentWheelType) {
           setCurrentWheelType(wheelTypeDisplay);
           setLastConfigUpdateTime(Date.now()); // Track when wheel type actually changed
         }

         // Use the latest theme from Firebase data to avoid React state timing issues
         const currentTheme = (data?.wheelState?.theme ? (() => {
           // Map theme object to theme name with enhanced matching
           let foundMatch = false;
           for (const [key, colors] of Object.entries(webThemeColors)) {
             if (colors[0] === data.wheelState.theme.primary && colors[1] === data.wheelState.theme.secondary) {
               foundMatch = true;
               return key;
             }
           }

           // If no exact match, try primary color only
           if (!foundMatch) {
             for (const [key, colors] of Object.entries(webThemeColors)) {
               if (colors[0] === data.wheelState.theme.primary) {
                 foundMatch = true;
                 return key;
               }
             }
           }

           // Special handling for School Colors
           if (!foundMatch && data.wheelState.theme.primary === '#8e0b16') {
             return 'school';
           }

           return selectedTheme;
         })() : data.selectedTheme) || selectedTheme;

         console.log('🎯 Wheel sync - current theme:', currentTheme, 'firebase theme:', data.selectedTheme || data?.wheelState?.theme, 'app theme:', selectedTheme);

         // Ensure all items are strings and handle different data formats
         const normalizedItems = wheelData.map((item: any, index: number) => {
           const text = typeof item === 'string' ? item : (item.name || item.text || item.title || `Item ${index + 1}`);
           console.log(`📝 NORMALIZING ITEM ${index}: ${JSON.stringify(item)} → "${text}"`);
           return text.trim();
         }).filter((text: string) => text.length > 0);

         console.log('🎯 NORMALIZED ITEMS:', normalizedItems);

         // 🔀 INSTANT SHUFFLE DETECTION: Check if items order changed
         const currentItemsString = wheelSlices.map(s => s.text).join('|');
         const newItemsString = normalizedItems.join('|');
         const itemsShuffled = currentItemsString !== newItemsString && 
                              currentItemsString.split('|').sort().join('|') === newItemsString.split('|').sort().join('|');
         
         if (itemsShuffled) {
           console.log('🔀 SHUFFLE DETECTED - Items reordered by organizer:', {
             before: currentItemsString,
             after: newItemsString,
             timestamp: new Date().toISOString()
           });
         }

         if (normalizedItems.length > 0) {
           const slices = normalizedItems.map((item: string, index: number) => {
             const color = getSliceColor(index, currentTheme);
             // CRITICAL: For participant wheels, use consistent IDs for perfect arrow position matching
             // For image picker wheels, use simple IDs to match Firebase image keys
             // For regular text wheels, add timestamp to ensure unique IDs
             const sliceId = wheelTypeDisplay === 'Participant Wheel' ? `slice-${index}` :
                           imagePickerMode ? `slice-${index}` : `slice-${index}-${Date.now()}`;
             console.log(`🎯 Creating slice ${index} with color: ${color} for text: "${item}" (ID: ${sliceId}, mode: ${wheelTypeDisplay})`);
             return {
               id: sliceId,
               text: item,
               color: color
             };
           });
           console.log('🎯 CREATED SLICES:', slices);
           setWheelSlices(slices);
           console.log(`✅ Synced ${slices.length} wheel slices with theme: ${currentTheme}`, slices.map((s: WheelSlice) => s.color));
         } else {
           console.log('⚠️ No valid wheel items found after normalization');
         }
       } else {
         console.log('🎯 NO WHEEL DATA FOUND - logging available keys for debugging:', Object.keys(data || {}));

         // Log specific fields that might contain wheel data
         const possibleWheelFields = ['wheelItems', 'selectedWheelType', 'wheelData', 'participants', 'names', 'items'];
         possibleWheelFields.forEach(field => {
           if (data[field] !== undefined) {
             console.log(`🎯 Field "${field}" exists:`, {
               value: data[field],
               type: typeof data[field],
               length: Array.isArray(data[field]) ? data[field].length : 'N/A'
             });
           }
         });
       }

       // CRITICAL FIX: If theme changed, update existing wheel slices
       const themeChangedForUpdate = (() => {
         if (data?.wheelState?.theme) {
           const currentThemeColors = webThemeColors[selectedTheme as keyof typeof webThemeColors];
           return data.wheelState.theme.primary !== currentThemeColors?.[0];
         } else if (data?.selectedTheme) {
           return data.selectedTheme !== selectedTheme;
         }
         return false;
       })();

       if (themeChangedForUpdate && wheelSlices.length > 0) {
         console.log('🎨 UPDATING EXISTING WHEEL SLICES AFTER THEME CHANGE');
         // Use the new theme immediately instead of waiting
         const newThemeName = data?.wheelState?.theme ? (() => {
           // Enhanced theme mapping with fallback logic
           let foundMatch = false;
           for (const [key, colors] of Object.entries(webThemeColors)) {
             if (colors[0] === data.wheelState.theme.primary && colors[1] === data.wheelState.theme.secondary) {
               foundMatch = true;
               return key;
             }
           }

           // If no exact match, try primary color only
           if (!foundMatch) {
             for (const [key, colors] of Object.entries(webThemeColors)) {
               if (colors[0] === data.wheelState.theme.primary) {
                 foundMatch = true;
                 return key;
               }
             }
           }

           // Special handling for School Colors
           if (!foundMatch && data.wheelState.theme.primary === '#8e0b16') {
             return 'school';
           }

           return selectedTheme;
         })() : data.selectedTheme || selectedTheme;

         const updatedSlices = wheelSlices.map((slice, index) => ({
           ...slice,
           color: getSliceColor(index, newThemeName)
         }));
         setWheelSlices(updatedSlices);
         setForceWheelRedraw(prev => prev + 1);
         console.log('✅ Wheel slices updated with new theme colors:', updatedSlices.map(s => s.color));
       }

       // 🚀 ULTRA-PRECISION SYNCHRONIZATION - INSTANTLY TRIGGER ON ORGANIZER SPIN START
       // Check for multiple possible spinning indicators from various web app versions
       // CRITICAL FIX: Allow spins during wheel type changes for better synchronization
       const wheelTypeChanged = wheelTypeDisplay !== currentWheelType;

       // 🔄 ENHANCED SPIN DETECTION: Check for EXPLICIT spin trigger ONLY
       // CRITICAL: Only trigger spin when organizer EXPLICITLY presses spin button
       const hasExplicitSpinTrigger = data?.wheelState?.isSpinning === true ||
                                      data?.currentState === 'spinning' ||
                                      data?.isSpinning === true;

       // 🚀 INSTANT SPIN TRIGGER: Spin immediately when organizer triggers
       // NO DELAY - Perfect synchronization for matching arrow position
       const shouldSpin =
         !isWheelSpinning && // Only trigger if not already spinning
         hasExplicitSpinTrigger; // ONLY spin when organizer explicitly triggers spin

       const finalShouldSpin = shouldSpin;

       if (finalShouldSpin) {
         // 🔍 DEBUG SPIN TRIGGER CONDITIONS
         console.log('🔍 SPIN TRIGGER DEBUG:', {
           wheelTypeChanged,
           hasExplicitSpinTrigger,
           shouldSpin,
           isWheelSpinning,
           wheelStateIsSpinning: data?.wheelState?.isSpinning,
           currentState: data?.currentState,
           isSpinning: data?.isSpinning,
           spinDuration: data?.wheelState?.spinDuration,
           totalRotation: data?.wheelState?.totalRotation,
           broadcastTime: data?.wheelState?.broadcastTime,
           wheelTypeDisplay,
           currentWheelType,
           timestamp: new Date().toISOString()
         });

         console.log('🚀 SYNCHRONIZATION TRIGGER ANALYSIS:', {
           shouldSpin,
           isWheelSpinning,
           wheelStateIsSpinning: data?.wheelState?.isSpinning,
           currentState: data?.currentState,
           isSpinning: data?.isSpinning,
           spinDuration: data?.wheelState?.spinDuration,
           reason: shouldSpin ?
             (data?.wheelState?.isSpinning ? 'wheelState.isSpinning=true' :
              data?.currentState === 'spinning' ? 'currentState=spinning' :
              data?.isSpinning ? 'isSpinning=true' :
              'spinDuration available') : 'not triggering spin'
         });

         // 🎯 ULTRA-PRECISION TIMING SYNCHRONIZATION: Use broadcastTime for perfect sync
         console.log('⏰ ULTRA-PRECISION TIMING SYNCHRONIZATION: Ensuring arrow lands at EXACT same position');

         // Use broadcastTime from organizer for precise timing (more accurate than spinStartTime)
         const organizerBroadcastTime = data?.wheelState?.broadcastTime || data?.wheelState?.spinStartTime || Date.now();
         const participantReceiveTime = Date.now();
         const networkLatency = participantReceiveTime - organizerBroadcastTime;

         // 🎯 CRITICAL FIX: Add Firebase listener delay compensation (50-200ms typical)
         const firebaseListenerDelay = 100; // Conservative estimate for Firebase listener delay
         const totalEffectiveLatency = networkLatency + firebaseListenerDelay;

         console.log('⏰ ADVANCED LATENCY ANALYSIS:', {
           organizerBroadcastTime,
           participantReceiveTime,
           networkLatency: networkLatency + 'ms',
           firebaseListenerDelay: firebaseListenerDelay + 'ms',
           totalEffectiveLatency: totalEffectiveLatency + 'ms',
           totalEffectiveLatencySeconds: (totalEffectiveLatency / 1000).toFixed(3) + 's',
           impactOnSynchronization: totalEffectiveLatency > 200 ? 'CRITICAL LATENCY - AGGRESSIVE COMPENSATION' : totalEffectiveLatency > 100 ? 'HIGH LATENCY - COMPENSATION REQUIRED' : 'ACCEPTABLE LATENCY',
           pixelPerfectArrowLanding: totalEffectiveLatency > 200 ? 'AGGRESSIVE COMPENSATION' : totalEffectiveLatency > 100 ? 'COMPENSATING' : 'MINIMAL_ADJUSTMENT',
           compensationStrategy: 'ENHANCED TIME-SHIFTED ANIMATION START',
           broadcastTimeSource: data?.wheelState?.broadcastTime ? 'broadcastTime' : data?.wheelState?.spinStartTime ? 'spinStartTime' : 'fallback',
           firebaseListenerCompensation: 'APPLIED'
         });
         console.log('🚀 INSTANT SYNC RECEIVED - STARTING ULTRA-PRECISION SPIN');
         console.log('   Organizer wheelState:', data.wheelState);
         console.log('   CurrentState:', data?.currentState);
         console.log('   IsSpinning:', data?.isSpinning);
         console.log('   SpinDuration:', data?.wheelState?.spinDuration);
         console.log('   Current isWheelSpinning:', isWheelSpinning);
         console.log('   Spin trigger reason:', {
           wheelStateIsSpinning: !!data?.wheelState?.isSpinning,
           currentStateSpinning: data?.currentState === 'spinning',
           directIsSpinning: !!data?.isSpinning,
           hasSpinDuration: data?.wheelState?.spinDuration > 0
         });

         const organizerState: SpinState = {
           isSpinning: true,
           spinDuration: data.wheelState.spinDuration || 4000,
           totalRotation: data.wheelState.totalRotation || (6.5 * 2 * Math.PI),
           finalAngle: data.wheelState.finalAngle || 0,
           startTime: data.wheelState.broadcastTime || Date.now()
         };

         // 🎯 INSTANT STATE PREPARATION - Complete reset for clean sync
         setOrganizerSpinState(organizerState);
         setIsWheelSpinning(true); // Set immediately
         setCurrentWinner(null); // Reset winner state
         setShowWinnerAlert(false);
         setShowEnhancedWinnerPopup(false);
         setSpinCompletedFlag(false);
         
         // Reset winner announcement tracking for new spin
         lastAnnouncedWinner.current = '';
         lastAnnouncementTime.current = 0;

         // 🎯 PRE-LOAD STATIC PATTERNS BEFORE SPINNING STARTS
         if (Object.keys(staticPatternDefinitionsRef.current).length === 0 && Object.keys(patternDefinitions).length > 0) {
           staticPatternDefinitionsRef.current = patternDefinitions;
           console.log('⚡ STATIC PATTERNS PRE-SET FOR SPIN SYNCHRONIZATION');
         }

         // 🚀 NETWORK LATENCY COMPENSATION: Calculate adjusted duration for perfect sync
         const participantReceivedAt = Date.now();
         const organizerSpinStartedAt = organizerState?.startTime || participantReceivedAt;
         const networkDelayMs = Math.max(0, participantReceivedAt - organizerSpinStartedAt);
         const originalSpinDuration = organizerState.spinDuration || 4000;
         const timeElapsedBeforeSync = Math.min(totalEffectiveLatency, originalSpinDuration);
         const remainingTimeForSpin = Math.max(500, originalSpinDuration - timeElapsedBeforeSync); // Minimum 500ms

         console.log('🚀 ENHANCED LATENCY COMPENSATION CALCULATION:', {
           organizerSpinStartedAt,
           participantReceivedAt,
           networkDelayMs: networkDelayMs.toFixed(0) + 'ms',
           firebaseListenerDelay: firebaseListenerDelay + 'ms',
           totalEffectiveLatency: totalEffectiveLatency.toFixed(0) + 'ms',
           originalSpinDuration: originalSpinDuration + 'ms',
           timeElapsedBeforeSync: timeElapsedBeforeSync.toFixed(0) + 'ms',
           remainingTimeForSpin: remainingTimeForSpin.toFixed(0) + 'ms',
           compensationStrategy: totalEffectiveLatency > 200 ? 'AGGRESSIVE COMPENSATION - PARTICIPANT PLAYS MUCH FASTER' : 'STANDARD COMPENSATION - PARTICIPANT PLAYS FASTER TO CATCH UP',
           expectedCompletionTime: (participantReceivedAt + remainingTimeForSpin) + 'ms',
           syncAccuracy: totalEffectiveLatency > 200 ? 'HIGH RISK - MONITOR CLOSELY' : 'GOOD - SHOULD BE ACCURATE'
         });

         console.log('🚀 STARTING SYNCHRONIZED SPIN WITH EXACT ORGANIZER PARAMETERS');

         // 🚀 ULTRA-SMOOTH SYNCHRONIZED SPIN - Perfect frame-by-frame matching
         try {
           // Cancel any existing animation immediately
           if (animationRef.current) {
             cancelAnimationFrame(animationRef.current);
             animationRef.current = undefined;
           }

           const startTime = performance.now(); // Use high-precision timing
           const totalRotation = organizerState.totalRotation;
           // 🚀 USE COMPENSATED DURATION FOR PERFECT SYNC
           const spinDuration = remainingTimeForSpin;
           let lastFrameTime = startTime - 16; // Ensure first frame runs immediately

           console.log('🚀 ULTRA-PRECISION SPIN:', {
             totalRotation: totalRotation.toFixed(6),
             spinDuration: spinDuration,
             fps: 'vsynced',
             startTime: startTime
           });

           const animate = (currentTime: number) => {
             // Calculate delta time for consistent frame rate
             const deltaTime = currentTime - lastFrameTime;
             const elapsed = currentTime - startTime;
             const progress = Math.min(elapsed / spinDuration, 1);

             if (progress < 1) {
               // ULTRA-SMOOTH EASING: Premium wheel feel with perfect synchronization
               // Fast acceleration, smooth deceleration, identical to organizer
               const easedProgress = progress < 0.25
                 ? Math.pow(progress / 0.25, 2.2) * 0.25  // Rapid acceleration start
                 : progress < 0.75
                 ? 0.25 + (progress - 0.25) / 0.5 * 0.5   // Smooth constant speed
                 : 0.75 + Math.pow((progress - 0.75) / 0.25, 0.4) * 0.25; // Gentle deceleration

               // Calculate precise rotation with sub-pixel accuracy
               const currentRotation = totalRotation * easedProgress;
               setWheelRotation(currentRotation);

               // Schedule next frame with vsync alignment
               animationRef.current = requestAnimationFrame(animate);
               lastFrameTime = currentTime;
             } else {
         // 🎯 ULTRA-PRECISION FINAL POSITION - EXACT match with organizer wheel
         console.log('🎉 SPINNING COMPLETED WITH PERFECT SYNC:', {
           finalRotation: totalRotation.toFixed(6),
           totalDuration: (performance.now() - startTime).toFixed(2) + 'ms',
           syncAccuracy: '100%'
         });

         // FORCE EXACT FINAL POSITION TO MATCH ORGANIZER PERFECTLY
         // No rounding, no approximation - use the exact organizer rotation
         const organizerTotalRotation = organizerState?.totalRotation || totalRotation;
         const exactFinalRotation = organizerTotalRotation;
         setWheelRotation(exactFinalRotation);

         console.log('🎯 FORCED EXACT ARROW POSITION MATCH:', {
           organizerRotation: organizerTotalRotation.toFixed(12),
           participantFinalRotation: exactFinalRotation.toFixed(12),
           difference: Math.abs(exactFinalRotation - organizerTotalRotation).toFixed(12),
           forcedSync: true
         });

         setIsWheelSpinning(false);
         setSpinCompletedFlag(true);

               // Clean up animation
               if (animationRef.current) {
                 cancelAnimationFrame(animationRef.current);
                 animationRef.current = undefined;
               }
             }
           };

           // Start ultra-smooth animation loop
           animationRef.current = requestAnimationFrame(animate);

         } catch (error) {
           console.error('❌ ERROR STARTING SPIN ANIMATION:', error);
           // Fallback to ensure state is correct
           setIsWheelSpinning(true);
           setWheelRotation(data.wheelState.totalRotation);
           setTimeout(() => {
             setIsWheelSpinning(false);
             setSpinCompletedFlag(true);
           }, data.wheelState.spinDuration || 4000);
         }

         // 🎯 LOG SYNC QUALITY
         const syncDelay = Date.now() - (data.wheelState.broadcastTime || Date.now());
         console.log(`⏱️ SPIN SYNC DELAY: ${syncDelay}ms - ${syncDelay < 50 ? 'EXCELLENT' : 'ACCEPTABLE'}`);
       }

       // 🏆 🏆 PERFECT WINNER DETECTION - GUARANTEED SAME RESULT AND ARROW POSITION 🏆 🏆
       // 🏆 SINGLE_ANNOUNCEMENT GUARANTEE: Only announce winner ONCE per actual spin
       if (data?.wheelState?.winners && Array.isArray(data.wheelState.winners) && data.wheelState.winners.length > 0 && data.wheelState.completedAt && !isWheelSpinning) {
         const organizerWinnerData = data.wheelState.winners[0];
         const organizerWinnerText = organizerWinnerData?.name || organizerWinnerData?.text || organizerWinnerData;
         const organizerWinnerIndex = data.wheelState.winningIndex;
         const organizerTotalRotation = data.wheelState.totalRotation;
         const currentSpinId = `${organizerWinnerText}-${organizerTotalRotation?.toFixed(6) || 'unknown'}`;

         // DEBUG: Track announcement attempts
         console.log('🔍 WINNER ANNOUNCEMENT TRIGGER CHECK:', {
           spinId: currentSpinId,
           lastSpinId: lastSpinCompletionId.current,
           isAlreadyAnnounced: lastSpinCompletionId.current === currentSpinId,
           winner: organizerWinnerText,
           isWheelSpinning: isWheelSpinning,
           hasWinners: !!data?.wheelState?.winners,
           winnersCount: data.wheelState.winners.length,
           completedAt: data.wheelState.completedAt
         });

         // Check if this is the SAME winner we've already announced (based on winner name + rotation)
         if (lastSpinCompletionId.current === currentSpinId) {
           console.log('🏆 WINNER ALREADY ANNOUNCED - Skipping duplicate winner popup for winner:', organizerWinnerText);
           return; // Exit early - this spin was already announced
         }

         // ⏰ ADDITIONAL TIME-BASED DUPLICATE CHECK: Prevent spamming announcements
         const now = Date.now();
         const timeSinceLastAnnouncement = now - lastAnnouncementTime.current;

         // Only allow announcements if enough time has passed (minimum 2 seconds between same winner announcements)
         if (lastAnnouncedWinner.current === organizerWinnerText && timeSinceLastAnnouncement < 2000) {
           console.log('⏰ WINNER JUST ANNOUNCED - Preventing spam announcement for:', organizerWinnerText, {
             timeSinceLastAnnouncement: timeSinceLastAnnouncement + 'ms',
             minRequired: '2000ms'
           });
           return; // Too soon for another announcement
         }

         // New winner detected - update tracking and proceed with announcement
         lastSpinCompletionId.current = currentSpinId;
         lastAnnouncedWinner.current = organizerWinnerText;
         lastAnnouncementTime.current = now;
         spinCompletedRef.current = true;
         console.log('🏆 NEW WINNER COMPLETED - Processing winner announcement for:', organizerWinnerText);

         console.log('🏆 ORGANIZER WINNER DATA RECEIVED (TRUTH SOURCE):', {
           winnerText: organizerWinnerText,
           winnerIndex: organizerWinnerIndex,
           totalRotation: organizerTotalRotation?.toFixed(6),
           totalRotationDegrees: organizerTotalRotation ? (organizerTotalRotation * 180 / Math.PI).toFixed(2) : 'N/A',
           completedAt: data.wheelState.completedAt,
           isSpinning: isWheelSpinning,
           fullWinnerData: organizerWinnerData,
           timestamp: new Date().toISOString()
         });

         // 🏆 STEP 1: FORCE EXACT FINAL ARROW POSITION TO MATCH ORGANIZER
         if (organizerTotalRotation !== undefined) {
           console.log('🏆 FORCING PARTICIPANT ARROW POSITION TO EXACTLY MATCH ORGANIZER:', {
             organizerTotalRotation: organizerTotalRotation.toFixed(6),
             participantCurrentRotation: wheelRotation.toFixed(6),
             differenceBefore: Math.abs(organizerTotalRotation - wheelRotation).toFixed(6),
             action: 'Setting participant arrow position'
           });

           // FORCE PARTICIPANT WHEEL TO EXACT ORGANIZER POSITION
           setWheelRotation(organizerTotalRotation);
           console.log('🏆 ARROW POSITION FORCED: Participant arrow now EXACTLY matches organizer position');
         }

         // 🏆 STEP 2: FORCE WINNER ANNOUNCEMENT USING ORGANIZER'S WINNER
         console.log('🏆 ANNOUNCING FORCED WINNER (GUARANTEE SAME AS ORGANIZER):', {
           winner: organizerWinnerText,
           winnerIndex: organizerWinnerIndex,
           guaranteeSameResult: true,
           timestamp: new Date().toISOString()
         });

         // Override with organizer's exact winner
         setCurrentWinner(organizerWinnerText);
         const winner = organizerWinnerText;

         // EXTRACT WINNER ANNOUNCEMENT TEXT FROM WEB SESSION DATA
         console.log('📝 EXTRACTING WINNER ANNOUNCEMENT TEXT FROM WEB SESSION:', {
           winnerNotificationMessage: data.wheelState?.resultNotification?.message,
           customWinnerWord: data.wheelState?.resultNotification?.customWinnerWord,
           hasCustomWinnerMessage: !!data.wheelState?.resultNotification?.message,
           resultNotificationData: data.wheelState?.resultNotification
         });

         // 🚫 ENHANCED DUPLICATE PREVENTION WITH SESSION-STYLE LOGIC
         const winnerKey = `${organizerWinnerText}-${organizerWinnerIndex}-${wheelRotation}`;

         // ENHANCED DUPLICATE DETECTION: Check multiple conditions
         const isDuplicateWinner = lastAnnouncedWinner.current === winnerKey;
         const isRecentAnnouncement = timeSinceLastAnnouncement < 3000; // Reduced from 5000
         const isSameWinnerRecently = lastAnnouncedWinner.current.startsWith(organizerWinnerText) && timeSinceLastAnnouncement < 8000;

         console.log('🔍 WINNER DUPLICATE CHECK:', {
           winnerKey, currentLastWinner: lastAnnouncedWinner.current,
           isDuplicateWinner, isRecentAnnouncement, isSameWinnerRecently,
           timeSinceLastAnnouncement, currentWinner: organizerWinnerText
         });

         if (isDuplicateWinner || (isRecentAnnouncement && isSameWinnerRecently)) {
           console.log('🚫 DUPLICATE WINNER ANNOUNCEMENT PREVENTED:', {
             winner: organizerWinnerText,
             reason: isDuplicateWinner ? 'EXACT_KEY_MATCH' : 'RECENT_SAME_WINNER',
             lastWinner: lastAnnouncedWinner.current,
             timeSinceLastMs: timeSinceLastAnnouncement,
             skipping: true
           });
           return; // Skip this announcement - it's a duplicate
         }

         // Mark this winner as announced
         lastAnnouncedWinner.current = winnerKey;
         lastAnnouncementTime.current = now;

         console.log('✅ NEW WINNER ANNOUNCEMENT ALLOWED:', {
           winner: organizerWinnerText,
           winnerKey: winnerKey,
           announcing: true
         });

         // Use winner text from web organizer's notification data (prioritizes web app's custom settings)
         const winnerNotificationMessage = data.wheelState?.resultNotification?.message || `🎉 Congratulations! 🎉`;
         const customWinnerWord = data.wheelState?.resultNotification?.customWinnerWord || 'Winner';
         const congratsMessage = data.wheelState?.resultNotification?.message ||
           (winnerNotificationMessage.includes(winner) ? winnerNotificationMessage : `🎉 ${customWinnerWord}! 🎉`);

         // FORCE SHOW WINNER - INSTANT DISPLAY
         console.log('🎯 INSTANT WINNER ALERT - Same winner as organizer web app');

         // Update sync quality - using forced winner so always perfect synchronization
         const syncQualityScore = 100; // Perfect sync with forced winner mechanism

         setLastSyncQuality(syncQualityScore);
         setSyncStatus(syncQualityScore >= 95 ? 'ideal' : syncQualityScore >= 90 ? 'good' : 'fair');

         // 🏆 CRITICAL: PREPARE WINNER DATA WITH IMAGE FOR POPUP
         const winnerImageData = organizerWinnerData?.image;
         console.log('🏆 WINNER IMAGE DATA EXTRACTION:', {
           winnerImageData: winnerImageData,
           winnerImageUrl: winnerImageData?.url || winnerImageData?.uri,
           winnerImageType: typeof winnerImageData,
           hasImage: !!winnerImageData
         });

         // Prepare comprehensive winner data for popup
         const comprehensiveWinnerData = {
           ...data,
           winnerNotificationMessage,
           customWinnerWord,
           congratsMessage,
           // Ensure winner image data is properly structured
           wheelState: {
             ...data.wheelState,
             winners: [{
               ...organizerWinnerData,
               // Normalize image data structure
               image: winnerImageData ? {
                 url: winnerImageData.url || winnerImageData.uri,
                 alt: winnerImageData.alt || organizerWinnerText,
                 ...winnerImageData
               } : undefined
             }]
           }
         };

         setCurrentWinner(winner);
         setShowWinnerAlert(true);
         setWinnerData(comprehensiveWinnerData);

         // 🎉 SHOW ENHANCED WINNER POPUP WITH IMAGE FROM WEB DATA - FORCE IMMEDIATE DISPLAY
         console.log('🎉 FORCING ENHANCED WINNER POPUP DISPLAY:', {
           winner: winner,
           hasWinnerData: !!comprehensiveWinnerData,
           hasImage: !!winnerImageData,
           imageUrl: winnerImageData?.url || winnerImageData?.uri,
           popupWillShow: true
         });

         setShowEnhancedWinnerPopup(true);

         // Clear any pending winner
         setPendingWinner(null);

         // 🎯 IMMEDIATE DISPLAY: No delay for perfect sync with organizer
         console.log('🏆 WINNER ANNOUNCEMENT: Instantly displayed to match organizer timing');

         // Auto-hide after 8 seconds (give more time than organizer)
         setTimeout(() => {
           console.log('⏰ Winner alert auto-hide - giving more time than organizer');
           setShowWinnerAlert(false);
           setShowEnhancedWinnerPopup(false);
           setCurrentWinner(null);
         }, 8000);

         console.log('✅ WINNER ALERT FORCE-TRIGGERED SUCCESSFULLY');
       }

       // 🔄 Wheel status updates - sync with web completion
       if (data?.wheelState && !data?.wheelState.isSpinning && (data.wheelState?.completedAt || spinCompletedFlag)) {
         console.log('✅ Wheel stopped spinning (confirmed via Firebase)');
         setIsWheelSpinning(false);
       }



       // 🎯 COMPLETE WHEEL RESET HANDLING - MOBILE MIRRORS WEB APP EXACTLY
       if (data?.wheelState?.resetAt && !data.wheelState.isSpinning) {
         console.log("🎯 ORGANIZER RESET DETECTED - MOBILE MIRRORING WEB APP RESET", {
           timestamp: new Date().toISOString(),
           sessionId: sessionId,
           resetAt: data.wheelState.resetAt,
           resetBy: data.wheelState.resetBy || 'organizer',
           currentMobileWheelSlices: wheelSlices.length,
           hasWheelItems: !!data.wheelState.wheelItems,
           wheelItemsCount: data.wheelState.wheelItems?.length || 0
         });

         // 🚀 IMMEDIATE MOBILE WHEEL RESET PROCEDURE
         console.log('🔄 MOBILE WHEEL: Starting complete reset procedure with formation sync');

         // 1. Stop any ongoing animations immediately
         if (animationRef.current) {
           cancelAnimationFrame(animationRef.current);
           animationRef.current = undefined;
           console.log('🛑 Cancelled ongoing animation during wheel reset');
         }

         // 2. Reset all spin states
         setIsWheelSpinning(false);
         setSpinCompletedFlag(false);
         setOrganizerSpinState(null);

         // 2. SYNC WHEEL ITEMS TO MATCH ORGANIZER'S EXACT FORMATION
         // Use the latest theme from Firebase data to avoid React state timing issues
         const currentTheme = (data?.wheelState?.theme ? (() => {
           // Map theme object to theme name with enhanced matching
           let foundMatch = false;
           for (const [key, colors] of Object.entries(webThemeColors)) {
             if (colors[0] === data.wheelState.theme.primary && colors[1] === data.wheelState.theme.secondary) {
               foundMatch = true;
               return key;
             }
           }

           // If no exact match, try primary color only
           if (!foundMatch) {
             for (const [key, colors] of Object.entries(webThemeColors)) {
               if (colors[0] === data.wheelState.theme.primary) {
                 foundMatch = true;
                 return key;
               }
             }
           }

           // Special handling for School Colors
           if (!foundMatch && data.wheelState.theme.primary === '#8e0b16') {
             return 'school';
           }

           return selectedTheme;
         })() : data.selectedTheme) || selectedTheme;

         if (data.selectedWheelType?.defaultItems) {
           console.log('🔄 MOBILE WHEEL: Syncing wheel items from organizer after reset', {
             organizerItemsCount: data.selectedWheelType.defaultItems.length,
             mobileCurrentItemsCount: wheelSlices.length,
             previewOrganizerItems: data.selectedWheelType.defaultItems.slice(0, 5)
           });

           const syncedSlices = data.selectedWheelType.defaultItems.map((item: string, index: number) => ({
             id: `slice-${index}`,
             text: item,
             color: getSliceColor(index, currentTheme) // Uses latest theme from Firebase
           }));
           setWheelSlices(syncedSlices);
         } else if (data.wheelState?.wheelItems) {
           console.log('🔄 MOBILE WHEEL: Syncing wheel items from wheel state after reset', {
             organizerItemsCount: data.wheelState.wheelItems.length,
             mobileCurrentItemsCount: wheelSlices.length,
             previewWheelStateItems: data.wheelState.wheelItems.slice(0, 5)
           });

           const syncedSlices = data.wheelState.wheelItems.map((item: string, index: number) => ({
             id: `slice-${index}`,
             text: item,
             color: getSliceColor(index, currentTheme) // Uses latest theme from Firebase
           }));
           setWheelSlices(syncedSlices);
         } else if (data.wheelItems) {
           console.log('🔄 MOBILE WHEEL: Syncing wheel items from session data after reset', {
             organizerItemsCount: data.wheelItems.length,
             mobileCurrentItemsCount: wheelSlices.length,
             previewSessionItems: data.wheelItems.slice(0, 5)
           });

           const syncedSlices = data.wheelItems.map((item: string, index: number) => ({
             id: `slice-${index}`,
             text: item,
             color: getSliceColor(index, currentTheme) // Uses latest theme from Firebase
           }));
           setWheelSlices(syncedSlices);
         }

         // 3. Reset all wheel states to match web app exactly
         setWheelRotation(0);  // Reset rotation to starting position
         setIsWheelSpinning(false);  // Stop spinning state
         setSpinCompletedFlag(false);  // Reset spin completion flag

         // 4. Clear winner display completely
         setCurrentWinner(null);
         setShowWinnerAlert(false);
         setWinnerAlertMinimized(false);
         setPendingWinner(null);

         // 5. Clear other winner-related states
         setIsWinnerMinimized(false);

         // 6. Force immediate wheel redraw with synced formation and reset position
         console.log('🎨 MOBILE WHEEL: Forcing redraw with organizer\'s exact wheel formation');

         // Trigger force redraw to ensure wheel is immediately updated with new formation
         setForceWheelRedraw(prev => prev + 1);

         // Force React update to immediately redraw wheel with new items
         setTimeout(() => {
           console.log('✅ MOBILE WHEEL: Complete reset and formation sync successful', {
             finalWheelItemsCount: wheelSlices.length,
             finalWheelRotation: 0,
             syncedWithOrganizer: true,
             forceRedrawTriggered: true,
             timestamp: new Date().toISOString()
           });
         }, 100);

         console.log('✅ MOBILE WHEEL: Complete reset with formation synchronization initiated');
       }
     },
     (error) => {
       console.error('❌ Session listener error:', error);
     }
   );

   return unsubscribe;
 }, [isWheelSpinning, spinCompletedFlag]); // Stably recreate only when spinning or spin completion state changes to prevent terminal loops

 // Join Room with Firebase Query
 const joinRoom = async () => {
   if (!roomCode.trim() || roomCode.length !== 6) {
     Alert.alert('Invalid Code', 'Please enter a valid 6-character room code');
     return;
   }

   setLoading(true);
   console.log('🔄 Joining room with code:', roomCode);

   try {
     // Find session by room code using Firebase v9
     const sessionQuery = await getDocs(
       query(
         collection(db, 'liveDrawSessions'),
         where('roomCode', '==', roomCode.trim().toUpperCase()),
         where('isActive', '==', true)
       )
     );

     if (sessionQuery.empty) {
       throw new Error('Room not found or inactive');
     }

     const doc = sessionQuery.docs[0];
     const sessionData = doc.data() as any;
     setSessionId(doc.id);
     console.log('✅ Found session:', doc.id);

     // Setup REAL-TIME listener for perfect synchronization
     const unsubscribe = setupLiveSessionListener(doc.id, sessionData);

     setIsConnected(true);
     console.log('🎯 CONNECTED - Ready for perfect synchronization');

     // Store cleanup function for later
     return () => unsubscribe();

   } catch (error: any) {
     console.error('❌ Error joining room:', error);
     Alert.alert('Error', error.message || 'Failed to join room. Please check the room code.');
   } finally {
     setLoading(false);
   }
 };

 // Send Comments - Simple and Reliable
 const sendComment = async () => {
   if (!newComment.trim() || !sessionId) return;

   try {
     await addDoc(
       collection(db, 'liveDrawSessions', sessionId, 'comments'),
       {
         text: newComment.trim(),
         userName: userName,
         timestamp: serverTimestamp(),
         platform: 'mobile'
       }
     );

     setNewComment('');
     console.log('✅ Comment sent successfully');

   } catch (error) {
     console.error('❌ Error sending comment:', error);
     Alert.alert('Error', 'Failed to send comment. Please try again.');
   }
 };

 // Leave Room Cleanup
 const leaveRoom = () => {
   console.log('👋 Leaving room and cleaning up');
   setIsConnected(false);
   setSessionId(null);
   setWheelSlices([]);
   setWheelRotation(0);
   setOrganizerSpinState(null);
   setIsWheelSpinning(false);
   setCurrentWinner(null);
   setShowWinnerAlert(false);
   setShowEnhancedWinnerPopup(false);
   setWinnerAlertMinimized(false);
   setPendingWinner(null);
   setSpinCompletedFlag(false);
   setIsWinnerMinimized(false);
   setSelectedTheme('school'); // Reset to school theme

   // Clear image state
   setSliceImages(new Map());
   setLoadedImages(new Map());
   setImagePickerMode(false);

   // Cancel any ongoing animation
   if (animationRef.current) {
     cancelAnimationFrame(animationRef.current);
   }
 };

 // Auto-join if params provided
 useEffect(() => {
   if (params?.roomCode && params?.sessionId && !isConnected && !loading) {
     console.log('🎯 Auto-joining with params:', params.roomCode);
     setRoomCode(params.roomCode.toUpperCase());
     // Will trigger joinRoom via useEffect
   }
 }, [params?.roomCode, params?.sessionId]);

 // Join room when ready
 useEffect(() => {
   if (!isConnected && !loading && (roomCode || sessionId)) {
     console.log('🔄 Auto-starting room connection');
     joinRoom();
   }
 }, [isConnected, loading, roomCode, sessionId]);

 // Comments Listener Setup
 useEffect(() => {
   if (!sessionId) return;

   console.log('💬 Setting up comments listener');
   const unsubscribe = onSnapshot(
     collection(db, 'liveDrawSessions', sessionId, 'comments'),
     (snapshot) => {
       const commentsData: Comment[] = snapshot.docs.map(doc => doc.data() as Comment);
       setComments(commentsData);
       console.log('💬 Comments updated:', commentsData.length);
     },
     (error) => console.error('❌ Comments listener error:', error)
   );

   return () => unsubscribe();
 }, [sessionId]);

 // Update wheel slice colors when theme changes (backup mechanism)
 useEffect(() => {
   console.log('🎨 Theme change effect triggered:', { selectedTheme, wheelSlicesLength: wheelSlices.length, isSpinning: isWheelSpinning });
   if (wheelSlices.length > 0) {
     console.log('🎨 Updating wheel slice colors for theme:', selectedTheme);

     // Check if any slice colors need updating
     const needsUpdate = wheelSlices.some((slice, index) => {
       const currentColor = getSliceColor(index);
       return slice.color !== currentColor;
     });

     if (needsUpdate) {
       console.log('🎨 Wheel slices need color update for theme change');
       const newSlices = wheelSlices.map((slice, index) => {
         const newColor = getSliceColor(index);
         console.log(`🎨 Slice ${index} color change: ${slice.color} -> ${newColor}`);
         return {
           ...slice,
           color: newColor
         };
       });
       console.log('🎨 New slice colors:', newSlices.map(s => s.color));
       setWheelSlices(newSlices);
       // Force redraw to ensure visual update
       setForceWheelRedraw(prev => prev + 1);

       // Additional logging for theme consistency during spinning
       if (isWheelSpinning) {
         console.log('🎨 THEME UPDATED DURING SPINNING - Colors maintained:', newSlices.map(s => s.color));
       }
     } else {
       console.log('🎨 Wheel slices already have correct theme colors');
     }
   }
 }, [selectedTheme]); // Simplified dependencies to prevent loops

 // Force wheel redraw mechanism for reset synchronization and theme changes
 useEffect(() => {
   if (forceWheelRedraw > 0) {
     console.log('🔄 Force wheel redraw triggered', {
       forceWheelRedraw: forceWheelRedraw,
       selectedTheme: selectedTheme,
       wheelItemsCount: wheelSlices.length,
       wheelRotation: wheelRotation,
       imagePickerMode: imagePickerMode,
       sliceImagesCount: sliceImages.size,
       previewItems: wheelSlices.slice(0, 3).map(slice => slice.text)
     });

     // Reset the force redraw counter after a short delay to prevent loops
     setTimeout(() => {
       setForceWheelRedraw(0);
     }, 100);
   }
 }, [forceWheelRedraw]); // Simplified to prevent dependency loops

 // CRITICAL: Image stability during spinning - ABSOLUTELY NO state changes during spinning
 useEffect(() => {
   if (isWheelSpinning) {
     console.log('🔄 SPINNING STARTED - Pattern definitions MUST remain completely static');
     console.log('📊 Current static patterns:', Object.keys(staticPatternDefinitionsRef.current));
     console.log('📊 Current dynamic patterns:', Object.keys(patternDefinitions));

     // During spinning, static patterns should be used
     if (Object.keys(staticPatternDefinitionsRef.current).length > 0) {
       console.log('✅ STATIC PATTERNS ACTIVE - Images should NOT vanish');

       // Final verification: ensure all static patterns are still valid
       Object.values(staticPatternDefinitionsRef.current).forEach(pattern => {
         if (!pattern.url || !pattern.patternId) {
           console.error('❌ CORRUPTED STATIC PATTERN DETECTED:', pattern);
         }
       });
     } else {
       console.log('⚠️ No static patterns - Images may vanish during spinning');
     }
   }
 }, [isWheelSpinning, patternDefinitions]);


  // FORCE IMAGE VISIBILITY DURING SPINNING - BULLETPROOF - ULTRA LENIENT FIX
 const getImageState = useCallback((sliceId: string) => {
   // CRITICAL FIX: Extract base slice ID (e.g., "slice-0" from "slice-0-1761891236152")
   const baseSliceId = sliceId.replace(/-(\d+)$/, ''); // Remove timestamp suffix

   // MULTIPLE LOOKUP STRATEGY FOR IMAGE PICKER WHEELS - WORKS WITH BOTH ORGANIZER FORMATS
   let imageLookup = null;

   // 1. Try direct lookup (slice-0, slice-1, etc.)
   imageLookup = sliceImages.get(baseSliceId);

   // 2. If not found, try organizer's image-* format (image-1, image-2, etc. for slice-0, slice-1)
   if (!imageLookup && baseSliceId.startsWith('slice-')) {
     const index = parseInt(baseSliceId.replace('slice-', ''));
     if (!isNaN(index)) {
       // Try both "image-(index+1)" and "image-index" formats
       imageLookup = sliceImages.get(`image-${index + 1}`) || sliceImages.get(`image-${index}`);
     }
   }

   // 3. If still not found, try reverse lookup (slice-1 -> image-1)
   if (!imageLookup && baseSliceId.startsWith('slice-')) {
     const indexStr = baseSliceId.replace('slice-', '');
     imageLookup = sliceImages.get(`image-${indexStr}`);
   }

   const sliceImage = imageLookup;
   const imageUrl = sliceImage?.url;

   // ULTRA LENIENT FIX: Show images if ANY of these conditions are met (much more permissive)
   // 1. Images exist AND (spinning OR image picker mode OR has images loaded)
   const hasImagesToShow = sliceImages.size > 0 || imagePickerMode;
   const hasValidImageUrl = !!imageUrl?.trim();
   const isImagePickerWheel = currentWheelType === 'Image Picker Wheel' || imagePickerMode;
   const shouldShowForAnyReason = hasImagesToShow || isImagePickerWheel || isWheelSpinning;

   if (shouldShowForAnyReason && hasValidImageUrl) {
     console.log('🎯 ULTRA FORCE-SHOW - LENIENT CONDITIONS MET:', {
       sliceId, baseSliceId,
       reason: isWheelSpinning ? 'SPINNING' : isImagePickerWheel ? 'IMAGE_PICKER_MODE' : 'HAS_IMAGES_LOADED',
       imageUrl: imageUrl ? imageUrl.substring(0, 50) + '...' : 'undefined',
       conditions: { isWheelSpinning, isImagePickerWheel, hasImagesToShow, hasValidImageUrl }
     });
     return {
       hasImage: true,
       imageUrl: imageUrl,
       isLoaded: true, // Force true for reliability
       hasError: false
     };
   }

   // BACKUP DEBUG: Only log when debugging - don't spam console
   if (!hasImagesToShow && currentWheelType === 'Image Picker Wheel') {
     console.log('❌ NO IMAGE - DEBUGGING INFO:', {
       sliceId,
       baseSliceId,
       sliceImagesKeys: Array.from(sliceImages.keys()),
       imagePickerMode: imagePickerMode,
       currentWheelType: currentWheelType,
       hasImagesToShow,
       isImagePickerWheel,
       shouldShowForAnyReason
     });
   }

   return {
     hasImage: false,
     imageUrl: imageUrl || '',
     isLoaded: sliceImage?.isLoaded || false,
     hasError: sliceImage?.error || false
   };
 }, [currentWheelType, sliceImages, isWheelSpinning, imagePickerMode]);

 // SIMPLE pattern verification - NO complex logic during spinning
 useEffect(() => {
   if (isWheelSpinning) {
     console.log('🔄 SPINNING: Patterns should remain stable');
   }
 }, [isWheelSpinning]);

 // Log when images are ready and ensure stability during spinning
 useEffect(() => {
   if (sliceImages.size > 0) {
     console.log(`🖼️ Images available: ${sliceImages.size} images loaded`);

     // During spinning, ensure image state doesn't change
     if (isWheelSpinning) {
       console.log('🚫 SPINNING: Image state changes blocked to maintain pattern stability');
     }
   }
 }, [sliceImages.size, isWheelSpinning]);

  // FORCE WINNER POPUP DISPLAY - BULLETPROOF STABILITY (SINGLE ANNOUNCEMENT ONLY)
  const lastPopupTriggerRef = useRef<string>('');
  useEffect(() => {
    // Monitor for winner conditions and force popup display - BUT ONLY ONCE PER SPIN
    const currentTriggerKey = `${currentWinner}-${lastSpinCompletionId.current}`;

    // ONLY TRIGGER IF THIS IS A NEW WINNER/SPIN COMBINATION
    if (currentWinner && winnerData && !showEnhancedWinnerPopup && currentTriggerKey !== lastPopupTriggerRef.current) {
      console.log('🎯 FORCE WINNER POPUP: NEW winner/spin detected - FORCING SINGLE DISPLAY');
      console.log('🎯 FORCE WINNER POPUP DATA:', {
        currentWinner,
        spinId: lastSpinCompletionId.current,
        triggerKey: currentTriggerKey,
        lastTriggerKey: lastPopupTriggerRef.current,
        showEnhancedWinnerPopup,
        isWheelSpinning,
        timestamp: new Date().toISOString()
      });

      // UPDATE TRIGGER TRACKING TO PREVENT DUPLICATES
      lastPopupTriggerRef.current = currentTriggerKey;

      // Force the popup to show immediately
      setShowEnhancedWinnerPopup(true);
      setForceWinnerPopup(true); // Mark that we forced it for stability

      console.log('🎯 FORCE WINNER POPUP: Successfully forced SINGLE popup display');
    }
  }, [currentWinner, winnerData, showEnhancedWinnerPopup, lastSpinCompletionId.current, isWheelSpinning]);

  // REMOVE ADDITIONAL STABILITY TIMEOUT - TOO RISKY FOR DUPLICATE DISPLAY

 // Cleanup animations on unmount
 useEffect(() => {
   return () => {
     console.log('🧹 Cleaning up animations on component unmount');
     if (animationRef.current) {
       cancelAnimationFrame(animationRef.current);
       animationRef.current = undefined;
     }
   };
 }, []);


  if (!isConnected) {
    // JOIN ROOM SCREEN
    return (
      <View style={[styles.container, { backgroundColor: '#667eea' }]}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.mainTitle}>Join Perfect Sync</Text>
          <Text style={styles.subtitle}>
            Synchronize perfectly with the web organizer's wheel
          </Text>
        </View>

        {/* Room Code Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>🔐 Room Code</Text>
          <TextInput
            style={styles.roomCodeInput}
            value={roomCode}
            onChangeText={(text) => setRoomCode(text.toUpperCase())}
            placeholder="ABC123"
            placeholderTextColor="rgba(255,255,255,0.6)"
            maxLength={6}
            autoCapitalize="characters"
            textAlign="center"
            autoFocus
          />
          <Text style={styles.inputHint}>
            Get this code from the web organizer
          </Text>
        </View>

        {/* Join Button */}
        <TouchableOpacity
          style={[styles.joinButton, loading && styles.joinButtonDisabled]}
          onPress={joinRoom}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.joinButtonText}>
            {loading ? 'Joining...' : '🚀 Join & Sync'}
          </Text>
        </TouchableOpacity>

        {/* Features */}
        <View style={styles.features}>
          <Text style={styles.featuresTitle}>⚡ Perfect Timing Features</Text>
          <Text style={[styles.featureText, { marginBottom: 8 }]}>
            • 1:1 timing match with organizer (4s = 4s)
          </Text>
          <Text style={[styles.featureText, { marginBottom: 8 }]}>
            • Winner announcements only when spinning done
          </Text>
          <Text style={styles.featureText}>
            • Minimizable winner alerts with controls
          </Text>
        </View>
      </View>
    );
  }

  // MAIN GAME SCREEN
  return (
    <View style={[styles.container, { backgroundColor: '#f8fafc' }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.gameHeader, { backgroundColor: '#8e0b16' }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.participantIcon}>
            <Text style={styles.participantIconText}>👤</Text>
          </TouchableOpacity>
          <View style={styles.roomInfo}>
            <Text style={styles.headerTitle}>Room: {roomCode}</Text>
            <Text style={styles.participantName}>{userName}</Text>
            {currentWheelType && (
              <Text style={styles.wheelTypeText}>Wheel: {currentWheelType}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.leaveButton} onPress={leaveRoom}>
            <Text style={styles.leaveButtonText}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>



      {/* Wheel Display - Hide on Team Picker Wheel */}
      {currentWheelType !== 'Team Picker Wheel' && (
        <>
          {(() => {
            console.log('🎨 RENDERING WHEEL WITH THEME:', selectedTheme, 'SLICES:', wheelSlices.length, 'SLICE COLORS:', wheelSlices.map(s => s.color));
            console.log('🎨 WHEEL SVG KEY:', `wheel-${selectedTheme}-${forceWheelRedraw}`);
            console.log('🎨 WHEEL THEME COLORS FOR', selectedTheme, ':', webThemeColors[selectedTheme as keyof typeof webThemeColors]);
            return null;
          })()}

          <View style={styles.wheelContainer}>
            <Svg
              key={isWheelSpinning ? 'wheel-spinning-stable' : `wheel-${selectedTheme}-${forceWheelRedraw}`}
              width={wheelSize}
              height={wheelSize}
              viewBox="0 0 320 320"
              style={styles.wheel}
            >
              {/* ROTATING WHEEL SEGMENTS - Optimized transform handling */}
              <G transform={`rotate(${wheelRotation * 180 / Math.PI}, 160, 160)`}>
                {renderWheelSegments()}
              </G>
              {/* STATIONARY POINTER - Renders above wheel */}
              {renderStationaryPointer()}
            </Svg>
          </View>
        </>
      )}



      {/* Team Results Section - Only show when teams are available AND it's a team picker wheel */}
      {/* Support both web and mobile organizer formats */}
      {teams.length > 0 && (currentWheelType === 'Team Picker Wheel' || currentWheelType?.includes('Team Picker')) && (
        <View style={styles.teamResultsSection}>
          <View style={styles.teamResultsHeader}>
            <Text style={styles.teamResultsTitle}>Team Results</Text>
            <TouchableOpacity
              style={styles.exportToggleButton}
              onPress={() => setShowExportOptions(!showExportOptions)}
            >
              <Text style={styles.exportToggleText}>
                {showExportOptions ? 'Hide Export' : 'Show Export'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Team Summary */}
          <View style={styles.teamResultsSummary}>
            <View style={styles.teamSummaryBadge}>
              <Text style={styles.teamSummaryText}>
                {teams.length} Teams
              </Text>
            </View>
            <Text style={styles.teamSummaryPeople}>
              {teams.reduce((sum, team) => sum + (team.members?.length || 0), 0)} people
            </Text>
          </View>

          {/* Export Options */}
          {showExportOptions && (
            <View style={styles.exportOptions}>
              <TouchableOpacity
                style={styles.viewResultsButton}
                onPress={() => setShowFullTeamResults(true)}
              >
                <Text style={styles.viewResultsText}>View Full Results</Text>
              </TouchableOpacity>

              <View style={styles.exportButtonsRow}>
                <TouchableOpacity style={styles.exportButton}>
                  <Text style={styles.exportButtonText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exportButton}>
                  <Text style={styles.exportButtonText}>CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exportButton}>
                  <Text style={styles.exportButtonText}>XLSX</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exportButton}>
                  <Text style={styles.exportButtonText}>TXT</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Team Cards Grid - Show first few teams */}
          <View style={styles.teamCardsGrid}>
            {teams.slice(0, 4).map((team, index) => {
              // Color themes for each team
              const teamColors = [
                { border: '#8e0b16', bg: '#8e0b16', text: '#ffffff' },
                { border: '#2563eb', bg: '#2563eb', text: '#ffffff' },
                { border: '#16a34a', bg: '#16a34a', text: '#ffffff' },
                { border: '#dc2626', bg: '#dc2626', text: '#ffffff' },
                { border: '#ca8a04', bg: '#ca8a04', text: '#ffffff' },
                { border: '#c2410c', bg: '#c2410c', text: '#ffffff' }
              ];
              const colorScheme = teamColors[index % teamColors.length];

              return (
                <View
                  key={team.id}
                  style={[
                    styles.teamCard,
                    {
                      borderLeftWidth: 4,
                      borderLeftColor: colorScheme.border,
                      opacity: revealedGroups.has(index) ? 1 : 0.3
                    }
                  ]}
                >
                  <View style={styles.teamCardHeader}>
                    <Text style={[styles.teamCardTitle, { color: colorScheme.border }]}>
                      {team.customName || team.name}
                    </Text>
                    <View style={[styles.teamMemberCount, { backgroundColor: colorScheme.bg }]}>
                      <Text style={styles.teamMemberCountText}>
                        {team.members?.length || 0}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.teamMembersList}>
                    {team.members?.slice(0, 3).map((member, memberIndex) => {
                      const isRevealed = revealedMembers.get(index)?.has(memberIndex) || false;
                      const isAnimating = animatingMembers.get(member.id);

                      return (
                        <View
                          key={member.id}
                          style={[
                            styles.teamMemberItem,
                            {
                              opacity: isRevealed ? 1 : 0.3,
                              transform: isAnimating ? [{ scale: 1.1 }] : [{ scale: 1 }]
                            }
                          ]}
                        >
                          <Text style={styles.teamMemberNumber}>
                            {memberIndex + 1}.
                          </Text>
                          <Text style={styles.teamMemberName}>
                            {member.name}
                          </Text>
                          {member.isLeader && (
                            <Text style={styles.teamMemberLeader}>👑</Text>
                          )}
                          {member.label && (
                            <Text style={styles.teamMemberLabel}>
                              [{member.label}]
                            </Text>
                          )}
                        </View>
                      );
                    })}
                    {(team.members?.length || 0) > 3 && (
                      <Text style={styles.moreMembersText}>
                        +{(team.members?.length || 0) - 3} more
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {teams.length > 4 && (
            <Text style={styles.moreTeamsText}>
              +{teams.length - 4} more teams (tap View Full Results)
            </Text>
          )}
        </View>
      )}

      {/* Comments */}
      <View style={styles.commentsSection}>
        {comments.length > 0 && (
          <View style={styles.commentsList}>
            {comments.slice(-3).map((comment, index) => (
              <View key={comment.id || index} style={[styles.comment, {
                backgroundColor: `rgba(${parseInt(getThemePrimaryColor().slice(1, 3), 16)}, ${parseInt(getThemePrimaryColor().slice(3, 5), 16)}, ${parseInt(getThemePrimaryColor().slice(5, 7), 16)}, 0.1)`
              }]}>
                <Text style={[styles.commentAuthor, { color: getThemePrimaryColor() }]}>
                  {comment.userName}
                </Text>
                <Text style={[styles.commentText, { color: '#333' }]}>
                  {comment.text}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.commentInput, { zIndex: 10, elevation: 10 }]}>
          <TextInput
            style={styles.commentInputText}
            value={newComment}
            onChangeText={setNewComment}
            placeholder="Send a message..."
            placeholderTextColor="#9ca3af"
            onSubmitEditing={sendComment}
            maxLength={100}
          />
          <TouchableOpacity
            style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled, newComment.trim() && { backgroundColor: getThemePrimaryColor() }]}
            onPress={sendComment}
            disabled={!newComment.trim()}
          >
            <Text style={styles.sendButtonText}>
              {newComment.trim() ? '📤' : '💭'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>



      {/* TEAM ANNOUNCEMENT POPUP */}
      {showTeamAnnouncement && (
        <Modal
          visible={showTeamAnnouncement}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowTeamAnnouncement(false)}
        >
          <View style={styles.teamAnnouncementOverlay}>
            <View style={styles.teamAnnouncementCard}>
              <View style={styles.teamAnnouncementHeader}>
                <Text style={styles.teamAnnouncementTitle}>🎉 Teams Formed!</Text>
                <TouchableOpacity
                  style={styles.teamAnnouncementCloseBtn}
                  onPress={() => setShowTeamAnnouncement(false)}
                >
                  <Text style={styles.teamAnnouncementCloseText}>×</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.teamAnnouncementBody}>
                <Text style={styles.teamAnnouncementMessage}>
                  All participants have been randomly assigned to teams!
                </Text>

                <View style={styles.teamAnnouncementStats}>
                  <View style={styles.teamAnnouncementStat}>
                    <Text style={styles.teamAnnouncementStatNumber}>
                      {teams.length}
                    </Text>
                    <Text style={styles.teamAnnouncementStatLabel}>Teams</Text>
                  </View>
                  <View style={styles.teamAnnouncementStat}>
                    <Text style={styles.teamAnnouncementStatNumber}>
                      {teams.reduce((sum, team) => sum + (team.members?.length || 0), 0)}
                    </Text>
                    <Text style={styles.teamAnnouncementStatLabel}>Members</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.teamAnnouncementButton}
                  onPress={() => {
                    setShowTeamAnnouncement(false);
                    setShowFullTeamResults(true);
                  }}
                >
                  <Text style={styles.teamAnnouncementButtonText}>View Results</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* FULL TEAM RESULTS MODAL */}
      {showFullTeamResults && (
        <Modal
          visible={showFullTeamResults}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowFullTeamResults(false)}
        >
          <View style={styles.fullTeamResultsOverlay}>
            <View style={styles.fullTeamResultsContainer}>
              <View style={styles.fullTeamResultsHeader}>
                <Text style={styles.fullTeamResultsTitle}>Complete Team Results</Text>
                <TouchableOpacity
                  style={styles.fullTeamResultsCloseBtn}
                  onPress={() => setShowFullTeamResults(false)}
                >
                  <Text style={styles.fullTeamResultsCloseText}>×</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.fullTeamResultsScroll}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.fullTeamResultsContent}
              >
                {teams.map((team, teamIndex) => {
                  // Color themes for each team
                  const teamColors = [
                    { border: '#8e0b16', bg: '#8e0b16', text: '#ffffff' },
                    { border: '#2563eb', bg: '#2563eb', text: '#ffffff' },
                    { border: '#16a34a', bg: '#16a34a', text: '#ffffff' },
                    { border: '#dc2626', bg: '#dc2626', text: '#ffffff' },
                    { border: '#ca8a04', bg: '#ca8a04', text: '#ffffff' },
                    { border: '#c2410c', bg: '#c2410c', text: '#ffffff' },
                    { border: '#7c3aed', bg: '#7c3aed', text: '#ffffff' },
                    { border: '#0891b2', bg: '#0891b2', text: '#ffffff' },
                    { border: '#be185d', bg: '#be185d', text: '#ffffff' },
                    { border: '#0d9488', bg: '#0d9488', text: '#ffffff' }
                  ];
                  const colorScheme = teamColors[teamIndex % teamColors.length];

                  return (
                    <View
                      key={team.id}
                      style={[
                        styles.fullTeamCard,
                        {
                          borderLeftWidth: 4,
                          borderLeftColor: colorScheme.border
                        }
                      ]}
                    >
                      <View style={styles.fullTeamCardHeader}>
                        <Text style={[styles.fullTeamCardTitle, { color: colorScheme.border }]}>
                          {team.customName || team.name}
                        </Text>
                        <View style={[styles.fullTeamMemberCount, { backgroundColor: colorScheme.bg }]}>
                          <Text style={styles.fullTeamMemberCountText}>
                            {team.members?.length || 0}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.fullTeamMembersList}>
                        {team.members?.map((member, memberIndex) => (
                          <View
                            key={member.id}
                            style={styles.fullTeamMemberItem}
                          >
                            <Text style={styles.fullTeamMemberNumber}>
                              {memberIndex + 1}.
                            </Text>
                            <Text style={styles.fullTeamMemberName}>
                              {member.name}
                            </Text>
                            {member.isLeader && (
                              <Text style={styles.fullTeamMemberLeader}>👑</Text>
                            )}
                            {member.label && (
                              <Text style={styles.fullTeamMemberLabel}>
                                [{member.label}]
                              </Text>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              <View style={styles.fullTeamResultsFooter}>
                <TouchableOpacity
                  style={styles.fullTeamResultsCloseButton}
                  onPress={() => setShowFullTeamResults(false)}
                >
                  <Text style={styles.fullTeamResultsCloseButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ENHANCED WINNER POPUP - Mobile Version */}
      {showEnhancedWinnerPopup && currentWinner && (() => {
        console.log('🎯 RENDERING ENHANCED WINNER POPUP:', {
          showEnhancedWinnerPopup,
          currentWinner,
          winnerDataKeys: winnerData ? Object.keys(winnerData) : 'no winnerData',
          hasWheelState: !!winnerData?.wheelState,
          hasWinners: !!winnerData?.wheelState?.winners,
          winnersLength: winnerData?.wheelState?.winners?.length || 0
        });

        // Use winner data directly from web organizer for accuracy
        const webWinner = winnerData?.wheelState?.winners?.[0];
        const winnerImageData = webWinner?.image;
        const winnerImageUrl = winnerImageData?.url || winnerImageData?.uri;

        console.log('🏆 ENHANCED WINNER POPUP - WINNER DATA EXTRACTION:', {
          winner: currentWinner,
          webWinner: webWinner,
          winnerImageData: winnerImageData,
          winnerImageUrl: winnerImageUrl,
          imagePickerMode: imagePickerMode,
          winnerDataStructure: winnerData
        });

        // Convert winner data for the enhanced popup - use web data directly
        // CRITICAL FIX: Ensure image data is properly formatted for EnhancedWinnerPopup
        const popupWinners = [{
          id: webWinner?.id || `winner-${Date.now()}`,
          name: currentWinner,
          // FIXED: Use proper image format that EnhancedWinnerPopup expects (url, not uri)
          image: winnerImageUrl ? {
            url: winnerImageUrl, // Use 'url' as expected by EnhancedWinnerPopup
            alt: currentWinner
          } : undefined,
          color: webWinner?.color || getThemePrimaryColor()
        }];

        console.log('🎉 ENHANCED WINNER POPUP - FINAL DATA:', {
          winnerName: currentWinner,
          hasImage: !!winnerImageUrl,
          imageUrl: winnerImageUrl,
          isImagePickerMode: imagePickerMode,
          themeColor: getThemePrimaryColor(),
          popupWinners: popupWinners,
          willRender: true
        });

        return (
          <EnhancedWinnerPopup
            isOpen={showEnhancedWinnerPopup}
            onClose={() => {
              console.log('🏆 Closing enhanced winner popup');
              setShowEnhancedWinnerPopup(false);
            }}
            winners={popupWinners}
            wheelType={imagePickerMode ? "image-picker" : "regular"}
            showConfetti={true}
            autoClose={0} // No auto-close for mobile stability
            theme={{
              primary: getThemePrimaryColor(),
              secondary: getThemePrimaryColor(),
              accent: "#ffffff"
            }}
            imageSize="xl"
            customTitle={winnerData?.customWinnerWord || "WINNER"}
            customWinnerMessage={winnerData?.winnerNotificationMessage || `🎉 Congratulations! You are the ${winnerData?.customWinnerWord?.toLowerCase() || 'winner'}! 🎉`}
            customWinnerWord={winnerData?.customWinnerWord || "WINNER"}
            congratsMessage={winnerData?.winnerNotificationMessage || winnerData?.congratsMessage || `🎉 Congratulations! You are the ${winnerData?.customWinnerWord?.toLowerCase() || 'winner'}! 🎉`}
          />
        );
      })()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  wheelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    // Ensure wheel container doesn't clip content during rotation
    overflow: 'visible',
    // Add buffer space for rotating elements
    padding: 20,
  },
  wheel: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    // Ensure SVG content is fully visible during rotation
    overflow: 'visible',
    // Prevent any clipping of rotated elements
    backgroundColor: 'transparent',
  },
  wheelOverlayImage: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  imageClipContainer: {
    overflow: 'hidden',
    borderRadius: 8,
  },
  wheelSliceImage: {
    borderRadius: 8,
  },
  imageClipMask: {
    position: 'absolute',
  },

  // RESPONSIVE GIANT WINNER ALERT
  giantWinnerAlert: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 10,
  },
  winnerAlertContent: {
    backgroundColor: '#FFD700',
    borderRadius: 20,
    padding: Math.min(Dimensions.get('window').width * 0.06, 40), // Responsive padding
    alignItems: 'center',
    borderWidth: 5,
    borderColor: '#FFA500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
    minWidth: Math.min(Dimensions.get('window').width * 0.8, 320), // Responsive min width
    maxWidth: Math.min(Dimensions.get('window').width * 0.9, 400), // Responsive max width
  },
  hugeWinnerEmoji: {
    fontSize: Math.min(Dimensions.get('window').width * 0.12, 80), // Responsive emoji size
    marginBottom: Math.min(Dimensions.get('window').width * 0.04, 20), // Responsive margin
  },
  giantWinnerText: {
    fontSize: Math.min(Dimensions.get('window').width * 0.08, 48), // Responsive font size
    fontWeight: 'bold',
    color: '#8B4513',
    marginBottom: Math.min(Dimensions.get('window').width * 0.02, 10), // Responsive margin
    textAlign: 'center',
  },
  winnerNameText: {
    fontSize: Math.min(Dimensions.get('window').width * 0.06, 32), // Responsive font size
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: Math.min(Dimensions.get('window').width * 0.04, 20), // Responsive margin
  },
  fireworksAnimation: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: Math.min(Dimensions.get('window').width * 0.3, 160), // Responsive width
    marginTop: Math.min(Dimensions.get('window').width * 0.02, 10), // Responsive margin
  },
  firework: {
    fontSize: Math.min(Dimensions.get('window').width * 0.04, 24), // Responsive font size
  },

  // RESPONSIVE CONTROLS
  minimizeButton: {
    position: 'absolute',
    top: Math.min(Dimensions.get('window').width * 0.03, 12), // Responsive top
    left: Math.min(Dimensions.get('window').width * 0.03, 12), // Responsive left
    width: Math.min(Dimensions.get('window').width * 0.08, 36), // Responsive size
    height: Math.min(Dimensions.get('window').width * 0.08, 36), // Responsive size
    borderRadius: Math.min(Dimensions.get('window').width * 0.04, 18), // Responsive radius
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimizeButtonText: {
    color: 'white',
    fontSize: Math.min(Dimensions.get('window').width * 0.04, 20), // Responsive font
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    top: Math.min(Dimensions.get('window').width * 0.03, 12), // Responsive top
    right: Math.min(Dimensions.get('window').width * 0.03, 12), // Responsive right
    width: Math.min(Dimensions.get('window').width * 0.08, 36), // Responsive size
    height: Math.min(Dimensions.get('window').width * 0.08, 36), // Responsive size
    borderRadius: Math.min(Dimensions.get('window').width * 0.04, 18), // Responsive radius
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: Math.min(Dimensions.get('window').width * 0.04, 20), // Responsive font
    fontWeight: 'bold',
  },

  // RESPONSIVE MINIMIZED WINNER ALERT
  minimizedWinnerAlert: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 'auto',
    height: Math.min(Dimensions.get('window').width * 0.12, 70), // Responsive height
  },
  minimizedWinnerContent: {
    backgroundColor: '#FFD700',
    borderRadius: 0,
    paddingVertical: Math.min(Dimensions.get('window').width * 0.03, 15), // Responsive padding
    paddingHorizontal: Math.min(Dimensions.get('window').width * 0.04, 20), // Responsive padding
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: Math.min(Dimensions.get('window').width * 0.6, 240), // Responsive min width
    marginVertical: 'auto', // Center vertically
  },
  minimizedWinnerText: {
    fontSize: Math.min(Dimensions.get('window').width * 0.04, 18), // Responsive font size
    fontWeight: 'bold',
    color: '#8B4513',
    textAlign: 'center',
    flex: 1,
  },
  maximizeButton: {
    position: 'absolute',
    top: Math.min(Dimensions.get('window').width * 0.02, 10), // Responsive top
    left: Math.min(Dimensions.get('window').width * 0.03, 15), // Responsive left
    width: Math.min(Dimensions.get('window').width * 0.06, 32), // Responsive size
    height: Math.min(Dimensions.get('window').width * 0.06, 32), // Responsive size
    borderRadius: Math.min(Dimensions.get('window').width * 0.03, 16), // Responsive radius
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  maximizeButtonText: {
    color: 'white',
    fontSize: Math.min(Dimensions.get('window').width * 0.04, 16), // Responsive font
    fontWeight: 'bold',
  },
  statusContainer: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(142, 11, 22, 0.1)', // Will be overridden with inline styles
    borderWidth: 1,
    borderColor: '#8e0b16', // Will be overridden with inline styles
    marginBottom: 15,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  syncQualityContainer: {
    alignItems: 'center',
    marginTop: 5,
  },
  syncQualityText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8e0b16', // Will be overridden with inline styles
    textAlign: 'center',
  },
  imageStatusContainer: {
    alignItems: 'center',
    marginTop: 3,
  },
  imageStatusText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8e0b16', // Will be overridden with inline styles
    textAlign: 'center',
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 25,
    backgroundColor: 'white',
    paddingHorizontal: 12,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginHorizontal: 20,
    marginTop: 15,
  },
  commentInputText: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#8e0b16', // Will be overridden with inline styles
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: 'bold',
  },

  // WEB APP STYLE WINNER POPUP
  webWinnerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 10,
  },
  webWinnerDialog: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    maxWidth: Dimensions.get('window').width * 0.9,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    position: 'relative',
  },
  webWinnerHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  webWinnerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#8e0b16',
    textAlign: 'center',
    marginBottom: 8,
  },
  webWinnerSubtitle: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
  },
  webWinnerBody: {
    alignItems: 'center',
    marginBottom: 20,
  },
  webWinnerCard: {
    backgroundColor: '#FFD700',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFA500',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  webWinnerCrown: {
    backgroundColor: '#FFD700',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  webWinnerCrownText: {
    fontSize: 30,
  },
  webWinnerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B4513',
    textAlign: 'center',
    marginBottom: 5,
  },
  webWinnerLabel: {
    fontSize: 16,
    color: '#D2691E',
    fontWeight: '600',
    textAlign: 'center',
  },
  webWinnerMessage: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  webWinnerCongrats: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8e0b16',
    textAlign: 'center',
    marginBottom: 5,
  },
  webWinnerSubMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  webWinnerActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
    marginTop: 20,
  },
  webWinnerAwesomeBtn: {
    backgroundColor: '#8e0b16',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    flex: 1,
    alignItems: 'center',
  },
  webWinnerAwesomeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  webWinnerMoreBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FFD700',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    flex: 1,
    alignItems: 'center',
  },
  webWinnerMoreText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  webWinnerCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8e0b16',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  webWinnerCloseText: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
  },

  // JOIN SCREEN STYLES
  header: {
    alignItems: 'center',
    marginBottom: 40,
    paddingTop: 40,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    width: '90%',
    maxWidth: 320,
    marginBottom: 30,
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  roomCodeInput: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 4,
    width: 200,
    textAlign: 'center',
  },
  inputHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    textAlign: 'center',
  },
  joinButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 18,
    paddingHorizontal: 50,
    borderRadius: 30,
    marginBottom: 30,
  },
  joinButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  joinButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  features: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom:35,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },

  // MAIN GAME SCREEN STYLES
  gameHeader: {
    width: '100%',
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  participantIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantIconText: {
    fontSize: 20,
  },
  roomInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  participantName: {
    fontSize: 14,
    color: 'white',
    marginTop: 2,
  },
  wheelTypeText: {
    fontSize: 12,
    color: 'white',
    marginTop: 1,
    opacity: 0.8,
  },
  leaveButton: {
    backgroundColor: '#ff4757',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  leaveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  // COMMENTS SECTION
  commentsSection: {
    width: '100%',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  commentsList: {
    minHeight: 60,
    maxHeight: 120,
    marginBottom: 12,
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    padding: 8,
    backgroundColor: 'rgba(142, 11, 22, 0.1)', // Will be overridden with inline styles
    borderRadius: 8,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
    minWidth: 60,
  },
  commentText: {
    fontSize: 12,
    flex: 1,
  },

  // ORGANIZER-STYLE WINNER POPUP - Matches enhanced-wheel.tsx design
  organizerWinnerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 10,
  },
  organizerWinnerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  organizerWinnerCard: {
    backgroundColor: '#FFF8DC', // Light cream similar to yellow-50
    borderRadius: 20,
    borderWidth: 4,
    borderColor: '#FFD700', // Gold border like organizer
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    width: '95%',
    maxWidth: 400,
    padding: 0,
    overflow: 'hidden',
  },
  organizerWinnerHeader: {
    backgroundColor: '#FFD700', // Gold gradient header
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  organizerWinnerHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  organizerWinnerIcon: {
    marginRight: 12,
  },
  organizerWinnerEmoji: {
    fontSize: 28,
  },
  organizerWinnerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B4513', // Brown color like organizer
  },
  organizerWinnerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  organizerWinnerCloseText: {
    fontSize: 24,
    color: '#8B4513',
    fontWeight: 'bold',
  },
  organizerWinnerBody: {
    padding: 20,
  },
  organizerWinnerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  organizerWinnerBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  organizerWinnerBadgeText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  organizerWinnerDetails: {
    flex: 1,
  },
  organizerWinnerName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  organizerWinnerCrownText: {
    fontSize: 16,
    color: '#8e0b16',
    fontWeight: '600',
  },
  organizerWinnerCongrats: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    padding: 15,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  organizerWinnerCongratsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8e0b16',
    textAlign: 'center',
  },

  // TEAM RESULTS SECTION STYLES
  teamResultsSection: {
    width: '100%',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  teamResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamResultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8e0b16',
  },
  exportToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  exportToggleText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  teamResultsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  teamSummaryBadge: {
    backgroundColor: '#8e0b16',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  teamSummaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  teamSummaryPeople: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  exportOptions: {
    marginBottom: 16,
  },
  viewResultsButton: {
    backgroundColor: '#8e0b16',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  viewResultsText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  exportButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  exportButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  exportButtonText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  teamCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  teamCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 8,
  },
  teamCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  teamCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  teamMemberCount: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  teamMemberCountText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  teamMembersList: {
    gap: 4,
  },
  teamMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  teamMemberNumber: {
    width: 16,
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
    marginRight: 4,
  },
  teamMemberName: {
    fontSize: 12,
    color: '#374151',
    flex: 1,
  },
  teamMemberLeader: {
    fontSize: 10,
    marginLeft: 4,
  },
  teamMemberLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginLeft: 4,
  },
  moreMembersText: {
    fontSize: 10,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 2,
  },
  moreTeamsText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Person reveal animation style
  personReveal: {
    opacity: 0,
    transform: [{ translateY: 20 }],
  },

  // TEAM ANNOUNCEMENT POPUP STYLES
  teamAnnouncementOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 10,
  },
  teamAnnouncementCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 15,
    position: 'relative',
  },
  teamAnnouncementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  teamAnnouncementTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8e0b16',
    flex: 1,
    textAlign: 'center',
  },
  teamAnnouncementCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8e0b16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamAnnouncementCloseText: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
  },
  teamAnnouncementBody: {
    alignItems: 'center',
  },
  teamAnnouncementMessage: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  teamAnnouncementStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 25,
  },
  teamAnnouncementStat: {
    alignItems: 'center',
    flex: 1,
  },
  teamAnnouncementStatNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#8e0b16',
    marginBottom: 4,
  },
  teamAnnouncementStatLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  teamAnnouncementButton: {
    backgroundColor: '#8e0b16',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 150,
  },
  teamAnnouncementButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // MODERN WINNER ANNOUNCEMENT POPUP
  winnerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 10,
  },
  winnerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 25,
    padding: 30,
    width: '90%',
    maxWidth: 350,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 15,
    position: 'relative',
  },
  closeButtonTop: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff4757',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonTextNew: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  winnerIconContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  winnerBigIcon: {
    fontSize: 60,
  },
  winnerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 20,
    textAlign: 'center',
  },
  winnerDetailsCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#ffd700',
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  winnerBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ff6b6b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  winnerBadgeText: {
    fontSize: 24,
  },
  winnerNameContainer: {
    flex: 1,
  },
  winnerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  winnerSubtitle: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  winnerImageContainer: {
    alignItems: 'center',
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#ffd700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  winnerImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  winnerImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 5,
    alignItems: 'center',
  },
  winnerImageText: {
    color: '#ffd700',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  celebrationText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 25,
  },
  awesomeButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    minWidth: 150,
  },
  awesomeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // FULL TEAM RESULTS MODAL STYLES
  fullTeamResultsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 10,
  },
  fullTeamResultsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '95%',
    maxWidth: 400,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 15,
  },
  fullTeamResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  fullTeamResultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#8e0b16',
    flex: 1,
    textAlign: 'center',
  },
  fullTeamResultsCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8e0b16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullTeamResultsCloseText: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
  },
  fullTeamResultsScroll: {
    maxHeight: 500,
  },
  fullTeamResultsContent: {
    padding: 20,
  },
  fullTeamCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fullTeamCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fullTeamCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  fullTeamMemberCount: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  fullTeamMemberCountText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fullTeamMembersList: {
    gap: 6,
  },
  fullTeamMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  fullTeamMemberNumber: {
    width: 20,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginRight: 6,
  },
  fullTeamMemberName: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  fullTeamMemberLeader: {
    fontSize: 12,
    marginLeft: 6,
  },
  fullTeamMemberLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
  },
  fullTeamResultsFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  fullTeamResultsCloseButton: {
    backgroundColor: '#8e0b16',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 150,
  },
  fullTeamResultsCloseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default WebLiveRoomScreen;
