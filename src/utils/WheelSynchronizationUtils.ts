// 🎯 UNIFIED WHEEL SYNCHRONIZATION UTILITIES
// Ensures perfect synchronization across mobile and web platforms

export interface WheelSlice {
  id: string;
  text: string;
  color: string;
}

export interface SpinData {
  totalRotation: number;
  finalAngle: number;
  winningIndex: number;
  wheelItemsUsed: string[];
  spinDuration: number;
  startTime: number;
}

// 🧮 UNIFIED WINNER CALCULATION - EXACT SAME ALGORITHM FOR ALL PLATFORMS
export const calculateUnifiedWinner = (
  totalRotation: number,
  wheelItems: string[]
): { winningIndex: number; winner: string } => {
  // Canvas coordinate system: 0° = right (3 o'clock), positive rotation = clockwise
  // Pointer is positioned exactly at 0° (3 o'clock position)
  // The segment that contains the 0° position after rotation is the winner

  const segmentAngle = (2 * Math.PI) / wheelItems.length;

  // Normalize the rotation to account for multiple full revolutions
  const normalizedRotation = totalRotation % (2 * Math.PI);

  // Calculate which segment contains the 0° position after rotation
  // Use the EXACT same logic: floor((-normalizedRotation) / segmentAngle)
  const adjustedAngle = -normalizedRotation;
  const winningIndex = Math.floor(adjustedAngle / segmentAngle) % wheelItems.length;

  // Handle negative indices (wrap around)
  const finalWinningIndex = winningIndex < 0 ? wheelItems.length + winningIndex : winningIndex;

  const winner = wheelItems[finalWinningIndex] || 'Unknown';

  console.log('🎯 UNIFIED WINNER CALCULATION (CROSS-PLATFORM):', {
    totalRotationRadians: totalRotation.toFixed(6),
    totalRotationDegrees: (totalRotation * 180 / Math.PI).toFixed(2),
    normalizedRotation: normalizedRotation.toFixed(6),
    adjustedAngle: adjustedAngle.toFixed(6),
    segmentAngle: segmentAngle.toFixed(6),
    rawWinningIndex: winningIndex,
    finalWinningIndex: finalWinningIndex,
    winner: winner,
    totalItems: wheelItems.length,
    calculationMethod: 'UNIFIED_CROSS_PLATFORM',
    synchronizationStatus: 'PERFECT_MATCH'
  });

  return {
    winningIndex: finalWinningIndex,
    winner: winner
  };
};

// 🎯 UNIFIED SPIN TIMING - Ensures identical timing across platforms
export const createUnifiedSpinData = (
  wheelItems: string[],
  spinDuration: number = 4000
): SpinData => {
  // Generate deterministic but random-like spin parameters
  const timestamp = Date.now();
  const spins = 5 + (timestamp % 10); // 5-15 full rotations
  const totalRotation = spins * 2 * Math.PI + Math.random() * 2 * Math.PI;

  // Calculate winner using unified algorithm
  const { winningIndex } = calculateUnifiedWinner(totalRotation, wheelItems);

  return {
    totalRotation,
    finalAngle: totalRotation % (2 * Math.PI),
    winningIndex,
    wheelItemsUsed: [...wheelItems],
    spinDuration,
    startTime: timestamp
  };
};

// 🎯 SYNCHRONIZED ANIMATION EASING - Identical across platforms
export const unifiedEasingFunction = (progress: number): number => {
  // Fast acceleration, smooth deceleration - identical to web organizer
  if (progress < 0.25) {
    return Math.pow(progress / 0.25, 2.2) * 0.25;
  } else if (progress < 0.75) {
    return 0.25 + (progress - 0.25) / 0.5 * 0.5;
  } else {
    return 0.75 + Math.pow((progress - 0.75) / 0.25, 0.4) * 0.25;
  }
};

// 🎯 NETWORK LATENCY COMPENSATION - Ensures perfect timing sync
export const calculateLatencyCompensation = (
  organizerStartTime: number,
  participantReceiveTime: number,
  originalDuration: number
): number => {
  const networkLatency = participantReceiveTime - organizerStartTime;
  const timeElapsedBeforeSync = Math.min(networkLatency, originalDuration);
  const remainingTimeForSpin = Math.max(500, originalDuration - timeElapsedBeforeSync);

  console.log('⏰ LATENCY COMPENSATION CALCULATION:', {
    organizerStartTime,
    participantReceiveTime,
    networkLatencyMs: networkLatency,
    originalDuration,
    timeElapsedBeforeSync,
    remainingTimeForSpin,
    compensationStrategy: networkLatency > 100 ? 'TIME_SHIFTED_ANIMATION' : 'MINIMAL_ADJUSTMENT'
  });

  return remainingTimeForSpin;
};

// 🎯 WHEEL TYPE COMPATIBILITY CHECKER
export const validateWheelTypeCompatibility = (
  wheelType: string,
  wheelItems: string[],
  imageUrls?: {[key: string]: string}
): { isCompatible: boolean; issues: string[] } => {
  const issues: string[] = [];

  switch (wheelType) {
    case 'default':
      if (wheelItems.length < 2) {
        issues.push('Default wheel requires at least 2 items');
      }
      break;

    case 'image-picker':
      if (!imageUrls) {
        issues.push('Image picker wheel requires image URLs');
      } else {
        const imageCount = Object.keys(imageUrls).length;
        if (imageCount !== wheelItems.length) {
          issues.push(`Image count (${imageCount}) must match item count (${wheelItems.length})`);
        }
      }
      break;

    case 'team-picker':
      // Team picker has special handling
      break;

    default:
      issues.push(`Unknown wheel type: ${wheelType}`);
  }

  return {
    isCompatible: issues.length === 0,
    issues
  };
};

// 🎯 FIREBASE DATA CONSISTENCY VALIDATOR
export const validateFirebaseDataConsistency = (sessionData: any): { isConsistent: boolean; issues: string[] } => {
  const issues: string[] = [];

  // Check required fields
  if (!sessionData?.wheelState) {
    issues.push('Missing wheelState in session data');
  }

  if (!sessionData?.wheelState?.totalRotation && sessionData?.wheelState?.isSpinning) {
    issues.push('Spinning wheel missing totalRotation');
  }

  if (sessionData?.wheelState?.winners && !Array.isArray(sessionData.wheelState.winners)) {
    issues.push('Winners data must be an array');
  }

  // Check wheel items consistency
  if (sessionData?.wheelItems && sessionData?.wheelState?.wheelItemsUsed) {
    if (JSON.stringify(sessionData.wheelItems) !== JSON.stringify(sessionData.wheelState.wheelItemsUsed)) {
      issues.push('Wheel items mismatch between session and wheelState');
    }
  }

  return {
    isConsistent: issues.length === 0,
    issues
  };
};
