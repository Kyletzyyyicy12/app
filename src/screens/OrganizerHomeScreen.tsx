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
import { signOut } from "firebase/auth"
import { auth } from "../config/firebaseConfig"
import MiniPieWheel from "../components/MiniPieWheel"
import BackgroundWrapper from "../components/BackgroundWrapper"
import { MobileNotificationManager } from "../components/MobileNotificationManager"

const centerLogoImage = require("../../assets/images/ulo.png")

interface WheelTemplate {
  id: string
  name: string
  icon?: string
  color?: string
  spins?: number
  used?: number
  slices?: any[]
  userId: string
  live?: boolean
  liveJoinCode?: string
}

interface EventStats {
  totalWheels: number
  totalSpins: number
  activeLiveDraws: number
  totalParticipants: number
}

const OrganizerHomeScreen: React.FC = () => {
  const navigation = useNavigation<any>()
  const { theme } = useTheme()
  const { currentUser, userProfile } = useAuth()
  const [wheels, setWheels] = useState<WheelTemplate[]>([])
  const [stats, setStats] = useState<EventStats>({
    totalWheels: 0,
    totalSpins: 0,
    activeLiveDraws: 0,
    totalParticipants: 0,
  })

  // Load wheels and stats from Firestore
  const loadData = useCallback(async () => {
    if (!currentUser || !db) return

    try {
      // Load wheels
      const wheelsQuery = query(collection(db, "wheels"), where("userId", "==", currentUser.uid))
      const wheelsSnapshot = await getDocs(wheelsQuery)
      const loadedWheels: WheelTemplate[] = []
      let totalSpins = 0
      let activeLiveDraws = 0

      wheelsSnapshot.forEach((doc) => {
        const data = doc.data()
        const wheel = {
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
        }
        loadedWheels.push(wheel)
        totalSpins += wheel.spins || 0
        if (wheel.live) activeLiveDraws++
      })

      // Load participants count
      const participantsQuery = query(collection(db, "participants"), where("userId", "==", currentUser.uid))
      const participantsSnapshot = await getDocs(participantsQuery)

      setWheels(loadedWheels)
      setStats({
        totalWheels: loadedWheels.length,
        totalSpins,
        activeLiveDraws,
        totalParticipants: participantsSnapshot.size,
      })
    } catch (error) {
      console.error("Error loading data:", error)
      Alert.alert("Error", "Failed to load data.")
    }
  }, [currentUser])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData])
  )

  const handleWheelPress = (wheel: WheelTemplate) => {
    navigation.navigate("HomeTab", {
      screen: "Wheel",
      params: { wheelId: wheel.id }
    })
  }

  const handleCreateLiveRoom = () => {
    navigation.navigate("LiveRoomTab")
  }



  const renderStatCard = (title: string, value: number, icon: string, color: string) => (
    <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statTitle, { color: theme.textSecondary }]}>{title}</Text>
    </View>
  )

  const confirmDeleteWheel = (wheel: WheelTemplate) => {
    Alert.alert(
      'Delete Wheel',
      `Are you sure you want to delete "${wheel.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(collection(db, 'wheels'), wheel.id))
              setWheels(prev => prev.filter(w => w.id !== wheel.id))
            } catch (e) {
              Alert.alert('Error', 'Failed to delete wheel.')
            }
          }
        },
      ]
    )
  }

  const renderWheelCard = (wheel: WheelTemplate) => (
    <TouchableOpacity
      key={wheel.id}
      style={[styles.wheelCard, { backgroundColor: theme.surface }]}
      onPress={() => handleWheelPress(wheel)}
      onLongPress={() => confirmDeleteWheel(wheel)}
      delayLongPress={400}
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
              {wheel.name}
            </Text>
            <Text style={[styles.wheelStats, { color: theme.textSecondary }]}>
              {wheel.slices?.length || 0} items • {wheel.spins || 0} spins
            </Text>
          </View>
        </View>
        {wheel.live && (
          <View style={styles.liveIndicator}>
            <View style={[styles.liveDot, { backgroundColor: "#ff4444" }]} />
            <Text style={[styles.liveText, { color: "#ff4444" }]}>LIVE</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )

  return (
    <BackgroundWrapper>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Image source={centerLogoImage} style={styles.logo} />
            <View style={styles.headerText}>
              <Text style={[styles.welcomeText, { color: theme.textSecondary }]}>
                Welcome
              </Text>
              <Text style={[styles.userName, { color: theme.text }]}>
                {userProfile?.fullName || currentUser?.email || "Organizer"}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.roleSwitchButton, { backgroundColor: theme.primary + "20", borderColor: theme.primary }]}
                onPress={() => navigation.navigate('RoleSelection')}
              >
                <Ionicons name="person" size={20} color={theme.primary} />
                <Text style={[styles.roleSwitchText, { color: theme.primary }]}>Organizer</Text>
              </TouchableOpacity>
              <MobileNotificationManager />
            </View>
          </View>
        </View>


        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: theme.surface }]}
              onPress={() => navigation.navigate("HomeTab", { screen: "WheelCategory" })}
            >
              <Ionicons name="add-circle" size={32} color={theme.primary} />
              <Text style={[styles.quickActionText, { color: theme.text }]}>Browse Picker Wheels (Solo)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: theme.surface }]}
              onPress={handleCreateLiveRoom}
            >
              <Ionicons name="videocam" size={32} color={theme.primary} />
              <Text style={[styles.quickActionText, { color: theme.text }]}>Create Live Activity</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: theme.surface }]}
              onPress={() => navigation.navigate("HomeTab", { screen: "History" })}
            >
              <Ionicons name="time" size={32} color={theme.primary} />
              <Text style={[styles.quickActionText, { color: theme.text }]}>View Spin History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: theme.surface }]}
              onPress={() => navigation.navigate("HomeTab", { screen: "SavedWheels" })}
            >
              <Ionicons name="create" size={32} color={theme.primary} />
              <Text style={[styles.quickActionText, { color: theme.text }]}>Create Your Wheel</Text>
            </TouchableOpacity>

          </View>
        </View>

        {/* Recent Wheels */}
        <View style={styles.wheelsSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Wheels</Text>
          </View>
          
          {wheels.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={64} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No wheels yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Create your first wheel to start organizing events
              </Text>
              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: theme.primary }]}
                onPress={() => navigation.navigate("HomeTab" as never, { screen: "WheelCategory" } as never)}
              >
                <Text style={[styles.createButtonText, { color: theme.surface }]}>
                  Create Wheel
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.wheelsList}>
              {wheels.slice(0, 5).map(renderWheelCard)}
              {wheels.length > 5 && (
                <TouchableOpacity style={styles.viewAllButton}>
                  <Text style={[styles.viewAllText, { color: theme.primary }]}>
                    View All Wheels ({wheels.length})
                  </Text>
                </TouchableOpacity>
              )}
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
  header: {
    paddingVertical: 20,
    paddingTop: Platform.OS === "web" ? 20 : 30,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingRight: 8,
  },
  accountButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
  },
  statsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    backgroundColor: Platform.select({
      ios: 'rgba(255,255,255,0.95)',
      android: 'rgba(255,255,255,0.98)',
      default: 'rgba(255,255,255,0.95)'
    }),
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    textAlign: "center",
  },
  quickActions: {
    marginBottom: 32,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    minWidth: "45%",
    alignItems: "center",
    padding: 24,
    borderRadius: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
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
    marginTop: 8,
    textAlign: "center",
  },
  wheelsSection: {
    marginBottom: 32,
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
    borderRadius: 16,
    padding: 18,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginVertical: 2,
    backgroundColor: Platform.select({
      ios: 'rgba(255,255,255,0.95)',
      android: 'rgba(255,255,255,0.98)',
      default: 'rgba(255,255,255,0.95)'
    }),
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
  viewAllButton: {
    alignItems: "center",
    paddingVertical: 16,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
  },
  logoutSection: {
    marginTop: 16,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  roleSwitchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    gap: 6,
  },
  roleSwitchText: {
    fontSize: 12,
    fontWeight: '600',
  },
})

export default OrganizerHomeScreen
