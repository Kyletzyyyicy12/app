import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal, Dimensions, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView, CameraCapturedPicture } from 'expo-camera';
import CrossPlatformSessionManager from '../utils/CrossPlatformSessionManager';
import { StatusBar } from 'expo-status-bar';
import { db } from '../config/firebaseConfig';
import { doc, getDoc, collection, query, where, limit, getDocs, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import jsQR from 'jsqr';

// Use expo-camera for QR code scanning via photo capture
console.log('� Using expo-camera for QR code scanning');

const JoinLiveDrawScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { currentUser, userProfile } = useAuth();
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  // QR Scanner states
  const [activeTab, setActiveTab] = useState<'manual' | 'qr'>('manual');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Always start with manual entry as safe default
  React.useEffect(() => {
    console.log('🎯 Join Live Draw screen loaded successfully!');
    console.log('📝 Manual entry is always available for joining sessions');
    setActiveTab('manual');
  }, []);

  // Function to request camera permissions for expo-camera
  const requestCameraPermissions = async () => {
    console.log(' Requesting camera permissions for expo-camera...');
    setHasPermission(null); // Reset to show loading state

    try {
      const cameraPermission = await Camera.requestCameraPermissionsAsync();
      console.log('📸 Camera permission result:', cameraPermission);
      setHasPermission(cameraPermission.granted);

      if (!cameraPermission.granted) {
        console.log('❌ Camera permission denied - cannot use camera');
      }
    } catch (error) {
      console.error('❌ Error requesting camera permissions:', error);
      setHasPermission(false);
    }
  };

  // Camera permission and QR scanner setup
  useEffect(() => {
    requestCameraPermissions();
  }, []);

  // Format room code to match web app behavior (alphanumeric, uppercase)
  const formatRoomCode = (value: string) => {
    const cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    return cleaned.slice(0, 6);
  };

  const handleRoomCodeChange = (text: string) => {
    const formatted = formatRoomCode(text);
    setRoomCode(formatted);
  };

  // Extract session info from QR data - Enhanced for web app QR codes
  const extractSessionInfo = (qrData: string) => {
    console.log('🔍 Extracting session info from QR data:', qrData);

    try {
      // WEB APP QR CODE DETECTION: Check for full URLs first (most common case)
      if (qrData.startsWith('http://') || qrData.startsWith('https://')) {
        console.log('🌐 Processing URL format QR code from web app');

        const url = new URL(qrData);
        console.log('🌐 Parsed URL:', {
          hostname: url.hostname,
          pathname: url.pathname,
          search: url.search,
          searchParams: Object.fromEntries(url.searchParams.entries())
        });

        // PRIMARY WEB APP PATTERN: /join?code={ROOMCODE}
        if (url.pathname.includes('/join')) {
          console.log('🔍 Detected /join path - checking for room code');

          // Check query parameter ?code= (standard web app format)
          const urlCode = url.searchParams.get('code');
          if (urlCode) {
            const code = urlCode.toUpperCase().replace(/[^A-Z0-9]/gi, '');
            if (code.length === 6 && /^[A-Z0-9]{6}$/.test(code)) {
              console.log('✅ WEB APP QR: Found roomCode in ?code= parameter:', code);
              return { sessionId: null, roomCode: code, source: 'web-qr-code' };
            }
          }

          // Check query parameter ?roomCode= (alternative format)
          const roomCodeParam = url.searchParams.get('roomCode');
          if (roomCodeParam) {
            const code = roomCodeParam.toUpperCase().replace(/[^A-Z0-9]/gi, '');
            if (code.length === 6 && /^[A-Z0-9]{6}$/.test(code)) {
              console.log('✅ WEB APP QR: Found roomCode in ?roomCode= parameter:', code);
              return { sessionId: null, roomCode: code, source: 'web-qr-code' };
            }
          }

          // Check for room code in path (fallback)
          const pathParts = url.pathname.split('/').filter(part => part.length > 0);
          if (pathParts.length >= 2 && pathParts[0] === 'join' && pathParts.length > 1) {
            const roomCode = pathParts[1].replace(/[^A-Z0-9]/gi, '').toUpperCase();
            if (roomCode.length === 6 && /^[A-Z0-9]{6}$/.test(roomCode)) {
              console.log('✅ WEB APP QR: Found roomCode in path:', roomCode);
              return { sessionId: null, roomCode, source: 'web-qr-path' };
            }
          }
        }

        // SECONDARY PATTERN: /live/{sessionId} for direct session access
        if (url.pathname.includes('/live')) {
          const pathParts = url.pathname.split('/').filter(part => part.length > 0);
          if (pathParts.length >= 2 && pathParts[0] === 'live') {
            const sessionId = pathParts[1];
            if (sessionId && sessionId.length >= 15) {
              console.log('✅ WEB APP QR: Found sessionId in /live/ URL:', sessionId);
              return { sessionId, roomCode: null, source: 'web-live-session' };
            }
          }
        }

        // Check for any 6-character code in query parameters
        for (const [key, value] of url.searchParams.entries()) {
          const code = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
          if (code.length === 6 && /^[A-Z0-9]{6}$/.test(code)) {
            console.log(`✅ WEB APP QR: Found 6-char code in ?${key}= parameter:`, code);
            return { sessionId: null, roomCode: code, source: 'web-qr-query-any' };
          }
        }
      }

      // FALLBACK: Handle direct codes without URLs (manual entry or plain codes)
      const cleaned = qrData.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      console.log('🔄 FALLBACK: Cleaned direct code check:', cleaned);

      // Exact match for room codes
      if (cleaned.length === 6 && /^[A-Z0-9]{6}$/.test(cleaned)) {
        console.log('🎯 FALLBACK: Detected as room code:', cleaned);
        return { sessionId: null, roomCode: cleaned, source: 'direct-room-code' };
      }

      // Session IDs (Firebase document IDs)
      if (cleaned.length >= 15 && /^[A-Z0-9]+$/.test(cleaned)) {
        console.log('🎯 FALLBACK: Detected as session ID:', cleaned);
        return { sessionId: cleaned, roomCode: null, source: 'direct-session-id' };
      }

      console.log('❌ EXTRACTION FAILED: Could not extract valid session info from:', qrData);
      return null;
    } catch (error) {
      console.error('❌ EXTRACTION ERROR: Failed to parse QR data:', error);
      return null;
    }
  };

  // Handle QR code scanning
  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    console.log('📱 QR code scanned:', { type, data });
    setScanned(true);
    setScanning(true);

    try {
      const sessionInfo = extractSessionInfo(data);
      if (sessionInfo) {
        const { sessionId, roomCode: scannedRoomCode } = sessionInfo;
        console.log('✅ Successfully extracted session info:', sessionInfo);

        if (scannedRoomCode) {
          // Use room code to join - go directly to live room
          console.log('🔢 Joining with room code:', scannedRoomCode);
          setRoomCode(scannedRoomCode);
          setActiveTab('manual'); // Keep camera open but update manual tab for reference
          await handleJoinFromQR(scannedRoomCode);
        } else if (sessionId) {
          // Direct session join
          console.log('🔗 Joining with session ID:', sessionId);
          await handleJoinFromQR(null, sessionId);
        } else {
          console.log('❌ No valid session info found in extracted data');
          Alert.alert('Invalid QR Code', 'Could not extract valid session information. Please ensure the QR code contains a 6-character room code.');
        }
      } else {
        console.log('❌ Failed to extract session info from QR data');
        // Show scanned data for debugging
        const cleanData = data.substring(0, 100); // Truncate for display
        Alert.alert(
          'QR Code Not Recognized',
          `Could not extract room code from QR code.\n\nScanned data: ${cleanData}\n\nExpected: 6-character code like ABC123`
        );
      }
    } catch (error) {
      console.error('❌ Error processing QR code:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Scan Error', `Failed to process QR code.\n\nError: ${errorMessage}`);
    } finally {
      setScanning(false);
      setScanned(false);
      // Keep camera active so user can try again if needed
    }
  };

  // Join session from QR code - Enhanced for web app QR codes
  const handleJoinFromQR = async (roomCodeFromQR?: string | null, sessionIdFromQR?: string | null) => {
    setLoading(true);
    console.log('🚀 STARTING QR JOIN PROCESS:', {
      roomCodeFromQR,
      sessionIdFromQR,
      currentUserId: currentUser?.uid,
      currentUserEmail: currentUser?.email
    });

    try {
      let session;
      let joinMethod: string;

      if (roomCodeFromQR) {
        console.log('🔍 LOOKUP BY ROOM CODE:', roomCodeFromQR);
        joinMethod = 'roomCode';

        try {
          session = await CrossPlatformSessionManager.findSessionByRoomCode(roomCodeFromQR);
          console.log('📋 ROOM CODE LOOKUP RESULT:', {
            found: !!session,
            sessionId: session?.id,
            wheelName: session?.wheelName
          });
        } catch (lookupError) {
          console.error('❌ ROOM CODE LOOKUP FAILED:', lookupError);

          // Try direct Firestore lookup as backup
          console.log('🔄 FALLBACK: Direct Firestore lookup for room code:', roomCodeFromQR);
          try {
            const roomsQuery = await getDocs(
              query(collection(db, "liveDrawSessions"),
                     where("roomCode", "==", roomCodeFromQR),
                     where("isActive", "==", true),
                     limit(1))
            );

            if (!roomsQuery.empty) {
              const roomDoc = roomsQuery.docs[0];
              const roomData = roomDoc.data();
              session = {
                id: roomDoc.id,
                wheelName: roomData?.wheelName || roomData?.title || 'Live Session',
                roomCode: roomData?.roomCode || roomCodeFromQR
              };
              console.log('✅ FALLBACK ROOM CODE LOOKUP SUCCESSFUL:', session.id);
            } else {
              console.log('❌ FALLBACK ROOM CODE LOOKUP: No matching session found');
            }
          } catch (firestoreError) {
            console.error('❌ FALLBACK ROOM CODE LOOKUP ERROR:', firestoreError);
          }
        }
      } else if (sessionIdFromQR) {
        console.log('🔍 LOOKUP BY SESSION ID:', sessionIdFromQR);
        joinMethod = 'sessionId';

        try {
          const sessionDoc = await getDoc(doc(db, "liveDrawSessions", sessionIdFromQR));
          console.log('📄 SESSION DOC EXISTS:', sessionDoc.exists());

          if (sessionDoc.exists() && sessionDoc.data()?.isActive) {
            const sessionData = sessionDoc.data();
            session = {
              id: sessionDoc.id,
              wheelName: sessionData?.wheelName || sessionData?.title || 'Live Session',
              roomCode: sessionData?.roomCode || ''
            };
            console.log('📋 SESSION LOOKUP RESULT:', {
              found: true,
              sessionId: session.id,
              wheelName: session.wheelName,
              roomCode: session.roomCode,
              isActive: sessionData?.isActive
            });
          } else {
            console.log('❌ SESSION DOC MISSING OR INACTIVE:', {
              exists: sessionDoc.exists(),
              isActive: sessionDoc.data()?.isActive
            });
          }
        } catch (error) {
          console.error('❌ SESSION LOOKUP ERROR:', error);
        }
      } else {
        console.log('❌ INVALID QR JOIN PARAMETERS: No roomCode or sessionId provided');
        throw new Error('Invalid QR code data');
      }

      // SUCCESS: Session found
      if (session) {
        console.log('✅ SESSION VERIFIED FOR JOIN:', {
          sessionId: session.id,
          joinMethod,
          wheelName: session.wheelName,
          roomCode: session.roomCode
        });

        // Add participant to session
        try {
          console.log('👤 ADDING VIEWER TO SESSION...');
          const viewerResult = await CrossPlatformSessionManager.addViewer(
            session.id,
            userProfile?.fullName || currentUser?.email || 'Mobile Participant',
            'mobile',
            currentUser?.uid
          );
          console.log('👤 VIEWER ADDED SUCCESSFULLY:', viewerResult);
        } catch (viewerError) {
          console.error('⚠️ VIEWER ADD WARNING (continuing):', viewerError);
          // Don't fail the join if viewer add fails - continue to navigation
        }

        // Navigate to the live room
        console.log('🧭 NAVIGATING TO LIVE ROOM:', {
          route: 'HomeTab-WebLiveRoom',
          params: {
            sessionId: session.id,
            wheelName: session.wheelName,
            roomCode: session.roomCode || roomCodeFromQR || ''
          }
        });

        try {
          // Navigate to the live session room
          navigation.navigate('HomeTab', {
            screen: 'WebLiveRoom',
            params: {
              sessionId: session.id,
              wheelName: session.wheelName,
              roomCode: session.roomCode || roomCodeFromQR || sessionIdFromQR || ''
            }
          });

          console.log('✅ NAVIGATION SUCCESSFUL - QR JOIN COMPLETE!');
          Alert.alert(
            'Joined Successfully!',
            `Connected to "${session.wheelName}" session`,
            [{ text: 'OK' }]
          );

        } catch (navError) {
          console.error('❌ NAVIGATION FAILED:', navError);
          throw new Error('Failed to navigate to live room');
        }

      } else {
        // FAILURE: Session not found
        console.log('❌ SESSION NOT FOUND FOR QR JOIN');

        const suggestionMethod = roomCodeFromQR ? 'manual-entry' : 'contact-organizer';
        const suggestionMessage = roomCodeFromQR
          ? `Try entering room code "${roomCodeFromQR}" manually.`
          : 'Please contact the session organizer.';

        const alertButtons: any[] = [
          { text: 'Try Again', style: 'cancel' }
        ];

        if (roomCodeFromQR) {
          alertButtons.unshift({
            text: 'Enter Manually',
            onPress: () => {
              setRoomCode(roomCodeFromQR);
              setActiveTab('manual');
            }
          });
        }

        Alert.alert(
          'Session Not Found',
          `We couldn't find an active session for this QR code.\n\n${suggestionMessage}\n\nTip: Make sure the session is still active and the QR code is recent.`,
          alertButtons
        );
      }
    } catch (error) {
      console.error('❌ QR JOIN PROCESS FAILED:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      Alert.alert(
        'Join Failed',
        `Couldn't connect to the session: ${errorMessage}\n\nPlease try scanning again or enter the room code manually.`,
        [
          { text: 'Try Again', style: 'cancel' },
          { text: 'Enter Manually', onPress: () => setActiveTab('manual') }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!roomCode.trim()) {
      Alert.alert('Error', 'Please enter a room code.');
      return;
    }
    setLoading(true);
    try {
      const session = await CrossPlatformSessionManager.findSessionByRoomCode(roomCode.trim());
      if (session) {
        await CrossPlatformSessionManager.addViewer(
          session.id,
          userProfile?.fullName || currentUser?.email || 'Participant',
          'mobile',
          currentUser?.uid // Pass userId to prevent duplicates
        );
        navigation.navigate('HomeTab', {
          screen: 'WebLiveRoom',
          params: { sessionId: session.id, wheelName: session.wheelName, roomCode: roomCode }
        });
      } else {
        Alert.alert('Error', 'Room not found. Please check the code and try again.');
      }
    } catch (error) {
      console.error('Error joining room:', error);
      Alert.alert('Error', 'Failed to join the room. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // QR scanning is now handled by expo-camera's CameraView with onBarcodeScanned
  console.log('📷 QR scanning implemented using expo-camera CameraView with built-in barcode scanning');

  // Skip permission blocking for now - let users choose manual entry
  // The QR scanner will handle permissions internally

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <View style={styles.content}>
        <Ionicons name="qr-code-outline" size={80} color={theme.primary} />
        <Text style={[styles.title, { color: theme.text }]}>Join Live Draw</Text>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'manual' && [styles.activeTab, { borderColor: theme.primary }]
            ]}
            onPress={() => setActiveTab('manual')}
          >
            <Ionicons
              name="create-outline"
              size={20}
              color={activeTab === 'manual' ? theme.primary : theme.textSecondary}
            />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'manual' ? theme.primary : theme.textSecondary }
            ]}>
              Manual Entry
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'qr' && [styles.activeTab, { borderColor: theme.primary }]
            ]}
            onPress={() => setActiveTab('qr')}
          >
            <Ionicons
              name="qr-code-outline"
              size={20}
              color={activeTab === 'qr' ? theme.primary : theme.textSecondary}
            />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'qr' ? theme.primary : theme.textSecondary }
            ]}>
              Scan QR Code
            </Text>
          </TouchableOpacity>
        </View>

        {/* Manual Entry Tab */}
        {activeTab === 'manual' && (
          <View style={styles.tabContent}>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Enter the 6-character code from the organizer to join the session.
            </Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
              placeholder="Enter Room Code (e.g., ABC123)"
              placeholderTextColor={theme.textSecondary}
              value={roomCode}
              onChangeText={handleRoomCodeChange}
              keyboardType="default"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              autoFocus={false} // Prevent keyboard from auto-opening on screen load
              selectionColor={theme.primary}
              underlineColorAndroid="transparent"
            />
            {roomCode ? (
              <Text style={[styles.inputHintText, { color: theme.textSecondary }]}>
                Current code: {roomCode} ({roomCode.length}/6 characters)
              </Text>
            ) : null}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary }]}
              onPress={handleJoin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Join Session</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* QR Scanner Tab - Uses expo-camera with built-in QR scanning */}
        {activeTab === 'qr' && (
          <View style={styles.tabContent}>
            {/* Debug permissions */}
            {hasPermission === false && (
              <Text style={{ color: 'red', marginBottom: 10 }}>
                Camera permission denied - Cannot use camera
              </Text>
            )}

            {hasPermission === true ? (
              <View style={styles.scannerContainer}>
                <CameraView
                  style={styles.scanner}
                  facing="back"
                  onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                  }}
                />
                {scanned && (
                  <View style={styles.overlay}>
                    <TouchableOpacity
                      style={[styles.rescanButton, { backgroundColor: theme.primary }]}
                      onPress={() => {
                        console.log('🔄 Rescan button pressed');
                        setScanned(false);
                        setScanning(false);
                      }}
                    >
                      <Ionicons name="refresh-outline" size={20} color="#fff" />
                      <Text style={styles.rescanButtonText}>Scan Again</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.scannerInstructions}>
                  <Text style={[styles.instructionText, { color: theme.text }]}>
                    Point camera at QR code to join session
                  </Text>
                  {!scanned && (
                    <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 5 }}>
                      QR scanning is active and ready
                    </Text>
                  )}
                  {scanning && (
                    <ActivityIndicator size="small" color={theme.primary} style={styles.scanningIndicator} />
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.photoScanContainer}>
                <Ionicons name="camera-outline" size={80} color={theme.primary} />
                <Text style={[styles.photoScanTitle, { color: theme.text }]}>
                  Camera Access Required
                </Text>
                <Text style={[styles.photoScanSubtitle, { color: theme.textSecondary }]}>
                  Camera permission is needed to scan QR codes using expo-camera
                </Text>
                <TouchableOpacity
                  style={[styles.permissionButton, { backgroundColor: theme.secondary }]}
                  onPress={requestCameraPermissions}
                >
                  <Ionicons name="lock-open-outline" size={24} color="#fff" />
                  <Text style={styles.permissionButtonText}>Grant Camera Permission</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: theme.secondary, marginTop: 15 }]}
                  onPress={() => setActiveTab('manual')}
                >
                  <Text style={styles.buttonText}>Use Manual Entry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 18,
    textAlign: 'center',
  },
  inputHintText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 5,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#fff',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    width: '100%',
    alignItems: 'center',
  },
  // Permission styles
  permissionContainer: {
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  // Scanner styles
  scannerContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  scanner: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  rescanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scannerInstructions: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  instructionText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },

  scanningIndicator: {
    marginTop: 8,
  },
  // Photo scan styles
  photoScanContainer: {
    alignItems: 'center',
    padding: 20,
  },
  photoScanTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  photoScanSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  photoScanMainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 55,
    borderRadius: 12,
    paddingHorizontal: 30,
    gap: 12,
    marginBottom: 20,
  },
  photoScanMainButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  photoScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  photoScanButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 20,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default JoinLiveDrawScreen;
