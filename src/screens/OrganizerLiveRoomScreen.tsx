import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  Modal,
  ActivityIndicator,
  Platform,
  Clipboard,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import ConfettiCannon from 'react-native-confetti-cannon';
import CrossPlatformSessionManager, { UniversalSession } from '../utils/CrossPlatformSessionManager';
import { db } from '../config/firebaseConfig';
import { doc, onSnapshot, addDoc, serverTimestamp, collection, updateDoc, getDoc, query, where, orderBy, getDocs, arrayUnion } from 'firebase/firestore';
import OrganizerWheel from '../components/OrganizerWheel';
import TeamPickerScreen from './TeamPickerScreen';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
// import ParticipantManager from '../components/ParticipantManager';
// import WheelCustomizer from '../components/WheelCustomizer';

// Device detection helpers for enhanced responsiveness
const getDeviceDimensions = () => {
  const { width, height } = Dimensions.get('window');
  const isLandscape = width > height;
  const aspectRatio = width / height;

  return {
    width,
    height,
    isLandscape,
    aspectRatio,
    // Device size categories
    isSmall: width < 375,
    isMedium: width >= 375 && width < 768,
    isLarge: width >= 768 && width < 1024,
    isExtraLarge: width >= 1024,
    // Orientation-aware scaling
    scaleFactor: Math.min(width / 375, height / 667), // Base scaling
  };
};

// Enhanced responsive sizing functions
const getResponsiveFontSize = (baseSize: number) => {
  const dimensions = getDeviceDimensions();
  let size = baseSize * dimensions.scaleFactor;

  // Additional adjustments for very small devices
  if (dimensions.isSmall && dimensions.isLandscape) {
    size *= 0.9; // Reduce in landscape small phones
  } else if (dimensions.isExtraLarge && dimensions.isLandscape) {
    size *= 1.1; // Increase in large landscape tablets
  }

  return Math.max(size, 10); // Minimum font size
};

const getResponsiveSpacing = (baseSpacing: number) => {
  const dimensions = getDeviceDimensions();
  let spacing = baseSpacing * dimensions.scaleFactor;

  // Adjust spacing for different sizes
  if (dimensions.isSmall) {
    spacing = Math.max(spacing * 0.8, 4); // Reduce minimum spacing on small screens
  } else if (dimensions.isExtraLarge) {
    spacing = Math.min(spacing * 1.2, 32); // Increase spacing on very large screens
  }

  return spacing;
};

// Modern color palette - Maroon theme to match app design
const COLORS = {
  primary: '#8e0b16',      // Maroon primary
  primaryLight: '#b8424a', // Light maroon
  primaryDark: '#66181E',  // Dark maroon
  secondary: '#66181E',    // Dark maroon secondary
  accent: '#f59e0b',       // Amber accent
  success: '#10b981',      // Emerald
  error: '#ef4444',        // Red
  warning: '#f59e0b',      // Amber
  surface: '#ffffff',      // White
  surfaceSecondary: '#f8fafc', // Light gray
  text: '#1e293b',         // Slate dark
  textSecondary: '#64748b', // Slate medium
  textLight: '#94a3b8',    // Slate light
  border: '#e2e8f0',       // Light border
  borderLight: '#f1f5f9',  // Very light border
};

// Available themes for wheel customization - School colors based on web version
const WHEEL_THEMES = [
  { id: 'school', name: 'School Colors', colors: ['#8e0b16', '#66181E'], primaryColor: '#8e0b16' },
  { id: 'rainbow-bright', name: 'Rainbow Bright', colors: ['#dc2626', '#ea580c', '#f59e0b', '#22c55e', '#3b82f6', '#7c3aed'], primaryColor: '#dc2626' },
  { id: 'neon-electric', name: 'Neon Electric', colors: ['#00ff00', '#00ffff', '#ff00ff', '#ffff00', '#ff0080', '#8000ff'], primaryColor: '#00ff00' },
  { id: 'ocean-depths', name: 'Ocean Depths', colors: ['#1e40af', '#3b82f6', '#06b6d4', '#0891b2', '#0e7490', '#164e63'], primaryColor: '#1e40af' },
  { id: 'sunset-blaze', name: 'Sunset Blaze', colors: ['#dc2626', '#ea580c', '#f59e0b', '#f97316', '#fb923c', '#fdba74'], primaryColor: '#dc2626' },
  { id: 'purple-galaxy', name: 'Purple Galaxy', colors: ['#7c3aed', '#a855f7', '#c084fc', '#d946ef', '#e879f9', '#f0abfc'], primaryColor: '#7c3aed' },
  { id: 'emerald-forest', name: 'Emerald Forest', colors: ['#166534', '#16a34a', '#22c55e', '#4ade80', '#84cc16', '#a3e635'], primaryColor: '#166534' },
  { id: 'hot-pink', name: 'Hot Pink', colors: ['#be185d', '#ec4899', '#f472b6', '#fb7185', '#fca5a5', '#fecdd3'], primaryColor: '#be185d' },
  { id: 'golden-luxury', name: 'Golden Luxury', colors: ['#d97706', '#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#fef3c7'], primaryColor: '#d97706' },
  { id: 'cyber-blue', name: 'Cyber Blue', colors: ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe', '#eff6ff'], primaryColor: '#1e40af' },
  { id: 'fire-ice', name: 'Fire & Ice', colors: ['#dc2626', '#ef4444', '#06b6d4', '#0891b2', '#f59e0b', '#fbbf24'], primaryColor: '#dc2626' },
  { id: 'lime-splash', name: 'Lime Splash', colors: ['#65a30d', '#84cc16', '#a3e635', '#bef264', '#d9f99d', '#ecfccb'], primaryColor: '#65a30d' },
  { id: 'midnight-dark', name: 'Midnight Dark', colors: ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'], primaryColor: '#1e293b' },
  { id: 'cotton-candy', name: 'Cotton Candy', colors: ['#ec4899', '#f472b6', '#a855f7', '#c084fc', '#e879f9', '#f0abfc'], primaryColor: '#ec4899' },
  { id: 'volcanic-orange', name: 'Volcanic Orange', colors: ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'], primaryColor: '#ea580c' },
  { id: 'arctic-frost', name: 'Arctic Frost', colors: ['#06b6d4', '#0891b2', '#0e7490', '#22d3ee', '#67e8f9', '#a5f3fc'], primaryColor: '#06b6d4' },
  { id: 'tropical-sunset', name: 'Tropical Sunset', colors: ['#ea580c', '#f97316', '#22c55e', '#84cc16', '#3b82f6', '#7c3aed'], primaryColor: '#ea580c' },
  { id: 'royal-crown', name: 'Royal Crown', colors: ['#7c3aed', '#a855f7', '#d97706', '#f59e0b', '#dc2626', '#be185d'], primaryColor: '#7c3aed' },
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

// Wheel types configuration (matching web app structure)
const AVAILABLE_WHEEL_TYPES: any[] = [
  {
    id: "image-picker-wheel",
    name: "Image Picker Wheel",
    label: "Image Picker Wheel",
    value: "image-picker",
    icon: "🖼️",
    category: "personal",
    color: "#8e0b16",
    isCustomizable: true,
    enabled: true,
    allowedRoles: ["organizer", "admin", "teacher"],
    defaultItems: ["Image 1", "Image 2", "Image 3", "Image 4", "Image 5"],
    description: "A wheel that displays images instead of text",
    supportsImages: true // Image picker wheel supports images
  },
  {
    id: "team-picker-wheel",
    name: "Team Picker Wheel",
    label: "Team Picker Wheel",
    value: "team-picker",
    icon: "👥",
    category: "personal",
    color: "#8e0b16",
    isCustomizable: true,
    enabled: true,
    allowedRoles: ["organizer", "admin", "teacher"],
    defaultItems: ["Team 1", "Team 2", "Team 3", "Team 4"],
    description: "A wheel for organizing teams",
    supportsImages: false
  },
  {
    id: "research-participant-wheel",
    name: "Research Participant Selection",
    label: "📊 Research Participant Selection",
    value: "research-participant",
    icon: "📊",
    category: "educational",
    color: "#8e0b16",
    isCustomizable: true,
    enabled: true,
    allowedRoles: ["organizer", "admin", "teacher", "researcher"],
    defaultItems: ["Download our template, add your student list, then use the Random Selection controls in the Session Info panel"],
    description: "Research Participant Selection - Download CSV template, upload student list (up to 50), use random selection controls",
    supportsImages: false,
    features: {
      csvTemplate: true,
      randomSelection: true,
      studentUpload: true,
      maxStudents: 50,
      displayFormat: "X of 50 (Y%)"
    }
  }
];

// Research Participant Selection UI Component
const ResearchParticipantSelectionUI = ({ 
  uploadedStudents = 0, 
  selectedCount = 0,
  onDownloadTemplate,
  onUploadFile,
  onSelectCountChange 
}: any) => {
  const percentage = uploadedStudents > 0 ? Math.round((selectedCount / uploadedStudents) * 100) : 0;

  return (
    <View style={{ padding: 16, backgroundColor: COLORS.surfaceSecondary, borderRadius: 12 }}>
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 8 }}>📊 Research Participant Selection</Text>
        <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 12 }}>Download our template, add your student list, then use the Random Selection controls in the Session Info panel.</Text>
        
        <TouchableOpacity 
          onPress={onDownloadTemplate}
          style={{ 
            backgroundColor: COLORS.primary, 
            padding: 12, 
            borderRadius: 8, 
            alignItems: 'center',
            marginBottom: 12
          }}
        >
          <Text style={{ color: COLORS.surface, fontWeight: '600', fontSize: 14 }}>Download Research Template (CSV)</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={onUploadFile}
          style={{ 
            backgroundColor: COLORS.secondary, 
            padding: 12, 
            borderRadius: 8, 
            alignItems: 'center',
            borderWidth: 1,
            borderColor: COLORS.primary
          }}
        >
          <Text style={{ color: COLORS.surface, fontWeight: '600', fontSize: 14 }}>Upload Student List (CSV)</Text>
        </TouchableOpacity>
      </View>

      {uploadedStudents > 0 && (
        <View style={{ backgroundColor: COLORS.surface, padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: COLORS.primary }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 12 }}>📊 Random Selection</Text>
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 }}>{uploadedStudents} students uploaded</Text>
          
          <Text style={{ fontSize: 13, color: COLORS.text, marginBottom: 12, fontWeight: '500' }}>Select how many students to pick:</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <TextInput
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                fontSize: 14,
                color: COLORS.text,
                marginRight: 8
              }}
              keyboardType="numeric"
              placeholder="0"
              value={selectedCount.toString()}
              onChangeText={(text) => onSelectCountChange(Math.min(parseInt(text) || 0, uploadedStudents))}
              maxLength={String(uploadedStudents).length}
            />
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' }}>/ {uploadedStudents}</Text>
          </View>
          
          <View style={{ backgroundColor: COLORS.surfaceSecondary, padding: 12, borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.primary }}>
              {selectedCount} of {uploadedStudents} ({percentage}%)
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

