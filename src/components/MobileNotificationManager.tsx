 import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../config/firebaseConfig';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  arrayUnion,
  orderBy,
} from 'firebase/firestore';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

interface CollaborationInvitation {
  id: string;
  wheelId: string;
  wheelName: string;
  invitedBy: string;
  invitedByName: string;
  invitedByEmail: string;
  invitedOrganizer: string;
  invitedOrganizerName: string;
  invitedOrganizerEmail: string;
  status: 'sent' | 'accepted' | 'declined' | 'expired';
  createdAt: any;
  expiresAt: any;
  permissions: {
    canControlLive: boolean;
    canEditWheel: boolean;
    canManageParticipants: boolean;
  };
  roomCode?: string;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "urgent";
  targetRoles: string[];
  isActive: boolean;
  priority: "low" | "medium" | "high" | "urgent";
  expiresAt?: Date;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  readBy: Array<{
    userId: string;
    userName: string;
    readAt: Date;
  }>;
}

interface MobileNotificationManagerProps {
  user?: any;
}

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

const styles = StyleSheet.create({
  container: {
    // Relative positioning when used in header, aligns with other header elements
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  badgeText: {
    color: COLORS.surface,
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  invitationCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  invitationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  invitationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  invitationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  invitationSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  invitationDetails: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    width: 80,
  },
  detailValue: {
    fontSize: 12,
    color: COLORS.text,
    flex: 1,
  },
  permissionsContainer: {
    backgroundColor: COLORS.success + '20',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  permissionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginBottom: 8,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  permissionText: {
    fontSize: 12,
    color: COLORS.success,
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  declineButton: {
    flex: 1,
    backgroundColor: COLORS.error,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: COLORS.success,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  pulseIndicator: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  announcementCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
  },
  announcementPreview: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  announcementMeta: {
    fontSize: 12,
  },
});

export function MobileNotificationManager({ user }: MobileNotificationManagerProps) {
   const { currentUser, userProfile } = useAuth();
   const { theme } = useTheme();
   const navigation = useNavigation();
   const [invitations, setInvitations] = useState<CollaborationInvitation[]>([]);
   const [announcements, setAnnouncements] = useState<Announcement[]>([]);
   const [loading, setLoading] = useState<string | null>(null);
   const [showNotifications, setShowNotifications] = useState(false);
   const [hasNewNotifications, setHasNewNotifications] = useState(false);
   const [showList, setShowList] = useState(false);
   const [isOnDashboard, setIsOnDashboard] = useState(false);
   const pulseAnimation = useState(new Animated.Value(0))[0];

   // Debug logging for component initialization
   console.log('🔔 MobileNotificationManager initialized:', {
     hasUser: !!user,
     hasCurrentUser: !!currentUser,
     hasUserProfile: !!userProfile,
     userRole: userProfile?.role,
     currentUserEmail: currentUser?.email,
     invitationsCount: invitations.length,
     announcementsCount: announcements.length
   });


  // Use the passed user prop or fall back to currentUser from auth context
  const activeUser = user || currentUser;

  // Calculate total unread count
  const totalUnreadCount = invitations.length + announcements.filter(announcement =>
    !announcement.readBy.some(reader => reader.userId === currentUser?.uid)
  ).length;

  // Listen for collaboration invitations for current organizer
  useEffect(() => {
    if (!activeUser?.email) {
      console.log('❌ No user email available for collaboration invitations');
      return;
    }

    console.log('🔔 Setting up collaboration invitation listener for:', activeUser.email);
    console.log('👤 Current user details:', {
      uid: activeUser.uid,
      email: activeUser.email,
      displayName: activeUser.displayName
    });

    // Query for invitations by email (since we may not have their UID yet)
    // 🔍 DEBUGGING: Let's log all possible invitation statuses to see what's available
    console.log('🔍 DEBUGGING INVITATION LISTENER');
    console.log('📧 Current user email:', activeUser.email);
    console.log('🔑 Current user UID:', activeUser.uid);

    // First, let's query for ALL invitations for this user regardless of status to debug
    const debugQuery = query(
      collection(db, 'liveRoomInvitations'),
      where('invitedOrganizerEmail', '==', activeUser.email)
    );

    // Listen to all invitations to debug status and availability
    const debugUnsubscribe = onSnapshot(debugQuery, (debugSnapshot) => {
      console.log('🔍 DEBUG: Found invitations for this email:', {
        totalCount: debugSnapshot.size,
        docs: debugSnapshot.docs.map(doc => ({
          id: doc.id,
          status: doc.data().status,
          invitedBy: doc.data().invitedByName,
          sessionTitle: doc.data().sessionTitle,
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          expiresAt: doc.data().expiresAt?.toDate?.() || doc.data().expiresAt
        }))
      });
    });

    const invitationsQuery = query(
      collection(db, 'liveRoomInvitations'),
      where('invitedOrganizerEmail', '==', activeUser.email),
      where('status', '==', 'sent')
    );

    console.log('🔍 Querying collaborationInvitations collection with:', {
      invitedOrganizerEmail: activeUser.email,
      status: 'sent'
    });

    const unsubscribe = onSnapshot(
      invitationsQuery,
      (snapshot) => {
        console.log('📋 Snapshot received for collaboration invitations:', {
          size: snapshot.size,
          empty: snapshot.empty,
          docs: snapshot.docs.length
        });

        const newInvitations: CollaborationInvitation[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          console.log('📄 Found invitation document:', {
            id: doc.id,
            data: data,
            invitedOrganizerEmail: data.invitedOrganizerEmail,
            status: data.status,
            expiresAt: data.expiresAt
          });

          // Check if invitation hasn't expired
          const now = new Date();
          const expiresAt = data.expiresAt instanceof Date ? data.expiresAt :
                          data.expiresAt?.toDate ? data.expiresAt.toDate() :
                          new Date(data.expiresAt);

          if (expiresAt && now < expiresAt) {
            const invitation: CollaborationInvitation = {
              id: doc.id,
              wheelId: data.sessionId, // Map sessionId to wheelId
              wheelName: data.sessionTitle, // Map sessionTitle to wheelName
              invitedBy: data.invitedBy,
              invitedByName: data.invitedByName,
              invitedByEmail: data.invitedByEmail,
              invitedOrganizer: data.invitedOrganizer,
              invitedOrganizerName: data.invitedOrganizerName || 'Organizer',
              invitedOrganizerEmail: data.invitedOrganizerEmail,
              status: data.status,
              createdAt: data.createdAt,
              expiresAt: data.expiresAt,
              permissions: data.permissions,
              roomCode: data.roomCode,
            };

            newInvitations.push(invitation);
          } else {
            console.log('⏰ Invitation expired, skipping:', doc.id);
          }
        });

        console.log(`🔔 Found ${newInvitations.length} active collaboration invitations`,
          newInvitations.map(inv => ({
            id: inv.id,
            from: inv.invitedByName,
            wheelName: inv.wheelName,
            roomCode: inv.roomCode
          }))
        );

        setInvitations(newInvitations);

        // Show alert for new invitations (only for very recent ones)
        if (newInvitations.length > 0) {
          const latestInvitation = newInvitations[0];
          const invitedAt = latestInvitation.createdAt?.toDate ?
                           latestInvitation.createdAt.toDate() :
                           new Date(latestInvitation.createdAt);
          const timeDiff = new Date().getTime() - invitedAt.getTime();
          const minutesDiff = timeDiff / (1000 * 60);

          // Show alert only if invitation is less than 2 minutes old (very fresh)
          if (minutesDiff < 2) {
            console.log('🔔 Showing alert for fresh collaboration invitation');
            Alert.alert(
              '🤝 Collaboration Invitation Received!',
              `${latestInvitation.invitedByName} has invited you to collaborate on "${latestInvitation.wheelName}"${latestInvitation.roomCode ? ` (Room: ${latestInvitation.roomCode})` : ''}`,
              [
                { text: 'View Later', style: 'cancel' },
                { text: 'View Now', onPress: () => setShowNotifications(true) }
              ]
            );
          }
        }
      },
      (error) => {
        console.error('❌ Error listening for collaboration invitations:', error);
        console.error('🔍 Error details:', {
          code: error.code,
          message: error.message,
          name: error.name
        });
        setInvitations([]);
      }
    );

    return () => {
      console.log('🔕 Cleaning up collaboration invitation listener');
      unsubscribe();
    };
  }, [activeUser?.email]);

  // Listen for announcements
  useEffect(() => {
    if (!currentUser || !userProfile) return;

    console.log('📢 Setting up announcements listener for:', currentUser.uid);

    const q = query(
      collection(db, "announcements"),
      where("isActive", "==", true),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedAnnouncements = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        expiresAt: doc.data().expiresAt?.toDate(),
        readBy: doc.data().readBy?.map((item: any) => ({
          ...item,
          readAt: item.readAt?.toDate() || new Date()
        })) || []
      })) as Announcement[];

      // Filter for user role and expired announcements
      const userRole = userProfile.role || 'participant';
      const userAnnouncements = fetchedAnnouncements.filter(announcement =>
        announcement.targetRoles.includes(userRole)
      );

      const activeAnnouncements = userAnnouncements.filter(announcement => {
        if (!announcement.expiresAt) return true;
        return announcement.expiresAt > new Date();
      });

      // Check for new announcements
      const previousIds = announcements.map(a => a.id);
      const newAnnouncementIds = activeAnnouncements
        .filter(a => !previousIds.includes(a.id))
        .map(a => a.id);

      if (newAnnouncementIds.length > 0 && announcements.length > 0) {
        setHasNewNotifications(true);

        // Start pulse animation for new announcements
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnimation, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnimation, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }

      setAnnouncements(activeAnnouncements);
      console.log(`📢 Found ${activeAnnouncements.length} active announcements`);
    });

    return () => {
      console.log('🔕 Cleaning up announcements listener');
      unsubscribe();
    };
  }, [currentUser, userProfile, announcements.length]);

  // Track current route to show notification icon on appropriate screens
  useEffect(() => {
    const checkCurrentRoute = () => {
      try {
        const navState = navigation.getState();
        if (navState && navState.routes && navState.routes.length > 0) {
          // Get the current route from the navigation state
          const currentRouteName = navState.routes[navState.index]?.name || '';
          console.log('🔍 Current route:', currentRouteName, 'Index:', navState.index);

          // Show on appropriate screens for notifications
          const isHomeScreen = currentRouteName === 'Home' || currentRouteName?.toLowerCase().includes('home');
          const isOrganizerScreen = currentRouteName === 'OrganizerHome' || currentRouteName?.toLowerCase().includes('organizer');
          const isOrganizer = userProfile?.role?.toLowerCase() === 'organizer';
          const hasPendingInvitations = invitations.length > 0;
          const hasActiveUser = !!activeUser?.email;

          // CRITICAL FIX: Show on ANY screen if user has pending invitations OR is an organizer
          // This ensures notifications always appear when there are pending invitations
          const isDashboardScreen = hasActiveUser && (
            isOrganizer ||
            hasPendingInvitations ||
            (isHomeScreen || isOrganizerScreen)
          );

          console.log('📱 Notification visibility check:', {
            currentRouteName,
            isHomeScreen,
            isOrganizerScreen,
            isOrganizer,
            hasPendingInvitations,
            hasActiveUser,
            isDashboardScreen,
            invitationsCount: invitations.length,
            announcementsCount: announcements.length,
            userRole: userProfile?.role,
            activeUserEmail: activeUser?.email
          });

          setIsOnDashboard(isDashboardScreen);
        } else {
          setIsOnDashboard(false);
        }
      } catch (error) {
        console.log('❌ Error checking current route:', error);
        // Default to NOT showing if we can't determine the route
        setIsOnDashboard(false);
      }
    };

    // Check route on mount
    checkCurrentRoute();

    // Listen for navigation state changes
    const unsubscribe = navigation.addListener('state', checkCurrentRoute);

    return unsubscribe;
  }, [navigation, userProfile?.role, invitations.length]);

  const handleAcceptInvitation = async (invitation: CollaborationInvitation) => {
    if (!activeUser) {
      Alert.alert('Authentication Required', 'Please log in to accept the invitation');
      return;
    }

    setLoading(invitation.id);
    try {
      console.log(`✅ Accepting collaboration invitation:`, {
        invitationId: invitation.id,
        wheelId: invitation.wheelId,
        roomCode: invitation.roomCode,
        invitedBy: invitation.invitedByName
      });

      // Update invitation status and add user UID
      await updateDoc(doc(db, 'liveRoomInvitations', invitation.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        invitedOrganizer: activeUser.uid, // Now we have their UID
        acceptedByName: activeUser.displayName || activeUser.email?.split('@')[0] || 'Organizer'
      });

      // Get the live session to add the collaborator
      const sessionRef = doc(db, 'liveDrawSessions', invitation.wheelId);
      const sessionDoc = await getDoc(sessionRef);

      if (sessionDoc.exists()) {
        const sessionData = sessionDoc.data();
        const currentCollaborators = sessionData.collaboratorDetails || [];

        // Add new collaborator
        const newCollaborator = {
          uid: activeUser.uid,
          email: activeUser.email,
          name: activeUser.displayName || activeUser.email?.split('@')[0] || 'Organizer',
          acceptedAt: new Date(),
          permissions: invitation.permissions,
          status: 'active',
          platform: 'mobile',
          lastActive: new Date(),
          invitationId: invitation.id,
          joinedVia: 'collaboration_invitation'
        };

        await updateDoc(sessionRef, {
          collaboratorDetails: [...currentCollaborators, newCollaborator],
          // Also update the simple collaborators array with emails
          collaborators: [...(sessionData.collaborators || []), activeUser.email],
          lastCollaboratorJoined: {
            email: activeUser.email,
            name: newCollaborator.name,
            joinedAt: new Date()
          },
          updatedAt: serverTimestamp()
        });

        console.log('✅ Added collaborator to live session:', invitation.wheelId);
      }

      // Create notification for the inviter
      const notificationData: any = {
        title: '🎉 Collaborator Joined!',
        message: `${activeUser.displayName || 'An organizer'} has accepted your collaboration invitation and joined "${invitation.wheelName}". They can now collaborate on the live session!`,
        type: 'collaboration_accepted',
        sessionId: invitation.wheelId,
        targetUserId: invitation.invitedBy,
        isActive: true,
        priority: 'high',
        createdBy: activeUser.uid,
        createdByName: activeUser.displayName || activeUser.email?.split('@')[0] || 'Organizer',
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours
        collaboratorInfo: {
          uid: activeUser.uid,
          name: activeUser.displayName || activeUser.email?.split('@')[0] || 'Organizer',
          email: activeUser.email,
          platform: 'mobile',
          joinedAt: new Date(),
          isOnline: true
        }
      };

      // Only add roomCode if it exists and is not undefined
      if (invitation.roomCode && invitation.roomCode.trim() !== '') {
        notificationData.roomCode = invitation.roomCode;
      }

      await addDoc(collection(db, 'liveSessionNotifications'), notificationData);

      // DON'T remove from local state yet - keep the invitation visible until navigation succeeds
      // This prevents the race condition where modal closes before alert appears

      // Show success message and navigate
      console.log('🎯 Showing success alert for accepted invitation');
      Alert.alert(
        '🎉 Collaboration Accepted!',
        `Successfully joined "${invitation.wheelName}". ${invitation.roomCode ? `Room Code: ${invitation.roomCode}` : ''}\n\nYou will now be directed to the live wheel as a collaborator.`,
        [
          {
            text: 'Continue',
            onPress: async () => {
              console.log('🎯 Continue button pressed, starting navigation process');

              // Close the notifications modal AFTER the alert is dismissed
              setShowList(false);

              try {
                // Update the user's role to organizer since they accepted a collaboration invitation
                console.log('🎯 Updating user role to organizer');
                if (activeUser?.uid) {
                  const userRef = doc(db, 'users', activeUser.uid);
                  await updateDoc(userRef, {
                    role: 'organizer',
                    updatedAt: serverTimestamp(),
                    lastRoleUpdate: serverTimestamp(),
                    roleUpdatedBy: 'collaboration_invitation'
                  });
                  console.log('✅ Updated user role to organizer for collaboration access');
                }

                // Try navigation immediately
                console.log('🎯 Attempting navigation to LiveRoomTab');
                (navigation as any).navigate('LiveRoomTab', {
                  screen: 'OrganizerLiveRoom',
                  params: {
                    sessionId: invitation.wheelId,
                    roomCode: invitation.roomCode,
                    acceptedInvitation: true
                  }
                });
                console.log('✅ Navigated to LiveRoomTab -> OrganizerLiveRoom with accepted invitation');

                // Only remove from local state after successful navigation
                setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));

              } catch (fallbackError) {
                console.log('LiveRoomTab navigation failed, trying HomeTab fallback:', fallbackError);
                try {
                  console.log('🎯 Trying HomeTab navigation fallback');
                  (navigation as any).navigate('HomeTab', {
                    screen: 'OrganizerLiveRoom',
                    params: {
                      sessionId: invitation.wheelId,
                      roomCode: invitation.roomCode,
                      acceptedInvitation: true
                    }
                  });
                  console.log('✅ Navigated to HomeTab -> OrganizerLiveRoom with accepted invitation');

                  // Remove from local state after successful navigation
                  setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));

                } catch (finalError) {
                  console.error('All navigation attempts failed:', finalError);

                  // On navigation failure, we should NOT remove from local state
                  // so user can try again, but also show the error
                  Alert.alert(
                    'Navigation Error',
                    'You have been successfully added as a collaborator, but there was an issue navigating to the live room. Please try again or restart the app and go to your Live Room tab.',
                    [
                      { text: 'OK' }
                    ]
                  );
                }
              }
            }
          }
        ]
      );

    } catch (error: any) {
      console.error('❌ Error accepting collaboration invitation:', error);

      let errorMessage = 'Failed to accept collaboration invitation. Please try again.';
      if (error.message?.includes('permission')) {
        errorMessage = "You don't have permission to join this collaborative session. Contact the organizer.";
      } else if (error.message?.includes('network') || error.message?.includes('timeout')) {
        errorMessage = "Network error occurred. Please check your connection and try again.";
      } else if (error.message?.includes('session not found') || error.message?.includes('not found')) {
        errorMessage = "This session is no longer available. It may have been deleted.";
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(null);
    }
  };

  const handleDeclineInvitation = async (invitationId: string, wheelName: string) => {
    setLoading(invitationId);
    try {
      await updateDoc(doc(db, 'liveRoomInvitations', invitationId), {
        status: 'declined',
        declinedAt: new Date(),
        declinedBy: activeUser?.uid,
        declinedByName: activeUser?.displayName || activeUser?.email?.split('@')[0] || 'Organizer'
      });

      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));

      Alert.alert('Collaboration Declined', `You have declined the invitation to "${wheelName}".`);
    } catch (error: any) {
      console.error('❌ Error declining collaboration invitation:', error);
      Alert.alert('Error', 'Failed to decline invitation. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  // Announcement helper functions
  const markAnnouncementAsRead = async (announcement: Announcement) => {
    if (!currentUser) return;

    try {
      const isAlreadyRead = announcement.readBy.some(reader => reader.userId === currentUser.uid);
      if (isAlreadyRead) return;

      const announcementRef = doc(db, "announcements", announcement.id);
      await updateDoc(announcementRef, {
        readBy: arrayUnion({
          userId: currentUser.uid,
          userName: userProfile?.fullName || userProfile?.email || "User",
          readAt: new Date()
        })
      });

      console.log('✅ Successfully marked announcement as read:', announcement.title);
    } catch (error: any) {
      console.error("Error marking announcement as read:", error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "info": return "information-circle";
      case "warning": return "warning";
      case "success": return "checkmark-circle";
      case "urgent": return "alert-circle";
      default: return "information-circle";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "info": return "#3b82f6";
      case "warning": return "#f59e0b";
      case "success": return "#10b981";
      case "urgent": return "#ef4444";
      default: return "#6b7280";
    }
  };

  const isAnnouncementUnread = (announcement: Announcement) => {
    return !announcement.readBy.some(reader => reader.userId === currentUser?.uid);
  };


  // Always show the notification icon, but only show badge when there are notifications
  // This ensures the icon is always visible at the top for easy access

  console.log('🔔 Rendering notification button:', {
    totalUnreadCount,
    invitationsCount: invitations.length,
    announcementsCount: announcements.length,
    isOnDashboard,
    userRole: userProfile?.role,
    activeUserEmail: activeUser?.email,
    currentRouteName: 'unknown', // Will be set in useEffect
    reason: 'NORMAL_MODE'
  });

  return (
    <>
      {/* Unified Notification Button - Only visible on OrganizerHomeScreen header */}
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => {
            console.log('🔔 Notification button pressed');
            console.log('📋 Current notifications:', {
              invitations: invitations.length,
              announcements: announcements.length,
              total: totalUnreadCount
            });
            setHasNewNotifications(false);
            setShowList(true);
            pulseAnimation.stopAnimation();
            pulseAnimation.setValue(0);
          }}
        >
          <Ionicons name="notifications" size={20} color={COLORS.surface} />
          {totalUnreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {totalUnreadCount > 9 ? "9+" : totalUnreadCount.toString()}
              </Text>
            </View>
          )}
          {hasNewNotifications && (
            <Animated.View
              style={[
                styles.pulseIndicator,
                {
                  opacity: pulseAnimation,
                  transform: [
                    {
                      scale: pulseAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.5],
                      }),
                    },
                  ],
                }
              ]}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Unified Notifications Modal */}
      <Modal
        visible={showList}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowList(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme?.surface || COLORS.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme?.text || COLORS.text }]}>
                📢 Notifications
              </Text>
              <TouchableOpacity onPress={() => setShowList(false)}>
                <Ionicons name="close" size={24} color={theme?.text || COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '70%' }}>

              {/* Collaboration Invitations */}
              {invitations.map((invitation) => (
                <View key={`invitation-${invitation.id}`} style={[styles.invitationCard, { backgroundColor: COLORS.surfaceSecondary }]}>
                  <View style={styles.invitationHeader}>
                    <View style={styles.invitationIcon}>
                      <Ionicons name="people" size={20} color={COLORS.surface} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.invitationTitle, { color: theme?.text || COLORS.text }]}>
                        🤝 {invitation.wheelName}
                      </Text>
                      <Text style={[styles.invitationSubtitle, { color: theme?.textSecondary || COLORS.textSecondary }]}>
                        Live Room Invitation • Invited by {invitation.invitedByName}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.invitationDetails}>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme?.textSecondary || COLORS.textSecondary }]}>From:</Text>
                      <Text style={[styles.detailValue, { color: theme?.text || COLORS.text }]}>{invitation.invitedByEmail}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme?.textSecondary || COLORS.textSecondary }]}>Wheel:</Text>
                      <Text style={[styles.detailValue, { color: theme?.text || COLORS.text }]}>{invitation.wheelName}</Text>
                    </View>
                    {invitation.roomCode && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme?.textSecondary || COLORS.textSecondary }]}>Room:</Text>
                        <Text style={[styles.detailValue, { color: COLORS.primary, fontWeight: 'bold' }]}>
                          {invitation.roomCode}
                        </Text>
                      </View>
                    )}
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme?.textSecondary || COLORS.textSecondary }]}>Expires:</Text>
                      <Text style={[styles.detailValue, { color: theme?.text || COLORS.text }]}>
                        {new Date(
                          invitation.expiresAt?.toDate ? invitation.expiresAt.toDate() : invitation.expiresAt
                        ).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.permissionsContainer}>
                    <Text style={[styles.permissionsTitle, { color: COLORS.success }]}>Your Permissions:</Text>
                    {invitation.permissions.canControlLive && (
                      <View style={styles.permissionItem}>
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                        <Text style={styles.permissionText}>Control live sessions</Text>
                      </View>
                    )}
                    {invitation.permissions.canEditWheel && (
                      <View style={styles.permissionItem}>
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                        <Text style={styles.permissionText}>Edit wheel settings</Text>
                      </View>
                    )}
                    {invitation.permissions.canManageParticipants && (
                      <View style={styles.permissionItem}>
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                        <Text style={styles.permissionText}>Manage participants</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.declineButton}
                      onPress={() => handleDeclineInvitation(invitation.id, invitation.wheelName)}
                      disabled={loading === invitation.id}
                    >
                      {loading === invitation.id ? (
                        <ActivityIndicator size="small" color={COLORS.surface} />
                      ) : (
                        <Text style={styles.buttonText}>Decline</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleAcceptInvitation(invitation)}
                      disabled={loading === invitation.id}
                    >
                      {loading === invitation.id ? (
                        <ActivityIndicator size="small" color={COLORS.surface} />
                      ) : (
                        <Text style={styles.buttonText}>Accept & Join</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* Announcements */}
              {announcements.map((announcement) => (
                <TouchableOpacity
                  key={`announcement-${announcement.id}`}
                  style={[
                    styles.announcementCard,
                    {
                      backgroundColor: isAnnouncementUnread(announcement) ? (theme?.primary || COLORS.primary) + '10' : (theme?.background || COLORS.surfaceSecondary),
                      borderColor: theme?.border || COLORS.border
                    }
                  ]}
                  onPress={() => {
                    markAnnouncementAsRead(announcement);
                    Alert.alert(
                      announcement.title,
                      announcement.message,
                      [
                        { text: 'Got it!', style: 'default' }
                      ]
                    );
                  }}
                >
                  <View style={styles.announcementHeader}>
                    <View style={styles.iconTitleRow}>
                      <Ionicons
                        name={getTypeIcon(announcement.type)}
                        size={20}
                        color={getTypeColor(announcement.type)}
                      />
                      <Text style={[styles.announcementTitle, { color: theme?.text || COLORS.text }]}>
                        {announcement.title}
                      </Text>
                    </View>
                    {isAnnouncementUnread(announcement) && (
                      <View style={styles.unreadDot} />
                    )}
                  </View>
                  <Text style={[styles.announcementPreview, { color: (theme?.text || COLORS.text) + '80' }]} numberOfLines={2}>
                    {announcement.message}
                  </Text>
                  <Text style={[styles.announcementMeta, { color: (theme?.text || COLORS.text) + '60' }]}>
                    By {announcement.createdByName} • {announcement.createdAt.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              ))}

              {totalUnreadCount === 0 && (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyText, { color: theme?.textSecondary || COLORS.textSecondary }]}>
                    No notifications found
                  </Text>
                  <Text style={[styles.emptyText, { color: theme?.textSecondary || COLORS.textSecondary }]}>
                    Try creating a test invitation above
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default MobileNotificationManager;
