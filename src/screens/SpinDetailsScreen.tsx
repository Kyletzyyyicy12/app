import React, { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../contexts/ThemeContext"
import { db } from "../config/firebaseConfig"
import { collection, getDocs, query, where } from "firebase/firestore"

interface SpinDetailsProps {
  route: any
}

const SpinDetailsScreen: React.FC<SpinDetailsProps> = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { theme } = useTheme()
  const [sessionData, setSessionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const { activity, wheelName, winners, timestamp, description } = route.params || {}

  useEffect(() => {
    const loadSessionData = async () => {
      try {
        // Try to find detailed session data
        if (activity?.id?.includes('live_session') || activity?.id?.includes('participant_joined')) {
          // Extract session ID from activity ID
          const sessionId = activity.id.split('_').pop()

          if (sessionId && sessionId !== 'end') {
            try {
              // Try loading from liveDrawSessions
              const sessionsRef = collection(db, "liveDrawSessions")
              const q = query(sessionsRef)
              const snapshot = await getDocs(q)

              for (const doc of snapshot.docs) {
                if (doc.id === sessionId) {
                  const data = doc.data()

                  // Load viewers/participants
                  try {
                    const viewersRef = collection(db, "liveDrawSessions", sessionId, "viewers")
                    const viewersSnapshot = await getDocs(viewersRef)

                    setSessionData({
                      ...data,
                      sessionId,
                      viewerCount: viewersSnapshot.size,
                      viewers: viewersSnapshot.docs.map(doc => doc.data()),
                    })
                    setLoading(false)
                    return
                  } catch (error) {
                    console.log("Could not load viewers:", error)
                  }

                  setSessionData({
                    ...data,
                    sessionId,
                    viewerCount: data.participantCount || 0,
                  })
                  setLoading(false)
                  return
                }
              }
            } catch (error) {
              console.log("Could not load session from liveDrawSessions:", error)
            }

            // Try loading from liveWheelHistory
            try {
              const historyRef = collection(db, "liveWheelHistory")
              const q = query(historyRef)
              const snapshot = await getDocs(q)

              for (const doc of snapshot.docs) {
                if (doc.id === sessionId) {
                  const data = doc.data()
                  setSessionData({
                    ...data,
                    sessionId,
                    viewerCount: data.participantCount || (data.winners?.length || 0),
                  })
                  setLoading(false)
                  return
                }
              }
            } catch (error) {
              console.log("Could not load session from liveWheelHistory:", error)
            }
          }
        }

        setSessionData(null)
        setLoading(false)
      } catch (error) {
        console.error("Error loading session data:", error)
        setLoading(false)
      }
    }

    loadSessionData()
  }, [activity])

  const formatDate = (date: Date) => {
    if (!date) return "N/A"
    return date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    })
  }

  const formatTime = (date: Date) => {
    if (!date) return "N/A"
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  }

  const getCategory = () => {
    if (sessionData?.category) return sessionData.category
    if (sessionData?.wheelCategory) return sessionData.wheelCategory
    return "General"
  }

  const getWinnerCount = () => {
    if (winners && Array.isArray(winners)) return winners.length
    if (sessionData?.winners && Array.isArray(sessionData.winners)) return sessionData.winners.length
    return 0
  }

  const getParticipantCount = () => {
    if (sessionData?.viewerCount) return sessionData.viewerCount
    if (sessionData?.participantCount) return sessionData.participantCount
    if (sessionData?.viewers) return sessionData.viewers.length
    return 0
  }

  const getSpinDuration = () => {
    if (sessionData?.duration) return sessionData.duration
    if (sessionData?.durationMs) return Math.round(sessionData.durationMs / 1000)
    return 0
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading details...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Spin Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Activity Title */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Activity</Text>
          <Text style={[styles.activityName, { color: theme.text }]}>
            {wheelName || activity?.wheelName || "Wheel Spin"}
          </Text>
        </View>

        {/* Category */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Category</Text>
          <Text style={[styles.detailText, { color: theme.textSecondary }]}>
            {getCategory()}
          </Text>
        </View>

        {/* Date & Time */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Date & Time</Text>
          <View style={styles.dateTimeContainer}>
            <View style={styles.dateTimeItem}>
              <Ionicons name="calendar" size={20} color={theme.primary} />
              <Text style={[styles.detailText, { color: theme.text, marginLeft: 8 }]}>
                {formatDate(timestamp || new Date())}
              </Text>
            </View>
            <View style={styles.dateTimeItem}>
              <Ionicons name="time" size={20} color={theme.primary} />
              <Text style={[styles.detailText, { color: theme.text, marginLeft: 8 }]}>
                {formatTime(timestamp || new Date())}
              </Text>
            </View>
          </View>
        </View>

        {/* Winners */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Winners ({getWinnerCount()})
          </Text>
          {winners && winners.length > 0 ? (
            <View>
              {winners.map((winner: string, index: number) => (
                <View key={index} style={styles.winnerItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  <Text style={[styles.winnerText, { color: theme.text, marginLeft: 8 }]}>
                    {winner}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.detailText, { color: theme.textSecondary }]}>
              No winners recorded
            </Text>
          )}
        </View>

        {/* Participants */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Participants ({getParticipantCount()})
          </Text>
          <Text style={[styles.detailText, { color: theme.textSecondary }]}>
            {getParticipantCount()} participant{getParticipantCount() !== 1 ? 's' : ''} joined this session
          </Text>
        </View>

        {/* Spin Details */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Spin Details</Text>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Type</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>Regular Spin</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Number of Winners</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>
              {getWinnerCount()}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Spin Duration</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>
              {getSpinDuration()}s
            </Text>
          </View>
        </View>

        {/* Description */}
        {description && (
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Notes</Text>
            <Text style={[styles.detailText, { color: theme.text }]}>
              {description}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  activityName: {
    fontSize: 18,
    fontWeight: "bold",
    lineHeight: 24,
  },
  detailText: {
    fontSize: 14,
    lineHeight: 20,
  },
  dateTimeContainer: {
    gap: 12,
  },
  dateTimeItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  winnerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  winnerText: {
    fontSize: 14,
    fontWeight: "500",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
  },
})

export default SpinDetailsScreen
