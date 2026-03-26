import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  doc, 
  collection, 
  setDoc, 
  updateDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp,
  where,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { useAuth } from './AuthContext';

export interface CollaborativeAction {
  id: string;
  sessionId: string;
  wheelId: string;
  action: 'start_spin' | 'select_winners' | 'end_session' | 'broadcast_message' | 'update_settings';
  performedBy: string;
  performedByName: string;
  timestamp: number;
  parameters?: any;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  lockAcquired?: boolean;
  lockDuration?: number;
}

export interface OrganizerPresence {
  uid: string;
  name: string;
  email: string;
  isOnline: boolean;
  lastSeen: number;
  platform: 'web' | 'mobile';
  permissions: {
    canControlLive: boolean;
    canEditWheel: boolean;
    canManageParticipants: boolean;
  };
}

export interface LiveRoomLock {
  sessionId: string;
  action: string;
  lockedBy: string;
  lockedByName: string;
  acquiredAt: number;
  expiresAt: number;
  lockDuration: number;
}

interface CollaborativeLiveRoomContextType {
  activeOrganizers: OrganizerPresence[];
  recentActions: CollaborativeAction[];
  currentLocks: LiveRoomLock[];
  executeAction: (action: Omit<CollaborativeAction, 'id' | 'timestamp' | 'status'>) => Promise<{ success: boolean; message: string; actionId?: string }>;
  updatePresence: (sessionId: string) => Promise<void>;
  isActionLocked: (action: string) => { locked: boolean; lockedBy?: string };
  getCollaborationStatus: () => { isCollaborating: boolean; collaboratorCount: number; activeCollaborators: string[] };
}

const CollaborativeLiveRoomContext = createContext<CollaborativeLiveRoomContextType | null>(null);

export const useCollaborativeLiveRoom = () => {
  const context = useContext(CollaborativeLiveRoomContext);
  if (!context) {
    throw new Error('useCollaborativeLiveRoom must be used within a CollaborativeLiveRoomProvider');
  }
  return context;
};

interface CollaborativeLiveRoomProviderProps {
  children: ReactNode;
}

