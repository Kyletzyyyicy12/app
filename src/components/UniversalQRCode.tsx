import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Share, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../contexts/ThemeContext';
import CrossPlatformSessionManager from '../utils/CrossPlatformSessionManager';

interface UniversalQRCodeProps {
  roomCode: string;
  sessionId?: string;
  wheelName?: string;
  size?: number;
  showActions?: boolean;
  onShare?: () => void;
}

const UniversalQRCode: React.FC<UniversalQRCodeProps> = ({
  roomCode,
  sessionId,
  wheelName = 'Live Draw',
  size = 200,
  showActions = true,
  onShare
}) => {
  const { theme } = useTheme();
  const [qrValue, setQrValue] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [appUrl, setAppUrl] = useState('');

  useEffect(() => {
    generateUniversalQRCode();
  }, [roomCode]);

  const generateUniversalQRCode = () => {
    // Generate universal QR code that works for both web and mobile
    const universalQRValue = CrossPlatformSessionManager.generateUniversalQRCode(roomCode);
    setQrValue(universalQRValue);

    // Set individual URLs for sharing
    const baseUrl = 'https://cobypicks.com'; // Your web app URL
    const webLink = `${baseUrl}/join?code=${roomCode}`;
    const appLink = `cobypicks://join?code=${roomCode}`;
    
    setWebUrl(webLink);
    setAppUrl(appLink);
  };

  const handleShare = async () => {
    try {
      const shareContent = {
        title: `Join "${wheelName}" Live Draw`,
        message: `Join the live draw session "${wheelName}" using code: ${roomCode}\n\nWeb: ${webUrl}\nApp: ${appUrl}`,
        url: webUrl,
      };

      await Share.share(shareContent);
      onShare?.();
    } catch (error) {
      console.error('Error sharing QR code:', error);
      Alert.alert('Error', 'Failed to share the QR code');
    }
  };

  const handleCopyCode = () => {
    // For React Native, we'll show an alert with the code
    Alert.alert(
      'Room Code',
      `Code: ${roomCode}\n\nShare this code with participants to join the live draw.`,
      [
        { text: 'OK', style: 'default' }
      ]
    );
  };

  const handleCopyWebLink = () => {
    Alert.alert(
      'Web Link',
      `Web URL: ${webUrl}\n\nParticipants can use this link to join from any web browser.`,
      [
        { text: 'OK', style: 'default' }
      ]
    );
  };

  const handleCopyAppLink = () => {
    Alert.alert(
      'App Link',
      `App URL: ${appUrl}\n\nParticipants with the mobile app can use this link for direct access.`,
      [
        { text: 'OK', style: 'default' }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* QR Code */}
      <View style={[styles.qrContainer, { backgroundColor: theme.background }]}>
        <QRCode
          value={qrValue}
          size={size}
          color={theme.text}
          backgroundColor={theme.background}
          logo={require('../../assets/icon.png')} // Your app icon
          logoSize={size * 0.15}
          logoBackgroundColor={theme.background}
          logoMargin={2}
          logoBorderRadius={8}
        />
      </View>

      {/* Room Code Display */}
      <View style={styles.codeSection}>
        <Text style={[styles.codeLabel, { color: theme.textSecondary }]}>
          Room Code
        </Text>
        <TouchableOpacity 
          style={[styles.codeContainer, { backgroundColor: theme.primary + '20' }]}
          onPress={handleCopyCode}
        >
          <Text style={[styles.codeText, { color: theme.primary }]}>
            {roomCode}
          </Text>
          <Ionicons name="copy-outline" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsSection}>
        <Text style={[styles.instructionsTitle, { color: theme.text }]}>
          How to Join
        </Text>
        <Text style={[styles.instructionsText, { color: theme.textSecondary }]}>
          • Scan the QR code with your camera or QR code app{'\n'}
          • Enter the room code: {roomCode}{'\n'}
          • Use the web link or mobile app link below
        </Text>
      </View>

      {/* Action Buttons */}
      {showActions && (
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.primary }]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={20} color={theme.surface} />
            <Text style={[styles.actionButtonText, { color: theme.surface }]}>
              Share All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.secondary }]}
            onPress={handleCopyWebLink}
          >
            <Ionicons name="globe-outline" size={20} color={theme.surface} />
            <Text style={[styles.actionButtonText, { color: theme.surface }]}>
              Web Link
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.accent }]}
            onPress={handleCopyAppLink}
          >
            <Ionicons name="phone-portrait-outline" size={20} color={theme.surface} />
            <Text style={[styles.actionButtonText, { color: theme.surface }]}>
              App Link
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Platform Compatibility Info */}
      <View style={styles.compatibilitySection}>
        <Text style={[styles.compatibilityTitle, { color: theme.text }]}>
          Cross-Platform Compatible
        </Text>
        <View style={styles.platformIcons}>
          <View style={styles.platformItem}>
            <Ionicons name="globe-outline" size={24} color={theme.primary} />
            <Text style={[styles.platformText, { color: theme.textSecondary }]}>Web</Text>
          </View>
          <View style={styles.platformItem}>
            <Ionicons name="phone-portrait-outline" size={24} color={theme.primary} />
            <Text style={[styles.platformText, { color: theme.textSecondary }]}>Mobile</Text>
          </View>
          <View style={styles.platformItem}>
            <Ionicons name="desktop-outline" size={24} color={theme.primary} />
            <Text style={[styles.platformText, { color: theme.textSecondary }]}>Desktop</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    margin: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  qrContainer: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  codeSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  codeLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  codeText: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  instructionsSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  compatibilitySection: {
    alignItems: 'center',
  },
  compatibilityTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  platformIcons: {
    flexDirection: 'row',
    gap: 24,
  },
  platformItem: {
    alignItems: 'center',
    gap: 4,
  },
  platformText: {
    fontSize: 12,
  },
});

export default UniversalQRCode;
