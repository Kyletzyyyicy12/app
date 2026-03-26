import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform, Modal } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import ConfettiCannon from 'react-native-confetti-cannon';
import StudentWheel, { SelectedWheelType } from '../components/StudentWheel';
import ParticipantRequestComponent from '../components/ParticipantRequestComponent';
import CrossPlatformSessionManager, { UniversalSession } from '../utils/CrossPlatformSessionManager';
import { getThemeFromSessionConfig } from '../utils/ThemeMapper';
import type { Theme } from '../contexts/ThemeContext';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

// Modern color palette - Maroon theme to match app design
const COLORS = {
  primary: '#8e0b16',      // Maroon primary
  primaryLight: '#b8424a', // Light maroon
  primaryDark: '#66181E',  // Dark maroon
  secondary: '#66181E',    // Dark maroon secondary
  accent: '#f59e0b',       // Amber accent (kept)
  success: '#10b981',      // Emerald (kept)
  error: '#ef4444',        // Red (kept)
  warning: '#f59e0b',      // Amber (kept)
  surface: '#ffffff',      // White
  surfaceSecondary: '#f8fafc', // Light gray
  text: '#1e293b',         // Slate dark
  textSecondary: '#64748b', // Slate medium
  textLight: '#94a3b8',    // Slate light
  border: '#e2e8f0',       // Light border
  borderLight: '#f1f5f9',  // Very light border
}

// Available wheel types for participant requests
const AVAILABLE_WHEEL_TYPES = [
  {
    id: 'picker',
    name: 'Picker Wheel',
    description: 'This is a random picker wheel which will spin and make a decision for you.',
    icon: '🎯',
    color: '#FF6B6B',
    defaultSlices: ['Option 1', 'Option 2', 'Option 3', 'Option 4']
  },
  {
    id: 'team',
    name: 'Team Picker Wheel',
    description: 'This is a random team generator which will do grouping from a list of names.',
    icon: '👥',
    color: '#4ECDC4',
    defaultSlices: ['Team A', 'Team B', 'Team C', 'Team D']
  },
  {
    id: 'yesno',
    name: 'Yes No Picker Wheel',
    description: 'This is a random yes or no wheel which will help you to make a yes no decision.',
    icon: '❓',
    color: '#45B7D1',
    defaultSlices: ['Yes', 'No']
  },
  {
    id: 'number',
    name: 'Number Picker Wheel',
    description: 'This is a rng tool which will help you to pick a number randomly.',
    icon: '🔢',
    color: '#96CEB4',
    defaultSlices: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
  }
];

interface SpinResult {
  id: string;
  winners: string[];
  timestamp: any;
}

interface Comment {
  id: string;
  text: string;
  userName: string;
  timestamp: any;
}

const LiveRoomViewerScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { currentUser, userProfile } = useAuth();
  
  // Get parameters from navigation
  const params = route.params as any;
  const sessionId = params?.sessionId as string | undefined;
  const wheelName = params?.wheelName || 'Live Draw';
  
  const [spinResults, setSpinResults] = useState<SpinResult[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  // Enhanced confetti state management
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState<UniversalSession | null>(null);
  const [currentWheelType, setCurrentWheelType] = useState<SelectedWheelType | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');
  const previousWheelTypeId = useRef<string | null>(null); // Track previous wheel type ID
  
  // Enhanced theme synchronization state
  const [sessionTheme, setSessionTheme] = useState<Theme | null>(null);
  const [themeUpdateCount, setThemeUpdateCount] = useState(0);
  
  // Enhanced: Edit Wheel Items state
  const [showEditItemsModal, setShowEditItemsModal] = useState(false);
  const [editableWheelItems, setEditableWheelItems] = useState<string[]>([]);
  const [newItemText, setNewItemText] = useState('');
  
  // Use session theme if available and sync is enabled, otherwise use app theme
  const activeTheme = sessionTheme && session?.themeConfig?.syncEnabled ? sessionTheme : theme;

  useEffect(() => {
    if (!sessionId) {
        Alert.alert('Error', 'Invalid session data. Please try joining again.');
        navigation.goBack();
        return;
    }

    let viewerId: string | null = null;
    
    // Add viewer to session
    const addViewerToSession = async () => {
      try {
        if (currentUser) {
          viewerId = await CrossPlatformSessionManager.addViewer(
            sessionId, 
            userProfile?.fullName || currentUser?.email || 'Participant',
            'mobile',
            currentUser?.uid
          );
          console.log('✅ Viewer added to session:', viewerId);
        }
      } catch (error) {
        console.error('Error adding viewer to session:', error);
      }
    };
    
    // Add viewer immediately
    addViewerToSession();
    
    // Enhanced session listener with connection quality tracking
    const sessionUnsubscribe = CrossPlatformSessionManager.listenToSession(sessionId, (session) => {
        if (session) {
            setSession(session);
            setConnectionQuality('excellent');
            
            // Sync wheel items with session
            if (session.wheelItems && Array.isArray(session.wheelItems)) {
              setEditableWheelItems(session.wheelItems);
            } else if (session.selectedWheelType?.defaultItems) {
              setEditableWheelItems(session.selectedWheelType.defaultItems);
            }
            
            // Handle theme synchronization
            if (session.themeConfig && session.themeConfig.syncEnabled) {
              const newTheme = getThemeFromSessionConfig(session.themeConfig);
              if (newTheme) {
                setSessionTheme(newTheme);
                setThemeUpdateCount(prev => prev + 1);
                console.log('🎨 Applied organizer theme:', session.themeConfig.organizerTheme);
              }
            } else {
              // Reset to app theme if sync is disabled
              setSessionTheme(null);
            }
            
            // Enhanced: Handle result notifications and trigger confetti
            if (session.resultNotification && session.resultNotification.isActive && session.resultNotification.showConfetti) {
              setShowConfetti(true);
              setConfettiTrigger(prev => prev + 1);
              
              // Auto-hide confetti after 5 seconds
              setTimeout(() => {
                setShowConfetti(false);
              }, 5000);
            }
            
            if (!session.isLive) {
                setIsLive(false);
                Alert.alert('Session Ended', 'The live draw session has ended.');
            }
        } else {
            setError('Room not found');
            setIsLive(false);
            setConnectionQuality('poor');
        }
        setLoading(false);
    });

    const commentsUnsubscribe = CrossPlatformSessionManager.listenToComments(sessionId, (comments) => {
        setComments(comments.reverse());
    });

    // Cleanup function to handle participant leaving
    return () => {
      sessionUnsubscribe();
      commentsUnsubscribe();
      
      // Notify that participant is leaving
      if (viewerId && currentUser) {
        CrossPlatformSessionManager.removeViewer(
          sessionId, 
          viewerId, 
          userProfile?.fullName || currentUser?.email || 'Participant',
          'mobile'
        ).catch(error => {
          console.log('Could not broadcast participant leave:', error);
        });
      }
    };
  }, [sessionId, navigation, currentUser, userProfile]);

  const sendComment = async () => {
    if (!newComment.trim() || !currentUser || !session) return;

    try {
      await CrossPlatformSessionManager.sendComment(session.id, newComment.trim(), userProfile?.fullName || 'Participant');
      setNewComment('');
    } catch (error) {
      console.error('Error sending comment:', error);
      Alert.alert('Error', 'Failed to send comment');
    }
  };

  // Enhanced: Wheel Items Management Functions
  const addWheelItem = async () => {
    if (!newItemText.trim() || !session) return;

    try {
      const updatedItems = [...editableWheelItems, newItemText.trim()];
      setEditableWheelItems(updatedItems);
      setNewItemText('');

      // Update Firebase session
      await updateDoc(doc(db, 'liveDrawSessions', session.id), {
        wheelItems: updatedItems,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding wheel item:', error);
      Alert.alert('Error', 'Failed to add item');
    }
  };

  const removeWheelItem = async (index: number) => {
    if (!session) return;

    try {
      const updatedItems = editableWheelItems.filter((_, i) => i !== index);
      setEditableWheelItems(updatedItems);

      // Update Firebase session
      await updateDoc(doc(db, 'liveDrawSessions', session.id), {
        wheelItems: updatedItems,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error removing wheel item:', error);
      Alert.alert('Error', 'Failed to remove item');
    }
  };

  const updateWheelItem = async (index: number, newText: string) => {
    if (!session) return;

    try {
      const updatedItems = [...editableWheelItems];
      updatedItems[index] = newText;
      setEditableWheelItems(updatedItems);

      // Update Firebase session
      await updateDoc(doc(db, 'liveDrawSessions', session.id), {
        wheelItems: updatedItems,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating wheel item:', error);
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const resetWheelItems = async () => {
    if (!session || !session.selectedWheelType?.defaultItems) return;

    Alert.alert(
      'Reset Items',
      'Reset to default wheel items?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const defaultItems = session.selectedWheelType?.defaultItems || [];
              setEditableWheelItems(defaultItems);

              // Update Firebase session
              await updateDoc(doc(db, 'liveDrawSessions', session.id), {
                wheelItems: defaultItems,
                updatedAt: serverTimestamp()
              });
            } catch (error) {
              console.error('Error resetting wheel items:', error);
              Alert.alert('Error', 'Failed to reset items');
            }
          }
        }
      ]
    );
  };

  // Handle wheel type changes from organizer
  const handleWheelTypeChange = (wheelType: SelectedWheelType | null) => {
    console.log('🔄 Wheel type change received:', wheelType?.id, previousWheelTypeId.current);
    
    // Only show notification if wheel type actually changed (not on every update)
    if (wheelType && (!previousWheelTypeId.current || previousWheelTypeId.current !== wheelType.id)) {
      console.log('🔔 New wheel type detected, showing alert');
      setCurrentWheelType(wheelType);
      previousWheelTypeId.current = wheelType.id; // Update the ref
      // Show notification about wheel type change
      Alert.alert(
        '🎉 Wheel Updated!',
        `The organizer changed the wheel to: ${wheelType.title}`,
        [{ text: 'Got it!', style: 'default' }]
      );
    } else if (wheelType && previousWheelTypeId.current && previousWheelTypeId.current === wheelType.id) {
      // Wheel type is the same, no need to update or alert
      console.log('🔄 Wheel type unchanged, skipping update');
      return;
    } else if (wheelType) {
      // Just update the state without showing alert (initial load case)
      console.log('📥 Setting initial wheel type');
      setCurrentWheelType(wheelType);
      previousWheelTypeId.current = wheelType.id; // Update the ref
    } else if (previousWheelTypeId.current) {
      // Clear wheel type if none provided
      console.log('🗑️ Clearing wheel type');
      setCurrentWheelType(null);
      previousWheelTypeId.current = null; // Clear the ref
    }
  };

  const leaveRoom = () => {
    Alert.alert(
      'Leave Room',
      'Are you sure you want to leave this live draw session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: activeTheme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={activeTheme.primary} />
          <Text style={[styles.loadingText, { color: activeTheme.text }]}>Connecting to live room...</Text>
          <Text style={[styles.loadingSubText, { color: activeTheme.textSecondary }]}>
            Syncing with organizer's theme...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: activeTheme.background }]}>
      {showConfetti && (
        <ConfettiCannon
          key={confettiTrigger} // Force re-render for multiple confetti
          count={300}
          origin={{ x: -10, y: 0 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={3000}
          explosionSpeed={350}
        />
      )}

      {/* Modern Header */}
      <View style={styles.modernHeader}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={leaveRoom}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.surface} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.roomTitle}>
                {currentWheelType ? currentWheelType.title : wheelName}
              </Text>
              <Text style={styles.roomCode}>
                Room: {session?.roomCode}
              </Text>
              {currentWheelType && (
                <Text style={styles.wheelTypeInfo}>
                  {currentWheelType.icon} {currentWheelType.description}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.statusContainer}>
              <View style={[styles.liveIndicator, { backgroundColor: isLive ? COLORS.success : COLORS.error }]}>
                <Text style={styles.liveText}>{isLive ? 'LIVE' : 'ENDED'}</Text>
              </View>
              <View style={[styles.connectionIndicator, {
                backgroundColor: connectionQuality === 'excellent' ? COLORS.success :
                                 connectionQuality === 'good' ? COLORS.warning : COLORS.error
              }]}>
                <Text style={styles.connectionText}>
                  {connectionQuality === 'excellent' ? '🟢' :
                   connectionQuality === 'good' ? '🟡' : '🔴'}
                </Text>
              </View>
            </View>
            {/* Theme sync indicator */}
            {sessionTheme && session?.themeConfig?.syncEnabled && (
              <View style={styles.themeSyncIndicator}>
                <Ionicons name="color-palette" size={14} color={COLORS.primary} />
                <Text style={styles.themeSyncText}>
                  Organizer's Theme
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {session && (
          <StudentWheel 
            sessionId={session.id} 
            onWheelTypeChange={handleWheelTypeChange}
            showWheelInfo={true}
          />
        )}

        {/* Enhanced: Edit Wheel Items Button */}
        {session && currentUser && (
          <View style={styles.modernSection}>
            <TouchableOpacity
              style={[styles.editItemsButton, { backgroundColor: COLORS.primary }]}
              onPress={() => setShowEditItemsModal(true)}
            >
              <Ionicons name="create-outline" size={20} color={COLORS.surface} />
              <Text style={styles.editItemsButtonText}>
                Edit Wheel Items ({editableWheelItems.length})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Participant Request Component - Only show for authenticated participants */}
        {session && currentUser && userProfile && (
          <View style={styles.modernSection}>
            <ParticipantRequestComponent
              sessionId={session.id}
              participantId={currentUser.uid}
              participantName={userProfile.fullName || currentUser.email || 'Participant'}
              availableWheelTypes={AVAILABLE_WHEEL_TYPES}
            />
          </View>
        )}

        {/* Spin Results Section */}
        <View style={styles.modernSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Latest Results</Text>
          </View>

          {session?.winners?.length === 0 ? (
            <View style={styles.oldEmptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="hourglass-outline" size={48} color={COLORS.textLight} />
              </View>
              <Text style={styles.emptyTitle}>Waiting for results...</Text>
              <Text style={styles.emptySubtitle}>
                The wheel will show winners here when spun
              </Text>
            </View>
          ) : (
            <View style={styles.resultsContainer}>
              {session?.winners?.map((winner, index) => (
                <View
                  key={`winner-${winner.id}-${index}`}
                  style={[
                    styles.resultItem,
                    index === 0 && styles.resultItemWinner
                  ]}
                >
                  <View style={styles.resultContent}>
                    <Text style={[
                      styles.resultText,
                      index === 0 && styles.resultTextWinner
                    ]}>
                      {winner.name}
                    </Text>
                    {index === 0 && (
                      <View style={styles.winnerBadge}>
                        <Ionicons name="star" size={12} color={COLORS.surface} />
                        <Text style={styles.winnerBadgeText}>WINNER</Text>
                      </View>
                    )}
                  </View>
                  {index === 0 && (
                    <View style={styles.crownIcon}>
                      <Ionicons name="trophy" size={20} color={COLORS.accent} />
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Comments Section */}
        <View style={styles.modernSection}>
          <Text style={[styles.sectionTitle, { color: activeTheme.text }]}>
            <Ionicons name="chatbubbles" size={20} color={activeTheme.primary} /> Live Chat
          </Text>
          
          <ScrollView style={styles.commentsContainer} nestedScrollEnabled>
            {comments.map((comment, index) => (
              <View key={`comment-${comment.id}-${index}`} style={[styles.commentItem, { backgroundColor: activeTheme.background }]}>
                <Text style={[styles.commentUser, { color: activeTheme.primary }]}>{comment.userName}</Text>
                <Text style={[styles.commentText, { color: activeTheme.text }]}>{comment.text}</Text>
                <Text style={[styles.commentTime, { color: activeTheme.textSecondary }]}>
                  {comment.timestamp?.toDate().toLocaleTimeString()}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Comment Input */}
          <View style={styles.commentInputContainer}>
            <TextInput
              style={[styles.commentInput, { borderColor: activeTheme.border, color: activeTheme.text, backgroundColor: activeTheme.background }]}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Type a message..."
              placeholderTextColor={activeTheme.textSecondary}
              multiline
              maxLength={200}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: !newComment.trim() ? activeTheme.textSecondary : activeTheme.primary }
              ]}
              onPress={sendComment}
              disabled={!newComment.trim()}
            >
              <Ionicons name="send" size={20} color={activeTheme.surface} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Enhanced: Edit Wheel Items Modal */}
      <Modal
        visible={showEditItemsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditItemsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: COLORS.surface }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Ionicons name="create-outline" size={24} color={COLORS.primary} />
                <Text style={styles.modalTitle}>Edit Wheel Items</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowEditItemsModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Add New Item */}
            <View style={styles.addItemSection}>
              <Text style={styles.addItemLabel}>Add New Item</Text>
              <View style={styles.addItemRow}>
                <TextInput
                  style={styles.addItemInput}
                  value={newItemText}
                  onChangeText={setNewItemText}
                  placeholder="Enter item text..."
                  placeholderTextColor={COLORS.textSecondary}
                  onSubmitEditing={addWheelItem}
                />
                <TouchableOpacity
                  style={[
                    styles.addItemButton,
                    { backgroundColor: newItemText.trim() ? COLORS.primary : COLORS.textLight }
                  ]}
                  onPress={addWheelItem}
                  disabled={!newItemText.trim()}
                >
                  <Ionicons name="add" size={20} color={COLORS.surface} />
                </TouchableOpacity>
              </View>
              <Text style={styles.addItemHint}>
                Press Enter or tap + to add
              </Text>
            </View>

            {/* Items List */}
            <View style={styles.itemsListContainer}>
              <View style={styles.itemsListHeader}>
                <Text style={styles.itemsListTitle}>
                  Current Items ({editableWheelItems.length})
                </Text>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={resetWheelItems}
                >
                  <Ionicons name="refresh" size={16} color={COLORS.primary} />
                  <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.itemsList}>
                {editableWheelItems.map((item, index) => (
                  <View key={`item-${index}`} style={styles.itemRow}>
                    <View style={styles.itemBadge}>
                      <Text style={styles.itemBadgeText}>{index + 1}</Text>
                    </View>
                    <TextInput
                      style={styles.itemInput}
                      value={item}
                      onChangeText={(text) => updateWheelItem(index, text)}
                      placeholder={`Item ${index + 1}`}
                      placeholderTextColor={COLORS.textSecondary}
                    />
                    <TouchableOpacity
                      style={styles.removeItemButton}
                      onPress={() => removeWheelItem(index)}
                      disabled={editableWheelItems.length <= 1}
                    >
                      <Ionicons
                        name="close-circle"
                        size={24}
                        color={editableWheelItems.length <= 1 ? COLORS.textLight : COLORS.error}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Sync Info */}
            <View style={styles.syncInfo}>
              <Ionicons name="sync" size={16} color={COLORS.success} />
              <Text style={styles.syncInfoText}>
                Changes sync instantly to all participants
              </Text>
            </View>

            {/* Modal Footer */}
            <TouchableOpacity
              style={[styles.modalDoneButton, { backgroundColor: COLORS.primary }]}
              onPress={() => setShowEditItemsModal(false)}
            >
              <Text style={styles.modalDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceSecondary,
  },

  // Modern Header Styles
  modernHeader: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 0 : 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  roomTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.surface,
    marginBottom: 4,
  },
  roomCode: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '500',
  },
  wheelTypeInfo: {
    fontSize: 12,
    color: COLORS.accent,
    fontStyle: 'italic',
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'center',
    gap: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  liveText: {
    color: COLORS.surface,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  connectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionText: {
    fontSize: 12,
  },
  themeSyncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  themeSyncText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.surface,
  },

  // Modern Section Styles
  modernSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  resultsContainer: {
    gap: 12,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  resultItemWinner: {
    backgroundColor: COLORS.success + '10',
    borderColor: COLORS.success + '30',
    borderWidth: 2,
  },
  resultContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  resultTextWinner: {
    color: COLORS.success,
    fontSize: 18,
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  winnerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.surface,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  crownIcon: {
    marginLeft: 12,
  },

  // Content Styles
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  loadingSubText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  oldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  oldHeaderInfo: {
    flex: 1,
    marginLeft: 16,
  },
  oldRoomTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  oldRoomCode: {
    fontSize: 14,
    fontFamily: 'monospace',
  },
  oldWheelTypeInfo: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  oldThemeSyncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  oldThemeSyncText: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 4,
  },
  oldStatusContainer: {
    alignItems: 'center',
    gap: 4,
  },
  oldLiveIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  oldLiveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  oldConnectionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oldConnectionText: {
    fontSize: 10,
  },
  oldContent: {
    flex: 1,
    padding: 16,
  },
  oldSection: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  oldSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  oldEmptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  oldEmptyText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  oldResultsContainer: {
    gap: 12,
  },
  oldResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  oldResultContent: {
    flex: 1,
  },
  oldResultText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultTime: {
    fontSize: 12,
    marginTop: 4,
  },
  latestBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  latestBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  commentsContainer: {
    maxHeight: 200,
    marginBottom: 12,
  },
  commentItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  commentUser: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    marginBottom: 4,
  },
  commentTime: {
    fontSize: 10,
  },
  commentInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 80,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Edit Wheel Items Styles
  editItemsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  editItemsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.surface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary,
  },
  addItemSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
  },
  addItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  addItemRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addItemInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  addItemButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addItemHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  itemsListContainer: {
    flex: 1,
    marginBottom: 16,
  },
  itemsListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemsListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  itemsList: {
    maxHeight: 300,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    padding: 8,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
  },
  itemBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  itemInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  removeItemButton: {
    padding: 4,
  },
  syncInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: COLORS.success + '10',
    borderRadius: 8,
    marginBottom: 16,
  },
  syncInfoText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '500',
  },
  modalDoneButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalDoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.surface,
  },
});

export default LiveRoomViewerScreen;
