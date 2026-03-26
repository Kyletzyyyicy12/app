import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import { db } from '../config/firebaseConfig';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, orderBy, limit, setDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface LiveInvitation {
  id: string;
  wheelId: string;
  wheelName: string;
  joinCode: string;
  invitedBy: string;
  invitedByName: string;
  invitedAt: any;
  status: 'sent' | 'accepted' | 'declined' | 'expired';
  expiresAt: any;
}

interface NotificationContextType {
  invitations: LiveInvitation[];
  acceptInvitation: (invitation: LiveInvitation) => void;
  declineInvitation: (invitationId: string) => void;
  sendLiveInvitation: (studentIds: string[], wheelData: any, joinCode: string) => Promise<void>;
  markAsOnline: () => Promise<void>;
  markAsOffline: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, userProfile } = useAuth();
  const [invitations, setInvitations] = useState<LiveInvitation[]>([]);

  // Listen for real-time invitations for participants
  useEffect(() => {
    if (!currentUser || !userProfile) return;

    // Participants can receive invitations, organizers can see invitations they've sent
    let invitationsQuery;
    if (userProfile.role === 'participant') {
      invitationsQuery = query(
        collection(db, 'liveInvitations'),
        where('studentId', '==', currentUser.uid),
        where('status', '==', 'sent'),
        orderBy('invitedAt', 'desc'),
        limit(10)
      );
    } else {
      // For organizers/teachers, show invitations they've sent
      invitationsQuery = query(
        collection(db, 'liveInvitations'),
        where('invitedBy', '==', currentUser.uid),
        orderBy('invitedAt', 'desc'),
        limit(20)
      );
    }

    const unsubscribe = onSnapshot(
      invitationsQuery,
      (snapshot) => {
        const newInvitations: LiveInvitation[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          const invitation: LiveInvitation = {
            id: doc.id,
            wheelId: data.wheelId,
            wheelName: data.wheelName,
            joinCode: data.joinCode,
            invitedBy: data.invitedBy,
            invitedByName: data.invitedByName,
            invitedAt: data.invitedAt,
            status: data.status,
            expiresAt: data.expiresAt
          };

          // For participants, only show non-expired invitations
          if (userProfile.role === 'participant') {
            const now = new Date();
            const expiresAt = data.expiresAt?.toDate();
            if (expiresAt && now < expiresAt) {
              newInvitations.push(invitation);
            }
          } else {
            // For organizers, show all invitations
            newInvitations.push(invitation);
          }
        });

        // Defer state updates to prevent useInsertionEffect warnings
        setTimeout(() => {
          setInvitations(newInvitations);

          // Show alert for new invitations (only for participants)
          if (userProfile.role === 'participant' && newInvitations.length > 0) {
            const latestInvitation = newInvitations[0];
            // Only show alert for new invitations (check if it's recent)
            const invitedAt = latestInvitation.invitedAt?.toDate ? latestInvitation.invitedAt.toDate() : new Date(latestInvitation.invitedAt);
            const now = new Date();
            const timeDiff = now.getTime() - invitedAt.getTime();
            const minutesDiff = timeDiff / (1000 * 60);
            
            // Show alert only if invitation is less than 5 minutes old
            if (minutesDiff < 5) {
              showInvitationAlert(latestInvitation);
            }
          }
        }, 0);
      },
      (error) => {
        console.log('Permission denied for live invitations (expected for some users):', error);
        // Silently handle permission errors - not all users have access to this collection
        setTimeout(() => {
          setInvitations([]);
        }, 0);
      }
    );

    return () => unsubscribe();
  }, [currentUser, userProfile]);

  // Update user online status
  useEffect(() => {
    if (!currentUser) return;

    // Defer online status update to prevent useInsertionEffect warnings
    setTimeout(() => {
      markAsOnline();
    }, 0);

    // Mark as offline when component unmounts
    return () => {
      markAsOffline();
    };
  }, [currentUser]);

  const showInvitationAlert = (invitation: LiveInvitation) => {
    Alert.alert(
      '🎯 Live Draw Invitation',
      `${invitation.invitedByName} has invited you to join "${invitation.wheelName}"!\n\nRoom Code: ${invitation.joinCode}`,
      [
        {
          text: 'Decline',
          style: 'cancel',
          onPress: () => declineInvitation(invitation.id)
        },
        {
          text: 'Join Now',
          onPress: () => acceptInvitation(invitation)
        }
      ],
      { cancelable: false }
    );
  };

  const acceptInvitation = async (invitation: LiveInvitation) => {
    try {
      // Update invitation status
      await updateDoc(doc(db, 'liveInvitations', invitation.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp()
      });

      // Remove from local state with deferred update
      setTimeout(() => {
        setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      }, 0);
      
      // The navigation will be handled by the component that uses this context
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'Failed to accept invitation');
    }
  };

  const declineInvitation = async (invitationId: string) => {
    try {
      await updateDoc(doc(db, 'liveInvitations', invitationId), {
        status: 'declined',
        declinedAt: serverTimestamp()
      });

      setTimeout(() => {
        setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      }, 0);
    } catch (error) {
      console.error('Error declining invitation:', error);
    }
  };

  const sendLiveInvitation = async (studentIds: string[], wheelData: any, joinCode: string) => {
    if (!currentUser || !userProfile) return;

    // Only organizers/teachers can send invitations
    const role = userProfile.role?.toLowerCase();
    if (role !== 'teacher' && role !== 'organizer' && role !== 'admin') {
      console.error('Only organizers/teachers can send invitations');
      throw new Error('Permission denied: Only organizers/teachers can send invitations');
    }

    try {
      const invitationPromises = studentIds.map(async (studentId) => {
        // Create invitation with 10-minute expiry
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        await addDoc(collection(db, 'liveInvitations'), {
          wheelId: wheelData.id,
          wheelName: wheelData.name,
          joinCode: joinCode,
          studentId: studentId,
          invitedBy: currentUser.uid,
          invitedByName: userProfile.fullName || userProfile.email || 'Teacher',
          invitedAt: serverTimestamp(),
          expiresAt: expiresAt,
          status: 'sent',
          wheelData: {
            id: wheelData.id,
            name: wheelData.name,
            slices: wheelData.slices
          }
        });
      });

      await Promise.all(invitationPromises);
      console.log(`Sent ${studentIds.length} live invitations`);
    } catch (error) {
      console.error('Error sending live invitations:', error);
      throw error;
    }
  };

  const markAsOnline = async () => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(
        userRef,
        {
          isOnline: true,
          lastSeen: serverTimestamp()
        },
        { merge: true }
      );
    } catch (error: any) {
      console.log('Error updating online status:', error);

      // Handle permission errors gracefully
      if (error?.code === 'permission-denied') {
        console.log('Permission denied when updating online status - continuing without online status update');
        // The app continues to work even without online status updates
      }
    }
  };

  const markAsOffline = async () => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(
        userRef,
        {
          isOnline: false,
          lastSeen: serverTimestamp()
        },
        { merge: true }
      );
    } catch (error: any) {
      console.log('Error updating offline status:', error);

      // Handle permission errors gracefully
      if (error?.code === 'permission-denied') {
        console.log('Permission denied when updating offline status - continuing without offline status update');
        // The app continues to work even without offline status updates
      }
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        invitations,
        acceptInvitation,
        declineInvitation,
        sendLiveInvitation,
        markAsOnline,
        markAsOffline
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};