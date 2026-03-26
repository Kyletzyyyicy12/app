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
import { useNotifications } from "../contexts/NotificationContext"
import { db } from "../config/firebaseConfig"
import { collection, query, where, getDocs, deleteDoc, doc, limit } from "firebase/firestore"
import MiniPieWheel from "../components/MiniPieWheel"
import BackgroundWrapper from "../components/BackgroundWrapper"

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
}

interface LiveDraw {
  id: string
  name: string
  joinCode: string
  createdBy: string
  createdAt: any
}

const StudentHomeScreen: React.FC = () => {
  const navigation = useNavigation<any>()
  const { theme } = useTheme()
  const { currentUser, userProfile } = useAuth()
  const { invitations, acceptInvitation } = useNotifications()
  const [liveDraws, setLiveDraws] = useState<LiveDraw[]>([])
  const [wheels, setWheels] = useState<WheelTemplate[]>([])

  // Load available live draws
  const loadLiveDraws = useCallback(async () => {
    if (!db) return

    try {
      // Prefer liveDrawSessions (often has wider read rules)
      const sessionQuery = query(
        collection(db, 'liveDrawSessions'),
        where('isActive', '==', true),
        limit(10)
      )
      const sessionSnapshot = await getDocs(sessionQuery)
      const sessionDraws: LiveDraw[] = []

      sessionSnapshot.forEach((doc) => {
        const data = doc.data() as any
        if (data && data.roomCode) {
          sessionDraws.push({
            id: data.wheelId || doc.id,
            name: data.wheelName || 'Live Draw',
            joinCode: data.roomCode,
            createdBy: data.createdBy || 'unknown',
            createdAt: data.createdAt || new Date(),
          })
        }
      })

      if (sessionDraws.length > 0) {
        // Sort newest first
        sessionDraws.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt)
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
          return dateB.getTime() - dateA.getTime()
        })
        setLiveDraws(sessionDraws)
        return
      }

      // Fallback to wheels collection
      const wheelsQueryRef = query(
        collection(db, 'wheels'),
        where('live', '==', true),
        limit(10)
      )
      const wheelsSnapshot = await getDocs(wheelsQueryRef)
      const draws: LiveDraw[] = []

      wheelsSnapshot.forEach((doc) => {
        const data = doc.data() as any
        if (data.liveJoinCode) {
          draws.push({
            id: doc.id,
            name: data.name || 'Untitled Draw',
            joinCode: data.liveJoinCode,
            createdBy: data.userId,
            createdAt: data.liveSessionStartedAt || new Date(),
          })
        }
      })

      draws.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt)
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
        return dateB.getTime() - dateA.getTime()
      })

      setLiveDraws(draws)
    } catch (error) {
      console.error('Error loading live draws:', error)
      // Do not surface alert here; screen remains usable
    }
  }, [])

  // Load wheels from Firestore
  const loadWheels = useCallback(async () => {
    if (!currentUser || !db) return

    try {
      const q = query(collection(db, "wheels"), where("userId", "==", currentUser.uid))
      const querySnapshot = await getDocs(q)
      const loadedWheels: WheelTemplate[] = []

      querySnapshot.forEach((doc) => {
        try {
          const data = doc.data()
          if (data && doc.id) {
            loadedWheels.push({
              id: doc.id,
              name: data.name || "Untitled Wheel",
              icon: data.icon || "🎯",
              color: data.color || "#8B2635",
              spins: data.spins || 0,
              used: data.used || 0,
              slices: Array.isArray(data.slices) ? data.slices : [],
              userId: data.userId || currentUser?.uid || "",
            })
          }
        } catch (error) {
          console.error("Error processing wheel document:", doc.id, error)
        }
      })

      setWheels(loadedWheels)
    } catch (error) {
      console.error("Error loading wheels from Firestore:", error)
      Alert.alert("Error", "Failed to load wheels.")
    }
  }, [currentUser])

  useFocusEffect(
    useCallback(() => {
      loadLiveDraws()
      loadWheels()
    }, [loadLiveDraws, loadWheels])
  )

  const handleWheelPress = (wheel: WheelTemplate) => {
    if (!wheel || !wheel.id) {
      Alert.alert("Error", "Invalid wheel data. Please try again.")
      return
    }
    try {
      navigation.navigate("Wheel", { wheelId: wheel.id })
    } catch (error) {
      console.error("Navigation error:", error)
      Alert.alert("Error", "Failed to open wheel. Please try again.")
    }
  }

  const handleEdit = (wheel: WheelTemplate) => {
    if (!wheel || !wheel.id) {
      Alert.alert("Error", "Invalid wheel data. Please try again.")
      return
    }
    try {
      navigation.navigate("EditWheel", { wheelId: wheel.id })
    } catch (error) {
      console.error("Navigation error:", error)
      Alert.alert("Error", "Failed to edit wheel. Please try again.")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      if (!db) {
        Alert.alert("Error", "Database not available.")
        return
      }

      await deleteDoc(doc(db, "wheels", id))
      setWheels((prev) => prev.filter((wheel) => wheel.id !== id))
      Alert.alert("Success", "Wheel deleted successfully!")
    } catch (error) {
      console.error("Error deleting wheel:", error)
      Alert.alert("Error", "Failed to delete wheel.")
    }
  }

  const renderWheelCard = (wheel: WheelTemplate) => {
    if (!wheel || !wheel.id) {
      console.warn("Invalid wheel data:", wheel)
      return null
    }

    return (
      <TouchableOpacity
        key={wheel.id}
        style={[styles.wheelCard, { backgroundColor: theme.surface }]}
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
              <Text style={[styles.wheelName, { color: theme.text }]} numberOfLines={1}>
                {wheel.name || "Untitled Wheel"}
              </Text>
              <Text style={[styles.wheelStats, { color: theme.textSecondary }]}>
                {wheel.slices?.length || 0} items • {wheel.spins || 0} spins
              </Text>
            </View>
          </View>
        <View style={styles.wheelActions}>
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
        </View>
      </View>
    </TouchableOpacity>
    )
  }


  // Handle accepting real-time invitations
  const handleAcceptInvitation = (invitation: any) => {
    acceptInvitation(invitation)
    // Navigate to live room viewer
    navigation.navigate("LiveRoomViewer", {
      wheelId: invitation.wheelId,
      roomCode: invitation.joinCode,
      wheelName: invitation.wheelName
    })
  }


  return (
    <BackgroundWrapper>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Image source={centerLogoImage} style={styles.logo} />
            <View style={styles.headerText}>
              <Text style={[styles.welcomeText, { color: theme.textSecondary }]}>
                Welcome
              </Text>
              <Text style={[styles.userName, { color: theme.text }]}>
                {userProfile?.fullName || currentUser?.email || "Participant"}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.roleSwitchButton, { backgroundColor: theme.primary + "20", borderColor: theme.primary }]}
                onPress={() => navigation.navigate('RoleSelection')}
              >
                <Ionicons name="person" size={20} color={theme.primary} />
                <Text style={[styles.roleSwitchText, { color: theme.primary }]}>Participant</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>



        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: theme.surface }]}
              onPress={() => navigation.navigate("WheelCategory")}
            >
              <Ionicons name="add-circle" size={32} color={theme.primary} />
              <Text style={[styles.quickActionText, { color: theme.text }]}>Browse Picker Wheels (Solo)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: theme.surface }]}
              onPress={() => navigation.navigate("SavedWheels")}
            >
              <Ionicons name="create" size={32} color={theme.primary} />
              <Text style={[styles.quickActionText, { color: theme.text }]}>Create Your Wheel</Text>
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
              onPress={() => navigation.navigate("JoinLiveDraw")}
            >
              <View style={styles.liveDrawIndicator}>
                <Ionicons name="radio" size={32} color={theme.primary} />
                {liveDraws.length > 0 && (
                  <View style={[styles.liveBadge, { backgroundColor: theme.error }]} >
                    <Text style={styles.liveBadgeText}>{liveDraws.length}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.quickActionText, { color: theme.text }]}>Join Live Draw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Invitations */}
        {invitations && invitations.length > 0 && (
          <View style={styles.liveDrawsSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Invitations</Text>
            <View style={styles.liveDrawsList}>
              {invitations.map((inv) => (
                <TouchableOpacity
                  key={inv.id}
                  style={[styles.liveDrawCard, { backgroundColor: theme.surface }]}
                  onPress={() => handleAcceptInvitation(inv as any)}
                >
                  <View style={styles.liveDrawHeader}>
                    <View style={styles.liveIndicator}>
                      <View style={[styles.liveDot, { backgroundColor: '#10B981' }]} />
                      <Text style={[styles.liveText, { color: '#10B981' }]}>INVITATION</Text>
                    </View>
                    <Text style={[styles.joinCodeText, { color: theme.textSecondary }]}>Code: {inv.joinCode}</Text>
                  </View>
                  <Text style={[styles.drawName, { color: theme.text }]} numberOfLines={1}>
                    {inv.wheelName}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="play-circle" size={20} color={theme.primary} />
                    <Text style={[styles.joinButtonText, { color: theme.primary }]}>Join Now</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* My Wheels */}
        <View style={styles.wheelsSection}>
          <View style={styles.wheelsSectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>My Wheels</Text>
            <TouchableOpacity onPress={() => navigation.navigate("SavedWheels")}>
              <Text style={[styles.addNewText, { color: theme.primary }]}>Add New</Text>
            </TouchableOpacity>
          </View>

          {wheels.length === 0 ? (
            <View style={styles.emptyWheelsContainer}>
              <Ionicons name="albums-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyWheelsText, { color: theme.textSecondary }]}>
                No wheels yet
              </Text>
              <TouchableOpacity
                style={[styles.createFirstWheelButton, { backgroundColor: theme.primary }]}
                onPress={() => navigation.navigate("SavedWheels" as never)}
              >
                <Text style={[styles.createFirstWheelText, { color: theme.surface }]}>
                  Create Your First Wheel
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
    </BackgroundWrapper>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "web" ? 0 : 10,
  },
  content: {
    flex: 1,
    maxWidth: 800,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: Platform.OS === "web" ? 24 : 16,
  },
  scrollContent: {
    paddingTop: Platform.OS === "ios" ? 20 : 40,
    paddingBottom: 100,
  },
  header: {
    paddingVertical: 24,
    paddingTop: Platform.OS === "web" ? 20 : 40,
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    marginBottom: 4,
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  liveDrawsSection: {
    marginBottom: 32,
  },
  liveDrawsList: {
    gap: 12,
  },
  liveDrawCard: {
    padding: 18,
    borderRadius: 16,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginVertical: 2,
    // Enhanced background
    backgroundColor: Platform.select({
      ios: 'rgba(255,255,255,0.95)',
      android: 'rgba(255,255,255,0.98)',
      default: 'rgba(255,255,255,0.95)'
    }),
  },
  liveDrawHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  joinCodeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  drawName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  featuresSection: {
    marginBottom: 32,
  },
  featuresList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
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
  },
  // Quick Actions Styles
  quickActionsSection: {
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
    justifyContent: "space-between",
  },
  quickActionCard: {
    width: "48%",
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    backgroundColor: Platform.select({
      ios: 'rgba(255,255,255,0.95)',
      android: 'rgba(255,255,255,0.98)',
      default: 'rgba(255,255,255,0.95)'
    }),
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 10,
    textAlign: "center",
    lineHeight: 16,
  },
  // Wheels Section Styles
  wheelsSection: {
    marginBottom: 32,
    paddingHorizontal: 4, // Add slight padding for better spacing
  },
  wheelsSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  addNewText: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyWheelsContainer: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyWheelsText: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  createFirstWheelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createFirstWheelText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  wheelsList: {
    gap: 12,
  },
  wheelCard: {
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginVertical: 2,
    // Add subtle background enhancement
    backgroundColor: Platform.select({
      ios: 'rgba(255,255,255,0.95)',
      android: 'rgba(255,255,255,0.98)',
      default: 'rgba(255,255,255,0.95)'
    }),
  },
  wheelCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wheelInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
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
    fontWeight: "bold",
    marginBottom: 4,
  },
  wheelStats: {
    fontSize: 14,
  },
  wheelActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
  },
  // Live Draw Indicator Styles
  liveDrawIndicator: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  logoutSection: {
    marginTop: 16,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingRight: 8,
  },
  roleSwitchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    gap: 6,
  },
  roleSwitchText: {
    fontSize: 12,
    fontWeight: '600',
  },
})

export default StudentHomeScreen
