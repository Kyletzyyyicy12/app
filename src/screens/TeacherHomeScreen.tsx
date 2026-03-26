import React from "react"
import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import { useCallback, useState } from "react"
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native"
import { useTheme } from "../contexts/ThemeContext"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../config/firebaseConfig"
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore"
import MiniPieWheel from "../components/MiniPieWheel"
import WheelTypePresets from "../components/WheelTypePresets"

const centerLogoImage = require("../../assets/images/ulo.png")

interface WheelSlice {
  id: string
  text: string
  color: string
  emoji?: string
}

interface WheelTemplate {
  id: string
  name: string
  icon?: string
  color?: string
  spins?: number
  used?: number
  slices?: WheelSlice[]
  userId: string
  live?: boolean
  liveJoinCode?: string
}

const TeacherHomeScreen: React.FC = () => {
  const navigation = useNavigation<any>()
  const { theme } = useTheme()
  const { currentUser, userProfile } = useAuth()
  const [wheels, setWheels] = useState<WheelTemplate[]>([])

  // Load wheels from Firestore
  const loadWheels = useCallback(async () => {
    if (!currentUser || !db) return

    try {
      const q = query(collection(db, "wheels"), where("userId", "==", currentUser.uid))
      const querySnapshot = await getDocs(q)
      const loadedWheels: WheelTemplate[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        loadedWheels.push({
          id: doc.id,
          name: data.name || "Untitled Wheel",
          icon: data.icon || "🎯",
          color: data.color || "#8B2635",
          spins: data.spins || 0,
          used: data.used || 0,
          slices: data.slices || [],
          userId: data.userId,
          live: data.live || false,
          liveJoinCode: data.liveJoinCode,
        })
      })

      setWheels(loadedWheels)
    } catch (error) {
      console.error("Error loading wheels from Firestore:", error)
      Alert.alert("Error", "Failed to load wheels.")
    }
  }, [currentUser])

  useFocusEffect(
    useCallback(() => {
      loadWheels()
    }, [loadWheels])
  )

  const handleWheelPress = (wheel: WheelTemplate) => {
    navigation.navigate("Wheel", { wheelId: wheel.id })
  }

  const handleEdit = (wheel: WheelTemplate) => {
    navigation.navigate("EditWheel", { wheelId: wheel.id })
  }

  const handleDelete = async (id: string) => {
    try {
      if (!db) {
        console.error("Firestore DB instance is undefined in handleDelete. Cannot delete wheel.")
        Alert.alert("Error", "Firebase is not properly initialized. Please restart the app.")
        return
      }
      await deleteDoc(doc(db, "wheels", id))
      setWheels((currentWheels) => currentWheels.filter((wheel) => wheel.id !== id))
      Alert.alert("Success", "Wheel deleted successfully!")
    } catch (error) {
      console.error("Error deleting wheel from Firestore:", error)
      Alert.alert("Error", "Failed to delete wheel. Check permissions or network.")
    }
  }

  const handleAddNew = () => {
    navigation.navigate("WheelCategory")
  }

  const handleCreateLiveRoom = () => {
    navigation.navigate("LiveRoomTab")
  }


  const renderWheelCard = (wheel: WheelTemplate) => (
    <View
      key={wheel.id}
      style={[
        styles.wheelCard,
        {
          backgroundColor: theme.surface,
          borderColor: wheel.live ? '#ff4444' : 'transparent',
          borderWidth: wheel.live ? 2 : 0,
        }
      ]}
    >
      <TouchableOpacity
        style={styles.wheelCardContent}
        onPress={() => handleWheelPress(wheel)}
      >
        <View style={styles.wheelCardHeader}>
          <View style={styles.wheelInfo}>
            <View style={styles.wheelIconContainer}>
              <MiniPieWheel
                slices={wheel.slices || []}
                size={40}
                strokeWidth={1}
              />
            </View>
            <View style={styles.wheelDetails}>
              <View style={styles.wheelNameRow}>
                <Text style={[styles.wheelName, { color: theme.text }]} numberOfLines={1}>
                  {wheel.name}
                </Text>
                {wheel.live && (
                  <View style={styles.liveIndicator}>
                    <View style={[styles.liveDot, { backgroundColor: "#ff4444" }]} />
                    <Text style={[styles.liveText, { color: "#ff4444" }]}>LIVE</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.wheelStats, { color: theme.textSecondary }]}>
                {wheel.slices?.length || 0} items • {wheel.spins || 0} spins
              </Text>
              {wheel.live && wheel.liveJoinCode && (
                <Text style={[styles.joinCodeText, { color: theme.primary }]}>
                  Join Code: {wheel.liveJoinCode}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.wheelActions}>
            {wheel.live ? (
              <TouchableOpacity
                style={[styles.liveActionButton, { backgroundColor: theme.primary }]}
                onPress={() => handleWheelPress(wheel)}
              >
                <Ionicons name="play-circle" size={20} color={theme.surface} />
                <Text style={[styles.liveActionText, { color: theme.surface }]}>Go to Wheel</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEdit(wheel)}
                >
                  <Ionicons name="create-outline" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    Alert.alert(
                      "Delete Wheel",
                      `Are you sure you want to delete "${wheel.name}"?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => handleDelete(wheel.id) },
                      ]
                    )
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.error} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Image source={centerLogoImage} style={styles.logo} />
            <View style={styles.headerText}>
              <Text style={[styles.welcomeText, { color: theme.textSecondary }]}>
                Welcome back, Teacher
              </Text>
              <Text style={[styles.userName, { color: theme.text }]}>
                {userProfile?.fullName || currentUser?.email || "Teacher"}
              </Text>
            </View>
            <View style={styles.headerActions}>
              {/* Notification Bell removed - now unified in MainNavigator */}
            </View>
          </View>
        </View>


        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: theme.surface }]}
              onPress={handleCreateLiveRoom}
            >
              <Ionicons name="videocam" size={32} color={theme.primary} />
              <Text style={[styles.quickActionText, { color: theme.text }]}>Create Live Room</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: theme.surface }]}
              onPress={() => navigation.navigate("History" as never)}
            >
              <Ionicons name="time" size={32} color={theme.primary} />
              <Text style={[styles.quickActionText, { color: theme.text }]}>View History</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: theme.surface }]}
              onPress={() => navigation.navigate("Participants")}
            >
              <Ionicons name="people" size={32} color={theme.primary} />
              <Text style={[styles.quickActionText, { color: theme.text }]}>Manage Participants</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Admin Actions */}
        <View style={styles.adminActions}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Admin Actions</Text>
          <View style={styles.adminActionContainer}>
            <WheelTypePresets onPresetAdded={() => {
              // Refresh the wheel list when a preset is added
              loadWheels()
            }} />
          </View>
        </View>

        {/* My Wheels */}
        <View style={styles.wheelsSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>My Wheels</Text>
            <TouchableOpacity onPress={handleAddNew}>
              <Text style={[styles.seeAllText, { color: theme.primary }]}>Add New</Text>
            </TouchableOpacity>
          </View>
          
          {wheels.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={64} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No wheels yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Create your first wheel to get started
              </Text>
              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: theme.primary }]}
                onPress={handleAddNew}
              >
                <Text style={[styles.createButtonText, { color: theme.surface }]}>
                  Create Wheel
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.wheelsList}>
              {wheels.map(renderWheelCard)}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    maxWidth: 800,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: Platform.OS === "web" ? 24 : 16,
  },
  scrollContent: {
    paddingTop: Platform.OS === "ios" ? 20 : 40, // Add proper top padding
    paddingBottom: 100, // Add bottom padding for tab bar
  },
  header: {
    paddingVertical: 24, // Increased padding
    paddingTop: Platform.OS === "web" ? 20 : 40, // Platform-specific top padding
    marginBottom: 16, // Add margin between sections
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 60, // Slightly larger logo
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  welcomeText: {
    fontSize: 16, // Slightly larger text
    marginBottom: 4,
  },
  userName: {
    fontSize: 22, // Adjusted size
    fontWeight: "bold",
  },

  quickActions: {
    marginBottom: 32,
    paddingHorizontal: 4, // Add slight padding for better spacing
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: "row",
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
  wheelsSection: {
    marginBottom: 32,
    paddingHorizontal: 4, // Add slight padding for better spacing
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
  },
  wheelsList: {
    gap: 12,
  },
  wheelCard: {
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  wheelCardContent: {
    padding: 16,
  },
  wheelCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  wheelInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  wheelIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  wheelIconContainer: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelDetails: {
    flex: 1,
  },
  wheelName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  wheelStats: {
    fontSize: 12,
  },
  wheelActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },

  wheelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  joinCodeText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  liveActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  liveActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Admin Actions Styles
  adminActions: {
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  adminActionContainer: {
    alignItems: 'center',
  },
})

export default TeacherHomeScreen
