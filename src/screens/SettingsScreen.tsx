import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type React from "react"
import { useEffect, useState } from "react"
import { Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { collection, doc, getDoc, setDoc, updateDoc, writeBatch, deleteField, getDocs } from "firebase/firestore"
import { db } from "../config/firebaseConfig"
import { useAuth } from "../contexts/AuthContext"
import { useDataPrivacy } from "../contexts/DataPrivacyContext"
import { useTheme } from "../contexts/ThemeContext"
import { preserveAdminDuringClear, getAdminSafeDataClearingMessage, canClearUserData } from "../lib/admin-protection"

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation()
  const { theme, resetTheme, toggleTheme, currentThemeName } = useTheme()
  const { currentUser, userProfile, signOut, authLoading } = useAuth()
  const { consentGiven, revokeConsent } = useDataPrivacy()
  const [notifications, setNotifications] = useState(true)
  const [autoSave, setAutoSave] = useState(true)
  const [hapticFeedback, setHapticFeedback] = useState(true)
  const [dataSync, setDataSync] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    if (currentUser && !authLoading) {
      loadUserSettings()
    }
  }, [currentUser, authLoading])

  const loadUserSettings = async () => {
    if (!currentUser || !db) return

    try {
      const userDocRef = doc(db, "users", currentUser.uid)
      const userDoc = await getDoc(userDocRef)

      if (userDoc.exists()) {
        const settings = userDoc.data()?.settings
        if (settings) {
          setNotifications(settings.notifications ?? true)
          setAutoSave(settings.autoSave ?? true)
          setHapticFeedback(settings.hapticFeedback ?? true)
          setDataSync(true)
        }
      }
    } catch (error: any) {
      console.error("Error loading user settings:", error)

      // Handle permission errors gracefully
      if (error?.code === 'permission-denied') {
        console.log("Permission denied when loading user settings - using defaults")
        // Use default settings if we can't access user settings
        setNotifications(true)
        setAutoSave(true)
        setHapticFeedback(true)
        setDataSync(true)
      } else {
        // Only show alert for non-permission errors
        Alert.alert("Error", "Failed to load settings.")
      }
    }
  }

  const saveUserSettings = async (key: string, value: boolean) => {
    if (!currentUser || !db) return

    try {
      const userDocRef = doc(db, "users", currentUser.uid)
      await setDoc(
        userDocRef,
        {
          settings: {
            notifications,
            autoSave,
            hapticFeedback,
            dataSync,
            [key]: value,
          },
        },
        { merge: true },
      )
    } catch (error: any) {
      console.error("Error saving user setting:", error)

      // Handle permission errors gracefully
      if (error?.code === 'permission-denied') {
        console.log("Permission denied when saving user settings - settings saved locally only")
        // Settings are still updated in local state, just not persisted to Firestore
        // This allows the app to continue working even with permission issues
      } else {
        // Only show alert for non-permission errors
        Alert.alert("Error", "Failed to save setting.")
      }
    }
  }

  const handleNotificationsToggle = (value: boolean) => {
    setNotifications(value)
    saveUserSettings("notifications", value)
  }

  const handleAutoSaveToggle = (value: boolean) => {
    setAutoSave(value)
    saveUserSettings("autoSave", value)
  }

  const handleHapticFeedbackToggle = (value: boolean) => {
    setHapticFeedback(value)
    saveUserSettings("hapticFeedback", value)
  }

  const handleLogout = () => {
    Alert.alert("Confirm Logout", "Are you sure you want to log out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            setIsLoggingOut(true)
            await signOut()
            // Navigation will be handled automatically by AppNavigator
            // when currentUser becomes null
          } catch (error) {
            console.error("Logout failed:", error)
            Alert.alert("Logout Failed", "There was an error logging out. Please try again.")
          } finally {
            setIsLoggingOut(false)
          }
        },
      },
    ])
  }

  const handleDataPrivacyRevoke = () => {
    Alert.alert(
      "Revoke Data Privacy Consent",
      "This will remove your consent for data processing. You may need to provide consent again to use certain features.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            try {
              await revokeConsent()
            } catch (error) {
              console.error("Failed to revoke consent:", error)
              Alert.alert("Error", "Failed to revoke consent. Please try again.")
            }
          },
        },
      ],
    )
  }

  const clearAppData = () => {
    if (!currentUser || !db) {
      Alert.alert("Error", "No user logged in to clear data.")
      return
    }

    // Check if admin can safely clear data
    const userEmail = currentUser.email
    const clearCheck = canClearUserData(userEmail)
    
    if (!clearCheck.canClear) {
      Alert.alert(
        "Admin Protection", 
        clearCheck.reason || "Admin accounts cannot clear all data to maintain system access.",
        [{ text: "OK", style: "default" }]
      )
      return
    }

    // Get admin-safe message
    const clearMessage = getAdminSafeDataClearingMessage(userEmail || "")
    const adminPreservation = preserveAdminDuringClear(userEmail || "")

    Alert.alert(
      "Clear App Data",
      clearMessage + (adminPreservation.shouldPreserve ? `\n\n${adminPreservation.message}` : ""),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Data",
          style: "destructive",
          onPress: async () => {
            try {
              console.log(`📱 Starting data clear for user: ${userEmail}`)
              
              // Check admin preservation again before clearing
              const preservation = preserveAdminDuringClear(userEmail || "")
              if (preservation.shouldPreserve) {
                console.log(`🛡️ Admin protection active: ${preservation.message}`)
              }
              
              const userDocRef = doc(db, "users", currentUser.uid)

              // Delete wheels collection
              const wheelsSnapshot = await getDocs(collection(db, "wheels"))
              const wheelsBatch = writeBatch(db)
              wheelsSnapshot.docs
                .filter((doc) => doc.data().userId === currentUser.uid)
                .forEach((doc) => wheelsBatch.delete(doc.ref))
              await wheelsBatch.commit()
              console.log(`🎡 Wheels cleared for user: ${userEmail}`)

              // Delete participants collection
              const participantsSnapshot = await getDocs(collection(db, "participants"))
              const participantsBatch = writeBatch(db)
              participantsSnapshot.docs
                .filter((doc) => doc.data().userId === currentUser.uid)
                .forEach((doc) => participantsBatch.delete(doc.ref))
              await participantsBatch.commit()
              console.log(`👥 Participants cleared for user: ${userEmail}`)

              // For admin users, preserve essential account data
              if (preservation.shouldPreserve) {
                // Clear user settings but preserve admin role and essential data
                await setDoc(
                  userDocRef,
                  {
                    settings: deleteField(),
                    dataPrivacyConsentGiven: false,
                    collaborators: [],
                    // Preserve admin-specific fields
                    role: "admin",
                    isHardcodedAdmin: true,
                    canDeleteCollections: true,
                    lastActiveAt: new Date(),
                    lastActiveDevice: "Mobile App - Data Cleared (Admin Protected)"
                  },
                  { merge: true }
                )
                console.log(`🔒 Admin data preserved during clear for: ${userEmail}`)
              } else {
                // Regular user - clear settings and preferences normally
                await setDoc(
                  userDocRef,
                  {
                    settings: deleteField(),
                    dataPrivacyConsentGiven: false,
                    collaborators: [],
                  },
                  { merge: true }
                )
              }

              // Clear AsyncStorage
              await AsyncStorage.clear()
              console.log(`📱 AsyncStorage cleared for user: ${userEmail}`)

              const successMessage = preservation.shouldPreserve 
                ? "Admin data has been cleared while preserving your admin account access."
                : "All app data has been cleared."
              
              Alert.alert("Success", successMessage)

              // Log out after clearing data
              await signOut()
            } catch (error) {
              console.error("Error clearing app data:", error)
              Alert.alert("Error", "Failed to clear app data.")
            }
          },
        },
      ],
    )
  }

  const exportAppData = async () => {
    if (!currentUser || !db) {
      Alert.alert("Error", "No user logged in to export data.")
      return
    }

    try {
      const userDocRef = doc(db, "users", currentUser.uid)
      const userDoc = await getDoc(userDocRef)
      const userData = userDoc.exists() ? userDoc.data() : {}

      const wheelsSnapshot = await getDocs(collection(db, "wheels"))
      const wheelsData = wheelsSnapshot.docs
        .filter((doc) => doc.data().userId === currentUser.uid)
        .map((doc) => ({ id: doc.id, ...doc.data() }))

      const participantsSnapshot = await getDocs(collection(db, "participants"))
      const participantsData = participantsSnapshot.docs
        .filter((doc) => doc.data().userId === currentUser.uid)
        .map((doc) => ({ id: doc.id, ...doc.data() }))

      const exportData = {
        userProfile: userData,
        wheels: wheelsData,
        participants: participantsData,
      }

      console.log("Export data:", JSON.stringify(exportData, null, 2))
      Alert.alert("Export Complete", "Your data has been exported successfully (check console for details).")
    } catch (error) {
      console.error("Error exporting data:", error)
      Alert.alert("Error", "Failed to export data.")
    }
  }

  const renderSettingItem = (
    icon: string,
    title: string,
    subtitle?: string,
    onPress?: () => void,
    rightComponent?: React.ReactNode,
    showChevron = true,
  ) => (
    <TouchableOpacity
      style={[styles.settingItem, { backgroundColor: theme.surface }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: theme.primary }]}>
          <Ionicons name={icon as any} size={20} color={theme.surface} />
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.settingRight}>
        {rightComponent}
        {showChevron && onPress && <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />}
      </View>
    </TouchableOpacity>
  )

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Account Section */}
        {renderSection(
          "Account",
          <>
            {renderSettingItem(
              "person-circle",
              userProfile?.fullName || currentUser?.email || "User",
              currentUser?.email || "No email",
              undefined,
              <Text style={[styles.roleText, { color: theme.primary }]}>
                {(userProfile?.role ?? 'participant').toUpperCase()}
              </Text>,
              false,
            )}
            {/* Removed Manage Role and User Management entries */}
            {renderSettingItem(
              "log-out",
              "Logout",
              "Sign out of your account",
              handleLogout,
              isLoggingOut ? (
                <Text style={[styles.statusText, { color: theme.textSecondary }]}>Logging out...</Text>
              ) : undefined,
              false,
            )}
          </>,
        )}



        {/* Customization */}
        {renderSection(
          "Customization",
          <>
            {renderSettingItem(
              currentThemeName === "dark" ? "sunny" : "moon",
              "Dark Mode",
              `Currently using ${currentThemeName} theme`,
              undefined,
              <Switch
                value={currentThemeName === "dark"}
                onValueChange={toggleTheme}
                trackColor={{ false: theme.textSecondary, true: theme.primary }}
                thumbColor={theme.surface}
              />,
              false,
            )}
          </>,
        )}



        {/* Privacy & Security */}
        {renderSection(
          "Privacy & Security",
          <>
            {renderSettingItem(
              "shield-checkmark",
              "Data Privacy Consent",
              consentGiven ? "Consent given" : "Consent required",
              undefined,
              <Text style={[styles.statusText, { color: consentGiven ? theme.success : theme.error }]}>
                {consentGiven ? "Active" : "Required"}
              </Text>,
              false,
            )}
            {consentGiven &&
              renderSettingItem(
                "shield-outline",
                "Revoke Data Consent",
                "Remove consent for data processing",
                handleDataPrivacyRevoke,
                undefined,
                false,
              )}
            {renderSettingItem("document-text", "Privacy Policy", "View our privacy policy", () =>
              Alert.alert("Privacy Policy", "Privacy policy would be displayed here."),
            )}
            {renderSettingItem("document", "Terms of Service", "View terms of service", () =>
              Alert.alert("Terms of Service", "Terms of service would be displayed here."),
            )}
          </>,
        )}

        {/* About */}
        {renderSection(
          "About",
          <>
            {renderSettingItem("information-circle", "App Version", "Version 1.0.0", undefined, undefined, false)}
          </>,
        )}

        {/* Developer Info */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            Made with ❤️ for better decision making
          </Text>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>© 2024 Coby Picker</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "web" ? 0 : 25, // Moderate top padding - not all the way to top
  },
  content: {
    flex: 1,
    maxWidth: 800,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 0, // Remove horizontal padding to align all the way to the left
    paddingTop: Platform.OS === "web" ? 0 : 25, // Moderate top padding for mobile
  },
  scrollContent: {
    paddingBottom: 100, // Keep bottom padding for tab bar
  },
  section: {
    marginBottom: 40, // Increased spacing between sections
  },
  sectionTitle: {
    fontSize: Platform.OS === "web" ? 22 : 20, // Slightly larger title
    fontWeight: "bold",
    paddingHorizontal: 20, // Keep some padding for readability but align to left
    marginBottom: 16, // More space after title
    marginTop: Platform.OS === "web" ? 0 : 12, // Increased top margin for mobile
  },
  sectionContent: {
    gap: 1,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, // Keep consistent padding for touch targets
    paddingVertical: 16,
    marginHorizontal: 0, // Remove horizontal margin to align to left
    marginBottom: 1,
    borderRadius: 0, // Remove border radius for full-width appearance
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingIcon: {
    width: 48, // Larger circular icon container
    height: 48,
    borderRadius: 24,
    backgroundColor: "#8B1538", // Dark red background like in your design
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(139, 38, 53, 0.1)",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 4,
  },

})

export default SettingsScreen