// Safety check to ensure AVAILABLE_WHEEL_TYPES is always available
const getSafeWheelType = () => {
  if (AVAILABLE_WHEEL_TYPES && AVAILABLE_WHEEL_TYPES.length > 0) {
    return AVAILABLE_WHEEL_TYPES[0];
  }
  // Ultimate fallback
  return {
    id: "fallback-wheel",
    name: "Fallback Wheel",
    label: "Fallback Wheel",
    value: "fallback",
    icon: "🎯",
    category: "personal",
    color: "#8e0b16",
    isCustomizable: true,
    enabled: true,
    allowedRoles: ["organizer", "admin", "teacher"],
    defaultItems: ["Team Alpha", "Team Beta", "Team Gamma", "Team Delta"],
    description: "Fallback wheel type"
  };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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

  // Header Styles
  header: {
    paddingTop: Platform.OS === 'ios' ? 0 : 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Dimensions.get('window').width * 0.05, // Responsive horizontal padding
    paddingVertical: 24, // Increased padding to move text down from top
    paddingTop: 32, // Additional top padding for more space
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
    fontSize: Dimensions.get('window').width * 0.05, // Responsive font size (5% of screen width)
    fontWeight: '700',
    color: COLORS.surface,
    marginBottom: 4,
  },
  roomCode: {
    fontSize: Dimensions.get('window').width * 0.035, // Responsive font size
    color: 'rgba(255,255,255,0.8)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  liveIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveText: {
    color: COLORS.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  connectionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Content Styles - Made super responsive
   content: {
    flex: 1,
    paddingHorizontal: Dimensions.get('window').width * 0.05, // 5% of screen width
    paddingVertical: Dimensions.get('window').height * 0.025, // Responsive vertical padding
    maxWidth: 600, // Limit max width for larger screens
    alignSelf: 'center',
    width: '100%',
  },
   scrollView: {
    flex: 1,
    width: '100%',
  },
   scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Dimensions.get('window').width * 0.05, // 5% of screen width
    paddingVertical: Dimensions.get('window').height * 0.025, // Responsive vertical padding
    paddingBottom: Dimensions.get('window').height * 0.12, // Responsive bottom padding for better scrolling
    maxWidth: 600, // Limit max width for larger screens
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: Dimensions.get('window').width * 0.05, // Responsive horizontal padding
    paddingVertical: 20,
    marginBottom: Dimensions.get('window').height * 0.02, // Responsive bottom margin
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: 600, // Limit max width for larger screens
    alignSelf: 'center',
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: Dimensions.get('window').width * 0.045, // Responsive font size
    fontWeight: '700',
    color: COLORS.text,
  },

  // Stats Styles
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    minWidth: 80,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Participants Styles
  participantsSection: {
    backgroundColor: COLORS.surface,
    borderRadius: Dimensions.get('window').width * 0.03, // Responsive border radius
    paddingHorizontal: Dimensions.get('window').width * 0.04, // Responsive horizontal padding
    paddingVertical: Dimensions.get('window').height * 0.02, // Responsive vertical padding
    marginBottom: Dimensions.get('window').height * 0.02, // Responsive margin
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  participantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Dimensions.get('window').height * 0.015, // Responsive margin
    gap: Dimensions.get('window').width * 0.02, // Responsive gap
  },
  participantsTitle: {
    fontSize: Dimensions.get('window').width * 0.04, // Responsive font size
    fontWeight: '600',
    color: COLORS.text,
    flex: 1, // Allow title to take available space
  },
  participantsScroll: {
    maxHeight: Dimensions.get('window').height * 0.12, // Increased max height for better visibility
  },
  participantItem: {
    alignItems: 'center',
    marginRight: Dimensions.get('window').width * 0.03, // Responsive margin
    minWidth: Dimensions.get('window').width * 0.18, // Responsive min width (increased for better touch targets)
    maxWidth: Dimensions.get('window').width * 0.22, // Max width to prevent overflow
  },
  participantAvatar: {
    width: Dimensions.get('window').width * 0.12, // Responsive width (increased for better visibility)
    height: Dimensions.get('window').width * 0.12, // Responsive height
    borderRadius: Dimensions.get('window').width * 0.06, // Responsive border radius
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Dimensions.get('window').height * 0.008, // Responsive margin
  },
  participantInitial: {
    color: COLORS.surface,
    fontSize: Dimensions.get('window').width * 0.035, // Responsive font size
    fontWeight: 'bold',
  },
  participantName: {
    fontSize: Dimensions.get('window').width * 0.028, // Responsive font size
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: Dimensions.get('window').width * 0.2, // Max width for text
  },
  noParticipantsText: {
    fontSize: Dimensions.get('window').width * 0.035, // Responsive font size
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Dimensions.get('window').height * 0.015, // Responsive padding
    textAlign: 'center',
  },

  // Comments Styles
  liveCommentsSection: {
    backgroundColor: COLORS.surface,
    borderRadius: Dimensions.get('window').width * 0.03, // Responsive border radius
    paddingHorizontal: Dimensions.get('window').width * 0.04, // Responsive horizontal padding
    paddingVertical: Dimensions.get('window').height * 0.02, // Responsive vertical padding
    marginTop: Dimensions.get('window').height * 0.02, // Responsive margin
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Dimensions.get('window').height * 0.015, // Responsive margin
    gap: Dimensions.get('window').width * 0.02, // Responsive gap
  },
  commentsTitle: {
    fontSize: Dimensions.get('window').width * 0.04, // Responsive font size
    fontWeight: '600',
    color: COLORS.text,
    flex: 1, // Allow title to take available space
  },
  commentsContainer: {
    maxHeight: Dimensions.get('window').height * 0.2, // Responsive max height (20% of screen height)
    marginBottom: Dimensions.get('window').height * 0.015, // Responsive margin
  },
  commentItem: {
    paddingHorizontal: Dimensions.get('window').width * 0.03, // Responsive horizontal padding
    paddingVertical: Dimensions.get('window').height * 0.015, // Responsive vertical padding
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: Dimensions.get('window').width * 0.02, // Responsive border radius
    marginBottom: Dimensions.get('window').height * 0.01, // Responsive margin
  },
  commentUser: {
    fontSize: Dimensions.get('window').width * 0.032, // Responsive font size
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: Dimensions.get('window').height * 0.005, // Responsive margin
  },
  commentText: {
    fontSize: Dimensions.get('window').width * 0.035, // Responsive font size
    color: COLORS.text,
    marginBottom: Dimensions.get('window').height * 0.005, // Responsive margin
    lineHeight: Dimensions.get('window').width * 0.045, // Responsive line height
  },
  commentTime: {
    fontSize: Dimensions.get('window').width * 0.025, // Responsive font size
    color: COLORS.textSecondary,
  },
  noCommentsText: {
    fontSize: Dimensions.get('window').width * 0.035, // Responsive font size
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Dimensions.get('window').height * 0.015, // Responsive padding
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Dimensions.get('window').width * 0.02, // Responsive gap
    marginTop: Dimensions.get('window').height * 0.01, // Responsive margin
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 25,
    paddingHorizontal: Dimensions.get('window').width * 0.04, // Responsive padding
    paddingVertical: Dimensions.get('window').height * 0.012, // Responsive padding
    maxHeight: Dimensions.get('window').height * 0.08, // Responsive max height
    backgroundColor: COLORS.surface,
    fontSize: Dimensions.get('window').width * 0.035, // Responsive font size
    minHeight: Dimensions.get('window').height * 0.05, // Minimum height for touch target
  },
  sendButton: {
    width: Dimensions.get('window').width * 0.12, // Responsive width
    height: Dimensions.get('window').width * 0.12, // Responsive height
    borderRadius: Dimensions.get('window').width * 0.06, // Responsive border radius
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44, // Minimum touch target
    minHeight: 44,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
  },

  // Winner Popup Styles
  winnerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  winnerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 25,
    padding: 30,
    width: '90%',
    maxWidth: 350,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 15,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  winnerIconContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  winnerIcon: {
    fontSize: 60,
  },
  winnerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  winnerDetails: {
    marginBottom: 20,
    width: '100%',
  },
  winnerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  winnerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  winnerBadge: {
    fontSize: 14,
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  winnerMessage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 25,
  },
  winnerAnnouncement: {
    backgroundColor: COLORS.success + '20',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.success,
    padding: 16,
    alignItems: 'center',
    marginBottom: Dimensions.get('window').height * 0.01,
  },
  winnerAnnouncementText: {
    fontSize: Dimensions.get('window').width * 0.045,
    fontWeight: 'bold',
    color: COLORS.success,
    textAlign: 'center',
    lineHeight: Dimensions.get('window').width * 0.055,
  },
  awesomeButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    minWidth: 150,
  },
  awesomeButtonText: {
    color: COLORS.surface,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Modal Styles
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
  modalSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  shareButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
  },
  shareButtonText: {
    color: COLORS.surface,
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Wheel Placeholder Styles
  wheelPlaceholder: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  wheelPlaceholderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  wheelPlaceholderText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  spinPlaceholderButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  spinPlaceholderText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Empty State Styles
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

  // Activity Options Styles
  activityHeader: {
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
  activityTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  optionContainer: {
    paddingVertical: 16,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  optionDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },

  // Input Styles
  inputContainer: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  numberInput: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
  },
  emailInput: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Toggle Styles
  toggleButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.border,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  toggleTextActive: {
    color: COLORS.surface,
  },

  // Live Session Styles
  lockIndicator: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockActive: {
    backgroundColor: COLORS.success,
  },
  lockText: {
    color: COLORS.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  liveSessionActive: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  liveSessionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 16,
  },
  roomCodeLabel: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  roomCodeContainer: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginVertical: 4,
  },

  // Collaboration Styles
  collaboratorSection: {
    marginVertical: 20,
  },
  collaboratorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  permissionsSection: {
    marginVertical: 20,
  },
  permissionsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  permissionsButton: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  permissionsText: {
    fontSize: 16,
    color: COLORS.text,
    flex: 1,
  },
  permissionsDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  emailPreview: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  previewText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },

  // Button Styles
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    alignItems: 'center',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  primaryButtonText: {
    color: COLORS.surface,
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: 'center',
    marginVertical: 4,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 40,
  },
  backButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },



  // Compact Wheel Type Styles
  compactWheelTypeContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  compactWheelTypeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  compactWheelTypeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactWheelTypeIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  compactWheelTypeText: {
    flex: 1,
  },
  compactWheelTypeName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  compactWheelTypeCategory: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  compactWheelTypeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactChangeText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },

  // Collapsible Wheel Type Selection Styles
  collapsibleWheelSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  collapseHeader: {
    padding: 16,
  },
  collapseHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapseHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginLeft: 12,
  },
  wheelTypeContent: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingHorizontal: Dimensions.get('window').width * 0.04, // Responsive horizontal padding
    paddingVertical: Dimensions.get('window').height * 0.02, // Responsive vertical padding
    paddingBottom: Dimensions.get('window').height * 0.025, // Extra bottom padding
  },
  wheelTypeSection: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  wheelTypeScroll: {
    // minimal
  },
  wheelTypeOption: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: Dimensions.get('window').width * 0.03, // Responsive padding
    marginRight: Dimensions.get('window').width * 0.02, // Responsive margin
    minWidth: Dimensions.get('window').width * 0.2, // Responsive width (20% of screen)
    minHeight: Dimensions.get('window').width * 0.2, // Responsive height (20% of screen)
    borderWidth: 2,
    borderColor: 'transparent',
  },
  wheelTypeSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}20`,
  },
  wheelTypeOptionContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelTypeIcon: {
    fontSize: Dimensions.get('window').width * 0.06, // Responsive icon size
    marginBottom: 4,
  },
  wheelTypeLabel: {
    fontSize: Dimensions.get('window').width * 0.03, // Responsive font size
    fontWeight: '500',
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: Dimensions.get('window').width * 0.035, // Responsive line height
  },
  noWheelTypesContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noWheelTypesText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  noWheelTypesSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Wheel Items Management Styles
  itemsDescription: {
    fontSize: Dimensions.get('window').width * 0.035, // Responsive font size
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: Dimensions.get('window').width * 0.045,
  },
  itemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
    paddingHorizontal: 4, // Add padding for better spacing
  },
  itemTag: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 20,
    paddingHorizontal: Dimensions.get('window').width * 0.03, // Responsive horizontal padding
    paddingVertical: Dimensions.get('window').height * 0.01, // Responsive vertical padding
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 4, // Add margin for better wrapping
    minWidth: Dimensions.get('window').width * 0.25, // Minimum width for items
    maxWidth: Dimensions.get('window').width * 0.45, // Maximum width to prevent overflow
  },
  itemText: {
    fontSize: Dimensions.get('window').width * 0.032, // Slightly smaller for better fit
    color: COLORS.text,
    fontWeight: '500',
    flex: 1, // Allow text to wrap
  },
  noItemsText: {
    fontSize: Dimensions.get('window').width * 0.035,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  addItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Dimensions.get('window').width * 0.02, // Responsive gap
    marginBottom: 16,
  },
  addItemInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: Dimensions.get('window').width * 0.04, // Responsive padding
    paddingVertical: Dimensions.get('window').height * 0.015, // Responsive padding
    fontSize: Dimensions.get('window').width * 0.04,
    color: COLORS.text,
    minHeight: Dimensions.get('window').height * 0.05, // Minimum height
  },
  addItemButton: {
    width: Dimensions.get('window').width * 0.12, // Responsive width
    height: Dimensions.get('window').width * 0.12, // Responsive height
    borderRadius: Dimensions.get('window').width * 0.06, // Responsive border radius
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44, // Minimum touch target
    minHeight: 44,
  },
  addItemButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Changed from space-around for better spacing
    gap: Dimensions.get('window').width * 0.02, // Responsive gap
    marginBottom: 16,
  },
  wheelActionButton: {
    flex: 1,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    paddingVertical: Dimensions.get('window').height * 0.015, // Responsive padding
    paddingHorizontal: Dimensions.get('window').width * 0.03, // Responsive padding
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: Dimensions.get('window').height * 0.06, // Minimum height for touch targets
  },
  resetButton: {
    // Default styling
  },
  shuffleButton: {
    // Default styling
  },
  themeButton: {
    // Default styling
  },
  actionButtonText: {
    fontSize: Dimensions.get('window').width * 0.032, // Slightly smaller for better fit
    fontWeight: '600',
    color: COLORS.text,
  },

  // Congratulation Message Styles
  congratsMessageContainer: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: Dimensions.get('window').width * 0.04, // Responsive padding
    paddingVertical: Dimensions.get('window').height * 0.02, // Responsive padding
    marginTop: 8,
  },
  congratsMessageLabel: {
    fontSize: Dimensions.get('window').width * 0.035, // Responsive font size
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  congratsMessageInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: Dimensions.get('window').width * 0.03, // Responsive padding
    paddingVertical: Dimensions.get('window').height * 0.015, // Responsive padding
    fontSize: Dimensions.get('window').width * 0.035, // Responsive font size
    color: COLORS.text,
    minHeight: Dimensions.get('window').height * 0.06, // Minimum height
    textAlignVertical: 'top', // Align text to top for multi-line
  },
  congratsMessageHelper: {
    fontSize: Dimensions.get('window').width * 0.028, // Smaller responsive font size
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 6,
    marginBottom: 12,
    lineHeight: Dimensions.get('window').width * 0.035,
  },
  congratsMessageButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: Dimensions.get('window').height * 0.012, // Responsive padding
    paddingHorizontal: Dimensions.get('window').width * 0.06, // Responsive padding
    alignSelf: 'flex-start', // Align to start instead of full width
    minHeight: Dimensions.get('window').height * 0.05, // Minimum touch target
  },
  congratsMessageButtonText: {
    color: COLORS.surface,
    fontSize: Dimensions.get('window').width * 0.035, // Responsive font size
    fontWeight: '600',
  },

  // Theme Selection Styles
  themeScrollContainer: {
    maxHeight: 400,
    marginTop: 20,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  themePreview: {
    flexDirection: 'row',
    marginRight: 16,
  },
  themeColorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  themeInfo: {
    flex: 1,
  },
  themeName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  themeColorCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // Student Selector Modal Styles
  studentListContainer: {
    flex: 1,
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  studentCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  studentCheckboxSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    flex: 1,
  },
  applyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  applyButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.5,
  },
  applyButtonText: {
    color: COLORS.surface,
    fontSize: 16,
    fontWeight: '600',
  },

  // Tabs Styles
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: -16,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Random Selection Styles
  randomSelectionContainer: {
    flex: 1,
    paddingVertical: 12,
  },
  uploadedCountBox: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  uploadedCountLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
    fontWeight: '500',
  },
  uploadedCountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 4,
  },
  randomControlsBox: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  randomControlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  numberInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  randomNumberInput: {
    width: 60,
    height: 40,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  randomSlashText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  percentageBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  uploadCSVButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    minHeight: 44,
  },
  uploadCSVButtonText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  clearUploadButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: COLORS.surfaceSecondary,
    marginTop: 8,
    alignItems: 'center',
  },
  clearUploadButtonText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '600',
  },

  // Research Tab Styles
  researchContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  researchTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 8,
  },
  researchDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  researchSteps: {
    width: '100%',
  },
  researchStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  stepText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
    flex: 1,
  },
  researchButtonsContainer: {
    gap: 8,
    marginTop: 12,
  },


});

// Process collaborator invitations
const processCollaboratorInvitations = async (
  collaboratorEmails: string,
  sessionId: string,
  roomCode: string,
  currentUser: any,
  userProfile: any
) => {
  try {
    const emailList = collaboratorEmails.split(',').map(email => email.trim()).filter(email => email);

    if (emailList.length === 0) return;

    console.log('🤝 Processing collaborator invitations for:', emailList);

    for (const email of emailList) {
      try {
        // Check if user exists and is an organizer
        const usersQuery = query(
          collection(db, "users"),
          where("email", "==", email)
        );
        const userSnapshot = await getDocs(usersQuery);

        if (userSnapshot.empty) {
          console.log(`⚠️ No user found with email: ${email}`);
          continue;
        }

        const userData = userSnapshot.docs[0].data();
        const userRole = userData.role?.toLowerCase();

        if (userRole !== 'organizer' && userRole !== 'teacher') {
          console.log(`⚠️ User ${email} is not an organizer/teacher (role: ${userRole})`);
          continue;
        }

        const invitedUserId = userSnapshot.docs[0].id;

        // Create live room invitation (compatible with web format)
        const invitationData = {
          sessionId: sessionId,
          sessionTitle: 'Live Organizer Wheel',
          sessionDescription: 'Collaborative live wheel drawing session',
          wheelType: 'team-picker',
          wheelTitle: 'Live Organizer Wheel',
          wheelIcon: '🎯',
          roomCode: roomCode,
          invitedOrganizerEmail: email,
          invitedOrganizer: invitedUserId, // Will be filled when they accept
          invitedBy: currentUser.uid,
          invitedByName: userProfile?.fullName || currentUser.email?.split('@')[0] || 'Organizer',
          invitedByEmail: currentUser.email,
          status: 'sent',
          type: 'live_room_invitation',
          createdAt: serverTimestamp(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiry
          sessionConfig: {
            maxParticipants: 50,
            allowReactions: true,
            confettiEffect: true,
            soundEffects: true,
            liveSession: true,
            allowDataSync: true
          },
          permissions: {
            canControlLive: true,
            canEditWheel: true,
            canManageParticipants: true,
            canEndSession: false,
            canInviteOthers: false
          },
          isRealTimeNotification: true,
          priority: 'high',
          requiresImmediateAttention: true
        };

        // Add to live room invitations collection (matching web listeners)
        await addDoc(collection(db, "liveRoomInvitations"), invitationData);

        // Also add to general announcements for real-time notification
        await addDoc(collection(db, "announcements"), {
          title: `🤝 Live Session Collaboration Invitation`,
          message: `${userProfile?.fullName || 'An organizer'} has invited you to collaborate on their live wheel session "${'Live Organizer Wheel'}" with room code: ${roomCode}. You'll be able to control live sessions, edit the wheel, and manage participants together.`,
          type: "collaboration",
          targetRoles: ['organizer', 'teacher'],
          targetUserId: invitedUserId,
          isActive: true,
          priority: "high",
          createdBy: currentUser.uid,
          createdByName: userProfile?.fullName || 'Organizer',
          createdAt: serverTimestamp(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          wheelId: sessionId,
          wheelName: 'Live Organizer Wheel',
          collaborationInviteId: 'pending',
          roomCode: roomCode
        });

        // Update wheel with pending collaborator
        const sessionRef = doc(db, "liveDrawSessions", sessionId);
        await updateDoc(sessionRef, {
          pendingCollaborators: arrayUnion({
            email: email,
            name: userData.displayName || userData.name || 'Organizer',
            invitedAt: new Date(),
            invitedBy: currentUser.uid,
            roomCode: roomCode
          })
        });

        console.log(`✅ Invitation sent to ${email} for room code: ${roomCode}`);
      } catch (error) {
        console.error(`❌ Error sending invitation to ${email}:`, error);
      }
    }

    console.log(`🎉 Successfully processed ${emailList.length} collaborator invitations`);
  } catch (error) {
    console.error('❌ Error processing collaborator invitations:', error);
  }
};

const OrganizerLiveRoomScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { currentUser, userProfile } = useAuth();

  // ScrollView ref for controlling scroll behavior
   const scrollViewRef = useRef<ScrollView>(null);
   const activityScrollViewRef = useRef<ScrollView>(null);

  // NEW: Function to accept web invitations
  const acceptWebInvitation = async (webInvitation: any, webInvitationId: string) => {
    if (!currentUser) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    console.log('🌐 Accepting web invitation:', {
      invitationId: webInvitationId,
      sessionId: webInvitation.sessionId,
      email: webInvitation.invitedOrganizerEmail,
      sessionTitle: webInvitation.sessionTitle
    });

    try {
      // Load the target session
      const sessionRef = doc(db, 'liveDrawSessions', webInvitation.sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (!sessionDoc.exists()) {
        Alert.alert('Error', 'Session not found');
        return;
      }

      const sessionData = sessionDoc.data();

      // Check if user is already a collaborator
      const currentCollaborators = sessionData.collaboratorDetails || [];
      const existingCollaborator = currentCollaborators.find((c: any) =>
        c.uid === currentUser.uid || c.email === currentUser.email
      );

      if (existingCollaborator) {
        Alert.alert('Already a collaborator', 'You are already a collaborator on this session');
        return;
      }

      // Add user as collaborator
      const newCollaborator = {
        uid: currentUser.uid,
        email: currentUser.email,
        name: userProfile?.fullName || currentUser.email?.split('@')[0] || 'Organizer',
        joinedAt: new Date(),
        status: 'active',
        platform: 'mobile',
        permissions: {
          canControlLive: webInvitation.permissions.canControlLive,
          canEditWheel: webInvitation.permissions.canEditWheel,
          canManageParticipants: webInvitation.permissions.canManageParticipants
        },
        joinedVia: 'web_invitation',
        isOnline: true,
        lastActive: new Date()
      };

      // Update session with new collaborator
      await updateDoc(sessionRef, {
        collaboratorDetails: [...currentCollaborators, newCollaborator],
        collaborators: [...(sessionData.collaborators || []), currentUser.email],
        updatedAt: serverTimestamp()
      });

      // Update invitation status
      await updateDoc(doc(db, 'liveRoomInvitations', webInvitationId), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        invitedOrganizer: currentUser.uid,
        acceptedByName: newCollaborator.name
      });

      // Show success and load the session
      Alert.alert(
        '🌐 Joined Web Session!',
        `Successfully joined "${webInvitation.sessionTitle}" as a collaborator. You now have full control over the live session.\n\nRoom Code: ${webInvitation.roomCode}`,
        [
          {
            text: 'Enter Session',
            onPress: () => {
              // Load the session directly
              loadExistingSession(webInvitation.sessionId);
            }
          }
        ]
      );

      console.log('✅ Successfully accepted web invitation and joined session');

    } catch (error) {
      console.error('❌ Error accepting web invitation:', error);
      Alert.alert('Error', 'Failed to accept invitation');
    }
  };

  // Get parameters from navigation
  const params = route.params as any;
  const sessionId = params?.sessionId as string | undefined;
  const activityId = params?.activityId as string | undefined;

  // Core state
  const [session, setSession] = useState<UniversalSession | null>(null);
  const [loading, setLoading] = useState(false); // Don't show loading initially
  const [error, setError] = useState('');

  // Wheel and session management
  const [currentWheelType, setCurrentWheelType] = useState<any>(null);
  const [wheelTypes, setWheelTypes] = useState<any[]>([]);
  const [userWheelTypes, setUserWheelTypes] = useState<any[]>([]);
  const [customWheels, setCustomWheels] = useState<any[]>([]);
  const [wheelTypesLoading, setWheelTypesLoading] = useState(true);
  const [customWheelTitle, setCustomWheelTitle] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [customWinnerWord, setCustomWinnerWord] = useState('Winner');
  const [allowManualWinnerSelection, setAllowManualWinnerSelection] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('school');

  // Activity Options state
  const [maxParticipants, setMaxParticipants] = useState('50');
  const [allowReactions, setAllowReactions] = useState(true);
  const [confettiEffect, setConfettiEffect] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [isLiveSessionActive, setIsLiveSessionActive] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [allowDataSync, setAllowDataSync] = useState(true);
  const [collaboratorEmails, setCollaboratorEmails] = useState('teacher2@example.com, coord@example.com');
  const [defaultPermissions, setDefaultPermissions] = useState('Full Access');

  // UI state for popups and effects
  const [showWinnerPopup, setShowWinnerPopup] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);

  // 🔄 CRITICAL: Force spin synchronization
  const [forceSpinTrigger, setForceSpinTrigger] = useState(0);
  const [forceSpinWinner, setForceSpinWinner] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [isCustomSettingsOpen, setIsCustomSettingsOpen] = useState(false);
  const [isThemePresetsOpen, setIsThemePresetsOpen] = useState(false);
  const [activityCreated, setActivityCreated] = useState(false);
  const [isWheelTypeModalOpen, setIsWheelTypeModalOpen] = useState(false);
  const [isWheelTypeSectionMinimized, setIsWheelTypeSectionMinimized] = useState(false);
  const [spinCompleted, setSpinCompleted] = useState(false); // Track spin completion state
  const [isSpinning, setIsSpinning] = useState(false); // Track if wheel is currently spinning
  const [lastWinnerNotificationId, setLastWinnerNotificationId] = useState<string | null>(null); // Track last shown winner notification

  // Wheel items management state
  const [currentWheelItems, setCurrentWheelItems] = useState<string[]>(['Team Alpha', 'Team Beta', 'Team Gamma', 'Team Delta']);
  const [newItemText, setNewItemText] = useState('');
  const [isWheelItemsSectionMinimized, setIsWheelItemsSectionMinimized] = useState(false);

  // Image picker wheel state
  const [imageUrls, setImageUrls] = useState<{[key: string]: string}>({
    'image-1': '',
    'image-2': '',
    'image-3': '',
    'image-4': '',
    'image-5': ''
  });
  const [isImagePickerSectionMinimized, setIsImagePickerSectionMinimized] = useState(false);

  // BULLETPROOF PATTERN DEFINITIONS - ABSOLUTELY NO CHANGES DURING SPINNING
  const staticPatternDefinitionsRef = useRef<Record<string, { patternId: string; url: string; sliceId: string }>>({});

  // Team picker state
  const [isTeamPickerSectionMinimized, setIsTeamPickerSectionMinimized] = useState(false);

  // Student Selector state
  const [isStudentSelectorOpen, setIsStudentSelectorOpen] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [uploadedStudents, setUploadedStudents] = useState<string[]>([]); // CSV uploaded students
  const [randomSelectionCount, setRandomSelectionCount] = useState(10);
  const [selectorTab, setSelectorTab] = useState<'manual' | 'random' | 'research'>('manual'); // Tab selection

  // 🔒 BULLETPROOF PATTERN FREEZE SYSTEM - COMPLETE ORGANIZER ISOLATION DURING SPINNING
  const patternFreezeModeRef = useRef<boolean>(false); // COMPLETE FREEZE OF PATTERN CHANGES DURING SPINNING
  const [imageStabilityMode, setImageStabilityMode] = useState(false); // For OrganizerWheel communication

  // MEMOIZED WHEEL IMAGES - PREVENT FLICKERING DURING URL PASTING
  const wheelImages = useMemo(() => {
    // Only construct wheelImages if using image picker wheel
    if (currentWheelType?.value !== 'image-picker') {
      return undefined;
    }

    try {
      // Create wheelImages indexed by position (0-4) to match wheel slices
      const result: {[key: number]: string} = {};

      // Map image-1 to index 0, image-2 to index 1, etc.
      for (let i = 1; i <= 5; i++) {
        const slotKey = `image-${i}`;
        const url = imageUrls[slotKey];

        if (url && typeof url === 'string' && url.trim()) {
          result[i - 1] = url.trim(); // i-1 to convert to 0-based index
        }
      }

      return result;
    } catch (error) {
      console.error('Error constructing wheelImages:', error); // Keep error logging
      return {};
    }
  }, [currentWheelType?.value, imageUrls]); // Dependencies: only when wheel type or URLs change

  // BULLETPROOF PATTERN DEFINITIONS - COMPLETE ISOLATION DURING SPINNING
  const patternDefinitions = useMemo(() => {
    // COMPLETE FROZEN STATE DURING SPINNING - NO RECALCULATION WHATSOEVER
    if (patternFreezeModeRef.current || isSpinning) {
      return staticPatternDefinitionsRef.current; // 🔇 Silent during spinning to prevent console spam
    }

    // Normal (non-spinning, non-frozen) pattern creation
    const patterns: Record<string, { patternId: string; url: string; sliceId: string }> = {};
    Object.entries(imageUrls).forEach(([slotKey, url]) => {
      if (url && url.trim().length > 0) {
        patterns[slotKey] = {
          patternId: `img-${slotKey}`,
          url: url.trim(),
          sliceId: slotKey
        };
      }
    });

    // 🔇 Removed console noise - completely silent during normal operation
    // Only emergency error logging if needed

    return patterns;
  }, [imageUrls, isSpinning, patternFreezeModeRef.current]); // Removed currentWheelType?.value dependency to prevent unnecessary recalcs

  // 🧹 COMPREHENSIVE COMPONENT CLEANUP - Ensure smooth navigation back to dashboard
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting - initiating comprehensive cleanup');
      
      try {
        // Step 1: Clean up all listeners
        cleanupAllListeners();
        
        // Step 2: Clear all timers
        console.log('⏱️ Clearing all timers...');
        // All timeouts will be cleared naturally on unmount
        
        // Step 3: Reset all state to avoid memory leaks
        console.log('📝 Resetting component state...');
        setSession(null);
        setCurrentWheelType(null);
        setCurrentWheelItems([]);
        setIsSpinning(false);
        setShowWinnerPopup(false);
        setShowConfetti(false);
        setActivityCreated(false);
        setWheelTypes([]);
        setCustomWheels([]);
        setViewers([]);
        setComments([]);
        
        // Step 4: Clear pattern definitions
        console.log('🎨 Clearing pattern definitions...');
        staticPatternDefinitionsRef.current = {};
        patternFreezeModeRef.current = false;
        
        // Step 5: Clear image state
        setImageUrls({
          'image-1': '',
          'image-2': '',
          'image-3': '',
          'image-4': '',
          'image-5': ''
        });
        
        console.log('✅ Component cleanup complete - safe to navigate');
      } catch (cleanupError) {
        console.error('⚠️ Error during cleanup:', cleanupError);
        // Continue regardless of cleanup errors
      }
    };
  }, []); // Empty dependency - runs only on unmount

  // CRITICAL: PRE-SPIN PATTERN LOCKDOWN
  useEffect(() => {
    // Before spinning starts, ALWAYS ensure we have static patterns locked
    if (!isSpinning && !patternFreezeModeRef.current && Object.keys(patternDefinitions).length > 0) {
      staticPatternDefinitionsRef.current = patternDefinitions;
      console.log('💾 PRE-SPIN: Static patterns locked for stability');

      // PREVENT any further pattern changes during potential spinning
      patternFreezeModeRef.current = false; // Allow normal updates until spin starts
    }
  }, [patternDefinitions, isSpinning]);

  // SPINNING STARTUP PROTOCOL - COMPLETE FREEZE ACTIVATION
  useEffect(() => {
    if (isSpinning && !patternFreezeModeRef.current) {
      // ACTIVATE COMPLETE PATTERN FREEZE IMMEDIATELY
      patternFreezeModeRef.current = true;
      setImageStabilityMode(true); // Signal to OrganizerWheel for stability

      // EMERGENCY PATTERN FALLBACK: Ensure we have patterns before complete freeze
      const currentPatterns = Object.keys(staticPatternDefinitionsRef.current).length;
      if (currentPatterns === 0 && Object.keys(patternDefinitions).length > 0) {
        staticPatternDefinitionsRef.current = patternDefinitions;
        console.log('🚨 EMERGENCY: Emergency pattern loading during spin startup');
      }

      console.log('🔒 ULTIMATE PATTERN FREEZE ACTIVATED - Zero changes during spinning:', {
        staticPatterns: Object.keys(staticPatternDefinitionsRef.current).length,
        isFrozen: true,
        canShowImages: Object.keys(staticPatternDefinitionsRef.current).length > 0,
        timestamp: new Date().toISOString()
      });
    } else if (!isSpinning && patternFreezeModeRef.current) {
      // SPIN COMPLETE - Release freeze for next spin preparation
      setTimeout(() => {
        patternFreezeModeRef.current = false;
        setImageStabilityMode(false); // Release OrganizerWheel stability mode
        console.log('🔓 Pattern freeze released - Spin completed');
      }, 1000); // Brief delay to ensure all spin effects complete
    }
  }, [isSpinning, patternDefinitions]);

  // Memoize initialSlices to prevent infinite re-renders
  const initialSlices = useMemo(() => {
    console.log('🧠 Computing initialSlices:', {
      currentWheelItems: currentWheelItems.length
    });

    return currentWheelItems.map((item, index) => ({
      id: `slice-${index}`,
      text: item,
      color: `hsl(${(index * 137.5) % 360}, 70%, 60%)`
    }));
  }, [currentWheelItems.length]); // Simplified dependencies

  // ROCK-SOLID STABILITY: Atomic spin state management with unique IDs
  const [spinState, setSpinState] = useState<{
    isInProgress: boolean;
    currentSpinId: string | null;
    lastWinnerAnnounced: string | null;
    lastWinnerTime: number;
  }>({
    isInProgress: false,
    currentSpinId: null,
    lastWinnerAnnounced: null,
    lastWinnerTime: 0
  });

  // Prevent infinite loops in configuration sync - ROCK SOLID
  const [isUpdatingFromConfigSync, setIsUpdatingFromConfigSync] = useState(false);
  const [lastConfigUpdateTime, setLastConfigUpdateTime] = useState<number>(0);
  const configSyncDebounceDelay = 2000; // Very long debounce for absolute stability

  // 🚀 DEBOUNCE MECHANISM: Prevent rapid-fire wheel state updates
  const [lastWheelStateUpdate, setLastWheelStateUpdate] = useState<number>(0);
  const wheelStateDebounceDelay = 500; // 500ms debounce for wheel state updates




  // Generate random room code
  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Comments and interactions
  const [comments, setComments] = useState<Comment[]>([]);
  const [viewers, setViewers] = useState<any[]>([]);

  // Session management
  const [isCreating, setIsCreating] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');

  // 🖼️ SYNC IMAGE URLS TO FIREBASE FOR PARTICIPANTS (Mobile-to-Mobile Image Sync)
  // DEBOUNCED to prevent flickering while typing
  useEffect(() => {
    if (!session?.id || !currentWheelType?.value) return;
    
    // Only sync when Image Picker Wheel is active
    if (currentWheelType.value !== 'image-picker') return;
    
    // Check if any images are set
    const hasImages = Object.values(imageUrls).some(url => url && url.trim().length > 0);
    if (!hasImages) {
      return;
    }
    
    // DEBOUNCE: Wait 1 second after user stops typing before syncing
    const debounceTimer = setTimeout(() => {
      console.log('🖼️ SYNCING IMAGE URLS TO FIREBASE (DEBOUNCED)');
      
      // Convert imageUrls object to array format for participants
      const wheelImages = Object.entries(imageUrls)
        .filter(([key, url]) => url && url.trim().length > 0)
        .map(([key, url], index) => ({
          id: key,
          url: url.trim(),
          alt: `Image ${index + 1}`,
          isLoaded: true,
          error: false
        }));
      
      // Create imageWheelSlices format (compatible with web)
      const imageWheelSlices = currentWheelItems.map((item, index) => {
        const imageKey = `image-${index + 1}`;
        const imageUrl = imageUrls[imageKey] || '';
        
        return {
          id: `slice-${index}`,
          text: item,
          color: `hsl(${(index * 137.5) % 360}, 70%, 60%)`,
          image: imageUrl && imageUrl.trim().length > 0 ? {
            url: imageUrl.trim(),
            alt: `Image for ${item}`,
            isLoaded: true,
            error: false
          } : null
        };
      });
      
      // Update Firebase with image data
      const sessionRef = doc(db, 'liveDrawSessions', session.id);
      updateDoc(sessionRef, {
        wheelImages: wheelImages,
        imageWheelSlices: imageWheelSlices,
        imagePickerMode: true,
        updatedAt: serverTimestamp()
      }).then(() => {
        console.log('✅ IMAGE URLS SYNCED - Participants will see images');
      }).catch((error) => {
        console.error('❌ ERROR SYNCING IMAGE URLS:', error);
      });
    }, 1000); // 1 second debounce
    
    // Cleanup: Cancel timer if imageUrls change again before timeout
    return () => clearTimeout(debounceTimer);
    
  }, [imageUrls, session?.id, currentWheelType?.value, currentWheelItems]);

  // Initialize session and generate room code
  useEffect(() => {
    if (sessionId) {
      // Load existing session if sessionId is provided
      loadExistingSession(sessionId);
    } else {
      // Generate room code immediately when component loads
      const newRoomCode = generateRoomCode();
      setRoomCode(newRoomCode);
    }
    // If no sessionId, don't create session automatically - wait for user to press "Create Wheel Activity"
  }, [sessionId]);

  // Handle navigation params for accepted invitations
  useEffect(() => {
    const handleAcceptedInvitation = async () => {
      const params = route.params as any;
      if (params?.sessionId && params?.acceptedInvitation) {
        console.log('🎉 User joined via accepted collaboration invitation:', params.sessionId);
        console.log('👤 User role:', userProfile?.role);
        console.log('🔑 User permissions: Collaborator with full access');

        // Show success message with collaborator context
        Alert.alert(
          '🎉 Welcome to the Live Room!',
          `You have successfully joined this collaborative live session as a collaborator. You can now control the wheel, edit settings, and manage participants together with other organizers.\n\nRoom Code: ${params.roomCode || 'N/A'}`,
          [{ text: 'Start Collaborating' }]
        );

        // Mark user as active collaborator in the session
        if (sessionId && currentUser?.uid) {
          try {
            const sessionRef = doc(db, 'liveDrawSessions', sessionId);
            const sessionDoc = await getDoc(sessionRef);

            if (sessionDoc.exists()) {
              const sessionData = sessionDoc.data();
              const currentCollaborators = sessionData.collaboratorDetails || [];

              // Check if user is already in collaborators
              const existingCollaborator = currentCollaborators.find((c: any) => c.uid === currentUser.uid);

              if (!existingCollaborator) {
                // Add user as active collaborator
                const newCollaborator = {
                  uid: currentUser.uid,
                  email: currentUser.email,
                  name: userProfile?.fullName || currentUser.email?.split('@')[0] || 'Collaborator',
                  joinedAt: new Date(),
                  status: 'active',
                  platform: 'mobile',
                  permissions: {
                    canControlLive: true,
                    canEditWheel: true,
                    canManageParticipants: true
                  },
                  joinedVia: 'collaboration_invitation',
                  isOnline: true,
                  lastActive: new Date()
                };

                await updateDoc(sessionRef, {
                  collaboratorDetails: [...currentCollaborators, newCollaborator],
                  updatedAt: serverTimestamp()
                });

                console.log('✅ Added user as active collaborator in session');
              }
            }
          } catch (error) {
            console.error('❌ Error adding user as collaborator:', error);
          }
        }
      }
    };

    handleAcceptedInvitation();
  }, [route.params, sessionId, currentUser?.uid, userProfile]);

  // Scroll to top when activity is created
    useEffect(() => {
      if (activityCreated && activityScrollViewRef.current) {
        activityScrollViewRef.current.scrollTo({ x: 0, y: 0, animated: true });
      }
    }, [activityCreated]);

  // Cleanup spin state when component unmounts or new spin starts
  useEffect(() => {
    return () => {
      cleanupAllListeners();
    };
  }, []);

  // Reset spin completion state when a new spin starts
  const resetSpinState = () => {
    setSpinCompleted(false);
    setShowWinnerPopup(false);
    setShowConfetti(false);
    setIsSpinning(false);
    setLastWinnerNotificationId(null);
  };

  // Cleanup debounce timer when component unmounts or session changes
  useEffect(() => {
    return () => {
      cleanupAllListeners();
    };
  }, [sessionId]);

  // Handle when a new spin starts
  const handleSpinStart = () => {
    console.log('🎡 Spin started - resetting all states');
    resetSpinState();
    setIsSpinning(true);
  };

  // 🚀 ENHANCED REAL-TIME REMOTE SPIN TRIGGER
  // This function handles remote spin starts with precise synchronization
  const handleRemoteSpinStart = () => {
    console.log('🔄 REMOTE SPIN START: Mobile collaborator detected organizer spin - synchronizing');
    resetSpinState();
    setIsSpinning(true);

    // Force trigger any pending spin states immediately
    setTimeout(() => {
      if (!isSpinning) {
        console.log('🚀 FORCE SPIN START: Ensuring mobile wheel spins with organizer');
        setIsSpinning(true);
      }
    }, 10);

    return true; // Return success status
  };


  // Check if user is a participant (can only create wheels for solo use)
  const isParticipant = () => {
    if (!userProfile?.role) return true; // Default to participant if no role
    const role = userProfile.role.toLowerCase();
    return role === 'participant';
  };

  // Check if user is an organizer/teacher/admin (following WheelCategoryScreen pattern)
  const isOrganizer = () => {
    if (!userProfile?.role) return false;
    const role = userProfile.role.toLowerCase();
    return role === 'teacher' || role === 'organizer' || role === 'admin';
  };

  // Check if current user has collaborator permissions (enhanced for full-access collaborators)
  const isOrganizerCollaborator = () => {
    if (!session || !currentUser?.uid) return false;

    // Type cast to access custom properties
    const sessionData = session as any;
    if (!sessionData.collaboratorDetails) return false;

    // Check if user is in collaborator list
    const collaborator = sessionData.collaboratorDetails.find((c: any) =>
      c.uid === currentUser.uid || c.email === currentUser.email
    );

    if (!collaborator) return false;

    // Check if collaborator has full access permissions (organizer-level control)
    const permissions = collaborator.permissions;
    return permissions?.canControlLive === true ||
           permissions?.canEditWheel === true ||
           permissions?.canManageParticipants === true ||
           collaborator.status === 'active'; // Full access by default for active collaborators
  };

  // Check if current user is the original session creator (primary organizer)
  const isPrimaryOrganizer = () => {
    if (!session || !currentUser?.uid) return false;
    return session.createdBy === currentUser.uid;
  };
  
  // 🔄 BROADCAST SOURCE: Determine user's role for proper synchronization
  // Use useMemo to compute efficiently based on dependencies
  const broadcastSource = useMemo(() => {
    return session?.createdBy === currentUser?.uid ? 'organizer' :
           isOrganizerCollaborator() ? 'full-access-collaborator' :
           'collaborator';
  }, [session?.createdBy, currentUser?.uid, session]);
  
  // Handle winner popup display
  const handleShowWinnerPopup = () => {
    setShowWinnerPopup(true);
  };

  // Comprehensive cleanup function for all listeners
  const cleanupAllListeners = () => {
    console.log('🧹 Cleaning up all listeners and timers');

      // Reset all state flags
    setIsUpdatingFromConfigSync(false);
    setSpinCompleted(false);
    setShowWinnerPopup(false);
    setShowConfetti(false);
    setIsSpinning(false);
    setLastWinnerNotificationId(null);
    setSpinState({
      isInProgress: false,
      currentSpinId: null,
      lastWinnerAnnounced: null,
      lastWinnerTime: 0
    });
  };

  // Fetch available wheel types (following WheelCategoryScreen pattern)
  useEffect(() => {
    const fetchWheelTypes = async () => {
      try {
        setWheelTypesLoading(true);
        console.log('🔍 [Mobile] Starting wheel types fetch...');
        console.log('👤 [Mobile] User profile:', userProfile);
        console.log('🔑 [Mobile] Current user:', currentUser?.uid);

        // Fetch global wheel types
        const globalQuery = query(collection(db, "wheelTypes"), orderBy("order", "asc"));
        console.log('🔍 [Mobile] Fetching global wheel types...');
        const globalSnapshot = await getDocs(globalQuery);
        console.log('📊 [Mobile] Global wheel types found:', globalSnapshot.size);
        const globalTypes: any[] = [];

        globalSnapshot.forEach((doc) => {
          const data = doc.data();
          console.log(`📄 [Mobile] Found global wheel type: ${data.label || 'Unknown'} (${doc.id}) - enabled: ${data.enabled}, roles: ${data.allowedRoles?.join(',') || 'none'}`);
          // Include all wheel types, but we'll filter by enabled and roles later
          globalTypes.push({
            id: doc.id,
            ...data
          } as any);
        });

      // Fetch user-specific wheel types if user is logged in (use uid instead of email like WheelCategoryScreen)
        let userSpecificTypes: any[] = [];
        if (currentUser?.uid) {
          console.log('🔍 [Mobile] Fetching user-specific wheel types...');
          const userQuery = query(
            collection(db, "userWheelTypes"),
            where("userId", "==", currentUser.uid)
          );
          const userSnapshot = await getDocs(userQuery);
          console.log('📊 [Mobile] User-specific wheel types found:', userSnapshot.size);

          userSpecificTypes = userSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          } as any));
        } else {
          console.log('⚠️ [Mobile] No currentUser.uid found, skipping user-specific wheel types');
        }

        // Fetch custom wheels created by the user
        let customWheelsData: any[] = []
        if (currentUser?.uid) {
          const customWheelsQuery = query(
            collection(db, "wheels"),
            where("userId", "==", currentUser.uid),
            where("type", "==", "custom")
          )
          const customWheelsSnapshot = await getDocs(customWheelsQuery)

          customWheelsData = customWheelsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          }))
        }

        // Combine and filter based on user role (following WheelCategoryScreen pattern)
        // Since this is OrganizerLiveRoomScreen, default to organizer if no role
        const userRole = userProfile?.role?.toLowerCase() || 'organizer';
        const allTypes = [...globalTypes, ...userSpecificTypes];

        console.log('🔍 [Mobile] Filtering wheel types...');
        console.log('👤 [Mobile] User role:', userRole, 'isOrganizer:', isOrganizer(), 'isParticipant:', isParticipant());
        console.log('📊 [Mobile] Total wheel types before filtering:', allTypes.length);

        const filteredTypes = allTypes.filter(type => {
          // Check if wheel type is enabled (must be enabled to be available)
          if (!type.enabled) {
            console.log(`❌ [Mobile] Wheel type "${type.label}" is disabled`);
            return false;
          }

          // Check role permissions (same logic as WheelCategoryScreen)
          const hasUserRole = type.allowedRoles.includes(userRole);
          const hasOrganizerRole = type.allowedRoles.includes('organizer') && isOrganizer();
          const hasParticipantRole = type.allowedRoles.includes('participant') && isParticipant();

          const shouldInclude = hasUserRole || hasOrganizerRole || hasParticipantRole;

          console.log(`🔍 [Mobile] Wheel type "${type.label}": enabled=${type.enabled}, roles=${type.allowedRoles?.join(',')}, include=${shouldInclude}`);

          return shouldInclude;
        });

        // Always include admin-created wheel types, plus fallbacks if needed
        let finalWheelTypes = [...filteredTypes];

        // If no admin wheel types found, add the hardcoded ones as fallbacks
        if (filteredTypes.length === 0) {
          console.log('⚠️ [Mobile] No admin wheel types found, using fallbacks');
          finalWheelTypes = [...AVAILABLE_WHEEL_TYPES];
        } else {
          // Add any missing fallback types that aren't already in the filtered list
          AVAILABLE_WHEEL_TYPES.forEach(fallbackType => {
            const exists = finalWheelTypes.some(type => type.value === fallbackType.value);
            if (!exists) {
              console.log(`➕ [Mobile] Adding fallback wheel type: ${fallbackType.label}`);
              finalWheelTypes.push(fallbackType);
            }
          });
        }

        console.log('🎯 [Mobile] Final wheel types:', finalWheelTypes.length);
        finalWheelTypes.forEach(w => {
          console.log(`  - ${w.label} (${w.value}) - Enabled: ${w.enabled}, Roles: ${w.allowedRoles?.join(', ')}, ID: ${w.id}`);
        });

        // Also show current wheel type for debugging
        if (currentWheelType && process.env.NODE_ENV === 'development') {
          console.log('🎯 [Mobile] Current selected wheel type:', currentWheelType.label, '(', currentWheelType.value, ')');
        }

        setWheelTypes(finalWheelTypes);
        setUserWheelTypes(userSpecificTypes);

        // Set default wheel type if none selected
        if (!currentWheelType && finalWheelTypes.length > 0) {
          setCurrentWheelType(finalWheelTypes[0]);
        }
      } catch (error) {
        console.error("❌ [Mobile] Error fetching wheel types:", error);
        // Use fallback wheel types
        console.log('🔄 [Mobile] Using fallback wheel types due to error');
        setWheelTypes(AVAILABLE_WHEEL_TYPES);
        setUserWheelTypes([]);
        if (!currentWheelType && AVAILABLE_WHEEL_TYPES.length > 0) {
          setCurrentWheelType(AVAILABLE_WHEEL_TYPES[0]);
        }
      } finally {
        setWheelTypesLoading(false);
      }
    };

    fetchWheelTypes();
   }, []);

  const createNewSession = async () => {
    if (!currentUser) return;

    setIsCreating(true);
    try {
      // Use the default wheel type
      const defaultWheelType = AVAILABLE_WHEEL_TYPES[0];
      const wheelItems = defaultWheelType.defaultItems;

      const newSession = await CrossPlatformSessionManager.createUniversalSession(
        {
          name: 'Live Organizer Wheel',
          items: wheelItems
        },
        currentUser.uid,
        'mobile',
        activityId
      );

      setSession(newSession);
      setCurrentWheelType(defaultWheelType);
      setCurrentWheelItems(wheelItems); // Sync wheel items

      // Generate and set room code
      const newRoomCode = generateRoomCode();
      setRoomCode(newRoomCode);
      setIsLiveSessionActive(true);

      // Update session with room code, wheel type, wheel items, and theme
      const themeObject = WHEEL_THEMES.find(t => t.id === selectedTheme) || WHEEL_THEMES[0];
      await updateDoc(doc(db, 'liveDrawSessions', newSession.id), {
        roomCode: newRoomCode,
        selectedWheelType: defaultWheelType,
        wheelItems: wheelItems,
        selectedTheme: selectedTheme,
        'wheelState.theme': themeObject,
        'wheelState.themeUpdatedAt': serverTimestamp(),
        isLiveSessionActive: true,
        updatedAt: serverTimestamp()
      });

      console.log('✅ New organizer session created:', newSession.id, 'Room code:', newRoomCode);
    } catch (error) {
      console.error('Error creating session:', error);
      Alert.alert('Error', 'Failed to create live session');
    } finally {
      setIsCreating(false);
      setLoading(false);
    }
  };

  const loadExistingSession = async (sessionId: string) => {
    setLoading(true);
    try {
      const sessionDoc = await getDoc(doc(db, 'liveDrawSessions', sessionId));
      if (sessionDoc.exists()) {
        const sessionData = { id: sessionDoc.id, ...sessionDoc.data() } as UniversalSession;
        setSession(sessionData);

        // Load wheel type configuration
        const sessionDataAny = sessionData as any; // Cast to access custom properties
        if (sessionDataAny.selectedWheelType) {
          setCurrentWheelType(sessionDataAny.selectedWheelType);
          setCustomWheelTitle(sessionDataAny.customWheelTitle || '');
          setCustomMessage(sessionDataAny.customMessage || '');
          setCustomWinnerWord(sessionDataAny.customWinnerWord || 'Winner');
          setAllowManualWinnerSelection(sessionDataAny.allowManualWinnerSelection || false);
        }

        // Load theme configuration
        if (sessionDataAny.selectedTheme) {
          setSelectedTheme(sessionDataAny.selectedTheme);
        } else {
          setSelectedTheme('school'); // Default theme
        }

        // Load wheel items from session or use default
        if (sessionDataAny.wheelItems && sessionDataAny.wheelItems.length > 0) {
          setCurrentWheelItems(sessionDataAny.wheelItems);
        } else if (sessionDataAny.selectedWheelType && sessionDataAny.selectedWheelType.defaultItems) {
          setCurrentWheelItems(sessionDataAny.selectedWheelType.defaultItems);
        } else {
          // Fallback to default items
          setCurrentWheelItems(AVAILABLE_WHEEL_TYPES[0].defaultItems);
        }

        // Start real-time listeners
        startSessionListeners(sessionId);

        // Mark activity as created since we're loading an existing session
        setActivityCreated(true);
      } else {
        Alert.alert('Error', 'Session not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading session:', error);
      Alert.alert('Error', 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const startSessionListeners = (sessionId: string) => {
    // 🚀 SINGLE CONSOLIDATED FIREBASE LISTENER - Prevents multiple listeners on same document
    // This replaces all the separate listeners that were causing conflicts and loops
    const consolidatedUnsubscribe = onSnapshot(
      doc(db, 'liveDrawSessions', sessionId),
      (docSnapshot) => {
        if (!docSnapshot.exists()) {
          setError('Lost connection to session');
          setConnectionQuality('poor');
          return;
        }

        const sessionData = docSnapshot.data() as any;
        const wheelState = sessionData?.wheelState;
        const now = Date.now();

        // Update session data and connection quality
        setSession({ id: docSnapshot.id, ...sessionData });
        setConnectionQuality('excellent');

        // 🚀 DEBOUNCE ALL UPDATES: Prevent rapid-fire processing
        if (now - lastWheelStateUpdate < wheelStateDebounceDelay) {
          console.log('⚡ DEBOUNCING consolidated update - too soon after previous update');
          return;
        }
        setLastWheelStateUpdate(now);

        // 🎯 CONFIGURATION SYNC - Only sync when there are real changes and not in a loop
        if (!isUpdatingFromConfigSync && now - lastConfigUpdateTime > configSyncDebounceDelay) {
          let hasConfigChanges = false;

          // Theme changes - prevent loops by checking if it's actually different
          if (sessionData.selectedTheme && sessionData.selectedTheme !== selectedTheme) {
            console.log('🎨 Mobile: Applied theme change from web organizer:', sessionData.selectedTheme);
            setIsUpdatingFromConfigSync(true);
            setSelectedTheme(sessionData.selectedTheme);
            setLastConfigUpdateTime(now);
            hasConfigChanges = true;
          }

          // Wheel type changes
          if (sessionData.selectedWheelType &&
              JSON.stringify(sessionData.selectedWheelType) !== JSON.stringify(currentWheelType)) {
            console.log('🎯 Mobile: Applied wheel type change from web organizer:', sessionData.selectedWheelType.label);
            setIsUpdatingFromConfigSync(true);
            setCurrentWheelType(sessionData.selectedWheelType);
            if (sessionData.selectedWheelType.defaultItems) {
              setCurrentWheelItems(sessionData.selectedWheelType.defaultItems);
            }
            setLastConfigUpdateTime(now);
            hasConfigChanges = true;
          }

          // Custom items changes - but don't override when switching TO image picker wheel
          if (sessionData.wheelItems &&
              JSON.stringify(sessionData.wheelItems) !== JSON.stringify(currentWheelItems)) {

            // Don't apply wheel items change if we're switching TO image picker wheel
            // and we have existing items that we want to preserve
            const isSwitchingToImagePicker = sessionData.selectedWheelType?.value === 'image-picker' &&
                                           currentWheelType?.value !== 'image-picker' &&
                                           currentWheelItems.length > 0;

            if (!isSwitchingToImagePicker) {
              console.log('📝 Mobile: Applied wheel items change from web organizer');
              setIsUpdatingFromConfigSync(true);
              setCurrentWheelItems(sessionData.wheelItems);
              setLastConfigUpdateTime(now);
              hasConfigChanges = true;
            } else {
              console.log('📝 Mobile: Skipping wheel items change when switching to image picker (preserving existing items)');
            }
          }



          // Text field changes - heavily throttled
          const textFields = [
            { key: 'customTitle', state: customWheelTitle, setter: setCustomWheelTitle },
            { key: 'customMessage', state: customMessage, setter: setCustomMessage },
            { key: 'customWinnerWord', state: customWinnerWord, setter: setCustomWinnerWord }
          ];

          textFields.forEach(({ key, state, setter }) => {
            if (sessionData[key] && sessionData[key] !== state && now - lastConfigUpdateTime > 3000) {
              console.log(`📝 Mobile: Applied ${key} change from web organizer`);
              setIsUpdatingFromConfigSync(true);
              setter(sessionData[key]);
              setLastConfigUpdateTime(now);
              hasConfigChanges = true;
            }
          });

          // Reset config sync flag after delay
          if (hasConfigChanges) {
            setTimeout(() => setIsUpdatingFromConfigSync(false), 5000);
          }
        }

        // 🎡 SPIN STATE MANAGEMENT - Single source of truth
        const shouldBeSpinning = wheelState?.currentState === 'spinning' || wheelState?.isSpinning === true;
        const isCurrentlySpinning = spinState.isInProgress || isSpinning;

        // Handle spin start
        if (shouldBeSpinning && !isCurrentlySpinning && !spinCompleted) {
          console.log('🎡 REMOTE SPIN START: Detected organizer spin');

          // Determine if this is our own spin to prevent loops
          const isPrimaryOrganizer = session?.createdBy === currentUser?.uid;
          const isCollaborator = isOrganizerCollaborator();
          const lastSpinInitiator = wheelState?.lastSpinInitiator || wheelState?.spinInitiator;
          const isFromPrimaryOrganizer = lastSpinInitiator === session?.createdBy;
          const isFromCurrentUser = lastSpinInitiator === currentUser?.uid;

          // Only respond to primary organizer commands (unless it's our own spin)
          if (isPrimaryOrganizer || isFromPrimaryOrganizer || isFromCurrentUser) {
            setSpinState({
              isInProgress: true,
              currentSpinId: Date.now().toString(),
              lastWinnerAnnounced: null,
              lastWinnerTime: 0
            });
            setIsSpinning(true);
            setSpinCompleted(false);
            setShowWinnerPopup(false);
            setShowConfetti(false);
            setForceSpinTrigger(prev => prev + 1);

            if (wheelState?.forcedWinner || wheelState?.predictedWinner) {
              setForceSpinWinner(wheelState.forcedWinner || wheelState.predictedWinner);
            }
          }
        }

        // Handle spin completion
        if (!shouldBeSpinning && isCurrentlySpinning) {
          console.log('🛑 SPIN COMPLETED: Organizer stopped spinning');

          setSpinState({
            isInProgress: false,
            currentSpinId: null,
            lastWinnerAnnounced: wheelState?.winner || null,
            lastWinnerTime: Date.now()
          });
          setIsSpinning(false);
          setSpinCompleted(true);

          // Announce winner
          if (wheelState?.winners && wheelState.winners.length > 0 && !showWinnerPopup) {
            const notificationId = `${wheelState.winners.length}-${wheelState.completedAt?.seconds || 0}`;
            if (lastWinnerNotificationId !== notificationId) {
              setLastWinnerNotificationId(notificationId);
              setShowWinnerPopup(true);
              setShowConfetti(true);
              setConfettiTrigger(prev => prev + 1);
              setTimeout(() => setShowConfetti(false), 3000);
            }
          }
        }

        // Handle winner announcements from resultNotification
        if (sessionData.resultNotification &&
            sessionData.resultNotification.isActive &&
            sessionData.resultNotification.showConfetti &&
            spinCompleted &&
            !isSpinning &&
            !showWinnerPopup) {

          const notificationId = `${sessionData.resultNotification.timestamp?.seconds || 0}-${sessionData.resultNotification.winners?.length || 0}`;
          if (lastWinnerNotificationId !== notificationId) {
            setLastWinnerNotificationId(notificationId);
            setShowWinnerPopup(true);
            setShowConfetti(true);
            setConfettiTrigger(prev => prev + 1);
            setTimeout(() => setShowConfetti(false), 5000);
          }
        }
      },
      (error) => {
        console.error('❌ Consolidated session listener error:', error);
        setError('Lost connection to session');
        setConnectionQuality('poor');
      }
    );

    // Comments listener
    const commentsUnsubscribe = CrossPlatformSessionManager.listenToComments(sessionId, (commentsData) => {
      setComments(commentsData.reverse());
    });

    // Viewers listener
    const viewersUnsubscribe = CrossPlatformSessionManager.listenToViewers(sessionId, (viewersData) => {
      setViewers(viewersData);
    });

    // Notifications listener for participant leaving events
    const notificationsUnsubscribe = onSnapshot(
      collection(db, 'liveDrawSessions', sessionId, 'notifications'),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const notification = change.doc.data();
            if (notification.type === 'participant_left') {
              // Show notification to organizer
              Alert.alert(
                'Participant Left',
                `${notification.participantName} has left the live session`,
                [{ text: 'OK' }]
              );
              console.log(`👤 ORGANIZER: ${notification.participantName} left the session`);
            }
          }
        });
      },
      (error) => {
        console.error('Error listening to notifications:', error);
      }
    );

    // Cleanup function
    return () => {
      console.log('🔄 Cleaning up all session listeners');
      consolidatedUnsubscribe();
      commentsUnsubscribe();
      viewersUnsubscribe();
      notificationsUnsubscribe();
      cleanupAllListeners();
    };
  };

  // Handle wheel type change
  const handleWheelTypeChange = async (wheelType: any) => {
    if (!session) return;

    // Prevent duplicate wheel type changes
    if (JSON.stringify(currentWheelType) === JSON.stringify(wheelType)) {
      console.log('⚠️ Ignoring duplicate wheel type change');
      return;
    }

    // Prevent changes if we're currently updating from config sync
    if (isUpdatingFromConfigSync) {
      console.log('⚠️ Ignoring wheel type change during config sync');
      return;
    }

    try {
      setIsUpdatingFromConfigSync(true); // Prevent config sync loop
      
      // INSTANT WHEEL TYPE UPDATE - Set immediately
      setCurrentWheelType(wheelType);

      // Update wheel items immediately - but preserve images for image picker wheels
      if (wheelType.defaultItems) {
        // If switching TO image picker wheel, keep existing items if they exist
        // If switching FROM image picker wheel, keep the items but they won't be used
        // If switching between non-image wheels, use default items
        if (wheelType.value === 'image-picker' && currentWheelItems.length > 0) {
          // Keep existing items when switching to image picker
          console.log('🖼️ Preserving existing wheel items for image picker wheel');
        } else if (currentWheelType?.value === 'image-picker') {
          // Switching away from image picker - keep items for potential return
          console.log('🖼️ Keeping image picker items for potential return');
        } else {
          // Normal wheel type change
          setCurrentWheelItems(wheelType.defaultItems);
        }
      }

      // Update Firebase in background (no await to prevent blocking UI)
      CrossPlatformSessionManager.updateWheelType(
        session.id,
        wheelType,
        currentUser?.uid || 'organizer'
      ).then(() => {
        console.log('✅ Wheel type updated in Firebase');
      }).catch((error) => {
        console.error('❌ Failed to update wheel type in Firebase:', error);
      });

      // Reset the flag immediately (no delay)
      setImmediate(() => {
        setIsUpdatingFromConfigSync(false);
      });
    } catch (error) {
      console.error('Error changing wheel type:', error);
      setIsUpdatingFromConfigSync(false); // Reset flag on error
      Alert.alert('Error', 'Failed to change wheel type');
    }
  };

  // Handle spin completion with proper timing and state management
  const handleSpinComplete = async (result: any) => {
    if (!session || spinCompleted || isSpinning) return; // Prevent duplicate processing

    try {
      // Mark spin as completed and not spinning anymore
      setSpinCompleted(true);
      setIsSpinning(false);

      const winnerObjects = result.winners.map((winner: string, index: number) => ({
        id: `winner-${Date.now()}-${index}`,
        name: winner
      }));

      // Update session with winners
      await updateDoc(doc(db, 'liveDrawSessions', session.id), {
        winners: winnerObjects,
        currentState: 'completed',
        isSpinning: false,
        resultNotification: {
          message: winnerObjects.length === 1
            ? (customMessage || `🎉 ${customWinnerWord}: ${winnerObjects[0].name}! 🎊`).replace('{name}', winnerObjects[0].name).replace('{winner}', customWinnerWord?.toLowerCase() || 'winner')
            : `🎉 ${customWinnerWord ? `${customWinnerWord}s` : 'Winners'}: ${winnerObjects.map((w: any) => w.name).join(', ')}!`,
          winners: winnerObjects,
          timestamp: serverTimestamp(),
          isActive: true,
          showConfetti: true,
          priority: 'immediate'
        },
        updatedAt: serverTimestamp()
      });

      // Add delay before showing winner popup to ensure wheel has fully stopped
      // and arrow is properly positioned to the winner
      setTimeout(() => {
        // Double-check that spin is still completed and not spinning (no new spin started)
        if (spinCompleted && !isSpinning && !showWinnerPopup) {
          setShowWinnerPopup(true);
          setShowConfetti(true);
          setConfettiTrigger(prev => prev + 1);

          // Auto-hide confetti after 5 seconds
          setTimeout(() => {
            setShowConfetti(false);
          }, 5000);
        }
      }, 300); // 300ms delay to ensure visual stability and prevent glitches
    } catch (error) {
      console.error('Error announcing winners:', error);
      setSpinCompleted(false); // Reset state on error
      setIsSpinning(false); // Reset spinning state on error
    }
  };


  // Generate QR code
  const generateQRCode = () => {
    // Use session room code if available, otherwise use the pre-generated room code
    const code = session?.roomCode || roomCode;
    if (!code) {
      Alert.alert('Error', 'No room code available. Please create the activity first.');
      return;
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(code)}&color=${COLORS.primary.replace('#', '')}&bgcolor=ffffff`;
    setQrCodeUrl(qrUrl);
    setIsQrDialogOpen(true);
  };

  // End session
  const endSession = async () => {
    if (!session) return;

    Alert.alert(
      'End Session',
      'Are you sure you want to end this live session? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🛑 Starting session end process...');
              
              // Step 1: Clean up all listeners and state FIRST
              console.log('🧹 Cleaning up listeners and state...');
              cleanupAllListeners();

              // Step 2: Ensure we have a valid wheel type before saving to history
              let wheelTypeToSave = currentWheelType;

              // If currentWheelType is undefined, try to get from AVAILABLE_WHEEL_TYPES
              if (!wheelTypeToSave && AVAILABLE_WHEEL_TYPES && AVAILABLE_WHEEL_TYPES.length > 0) {
                wheelTypeToSave = AVAILABLE_WHEEL_TYPES[0];
              }

              // Final fallback if still undefined
              if (!wheelTypeToSave) {
                wheelTypeToSave = getSafeWheelType();
              }

              // Double-check that wheelTypeToSave is not undefined
              if (!wheelTypeToSave) {
                console.error('❌ CRITICAL: wheelTypeToSave is still undefined after all fallbacks');
                throw new Error('Unable to determine wheel type for session history');
              }

              // Step 3: Save session to history before ending
              console.log('📝 Preparing session history data...');
              console.log('🔍 wheelTypeToSave:', wheelTypeToSave);
              console.log('🔍 currentWheelType:', currentWheelType);
              console.log('🔍 AVAILABLE_WHEEL_TYPES length:', AVAILABLE_WHEEL_TYPES?.length);

              // Clean wheel type object - remove undefined properties to prevent Firebase errors
              const cleanWheelType = {
                id: wheelTypeToSave.id || 'unknown',
                name: wheelTypeToSave.name || 'Unknown Wheel',
                label: wheelTypeToSave.label || wheelTypeToSave.name || 'Unknown Wheel',
                value: wheelTypeToSave.value || 'unknown',
                icon: wheelTypeToSave.icon || '🎯',
                category: wheelTypeToSave.category || 'personal',
                color: wheelTypeToSave.color || '#8e0b16',
                isCustomizable: wheelTypeToSave.isCustomizable !== undefined ? wheelTypeToSave.isCustomizable : true,
                enabled: wheelTypeToSave.enabled !== undefined ? wheelTypeToSave.enabled : true,
                allowedRoles: wheelTypeToSave.allowedRoles || ['organizer', 'admin', 'teacher'],
                description: wheelTypeToSave.description || '',
                supportsImages: wheelTypeToSave.supportsImages !== undefined ? wheelTypeToSave.supportsImages : false
              };

              const historyData = {
                sessionId: session.id,
                organizerId: currentUser?.uid || 'unknown',
                organizerName: userProfile?.fullName || currentUser?.email?.split('@')[0] || 'Unknown Organizer',
                roomCode: session.roomCode || roomCode,
                wheelType: cleanWheelType,
                wheelItems: currentWheelItems || [],
                selectedTheme: selectedTheme || 'school',
                customWheelTitle: customWheelTitle || '',
                customMessage: customMessage || `🎉 ${customWinnerWord}: {name}! 🎊`,
                customWinnerWord: customWinnerWord || 'Winner',
                allowManualWinnerSelection: allowManualWinnerSelection || false,
                winners: session.winners || [],
                participantsCount: viewers?.length || 0,
                commentsCount: comments?.length || 0,
                createdAt: session.createdAt || serverTimestamp(),
                endedAt: serverTimestamp(),
                duration: session.createdAt ? (new Date().getTime() - session.createdAt.toMillis()) / 1000 : 0,
                platform: 'mobile'
              };

              console.log('📝 Session history data prepared:', {
                sessionId: session.id,
                wheelTypeId: wheelTypeToSave?.id,
                wheelTypeName: wheelTypeToSave?.name,
                hasWheelType: !!wheelTypeToSave
              });

              console.log('💾 Saving session to history...');
              try {
                await addDoc(collection(db, 'liveWheelHistory'), historyData);
                console.log('✅ Session successfully saved to history');
              } catch (addDocError) {
                console.error('❌ Error saving to history:', addDocError);
                console.error('📝 History data that failed:', JSON.stringify(historyData, null, 2));

                // Try to identify the problematic field
                if (addDocError && typeof addDocError === 'object' && 'message' in addDocError && typeof addDocError.message === 'string' && addDocError.message.includes('wheelType')) {
                  console.error('🚨 wheelType issue detected:', {
                    wheelTypeToSave: wheelTypeToSave,
                    wheelTypeToSaveType: typeof wheelTypeToSave,
                    wheelTypeToSaveKeys: wheelTypeToSave ? Object.keys(wheelTypeToSave) : 'null/undefined'
                  });
                }

                // Don't re-throw for history save errors - continue with session end
                console.warn('⚠️ Continuing session end despite history save error');
              }

              // Step 4: End the session in Firebase
              console.log('🔚 Ending session in database...');
              try {
                await CrossPlatformSessionManager.endSession(session.id);
                console.log('✅ Session ended in database');
              } catch (endSessionError) {
                console.error('⚠️ Error ending session in database:', endSessionError);
                // Continue to navigation even if database end fails
              }

              // Step 5: Clear local session state
              console.log('🗑️ Clearing local session state...');
              setSession(null);
              setActivityCreated(false);
              setCurrentWheelType(null);
              setCurrentWheelItems([]);
              setCustomWheelTitle('');
              setCustomMessage('');
              setCustomWinnerWord('Winner');
              setAllowManualWinnerSelection(false);
              setSelectedTheme('school');
              setViewers([]);
              setComments([]);
              setIsSpinning(false);
              setShowWinnerPopup(false);
              setShowConfetti(false);

              console.log('✅ Local state cleared');

              // Step 6: Navigate back with error handling
              console.log('🚀 Navigating back to dashboard...');
              try {
                // Use setTimeout to ensure all state updates complete before navigation
                setTimeout(() => {
                  if (navigation && navigation.goBack) {
                    navigation.goBack();
                    console.log('✅ Successfully navigated back to dashboard');
                  } else {
                    console.error('❌ Navigation object not available');
                  }
                }, 300);
              } catch (navError) {
                console.error('❌ Navigation error:', navError);
                Alert.alert('Warning', 'Session ended but encountered a navigation issue. Please try again.');
              }

              Alert.alert('Success', 'Session ended and saved to history');
            } catch (error) {
              console.error('❌ Error ending session:', error);
              console.error('Error details:', JSON.stringify(error, null, 2));
              
              // Attempt to still navigate back even if there's an error
              try {
                console.log('🚀 Attempting navigation despite error...');
                setTimeout(() => {
                  if (navigation && navigation.goBack) {
                    navigation.goBack();
                  }
                }, 300);
              } catch (navError) {
                console.error('❌ Navigation also failed:', navError);
              }

              Alert.alert('Error', 'An error occurred while ending the session, but returning to dashboard.');
            }
          }
        }
      ]
    );
  };

  // Wheel items management functions with debouncing
  const addNewItem = () => {
    if (newItemText.trim()) {
      const newItems = [...currentWheelItems, newItemText.trim()];
      setCurrentWheelItems(newItems);
      setNewItemText('');

      // Debounced update session if exists
      if (session?.id) {
        setTimeout(() => {
          updateDoc(doc(db, 'liveDrawSessions', session.id), {
            wheelItems: newItems,
            updatedAt: serverTimestamp()
          }).catch((error) => {
            console.error('Error updating wheel items:', error);
          });
        }, 100);
      }
    }
  };

  const removeItem = (index: number) => {
    const newItems = currentWheelItems.filter((_, i) => i !== index);
    setCurrentWheelItems(newItems);

    // Debounced update session if exists
    if (session?.id) {
      setTimeout(() => {
        updateDoc(doc(db, 'liveDrawSessions', session.id), {
          wheelItems: newItems,
          updatedAt: serverTimestamp()
        }).catch((error) => {
          console.error('Error updating wheel items:', error);
        });
      }, 100);
    }
  };

  const resetItems = () => {
    const defaultItems = ['Team Alpha', 'Team Beta', 'Team Gamma', 'Team Delta'];
    setCurrentWheelItems(defaultItems);

    // Debounced update session if exists
    if (session?.id) {
      setTimeout(() => {
        updateDoc(doc(db, 'liveDrawSessions', session.id), {
          wheelItems: defaultItems,
          updatedAt: serverTimestamp()
        }).catch((error) => {
          console.error('Error resetting wheel items:', error);
        });
      }, 100);
    }
  };

  const shuffleItems = () => {
    const shuffled = [...currentWheelItems].sort(() => Math.random() - 0.5);
    setCurrentWheelItems(shuffled);

    // Debounced update session if exists
    if (session?.id) {
      setTimeout(() => {
        updateDoc(doc(db, 'liveDrawSessions', session.id), {
          wheelItems: shuffled,
          updatedAt: serverTimestamp()
        }).catch((error) => {
          console.error('Error shuffling wheel items:', error);
        });
      }, 100);
    }
  };

  // Student Selector functions
  const toggleStudentSelection = (student: string) => {
    setSelectedStudents((prev) =>
      prev.includes(student)
        ? prev.filter((s) => s !== student)
        : [...prev, student]
    );
  };

  const clearAllStudents = () => {
    setSelectedStudents([]);
  };

  const selectAllStudents = () => {
    setSelectedStudents([...currentWheelItems]);
  };

  const applyStudentSelection = () => {
    if (selectedStudents.length === 0) {
      Alert.alert('Warning', 'Please select at least one student');
      return;
    }
    setCurrentWheelItems(selectedStudents);
    if (session?.id) {
      updateDoc(doc(db, 'liveDrawSessions', session.id), {
        wheelItems: selectedStudents,
        updatedAt: serverTimestamp()
      }).catch((error) => {
        console.error('Error updating students:', error);
      });
    }
    setIsStudentSelectorOpen(false);
    Alert.alert('Success', `${selectedStudents.length} student(s) selected`);
  };

  // CSV Upload Handler
  const handleCSVUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if ('assets' in result && result.assets && result.assets.length > 0) {
        const fileUri = (result.assets[0] as any).uri;
        const fileContent = await FileSystem.readAsStringAsync(fileUri);
        
        // Parse CSV content
        const lines = fileContent.split('\n').filter(line => line.trim());
        const students = lines
          .map(line => {
            // Handle both comma and semicolon delimiters
            const values = line.split(/[,;]/).map(v => v.trim());
            // Take the first non-empty value from each line
            return values.find(v => v.length > 0) || '';
          })
          .filter(name => name.length > 0 && name.toLowerCase() !== 'student name' && name.toLowerCase() !== 'name');

        if (students.length === 0) {
          Alert.alert('Error', 'No valid student names found in CSV');
          return;
        }

        setUploadedStudents(students);
        setRandomSelectionCount(Math.min(10, students.length));
        Alert.alert('Success', `${students.length} students imported from CSV`);
        console.log('📊 CSV Uploaded:', students);
      }
    } catch (error) {
      console.error('Error uploading CSV:', error);
      Alert.alert('Error', 'Failed to upload CSV file');
    }
  };

  // Download CSV Template
  const downloadCSVTemplate = async () => {
    try {
      const templateContent = `Student Name
John Doe
Jane Smith
Michael Johnson
Sarah Williams
Emily Brown
David Jones
Jessica Garcia
Robert Martinez
Lisa Rodriguez
James Lee`;

      const fileName = 'student_template.csv';

      // For web platform, use native download
      if (Platform.OS === 'web') {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(templateContent));
        element.setAttribute('download', fileName);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        Alert.alert('Success', 'Template downloaded. Edit it and upload using the Upload CSV button.');
      } else {
        // For mobile platforms, just show alert with info
        Alert.alert(
          'Template Ready',
          `You can create a CSV file with this format:\n\nStudent Name\nJohn Doe\nJane Smith\nMichael Johnson\n\nThen upload it using the "Upload CSV" button.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error downloading template:', error);
      Alert.alert('Error', 'Failed to download template');
    }
  };

  // Random Selection from uploaded students
  const applyRandomSelection = () => {
    const source = uploadedStudents.length > 0 ? uploadedStudents : currentWheelItems;
    
    if (source.length === 0) {
      Alert.alert('Warning', 'No students available for random selection');
      return;
    }

    const count = Math.min(randomSelectionCount, source.length);
    const shuffled = [...source].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    setSelectedStudents(selected);
    setCurrentWheelItems(selected);

    if (session?.id) {
      updateDoc(doc(db, 'liveDrawSessions', session.id), {
        wheelItems: selected,
        updatedAt: serverTimestamp()
      }).catch((error) => {
        console.error('Error updating students:', error);
      });
    }

    setIsStudentSelectorOpen(false);
    Alert.alert('Success', `${count} random student(s) selected (${((count / source.length) * 100).toFixed(1)}%)`);
  };

  // Update wheel items when wheel type changes and sync with session
  // BUT DON'T update when switching TO image picker wheel (preserve existing items)
  useEffect(() => {
    if (currentWheelType && currentWheelType.defaultItems) {
      const newItems = currentWheelType.defaultItems;

      // Skip updating items if switching TO image picker wheel and we have existing items
      const isSwitchingToImagePicker = currentWheelType.value === 'image-picker' && currentWheelItems.length > 0;

      if (!isSwitchingToImagePicker) {
        // Only update if items are actually different
        if (JSON.stringify(newItems) !== JSON.stringify(currentWheelItems)) {
          setCurrentWheelItems(newItems);

          // Sync with session if it exists, but don't trigger config sync loop
          if (session?.id && !isUpdatingFromConfigSync) {
            updateDoc(doc(db, 'liveDrawSessions', session.id), {
              selectedWheelType: currentWheelType,
              wheelItems: newItems,
              updatedAt: serverTimestamp()
            }).catch((error) => {
              console.error('Error updating wheel type in session:', error);
            });
          }
        }
      } else {
        console.log('🖼️ [useEffect] Skipping wheel items update when switching to image picker (preserving existing items)');
      }
    }
  }, [currentWheelType?.id, session?.id, isUpdatingFromConfigSync]); // Removed currentWheelItems from dependencies to prevent loops

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Loading Organizer Room...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {showConfetti && (
        <ConfettiCannon
          key={confettiTrigger}
          count={300}
          origin={{ x: -10, y: 0 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={3000}
          explosionSpeed={350}
        />
      )}

      {/* Header */}
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              try {
                if (activityCreated) {
                  console.log('🛑 User initiated session end from header');
                  endSession();
                } else {
                  console.log('↩️ User navigating back from activity setup');
                  if (navigation && navigation.goBack) {
                    navigation.goBack();
                  } else {
                    console.error('❌ Navigation object not available');
                    Alert.alert('Error', 'Navigation error occurred');
                  }
                }
              } catch (error) {
                console.error('❌ Error in back button handler:', error);
                Alert.alert('Error', 'An error occurred. Please try again.');
              }
            }}
          >
            <Ionicons
              name={activityCreated ? "stop-circle" : "arrow-back"}
              size={24}
              color={COLORS.surface}
            />
          </TouchableOpacity>

          <View style={styles.headerTextContainer}>
            <Text style={styles.roomTitle}>
              {customWheelTitle || currentWheelType?.name || 'Activity Options'}
            </Text>
            {activityCreated && session?.roomCode && (
              <Text style={styles.roomCode}>
                Room: {session.roomCode}
              </Text>
            )}
            {activityCreated && (
              <View style={styles.statusContainer}>
                <View style={[styles.liveIndicator, {
                  backgroundColor: session?.isActive ? COLORS.success : COLORS.error
                }]}>
                  <Text style={styles.liveText}>
                    {session?.isActive ? 'LIVE' : 'ENDED'}
                  </Text>
                </View>
                <View style={[styles.connectionIndicator, {
                  backgroundColor: connectionQuality === 'excellent' ? COLORS.success :
                                   connectionQuality === 'good' ? COLORS.warning : COLORS.error
                }]}>
                  <Ionicons name="wifi" size={12} color={COLORS.surface} />
                </View>
              </View>
            )}
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={generateQRCode}
            >
              <Ionicons name="qr-code" size={20} color={COLORS.surface} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {activityCreated ? (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Wheel Type Selection - Collapsible */}
            <View style={styles.collapsibleWheelSection}>
            <TouchableOpacity
              style={styles.collapseHeader}
              onPress={() => setIsWheelTypeSectionMinimized(!isWheelTypeSectionMinimized)}
            >
              <View style={styles.collapseHeaderContent}>
                <Ionicons name="cog" size={20} color={COLORS.primary} />
                <Text style={styles.collapseHeaderText}>Wheel Types</Text>
                <Ionicons
                  name={isWheelTypeSectionMinimized ? "chevron-down" : "chevron-up"}
                  size={16}
                  color={COLORS.textSecondary}
                />
              </View>
            </TouchableOpacity>

            {!isWheelTypeSectionMinimized && (
              <View style={styles.wheelTypeContent}>
                {wheelTypes.length > 0 || customWheels.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.wheelTypeScroll}>
                    {/* Custom Wheels First */}
                    {customWheels.map((customWheel: any, index) => (
                      <TouchableOpacity
                        key={`custom-${customWheel.id}`}
                        style={[
                          styles.wheelTypeOption,
                          (currentWheelType?.id === customWheel.id) && styles.wheelTypeSelected
                        ]}
                        onPress={() => {
                          // Prevent duplicate wheel type changes
                          if (JSON.stringify(currentWheelType) === JSON.stringify(customWheel)) {
                            console.log('⚠️ Ignoring duplicate custom wheel selection');
                            return;
                          }

                          // Prevent changes if we're currently updating from config sync
                          if (isUpdatingFromConfigSync) {
                            console.log('⚠️ Ignoring custom wheel selection during config sync');
                            return;
                          }

                          setCurrentWheelType({
                            id: customWheel.id,
                            value: 'custom',
                            label: customWheel.name,
                            name: customWheel.name,
                            icon: '🎯',
                            category: 'custom',
                            color: '#8e0b16',
                            isCustomizable: true,
                            enabled: true,
                            allowedRoles: ['organizer', 'admin', 'teacher'],
                            defaultItems: customWheel.slices?.map((slice: any) => slice.text) || [],
                            description: customWheel.description || 'Custom wheel created by you',
                            supportsImages: false
                          });
                          setCurrentWheelItems(customWheel.slices?.map((slice: any) => slice.text) || []);

                          // Update session if exists
                          if (session?.id) {
                            updateDoc(doc(db, 'liveDrawSessions', session.id), {
                              selectedWheelType: {
                                id: customWheel.id,
                                value: 'custom',
                                label: customWheel.name,
                                name: customWheel.name,
                                icon: '🎯',
                                category: 'custom',
                                color: '#8e0b16',
                                isCustomizable: true,
                                enabled: true,
                                allowedRoles: ['organizer', 'admin', 'teacher'],
                                defaultItems: customWheel.slices?.map((slice: any) => slice.text) || [],
                                description: customWheel.description || 'Custom wheel created by you',
                                supportsImages: false
                              },
                              wheelItems: customWheel.slices?.map((slice: any) => slice.text) || [],
                              updatedAt: serverTimestamp()
                            }).catch((error) => {
                              console.error('Error updating custom wheel type:', error);
                            });
                          }
                        }}
                      >
                        <View style={styles.wheelTypeOptionContent}>
                          <Text style={styles.wheelTypeIcon}>🎯</Text>
                          <Text style={styles.wheelTypeLabel} numberOfLines={2} ellipsizeMode="tail">
                            {customWheel.name}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}

                    {/* Preset Wheel Types */}
                    {wheelTypes.map((wheelType: any, index) => (
                      <TouchableOpacity
                        key={wheelType.id || wheelType.value || `wheel-type-${index}`}
                        style={[
                          styles.wheelTypeOption,
                          (currentWheelType?.value === wheelType.value || currentWheelType?.id === wheelType.id) && styles.wheelTypeSelected
                        ]}
                        onPress={() => {
                          // Prevent duplicate wheel type changes
                          if (JSON.stringify(currentWheelType) === JSON.stringify(wheelType)) {
                            console.log('⚠️ Ignoring duplicate wheel type selection');
                            return;
                          }

                          // Prevent changes if we're currently updating from config sync
                          if (isUpdatingFromConfigSync) {
                            console.log('⚠️ Ignoring wheel type selection during config sync');
                            return;
                          }

                          setCurrentWheelType(wheelType);
                          // Update wheel items immediately - but preserve images for image picker wheels
                          if (wheelType.defaultItems) {
                            // If switching TO image picker wheel from a different wheel type, use descriptive names
                            // If already on image picker wheel, keep existing items
                            // If switching between non-image wheels, use default items
                            if (wheelType.value === 'image-picker' && currentWheelType?.value !== 'image-picker') {
                              // Switching TO image picker wheel from different type - use descriptive names
                              const imageLabels = ['Image 1', 'Image 2', 'Image 3', 'Image 4', 'Image 5'];
                              setCurrentWheelItems(imageLabels);
                              console.log('🖼️ Switching to image picker wheel - using image labels');
                            } else if (currentWheelType?.value === 'image-picker') {
                              // Switching away from image picker - keep items for potential return
                              console.log('🖼️ Keeping image picker items for potential return');
                            } else {
                              // Normal wheel type change between non-image wheels
                              setCurrentWheelItems(wheelType.defaultItems);
                            }
                          }
                          // Update session if exists
                          if (session?.id) {
                            updateDoc(doc(db, 'liveDrawSessions', session.id), {
                              selectedWheelType: wheelType,
                              wheelItems: wheelType.defaultItems || [],
                              updatedAt: serverTimestamp()
                            }).catch((error) => {
                              console.error('Error updating wheel type:', error);
                            });
                          }
                        }}
                      >
                        <View style={styles.wheelTypeOptionContent}>
                          <Text style={styles.wheelTypeIcon}>{wheelType.icon || '🎯'}</Text>
                          <Text style={styles.wheelTypeLabel} numberOfLines={2} ellipsizeMode="tail">
                            {wheelType.label || wheelType.name || 'Wheel'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.noWheelTypesContainer}>
                    <Ionicons name="alert-circle" size={24} color={COLORS.textSecondary} />
                    <Text style={styles.noWheelTypesText}>No wheel types available</Text>
                    <Text style={styles.noWheelTypesSubtext}>Please contact administrator</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Only show OrganizerWheel if NOT using team picker wheel */}
          {currentWheelType?.value !== 'team-picker' && (
            <OrganizerWheel
              sessionId={session?.id || ''}
              wheelType={currentWheelType}
              customItems={currentWheelItems}
              customTitle={customWheelTitle}
              customMessage={customMessage}
              customWinnerWord={customWinnerWord}
              allowManualWinnerSelection={allowManualWinnerSelection}
              selectedTheme={selectedTheme}
              onThemeChange={(theme: string) => {
                console.log('🎨 OrganizerWheel theme change callback:', theme);
                setSelectedTheme(theme);
              }}
              onSpinComplete={handleSpinComplete}
              onSpinStart={handleSpinStart}
              broadcastSource={
                // Determine broadcastSource based on user's role
                session?.createdBy === currentUser?.uid ? 'organizer' :
                isOrganizerCollaborator() ? 'full-access-collaborator' :
                'collaborator'
              }
              // 🔄 CRITICAL: Pass remote spin triggers for bidirectional sync
              forceSpinTrigger={forceSpinTrigger}
              forceSpinWinner={forceSpinWinner}
              isSpinningRemote={isSpinning}
              onForceSpinTriggerProcessed={() => {
                // Immediately reset the trigger to prevent infinite loops
                console.log('🔄 Resetting forceSpinTrigger to prevent infinite loops');
                setForceSpinTrigger(0);
                setForceSpinWinner(null);
              }}
              // 🖼️ CRITICAL: Pass stability mode for perfect image rendering during spins
              imageStabilityMode={currentWheelType?.value === 'image-picker'}
              // Image support for image picker wheels
              wheelImages={wheelImages}

            />
          )}

          {/* Winner Announcement - Show selected winner to participants */}
          {session?.winners && session.winners.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trophy" size={24} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Latest Winner</Text>
              </View>
              <View style={styles.winnerAnnouncement}>
                <Text style={styles.winnerAnnouncementText}>
                  🎉 {session.winners[0].name} has been selected! 🎉
                </Text>
              </View>
            </View>
          )}

          {/* Wheel Items Management Section - Now below the wheel */}

          {/* Image Picker Wheel Image URLs Section - Only show for image picker wheels */}
          {currentWheelType?.value === 'image-picker' && (
            <View style={styles.collapsibleWheelSection}>
              <TouchableOpacity
                style={styles.collapseHeader}
                onPress={() => setIsImagePickerSectionMinimized(!isImagePickerSectionMinimized)}
              >
                <View style={styles.collapseHeaderContent}>
                  <Ionicons name="images" size={20} color={COLORS.primary} />
                  <Text style={styles.collapseHeaderText}>Image URLs ({Object.values(imageUrls).filter(url => url.trim()).length}/5)</Text>
                  <Ionicons
                    name={isImagePickerSectionMinimized ? "chevron-down" : "chevron-up"}
                    size={16}
                    color={COLORS.textSecondary}
                  />
                </View>
              </TouchableOpacity>

              {!isImagePickerSectionMinimized && (
                <View style={styles.wheelTypeContent}>
                  <Text style={styles.itemsDescription}>
                    Paste image URLs for each wheel slot. Images will be displayed on the wheel.
                  </Text>

                  {/* Image URL Inputs */}
                  {[1, 2, 3, 4, 5].map((slotNumber) => {
                    const slotKey = `image-${slotNumber}`;
                    return (
                      <View key={slotKey} style={{ marginBottom: 16 }}>
                        <Text style={{
                          fontSize: Dimensions.get('window').width * 0.035,
                          fontWeight: '600',
                          color: COLORS.text,
                          marginBottom: 8
                        }}>
                          Image {slotNumber}
                        </Text>
                        <TextInput
                          style={styles.addItemInput}
                          value={imageUrls[slotKey]}
                          onChangeText={(text) => {
                            // Update local state only - Firebase sync handled by debounced useEffect
                            setImageUrls(prev => ({ ...prev, [slotKey]: text }));
                            // Note: Firebase sync happens automatically via useEffect with 1s debounce
                          }}
                          placeholder={`Paste image URL for slot ${slotNumber}...`}
                          placeholderTextColor={COLORS.textSecondary}
                          maxLength={10000} // Increased to support data URLs and long image URLs
                          multiline={true} // Allow multiline for long URLs
                          numberOfLines={2} // Show 2 lines by default
                          onSubmitEditing={() => {
                            // Handle URL submission with validation
                            const url = imageUrls[slotKey].trim();
                            if (url) {
                              // Enhanced URL validation - allow data URLs
                              if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
                                Alert.alert('Invalid URL', 'Please enter a valid URL starting with http://, https://, or data:');
                                return;
                              }

                              // Check for problematic social media URLs
                              if (url.includes('facebook.com') || url.includes('fbcdn.net')) {
                                Alert.alert(
                                  'Facebook Image Detected',
                                  'Facebook images are often blocked by browser security. Try using:\n\n• Direct image URLs from other sources\n• PP, Flickr, or direct image hosting\n• Upload images to a different service\n\nWould you like to continue anyway?',
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'Continue',
                                      onPress: () => Alert.alert('Success', `Image URL ${slotNumber} updated! Note: Facebook images may not display due to browser security.`)
                                    }
                                  ]
                                );
                                return;
                              }

                              if (url.includes('instagram.com')) {
                                Alert.alert(
                                  'Instagram Image Detected',
                                  'Instagram images are often blocked by browser security. Try using:\n\n• Direct image URLs from other sources\n• Imgur, Flickr, or direct image hosting\n\nWould you like to continue anyway?',
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'Continue',
                                      onPress: () => Alert.alert('Success', `Image URL ${slotNumber} updated! Note: Instagram images may not display due to browser security.`)
                                    }
                                  ]
                                );
                                return;
                              }

                              Alert.alert('Success', `Image URL ${slotNumber} updated!`);
                            }
                          }}
                        />
                        {imageUrls[slotKey].trim() && (
                          <Text style={{
                            fontSize: Dimensions.get('window').width * 0.028,
                            color: COLORS.textSecondary,
                            marginTop: 4,
                            fontStyle: 'italic'
                          }}>
                            URL set ✓
                          </Text>
                        )}
                      </View>
                    );
                  })}

                  {/* Action Buttons */}
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={[styles.wheelActionButton, styles.resetButton]}
                      onPress={() => {
                        const resetUrls = {
                          'image-1': '',
                          'image-2': '',
                          'image-3': '',
                          'image-4': '',
                          'image-5': ''
                        };
                        setImageUrls(resetUrls);
                        setCurrentWheelItems([]);

                        // Sync with session
                        if (session?.id) {
                          updateDoc(doc(db, 'liveDrawSessions', session.id), {
                            wheelItems: [],
                            imageUrls: resetUrls,
                            updatedAt: serverTimestamp()
                          }).catch((error) => {
                            console.error('Error resetting image URLs:', error);
                          });
                        }

                        Alert.alert('Success', 'All image URLs cleared!');
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="refresh"
                        size={Dimensions.get('window').width * 0.04}
                        color={COLORS.text}
                      />
                      <Text style={styles.actionButtonText}>Clear All</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.wheelActionButton]}
                      onPress={() => setIsThemePresetsOpen(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="color-palette-outline"
                        size={Dimensions.get('window').width * 0.04}
                        color={COLORS.text}
                      />
                      <Text style={styles.actionButtonText}>Theme</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Congratulation Message Input */}
                  <View style={styles.congratsMessageContainer}>
                    <Text style={styles.congratsMessageLabel}>
                      Congratulation Message:
                    </Text>
                    <TextInput
                      style={styles.congratsMessageInput}
                      value={customMessage}
                      onChangeText={setCustomMessage}
                      placeholder="🎉 Congratulations {name}! You're our lucky {winner}! 🎊"
                      placeholderTextColor={COLORS.textSecondary}
                      multiline
                      maxLength={200}
                      textAlignVertical="top"
                    />
                    <Text style={styles.congratsMessageHelper}>
                      Use {'{name}'} for winner's name and {'{winner}'} for winner word
                    </Text>
                    <TouchableOpacity
                      style={styles.congratsMessageButton}
                      onPress={() => {
                        if (session?.id) {
                          updateDoc(doc(db, 'liveDrawSessions', session.id), {
                            customMessage: customMessage,
                            updatedAt: serverTimestamp()
                          }).then(() => {
                            Alert.alert('Success', 'Congratulation message updated!');
                          }).catch((error) => {
                            console.error('Error updating congratulation message:', error);
                            Alert.alert('Error', 'Failed to update congratulation message');
                          });
                        }
                      }}
                    >
                      <Text style={styles.congratsMessageButtonText}>Save Message</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Wheel Items Management Section - Only show for non-image picker and non-team picker wheels */}
          {currentWheelType?.value !== 'image-picker' && currentWheelType?.value !== 'team-picker' && (
            <View style={styles.collapsibleWheelSection}>
              <TouchableOpacity
                style={styles.collapseHeader}
                onPress={() => setIsWheelItemsSectionMinimized(!isWheelItemsSectionMinimized)}
              >
                <View style={styles.collapseHeaderContent}>
                  <Ionicons name="list" size={20} color={COLORS.primary} />
                  <Text style={styles.collapseHeaderText}>Current Items ({currentWheelItems.length})</Text>
                  <Ionicons
                    name={isWheelItemsSectionMinimized ? "chevron-down" : "chevron-up"}
                    size={16}
                    color={COLORS.textSecondary}
                  />
                </View>
              </TouchableOpacity>

              {!isWheelItemsSectionMinimized && (
                <View style={styles.wheelTypeContent}>
                  <Text style={styles.itemsDescription}>
                    Add custom items for your wheel. Click to remove items.
                  </Text>

                  {/* Current Items List */}
                  <View style={styles.itemsContainer}>
                    {currentWheelItems.length > 0 ? (
                      currentWheelItems.map((item, index) => (
                        <TouchableOpacity
                          key={`wheel-item-${index}-${item}`}
                          style={styles.itemTag}
                          onPress={() => removeItem(index)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.itemText} numberOfLines={1} ellipsizeMode="tail">
                            {item}
                          </Text>
                          <Ionicons
                            name="close-circle"
                            size={Dimensions.get('window').width * 0.04}
                            color={COLORS.error}
                          />
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={styles.noItemsText}>No items added yet</Text>
                    )}
                  </View>

                  {/* Add New Item */}
                  <View style={styles.addItemContainer}>
                    <TextInput
                      style={styles.addItemInput}
                      value={newItemText}
                      onChangeText={setNewItemText}
                      placeholder="Enter name or item..."
                      placeholderTextColor={COLORS.textSecondary}
                      maxLength={50}
                      onSubmitEditing={addNewItem}
                    />
                    <TouchableOpacity
                      style={[styles.addItemButton, !newItemText.trim() && styles.addItemButtonDisabled]}
                      onPress={addNewItem}
                      disabled={!newItemText.trim()}
                    >
                      <Ionicons name="add" size={20} color="#ffffff" />
                    </TouchableOpacity>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={[styles.wheelActionButton, styles.resetButton]}
                      onPress={resetItems}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="refresh"
                        size={Dimensions.get('window').width * 0.04}
                        color={COLORS.text}
                      />
                      <Text style={styles.actionButtonText}>Reset</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.wheelActionButton]}
                      onPress={() => setIsStudentSelectorOpen(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="people"
                        size={Dimensions.get('window').width * 0.04}
                        color={COLORS.text}
                      />
                      <Text style={styles.actionButtonText}>Student Selector</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.wheelActionButton, styles.shuffleButton]}
                      onPress={shuffleItems}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="shuffle"
                        size={Dimensions.get('window').width * 0.04}
                        color={COLORS.text}
                      />
                      <Text style={styles.actionButtonText}>Shuffle</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.wheelActionButton]}
                      onPress={() => setIsThemePresetsOpen(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="color-palette-outline"
                        size={Dimensions.get('window').width * 0.04}
                        color={COLORS.text}
                      />
                      <Text style={styles.actionButtonText}>Theme</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Congratulation Message Input */}
                  <View style={styles.congratsMessageContainer}>
                    <Text style={styles.congratsMessageLabel}>
                      Congratulation Message:
                    </Text>
                    <TextInput
                      style={styles.congratsMessageInput}
                      value={customMessage}
                      onChangeText={setCustomMessage}
                      placeholder="🎉 Congratulations {name}! You're our lucky {winner}! 🎊"
                      placeholderTextColor={COLORS.textSecondary}
                      multiline
                      maxLength={200}
                      textAlignVertical="top"
                    />
                    <Text style={styles.congratsMessageHelper}>
                      Use {'{name}'} for winner's name and {'{winner}'} for winner word
                    </Text>
                    <TouchableOpacity
                      style={styles.congratsMessageButton}
                      onPress={() => {
                        if (session?.id) {
                          updateDoc(doc(db, 'liveDrawSessions', session.id), {
                            customMessage: customMessage,
                            updatedAt: serverTimestamp()
                          }).then(() => {
                            Alert.alert('Success', 'Congratulation message updated!');
                          }).catch((error) => {
                            console.error('Error updating congratulation message:', error);
                            Alert.alert('Error', 'Failed to update congratulation message');
                          });
                        }
                      }}
                    >
                      <Text style={styles.congratsMessageButtonText}>Save Message</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}




          {/* Team Picker Section - Only show if using team picker wheel */}
          {currentWheelType?.value === 'team-picker' && (
            <View style={styles.collapsibleWheelSection}>
              <TouchableOpacity
                style={styles.collapseHeader}
                onPress={() => setIsTeamPickerSectionMinimized(!isTeamPickerSectionMinimized)}
              >
                <View style={styles.collapseHeaderContent}>
                  <Ionicons name="people" size={20} color={COLORS.primary} />
                  <Text style={styles.collapseHeaderText}>Team Picker</Text>
                  <Ionicons
                    name={isTeamPickerSectionMinimized ? "chevron-down" : "chevron-up"}
                    size={16}
                    color={COLORS.textSecondary}
                  />
                </View>
              </TouchableOpacity>

              {!isTeamPickerSectionMinimized && (
                <View style={styles.wheelTypeContent}>
                  <TeamPickerScreen sessionId={session?.id} />
                </View>
              )}
        </View>
      )}

      {/* Research Participant Selection Section - Only show if using research participant wheel */}
      {currentWheelType?.value === 'research-participant' && (
        <View style={styles.collapsibleWheelSection}>
          <TouchableOpacity
            style={styles.collapseHeader}
            onPress={() => setIsWheelItemsSectionMinimized(!isWheelItemsSectionMinimized)}
          >
            <View style={styles.collapseHeaderContent}>
              <Ionicons name="document" size={20} color={COLORS.primary} />
              <Text style={styles.collapseHeaderText}>Research Participants ({currentWheelItems.length})</Text>
              <Ionicons
                name={isWheelItemsSectionMinimized ? "chevron-down" : "chevron-up"}
                size={16}
                color={COLORS.textSecondary}
              />
            </View>
          </TouchableOpacity>

          {!isWheelItemsSectionMinimized && (
            <View style={styles.wheelTypeContent}>
              <ResearchParticipantSelectionUI
                uploadedStudents={currentWheelItems.length}
                selectedCount={0}
                onDownloadTemplate={() => {
                  Alert.alert('Download Template', 'CSV template download initiated. Check your downloads folder.');
                }}
                onUploadFile={async () => {
                  try {
                    // Open file picker to select CSV file
                    const result = await DocumentPicker.getDocumentAsync({
                      type: 'text/csv',
                    });

                    if (!result.canceled && result.assets && result.assets[0]) {
                      const file = result.assets[0];
                      console.log('Selected file:', file);

                      // Read file content
                      const fileContent = await FileSystem.readAsStringAsync(file.uri);
                      const lines = fileContent.split('\n').filter(line => line.trim());
                      
                      // Parse CSV (assuming simple format with one student name per line or first column)
                      let students: string[] = [];
                      lines.forEach((line, index) => {
                        if (index === 0 && line.toLowerCase().includes('name')) return; // Skip header
                        const studentName = line.split(',')[0].trim();
                        if (studentName) students.push(studentName);
                      });

                      if (students.length > 50) {
                        students = students.slice(0, 50);
                        Alert.alert('Info', `File contains more than 50 students. Using first 50 students.`);
                      }

                      // Update wheel items with student names
                      setCurrentWheelItems(students);

                      // Sync with session
                      if (session?.id) {
                        await updateDoc(doc(db, 'liveDrawSessions', session.id), {
                          wheelItems: students,
                          updatedAt: serverTimestamp()
                        });
                      }

                      Alert.alert('Success', `✅ ${students.length} students uploaded!\n\nYou can now use the Random Selection controls to pick participants.`);
                    }
                  } catch (error) {
                    console.error('Error picking file:', error);
                    Alert.alert('Error', 'Failed to upload student list. Please try again.');
                  }
                }}
                onSelectCountChange={(count: number) => {
                  console.log('Selected students:', count);
                }}
              />
            </View>
          )}
        </View>
      )}

      {/* Live Comments Section */}
      <View style={styles.liveCommentsSection}>
            <View style={styles.commentsHeader}>
              <Ionicons
                name="chatbubble"
                size={Dimensions.get('window').width * 0.05}
                color={COLORS.primary}
              />
              <Text style={styles.commentsTitle}>Live Chat</Text>
            </View>

            {/* Comments Display */}
            <ScrollView
              style={styles.commentsContainer}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Dimensions.get('window').height * 0.01 }}
            >
              {comments.length > 0 ? (
                comments.map((comment: Comment, index) => (
                  <View key={comment.id || `comment-${index}`} style={styles.commentItem}>
                    <Text style={styles.commentUser}>{comment.userName}</Text>
                    <Text style={styles.commentText}>{comment.text}</Text>
                    <Text style={styles.commentTime}>
                      {comment.timestamp ? new Date(comment.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noCommentsText}>No comments yet...</Text>
              )}
            </ScrollView>

          </View>

          {/* Participants Section - Now below the wheel */}
          <View style={styles.participantsSection}>
            <View style={styles.participantsHeader}>
              <Ionicons
                name="people"
                size={Dimensions.get('window').width * 0.05}
                color={COLORS.primary}
              />
              <Text style={styles.participantsTitle}>Participants ({viewers.length})</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.participantsScroll}
              contentContainerStyle={{ paddingVertical: Dimensions.get('window').height * 0.005 }}
            >
              {viewers.length > 0 ? (
                viewers.map((viewer: any, index) => (
                  <View key={viewer.id || `viewer-${index}`} style={styles.participantItem}>
                    <View style={styles.participantAvatar}>
                      <Text style={styles.participantInitial}>
                        {viewer.name?.charAt(0)?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <Text style={styles.participantName} numberOfLines={1} ellipsizeMode="tail">
                      {viewer.name || 'Anonymous'}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noParticipantsText}>Waiting for participants...</Text>
              )}
            </ScrollView>
          </View>
 
     </ScrollView>
   ) : (
     <ScrollView
          ref={activityScrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
          bounces={true}
          alwaysBounceVertical={true}
          scrollEventThrottle={16}
          decelerationRate="normal"
          contentInsetAdjustmentBehavior="automatic"
          overScrollMode="always"
        >
          {/* Activity Options Header */}
          <View style={styles.activityHeader}>
            <Text style={styles.activityTitle}>Configure sharing, scheduling, and interaction options for your wheel activity</Text>
          </View>

          {/* Max Participants */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={24} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Max Participants</Text>
            </View>
            <View style={styles.optionContainer}>
              <Text style={styles.optionDescription}>
                Limit how many participants can join this wheel or live session.
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.numberInput}
                  value={maxParticipants}
                  onChangeText={setMaxParticipants}
                  keyboardType="numeric"
                  placeholder="50"
                />
              </View>
            </View>
          </View>

          {/* Allow Reactions */}
          <View style={styles.section}>
            <View style={styles.optionContainer}>
              <View style={styles.optionHeader}>
                <Ionicons name="heart" size={24} color={COLORS.primary} />
                <Text style={styles.optionTitle}>Allow Reactions</Text>
              </View>
              <Text style={styles.optionDescription}>
                Students can react with emojis
              </Text>
              <TouchableOpacity
                style={[styles.toggleButton, allowReactions && styles.toggleActive]}
                onPress={() => setAllowReactions(!allowReactions)}
              >
                <Text style={[styles.toggleText, allowReactions && styles.toggleTextActive]}>
                  {allowReactions ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Confetti Effect */}
          <View style={styles.section}>
            <View style={styles.optionContainer}>
              <View style={styles.optionHeader}>
                <Ionicons name="sparkles" size={24} color={COLORS.primary} />
                <Text style={styles.optionTitle}>Confetti Effect</Text>
              </View>
              <Text style={styles.optionDescription}>
                Show confetti when winners are selected
              </Text>
              <TouchableOpacity
                style={[styles.toggleButton, confettiEffect && styles.toggleActive]}
                onPress={() => setConfettiEffect(!confettiEffect)}
              >
                <Text style={[styles.toggleText, confettiEffect && styles.toggleTextActive]}>
                  {confettiEffect ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sound Effects */}
          <View style={styles.section}>
            <View style={styles.optionContainer}>
              <View style={styles.optionHeader}>
                <Ionicons name="volume-high" size={24} color={COLORS.primary} />
                <Text style={styles.optionTitle}>Sound Effects</Text>
              </View>
              <Text style={styles.optionDescription}>
                Play sounds during spin
              </Text>
              <TouchableOpacity
                style={[styles.toggleButton, soundEffects && styles.toggleActive]}
                onPress={() => setSoundEffects(!soundEffects)}
              >
                <Text style={[styles.toggleText, soundEffects && styles.toggleTextActive]}>
                  {soundEffects ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Live Session */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="radio" size={24} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Room Code Display</Text>
              <View style={[styles.lockIndicator, styles.lockActive]}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.surface} />
                <Text style={styles.lockText}>Ready</Text>
              </View>
            </View>
            <View style={styles.optionContainer}>
              <Text style={styles.optionDescription}>
                Your room code is ready for participants to join your wheel activity
              </Text>
              <View style={styles.liveSessionActive}>
                <Text style={styles.roomCodeLabel}>Room Code:</Text>
                <Text style={[styles.roomCode, {
                  fontSize: 36,
                  fontWeight: 'bold',
                  color: COLORS.primary,
                  letterSpacing: 3,
                  textAlign: 'center',
                  marginVertical: 8
                }]}>
                  {roomCode}
                </Text>
                <Text style={styles.infoText}>
                  Share this code with participants to join your live session
                </Text>
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity style={[styles.wheelActionButton, { flex: 1 }]} onPress={() => {
                    const newCode = generateRoomCode();
                    setRoomCode(newCode);
                    Alert.alert('Success', `New room code generated: ${newCode}`);
                  }}>
                    <Ionicons name="refresh" size={16} color={COLORS.primary} />
                    <Text style={styles.actionButtonText}>Generate New Code</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.wheelActionButton, { flex: 1 }]} onPress={() => {
                    Clipboard.setString(roomCode);
                    Alert.alert('Success', 'Room code copied to clipboard');
                  }}>
                    <Ionicons name="copy" size={16} color={COLORS.primary} />
                    <Text style={styles.actionButtonText}>Copy Code</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.infoText}>
                  📱 This code will be active once you create the wheel activity
                </Text>
                <Text style={styles.infoText}>
                  🤝 Add organizer emails above to invite collaborators
                </Text>
              </View>
            </View>
          </View>

          {/* Collaboration & Sharing */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="share-social" size={24} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Collaboration & Sharing</Text>
            </View>
            <View style={styles.optionContainer}>
              <Text style={styles.sectionDescription}>
                Invite collaborators and choose modules to share with participants
              </Text>

              <View style={styles.optionContainer}>
                <View style={styles.optionHeader}>
                  <Ionicons name="sync" size={24} color={COLORS.primary} />
                  <Text style={styles.optionTitle}>🔄 Allow Data Sync</Text>
                </View>
                <Text style={styles.optionDescription}>
                  Keep activity data synced across collaborators
                </Text>
                <TouchableOpacity
                  style={[styles.toggleButton, allowDataSync && styles.toggleActive]}
                  onPress={() => setAllowDataSync(!allowDataSync)}
                >
                  <Text style={[styles.toggleText, allowDataSync && styles.toggleTextActive]}>
                    {allowDataSync ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.collaboratorSection}>
                <Text style={styles.collaboratorLabel}>Add Collaborators (emails, comma-separated)</Text>
                <TextInput
                  style={styles.emailInput}
                  value={collaboratorEmails}
                  onChangeText={setCollaboratorEmails}
                  placeholder="teacher2@example.com, coord@example.com"
                  multiline
                />
              </View>

              <View style={styles.permissionsSection}>
                <Text style={styles.permissionsLabel}>Default Permissions for Collaborators</Text>
                <TouchableOpacity style={styles.permissionsButton}>
                  <Text style={styles.permissionsText}>Full Access (Control, Edit, Manage)</Text>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                </TouchableOpacity>
                <Text style={styles.permissionsDescription}>
                  ✅ Full permissions: Can control live sessions, edit wheels, manage participants
                </Text>
                <Text style={styles.permissionsDescription}>
                  📧 Collaborators will receive real-time notifications in their dashboard to join the live session with selected permissions.
                </Text>
              </View>

              <View style={styles.emailPreview}>
                <Text style={styles.previewTitle}>Email Validation Preview:</Text>
                <Text style={styles.previewText}>✅ Valid Collaborators (2):</Text>
                <Text style={styles.previewText}>📧 teacher2@example.com (full)</Text>
                <Text style={styles.previewText}>📧 coord@example.com (full)</Text>
                <Text style={styles.previewText}>2 collaborator(s) will receive live room invitations with full permissions</Text>
                <Text style={styles.previewText}>📱 Room Code: {roomCode}</Text>
                <Text style={styles.previewText}>🎯 Wheel: Live Organizer Wheel</Text>
              </View>
            </View>
           </View>

           {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={async () => {
                if (!currentUser) return;

                setIsCreating(true);
                try {
                  // Generate room code
                  const newRoomCode = generateRoomCode();
                  setRoomCode(newRoomCode);
                  setIsLiveSessionActive(true);

                  // Use the default wheel type
                  const defaultWheelType = AVAILABLE_WHEEL_TYPES[0];
                  const wheelItems = defaultWheelType.defaultItems;

                  // Create session immediately
                  const newSession = await CrossPlatformSessionManager.createUniversalSession(
                    {
                      name: 'Live Organizer Wheel',
                      items: wheelItems
                    },
                    currentUser.uid,
                    'mobile',
                    activityId
                  );

                  setSession(newSession);
                  setCurrentWheelType(defaultWheelType);
                  setCurrentWheelItems(wheelItems);

                  // Update session with room code and other details
                  const themeObject = WHEEL_THEMES.find(t => t.id === selectedTheme) || WHEEL_THEMES[0];
                  await updateDoc(doc(db, 'liveDrawSessions', newSession.id), {
                    roomCode: newRoomCode,
                    selectedWheelType: defaultWheelType,
                    wheelItems: wheelItems,
                    selectedTheme: selectedTheme,
                    'wheelState.theme': {
                      primary: themeObject.colors[0] || '#8e0b16',
                      secondary: themeObject.colors[1] || '#66181E',
                      accent: "#ffffff", // White text for web compatibility
                      background: "#f8f9fa", // Light background for web compatibility
                      name: themeObject.name
                    },
                    'wheelState.themeUpdatedAt': serverTimestamp(),
                    isLiveSessionActive: true,
                    updatedAt: serverTimestamp()
                  });

                  // Start session listeners
                  startSessionListeners(newSession.id);

                  // Process collaborator invitations
                  if (collaboratorEmails.trim()) {
                    await processCollaboratorInvitations(
                      collaboratorEmails,
                      newSession.id,
                      newRoomCode,
                      currentUser,
                      userProfile
                    );
                  }

                  setActivityCreated(true);

                  // Show success message with collaboration info
                  const collaboratorCount = collaboratorEmails.split(',').map(email => email.trim()).filter(email => email).length;
                  Alert.alert(
                    '🎉 Wheel Activity Created!',
                    `✅ Room Code: ${newRoomCode}\n✅ Wheel: Live Organizer Wheel\n${collaboratorCount > 0 ? `✅ ${collaboratorCount} collaborator(s) invited` : '✅ No collaborators added'}\n\nParticipants can join at /join using the room code.`,
                    [{ text: 'OK' }]
                  );

                  console.log('✅ Live session created immediately:', newSession.id, 'Room code:', newRoomCode);
                } catch (error) {
                  console.error('Error creating live session:', error);
                  Alert.alert('Error', 'Failed to create live session');
                } finally {
                  setIsCreating(false);
                }
              }}
            >
              <Text style={styles.primaryButtonText}>
                Create Wheel Activity{collaboratorEmails.trim() ? ' & Invite Collaborators' : ''}
              </Text>
            </TouchableOpacity>
        </View>
     </ScrollView>
    )}

      {/* Winner Popup */}
      {showWinnerPopup && session?.winners && session.winners.length > 0 && (
        <Modal
          visible={showWinnerPopup}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.winnerOverlay}>
            <View style={styles.winnerCard}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowWinnerPopup(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>

              <View style={styles.winnerIconContainer}>
                <Text style={styles.winnerIcon}>🎯</Text>
              </View>

              <Text style={styles.winnerTitle}>SELECTED!</Text>

              <View style={styles.winnerDetails}>
                {session.winners.map((winner, index) => (
                  <View key={winner.id || `winner-${index}`} style={styles.winnerItem}>
                    <Text style={styles.winnerName}>{winner.name}</Text>
                    {index === 0 && <Text style={styles.winnerBadge}>🏆 WINNER</Text>}
                  </View>
                ))}
              </View>

              <Text style={styles.winnerMessage}>
                {session.winners.length === 1
                  ? (customMessage || `🎉 ${customWinnerWord}: {name}! 🎊`).replace('{name}', session.winners[0].name).replace('{winner}', customWinnerWord?.toLowerCase() || 'winner')
                  : `🎉 ${customWinnerWord ? `${customWinnerWord}s` : 'Winners'}: ${session.winners.map((w: any) => w.name).join(', ')}!`
                }
              </Text>

              <TouchableOpacity
                style={styles.awesomeButton}
                onPress={() => setShowWinnerPopup(false)}
              >
                <Text style={styles.awesomeButtonText}>Awesome! 👍</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* QR Code Modal */}
      <Modal
        visible={isQrDialogOpen}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Session</Text>
              <TouchableOpacity
                onPress={() => setIsQrDialogOpen(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Room Code: {session?.roomCode || roomCode}
            </Text>

            <View style={styles.qrContainer}>
              {qrCodeUrl ? (
                <View>
                  <Image 
                    source={{ uri: qrCodeUrl }} 
                    style={{ width: 200, height: 200, borderRadius: 12 }}
                    resizeMode="contain"
                  />
                  <Text style={[styles.qrText, { textAlign: 'center', marginTop: 12, fontSize: 14, color: COLORS.text }]}>
                    Scan to join: {session?.roomCode || roomCode}
                  </Text>
                </View>
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Ionicons name="qr-code" size={100} color={COLORS.primary} />
                  <Text style={styles.qrText}>QR Code</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.shareButton} onPress={() => {
              Clipboard.setString(session?.roomCode || roomCode);
              Alert.alert('Success', 'Room code copied to clipboard');
            }}>
              <Text style={styles.shareButtonText}>Copy Room Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Settings Modal - Theme Selection */}
      <Modal
        visible={isCustomSettingsOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsCustomSettingsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Wheel Theme</Text>
              <TouchableOpacity
                onPress={() => setIsCustomSettingsOpen(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Select a color theme for your wheel
            </Text>

            <ScrollView style={styles.themeScrollContainer} showsVerticalScrollIndicator={false}>
              {WHEEL_THEMES.map((theme) => (
                <TouchableOpacity
                  key={theme.id}
                  style={[
                    styles.themeOption,
                    selectedTheme === theme.id && styles.themeOptionSelected
                  ]}
                  onPress={() => {
                     setSelectedTheme(theme.id);
                     setIsCustomSettingsOpen(false);
                     // 🎨 CRITICAL: Update session theme for ALL users (organizer + collaborators + participants)
                     // This updates wheelState.theme which triggers real-time sync in OrganizerWheel and participant wheels
                     if (session?.id) {
                       console.log('🎨 Broadcasting theme change to all users:', {
                         themeId: theme.id,
                         themeName: theme.name,
                         colors: theme.colors,
                         sessionId: session.id
                       });
                       
                      updateDoc(doc(db, 'liveDrawSessions', session.id), {
                        selectedTheme: theme.id,
                        'wheelState.theme': {
                          primary: theme.colors[0] || '#8e0b16',
                          secondary: theme.colors[1] || '#66181E',
                          accent: "#ffffff", // White text for web compatibility
                          background: "#f8f9fa", // Light background for web compatibility
                          name: theme.name
                        },
                        'wheelState.themeUpdatedAt': serverTimestamp(),
                        'wheelState.themeBroadcast': {
                          source: broadcastSource || 'organizer',
                          timestamp: serverTimestamp(),
                          themeId: theme.id,
                          themeName: theme.name
                        },
                        updatedAt: serverTimestamp()
                      }).catch((error) => {
                        console.error('Error updating theme:', error);
                      });
                     }
                     Alert.alert('Success', `Theme changed to ${theme.name}`);
                   }}
                >
                  <View style={styles.themePreview}>
                    {theme.colors.slice(0, 4).map((color, index) => (
                      <View
                        key={`color-${index}`}
                        style={[styles.themeColorSwatch, { backgroundColor: color }]}
                      />
                    ))}
                  </View>
                  <View style={styles.themeInfo}>
                    <Text style={styles.themeName}>{theme.name}</Text>
                    <Text style={styles.themeColorCount}>{theme.colors.length} colors</Text>
                  </View>
                  {selectedTheme === theme.id && (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Theme Presets Modal */}
      <Modal
        visible={isThemePresetsOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsThemePresetsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Theme Presets</Text>
              <TouchableOpacity
                onPress={() => setIsThemePresetsOpen(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Choose from beautiful preset themes for your wheel
            </Text>

            <ScrollView style={styles.themeScrollContainer} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
                {WHEEL_THEMES.map((theme) => (
                  <TouchableOpacity
                    key={theme.id}
                    style={[
                      {
                        width: '48%',
                        backgroundColor: COLORS.surface,
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 12,
                        borderWidth: 2,
                        borderColor: selectedTheme === theme.id ? COLORS.primary : 'transparent',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                      }
                    ]}
                    onPress={() => {
                      setSelectedTheme(theme.id);
                      setIsThemePresetsOpen(false);

                      // 🎨 CRITICAL: Update session theme for ALL users (organizer + collaborators + participants)
                      // This updates wheelState.theme which triggers real-time sync in OrganizerWheel and participant wheels
                      if (session?.id) {
                        console.log('🎨 Broadcasting theme preset change to all users:', {
                          themeId: theme.id,
                          themeName: theme.name,
                          colors: theme.colors,
                          sessionId: session.id
                        });
                        
                        updateDoc(doc(db, 'liveDrawSessions', session.id), {
                          selectedTheme: theme.id,
                          'wheelState.theme': theme,
                          'wheelState.themeUpdatedAt': serverTimestamp(),
                          'wheelState.themeBroadcast': {
                            source: broadcastSource || 'organizer',
                            timestamp: serverTimestamp(),
                            themeId: theme.id,
                            themeName: theme.name
                          },
                          updatedAt: serverTimestamp()
                        }).catch((error) => {
                          console.error('Error updating theme preset:', error);
                        });
                      }

                      Alert.alert('Success', `Theme changed to ${theme.name}`);
                    }}
                  >
                    {/* Color Preview */}
                    <View style={{ flexDirection: 'row', marginBottom: 12, justifyContent: 'center' }}>
                      {theme.colors.slice(0, 3).map((color, index) => (
                        <View
                          key={`color-${index}`}
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            marginLeft: index > 0 ? 4 : 0,
                            backgroundColor: color,
                            borderWidth: 1,
                            borderColor: COLORS.border,
                          }}
                        />
                      ))}
                      {theme.colors.length > 3 && (
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            marginLeft: 4,
                            backgroundColor: COLORS.textSecondary,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ color: COLORS.surface, fontSize: 8, fontWeight: 'bold' }}>
                            +{theme.colors.length - 3}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Theme Name */}
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: COLORS.text,
                      textAlign: 'center',
                      marginBottom: 8,
                    }}>
                      {theme.name}
                    </Text>

                    {/* Color Count */}
                    <Text style={{
                      fontSize: 12,
                      color: COLORS.textSecondary,
                      textAlign: 'center',
                    }}>
                      {theme.colors.length} colors
                    </Text>

                    {/* Selected Indicator */}
                    {selectedTheme === theme.id && (
                      <View style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: COLORS.success,
                        borderRadius: 12,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}>
                        <Ionicons name="checkmark" size={12} color={COLORS.surface} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Student Selector Modal */}
      <Modal
        visible={isStudentSelectorOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsStudentSelectorOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📊 Select Students</Text>
              <TouchableOpacity
                onPress={() => setIsStudentSelectorOpen(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tab, selectorTab === 'manual' && styles.tabActive]}
                onPress={() => setSelectorTab('manual')}
              >
                <Text style={[styles.tabText, selectorTab === 'manual' && styles.tabTextActive]}>
                  Manual
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, selectorTab === 'random' && styles.tabActive]}
                onPress={() => setSelectorTab('random')}
              >
                <Text style={[styles.tabText, selectorTab === 'random' && styles.tabTextActive]}>
                  Random Selection
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, selectorTab === 'research' && styles.tabActive]}
                onPress={() => setSelectorTab('research')}
              >
                <Text style={[styles.tabText, selectorTab === 'research' && styles.tabTextActive]}>
                  Research
                </Text>
              </TouchableOpacity>
            </View>

            {/* MANUAL TAB */}
            {selectorTab === 'manual' && (
              <>
                <Text style={styles.modalSubtitle}>
                  Selected: {selectedStudents.length} of {currentWheelItems.length}
                </Text>

                {/* Quick Actions */}
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={[styles.wheelActionButton]}
                    onPress={selectAllStudents}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkmark-done" size={16} color={COLORS.text} />
                    <Text style={[styles.actionButtonText, { fontSize: 12 }]}>Select All</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.wheelActionButton]}
                    onPress={clearAllStudents}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={16} color={COLORS.text} />
                    <Text style={[styles.actionButtonText, { fontSize: 12 }]}>Clear All</Text>
                  </TouchableOpacity>
                </View>

                {/* Student List */}
                <ScrollView style={styles.studentListContainer} showsVerticalScrollIndicator={false}>
                  {currentWheelItems.map((student, index) => (
                    <TouchableOpacity
                      key={`student-${index}-${student}`}
                      style={[
                        styles.studentCheckbox,
                        selectedStudents.includes(student) && styles.studentCheckboxSelected
                      ]}
                      onPress={() => toggleStudentSelection(student)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.checkbox,
                        selectedStudents.includes(student) && styles.checkboxSelected
                      ]}>
                        {selectedStudents.includes(student) && (
                          <Ionicons name="checkmark" size={16} color={COLORS.surface} />
                        )}
                      </View>
                      <Text style={styles.studentName} numberOfLines={1} ellipsizeMode="tail">
                        {student}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Apply Button */}
                <TouchableOpacity
                  style={[styles.applyButton, selectedStudents.length === 0 && styles.applyButtonDisabled]}
                  onPress={applyStudentSelection}
                  disabled={selectedStudents.length === 0}
                >
                  <Text style={styles.applyButtonText}>Apply Selection</Text>
                </TouchableOpacity>
              </>
            )}

            {/* RANDOM SELECTION TAB */}
            {selectorTab === 'random' && (
              <>
                <View style={styles.randomSelectionContainer}>
                  <View style={styles.uploadedCountBox}>
                    <Ionicons name="documents" size={32} color={COLORS.primary} />
                    <Text style={styles.uploadedCountLabel}>Students Uploaded</Text>
                    <Text style={styles.uploadedCountValue}>
                      {uploadedStudents.length || currentWheelItems.length}
                    </Text>
                  </View>

                  <View style={styles.randomControlsBox}>
                    <Text style={styles.randomControlLabel}>Select how many students to pick:</Text>
                    
                    <View style={styles.numberInputRow}>
                      <TextInput
                        style={styles.randomNumberInput}
                        value={String(randomSelectionCount)}
                        onChangeText={(text) => {
                          const num = parseInt(text) || 1;
                          const max = uploadedStudents.length || currentWheelItems.length;
                          setRandomSelectionCount(Math.min(Math.max(num, 1), max));
                        }}
                        keyboardType="number-pad"
                        maxLength={3}
                      />
                      <Text style={styles.randomSlashText}>
                        / {uploadedStudents.length || currentWheelItems.length}
                      </Text>
                    </View>

                    <View style={styles.percentageBox}>
                      <Text style={styles.percentageText}>
                        {randomSelectionCount} of {uploadedStudents.length || currentWheelItems.length} (
                        {((randomSelectionCount / (uploadedStudents.length || currentWheelItems.length)) * 100).toFixed(1)}%)
                      </Text>
                    </View>

                    <View style={styles.sliderContainer}>
                      {/* Simple slider alternative using buttons */}
                      <TouchableOpacity
                        style={styles.sliderButton}
                        onPress={() => setRandomSelectionCount(Math.max(1, randomSelectionCount - 1))}
                      >
                        <Ionicons name="remove" size={20} color={COLORS.surface} />
                      </TouchableOpacity>

                      <View style={styles.sliderTrack}>
                        <View
                          style={[
                            styles.sliderFill,
                            {
                              width: `${(randomSelectionCount / (uploadedStudents.length || currentWheelItems.length)) * 100}%`
                            }
                          ]}
                        />
                      </View>

                      <TouchableOpacity
                        style={styles.sliderButton}
                        onPress={() => {
                          const max = uploadedStudents.length || currentWheelItems.length;
                          setRandomSelectionCount(Math.min(randomSelectionCount + 1, max));
                        }}
                      >
                        <Ionicons name="add" size={20} color={COLORS.surface} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {uploadedStudents.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearUploadButton}
                      onPress={() => {
                        setUploadedStudents([]);
                        Alert.alert('Cleared', 'Uploaded students cleared');
                      }}
                    >
                      <Text style={styles.clearUploadButtonText}>Clear Uploaded Students</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.uploadCSVButton}
                    onPress={handleCSVUpload}
                  >
                    <Ionicons name="cloud-upload" size={20} color={COLORS.surface} />
                    <Text style={styles.uploadCSVButtonText}>Upload CSV File</Text>
                  </TouchableOpacity>
                </View>

                {/* Apply Random Selection Button */}
                <TouchableOpacity
                  style={[styles.applyButton]}
                  onPress={applyRandomSelection}
                >
                  <Text style={styles.applyButtonText}>Apply Random Selection</Text>
                </TouchableOpacity>
              </>
            )}

            {/* RESEARCH TAB */}
            {selectorTab === 'research' && (
              <>
                <ScrollView style={styles.studentListContainer} showsVerticalScrollIndicator={false}>
                  <View style={styles.researchContainer}>
                    <Ionicons name="beaker" size={48} color={COLORS.primary} />
                    <Text style={styles.researchTitle}>Research Participant Selection</Text>
                    <Text style={styles.researchDescription}>
                      Download our template, add your student list, then use the Random Selection controls to pick participants.
                    </Text>

                    <View style={styles.researchSteps}>
                      <View style={styles.researchStep}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>1</Text>
                        </View>
                        <Text style={styles.stepText}>Download the CSV template</Text>
                      </View>

                      <View style={styles.researchStep}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>2</Text>
                        </View>
                        <Text style={styles.stepText}>Add your student names (one per line)</Text>
                      </View>

                      <View style={styles.researchStep}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>3</Text>
                        </View>
                        <Text style={styles.stepText}>Upload the CSV file</Text>
                      </View>

                      <View style={styles.researchStep}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>4</Text>
                        </View>
                        <Text style={styles.stepText}>Use Random Selection to pick participants</Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>

                {/* Research Action Buttons */}
                <View style={styles.researchButtonsContainer}>
                  <TouchableOpacity
                    style={[styles.applyButton, { backgroundColor: COLORS.warning }]}
                    onPress={downloadCSVTemplate}
                  >
                    <Ionicons name="download" size={20} color={COLORS.surface} />
                    <Text style={styles.applyButtonText}>Download Research Template (CSV)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.applyButton}
                    onPress={handleCSVUpload}
                  >
                    <Ionicons name="cloud-upload" size={20} color={COLORS.surface} />
                    <Text style={styles.applyButtonText}>Upload the CSV File</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};


export default OrganizerLiveRoomScreen;