export const CollaborativeLiveRoomProvider: React.FC<CollaborativeLiveRoomProviderProps> = ({ children }) => {
  const { currentUser, userProfile } = useAuth();
  const [activeOrganizers, setActiveOrganizers] = useState<OrganizerPresence[]>([]);
  const [recentActions, setRecentActions] = useState<CollaborativeAction[]>([]);
  const [currentLocks, setCurrentLocks] = useState<LiveRoomLock[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Execute collaborative action
  const executeAction = async (
    action: Omit<CollaborativeAction, 'id' | 'timestamp' | 'status'>
  ): Promise<{ success: boolean; message: string; actionId?: string }> => {
    if (!currentUser) {
      return { success: false, message: 'User not authenticated' };
    }

    try {
      // Check permissions first
      const hasPermission = await checkPermission(action.sessionId, action.action);
      if (!hasPermission) {
        return { success: false, message: 'Insufficient permissions for this action' };
      }

      // Check if action is locked by another organizer
      const lockStatus = isActionLocked(action.action);
      if (lockStatus.locked) {
        return { 
          success: false, 
          message: `Action is currently being performed by ${lockStatus.lockedBy}. Please wait...` 
        };
      }

      // Critical actions that need locks
      const criticalActions = ['start_spin', 'select_winners', 'end_session'];
      let lockAcquired = false;

      if (criticalActions.includes(action.action)) {
        const lockResult = await acquireLock(action.sessionId, action.action);
        if (!lockResult.success) {
          return { success: false, message: lockResult.message };
        }
        lockAcquired = true;
      }

      // Create action document
      const actionData: CollaborativeAction = {
        id: '',
        ...action,
        timestamp: Date.now(),
        status: 'executing',
        lockAcquired
      };

      const actionRef = await addDoc(
        collection(db, 'liveDrawSessions', action.sessionId, 'collaborativeActions'),
        actionData
      );

      actionData.id = actionRef.id;

      try {
        // Execute the actual action
        await performAction(action.sessionId, action.action, action.parameters);

        // Mark as completed
        await updateDoc(actionRef, {
          status: 'completed',
          completedAt: Date.now()
        });

        // Release lock if acquired
        if (lockAcquired) {
          await releaseLock(action.sessionId, action.action);
        }

        return { 
          success: true, 
          message: `Action ${action.action} completed successfully`,
          actionId: actionRef.id
        };

      } catch (error) {
        // Mark as failed and release lock
        await updateDoc(actionRef, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          failedAt: Date.now()
        });

        if (lockAcquired) {
          await releaseLock(action.sessionId, action.action);
        }

        throw error;
      }

    } catch (error) {
      console.error('Error executing collaborative action:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Action execution failed' 
      };
    }
  };

  // Check if user has permission for action
  const checkPermission = async (sessionId: string, action: string): Promise<boolean> => {
    if (!currentUser) return false;

    try {
      // Check if user is the session creator
      const sessionDoc = await getDocs(
        query(
          collection(db, 'liveDrawSessions'),
          where('__name__', '==', sessionId)
        )
      );

      if (!sessionDoc.empty) {
        const sessionData = sessionDoc.docs[0].data();
        if (sessionData.createdBy === currentUser.uid) {
          return true; // Session creator has all permissions
        }

        // Check if user is a collaborator with required permissions
        const collaborators = sessionData.collaboratorDetails || [];
        const userCollaborator = collaborators.find((c: any) => c.uid === currentUser.uid);

        if (userCollaborator) {
          switch (action) {
            case 'start_spin':
            case 'select_winners':
              return userCollaborator.permissions?.canControlLive || false;
            case 'update_settings':
              return userCollaborator.permissions?.canEditWheel || false;
            case 'broadcast_message':
              return userCollaborator.permissions?.canManageParticipants || false;
            default:
              return false;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  };

  // Acquire lock for critical action
  const acquireLock = async (
    sessionId: string,
    action: string,
    duration: number = 30000
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentUser || !userProfile) {
      return { success: false, message: 'User not authenticated' };
    }

    try {
      const now = Date.now();
      const lockDoc = {
        sessionId,
        action,
        lockedBy: currentUser.uid,
        lockedByName: userProfile.displayName || 'Organizer',
        acquiredAt: now,
        expiresAt: now + duration,
        lockDuration: duration
      };

      await setDoc(
        doc(db, 'liveDrawSessions', sessionId, 'actionLocks', action),
        lockDoc
      );

      return { success: true, message: 'Lock acquired successfully' };
    } catch (error) {
      console.error('Error acquiring lock:', error);
      return { success: false, message: 'Failed to acquire lock' };
    }
  };

  // Release lock
  const releaseLock = async (sessionId: string, action: string): Promise<void> => {
    try {
      await updateDoc(
        doc(db, 'liveDrawSessions', sessionId, 'actionLocks', action),
        {
          released: true,
          releasedAt: Date.now()
        }
      );
    } catch (error) {
      console.error('Error releasing lock:', error);
    }
  };

  // Perform the actual action
  const performAction = async (sessionId: string, action: string, parameters?: any): Promise<void> => {
    switch (action) {
      case 'start_spin':
        await performStartSpin(sessionId, parameters);
        break;
      case 'select_winners':
        await performSelectWinners(sessionId, parameters);
        break;
      case 'broadcast_message':
        await performBroadcastMessage(sessionId, parameters);
        break;
      case 'update_settings':
        await performUpdateSettings(sessionId, parameters);
        break;
      case 'end_session':
        await performEndSession(sessionId, parameters);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  };

  const performStartSpin = async (sessionId: string, parameters: any): Promise<void> => {
    const sessionRef = doc(db, 'liveDrawSessions', sessionId);
    
    const spinDuration = parameters?.spinDuration || 3500;
    const totalRotation = parameters?.totalRotation || ((5 + Math.random() * 5) * 360);
    const finalAngle = parameters?.finalAngle || (Math.random() * 360);
    const spinStartTime = Date.now();
    
    // Validate all values to prevent undefined Firebase errors
    const wheelStateData = {
      isSpinning: true,
      spinStartTime: spinStartTime,
      spinDuration: spinDuration,
      totalRotation: totalRotation,
      finalAngle: finalAngle,
      currentAngle: 0,
      progress: 0,
      startedAt: serverTimestamp()
    };
    
    // Filter out any undefined values
    const cleanWheelState = Object.fromEntries(
      Object.entries(wheelStateData).filter(([_, value]) => value !== undefined)
    );
    
    const updateData = {
      currentState: 'spinning',
      wheelState: cleanWheelState,
      spinningNotification: {
        message: '🎯 The wheel is now spinning! Everyone watch together...',
        timestamp: serverTimestamp(),
        isActive: true,
        duration: spinDuration
      },
      lastUpdated: serverTimestamp()
    };
    
    await updateDoc(sessionRef, updateData);
  };

  const performEndSession = async (sessionId: string, parameters: any): Promise<void> => {
    const sessionRef = doc(db, 'liveDrawSessions', sessionId);
    
    // Get session data before ending to store in history
    const sessionDoc = await getDoc(sessionRef);
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
    
    await updateDoc(sessionRef, {
      isActive: false,
      isLive: false,
      currentState: 'completed',
      closedAt: serverTimestamp(),
      endedAt: serverTimestamp(),
      archivedAt: serverTimestamp(),
      endedExplicitly: true,
      lastUpdated: serverTimestamp()
    });
    
    console.log('✅ Session ended successfully and saved to history:', sessionId);
  };

  const performUpdateSettings = async (sessionId: string, parameters: any): Promise<void> => {
    const sessionRef = doc(db, 'liveDrawSessions', sessionId);
    
    const updateData: any = {
      lastUpdated: serverTimestamp()
    };

    if (parameters?.settings) {
      updateData.settings = parameters.settings;
    }
    
    if (parameters?.maxParticipants) {
      updateData.maxParticipants = parameters.maxParticipants;
    }

    await updateDoc(sessionRef, updateData);
  };

  const performSelectWinners = async (sessionId: string, parameters: any): Promise<void> => {
    const sessionRef = doc(db, 'liveDrawSessions', sessionId);
    
    const winners = parameters?.winners || [];
    
    await updateDoc(sessionRef, {
      currentState: 'completed',
      winners: winners,
      wheelState: {
        isSpinning: false,
        progress: 1,
        completedAt: serverTimestamp(),
        hasResults: true
      },
      resultNotification: {
        message: winners.length === 1 
          ? `🎉 Congratulations ${winners[0].name}! 🎉`
          : `🎉 Congratulations to our ${winners.length} winners: ${winners.map((w: any) => w.name).join(', ')}! 🎉`,
        winners: winners,
        timestamp: serverTimestamp(),
        isActive: true,
        showConfetti: true
      },
      lastUpdated: serverTimestamp()
    });
  };

  const performBroadcastMessage = async (sessionId: string, parameters: any): Promise<void> => {
    const message = parameters?.message || '';
    const sender = parameters?.senderName || 'Organizer';
    
    // Add to session messages collection
    await addDoc(
      collection(db, 'liveDrawSessions', sessionId, 'messages'),
      {
        message,
        sender,
        timestamp: serverTimestamp(),
        type: 'organizer_broadcast'
      }
    );
    
    // Update session with latest broadcast
    await updateDoc(doc(db, 'liveDrawSessions', sessionId), {
      latestBroadcast: {
        message,
        sender,
        timestamp: serverTimestamp()
      },
      lastUpdated: serverTimestamp()
    });
  };

  // Update organizer presence
  const updatePresence = async (sessionId: string): Promise<void> => {
    if (!currentUser || !userProfile) return;

    try {
      const presence: OrganizerPresence = {
        uid: currentUser.uid,
        name: userProfile.displayName || 'Organizer',
        email: currentUser.email || '',
        isOnline: true,
        lastSeen: Date.now(),
        platform: 'mobile',
        permissions: {
          canControlLive: true,
          canEditWheel: true,
          canManageParticipants: true
        }
      };

      const presenceRef = doc(
        db,
        'liveDrawSessions',
        sessionId,
        'organizerPresence',
        currentUser.uid
      );
      
      await setDoc(presenceRef, {
        ...presence,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setCurrentSessionId(sessionId);
    } catch (error) {
      console.error('Error updating organizer presence:', error);
    }
  };

  // Check if an action is locked
  const isActionLocked = (action: string): { locked: boolean; lockedBy?: string } => {
    const lock = currentLocks.find(l => l.action === action);
    if (!lock) return { locked: false };

    const now = Date.now();
    if (lock.expiresAt < now) {
      return { locked: false }; // Expired lock
    }

    return {
      locked: lock.lockedBy !== currentUser?.uid,
      lockedBy: lock.lockedByName
    };
  };

  // Get collaboration status
  const getCollaborationStatus = () => {
    const collaboratorCount = activeOrganizers.length;
    const isCollaborating = collaboratorCount > 1;
    const activeCollaborators = activeOrganizers
      .filter(org => org.uid !== currentUser?.uid)
      .map(org => org.name);

    return {
      isCollaborating,
      collaboratorCount,
      activeCollaborators
    };
  };

  // Listen to collaborative actions and presence
  useEffect(() => {
    if (!currentSessionId) return;

    // Listen to collaborative actions
    const actionsQuery = query(
      collection(db, 'liveDrawSessions', currentSessionId, 'collaborativeActions'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    
    const actionsUnsubscribe = onSnapshot(actionsQuery, (snapshot) => {
      const actions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CollaborativeAction[];
      
      setRecentActions(actions);
    });

    // Listen to organizer presence
    const presenceUnsubscribe = onSnapshot(
      collection(db, 'liveDrawSessions', currentSessionId, 'organizerPresence'),
      (snapshot) => {
        const organizers = snapshot.docs.map(doc => ({
          ...doc.data()
        })) as OrganizerPresence[];
        
        // Filter out offline organizers (not seen in last 2 minutes)
        const now = Date.now();
        const activeOrgs = organizers.filter(org => 
          org.isOnline && (now - org.lastSeen) < 120000
        );
        
        setActiveOrganizers(activeOrgs);
      }
    );

    return () => {
      actionsUnsubscribe();
      presenceUnsubscribe();
    };
  }, [currentSessionId]);

  // Update presence periodically
  useEffect(() => {
    if (!currentSessionId) return;

    const interval = setInterval(() => {
      updatePresence(currentSessionId);
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [currentSessionId, currentUser, userProfile]);

  const value = {
    activeOrganizers,
    recentActions,
    currentLocks,
    executeAction,
    updatePresence,
    isActionLocked,
    getCollaborationStatus
  };

  return (
    <CollaborativeLiveRoomContext.Provider value={value}>
      {children}
    </CollaborativeLiveRoomContext.Provider>
  );
};

export default CollaborativeLiveRoomContext;