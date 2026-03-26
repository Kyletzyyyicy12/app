import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CrossPlatformSessionManager from '../utils/CrossPlatformSessionManager';

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

interface SessionViewer {
  id: string;
  name: string;
  platform: 'web' | 'mobile' | 'app';
  joinedAt: any;
  lastSeen: any;
  isActive: boolean;
  connectionId: string;
  userAgent?: string;
  isGuest?: boolean;
  userId?: string;
}

interface ParticipantManagerProps {
  sessionId: string;
  viewers: SessionViewer[];
}

const ParticipantManager: React.FC<ParticipantManagerProps> = ({
  sessionId,
  viewers
}) => {
  const [activeViewers, setActiveViewers] = useState<SessionViewer[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  // Filter active viewers (seen in last 5 minutes)
  useEffect(() => {
    const currentTime = new Date().getTime();
    const recentViewers = viewers.filter(viewer => {
      const lastSeenTime = viewer.lastSeen?.toDate?.()?.getTime() || viewer.lastSeen;
      const timeDiff = currentTime - lastSeenTime;
      return timeDiff < 300000; // 5 minutes
    });
    setActiveViewers(recentViewers);
  }, [viewers]);

  // Handle kicking a participant
  const handleKickParticipant = async (viewer: SessionViewer) => {
    Alert.alert(
      'Remove Participant',
      `Are you sure you want to remove ${viewer.name} from the session?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await CrossPlatformSessionManager.removeViewer(
                sessionId,
                viewer.id,
                viewer.name,
                viewer.platform
              );
              Alert.alert('Success', `${viewer.name} has been removed from the session`);
            } catch (error) {
              console.error('Error removing participant:', error);
              Alert.alert('Error', 'Failed to remove participant');
            }
          }
        }
      ]
    );
  };

  // Format time ago
  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Just now';

    const now = new Date().getTime();
    const time = timestamp?.toDate?.()?.getTime() || timestamp;
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(time).toLocaleDateString();
  };

  // Get platform icon
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'mobile':
      case 'app':
        return '📱';
      case 'web':
        return '💻';
      default:
        return '👤';
    }
  };

  // Get connection status indicator
  const getConnectionStatus = (viewer: SessionViewer) => {
    const currentTime = new Date().getTime();
    const lastSeenTime = viewer.lastSeen?.toDate?.()?.getTime() || viewer.lastSeen;
    const timeDiff = currentTime - lastSeenTime;

    if (timeDiff < 60000) { // Less than 1 minute
      return { color: COLORS.success, status: 'Online' };
    } else if (timeDiff < 300000) { // Less than 5 minutes
      return { color: COLORS.warning, status: 'Away' };
    } else {
      return { color: COLORS.error, status: 'Offline' };
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="people" size={24} color={COLORS.primary} />
        <Text style={styles.sectionTitle}>Participants ({activeViewers.length})</Text>
        <TouchableOpacity
          style={styles.detailsToggle}
          onPress={() => setShowDetails(!showDetails)}
        >
          <Ionicons
            name={showDetails ? "chevron-up" : "chevron-down"}
            size={20}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Summary Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{activeViewers.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {activeViewers.filter(v => v.platform === 'mobile' || v.platform === 'app').length}
          </Text>
          <Text style={styles.statLabel}>Mobile</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {activeViewers.filter(v => v.platform === 'web').length}
          </Text>
          <Text style={styles.statLabel}>Web</Text>
        </View>
      </View>

      {/* Participant List */}
      {activeViewers.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>No participants yet</Text>
          <Text style={styles.emptySubtitle}>
            Share the room code to invite participants
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.participantsList} nestedScrollEnabled>
          {activeViewers.map((viewer) => {
            const connectionStatus = getConnectionStatus(viewer);

            return (
              <View key={viewer.id} style={styles.participantItem}>
                <View style={styles.participantInfo}>
                  {/* Connection Status Indicator */}
                  <View style={[styles.statusIndicator, { backgroundColor: connectionStatus.color }]} />

                  {/* Platform Icon */}
                  <Text style={styles.platformIcon}>
                    {getPlatformIcon(viewer.platform)}
                  </Text>

                  {/* Participant Details */}
                  <View style={styles.participantDetails}>
                    <Text style={styles.participantName}>
                      {viewer.name || 'Anonymous'}
                    </Text>
                    <View style={styles.participantMeta}>
                      <Text style={styles.participantStatus}>
                        {connectionStatus.status}
                      </Text>
                      <Text style={styles.participantTime}>
                        • {formatTimeAgo(viewer.lastSeen)}
                      </Text>
                      {viewer.platform && (
                        <Text style={styles.participantPlatform}>
                          • {viewer.platform}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.participantActions}>
                  {showDetails && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleKickParticipant(viewer)}
                    >
                      <Ionicons name="person-remove" size={16} color={COLORS.error} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Management Actions */}
      {showDetails && activeViewers.length > 0 && (
        <View style={styles.managementActions}>
          <TouchableOpacity
            style={styles.managementButton}
            onPress={() => {
              Alert.alert(
                'Broadcast Message',
                'Send a message to all participants?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Send',
                    onPress: () => {
                      // TODO: Implement broadcast message
                      Alert.alert('Feature', 'Broadcast message feature coming soon!');
                    }
                  }
                ]
              );
            }}
          >
            <Ionicons name="megaphone" size={20} color={COLORS.surface} />
            <Text style={styles.managementButtonText}>Broadcast Message</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    marginLeft: 12,
  },
  detailsToggle: {
    padding: 8,
  },

  // Stats Styles
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  statItem: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    minWidth: 70,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Participants List
  participantsList: {
    maxHeight: 300,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  platformIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  participantDetails: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  participantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  participantStatus: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  participantTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  participantPlatform: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  participantActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Management Actions
  managementActions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  managementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  managementButtonText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ParticipantManager;