import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export interface AutoSpinConfig {
  enabled: boolean;
  interval: number; // seconds between spins
  maxSpins: number; // maximum number of auto-spins
  autoReset: boolean; // reset winners after each spin
  pauseOnWinner: boolean; // pause when winner is selected
  spinDuration: number; // how long each spin lasts
  showWinnerDelay: number; // how long to show winner before next spin
  stopConditions: {
    maxDuration: number; // max total duration in minutes
    onEmpty: boolean; // stop when no more participants
    onManual: boolean; // allow manual stop
  };
}

export interface AutoSpinState {
  isRunning: boolean;
  currentSpinCount: number;
  startTime: number;
  elapsedTime: number;
  remainingParticipants: number;
}

interface AutoSpinSettingsProps {
  config: AutoSpinConfig;
  onConfigChange: (config: AutoSpinConfig) => void;
  autoSpinState: AutoSpinState;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onReset: () => void;
  totalParticipants: number;
  visible: boolean;
  onClose: () => void;
}

const AutoSpinSettings: React.FC<AutoSpinSettingsProps> = ({
  config,
  onConfigChange,
  autoSpinState,
  onStart,
  onPause,
  onStop,
  onReset,
  totalParticipants,
  visible,
  onClose,
}) => {
  const { theme } = useTheme();
  const [localConfig, setLocalConfig] = useState<AutoSpinConfig>(config);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const updateConfig = (updates: Partial<AutoSpinConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const updateStopConditions = (updates: Partial<AutoSpinConfig['stopConditions']>) => {
    updateConfig({
      stopConditions: { ...localConfig.stopConditions, ...updates }
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    if (localConfig.maxSpins === 0) return 0;
    return (autoSpinState.currentSpinCount / localConfig.maxSpins) * 100;
  };

  const getRemainingTime = () => {
    if (localConfig.maxSpins === 0) return 0;
    const remainingSpins = localConfig.maxSpins - autoSpinState.currentSpinCount;
    const timePerSpin = localConfig.interval + localConfig.spinDuration + localConfig.showWinnerDelay;
    return remainingSpins * timePerSpin;
  };

  const canStart = () => {
    return !autoSpinState.isRunning && totalParticipants > 0 && localConfig.maxSpins > 0;
  };

  const intervalOptions = [
    { label: '3 seconds', value: 3 },
    { label: '5 seconds', value: 5 },
    { label: '10 seconds', value: 10 },
    { label: '15 seconds', value: 15 },
    { label: '30 seconds', value: 30 },
    { label: '60 seconds', value: 60 },
  ];

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      margin: 20,
      maxHeight: '90%',
      width: '90%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
    },
    closeButton: {
      padding: 4,
    },
    content: {
      flex: 1,
    },
    scrollView: {
      padding: 20,
    },
    statusCard: {
      backgroundColor: autoSpinState.isRunning ? '#dcfce7' : theme.background,
      borderWidth: 2,
      borderColor: autoSpinState.isRunning ? '#16a34a' : theme.border,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    statusHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    statusInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    statusIcon: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: autoSpinState.isRunning ? '#bbf7d0' : '#f3f4f6',
    },
    statusText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    statusSubtext: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    statusBadges: {
      flexDirection: 'row',
      gap: 8,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: theme.primary + '20',
    },
    badgeText: {
      fontSize: 10,
      color: theme.primary,
      fontWeight: '600',
    },
    progressContainer: {
      marginTop: 12,
    },
    progressBar: {
      height: 6,
      backgroundColor: '#e5e7eb',
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
    },
    progressText: {
      fontSize: 11,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 4,
    },
    controlButtons: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 20,
    },
    controlButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 8,
      gap: 6,
    },
    primaryButton: {
      backgroundColor: theme.primary,
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.border,
    },
    disabledButton: {
      backgroundColor: '#f3f4f6',
      borderColor: '#e5e7eb',
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    primaryButtonText: {
      color: theme.surface,
    },
    secondaryButtonText: {
      color: theme.text,
    },
    disabledButtonText: {
      color: '#9ca3af',
    },
    settingsCard: {
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    settingsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    settingsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    settingLabel: {
      fontSize: 14,
      color: theme.text,
    },
    settingValue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    textInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: theme.text,
      backgroundColor: theme.surface,
      minWidth: 80,
      textAlign: 'center',
    },
    intervalSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    intervalOption: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    selectedInterval: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    intervalText: {
      fontSize: 12,
      color: theme.text,
    },
    selectedIntervalText: {
      color: theme.surface,
    },
    estimationCard: {
      backgroundColor: '#eff6ff',
      borderWidth: 1,
      borderColor: '#bfdbfe',
      borderRadius: 12,
      padding: 12,
      marginTop: 16,
    },
    estimationTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#1e40af',
      marginBottom: 8,
    },
    estimationText: {
      fontSize: 12,
      color: '#1e40af',
      lineHeight: 18,
    },
  });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="time" size={20} color={theme.primary} />
              <Text style={styles.title}>Auto-Spin Control</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {/* Status Card */}
              <View style={styles.statusCard}>
                <View style={styles.statusHeader}>
                  <View style={styles.statusInfo}>
                    <View style={styles.statusIcon}>
                      <Ionicons
                        name={autoSpinState.isRunning ? "play" : "pause"}
                        size={16}
                        color={autoSpinState.isRunning ? "#16a34a" : "#6b7280"}
                      />
                    </View>
                    <View>
                      <Text style={styles.statusText}>
                        {autoSpinState.isRunning ? 'Auto-Spinning Active' : 'Auto-Spin Ready'}
                      </Text>
                      <Text style={styles.statusSubtext}>
                        {autoSpinState.currentSpinCount}/{localConfig.maxSpins} spins • {formatTime(autoSpinState.elapsedTime)} elapsed
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statusBadges}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {autoSpinState.isRunning ? 'Running' : 'Stopped'}
                      </Text>
                    </View>
                    {localConfig.enabled && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{localConfig.interval}s interval</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Progress Bar */}
                {localConfig.maxSpins > 0 && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${getProgress()}%` }
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      Progress: {autoSpinState.currentSpinCount} of {localConfig.maxSpins} spins
                    </Text>
                  </View>
                )}
              </View>

              {/* Control Buttons */}
              <View style={styles.controlButtons}>
                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    canStart() ? styles.primaryButton : styles.disabledButton
                  ]}
                  onPress={onStart}
                  disabled={!canStart()}
                >
                  <Ionicons
                    name="play"
                    size={16}
                    color={canStart() ? theme.surface : '#9ca3af'}
                  />
                  <Text
                    style={[
                      styles.buttonText,
                      canStart() ? styles.primaryButtonText : styles.disabledButtonText
                    ]}
                  >
                    Start
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    autoSpinState.isRunning ? styles.secondaryButton : styles.disabledButton
                  ]}
                  onPress={onPause}
                  disabled={!autoSpinState.isRunning}
                >
                  <Ionicons
                    name="pause"
                    size={16}
                    color={autoSpinState.isRunning ? theme.text : '#9ca3af'}
                  />
                  <Text
                    style={[
                      styles.buttonText,
                      autoSpinState.isRunning ? styles.secondaryButtonText : styles.disabledButtonText
                    ]}
                  >
                    Pause
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    autoSpinState.isRunning ? styles.secondaryButton : styles.disabledButton
                  ]}
                  onPress={onStop}
                  disabled={!autoSpinState.isRunning}
                >
                  <Ionicons
                    name="stop"
                    size={16}
                    color={autoSpinState.isRunning ? theme.text : '#9ca3af'}
                  />
                  <Text
                    style={[
                      styles.buttonText,
                      autoSpinState.isRunning ? styles.secondaryButtonText : styles.disabledButtonText
                    ]}
                  >
                    Stop
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.controlButton, styles.secondaryButton]}
                  onPress={onReset}
                >
                  <Ionicons name="refresh" size={16} color={theme.text} />
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>Reset</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Settings */}
              <View style={styles.settingsCard}>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Enable Auto-Spin</Text>
                  <Switch
                    value={localConfig.enabled}
                    onValueChange={(enabled) => updateConfig({ enabled })}
                    trackColor={{ false: '#767577', true: theme.primary + '80' }}
                    thumbColor={localConfig.enabled ? theme.primary : '#f4f3f4'}
                  />
                </View>

                {localConfig.enabled && (
                  <>
                    <View style={styles.settingRow}>
                      <Text style={styles.settingLabel}>Max Spins</Text>
                      <TextInput
                        style={styles.textInput}
                        value={localConfig.maxSpins.toString()}
                        onChangeText={(text) => {
                          const num = parseInt(text) || 1;
                          updateConfig({ maxSpins: Math.max(1, Math.min(100, num)) });
                        }}
                        keyboardType="numeric"
                        maxLength={3}
                      />
                    </View>

                    <View>
                      <Text style={styles.settingLabel}>Interval Between Spins</Text>
                      <View style={styles.intervalSelector}>
                        {intervalOptions.map((option) => (
                          <TouchableOpacity
                            key={option.value}
                            style={[
                              styles.intervalOption,
                              localConfig.interval === option.value && styles.selectedInterval
                            ]}
                            onPress={() => updateConfig({ interval: option.value })}
                          >
                            <Text
                              style={[
                                styles.intervalText,
                                localConfig.interval === option.value && styles.selectedIntervalText
                              ]}
                            >
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={styles.settingRow}>
                      <Text style={styles.settingLabel}>Auto-reset after each spin</Text>
                      <Switch
                        value={localConfig.autoReset}
                        onValueChange={(autoReset) => updateConfig({ autoReset })}
                        trackColor={{ false: '#767577', true: theme.primary + '80' }}
                        thumbColor={localConfig.autoReset ? theme.primary : '#f4f3f4'}
                      />
                    </View>

                    <View style={styles.settingRow}>
                      <Text style={styles.settingLabel}>Pause on winner selection</Text>
                      <Switch
                        value={localConfig.pauseOnWinner}
                        onValueChange={(pauseOnWinner) => updateConfig({ pauseOnWinner })}
                        trackColor={{ false: '#767577', true: theme.primary + '80' }}
                        thumbColor={localConfig.pauseOnWinner ? theme.primary : '#f4f3f4'}
                      />
                    </View>

                    {/* Estimation Card */}
                    <View style={styles.estimationCard}>
                      <Text style={styles.estimationTitle}>Estimated Duration</Text>
                      <Text style={styles.estimationText}>
                        • Time per spin: ~{localConfig.interval + localConfig.spinDuration + localConfig.showWinnerDelay}s{'\n'}
                        • Total estimated time: ~{formatTime(getRemainingTime())}{'\n'}
                        • Remaining: {getRemainingTime() > 0 ? formatTime(getRemainingTime()) : 'Not started'}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default AutoSpinSettings;