import React, { FC, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert
} from 'react-native';
import Svg, { G, Path, Circle, Text as SvgText, Image as SvgImage, ClipPath, Defs, Rect, Pattern } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../config/firebaseConfig';
import { doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { calculateUnifiedWinner } from '../utils/WheelSynchronizationUtils';

// Modern color palette - Maroon theme
const COLORS = {
  primary: '#8e0b16',
  primaryLight: '#b8424a',
  primaryDark: '#66181E',
  secondary: '#66181E',
  accent: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  surface: '#ffffff',
  surfaceSecondary: '#f8fafc',
  text: '#1e293b',
  textSecondary: '#64748b',
  textLight: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
};

// Enhanced responsive design helpers
const getDeviceDimensions = () => {
  const { width, height } = Dimensions.get('window');
  const isLandscape = width > height;
  const aspectRatio = width / height;

  return {
    width,
    height,
    isLandscape,
    aspectRatio,
    // Enhanced device size categories
    isExtraSmall: width < 320,
    isSmall: width >= 320 && width < 375,
    isMedium: width >= 375 && width < 414,
    isLarge: width >= 414 && width < 768,
    isExtraLarge: width >= 768 && width < 1024,
    isTablet: width >= 768,
    // Orientation-aware scaling
    scaleFactor: Math.min(width / 375, height / 667), // Base scaling from iPhone 6/7/8
    // Safe area considerations
    safeScaleFactor: Math.min(width / 320, height / 568), // Minimum safe scaling
  };
};

// Enhanced responsive sizing functions
const getResponsiveFontSize = (baseSize: number) => {
  const dimensions = getDeviceDimensions();
  let size = baseSize * dimensions.scaleFactor;

  // Additional adjustments for different screen sizes
  if (dimensions.isExtraSmall) {
    size *= 0.85; // Reduce on very small screens
  } else if (dimensions.isSmall) {
    size *= 0.9; // Slightly reduce on small screens
  } else if (dimensions.isLarge) {
    size *= 1.05; // Slightly increase on large phones
  } else if (dimensions.isTablet) {
    size *= 1.1; // Increase on tablets
  }

  // Landscape adjustments
  if (dimensions.isLandscape) {
    size *= 0.95; // Slightly reduce in landscape
  }

  return Math.max(size, 8); // Minimum font size
};

const getResponsiveSpacing = (baseSpacing: number) => {
  const dimensions = getDeviceDimensions();
  let spacing = baseSpacing * dimensions.safeScaleFactor;

  // Adjust spacing for different sizes
  if (dimensions.isExtraSmall) {
    spacing = Math.max(spacing * 0.8, 2); // Reduce minimum spacing on extra small screens
  } else if (dimensions.isSmall) {
    spacing = Math.max(spacing * 0.85, 3); // Reduce on small screens
  } else if (dimensions.isTablet) {
    spacing = Math.min(spacing * 1.2, 40); // Increase on tablets
  }

  return spacing;
};

const getResponsiveWheelSize = () => {
  const dimensions = getDeviceDimensions();
  const { width, height, isLandscape } = dimensions;

  // Base calculations
  const maxWidth = isLandscape ? height * 0.8 : width * 0.85;
  const maxHeight = isLandscape ? width * 0.7 : height * 0.45;

  // Responsive wheel size based on screen size
  let baseSize;
  if (dimensions.isExtraSmall) {
    baseSize = Math.min(maxWidth, maxHeight, 280); // Smaller on very small screens
  } else if (dimensions.isSmall) {
    baseSize = Math.min(maxWidth, maxHeight, 320); // Small phones
  } else if (dimensions.isMedium) {
    baseSize = Math.min(maxWidth, maxHeight, 380); // Medium phones
  } else if (dimensions.isLarge) {
    baseSize = Math.min(maxWidth, maxHeight, 420); // Large phones
  } else if (dimensions.isTablet) {
    baseSize = Math.min(maxWidth, maxHeight, 500); // Tablets
  } else {
    baseSize = Math.min(maxWidth, maxHeight, 450); // Default
  }

  return Math.max(baseSize, 200); // Minimum wheel size
};

interface WheelSlice {
  id: string;
  text: string;
  color: string;
  image?: {
    url: string;
    alt?: string;
    isLoaded?: boolean;
    error?: boolean;
    imgElement?: any; // For React Native image handling
  };
}

// Theme colors for different wheel themes
const wheelThemes: Record<string, string[]> = {
  school: ["#8e0b16", "#66181E"],
  'rainbow-bright': ["#dc2626", "#ea580c", "#f59e0b", "#22c55e", "#3b82f6", "#7c3aed"],
  'neon-electric': ["#00ff00", "#00ffff", "#ff00ff", "#ffff00", "#ff0080", "#8000ff"],
  'ocean-depths': ["#1e40af", "#3b82f6", "#06b6d4", "#0891b2", "#0e7490", "#164e63"],
  'sunset-blaze': ["#dc2626", "#ea580c", "#f59e0b", "#f97316", "#fb923c", "#fdba74"],
  'purple-galaxy': ["#7c3aed", "#a855f7", "#c084fc", "#d946ef", "#e879f9", "#f0abfc"],
  'emerald-forest': ["#166534", "#16a34a", "#22c55e", "#4ade80", "#84cc16", "#a3e635"],
  'hot-pink': ["#be185d", "#ec4899", "#f472b6", "#fb7185", "#fca5a5", "#fecdd3"],
  'golden-luxury': ["#d97706", "#f59e0b", "#fbbf24", "#fcd34d", "#fde68a", "#fef3c7"],
  'cyber-blue': ["#1e40af", "#3b82f6", "#60a5fa", "#93c5fd", "#dbeafe", "#eff6ff"],
  'fire-ice': ["#dc2626", "#ef4444", "#06b6d4", "#0891b2", "#f59e0b", "#fbbf24"],
  'lime-splash': ["#65a30d", "#84cc16", "#a3e635", "#bef264", "#d9f99d", "#ecfccb"],
  'midnight-dark': ["#1e293b", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1"],
  'cotton-candy': ["#ec4899", "#f472b6", "#a855f7", "#c084fc", "#e879f9", "#f0abfc"],
  'volcanic-orange': ["#ea580c", "#f97316", "#fb923c", "#fdba74", "#fed7aa", "#ffedd5"],
  'arctic-frost': ["#06b6d4", "#0891b2", "#0e7490", "#22d3ee", "#67e8f9", "#a5f3fc"],
  'tropical-sunset': ["#ea580c", "#f97316", "#22c55e", "#84cc16", "#3b82f6", "#7c3aed"],
  'royal-crown': ["#7c3aed", "#a855f7", "#d97706", "#f59e0b", "#dc2626", "#be185d"]
};

interface OrganizerWheelProps {
   sessionId: string;
   wheelType: any;
   customItems?: string[];
   customTitle?: string;
   customMessage?: string;
   customWinnerWord?: string;
   allowManualWinnerSelection?: boolean;
   selectedTheme?: string;
   onThemeChange?: (theme: string) => void; // Callback for theme changes
   onSpinComplete?: (result: any) => void;
   onSpinStart?: () => void;
   broadcastSource?: 'organizer' | 'collaborator' | 'full-access-collaborator';
   // 🔄 CRITICAL: Props for bidirectional remote spin synchronization
   forceSpinTrigger?: number;
   forceSpinWinner?: string;
   isSpinningRemote?: boolean;
   onForceSpinTriggerProcessed?: () => void; // Callback to reset trigger after processing
   // 🖼️ CRITICAL: Stability mode for perfect image rendering during spins
   imageStabilityMode?: boolean; // Signals to use stable image rendering during spinning
   // Image support props
   wheelImages?: {[key: string]: string};
}

const OrganizerWheel: FC<OrganizerWheelProps> = ({
   sessionId,
   wheelType,
   customItems,
   customTitle,
   customMessage,
   customWinnerWord = 'Winner',
   allowManualWinnerSelection = false,
   selectedTheme = 'school',
   onThemeChange,
   onSpinComplete,
   onSpinStart,
   broadcastSource = 'organizer',
   // 🔄 CRITICAL: New props for bidirectional remote spin synchronization
   forceSpinTrigger,
   forceSpinWinner,
   isSpinningRemote,
   onForceSpinTriggerProcessed,
   // 🖼️ CRITICAL: Stability mode for perfect image rendering during spins
   imageStabilityMode = false,
   // Image support props
   wheelImages
}) => {
  const [wheelSlices, setWheelSlices] = useState<WheelSlice[]>([]);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isManualMode, setIsManualMode] = useState(false);
  const [isSpinCompleting, setIsSpinCompleting] = useState(false);
  const [lastSpinTimestamp, setLastSpinTimestamp] = useState<number>(0);
  const [lastWinnerAnnounced, setLastWinnerAnnounced] = useState<string>('');
  const [lastWinnerTimestamp, setLastWinnerTimestamp] = useState<number>(0);
  const [currentSelectedTheme, setSelectedTheme] = useState<string>(selectedTheme);

  // Image management state
  const [imageLoadStates, setImageLoadStates] = useState<{[key: string]: 'loading' | 'loaded' | 'error'}>({});
  const [preloadedImages, setPreloadedImages] = useState<{[key: string]: any}>({});
  const [imageUrlCache, setImageUrlCache] = useState<{[key: string]: string}>({});

  // Pre-calculated image positions for stable rendering during spin
  const [imagePositions, setImagePositions] = useState<{[key: string]: {x: number, y: number, width: number, height: number}}>({});

  // BULLETPROOF PATTERN DEFINITIONS - ABSOLUTELY NO CHANGES DURING SPINNING
  const staticPatternDefinitionsRef = useRef<Record<string, { patternId: string; url: string; sliceId: string }>>({});

  const animationRef = useRef<number | null>(null);
  const spinStartTime = useRef<number | null>(null);
  const spinCompletionRef = useRef<boolean>(false);

  // Use enhanced responsive wheel size calculation
  const responsiveWheelSize = getResponsiveWheelSize();

  // Adjust wheel size based on text content for better readability
  const maxTextLength = Math.max(...wheelSlices.map(slice => slice.text.length));
  const avgTextLength = wheelSlices.reduce((sum, slice) => sum + slice.text.length, 0) / wheelSlices.length;
  const hasLongText = maxTextLength > 15;
  const hasVeryLongText = maxTextLength > 25;
  const hasMediumText = avgTextLength > 10;

  // Increase wheel size for longer text to ensure readability
  let sizeMultiplier = 1.0;
  if (hasVeryLongText) {
    sizeMultiplier = 1.4; // Larger increase for very long text
  } else if (hasLongText) {
    sizeMultiplier = 1.25; // Moderate increase for long text
  } else if (hasMediumText) {
    sizeMultiplier = 1.1; // Small increase for medium text
  }

  // Also consider number of slices - more slices need more space
  const sliceCountMultiplier = wheelSlices.length > 8 ? 1.1 : wheelSlices.length > 12 ? 1.2 : 1.0;

  const wheelSize = responsiveWheelSize * sizeMultiplier * sliceCountMultiplier;

  // 🎯 CRITICAL FIX: Force Canvas rendering for image picker wheels to prevent image vanishing
  const shouldUseCanvasRendering = wheelType?.value === 'image-picker' || wheelType?.id === 'image-picker-wheel';

  const imagePickerMode = shouldUseCanvasRendering && wheelSlices.some(slice => slice.image?.url);


  // Initialize wheel slices
  useEffect(() => {
    const itemsToUse = customItems || wheelType?.defaultItems || ['Team Alpha', 'Team Beta', 'Team Gamma', 'Team Delta'];
    
    // Debug logging for image picker wheels
    const isImagePickerWheel = wheelType?.value === 'image-picker' || wheelType?.id === 'image-picker-wheel';
    if (isImagePickerWheel) {
      console.log('🖼️ OrganizerWheel: Initializing image picker wheel slices', {
        wheelImages: wheelImages ? Object.keys(wheelImages).length : 0,
        wheelImagesData: wheelImages,
        itemCount: itemsToUse.length
      });
    }
    
    if (itemsToUse && itemsToUse.length > 0) {
      const slices = itemsToUse.map((item: string, index: number) => {
        const sliceId = `slice-${index}`;
        const imageUrl = wheelImages && typeof wheelImages === 'object' && wheelImages[index] ? wheelImages[index] : undefined;

        if (isImagePickerWheel) {
          console.log(`🖼️ Slice ${index} (${item}): imageUrl =`, imageUrl ? imageUrl.substring(0, 50) + '...' : 'none');
        }

        return {
          id: sliceId,
          text: item,
          color: getSliceColor(index),
          image: imageUrl ? {
            url: imageUrl,
            isLoaded: false,
            error: false,
            imgElement: { uri: imageUrl }
          } : undefined
        };
      });
      
      if (isImagePickerWheel) {
        const imagesFound = slices.filter((s: WheelSlice) => s.image?.url).length;
        console.log(`🖼️ OrganizerWheel: Created ${slices.length} slices, ${imagesFound} with images`);

        // 🚨 CRITICAL DEBUG: Track slice images for debugging the "NO PATTERNS" error
        const slicelmages = imagesFound; // Alias for debugging
        const imagePickerMode = true; // We know this is active

        if (__DEV__) {
          console.log('🚨 IMAGE PICKER DEBUG:', {
            wheelType: wheelType?.value,
            isImagePicker: true,
            imagePickerMode,
            slicelmages,
            totalSlices: slices.length,
            hasImages: imagesFound > 0,
            sliceDetails: slices.map((s: WheelSlice) => ({
              id: s.id,
              text: s.text,
              hasImage: !!s.image?.url,
              imageUrl: s.image?.url ? s.image.url.substring(0, 30) + '...' : null
            }))
          });

          // This is the error the user is seeing
          if (slicelmages === 0) {
            console.warn('⚠️ DEBUG: slicelmages: 0 imagePickerMode: true');
            console.warn('NO PATTERNS CREATED DURING SPINNING - Images will vanish!');
          }
        }
      }
      
      setWheelSlices(slices);
    } else {
      // Fallback to default items
      const defaultItems = ['Team Alpha', 'Team Beta', 'Team Gamma', 'Team Delta'];
      const slices = defaultItems.map((item: string, index: number) => {
        const sliceId = `slice-${index}`;
        const imageUrl = wheelImages && typeof wheelImages === 'object' && wheelImages[index] ? wheelImages[index] : undefined;

        return {
          id: sliceId,
          text: item,
          color: getSliceColor(index),
          image: imageUrl ? {
            url: imageUrl,
            isLoaded: false,
            error: false,
            imgElement: { uri: imageUrl }
          } : undefined
        };
      });
      setWheelSlices(slices);
    }
  }, [wheelType, customItems, currentSelectedTheme, wheelImages]);

  // Image loading and management
  const loadImageForSlice = useCallback(async (sliceId: string, imageUrl: string) => {
    if (!imageUrl) return;

    console.log(`🖼️ Loading image for slice ${sliceId}:`, imageUrl.substring(0, 100) + (imageUrl.length > 100 ? '...' : ''));

    setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loading' }));

    try {
      // Handle data URLs differently - they don't need network loading
      if (imageUrl.startsWith('data:')) {
        console.log(`📄 Data URL detected for slice ${sliceId}, using directly`);

        const imageSource = { uri: imageUrl };

        // Update slice with image data immediately for data URLs
        setWheelSlices(prev => prev.map(slice => {
          if (slice.id === sliceId) {
            return {
              ...slice,
              image: {
                url: imageUrl,
                isLoaded: true,
                error: false,
                imgElement: imageSource
              }
            };
          }
          return slice;
        }));

        // Cache the image URL
        setImageUrlCache(prev => ({ ...prev, [sliceId]: imageUrl }));

        // Preload the image for better performance
        setPreloadedImages(prev => ({ ...prev, [sliceId]: imageSource }));

        // 🔧 CRITICAL FIX: Add pattern to static definitions for stable rendering
        staticPatternDefinitionsRef.current[sliceId] = {
          patternId: `static-pattern-${sliceId}`,
          url: imageUrl,
          sliceId: sliceId
        };

        setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loaded' }));

        console.log(`✅ Data URL loaded successfully for slice ${sliceId}`);
        return;
      }

      // For regular URLs, create an Image element to test loading
      const img = new Image();

      // Set up promise to handle loading
      const loadPromise = new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error('Image failed to load'));
        img.src = imageUrl;
      });

      // Add timeout for slow-loading images
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Image load timeout')), 10000); // 10 second timeout
      });

      // Race between loading and timeout
      await Promise.race([loadPromise, timeoutPromise]);

      // If we get here, image loaded successfully
      const imageSource = { uri: imageUrl };

      // Update slice with image data
      setWheelSlices(prev => prev.map(slice => {
        if (slice.id === sliceId) {
          return {
            ...slice,
            image: {
              url: imageUrl,
              isLoaded: true,
              error: false,
              imgElement: imageSource
            }
          };
        }
        return slice;
      }));

      // Cache the image URL
      setImageUrlCache(prev => ({ ...prev, [sliceId]: imageUrl }));

      // Preload the image for better performance
      setPreloadedImages(prev => ({ ...prev, [sliceId]: imageSource }));

      // 🔧 CRITICAL FIX: Add pattern to static definitions for stable rendering
      staticPatternDefinitionsRef.current[sliceId] = {
        patternId: `static-pattern-${sliceId}`,
        url: imageUrl,
        sliceId: sliceId
      };

      setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loaded' }));

      console.log(`✅ Image loaded successfully for slice ${sliceId}`);
    } catch (error) {
      console.error(`❌ Failed to load image for slice ${sliceId}:`, error);

      // Update slice with error state
      setWheelSlices(prev => prev.map(slice => {
        if (slice.id === sliceId) {
          return {
            ...slice,
            image: {
              url: imageUrl,
              isLoaded: false,
              error: true,
              imgElement: undefined
            }
          };
        }
        return slice;
      }));

      setImageLoadStates(prev => ({ ...prev, [sliceId]: 'error' }));

      // Show user-friendly error message for common issues
      const errorMessage = imageUrl.includes('facebook.com') || imageUrl.includes('fbcdn.net')
        ? 'Facebook images are blocked by browser security. Try using direct image URLs from other sources.'
        : imageUrl.includes('instagram.com')
        ? 'Instagram images are blocked by browser security. Try using direct image URLs from other sources.'
        : imageUrl.startsWith('data:')
        ? 'Data URL format is not supported. Please use a regular image URL.'
        : 'Image failed to load. Please check the URL and try again.';

      console.warn(`⚠️ Image load error for ${sliceId}: ${errorMessage}`);
    }
  }, []);

  // Load images when wheel slices change
  useEffect(() => {
    if (wheelSlices && Array.isArray(wheelSlices)) {
      wheelSlices.forEach(slice => {
        if (slice.image?.url && !slice.image.isLoaded && !slice.image.error) {
          loadImageForSlice(slice.id, slice.image.url);
        }
      });
    }
  }, [wheelSlices, loadImageForSlice]);

  // 🎨 THEME SYNC: Only respond to prop changes, not Firebase directly
  // The parent OrganizerLiveRoomScreen handles all Firebase synchronization
  useEffect(() => {
    if (selectedTheme && selectedTheme !== currentSelectedTheme) {
      console.log('🎨 OrganizerWheel: Theme prop changed:', {
        oldTheme: currentSelectedTheme,
        newTheme: selectedTheme
      });

      setSelectedTheme(selectedTheme);

      // Update wheel slices to reflect new theme colors
      const itemsToUse = customItems || wheelType?.defaultItems || ['Team Alpha', 'Team Beta', 'Team Gamma', 'Team Delta'];
      if (itemsToUse.length > 0) {
        const slices = itemsToUse.map((item: string, index: number) => ({
          id: `slice-${index}`,
          text: item,
          color: getSliceColorForTheme(index, selectedTheme)
        }));
        setWheelSlices(slices);
      }
    }
  }, [selectedTheme, currentSelectedTheme, customItems, wheelType]);

  // Pre-calculate image positions for stable rendering during spin
  useEffect(() => {
    if (wheelSlices.length > 0) {
      const positions: {[key: string]: {x: number, y: number, width: number, height: number}} = {};

      const segmentAngle = 360 / wheelSlices.length;
      const radius = responsiveWheelSize / 2;

      wheelSlices.forEach((slice, index) => {
        const startAngle = index * segmentAngle;
        const endAngle = startAngle + segmentAngle;

        // CRITICAL FIX: Match web coordinate system (0° = right)
        const startAngleRad = startAngle * Math.PI / 180;
        const endAngleRad = endAngle * Math.PI / 180;

        const x1 = radius + radius * Math.cos(startAngleRad);
        const y1 = radius + radius * Math.sin(startAngleRad);
        const x2 = radius + radius * Math.cos(endAngleRad);
        const y2 = radius + radius * Math.sin(endAngleRad);

        // Include center point for triangular slices
        const centerX = radius;
        const centerY = radius;

        // Calculate bounding box
        const minX = Math.min(x1, x2, centerX);
        const maxX = Math.max(x1, x2, centerX);
        const minY = Math.min(y1, y2, centerY);
        const maxY = Math.max(y1, y2, centerY);

        positions[slice.id] = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        };
      });

      setImagePositions(positions);
    }
  }, [wheelSlices.length, responsiveWheelSize]); // Only recalculate when slice count or wheel size changes

  // BULLETPROOF: Clean up static pattern definitions when slices change or component unmounts
  useEffect(() => {
    // Clear old patterns when wheel slices change to prevent stale references
    staticPatternDefinitionsRef.current = {};
  }, [wheelSlices.length]); // Re-run when slice count changes

  useEffect(() => {
    return () => {
      // Clear all static pattern definitions on unmount to prevent memory leaks
      staticPatternDefinitionsRef.current = {};
    };
  }, [sessionId]); // Re-run when session changes (component remounts for new session)
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // Reset spin completion state
      setIsSpinCompleting(false);
      spinCompletionRef.current = false;
    };
  }, []);

  // Cleanup spin state when component unmounts
  useEffect(() => {
    return () => {
      // Mark spin as cancelled if still in progress
      if (isSpinning) {
        console.log('⚠️ Spin completion cancelled - component unmounting');
        updateDoc(doc(db, 'liveDrawSessions', sessionId), {
          isSpinning: false,
          currentState: 'cancelled',
          updatedAt: serverTimestamp()
        }).catch(error => {
          console.error('❌ Error cancelling spin on unmount:', error);
        });
      }
    };
  }, [sessionId, isSpinning]);


  // Get slice color based on theme
  const getSliceColor = (index: number): string => {
    const themeColors = wheelThemes[currentSelectedTheme as keyof typeof wheelThemes];
    if (themeColors && themeColors.length > 0) {
      return themeColors[index % themeColors.length];
    }

    // Default to HSL colors for school theme
    const hue = (index * 137.5) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  // Get slice color for a specific theme (used for theme synchronization)
  const getSliceColorForTheme = (index: number, themeName: string): string => {
    const themeColors = wheelThemes[themeName as keyof typeof wheelThemes];
    if (themeColors && themeColors.length > 0) {
      return themeColors[index % themeColors.length];
    }

    // Default to HSL colors for school theme
    const hue = (index * 137.5) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  // Get segment at specific angle - HELPER FUNCTION FOR PRECISE CALCULATION
  const getSegmentAtAngle = (angle: number): { index: number; slice: WheelSlice | null } => {
    if (wheelSlices.length === 0) return { index: -1, slice: null };

    const segmentAngle = (2 * Math.PI) / wheelSlices.length;
    let segmentIndex = Math.floor(angle / segmentAngle);

    // Ensure the index is within bounds
    segmentIndex = ((segmentIndex % wheelSlices.length) + wheelSlices.length) % wheelSlices.length;

    return {
      index: segmentIndex,
      slice: wheelSlices[segmentIndex] || null
    };
  };

  // BULLETPROOF WHEEL SEGMENTS RENDERING - STATIC PATTERN DEFINITIONS
  const renderWheelSegments = () => {
    if (wheelSlices.length === 0) {
      return (
        <G>
          <Circle cx={wheelSize/2} cy={wheelSize/2} r={wheelSize/2} fill={COLORS.primary} />
          <SvgText
            x={wheelSize/2}
            y={wheelSize/2 - 10}
            fill="#ffffff"
            fontSize="14"
            fontWeight="bold"
            textAnchor="middle"
          >
            Waiting for wheel...
          </SvgText>
          <SvgText
            x={wheelSize/2}
            y={wheelSize/2 + 10}
            fill="#ffffff"
            fontSize="12"
            textAnchor="middle"
          >
            Add items to spin
          </SvgText>
        </G>
      );
    }

    const segmentAngle = 360 / wheelSlices.length;
    const radius = wheelSize / 2;
    const centerRadius = Math.max(30, radius / 6);

    // 🔧 CRITICAL FIX: Define Defs ONCE outside G to prevent rendering issues during spinning
    const defsElement = (
      <Defs>
        {/* STATIC PATTERN DEFINITIONS - OUTSIDE OF RENDER LOOP TO PREVENT FLICKERING */}
        {Object.values(staticPatternDefinitionsRef.current).map(pattern => (
          <Pattern
            key={`static-defs-${pattern.patternId}`}
            id={pattern.patternId}
            patternUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={wheelSize}
            height={wheelSize}
          >
            <SvgImage
              href={pattern.url}
              x={0}
              y={0}
              width={wheelSize}
              height={wheelSize}
              preserveAspectRatio="xMidYMid slice"
            />
          </Pattern>
        ))}
      </Defs>
    );

    return (
      <G>
        {/* STATIC PATTERN DEFINITIONS - DEFINE ONCE */}
        {defsElement}

        {wheelSlices.map((slice: WheelSlice, index: number) => {
          // Get the existing pattern for this slice - STABLE FOR SPINNING
          const pattern = staticPatternDefinitionsRef.current[`slice-${index}`];
          const startAngle = index * segmentAngle;
          const endAngle = startAngle + segmentAngle;

          // CRITICAL FIX: Match web organizer coordinate system
          // Web uses 0° = right (3 o'clock), remove -90° offset
          const startAngleRad = startAngle * Math.PI / 180;
          const endAngleRad = endAngle * Math.PI / 180;

          const x1 = radius + radius * Math.cos(startAngleRad);
          const y1 = radius + radius * Math.sin(startAngleRad);
          const x2 = radius + radius * Math.cos(endAngleRad);
          const y2 = radius + radius * Math.sin(endAngleRad);

          const largeArcFlag = segmentAngle > 180 ? 1 : 0;
          const pathData = `M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

          const textAngle = startAngle + segmentAngle / 2;
          // CRITICAL FIX: Match web coordinate system (0° = right)
          const textAngleRad = textAngle * Math.PI / 180;

          // IMPROVED IMAGE STABILITY: When imageStabilityMode is enabled and spinning, ensure images stay stable
          const isImageStabilityMode = imageStabilityMode && (isSpinning || isSpinCompleting);
          const hasImage = slice.image?.url && slice.image.isLoaded && !slice.image.error;

          // Improved responsive font size calculation
          const baseFontSize = Math.min(radius / 8, 18); // Increased max font size and reduced divisor for better scaling
          const sliceCountReduction = Math.max(0, (wheelSlices.length - 6) * 0.4); // Start reducing earlier and more aggressively
          const textLengthReduction = Math.max(0, (slice.text ? slice.text.length : 0 - 8) * 0.5); // Reduce font size for longer text
          const fontSize = Math.max(baseFontSize - sliceCountReduction - textLengthReduction, 6); // Lower minimum font size

          // Calculate available space in segment for text with improved accuracy
          const actualTextRadius = slice.text.length > 15 ? radius * 0.6 : slice.text.length > 10 ? radius * 0.65 : radius * 0.7;
          const availableArcLength = (segmentAngle / 360) * 2 * Math.PI * actualTextRadius;
          const estimatedCharWidth = fontSize * 0.6; // Average character width
          const maxLength = Math.max(6, Math.floor(availableArcLength / estimatedCharWidth));

          // Smart text truncation with multiple strategies
          let displayText = slice.text;
          if (slice.text.length > maxLength) {
            // Strategy 1: Try to break at word boundaries
            const words = slice.text.split(' ');
            let truncatedText = '';
            for (const word of words) {
              if ((truncatedText + ' ' + word).length <= maxLength) {
                truncatedText = truncatedText ? truncatedText + ' ' + word : word;
              } else {
                break;
              }
            }

            if (truncatedText.length > 0) {
              displayText = truncatedText;
            } else {
              // Strategy 2: Try to break at common separators
              const separators = [' - ', ' | ', ' / ', ' • '];
              for (const separator of separators) {
                const parts = slice.text.split(separator);
                if (parts.length > 1) {
                  const firstPart = parts[0];
                  if (firstPart.length <= maxLength - 3) {
                    displayText = firstPart + "...";
                    break;
                  }
                }
              }

              // Strategy 3: Fallback to character truncation with smart ellipsis placement
              if (displayText === slice.text) {
                const keepStart = Math.floor((maxLength - 3) * 0.7); // Keep more of the beginning
                const keepEnd = maxLength - 3 - keepStart;
                displayText = slice.text.substring(0, keepStart) + "..." + slice.text.substring(slice.text.length - keepEnd);
              }
            }
          }

          // Dynamic text positioning based on text length and segment size
          const isNarrowSegment = segmentAngle < 30; // Less than 30 degrees is narrow
          const hasLongText = slice.text.length > 12;

          // Adjust text radius based on segment width and text length
          let textRadius = radius * 0.7; // Default position
          if (isNarrowSegment || hasLongText) {
            textRadius = radius * 0.55; // Move closer to center for narrow segments or long text
          } else if (slice.text.length > 8 && slice.text.length <= 12) {
            textRadius = radius * 0.65; // Slightly closer for medium-length text
          }

          // Additional adjustment for very long text
          if (slice.text.length > 20) {
            textRadius = radius * 0.5; // Move even closer to center
          }

          const textX = radius + textRadius * Math.cos(textAngleRad);
          const textY = radius + textRadius * Math.sin(textAngleRad);

          const imagePosition = imagePositions[slice.id];

          // Use pre-calculated positions if available, otherwise fallback to calculation
          let imageX, imageY, imageWidth, imageHeight;
          if (hasImage && imagePosition) {
            imageX = imagePosition.x;
            imageY = imagePosition.y;
            imageWidth = imagePosition.width;
            imageHeight = imagePosition.height;
          } else if (hasImage) {
            // Fallback calculation if pre-calculated positions aren't available
            const segmentAngleRad = segmentAngle * Math.PI / 180;
            const startAngleRad = (startAngle - 90) * Math.PI / 180;
            const endAngleRad = (endAngle - 90) * Math.PI / 180;

            const x1 = radius + radius * Math.cos(startAngleRad);
            const y1 = radius + radius * Math.sin(startAngleRad);
            const x2 = radius + radius * Math.cos(endAngleRad);
            const y2 = radius + radius * Math.sin(endAngleRad);

            const centerX = radius;
            const centerY = radius;

            const minX = Math.min(x1, x2, centerX);
            const maxX = Math.max(x1, x2, centerX);
            const minY = Math.min(y1, y2, centerY);
            const maxY = Math.max(y1, y2, centerY);

            imageX = minX;
            imageY = minY;
            imageWidth = maxX - minX;
            imageHeight = maxY - minY;
          }

          return (
            <G key={slice.id}>
              {/* Background slice */}
              <Path d={pathData} fill={slice.color} stroke="#ffffff" strokeWidth="3" />

              {/* Image overlay using PRE-DEFINED patterns for stable animation */}
              {hasImage && pattern && (
                <Path d={pathData} fill={`url(#${pattern.patternId})`} />
              )}

              {/* Text overlay - adjust position when image is present */}
              {/* CRITICAL FIX: Pure white text to match web organizer (no black stroke) */}
              <SvgText
                x={textX}
                y={hasImage ? radius + radius * 0.8 * Math.sin(textAngleRad) : textY}
                fill="#ffffff"
                fontSize={hasImage ? Math.max(fontSize * 0.8, 8) : fontSize} // Smaller text when image present
                fontWeight="bold"
                fontFamily="Arial, sans-serif"
                textAnchor="middle"
                transform={`rotate(${textAngle}, ${textX}, ${hasImage ? radius + radius * 0.8 * Math.sin(textAngleRad) : textY})`}
              >
                {displayText}
              </SvgText>

              {/* Loading indicator for images */}
              {slice.image?.url && imageLoadStates[slice.id] === 'loading' && (
                <SvgText
                  x={radius + radius * 0.6 * Math.cos(textAngleRad)}
                  y={radius + radius * 0.6 * Math.sin(textAngleRad)}
                  fill="#ffffff"
                  fontSize="12"
                  textAnchor="middle"
                  transform={`rotate(${textAngle}, ${radius + radius * 0.6 * Math.cos(textAngleRad)}, ${radius + radius * 0.6 * Math.sin(textAngleRad)})`}
                >
                  ⏳
                </SvgText>
              )}

              {/* Error indicator for failed images */}
              {slice.image?.error && (
                <SvgText
                  x={radius + radius * 0.6 * Math.cos(textAngleRad)}
                  y={radius + radius * 0.6 * Math.sin(textAngleRad)}
                  fill="#ff6b6b"
                  fontSize="12"
                  textAnchor="middle"
                  transform={`rotate(${textAngle}, ${radius + radius * 0.6 * Math.cos(textAngleRad)}, ${radius + radius * 0.6 * Math.sin(textAngleRad)})`}
                >
                  ❌
                </SvgText>
              )}
            </G>
          );
        })}

        {/* Center circle */}
        <Circle cx={radius} cy={radius} r={centerRadius} fill="#ffffff" stroke={COLORS.primary} strokeWidth="4" />
      </G>
    );
  };

  // Render stationary pointer - Fixed positioning for accuracy
  const renderStationaryPointer = () => {
    const radius = wheelSize / 2;
    // Position pointer exactly at 0 degrees (right side) with precise alignment
    const pointerTipX = radius + radius + 40; // Extend further out for better visibility
    const pointerBaseX = radius + radius - 10; // Base closer to wheel edge
    const pointerY = radius;

    return (
      <G>
        {/* Shadow effect */}
        <Path
          d={`M ${pointerBaseX} ${pointerY} L ${pointerTipX} ${pointerY - 30} L ${pointerTipX} ${pointerY + 30} Z`}
          fill="rgba(0, 0, 0, 0.4)"
          opacity="0.5"
        />
        {/* Main pointer */}
        <Path
          d={`M ${pointerBaseX} ${pointerY} L ${pointerTipX} ${pointerY - 30} L ${pointerTipX} ${pointerY + 30} Z`}
          fill="#ffffff"
          stroke={COLORS.primary}
          strokeWidth="6"
        />
        {/* Inner highlight */}
        <Path
          d={`M ${pointerBaseX + 5} ${pointerY} L ${pointerTipX - 15} ${pointerY - 20} L ${pointerTipX - 15} ${pointerY + 20} Z`}
          fill={COLORS.primary}
        />
        {/* Pointer tip indicator */}
        <Circle
          cx={pointerTipX - 5}
          cy={pointerY}
          r="4"
          fill={COLORS.primary}
        />
      </G>
    );
  };

  // 🎯 UNIFIED WINNER CALCULATION - EXACT SAME AS WEB PLATFORM
  const calculateWinner = (totalRotation: number, wheelItems: string[]): { winningIndex: number, winner: string } => {
    // 🎯 USE UNIFIED CALCULATION - EXACT SAME ALGORITHM AS WEB PLATFORM
    return calculateUnifiedWinner(totalRotation, wheelItems);
  }

  // 🔄 REMOTE SPIN FUNCTION - NO BROADCASTING TO PREVENT INFINITE LOOPS
  const startRemoteSpin = async (targetWinner?: string) => {
    console.log('🚀 STARTING REMOTE SPIN:', { targetWinner, wheelSlices: wheelSlices.length });

    const currentTime = Date.now();

    // Call onSpinStart callback to notify parent component
    if (onSpinStart) {
      console.log('🎡 Remote spin: Calling onSpinStart callback');
      onSpinStart();
    }

    // For remote spins, create consistent but random-looking parameters
    const spinDuration = Math.random() * 2000 + 3000; // 3-5 seconds (same as startSpin)

    // Calculate total rotation to land on the target winner, or random if none specified
    let totalRotation;
    let winner;

    if (targetWinner && wheelSlices.length > 0) {
      // Find the index of the target winner
      const winnerIndex = wheelSlices.findIndex(slice => slice.text === targetWinner);
      if (winnerIndex >= 0) {
        // 🎯 FIXED: Calculate rotation to land pointer exactly on this segment
        // Pointer is at 90° (3 o'clock), so we want the segment center to align with 90°
        const segmentAngle = (2 * Math.PI) / wheelSlices.length;
        const pointerAngle = Math.PI / 2; // 90° = π/2 radians (3 o'clock position)

        // Calculate the target angle for the segment center
        const segmentCenterAngle = winnerIndex * segmentAngle + segmentAngle / 2;

        // We want: segmentCenterAngle = (pointerAngle - finalRotation) % (2*PI)
        // So: finalRotation = (pointerAngle - segmentCenterAngle) % (2*PI)
        const targetRotation = (pointerAngle - segmentCenterAngle) % (2 * Math.PI);

        // Normalize to positive rotation and add multiple full rotations for spin effect
        totalRotation = (targetRotation + 2 * Math.PI) % (2 * Math.PI) + Math.random() * 4 * 2 * Math.PI + 6 * 2 * Math.PI;

        console.log('🎯 REMOTE SPIN: Targeting specific winner (FIXED):', {
          targetWinner,
          winnerIndex,
          segmentCenterAngle: segmentCenterAngle.toFixed(3),
          pointerAngle: pointerAngle.toFixed(3),
          targetRotation: targetRotation.toFixed(3),
          totalRotation: totalRotation.toFixed(3),
          spinDuration: spinDuration.toFixed(2)
        });
      } else {
        console.warn('⚠️ REMOTE SPIN: Target winner not found in wheel slices');
        totalRotation = Math.random() * 4 * 2 * Math.PI + 6 * 2 * Math.PI;
      }
    } else {
      // Random spin if no target winner specified
      totalRotation = Math.random() * 4 * 2 * Math.PI + 6 * 2 * Math.PI;
      console.log('🎲 REMOTE SPIN: Random winner (no target specified)');
    }

    // Pre-calculate the winner for logging
    const { winner: preCalculatedWinner } = calculateWinner(totalRotation, wheelSlices.map(s => s.text));
    winner = preCalculatedWinner;

    console.log('🎯 REMOTE SPIN: Pre-calculated winner:', winner);

    // Set state and timing
    setLastSpinTimestamp(currentTime);
    spinStartTime.current = currentTime;

    let currentRotation = 0;
    const startTime = performance.now(); // Use high-precision timing
    let lastFrameTime = startTime - 16; // Ensure first frame runs immediately

    // NO FIREBASE BROADCAST FOR REMOTE SPINS - This prevents infinite loops

    const animate = (currentTime: number) => {
      // Calculate delta time for consistent frame rate
      const deltaTime = currentTime - lastFrameTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);

      // ULTRA-SMOOTH EASING: Premium wheel feel (same as participant view)
      // Fast acceleration, smooth constant speed, gentle deceleration
      const easedProgress = progress < 0.25
        ? Math.pow(progress / 0.25, 2.2) * 0.25  // Rapid acceleration start
        : progress < 0.75
        ? 0.25 + (progress - 0.25) / 0.5 * 0.5   // Smooth constant speed
        : 0.75 + Math.pow((progress - 0.75) / 0.25, 0.4) * 0.25; // Gentle deceleration

      // Calculate precise rotation with sub-pixel accuracy
      currentRotation = totalRotation * easedProgress;
      setWheelRotation(currentRotation);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
        lastFrameTime = currentTime;
      } else {
        // Spin completed - set final position and stop spinning
        setWheelRotation(totalRotation);
        setIsSpinning(false);
        setIsSpinCompleting(true);
        spinCompletionRef.current = true;

        // Clear animation reference to prevent conflicts
        animationRef.current = null;

        // Calculate final winner after visual has settled
        const { winner: finalWinner } = calculateWinner(totalRotation, wheelSlices.map(s => s.text));

        // For remote spins, we still send winner results but with lower priority
        // to avoid overriding the primary organizer's winner announcement
        setTimeout(async () => {
          // Only proceed if this completion hasn't been cancelled
          if (spinCompletionRef.current) {
            const currentTime = Date.now();
            const MIN_WINNER_INTERVAL = 1000; // Minimum 1 second between same winner announcements

            // Prevent redundant winner announcements for the same winner
            if (finalWinner === lastWinnerAnnounced &&
                currentTime - lastWinnerTimestamp < MIN_WINNER_INTERVAL) {
              setIsSpinCompleting(false);
              spinCompletionRef.current = false;
              return;
            }

            // Update last winner tracking
            setLastWinnerAnnounced(finalWinner);
            setLastWinnerTimestamp(currentTime);

            // Call completion callback with final winner
            if (onSpinComplete) {
              onSpinComplete({
                winners: [finalWinner],
                winner: finalWinner,
                spinDuration: spinDuration,
                totalRotation: totalRotation,
                originalWinner: winner,
                remoteSpin: true // Flag to indicate this is from a remote spin
              });
            }

            // Mark completion as finished
            setIsSpinCompleting(false);
            spinCompletionRef.current = false;
          }
        }, 500); // Increased delay for better stability
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  // Start spin animation - SIMPLE AND RELIABLE with enhanced guards
  const startSpin = async () => {
    const currentTime = Date.now();
    const MIN_SPIN_INTERVAL = 3000; // Minimum 3 seconds between spins

    // Enhanced guards to prevent race conditions and spam
    if (isSpinning || wheelSlices.length === 0 || animationRef.current !== null) {
      console.log('⚠️ Spin already in progress or wheel not ready');
      return;
    }

    // Prevent rapid successive spins
    if (currentTime - lastSpinTimestamp < MIN_SPIN_INTERVAL) {
      const remainingTime = MIN_SPIN_INTERVAL - (currentTime - lastSpinTimestamp);
      console.log(`⚠️ Spin rate limited - ${remainingTime}ms remaining`);
      return;
    }

    // Prevent spin completion conflicts
    if (isSpinCompleting || spinCompletionRef.current) {
      console.log('⚠️ Spin completion in progress - ignoring new spin request');
      return;
    }

    // Call onSpinStart callback to notify parent component
    if (onSpinStart) {
      console.log('🎡 Calling onSpinStart callback');
      onSpinStart();
    }

    // 🎯 PRE-CALCULATE SPIN PARAMETERS FOR PERFECT SYNC (FIXED ORDER)
    const spinDuration = Math.random() * 2000 + 3000; // 3-5 seconds
    const totalRotation = Math.random() * 4 * 2 * Math.PI + 6 * 2 * Math.PI; // 6-10 full rotations
    const { winner, winningIndex } = calculateWinner(totalRotation, wheelSlices.map(s => s.text));

    console.log('🎯 PRE-CALCULATED WINNER BEFORE BROADCAST:', {
      winner: winner,
      winningIndex: winningIndex,
      spinDuration: spinDuration.toFixed(2) + 's',
      totalRotation: totalRotation.toFixed(6)
    });

    // 🚨 INSTANT Firebase broadcast with PERFECT TIMING synchronization (CRITICAL FIX)
    // Filter out any undefined or null values to prevent Firestore errors
    const wheelImageUrls = wheelSlices
      .map(slice => slice.image?.url)
      .filter((url): url is string => typeof url === 'string' && url.length > 0);

    const preciseBroadcastData = {
      isSpinning: true,
      currentState: 'spinning',
      // 🎯 CRITICAL: Include wheel images for participant synchronization (only if not empty)
      ...(wheelImageUrls.length > 0 && { wheelImages: wheelImageUrls }),
      imageWheelSlices: wheelSlices.map(slice => ({
        id: slice.id,
        text: slice.text,
        color: slice.color,
        ...(slice.image && slice.image.url && {
          image: {
            url: slice.image.url,
            isLoaded: slice.image.isLoaded || false,
            error: slice.image.error || false
          }
        })
      })),
      // 🎯 ULTRA-PRECISION: Send complete spin parameters immediately with CORRECT sync flags
      wheelState: {
        isSpinning: true,
        participantSync: 'immediate', // ✅ CORRECT FLAG: SessionManager expects this
        instantStart: true, // ✅ ADDITIONAL SYNC FLAG for instant response
        zeroDelay: true, // ✅ ADDITIONAL SYNC FLAG for zero delay
        broadcastTime: currentTime, // Server timestamp for exact sync
        spinDuration: spinDuration,
        totalRotation: totalRotation,
        segmentAngle: (360 / wheelSlices.length) * Math.PI / 180, // Radians for precision
        segmentAngleDegrees: 360 / wheelSlices.length,
        winner: winner, // Pre-calculated for perfect sync
        winningIndex: winningIndex,
        synchronizationMode: 'ultra-precision',
        // 🔄 CRITICAL FIX: Keep broadcastSource as-is for web to detect properly
        broadcastSource: broadcastSource || 'organizer', // Ensure it's never undefined
        // 🔄 ADDITIONAL FIELDS for web sync
        spinStartTime: currentTime, // For timestamp comparison
        spinId: `spin-${sessionId}-${currentTime}`, // 🔄 CRITICAL: Add unique spin ID for deduplication
        wheelItemsUsed: wheelSlices.map(s => s.text), // Include wheel items for web sync
        wheelItems: wheelSlices.map(s => s.text), // CRITICAL: Also include as wheelItems for web collaborator sync
        finalAngle: totalRotation % (2 * Math.PI), // Final angle for precise landing
        spins: Math.floor(totalRotation / (2 * Math.PI)), // Number of full rotations
        // 🖼️ CRITICAL: Include image data in wheelState for compatibility (only if not empty)
        // Only set imagePickerMode to true if the wheel TYPE is actually image-picker
        imagePickerMode: (wheelType?.value === 'image-picker' || wheelType?.id === 'image-picker-wheel') && wheelSlices.some(slice => slice.image?.url),
        ...(wheelImageUrls.length > 0 && { wheelImages: wheelImageUrls }),
        // 🎨 ENHANCED: Include theme information for synchronization (WEB-COMPATIBLE FORMAT)
        ...(currentSelectedTheme && {
          theme: {
            primary: getSliceColor(0),
            secondary: getSliceColor(1),
            accent: "#ffffff", // White text for web compatibility
            background: "#f8f9fa", // Light background for web compatibility
            name: currentSelectedTheme
          },
          animationTheme: {
            primary: getSliceColor(0),
            secondary: getSliceColor(1),
            accent: "#ffffff", // White text for web compatibility
            background: "#f8f9fa", // Light background for web compatibility
            name: currentSelectedTheme
          }
        })
      },
      updatedAt: serverTimestamp()
    };

    // 🖼️ Calculate image state for debugging and broadcasting
    const sliceImages = wheelSlices.filter(slice => slice.image?.url && slice.image.url.trim()).length;
    const isImagePickerWheel = wheelType?.value === 'image-picker' || wheelType?.id === 'image-picker-wheel';
    const hasAnyImageData = wheelImages && Object.keys(wheelImages).length > 0;
    
    // 🖼️ DEBUG: Log image state for debugging (only in development)
    if (__DEV__) {
      // Only log if it's an image picker wheel or if there are actually images
      if (isImagePickerWheel || sliceImages > 0) {
        console.log('🖼️ Image state during spin:', {
          wheelType: wheelType?.value || wheelType?.name,
          isImagePickerWheel,
          sliceImages,
          hasAnyImageData,
          wheelImagesKeys: hasAnyImageData ? Object.keys(wheelImages).length : 0
        });
        
        // Only warn if it's truly an image picker wheel with expected images that are missing
        if (isImagePickerWheel && sliceImages === 0 && hasAnyImageData) {
          console.warn('⚠️ IMAGE PICKER WHEEL: Images not loaded properly during spin!');
          console.warn('🔍 Expected images but slices have none loaded. Images may not display.');
        } else if (isImagePickerWheel && sliceImages > 0) {
          console.log(`✅ Image picker wheel has ${sliceImages} images loaded and ready`);
        }
      }
    }

    console.log('🚀 BROADCASTING PERFECT SYNC DATA WITH IMAGES:', {
      spinDuration: spinDuration.toFixed(2) + 's',
      totalRotation: totalRotation.toFixed(6),
      winner: winner,
      winningIndex: winningIndex,
      broadcastTime: currentTime,
      broadcastSource: broadcastSource, // Log the broadcast source
      wheelItemsCount: wheelSlices.length,
      hasImages: wheelSlices.some(slice => slice.image?.url),
      imageCount: wheelSlices.filter(slice => slice.image?.url).length,
      imageUrls: wheelSlices.map(slice => slice.image?.url).filter(url => url),
      sliceImages: sliceImages,
      isImagePickerWheel: isImagePickerWheel,
      sessionId: sessionId, // Verify sessionId
      hasSessionId: !!sessionId
    });

    // 🚨 CRITICAL CHECK: Verify sessionId exists before broadcasting
    if (!sessionId) {
      console.error('❌ CRITICAL: No sessionId - cannot broadcast spin!');
      Alert.alert('Error', 'Session ID is missing. Cannot sync spin with other users.');
      return;
    }

    console.log('✅ SessionId verified, broadcasting to Firebase...');

    // 🚨 NON-BLOCKING Firebase update - don't wait for it to complete
    updateDoc(doc(db, 'liveDrawSessions', sessionId), preciseBroadcastData)
      .then(() => {
        console.log('✅ Firebase broadcast SUCCESS!', {
          sessionId,
          broadcastSource,
          isSpinning: true
        });
      })
      .catch(error => {
        console.error('❌ Firebase broadcast FAILED:', error);
        console.error('❌ Error details:', {
          errorCode: error.code,
          errorMessage: error.message,
          sessionId
        });
      });

    setIsSpinning(true);
    setLastSpinTimestamp(currentTime);
    spinStartTime.current = currentTime;

    let currentRotation = 0;
    const startTime = performance.now(); // Use high-precision timing for smoothness
    let lastFrameTime = startTime - 16; // Ensure first frame runs immediately

    const animate = (currentTime: number) => {
      // Calculate delta time for consistent frame rate
      const deltaTime = currentTime - lastFrameTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);

      // ULTRA-SMOOTH EASING: Premium wheel feel (same as participant view)
      // Fast acceleration, smooth constant speed, gentle deceleration
      const easedProgress = progress < 0.25
        ? Math.pow(progress / 0.25, 2.2) * 0.25  // Rapid acceleration start
        : progress < 0.75
        ? 0.25 + (progress - 0.25) / 0.5 * 0.5   // Smooth constant speed
        : 0.75 + Math.pow((progress - 0.75) / 0.25, 0.4) * 0.25; // Gentle deceleration

      // Calculate precise rotation with sub-pixel accuracy
      currentRotation = totalRotation * easedProgress;
      setWheelRotation(currentRotation);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
        lastFrameTime = currentTime;
      } else {
        // Spin completed - set final position and stop spinning
        setWheelRotation(totalRotation);
        setIsSpinning(false);
        setIsSpinCompleting(true);
        spinCompletionRef.current = true;

        // Clear animation reference to prevent conflicts
        animationRef.current = null;

        // Calculate winner immediately but wait for visual to settle
        const { winner } = calculateWinner(totalRotation, wheelSlices.map(s => s.text));

        // Guard against duplicate winner announcements
        const winnerObject = {
          id: `winner-${Date.now()}`,
          name: winner
        };

        // Only update Firebase if this is the first completion for this spin
        updateDoc(doc(db, 'liveDrawSessions', sessionId), {
          isSpinning: false,
          currentState: 'completed',
          winners: [winnerObject],
          resultNotification: {
            message: customMessage || `🎉 Congratulations ${winner}! You're our ${customWinnerWord}! 🎊`,
            winners: [winnerObject],
            timestamp: serverTimestamp(),
            isActive: true,
            showConfetti: true,
            priority: 'immediate'
          },
          wheelState: {
            isSpinning: false,
            totalRotation: totalRotation,
            finalAngle: totalRotation % (2 * Math.PI),
            winners: [winnerObject],
            completedAt: serverTimestamp()
          },
          updatedAt: serverTimestamp()
        }).catch(error => {
          console.error('❌ Error updating winner:', error);
          setIsSpinCompleting(false);
          spinCompletionRef.current = false;
        });

        // Wait for visual to settle before calling completion callback
        setTimeout(async () => {
          // Double-check winner calculation after visual has settled
          const { winner: finalWinner } = calculateWinner(totalRotation, wheelSlices.map(s => s.text));

          // Only proceed if this completion hasn't been cancelled
          if (spinCompletionRef.current) {
            const currentTime = Date.now();
            const MIN_WINNER_INTERVAL = 1000; // Minimum 1 second between same winner announcements

            // Prevent redundant winner announcements for the same winner
            if (finalWinner === lastWinnerAnnounced &&
                currentTime - lastWinnerTimestamp < MIN_WINNER_INTERVAL) {
              setIsSpinCompleting(false);
              spinCompletionRef.current = false;
              return;
            }

            // Update last winner tracking
            setLastWinnerAnnounced(finalWinner);
            setLastWinnerTimestamp(currentTime);

            // Call completion callback with final winner
            if (onSpinComplete) {
              onSpinComplete({
                winners: [finalWinner],
                winner: finalWinner,
                spinDuration: spinDuration,
                totalRotation: totalRotation,
                originalWinner: winner
              });
            }

            // Mark completion as finished
            setIsSpinCompleting(false);
            spinCompletionRef.current = false;
          }
        }, 500); // Increased delay for better stability
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  // Handle manual winner selection
  const handleManualWinnerSelection = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('No Selection', 'Please select at least one winner');
      return;
    }

    const winnerObjects = selectedItems.map((item, index) => ({
      id: `manual-winner-${Date.now()}-${index}`,
      name: item
    }));

    try {
      await updateDoc(doc(db, 'liveDrawSessions', sessionId), {
        winners: winnerObjects,
        currentState: 'completed',
        isSpinning: false,
        manuallySelected: true,
        resultNotification: {
          message: winnerObjects.length === 1
            ? (customMessage || `🎉 ${winnerObjects[0].name}! You're our ${customWinnerWord}! 🎊`)
            : `🎉 ${customWinnerWord ? `${customWinnerWord}s` : 'Winners'}: ${winnerObjects.map(w => w.name).join(', ')}!`,
          winners: winnerObjects,
          timestamp: serverTimestamp(),
          isActive: true,
          showConfetti: true,
          priority: 'immediate',
          isManualSelection: true
        },
        updatedAt: serverTimestamp()
      });

      if (onSpinComplete) {
        onSpinComplete({
          winners: selectedItems,
          winner: selectedItems[0],
          manual: true
        });
      }

      setSelectedItems([]);
      setIsManualMode(false);
    } catch (error) {
      console.error('Error with manual selection:', error);
      Alert.alert('Error', 'Failed to announce winners');
    }
  };

  const toggleManualMode = () => {
    setIsManualMode(!isManualMode);
    if (!isManualMode) {
      setSelectedItems([]);
    }
  };

  // Test function to verify winner calculation (can be called from console)
  const testWinnerCalculation = () => {
    console.log('🧪 Testing winner calculation...');
    for (let testRotation = 0; testRotation < 2 * Math.PI; testRotation += Math.PI / 8) {
      const oldRotation = wheelRotation;
      setWheelRotation(testRotation);
      const { winner } = calculateWinner(testRotation, wheelSlices.map(s => s.text));
      console.log(`Rotation: ${(testRotation * 180 / Math.PI).toFixed(1)}°, Winner: ${winner}`);
      setWheelRotation(oldRotation);
    }
  };

  // Make test function available globally for debugging
  if (typeof global !== 'undefined') {
    (global as any).testWheelWinner = testWinnerCalculation;
  }

  // 🔄 CRITICAL: Remote spin synchronization effects - ATOMIC AND SAFE
  // Force spin trigger - when a remote spin is detected by parent component
  useEffect(() => {
    // 🚨 ATOMIC CHECK: Only process if we have a valid trigger and are not already processing
    if (forceSpinTrigger && forceSpinTrigger > 0 && !isSpinning && !isSpinCompleting && !spinCompletionRef.current) {
      console.log('🚀 FORCED SPIN TRIGGER RECEIVED (REMOTE):', forceSpinTrigger, forceSpinWinner, {
        isSpinning,
        isSpinCompleting,
        broadcastSource
      });

      // 🚨 IMMEDIATE STATE LOCK: Prevent any other triggers while processing
      setIsSpinning(true);
      setIsSpinCompleting(false);
      spinCompletionRef.current = false;

      // Use a remote spin function that doesn't broadcast (to avoid infinite loops)
      console.log('🎯 STARTING REMOTE SPIN (no broadcast to prevent loops)');

      // 🚨 ASYNC PROCESSING: Handle the spin without blocking the effect
      setTimeout(() => {
        startRemoteSpin(forceSpinWinner).then(() => {
          // ✅ SUCCESS: Reset trigger after successful completion
          console.log('✅ Remote spin completed successfully, resetting trigger');
          if (onForceSpinTriggerProcessed) {
            onForceSpinTriggerProcessed();
          }
        }).catch(error => {
          console.error('❌ Remote spin failed:', error);
          // Reset state on failure
          setIsSpinning(false);
          setIsSpinCompleting(false);
          spinCompletionRef.current = false;
          // Still reset trigger on failure to prevent stuck state
          if (onForceSpinTriggerProcessed) {
            onForceSpinTriggerProcessed();
          }
        });
      }, 10); // Small delay to ensure state has settled
    }
  }, [forceSpinTrigger]); // 🚨 MINIMAL DEPENDENCIES: Only depend on forceSpinTrigger to prevent re-runs

  // 🚨 SAFETY NET: Ensure trigger gets reset even if component unmounts during processing
  useEffect(() => {
    return () => {
      // If we're unmounting and have an active trigger, reset it
      if (forceSpinTrigger && forceSpinTrigger > 0 && onForceSpinTriggerProcessed) {
        console.log('🧹 Component unmounting with active trigger, resetting...');
        onForceSpinTriggerProcessed();
      }
    };
  }, [forceSpinTrigger, onForceSpinTriggerProcessed]);

  // Remote spinning state sync - sync local spinning state with remote
  useEffect(() => {
    if (isSpinningRemote !== undefined) {
      console.log('🔄 REMOTE SPINNING STATE SYNC:', isSpinningRemote, 'current:', isSpinning);
      setIsSpinning(isSpinningRemote);
    }
  }, [isSpinningRemote]);

  return (
    <View style={styles.container}>
      {/* Wheel Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.wheelTitle}>
          {customTitle || wheelType?.label || wheelType?.name || 'Live Wheel'}
        </Text>
        <Text style={styles.wheelSubtitle}>
          {`${wheelSlices.length} items • ${currentSelectedTheme} theme`}
        </Text>
      </View>

      {/* Wheel Container */}
      <View style={styles.wheelContainer}>
        <Svg width={wheelSize} height={wheelSize} viewBox={`0 0 ${wheelSize} ${wheelSize}`} style={styles.wheel}>
          {/* Rotating wheel segments */}
          <G transform={`rotate(${wheelRotation * 180 / Math.PI}, ${wheelSize/2}, ${wheelSize/2})`}>
            {renderWheelSegments()}
          </G>
          {/* Stationary pointer */}
          {renderStationaryPointer()}
        </Svg>

        {/* No overlay during spinning - clean spinning experience */}
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        {!allowManualWinnerSelection ? (
          <TouchableOpacity
            style={[styles.spinButton, isSpinning && styles.spinButtonDisabled]}
            onPress={startSpin}
            disabled={isSpinning}
          >
            <Ionicons name="refresh-circle" size={24} color="#ffffff" />
            <Text style={styles.spinButtonText}>
              {isSpinning ? 'SPINNING...' : 'SPIN WHEEL'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.manualControls}>
            <TouchableOpacity
              style={[styles.manualButton, isManualMode && styles.manualButtonActive]}
              onPress={toggleManualMode}
            >
              <Ionicons name="hand-left" size={20} color="#ffffff" />
              <Text style={styles.manualButtonText}>
                {isManualMode ? 'Cancel Manual' : 'Manual Select'}
              </Text>
            </TouchableOpacity>

            {!isManualMode ? (
              <TouchableOpacity
                style={[styles.spinButton, isSpinning && styles.spinButtonDisabled]}
                onPress={startSpin}
                disabled={isSpinning}
              >
                <Ionicons name="refresh-circle" size={24} color="#ffffff" />
                <Text style={styles.spinButtonText}>SPIN WHEEL</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.selectButton, selectedItems.length === 0 && styles.selectButtonDisabled]}
                onPress={handleManualWinnerSelection}
                disabled={selectedItems.length === 0}
              >
                <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
                <Text style={styles.selectButtonText}>
                  Set Winners ({selectedItems.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Manual Selection Interface */}
      {isManualMode && allowManualWinnerSelection && (
        <View style={styles.manualSelection}>
          <Text style={styles.manualTitle}>Select Winners Manually:</Text>
          <View style={styles.selectionGrid}>
            {wheelSlices.map((slice) => (
              <TouchableOpacity
                key={slice.id}
                style={[
                  styles.selectionItem,
                  selectedItems.includes(slice.text) && styles.selectionItemSelected
                ]}
                onPress={() => {
                  if (selectedItems.includes(slice.text)) {
                    setSelectedItems(prev => prev.filter(item => item !== slice.text));
                  } else {
                    setSelectedItems(prev => [...prev, slice.text]);
                  }
                }}
              >
                <Text style={[
                  styles.selectionText,
                  selectedItems.includes(slice.text) && styles.selectionTextSelected
                ]}>
                  {slice.text}
                </Text>
                {selectedItems.includes(slice.text) && (
                  <Ionicons name="checkmark" size={16} color={COLORS.success} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: getResponsiveSpacing(16),
    paddingVertical: getResponsiveSpacing(8),
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: getResponsiveSpacing(20),
  },
  wheelTitle: {
    fontSize: getResponsiveFontSize(24),
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: getResponsiveSpacing(4),
  },
  wheelSubtitle: {
    fontSize: getResponsiveFontSize(14),
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  wheelContainer: {
    position: 'relative',
    marginBottom: getResponsiveSpacing(20),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: getResponsiveSpacing(200), // Ensure minimum height for small wheels
  },
  wheel: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  controlsContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: getResponsiveSpacing(16),
  },
  spinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: getResponsiveSpacing(15),
    paddingHorizontal: getResponsiveSpacing(30),
    borderRadius: getResponsiveSpacing(25),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    gap: getResponsiveSpacing(8),
    minHeight: getResponsiveSpacing(48), // Ensure touch target size
    minWidth: getResponsiveSpacing(120), // Ensure minimum button width
  },
  spinButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.6,
  },
  spinButtonText: {
    color: '#ffffff',
    fontSize: getResponsiveFontSize(16),
    fontWeight: 'bold',
  },
  manualControls: {
    flexDirection: 'row',
    gap: getResponsiveSpacing(12),
    width: '100%',
    justifyContent: 'center',
    flexWrap: 'wrap', // Allow wrapping on small screens
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning,
    paddingVertical: getResponsiveSpacing(12),
    paddingHorizontal: getResponsiveSpacing(20),
    borderRadius: getResponsiveSpacing(20),
    gap: getResponsiveSpacing(6),
    minHeight: getResponsiveSpacing(44), // Ensure touch target size
    minWidth: getResponsiveSpacing(100), // Ensure minimum button width
  },
  manualButtonActive: {
    backgroundColor: COLORS.error,
  },
  manualButtonText: {
    color: '#ffffff',
    fontSize: getResponsiveFontSize(14),
    fontWeight: 'bold',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: getResponsiveSpacing(12),
    paddingHorizontal: getResponsiveSpacing(20),
    borderRadius: getResponsiveSpacing(20),
    gap: getResponsiveSpacing(6),
    minHeight: getResponsiveSpacing(44), // Ensure touch target size
    minWidth: getResponsiveSpacing(100), // Ensure minimum button width
  },
  selectButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.6,
  },
  selectButtonText: {
    color: '#ffffff',
    fontSize: getResponsiveFontSize(14),
    fontWeight: 'bold',
  },
  manualSelection: {
    width: '100%',
    marginTop: getResponsiveSpacing(20),
    padding: getResponsiveSpacing(16),
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: getResponsiveSpacing(12),
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  manualTitle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: getResponsiveSpacing(12),
    textAlign: 'center',
  },
  selectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: getResponsiveSpacing(8),
    justifyContent: 'center',
  },
  selectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: getResponsiveSpacing(8),
    paddingHorizontal: getResponsiveSpacing(12),
    backgroundColor: COLORS.surface,
    borderRadius: getResponsiveSpacing(8),
    borderWidth: 2,
    borderColor: COLORS.border,
    gap: getResponsiveSpacing(8),
    minHeight: getResponsiveSpacing(40), // Ensure touch target size
    maxWidth: getResponsiveSpacing(150), // Limit width for better layout
  },
  selectionItemSelected: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success + '10',
  },
  selectionText: {
    fontSize: getResponsiveFontSize(14),
    color: COLORS.text,
    fontWeight: '500',
    flex: 1, // Allow text to shrink if needed
    textAlign: 'center',
  },
  selectionTextSelected: {
    color: COLORS.success,
    fontWeight: 'bold',
  },
  previewContainer: {
    marginTop: getResponsiveSpacing(16),
    padding: getResponsiveSpacing(12),
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: getResponsiveSpacing(8),
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  previewText: {
    fontSize: getResponsiveFontSize(14),
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  previewWinner: {
    fontWeight: 'bold',
    color: COLORS.primary,
  },
});

export default OrganizerWheel;
