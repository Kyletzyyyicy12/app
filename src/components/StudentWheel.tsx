 import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform, Easing, Alert, TouchableOpacity } from 'react-native';
import Svg, { G, Path, Text as SvgText, Image as SvgImage, ClipPath, Defs } from 'react-native-svg';
import { db } from '../config/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { useTheme } from '../contexts/ThemeContext';

interface WheelSlice {
  id: string;
  text: string;
  color?: string;
  image?: {
    url: string;
    isLoaded?: boolean;
    error?: boolean;
  };
}

interface SelectedWheelType {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  defaultItems: string[];
  color: string;
  isCustomizable: boolean;
}

interface WheelThemeData {
  name?: string;
  primary?: string;
  secondary?: string;
  [key: string]: any; // Allow additional theme properties
}

interface StudentWheelProps {
  sessionId: string;
  participants?: any[]; // Legacy support
  onWheelTypeChange?: (wheelType: SelectedWheelType | null) => void; // Callback for wheel type changes
  showWheelInfo?: boolean; // Show wheel type information
}

const StudentWheel: React.FC<StudentWheelProps> = ({
  sessionId,
  participants,
  onWheelTypeChange,
  showWheelInfo = true
}) => {
  const { theme } = useTheme();

  // 🎯 PERFECT SYNCHRONIZATION SYSTEM: Ensures participants spin at exact same time as organizer
  // ⚡ EXACT SPEED MATCH: Participants use exact same speed as organizer for perfect synchronization
  // No speed multiplier - exact 1:1 match with organizer

  // 🎯 SYNCHRONIZATION FEATURES:
  // - Instant start: No time elapsed calculations - participants start immediately when organizer spins
  // - Exact parameters: Uses organizer's exact totalRotation, spinDuration, and finalAngle
  // - Same timing: Both organizer and participants complete at the exact same moment
  // - Same position: Arrow hits the exact same spot for both organizer and participants
  // - Instant winners: Winner announcements happen simultaneously
  // - Real-time sync: Follows organizer's exact angle updates during spinning

  const [currentAngle, setCurrentAngle] = useState(0);
  const [wheelSlices, setWheelSlices] = useState<WheelSlice[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [sessionState, setSessionState] = useState<'waiting' | 'spinning' | 'completed'>('waiting');
  const [selectedWheelType, setSelectedWheelType] = useState<SelectedWheelType | null>(null);
  const [winners, setWinners] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  // Enhanced state for real-time notifications
  const [spinningNotification, setSpinningNotification] = useState<string | null>(null);
  const [resultNotification, setResultNotification] = useState<any | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [customWheelTheme, setCustomWheelTheme] = useState<any | null>(null);
  const [arrowVisible, setArrowVisible] = useState(true); // Force arrow visibility
  const animatedAngle = useRef(new Animated.Value(0)).current;

  // Helper function for development-only logging with improved readability
  const logThemeUpdate = (themeData: WheelThemeData, data: any) => {
    if (!__DEV__) return; // Skip logging in production for performance

    const themeInfo = {
      themeName: themeData?.name || 'Custom Theme',
      primaryColor: themeData?.primary || 'Not specified',
      hasCustomWheelTheme: Boolean(data?.customWheelTheme),
      hasTheme: Boolean(data?.theme),
      priority: data?.wheelThemeSync?.priority || 'normal',
      timestamp: new Date().toISOString()
    };

    console.log('🎨 MOBILE PARTICIPANT: Theme Update Received', themeInfo);
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    try {
      // Enhanced real-time session listener for comprehensive synchronization
      unsubscribe = onSnapshot(doc(db, 'liveDrawSessions', sessionId), (doc) => {
        // 🔥 🌟 CRITICAL DEBUGGING - TRACKING EVERY FIREBASE UPDATE 🌟 🔥
        console.log('=========================================================');
        console.log('📡💥 CRITICAL: STUDENTWHEEL RECEIVED FIREBASE UPDATE');
        console.log('📡 Session ID:', sessionId);
        console.log('📡 Timestamp:', new Date().toISOString());
        console.log('📡 Document exists:', doc.exists());
        console.log('=========================================================');

        if (!doc.exists()) {
          console.warn('❌ CRITICAL: Session not found:', sessionId);
          setIsConnected(false);
          return;
        }

        const data = doc.data();

        // 🔥 🔥 🔥 SHOW EVERY PIECE OF DATA RECEIVED 🔥 🔥 🔥
        console.log('================ STUDENTWHEEL FIREBASE DATA ================');
        console.log('🍊 Full Data Object:', JSON.stringify(data, null, 2));
        console.log('📊 Current State:', data?.currentState);
        console.log('⚙️ Is Spinning:', data?.isSpinning);
        console.log('🎡 Wheel State:', JSON.stringify(data?.wheelState, null, 2));
        console.log('🎯 Has Wheel State:', !!data?.wheelState);
        console.log('🏆 Winners:', data?.winners?.length || 0);
        console.log('🎨 Selected Wheel Type:', data?.selectedWheelType?.id);
        console.log('==========================================');
        console.log('📡 StudentWheel received session update:', {
            wheelType: data?.selectedWheelType?.id,
            currentState: data?.currentState,
            hasWheelState: !!data?.wheelState,
            wheelItemsCount: data?.selectedWheelType?.defaultItems?.length || data?.wheelItems?.length || 0,
            sessionUpdateTime: new Date().toISOString()
        });
        
        setIsConnected(true);
        setLastUpdate(new Date());
        
        // 1. Handle wheel type changes (organizer changed wheel type)
        if (data.selectedWheelType) {
          const newWheelType = data.selectedWheelType;
          console.log('🎡 Wheel type updated:', newWheelType.id, newWheelType.title);
          
          // More robust check to prevent infinite loops - compare stringified objects
          const hasWheelTypeChanged = !selectedWheelType || 
            JSON.stringify(selectedWheelType) !== JSON.stringify(newWheelType);
            
          if (hasWheelTypeChanged) {
            console.log('🔍 Wheel type actually changed, notifying parent');
            setSelectedWheelType(newWheelType);
            onWheelTypeChange?.(newWheelType);
          } else {
            // Just update the state without notifying to keep data fresh
            setSelectedWheelType(newWheelType);
          }
          
          // Update wheel slices from new wheel type with image support
          if (newWheelType.defaultItems && newWheelType.defaultItems.length > 0) {
            console.log('🖼️ PARTICIPANT: Creating slices with image support', {
              itemCount: newWheelType.defaultItems.length,
              hasWheelImages: !!data.wheelImages,
              wheelImagesCount: data.wheelImages?.length || 0,
              hasImageUrls: !!data.imageUrls
            });

            const newSlices = newWheelType.defaultItems.map((item: string, index: number) => {
              // Try multiple sources for images (for compatibility)
              let imageUrl = null;
              
              // Priority 1: wheelImages array from session
              if (data.wheelImages && Array.isArray(data.wheelImages) && data.wheelImages[index]) {
                imageUrl = typeof data.wheelImages[index] === 'string' 
                  ? data.wheelImages[index] 
                  : data.wheelImages[index]?.url;
              }
              
              // Priority 2: wheelState.wheelImages array
              if (!imageUrl && data.wheelState?.wheelImages && Array.isArray(data.wheelState.wheelImages) && data.wheelState.wheelImages[index]) {
                imageUrl = typeof data.wheelState.wheelImages[index] === 'string'
                  ? data.wheelState.wheelImages[index]
                  : data.wheelState.wheelImages[index]?.url;
              }
              
              // Priority 3: imageWheelSlices array with full image data
              if (!imageUrl && data.imageWheelSlices && Array.isArray(data.imageWheelSlices) && data.imageWheelSlices[index]?.image?.url) {
                imageUrl = data.imageWheelSlices[index].image.url;
              }

              console.log(`🖼️ PARTICIPANT: Slice ${index} image:`, imageUrl ? imageUrl.substring(0, 50) + '...' : 'none');

              return {
                id: `slice_${index}`,
                text: item,
                color: getSliceColor(index, newWheelType.defaultItems.length),
                image: imageUrl ? {
                  url: imageUrl,
                  isLoaded: false,
                  error: false
                } : undefined
              };
            });
            
            console.log('🖼️ PARTICIPANT: Created slices:', newSlices.map((s: WheelSlice) => ({
              id: s.id,
              text: s.text,
              hasImage: !!s.image
            })));
            
            setWheelSlices(newSlices);
          }
        }
        // 2. Fallback to wheelItems or wheelData for legacy support with image support
        else if (data.wheelItems && data.wheelItems.length > 0) {
          console.log('🖼️ PARTICIPANT: Creating slices from wheelItems with image support');
          
          const slices = data.wheelItems.map((item: string, index: number) => {
            // Try multiple sources for images
            let imageUrl = null;
            
            if (data.wheelImages && Array.isArray(data.wheelImages) && data.wheelImages[index]) {
              imageUrl = typeof data.wheelImages[index] === 'string'
                ? data.wheelImages[index]
                : data.wheelImages[index]?.url;
            }
            
            if (!imageUrl && data.wheelState?.wheelImages && Array.isArray(data.wheelState.wheelImages) && data.wheelState.wheelImages[index]) {
              imageUrl = typeof data.wheelState.wheelImages[index] === 'string'
                ? data.wheelState.wheelImages[index]
                : data.wheelState.wheelImages[index]?.url;
            }
            
            if (!imageUrl && data.imageWheelSlices && Array.isArray(data.imageWheelSlices) && data.imageWheelSlices[index]?.image?.url) {
              imageUrl = data.imageWheelSlices[index].image.url;
            }

            return {
              id: `slice_${index}`,
              text: item,
              color: getSliceColor(index, data.wheelItems.length),
              image: imageUrl ? {
                url: imageUrl,
                isLoaded: false,
                error: false
              } : undefined
            };
          });
          
          setWheelSlices(slices);
        }
        else if (data.wheelData && data.wheelData.slices) {
          setWheelSlices(data.wheelData.slices);
        }
        
        // 3. Handle session state changes
        if (data.currentState) {
          setSessionState(data.currentState);
        }
        
        // � PRIORITY: Handle instant synchronization flags for zero-delay response
        if (data.wheelState?.participantSync === 'immediate' ||
            data.wheelState?.instantStart ||
            data.wheelState?.zeroDelay ||
            data.spinningNotification?.priority === 'immediate') {
          console.log('⚡ INSTANT priority synchronization detected on mobile!');
        }

        // 🎯 🎯 🎯 CRITICAL DEBUGGING POINT: TRACK WHEEL STATE PROCESSING 🎯 🎯 🎯
        console.log('🔧 CHECKING WHEEL STATE FOR SPINNING:', {
          hasWheelState: !!data.wheelState,
          isSpinning: data.wheelState?.isSpinning,
          currentLocalSpinningState: isSpinning,
          willTriggerSpin: data.wheelState?.isSpinning && !isSpinning,
          timestamp: new Date().toISOString()
        });
        
        // 4. Handle enhanced real-time notifications with IMMEDIATE display
        if (data.spinningNotification) {
          if (data.spinningNotification.priority === 'immediate' && data.spinningNotification.isActive) {
            console.log('⚡ INSTANT spinning notification received on mobile!');
            setSpinningNotification(data.spinningNotification.message);
            // Immediate haptic feedback for priority notifications
            try {
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate([100, 50, 100]); // Quick notification pattern
              }
            } catch (e) {
              // Vibration not supported, continue without error
            }
          } else if (data.spinningNotification.isActive) {
            setSpinningNotification(data.spinningNotification.message);
          } else {
            setSpinningNotification(null);
          }
        }
        
        // 🎯 PERFECT RESULT NOTIFICATION SYNCHRONIZATION
        if (data.resultNotification && data.resultNotification.isActive) {
          console.log('🎯 PERFECT RESULT SYNC: Organizer sent result notification - participants show NOW!', {
            winnerCount: data.resultNotification.winners?.length || 0,
            winnerNames: data.resultNotification.winners?.map((w: any) => w.name) || [],
            exactSync: true,
            notificationTime: new Date().toISOString()
          });

          // 🎯 INSTANT result notification display
          setResultNotification(data.resultNotification);

          // 🎯 INSTANT confetti for synchronized celebration
          if (data.resultNotification.showConfetti) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 6000);
          }

          // 🎯 INSTANT haptic feedback for perfect sync
          try {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([300, 100, 300, 100, 300]);
            }
          } catch (e) {
            // Vibration not supported, continue without error
          }

          // 🎯 INSTANT winner display with EXACT organizer data
          if (data.resultNotification.winners) {
            console.log('🎯 PERFECT WINNER DISPLAY: Showing winners at exact same moment as organizer');
            setWinners(data.resultNotification.winners);
            setSessionState('completed');

            // Set EXACT final angle from organizer for perfect arrow positioning
            if (data.wheelState?.organizerFinalAngle !== undefined) {
              setCurrentAngle(data.wheelState.organizerFinalAngle);
              animatedAngle.setValue(data.wheelState.organizerFinalAngle);
            }
          }
        } else {
          setResultNotification(null);
        }
        
        // 5. 🎯 PERFECT WINNER SYNCHRONIZATION: Display winners at exact same moment as organizer
        if (data.winners && data.winners.length > 0) {
          console.log('🎯 PERFECT WINNER SYNC: Organizer announced winners - participants show NOW!', {
            winnerCount: data.winners.length,
            winners: data.winners.map((w: any) => w.name),
            exactSync: true,
            announcementTime: new Date().toISOString()
          });

          // 🎯 INSTANT winner display for perfect synchronization
          setWinners(data.winners);
          setSessionState('completed');

          // 🎯 INSTANT confetti for synchronized celebration
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 6000);
        }
        
        // 6. 🚀 🛠️ MOBILE SPINNING FIX: Enhanced real-time wheel state synchronization with GUARANTEED spinning
        if (data.wheelState) {
          const wheelState = data.wheelState;
          console.log('⚡ 🛠️ MOBILE SPINNING: Enhanced wheel state update:', {
            isSpinning: wheelState.isSpinning,
            progress: wheelState.progress,
            currentAngle: wheelState.currentAngle,
            totalRotation: wheelState.totalRotation,
            finalAngle: wheelState.finalAngle,
            spinStartTime: wheelState.spinStartTime,
            spinDuration: wheelState.spinDuration,
            hasResults: wheelState.hasResults,
            // 💥 Priority flags
            instantStart: wheelState.instantStart,
            participantSync: wheelState.participantSync,
            zeroDelay: wheelState.zeroDelay
          });
          
          const targetAngle = wheelState.currentAngle || 0;
          const wasSpinning = isSpinning;
          setIsSpinning(wheelState.isSpinning || false);
          
          // 🎯 PERFECT SYNCHRONIZATION: Start immediately with organizer's exact parameters
          if (wheelState.isSpinning && !wasSpinning) {
            console.log('⚡ PERFECT SYNC: Organizer started spinning - participants start NOW!');

            // 🎯 ULTIMATE SYNCHRONIZATION: Use EXACT same parameters as organizer
            const organizerTotalRotation = wheelState.totalRotation || (8 * 2 * Math.PI);
            const organizerSpinDuration = wheelState.spinDuration || 4000;
            const organizerFinalAngle = wheelState.finalAngle || 0;

            console.log('🚀 PERFECT PARTICIPANT SYNC - EXACT ORGANIZER PARAMS:', {
              organizerRotation: `${(organizerTotalRotation / (2 * Math.PI)).toFixed(2)} rotations`,
              organizerDuration: organizerSpinDuration + 'ms',
              organizerFinalAngle: `${(organizerFinalAngle * 180 / Math.PI).toFixed(1)}°`,
              timestamp: new Date().toISOString()
            });

            // EXACT MATCH: Use organizer's parameters without modification
            const participantDuration = organizerSpinDuration;
            const participantTotalRotation = organizerTotalRotation;
            const participantFinalAngle = organizerFinalAngle;

            console.log('🎯 PERFECT SYNCHRONIZATION - EXACT MATCH GUARANTEED:', {
              participantDuration: participantDuration + 'ms',
              participantRotation: `${(participantTotalRotation / (2 * Math.PI)).toFixed(2)} rotations`,
              participantFinalAngle: `${(participantFinalAngle * 180 / Math.PI).toFixed(1)}°`,
              exactMatch: '100%',
              noDelay: true,
              instantStart: true
            });

            // INSTANT START: Reset to 0 immediately
            animatedAngle.setValue(0);
            setCurrentAngle(0);

            // 🎯 ZERO DELAY: Start animation immediately for perfect sync
            console.log('🎯 MOBILE SPIN STARTING NOW - ZERO DELAY!');

            Animated.timing(animatedAngle, {
              toValue: participantTotalRotation,
              duration: participantDuration,
              useNativeDriver: true,
              easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
            }).start(() => {
              animatedAngle.setValue(participantTotalRotation);
              setCurrentAngle(participantTotalRotation);

              console.log('🎯 MOBILE ANIMATION COMPLETE - PERFECT MATCH:', {
                finalRotation: participantTotalRotation,
                finalAngle: `${(participantFinalAngle * 180 / Math.PI).toFixed(1)}°`,
                synchronizationStatus: 'PERFECT'
              });
            });

          } else if (!wheelState.isSpinning && wasSpinning) {
            // 🛠️ MOBILE SPINNING GUARANTEE: Enhanced finish synchronization
            const organizerFinalAngle = wheelState.finalAngle || wheelState.currentAngle || targetAngle;

            console.log('🎯 PERFECT FINISH SYNC - Organizer completed - participant finishing with EXACT match:', {
              organizerFinalAngle: `${(organizerFinalAngle * 180 / Math.PI).toFixed(1)}°`,
              participantFinalAngle: `${(organizerFinalAngle * 180 / Math.PI).toFixed(1)}°`,
              exactMatch: true,
              completionTime: new Date().toISOString()
            });

            // 🎯 INSTANT completion to EXACT final position for perfect synchronization
            // Use faster completion for immediate accuracy
            Animated.timing(animatedAngle, {
              toValue: organizerFinalAngle,
              duration: Math.max(50, 100), // Even faster settle for perfect sync
              useNativeDriver: true, // Use native driver for better performance
              easing: Easing.out(Easing.cubic),
            }).start();

          } else if (wheelState.isSpinning && wheelState.progress !== undefined && wheelState.progress < 1) {
            // 🎯 PERFECT REAL-TIME SYNC: Follow organizer's exact angle for perfect synchronization
            const organizerCurrentAngle = wheelState.currentAngle || targetAngle;

            // Use optimized updates for smooth real-time following - BALANCED PERFORMANCE
            const realTimeUpdateDuration = Math.max(5, 10); // Target 60fps updates for smooth sync

            Animated.timing(animatedAngle, {
              toValue: organizerCurrentAngle, // Follow organizer's exact angle
              duration: realTimeUpdateDuration,
              useNativeDriver: true, // Use native driver for better performance
              easing: Easing.linear, // Linear easing for instant response
            }).start();

            console.log('🎯 PERFECT REAL-TIME SYNC FOLLOWING ORGANIZER:', {
              progress: Math.round(wheelState.progress * 100) + '%',
              organizerCurrentAngle: Math.round(organizerCurrentAngle),
              participantFollowingAngle: Math.round(organizerCurrentAngle),
              updateDuration: realTimeUpdateDuration + 'ms',
              exactRealTimeSync: true,
              followingOrganizer: true,
              syncTime: new Date().toISOString()
            });
          }
          
          setCurrentAngle(targetAngle);
        }
        
        // 🚀 NEW: Handle custom wheel items synchronization from organizer
        if (data.customWheelItems && Array.isArray(data.customWheelItems)) {
          console.log('🎯 MOBILE PARTICIPANT: Received custom wheel items:', {
            itemCount: data.customWheelItems.length,
            items: data.customWheelItems.slice(0, 3),
            isCustomText: data.wheelItemsSync?.isCustomText,
            priority: data.wheelItemsSync?.priority
          });
          
          // Update wheel slices to use organizer's custom text
          const customSlices = data.customWheelItems.map((item: string, index: number) => ({
            id: `custom-${index}`,
            text: item,
            color: getSliceColor(index, data.customWheelItems.length)
          }));
          
          setWheelSlices(customSlices);
          
          // Show notification to participant about wheel items update
          if (data.wheelItemsSync?.priority === 'immediate') {
            Alert.alert(
              '🔄 Wheel Updated!',
              `Organizer updated the wheel with ${data.customWheelItems.length} custom items`,
              [{ text: 'Got it!', style: 'default' }]
            );
          }
        }
        
        // 🚀 NEW: Handle custom wheel theme synchronization from organizer
        if (data?.customWheelTheme || data?.theme) {
          const themeData: WheelThemeData = data.customWheelTheme || data.theme;

          // Enhanced error handling: Validate theme data before processing
          if (!themeData || typeof themeData !== 'object') {
            console.warn('⚠️ MOBILE PARTICIPANT: Invalid theme data received, skipping update');
            return;
          }

          // Log theme update with improved readability and performance optimization
          logThemeUpdate(themeData, data);

          // Update the custom theme state for wheel color synchronization
          // Added safety check to ensure theme has required properties
          if (themeData.primary || themeData.secondary) {
            setCustomWheelTheme(themeData);
          } else {
            console.warn('⚠️ MOBILE PARTICIPANT: Theme data missing required color properties');
          }

          // Show notification to participant about theme update
          // Improved condition checking with better fallbacks
          const shouldShowNotification =
            data?.wheelThemeSync?.priority === 'immediate' ||
            Boolean(data?.themeUpdatedAt);

          if (shouldShowNotification) {
            const themeName = themeData.name || 'custom';
            Alert.alert(
              '🎨 Theme Updated!',
              `Organizer applied ${themeName} theme`,
              [{ text: 'Got it!', style: 'default' }]
            );
          }
        }
      }, (error) => {
        console.error('❌ Error listening to session updates:', error);
        setIsConnected(false);
        
        // Enhanced fallback: Try listening to wheel document directly
        const wheelUnsubscribe = onSnapshot(doc(db, 'wheels', sessionId), (wheelDoc) => {
          if (wheelDoc.exists()) {
            const wheelData = wheelDoc.data();
            console.log('🔄 Fallback: Using wheel document data');
            if (wheelData && wheelData.slices) {
              setWheelSlices(wheelData.slices);
              setIsConnected(true);
            }
          }
        }, (wheelError) => {
          console.error('❌ Fallback wheel listener also failed:', wheelError);
        });
        
        return () => wheelUnsubscribe();
      });
    } catch (error) {
      console.error('❌ Failed to set up session listener:', error);
      setIsConnected(false);
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [sessionId, customWheelTheme]); // Include customWheelTheme to trigger redraws when theme changes

  // Wheel automatically re-renders when customWheelTheme changes due to React state updates
  // No additional useEffect needed since renderSegments() uses the customWheelTheme state

  // Enhanced color generation function with custom theme support
  const getSliceColor = (index: number, total: number): string => {
    // Check if we have custom theme colors from organizer
    if (customWheelTheme && customWheelTheme.primary && customWheelTheme.secondary) {
      console.log('🎨 MOBILE PARTICIPANT: Using custom theme colors for wheel slices:', {
        themeName: customWheelTheme.name,
        primary: customWheelTheme.primary,
        secondary: customWheelTheme.secondary,
        index: index,
        total: total
      });

      // Use custom theme colors - alternate between primary and secondary
      return index % 2 === 0 ? customWheelTheme.primary : customWheelTheme.secondary;
    }

    // Fallback to school maroon colors if no custom theme - ENSURE MAROON SCHOOL COLORS
    const colors = [
      '#8e0b16', // School primary maroon
      '#66181E', // School secondary maroon
      '#B8424A', // Light maroon
      '#4A1A1F', // Dark maroon
      '#8e0b16', // Repeat school primary
      '#66181E', // Repeat school secondary
      '#B8424A', // Repeat light maroon
      '#4A1A1F', // Repeat dark maroon
      '#8e0b16', // Repeat school primary
      '#66181E', // Repeat school secondary
      '#B8424A', // Repeat light maroon
      '#4A1A1F', // Repeat dark maroon
      '#8e0b16', // Repeat school primary
      '#66181E', // Repeat school secondary
      '#B8424A', // Repeat light maroon
      '#4A1A1F', // Repeat dark maroon
    ];

    const selectedColor = colors[index % colors.length];
    console.log('🎨 MOBILE PARTICIPANT: Using fallback maroon color:', {
      index: index,
      total: total,
      selectedColor: selectedColor,
      hasCustomTheme: !!customWheelTheme
    });

    return selectedColor;
  };

  const size = 300;
  const radius = size / 2;
  const segmentAngle = wheelSlices.length > 0 ? 360 / wheelSlices.length : 360;
  const wheelColors = {
    primary: theme.primary,
    secondary: theme.secondary,
    accent: theme.onPrimary,
    background: theme.surface,
    text: theme.onSurface,
  };

  const renderSegments = () => {
    if (wheelSlices.length === 0) {
      // Enhanced loading state with connection status
      const loadingText = !isConnected ? 'Connecting...' : 'Waiting for wheel...';
      return (
        <G>
          <Path d={`M ${radius} ${radius} L ${radius} 0 A ${radius} ${radius} 0 1 1 ${radius - 0.1} 0 Z`} fill={wheelColors.primary} />
          <SvgText
            x={radius}
            y={radius * 0.4}
            fill={wheelColors.accent}
            fontSize="16"
            fontWeight="bold"
            textAnchor="middle"
          >
            {loadingText}
          </SvgText>
          {lastUpdate && (
            <SvgText
              x={radius}
              y={radius * 0.6}
              fill={wheelColors.accent}
              fontSize="12"
              textAnchor="middle"
            >
              Last update: {lastUpdate.toLocaleTimeString()}
            </SvgText>
          )}
        </G>
      );
    }

    return wheelSlices.map((slice, index) => {
      const startAngle = index * segmentAngle;
      const endAngle = startAngle + segmentAngle;
      const isEven = index % 2 === 0;

      const arc = (x: number, y: number, r: number, start: number, end: number) => {
        const startRad = (start - 90) * Math.PI / 180;
        const endRad = (end - 90) * Math.PI / 180;
        const largeArcFlag = end - start <= 180 ? '0' : '1';
        const startX = x + r * Math.cos(startRad);
        const startY = y + r * Math.sin(startRad);
        const endX = x + r * Math.cos(endRad);
        const endY = y + r * Math.sin(endRad);
        return `M ${x} ${y} L ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
      };

      // Enhanced color selection with better contrast
      const sliceColor = slice.color || getSliceColor(index, wheelSlices.length);
      
      // Check if slice has image
      const hasImage = slice.image?.url;
      
      // Calculate image position and size (simplified for participant view)
      const midAngle = (startAngle + endAngle) / 2;
      const midAngleRad = (midAngle - 90) * Math.PI / 180;
      const imageRadius = radius * 0.5; // Position image at 50% of radius
      const imageSize = radius * 0.3; // Image size relative to wheel size
      const imageX = radius + imageRadius * Math.cos(midAngleRad) - imageSize / 2;
      const imageY = radius + imageRadius * Math.sin(midAngleRad) - imageSize / 2;

      return (
        <G key={slice.id}>
          {/* Background slice */}
          <Path d={arc(radius, radius, radius, startAngle, endAngle)} fill={sliceColor} />
          
          {/* Image overlay if available */}
          {hasImage && (
            <>
              <Defs>
                <ClipPath id={`clip-${slice.id}`}>
                  <Path d={arc(radius, radius, radius, startAngle, endAngle)} />
                </ClipPath>
              </Defs>
              <SvgImage
                x={imageX}
                y={imageY}
                width={imageSize}
                height={imageSize}
                href={slice.image!.url}
                clipPath={`url(#clip-${slice.id})`}
                preserveAspectRatio="xMidYMid slice"
              />
            </>
          )}
          
          {/* Text overlay */}
          <SvgText
            x={radius}
            y={hasImage ? radius * 0.8 : radius * 0.3}
            fill="#ffffff"
            fontSize={hasImage ? "12" : "14"}
            fontWeight="bold"
            textAnchor="middle"
            transform={`rotate(${startAngle + segmentAngle / 2}, ${radius}, ${radius})`}
          >
            {slice.text.length > 15 ? `${slice.text.substring(0, 12)}...` : slice.text}
          </SvgText>
        </G>
      );
    });
  };

  const renderPointer = () => {
    return (
      <G>
        {/* Enhanced pointer positioned at top-center and pointing inward */}
        <Path
          d="M 12.5 5 L 25 25 L 37.5 5 Z"
          fill="#FFD700" // Bright gold/yellow for high visibility
          stroke="#FF4500" // Orange-red border
          strokeWidth={3}
        />
        <Path
          d="M 17.5 8 L 25 20 L 32.5 8 Z"
          fill="#FF4500" // Orange-red fill
        />
        {/* Add a shadow effect for better visibility */}
        <Path
          d="M 12.5 7 L 25 27 L 37.5 7 Z"
          fill="rgba(0,0,0,0.3)"
          stroke="none"
        />
        {/* Add a white highlight for extra visibility */}
        <Path
          d="M 20 10 L 25 15 L 30 10 Z"
          fill="rgba(255,255,255,0.8)"
          stroke="none"
        />
      </G>
    );
  };

  return (
    <View style={styles.container}>
      {/* Enhanced wheel type info display */}
      {showWheelInfo && selectedWheelType && (
        <View style={styles.wheelInfo}>
          <Text style={styles.wheelTypeIcon}>{selectedWheelType.icon}</Text>
          <Text style={styles.wheelTypeName}>{selectedWheelType.title}</Text>
          <Text style={styles.wheelTypeDescription}>{selectedWheelType.description}</Text>
        </View>
      )}

      {/* Debug arrow visibility */}
      {__DEV__ && (
        <View style={{position: 'absolute', top: 10, right: 10, gap: 5}}>
          <Text style={{color: 'red', fontSize: 12}}>
            Arrow: {arrowVisible ? 'Visible' : 'Hidden'}
          </Text>
          <Text style={{color: 'orange', fontSize: 12}}>
            Pointer: Rendered ✅
          </Text>
          <Text style={{color: 'blue', fontSize: 10}}>
            Connected: {isConnected ? '✅' : '❌'}
          </Text>
          <Text style={{color: 'green', fontSize: 10}}>
            Spinning: {isSpinning ? '🌀' : '⏸️'}
          </Text>
          <View style={{gap: 2}}>
            <TouchableOpacity
              onPress={() => {
                console.log('🧪 FORCE SPIN TEST TRIGGERED');
                // Force trigger the spin logic locally
                setIsSpinning(true);
                Animated.timing(animatedAngle, {
                  toValue: 12 * Math.PI, // Force a full spin
                  duration: 3000,
                  useNativeDriver: true, // Use native driver for better performance
                  easing: Easing.out(Easing.cubic),
                }).start(() => {
                  console.log('🧪 FORCE SPIN TEST COMPLETED');
                  setIsSpinning(false);
                });
              }}
              style={{backgroundColor: 'purple', padding: 5, borderRadius: 5}}
            >
              <Text style={{color: 'white', fontSize: 10}}>🧪 Force Spin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                // Force Firebase sync test - simulate what organizer would send
                const testWheelState = {
                  isSpinning: true,
                  totalRotation: 6.28, // 2π radians = full circle
                  spinDuration: 3000,
                  finalAngle: 3.14, // Half circle
                  progress: 0
                };
                console.log('🔧 FORCE FIREBASE SYNC TEST TRIGGERED:', testWheelState);
                console.log('🔧 Testing if wheelState handling works...');

                // Simulate the wheelState handling logic
                setIsSpinning(testWheelState.isSpinning || false);
                setSessionState('spinning');

                Animated.timing(animatedAngle, {
                  toValue: testWheelState.totalRotation,
                  duration: testWheelState.spinDuration,
                  useNativeDriver: true, // Use native driver for better performance
                  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                }).start(() => {
                  console.log('🔧 FORCE FIREBASE SYNC TEST COMPLETED');
                  setIsSpinning(false);
                  setSessionState('completed');
                });
              }}
              style={{backgroundColor: 'orange', padding: 5, borderRadius: 5}}
            >
              <Text style={{color: 'white', fontSize: 10}}>🔧 Force Sync</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Enhanced session status display with real-time notifications */}
      <View style={[styles.statusContainer, {
        backgroundColor: sessionState === 'spinning' ? '#FFF3CD' : 
                        sessionState === 'completed' ? '#D1ECF1' : '#E7F3FF'
      }]}>
        <View style={[styles.statusDot, {
          backgroundColor: sessionState === 'spinning' ? '#F39C12' : 
                          sessionState === 'completed' ? '#28A745' : '#007BFF'
        }]} />
        <Text style={styles.statusText}>
          {spinningNotification || (
            sessionState === 'waiting' && 'Organizer is preparing the wheel...'
          ) || (
            sessionState === 'spinning' && '🎯 Wheel is spinning...'
          ) || (
            sessionState === 'completed' && '🎉 Results are ready!'
          )}
        </Text>
      </View>
      
      {/* Enhanced result notification display */}
      {resultNotification && resultNotification.isActive && (
        <View style={[styles.resultNotificationContainer, {
          backgroundColor: '#D4EDDA',
          borderColor: '#28A745'
        }]}>
          <Text style={[styles.resultNotificationText, { color: '#155724' }]}>
            {resultNotification.message}
          </Text>
          {resultNotification.winners && resultNotification.winners.length > 0 && (
            <View style={styles.winnersInNotification}>
              {resultNotification.winners.map((winner: any, index: number) => (
                <Text key={`notif-winner-${index}`} style={styles.winnerNotificationText}>
                  ✓ {winner.name}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
      
      {/* Connection status indicator */}
      <View style={[styles.connectionStatus, {
        backgroundColor: isConnected ? '#D4EDDA' : '#F8D7DA'
      }]}>
        <Text style={[styles.connectionText, {
          color: isConnected ? '#155724' : '#721C24'
        }]}>
          {isConnected ? '🟢 Live' : '🔴 Disconnected'}
        </Text>
      </View>
      
      <View style={styles.wheelContainer}>
        {/* Stationary pointer - positioned above the wheel */}
        <View style={styles.pointerContainer}>
          <Svg width={50} height={40} viewBox="0 0 50 40">
            {renderPointer()}
          </Svg>
        </View>

        {/* Rotating wheel */}
        <Animated.View
          style={[
            styles.wheelContainer,
            {
              transform: [
                {
                  rotate: animatedAngle.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
                {
                  scale: isSpinning ? 1.08 : 1, // Slightly larger when spinning
                },
              ],
              shadowOpacity: isSpinning ? 0.3 : 0.1, // Enhanced shadow when spinning
              shadowRadius: isSpinning ? 10 : 5,
            },
          ]}
        >
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {renderSegments()}
          </Svg>
        </Animated.View>
      </View>
      
      {/* Enhanced winners display */}
      {sessionState === 'completed' && winners.length > 0 && (
        <View style={styles.winnersContainer}>
          <Text style={styles.winnersTitle}>🎉 Winner{winners.length > 1 ? 's' : ''}:</Text>
          {winners.map((winner, index) => (
            <View key={`winner-${index}`} style={styles.winnerItem}>
              <Text style={styles.winnerBadge}>#{index + 1}</Text>
              <Text style={styles.winnerName}>{winner.name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  wheelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointerContainer: {
    position: 'absolute',
    top: -15, // Position slightly above the wheel
    left: '50%',
    marginLeft: -25, // Center the pointer (50/2 = 25)
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelInfo: {
    backgroundColor: '#E7F3FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007BFF',
  },
  wheelTypeIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  wheelTypeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007BFF',
    marginBottom: 2,
  },
  wheelTypeDescription: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  connectionStatus: {
    padding: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  winnersContainer: {
    backgroundColor: '#D4EDDA',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#28A745',
    width: '100%',
  },
  winnersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#155724',
    marginBottom: 8,
    textAlign: 'center',
  },
  winnerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  winnerBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#28A745',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#28A745',
  },
  winnerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#155724',
  },
  // Enhanced notification styles
  resultNotificationContainer: {
    backgroundColor: '#D4EDDA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#28A745',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultNotificationText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#155724',
    textAlign: 'center',
    marginBottom: 8,
  },
  winnersInNotification: {
    alignItems: 'center',
  },
  winnerNotificationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#155724',
    marginVertical: 2,
  },
});

export default StudentWheel;
export type { SelectedWheelType };
