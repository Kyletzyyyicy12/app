import { db } from '../config/firebaseConfig';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  setDoc 
} from 'firebase/firestore';
import { Platform } from 'react-native';

export interface UniversalSession {
  id: string;
  roomCode: string;
  wheelId?: string;
  wheelName: string;
  wheelData?: any;
  activityId?: string;
  createdBy: string;
  createdAt: any;
  isActive: boolean;
  isLive: boolean;
  platform: 'web' | 'mobile' | 'both';
  viewerCount: number;
  lastUpdated: any;
  settings: {
    allowComments: boolean;
    allowReactions: boolean;
    isShared: boolean;
    crossPlatformEnabled: boolean;
    numberOfWinners?: number;
    congratsMessage?: string;
  };
  urls: {
    webUrl: string;
    mobileUrl: string;
    qrCodeUrl: string;
    deepLinkUrl: string;
  };
  metadata: {
    version: string;
    compatibility: string[];
    features: string[];
  };
  wheelState?: {
    currentAngle: number;
    isSpinning: boolean;
    winners: any[];
    // Enhanced properties for real-time synchronization
    spinStartTime?: number;
    spinDuration?: number;
    totalRotation?: number;
    finalAngle?: number;
    progress?: number;
    startedAt?: any;
    completedAt?: any;
    hasResults?: boolean;
    // 🚀 Priority synchronization flags
    instantStart?: boolean;
    participantSync?: string;
    zeroDelay?: boolean;
    // Winner calculation consistency
    winningIndex?: number;
    segmentAngle?: number;
    animationTheme?: any;
    broadcastSource?: 'organizer' | 'full-access-collaborator';
    wheelItemsUsed?: string[]; // Exact items used for winner calculation
  };
  comments?: any[];
  reactions?: any[];
  winners?: any[];
  currentState?: "waiting" | "spinning" | "completed";
  
  // Real-time notifications
  spinningNotification?: {
    message: string;
    timestamp: any;
    isActive: boolean;
    // 🚀 Priority field
    priority?: string;
    zeroDelay?: boolean;
  };
  
  resultNotification?: {
    message: string;
    winners: any[];
    timestamp: any;
    isActive: boolean;
    showConfetti: boolean;
    // 🚀 Priority fields
    priority?: string;
    zeroDelay?: boolean;
  };
  // Enhanced theme synchronization for cross-platform consistency
  themeConfig?: {
    organizerTheme: string; // Theme name selected by organizer
    customColors?: {
      primary: string;
      secondary: string;
      background: string;
      surface: string;
      text: string;
      accent: string;
    };
    wheelTheme?: string; // Selected wheel theme (school, vibrant, etc.)
    syncEnabled: boolean; // Whether to sync theme to participants
    lastThemeUpdate?: any; // Timestamp of last theme change
  };
  
  // Enhanced: Wheel configuration
  selectedWheelType?: {
    id: string;
    title: string;
    description: string;
    icon: string;
    category: string;
    defaultItems: string[];
    color: string;
    isCustomizable: boolean;
  };
  wheelItems?: string[]; // Current wheel items
  customItems?: string[]; // Custom items added by organizer
  wheelTitle?: string;
  wheelType?: string;
}

export interface SessionViewer {
  id: string;
  name: string;
  platform: 'web' | 'mobile' | 'app';
  joinedAt: any;
  lastSeen: any;
  isActive: boolean;
  connectionId: string;
  userAgent?: string;
  isGuest?: boolean;
  userId?: string; // Added for deduplication
}

class CrossPlatformSessionManager {
  private static instance: CrossPlatformSessionManager;
  private activeListeners: Map<string, () => void> = new Map();

  static getInstance(): CrossPlatformSessionManager {
    if (!CrossPlatformSessionManager.instance) {
      CrossPlatformSessionManager.instance = new CrossPlatformSessionManager();
    }
    return CrossPlatformSessionManager.instance;
  }

