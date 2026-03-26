import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

interface SessionControlsProps {
  sessionId: string;
  isActive: boolean;
  currentState: 'waiting' | 'spinning' | 'completed';
  onToggleSession?: () => void;
  onEndSession?: () => void;
  onPauseSession?: () => void;
  onResumeSession?: () => void;
}

const SessionControls: React.FC<SessionControlsProps> = ({
  sessionId,
  isActive,
  currentState,
  onToggleSession,
  onEndSession,
  onPauseSession,
  onResumeSession
}) => {
  const handleToggleSession = () => {
    if (onToggleSession) {
      onToggleSession();
    } else {
      Alert.alert('Feature', 'Session toggle functionality coming soon!');
    }
  };

  const handlePauseResume = () => {
    if (isActive) {
      if (onPauseSession) {
        onPauseSession();
      } else {
        Alert.alert('Feature', 'Session pause functionality coming soon!');
      }
    } else {
      if (onResumeSession) {
        onResumeSession();
      } else {
        Alert.alert('Feature', 'Session resume functionality coming soon!');
      }
    }
  };

  const handleEndSession = () => {
    if (onEndSession) {
      onEndSession();
    } else {
      Alert.alert('Feature', 'Session end functionality coming soon!');
    }
  };

  // Get status information
  const getStatusInfo = () => {
    switch (currentState) {
      case 'waiting':
        return {
          text: 'Waiting for participants',
          color: COLORS.warning,
          icon: 'time-outline'
        };
      case 'spinning':
        return {
          text: 'Wheel spinning...',
          color: COLORS.accent,
          icon: 'refresh-circle'
        };
      case 'completed':
        return {
          text: 'Winner announced!',
          color: COLORS.success,
          icon: 'checkmark-circle'
        };
      default:
        return {
          text: 'Session active',
          color: COLORS.success,
          icon: 'play-circle'
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <View style={styles.container}>
      {/* Session Status */}
      <View style={styles.statusSection}>
        <View style={styles.statusHeader}>
          <Ionicons name="radio" size={20} color={COLORS.primary} />
          <Text style={styles.statusTitle}>Session Status</Text>
        </View>

        <View style={[styles.statusIndicator, { borderColor: statusInfo.color }]}>
          <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.text}
          </Text>
          <Ionicons name={statusInfo.icon as any} size={16} color={statusInfo.color} />
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsSection}>
        <View style={styles.controlsHeader}>
          <Ionicons name="settings" size={20} color={COLORS.primary} />
          <Text style={styles.controlsTitle}>Session Controls</Text>
        </View>

        <View style={styles.controlsGrid}>
          {/* Pause/Resume Session */}
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: isActive ? COLORS.warning : COLORS.success }]}
            onPress={handlePauseResume}
          >
            <Ionicons
              name={isActive ? "pause-circle" : "play-circle"}
              size={24}
              color="#ffffff"
            />
            <Text style={styles.controlButtonText}>
              {isActive ? 'Pause' : 'Resume'}
            </Text>
            <Text style={styles.controlButtonSubtext}>
              {isActive ? 'Stop accepting joins' : 'Allow participants'}
            </Text>
          </TouchableOpacity>

          {/* Toggle Session Mode */}
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: COLORS.secondary }]}
            onPress={handleToggleSession}
          >
            <Ionicons name="swap-horizontal" size={24} color="#ffffff" />
            <Text style={styles.controlButtonText}>Toggle Mode</Text>
            <Text style={styles.controlButtonSubtext}>
              Change session type
            </Text>
          </TouchableOpacity>

          {/* End Session - Destructive Action */}
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: COLORS.error }]}
            onPress={handleEndSession}
          >
            <Ionicons name="stop-circle" size={24} color="#ffffff" />
            <Text style={styles.controlButtonText}>End Session</Text>
            <Text style={styles.controlButtonSubtext}>
              Close and save
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{isActive ? 'Active' : 'Paused'}</Text>
          <Text style={styles.statLabel}>Status</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{currentState}</Text>
          <Text style={styles.statLabel}>State</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{sessionId ? sessionId.slice(-6) : 'N/A'}</Text>
          <Text style={styles.statLabel}>ID</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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

  // Status Section
  statusSection: {
    marginBottom: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: COLORS.surfaceSecondary,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },

  // Controls Section
  controlsSection: {
    marginBottom: 20,
  },
  controlsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  controlsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  controlsGrid: {
    gap: 12,
  },
  controlButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  controlButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  controlButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },

  // Stats Section
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  statItem: {
    alignItems: 'center',
    padding: 8,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    minWidth: 70,
  },
  statValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
    textTransform: 'capitalize',
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});

export default SessionControls;