  // Generate universal room code (alphanumeric, 6 characters) - matches web implementation
  generateRoomCode(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const allChars = letters + numbers;

    let result = '';

    // Generate code with guaranteed mix
    for (let i = 0; i < 6; i++) {
      const char = allChars.charAt(Math.floor(Math.random() * allChars.length));
      result += char;
    }

    // Ensure we have at least 2 numbers and 2 letters for better mix
    const numberCount = (result.match(/\d/g) || []).length;
    const letterCount = (result.match(/[A-Z]/g) || []).length;

    if (numberCount < 2 || letterCount < 2) {
      // Regenerate with better distribution
      const positions = [0, 1, 2, 3, 4, 5];
      result = '';

      // Place at least 2 numbers and 2 letters
      const numberPositions: number[] = [];
      const letterPositions: number[] = [];

      // Select positions for numbers
      while (numberPositions.length < 2) {
        const pos = positions.splice(Math.floor(Math.random() * positions.length), 1)[0];
        numberPositions.push(pos);
      }

      // Select positions for letters
      while (letterPositions.length < 2) {
        const pos = positions.splice(Math.floor(Math.random() * positions.length), 1)[0];
        letterPositions.push(pos);
      }

      // Fill remaining positions randomly
      for (let i = 0; i < 6; i++) {
        if (numberPositions.includes(i)) {
          result += numbers.charAt(Math.floor(Math.random() * numbers.length));
        } else if (letterPositions.includes(i)) {
          result += letters.charAt(Math.floor(Math.random() * letters.length));
        } else {
          result += allChars.charAt(Math.floor(Math.random() * allChars.length));
        }
      }
    }

    return result;
  }

  // Create universal session that works on both platforms
  async createUniversalSession(
    wheelData: any,
    createdBy: string,
    platform: 'web' | 'mobile' = 'web',
    activityId?: string
  ): Promise<UniversalSession> {
    // Only organizers/teachers can create sessions
    // This check should be done at the UI level, but we'll add a safeguard here too
    const roomCode = this.generateRoomCode();
    
    // Ensure unique room code
    const existingSession = await this.findSessionByRoomCode(roomCode);
    if (existingSession) {
      return this.createUniversalSession(wheelData, createdBy, platform, activityId);
    }

    const baseUrl = this.getBaseUrl();
    const sessionData: Omit<UniversalSession, 'id'> & { activityId?: string } = {
      roomCode,
      wheelName: wheelData.name || 'Untitled Wheel',
      wheelData,
      createdBy,
      createdAt: serverTimestamp(),
      isActive: true,
      isLive: true,
      platform: 'both', // Always enable both platforms
      viewerCount: 0,
      lastUpdated: serverTimestamp(),
      settings: {
        allowComments: true,
        allowReactions: true,
        isShared: true,
        crossPlatformEnabled: true,
      },
      urls: {
        webUrl: `${baseUrl}/live/session/${roomCode}`,
        mobileUrl: `cobypicks://join?code=${roomCode}`,
        qrCodeUrl: `${baseUrl}/join?code=${roomCode}`,
        deepLinkUrl: `cobypicks://live?code=${roomCode}`,
      },
      metadata: {
        version: '2.0.0',
        compatibility: ['web', 'mobile', 'app'],
        features: ['real-time', 'cross-platform', 'qr-code', 'deep-link'],
      },
      wheelState: { currentAngle: 0, isSpinning: false, winners: [] },
      comments: [],
      reactions: [],
      winners: [],
      currentState: "waiting",
      // Initialize theme configuration for cross-platform sync
      themeConfig: {
        organizerTheme: 'light', // Default theme
        wheelTheme: 'school', // Default wheel theme
        syncEnabled: true, // Enable theme synchronization by default
        lastThemeUpdate: serverTimestamp(),
      },
    };

    // Only add wheelId if it exists and is not undefined
    if (wheelData.id) {
      sessionData.wheelId = wheelData.id;
    }

    if (activityId) {
      sessionData.activityId = activityId;
    }

    // Create session in liveDrawSessions collection
    const docRef = await addDoc(collection(db, 'liveDrawSessions'), sessionData);
    
    // Also update the wheel document if it exists
    if (wheelData.id) {
      try {
        await updateDoc(doc(db, 'wheels', wheelData.id), {
          live: true,
          liveJoinCode: roomCode,
          liveSessionStartedAt: serverTimestamp(),
          crossPlatformSession: docRef.id,
        });
      } catch (error) {
        console.log('Could not update wheel document:', error);
      }
    }

    // Update activity if provided
    if (activityId) {
      try {
        await updateDoc(doc(db, 'drawActivities', activityId), {
          isLive: true,
          liveSessionId: docRef.id,
          roomCode,
          crossPlatformEnabled: true,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.log('Could not update activity:', error);
      }
    }

    return { id: docRef.id, ...sessionData } as UniversalSession;
  }

  // Find session by room code (works for both platforms)
  async findSessionByRoomCode(roomCode: string): Promise<UniversalSession | null> {
    try {
      // Normalize to 6-character alphanumeric code
      const alphanumericCode = String(roomCode).replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
      if (alphanumericCode.length !== 6) return null;

      // Check liveDrawSessions first
      const sessionsQuery = query(
        collection(db, 'liveDrawSessions'),
        where('roomCode', '==', alphanumericCode),
        where('isActive', '==', true)
      );
      
      const sessionsSnapshot = await getDocs(sessionsQuery);
      
      if (!sessionsSnapshot.empty) {
        const doc = sessionsSnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as UniversalSession;
      }

      // Fallback: Check wheels collection
      const wheelsQuery = query(
        collection(db, 'wheels'),
        where('liveJoinCode', '==', alphanumericCode),
        where('live', '==', true)
      );
      
      const wheelsSnapshot = await getDocs(wheelsQuery);
      
      if (!wheelsSnapshot.empty) {
        const wheelDoc = wheelsSnapshot.docs[0];
        const wheelData = wheelDoc.data();
        
        // Create a universal session from wheel data
        return {
          id: wheelDoc.id,
          roomCode: alphanumericCode,
          wheelId: wheelDoc.id,
          wheelName: wheelData.name || 'Untitled Wheel',
          wheelData,
          createdBy: wheelData.userId || 'unknown',
          createdAt: wheelData.liveSessionStartedAt || new Date(),
          isActive: true,
          isLive: true,
          platform: 'both',
          viewerCount: 0,
          lastUpdated: new Date(),
          settings: {
            allowComments: true,
            allowReactions: true,
            isShared: true,
            crossPlatformEnabled: true,
          },
          urls: {
            webUrl: `${this.getBaseUrl()}/live/session/${alphanumericCode}`,
            mobileUrl: `cobypicks://join?code=${alphanumericCode}`,
            qrCodeUrl: `${this.getBaseUrl()}/join?code=${alphanumericCode}`,
            deepLinkUrl: `cobypicks://live?code=${alphanumericCode}`,
          },
          metadata: {
            version: '2.0.0',
            compatibility: ['web', 'mobile', 'app'],
            features: ['real-time', 'cross-platform', 'qr-code', 'deep-link'],
          },
        } as UniversalSession;
      }

      return null;
    } catch (error) {
      console.error('Error finding session by room code:', error);
      return null;
    }
  }

  // Add viewer to session (cross-platform) with duplicate prevention
  async addViewer(
    sessionId: string, 
    viewerName: string, 
    platform: 'web' | 'mobile' | 'app',
    userId?: string
  ): Promise<string> {
    // Check for existing viewer with same userId or name to prevent duplicates
    if (userId) {
      try {
        const existingViewersQuery = query(
          collection(db, 'liveDrawSessions', sessionId, 'viewers'),
          where('userId', '==', userId),
          where('isActive', '==', true)
        );
        const existingSnapshot = await getDocs(existingViewersQuery);
        
        if (!existingSnapshot.empty) {
          // Update existing viewer's lastSeen instead of creating duplicate
          const existingViewerDoc = existingSnapshot.docs[0];
          await updateDoc(existingViewerDoc.ref, {
            lastSeen: serverTimestamp(),
            isActive: true,
            platform: platform || 'web'
          });
          console.log('Updated existing viewer instead of creating duplicate');
          return existingViewerDoc.id;
        }
      } catch (error) {
        console.log('Could not check for existing viewers, proceeding with new viewer creation');
      }
    }
    
    const viewerId = `viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get userAgent safely
    let userAgent = 'Unknown';
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      userAgent = navigator.userAgent;
    } else if (Platform.OS !== 'web') {
      userAgent = 'React Native App';
    }
    
    const viewerData: SessionViewer & { userId?: string } = {
      id: viewerId,
      name: viewerName || 'Anonymous',
      platform: platform || 'web',
      joinedAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      isActive: true,
      connectionId: viewerId,
      userAgent: userAgent || 'Unknown',
      userId: userId, // Add userId for deduplication
    };

    try {
      await setDoc(
        doc(db, 'liveDrawSessions', sessionId, 'viewers', viewerId),
        viewerData
      );

      // Enhanced: Broadcast participant join event for real-time notifications
      await this.broadcastParticipantJoin(sessionId, viewerName || 'Anonymous', platform || 'web');

      // Update viewer count
      await this.updateViewerCount(sessionId);

      console.log('✅ Viewer added with real-time notification:', viewerName, platform);
      return viewerId;
    } catch (error: any) {
      console.error('Error adding viewer:', error);
      if (error.code === 'permission-denied') {
        console.error('Permission denied when adding viewer. Check Firebase security rules.');
      }
      throw error;
    }
  }

  // Remove viewer with participant leave notification
  async removeViewer(
    sessionId: string,
    viewerId: string,
    viewerName?: string,
    platform?: string
  ): Promise<void> {
    try {
      // Get viewer info before deletion for notification
      if (!viewerName || !platform) {
        const viewerDoc = await getDoc(doc(db, 'liveDrawSessions', sessionId, 'viewers', viewerId));
        if (viewerDoc.exists()) {
          const viewerData = viewerDoc.data();
          viewerName = viewerData.name;
          platform = viewerData.platform;
        }
      }
      
      // Remove viewer document
      await updateDoc(doc(db, 'liveDrawSessions', sessionId, 'viewers', viewerId), {
        isActive: false,
        leftAt: serverTimestamp(),
      });
      
      // Broadcast participant leave event
      if (viewerName && platform) {
        await this.broadcastParticipantLeave(sessionId, viewerName, platform as 'web' | 'mobile' | 'app');
      }
      
      // Update viewer count
      await this.updateViewerCount(sessionId);
      
      console.log('✅ Viewer removed with notification:', viewerName, platform);
    } catch (error: any) {
      console.error('Error removing viewer:', error);
      throw error;
    }
  }

  // Update viewer count
  private async updateViewerCount(sessionId: string): Promise<void> {
    try {
      const viewersSnapshot = await getDocs(
        collection(db, 'liveDrawSessions', sessionId, 'viewers')
      );
      
      const activeViewers = viewersSnapshot.docs.filter(
        doc => doc.data().isActive
      ).length;

      await updateDoc(doc(db, 'liveDrawSessions', sessionId), {
        viewerCount: activeViewers,
        lastUpdated: serverTimestamp(),
      });
    } catch (error: any) {
      console.error('Error updating viewer count:', error);
      // Log more detailed error information
      if (error.code === 'permission-denied') {
        console.error('Permission denied when updating viewer count. Check Firebase security rules.');
      }
      // Re-throw the error so it can be handled by the caller
      throw error;
    }
  }

  // Listen to session updates (cross-platform) with INSTANT response capabilities
  listenToSession(
    sessionId: string, 
    callback: (session: UniversalSession | null) => void
  ): () => void {
    const unsubscribe = onSnapshot(
      doc(db, 'liveDrawSessions', sessionId),
      (doc) => {
        if (doc.exists()) {
          const sessionData = { id: doc.id, ...doc.data() } as UniversalSession;
          
          // 🚀 INSTANT priority handling for immediate synchronization
          if (sessionData.currentState === 'spinning' && 
              (sessionData.wheelState?.participantSync === 'immediate' || 
               sessionData.wheelState?.instantStart ||
               sessionData.spinningNotification?.priority === 'immediate')) {
            console.log('⚡ INSTANT spinning state detected - immediate callback!');
            // Execute callback immediately for instant response
            callback(sessionData);
            return;
          }
          
          // 🚀 INSTANT winner notification handling
          if (sessionData.currentState === 'completed' && 
              (sessionData.resultNotification?.priority === 'immediate' ||
               sessionData.resultNotification?.zeroDelay ||
               sessionData.wheelState?.zeroDelay)) {
            console.log('⚡ INSTANT winner result detected - immediate callback!');
            // Execute callback immediately for instant winner display
            callback(sessionData);
            return;
          }
          
          // Regular callback for other updates
          callback(sessionData);
        } else {
          // Try fallback to wheels collection
          this.checkWheelSession(sessionId).then(callback).catch(() => callback(null));
        }
      },
      (error) => {
        console.error('Session listener error:', error);
        // Try fallback to wheels collection
        this.checkWheelSession(sessionId).then(callback).catch(() => callback(null));
      }
    );

    this.activeListeners.set(sessionId, unsubscribe);
    return unsubscribe;
  }

  // Fallback method to check wheel session
  private async checkWheelSession(sessionId: string): Promise<UniversalSession | null> {
    try {
      const wheelDoc = await getDoc(doc(db, 'wheels', sessionId));
      if (wheelDoc.exists() && wheelDoc.data().live) {
        const wheelData = wheelDoc.data();
        return {
          id: wheelDoc.id,
          roomCode: wheelData.liveJoinCode,
          wheelId: wheelDoc.id,
          wheelName: wheelData.name || 'Untitled Wheel',
          wheelData: wheelData,
          createdBy: wheelData.userId || 'unknown',
          createdAt: wheelData.liveSessionStartedAt || new Date(),
          isActive: true,
          isLive: true,
          platform: 'both',
          viewerCount: 0,
          lastUpdated: new Date(),
          settings: {
            allowComments: true,
            allowReactions: true,
            isShared: true,
            crossPlatformEnabled: true,
          },
          urls: {
            webUrl: `${this.getBaseUrl()}/live/session/${wheelData.liveJoinCode}`,
            mobileUrl: `cobypicks://join?code=${wheelData.liveJoinCode}`,
            qrCodeUrl: `${this.getBaseUrl()}/join?code=${wheelData.liveJoinCode}`,
            deepLinkUrl: `cobypicks://live?code=${wheelData.liveJoinCode}`,
          },
          metadata: {
            version: '2.0.0',
            compatibility: ['web', 'mobile', 'app'],
            features: ['real-time', 'cross-platform', 'qr-code', 'deep-link'],
          },
        } as UniversalSession;
      }
      return null;
    } catch (error) {
      console.error('Error checking wheel session:', error);
      return null;
    }
  }

  listenToViewers(
    sessionId: string,
    callback: (viewers: SessionViewer[]) => void
  ): () => void {
    const unsubscribe = onSnapshot(
      collection(db, 'liveDrawSessions', sessionId, 'viewers'),
      (snapshot) => {
        const viewers = snapshot.docs.map(doc => doc.data() as SessionViewer);
        callback(viewers);
      },
      (error) => {
        console.error('Viewers listener error:', error);
        // Try fallback to wheels collection
        this.checkWheelViewers(sessionId).then(callback).catch(() => callback([]));
      }
    );
    this.activeListeners.set(`${sessionId}-viewers`, unsubscribe);
    return unsubscribe;
  }

  // Fallback method to check wheel viewers
  private async checkWheelViewers(sessionId: string): Promise<SessionViewer[]> {
    try {
      const viewersSnapshot = await getDocs(collection(db, 'wheels', sessionId, 'viewers'));
      return viewersSnapshot.docs.map(doc => doc.data() as SessionViewer);
    } catch (error) {
      console.error('Error checking wheel viewers:', error);
      return [];
    }
  }

  listenToComments(
    sessionId: string,
    callback: (comments: any[]) => void
  ): () => void {
    const unsubscribe = onSnapshot(
      collection(db, 'liveDrawSessions', sessionId, 'comments'),
      (snapshot) => {
        const comments = snapshot.docs.map(doc => doc.data());
        callback(comments);
      },
      (error) => {
        console.error('Comments listener error:', error);
        callback([]);
      }
    );
    this.activeListeners.set(`${sessionId}-comments`, unsubscribe);
    return unsubscribe;
  }

  // Listen to wheel state updates for INSTANT real-time synchronization - ZERO DELAY
  listenToWheelState(
    sessionId: string,
    callback: (wheelState: any) => void
  ): () => void {
    console.log('🔄 Setting up wheel state listener for session:', sessionId);

    const unsubscribe = onSnapshot(
      doc(db, 'liveDrawSessions', sessionId),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();

          console.log('📡 Wheel state listener received update:', {
            sessionId: sessionId,
            currentState: data.currentState,
            isSpinning: data.isSpinning,
            hasWheelState: !!data.wheelState,
            wheelState: data.wheelState,
            timestamp: new Date().toISOString()
          });

          // 🚀 INSTANT response to wheel state changes
          if (data.wheelState) {
            // 💥 Priority handling for immediate synchronization flags
            if (data.wheelState.participantSync === 'immediate' ||
                data.wheelState.instantStart ||
                data.wheelState.zeroDelay ||
                data.wheelState.instantSpinStart) {
              console.log('⚡ INSTANT wheel state update detected - zero delay response!', {
                sessionId: sessionId,
                participantSync: data.wheelState.participantSync,
                instantStart: data.wheelState.instantStart,
                zeroDelay: data.wheelState.zeroDelay,
                instantSpinStart: data.wheelState.instantSpinStart,
                currentState: data.wheelState.currentState,
                isSpinning: data.wheelState.isSpinning,
                timestamp: new Date().toISOString()
              });
              // Immediate callback execution for instant response
              callback(data.wheelState);
              return;
            }

            console.log('📡 Regular wheel state update:', {
              sessionId: sessionId,
              currentState: data.wheelState.currentState,
              isSpinning: data.wheelState.isSpinning,
              timestamp: new Date().toISOString()
            });
            callback(data.wheelState);
          }

          // 🚀 Handle instant spinning notifications
          if (data.spinningNotification && data.spinningNotification.priority === 'immediate') {
            console.log('⚡ INSTANT spinning notification received!', {
              sessionId: sessionId,
              currentState: data.currentState,
              timestamp: new Date().toISOString()
            });
            // Trigger immediate UI response for spinning start
            if (data.currentState === 'spinning') {
              callback({
                ...data.wheelState,
                instantSpinStart: true,
                currentState: 'spinning'
              });
            }
          }

          // 🚀 Handle instant winner notifications
          if (data.resultNotification &&
              (data.resultNotification.priority === 'immediate' || data.resultNotification.zeroDelay)) {
            console.log('⚡ INSTANT winner notification received!', {
              sessionId: sessionId,
              winnerCount: data.resultNotification.winners?.length || 0,
              timestamp: new Date().toISOString()
            });
            // Trigger immediate winner display
            callback({
              ...data.wheelState,
              instantWinner: true,
              winners: data.resultNotification.winners,
              currentState: 'completed',
              showConfetti: data.resultNotification.showConfetti
            });
          }

          // 🚀 ENHANCED: Also check for direct isSpinning flag
          if (data.isSpinning && data.currentState === 'spinning') {
            console.log('🎯 Direct isSpinning flag detected in session data:', {
              sessionId: sessionId,
              isSpinning: data.isSpinning,
              currentState: data.currentState,
              timestamp: new Date().toISOString()
            });
            callback({
              ...data.wheelState,
              isSpinning: true,
              currentState: 'spinning'
            });
          }
        } else {
          console.log('⚠️ Session document does not exist:', sessionId);
        }
      },
      (error) => {
        console.error('❌ Wheel state listener error:', {
          error: error.message,
          errorCode: error.code,
          sessionId: sessionId,
          timestamp: new Date().toISOString()
        });
        callback(null);
      }
    );
    this.activeListeners.set(`${sessionId}-wheelState`, unsubscribe);
    return unsubscribe;
  }

  // Update wheel state for real-time synchronization
  async updateWheelState(
    sessionId: string,
    wheelState: {
      currentAngle?: number;
      isSpinning?: boolean;
      winners?: any[];
    }
  ): Promise<void> {
    try {
      // Filter out undefined values
      const cleanWheelState = Object.fromEntries(
        Object.entries(wheelState).filter(([_, value]) => value !== undefined)
      );
      
      const updateData = {
        wheelState: cleanWheelState,
        lastUpdated: serverTimestamp(),
      };
      
      await updateDoc(doc(db, 'liveDrawSessions', sessionId), updateData);
    } catch (error: any) {
      console.error('Error updating wheel state:', error);
      throw error;
    }
  }

  // Enhanced method to update wheel type in real-time
  async updateWheelType(
    sessionId: string,
    selectedWheelType: any,
    organizerUserId: string
  ): Promise<void> {
    try {
      console.log('🔄 Updating wheel type for session:', sessionId, selectedWheelType?.id);
      
      const updateData = {
        selectedWheelType: selectedWheelType || null,
        wheelType: selectedWheelType?.id || 'basic-picker',
        wheelTitle: selectedWheelType?.title || 'Live Wheel',
        wheelItems: selectedWheelType?.defaultItems || [],
        lastUpdated: serverTimestamp(),
        wheelTypeUpdatedBy: organizerUserId || 'unknown',
        wheelTypeUpdatedAt: serverTimestamp(),
      };
      
      // Filter out any undefined values
      const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
      );
      
      await updateDoc(doc(db, 'liveDrawSessions', sessionId), cleanUpdateData);
      
      console.log('✅ Wheel type updated successfully');
    } catch (error: any) {
      console.error('❌ Error updating wheel type:', error);
      throw error;
    }
  }

  // Enhanced method to broadcast session state changes
  async updateSessionState(
    sessionId: string,
    newState: 'waiting' | 'spinning' | 'completed',
    additionalData?: any
  ): Promise<void> {
    try {
      const updateData: any = {
        currentState: newState,
        lastUpdated: serverTimestamp(),
      };
      
      if (additionalData) {
        Object.assign(updateData, additionalData);
      }
      
      await updateDoc(doc(db, 'liveDrawSessions', sessionId), updateData);
      console.log('📢 Session state updated:', newState);
    } catch (error: any) {
      console.error('Error updating session state:', error);
      throw error;
    }
  }

  // Enhanced participant tracking with real-time notifications
  async addViewerWithNotification(
    sessionId: string,
    viewerName: string,
    platform: 'web' | 'mobile' | 'app' = 'mobile',
    userId?: string
  ): Promise<void> {
    try {
      // First add the viewer normally
      await this.addViewer(sessionId, viewerName, platform, userId);
      
      // Then broadcast a notification to organizers
      await this.broadcastParticipantJoin(sessionId, viewerName, platform);
      
    } catch (error: any) {
      console.error('Error adding viewer with notification:', error);
      throw error;
    }
  }

  // Broadcast participant join notification
  async broadcastParticipantJoin(
    sessionId: string,
    participantName: string,
    platform: 'web' | 'mobile' | 'app'
  ): Promise<void> {
    try {
      // Add to participant events collection for real-time notifications
      await addDoc(collection(db, 'liveDrawSessions', sessionId, 'participantEvents'), {
        type: 'join',
        participantName,
        platform,
        timestamp: serverTimestamp(),
        id: `join-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      
      console.log('📢 Broadcasted participant join:', participantName, platform);
    } catch (error: any) {
      console.error('Error broadcasting participant join:', error);
    }
  }

  // Broadcast participant leave notification
  async broadcastParticipantLeave(
    sessionId: string,
    participantName: string,
    platform: 'web' | 'mobile' | 'app'
  ): Promise<void> {
    try {
      // Add to participant events collection for real-time notifications
      await addDoc(collection(db, 'liveDrawSessions', sessionId, 'participantEvents'), {
        type: 'leave',
        participantName,
        platform,
        timestamp: serverTimestamp(),
        id: `leave-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      
      console.log('📢 Broadcasted participant leave:', participantName, platform);
    } catch (error: any) {
      console.error('Error broadcasting participant leave:', error);
    }
  }

  // Listen to participant events for organizers
  listenToParticipantEvents(
    sessionId: string,
    callback: (events: any[]) => void
  ): () => void {
    const unsubscribe = onSnapshot(
      collection(db, 'liveDrawSessions', sessionId, 'participantEvents'),
      (snapshot) => {
        const events = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date()
          };
        }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        callback(events);
      },
      (error) => {
        console.error('Participant events listener error:', error);
        callback([]);
      }
    );
    this.activeListeners.set(`${sessionId}-participantEvents`, unsubscribe);
    return unsubscribe;
  }

  listenToReactions(
    sessionId: string,
    callback: (reactions: any[]) => void
  ): () => void {
    const unsubscribe = onSnapshot(
      collection(db, 'liveDrawSessions', sessionId, 'reactions'),
      (snapshot) => {
        const reactions = snapshot.docs.map(doc => doc.data());
        callback(reactions);
      },
      (error) => {
        console.error('Reactions listener error:', error);
        callback([]);
      }
    );
    this.activeListeners.set(`${sessionId}-reactions`, unsubscribe);
    return unsubscribe;
  }

  async sendComment(sessionId: string, text: string, userName: string) {
    await addDoc(collection(db, 'liveDrawSessions', sessionId, 'comments'), {
      text,
      userName,
      timestamp: serverTimestamp(),
    });
  }

  async sendReaction(sessionId: string, emoji: string, userName: string) {
    await addDoc(collection(db, 'liveDrawSessions', sessionId, 'reactions'), {
      emoji,
      userName,
      timestamp: serverTimestamp(),
    });
  }

  // End session (cross-platform)
  async endSession(sessionId: string): Promise<void> {
    try {
      // Get session data before ending to store in history
      const sessionDoc = await getDoc(doc(db, 'liveDrawSessions', sessionId));
      if (sessionDoc.exists()) {
        const sessionData = sessionDoc.data();
        
        // Store session in history before ending
        const historyData = {
          sessionId: sessionId,
          title: sessionData.title || 'Live Session',
          description: sessionData.description || '',
          wheelType: sessionData.wheelType,
          wheelTitle: sessionData.wheelTitle,
          wheelIcon: sessionData.selectedWheelType?.icon || '🎯',
          participants: sessionData.participants || [],
          winners: sessionData.winners || [],
          createdBy: sessionData.createdBy,
          createdAt: sessionData.createdAt,
          endedAt: new Date(),
          roomCode: sessionData.roomCode,
          viewerCount: sessionData.viewerCount || 0,
          totalSpins: sessionData.winners?.length || 0,
          sessionDuration: sessionData.createdAt ? Math.round((new Date().getTime() - sessionData.createdAt.toDate().getTime()) / 1000) : 0,
          selectedWheelType: sessionData.selectedWheelType,
          settings: sessionData.settings,
          endedExplicitly: true,
          category: sessionData.selectedWheelType?.category || 'personal'
        };

        // Save to live wheel history collection
        await addDoc(collection(db, 'liveWheelHistory'), historyData);
        
        // Also save to spin history for compatibility
        const spinHistoryData = {
          activityId: sessionData.activityId || sessionId,
          activityTitle: sessionData.title || 'Live Session',
          winners: (sessionData.winners || []).map((w: any) => w.name || w),
          participantCount: (sessionData.participants || []).length,
          timestamp: new Date(),
          category: sessionData.selectedWheelType?.category || 'personal',
          numberOfWinners: (sessionData.winners || []).length,
          spinDuration: 3000,
          createdBy: sessionData.createdBy,
          createdAt: sessionData.createdAt,
          sessionId: sessionId,
          roomCode: sessionData.roomCode
        };
        await addDoc(collection(db, 'spinHistory'), spinHistoryData);
        
        // Update associated wheel if exists
        if (sessionData.wheelId) {
          await updateDoc(doc(db, 'wheels', sessionData.wheelId), {
            live: false,
            liveJoinCode: null,
          });
        }
        
        // Update the corresponding draw activity if it exists
        if (sessionData.activityId) {
          try {
            await updateDoc(doc(db, 'drawActivities', sessionData.activityId), {
              isLive: false,
              hasActiveSession: false,
              lastUsed: serverTimestamp(),
              timesUsed: (sessionData.winners?.length || 0) > 0 ? 1 : 0,
              updatedAt: serverTimestamp(),
              endedAt: serverTimestamp(),
              movedToHistory: true
            });
            console.log('✅ Updated draw activity - moved to history:', sessionData.activityId);
          } catch (error) {
            console.log('Could not update activity end status:', error);
          }
        }
      }
      
      // Update session to mark as ended
      await updateDoc(doc(db, 'liveDrawSessions', sessionId), {
        isActive: false,
        isLive: false,
        endedAt: serverTimestamp(),
        archivedAt: serverTimestamp(),
        endedExplicitly: true,
        lastUpdated: serverTimestamp(),
      });

      // Clean up listeners
      const unsubscribe = this.activeListeners.get(sessionId);
      if (unsubscribe) {
        unsubscribe();
        this.activeListeners.delete(sessionId);
      }
      
      console.log('✅ Session ended successfully and saved to history:', sessionId);
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  }

  // Theme synchronization methods for cross-platform consistency
  async updateSessionTheme(sessionId: string, themeConfig: {
    organizerTheme: string;
    customColors?: {
      primary: string;
      secondary: string;
      background: string;
      surface: string;
      text: string;
      accent: string;
    };
    wheelTheme?: string;
    syncEnabled?: boolean;
  }): Promise<void> {
    try {
      await updateDoc(doc(db, 'liveDrawSessions', sessionId), {
        'themeConfig.organizerTheme': themeConfig.organizerTheme,
        'themeConfig.customColors': themeConfig.customColors || null,
        'themeConfig.wheelTheme': themeConfig.wheelTheme || 'school',
        'themeConfig.syncEnabled': themeConfig.syncEnabled !== false,
        'themeConfig.lastThemeUpdate': serverTimestamp(),
        lastUpdated: serverTimestamp(),
      });
      console.log('✅ Theme updated for session:', sessionId);
    } catch (error) {
      console.error('❌ Error updating session theme:', error);
      throw error;
    }
  }

  // Get current theme for a session
  async getSessionTheme(sessionId: string): Promise<any> {
    try {
      const sessionDoc = await getDoc(doc(db, 'liveDrawSessions', sessionId));
      if (sessionDoc.exists()) {
        const data = sessionDoc.data();
        return data.themeConfig || {
          organizerTheme: 'light',
          wheelTheme: 'school',
          syncEnabled: true,
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting session theme:', error);
      return null;
    }
  }

  // Get base URL for the current environment
  private getBaseUrl(): string {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.origin;
    }
    return 'https://cobypicks.com'; // Default production URL
  }

  // Generate QR code data that works for both platforms
  generateUniversalQRCode(roomCode: string): string {
    const baseUrl = this.getBaseUrl();
    const webUrl = `${baseUrl}/join?code=${roomCode}`;
    const appUrl = `cobypicks://join?code=${roomCode}`;
    
    // QR code contains web URL with app fallback
    return `${webUrl}&app=${encodeURIComponent(appUrl)}`;
  }

  // Clean up all listeners
  cleanup(): void {
    this.activeListeners.forEach(unsubscribe => unsubscribe());
    this.activeListeners.clear();
  }
}

export default CrossPlatformSessionManager.getInstance();
