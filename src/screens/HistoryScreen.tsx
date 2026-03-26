// Create new HistoryScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, SafeAreaView, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../config/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import type { HomeStackParamList, ActivityItem } from "../navigation/types";

type HistoryScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, "History">

const HistoryScreen = () => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const navigation = useNavigation<HistoryScreenNavigationProp>();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAllActivities = async () => {
      if (!currentUser) return;

      try {
        const allActivities: ActivityItem[] = [];
        const activityIds = new Set<string>(); // Track unique activities to prevent duplicates

        // Helper function to normalize timestamp
        const normalizeTimestamp = (timestamp: any): Date => {
          if (!timestamp) return new Date();
          if (timestamp instanceof Date) return timestamp;
          if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
          }
          return new Date();
        };

        // Helper function to normalize winners array
        const normalizeWinners = (winners: any): string[] => {
          if (!winners) return [];
          if (typeof winners === 'string') return [winners];
          if (Array.isArray(winners)) {
            return winners.map(w => {
              if (typeof w === 'string') return w;
              if (typeof w === 'object' && w.name) return w.name;
              return String(w);
            }).filter(Boolean);
          }
          return [];
        };

        // Helper to add activity with deduplication
        const addActivity = (activity: ActivityItem) => {
          if (!activityIds.has(activity.id)) {
            activityIds.add(activity.id);
            allActivities.push(activity);
          }
        };

        // Load wheel spins history from all user's wheels
        try {
          const wheelsQuery = query(
            collection(db, "wheels"),
            where("userId", "==", currentUser.uid)
          );
          const wheelsSnapshot = await getDocs(wheelsQuery);

          for (const wheelDoc of wheelsSnapshot.docs) {
            const wheelData = wheelDoc.data();
            const wheelName = wheelData.name || "Untitled Wheel";
            const createdAt = normalizeTimestamp(wheelData.createdAt);

            // Add wheel creation activity
            addActivity({
              id: `wheel_created_${wheelDoc.id}`,
              type: 'wheel_created',
              title: `Created wheel "${wheelName}"`,
              description: `${wheelData.slices?.length || 0} items`,
              timestamp: createdAt,
              wheelName,
              winners: []
            });

            // Get spin history for this wheel
            try {
              const historyRef = collection(db, "wheels", wheelDoc.id, "history");
              const historySnapshot = await getDocs(historyRef);

              historySnapshot.forEach((historyDoc) => {
                const historyData = historyDoc.data();
                const timestamp = normalizeTimestamp(historyData.timestamp);
                const winners = normalizeWinners(historyData.winners);

                addActivity({
                  id: `spin_${wheelDoc.id}_${historyDoc.id}`,
                  type: 'spin',
                  title: `Spun "${wheelName}"`,
                  description: `Winners: ${winners.length > 0 ? winners.join(', ') : 'No winners'}`,
                  timestamp,
                  wheelName,
                  winners
                });
              });
            } catch (error) {
              console.log(`Could not load history for wheel ${wheelName}:`, error);
            }
          }
        } catch (error) {
          console.log("Could not load wheels:", error);
        }

        // Load participants added
        try {
          const participantsQuery = query(
            collection(db, "participants"),
            where("userId", "==", currentUser.uid)
          );
          const participantsSnapshot = await getDocs(participantsQuery);

          participantsSnapshot.forEach((participantDoc) => {
            const participantData = participantDoc.data();
            const timestamp = normalizeTimestamp(participantData.createdAt);

            addActivity({
              id: `participant_${participantDoc.id}`,
              type: 'participant_added',
              title: `Added participant "${participantData.name || 'Unknown'}"`,
              description: `Category: ${participantData.category || 'Personal'}`,
              timestamp,
              wheelName: undefined,
              winners: []
            });
          });
        } catch (error) {
          console.log("Could not load participants history:", error);
        }

        // Load live wheel sessions organized by user
        try {
          const liveHistoryQuery = query(
            collection(db, "liveWheelHistory"),
            where("organizerId", "==", currentUser.uid)
          );
          const liveHistorySnapshot = await getDocs(liveHistoryQuery);

          liveHistorySnapshot.forEach((doc) => {
            const data = doc.data();
            const timestamp = normalizeTimestamp(data.endedAt);
            const winners = normalizeWinners(data.winners);
            const duration = Math.round(data.duration || 0);

            addActivity({
              id: `live_session_${doc.id}`,
              type: 'live_session_ended',
              title: `Ended live session "${data.customWheelTitle || 'Live Session'}"`,
              description: `Winners: ${winners.length > 0 ? winners.join(', ') : 'None'}, Duration: ${duration}s`,
              timestamp,
              wheelName: data.customWheelTitle || 'Live Session',
              winners
            });
          });
        } catch (error) {
          console.log("Could not load live wheel history:", error);
        }

        // Load live draw sessions the user participated in
        try {
          const sessionsQuery = query(collection(db, "liveDrawSessions"));
          const sessionsSnapshot = await getDocs(sessionsQuery);

          for (const sessionDoc of sessionsSnapshot.docs) {
            const sessionId = sessionDoc.id;
            const sessionData = sessionDoc.data();
            const sessionTitle = sessionData.customWheelTitle || sessionData.wheelName || 'Live Session';

            try {
              // Check if user was a participant (viewer) in this session
              const viewersRef = collection(db, "liveDrawSessions", sessionId, "viewers");
              const viewerQuery = query(viewersRef, where("userId", "==", currentUser.uid));
              const viewerSnapshot = await getDocs(viewerQuery);

              if (!viewerSnapshot.empty) {
                // User participated - record join activity
                const viewerData = viewerSnapshot.docs[0].data();
                const joinedAt = normalizeTimestamp(viewerData.joinedAt || sessionData.createdAt);

                addActivity({
                  id: `participant_joined_${sessionId}`,
                  type: 'participant_joined',
                  title: `Joined live session "${sessionTitle}"`,
                  description: `Room Code: ${sessionData.roomCode || 'N/A'}`,
                  timestamp: joinedAt,
                  wheelName: sessionTitle,
                  winners: []
                });

                // If session is closed and has results, add session ended activity
                if (sessionData.isActive === false) {
                  const winners = normalizeWinners(sessionData.winners);
                  const endedAt = normalizeTimestamp(sessionData.endedAt || sessionData.createdAt);

                  addActivity({
                    id: `participant_session_ended_${sessionId}`,
                    type: 'participant_session_ended',
                    title: `Participated in session "${sessionTitle}"`,
                    description: `Results: ${winners.length > 0 ? winners.join(', ') : 'Completed'}`,
                    timestamp: endedAt,
                    wheelName: sessionTitle,
                    winners
                  });
                }
              }
            } catch (error) {
              console.log(`Could not check participation for session ${sessionId}:`, error);
            }
          }
        } catch (error) {
          console.log("Could not load participant session history:", error);
        }

        // Sort by timestamp (newest first) and ensure valid timestamps
        allActivities.sort((a, b) => {
          const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
          const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
          return timeB - timeA;
        });

        setActivities(allActivities);
      } catch (error) {
        console.error("Error loading activities:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAllActivities();
  }, [currentUser]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'spin':
        return 'play-circle'
      case 'wheel_created':
        return 'add-circle'
      case 'wheel_edited':
        return 'create'
      case 'participant_added':
        return 'person-add'
      case 'live_session_ended':
        return 'stop-circle'
      case 'participant_joined':
        return 'enter'
      case 'participant_session_ended':
        return 'exit'
      default:
        return 'time'
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'spin':
        return '#4CAF50'
      case 'wheel_created':
        return '#2196F3'
      case 'wheel_edited':
        return '#FF9800'
      case 'participant_added':
        return '#9C27B0'
      case 'live_session_ended':
        return '#F44336'
      case 'participant_joined':
        return '#FF5722'
      case 'participant_session_ended':
        return '#607D8B'
      default:
        return theme.textSecondary
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading activities...</Text>
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Activity History</Text>
      </View>

      {activities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No activities yet
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
            Start spinning wheels or join live sessions to see your activity history
          </Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.activityItem, { backgroundColor: theme.surface }]}
              onPress={() => {
                if (item.type === 'spin' || item.type === 'live_session_ended' || item.type === 'participant_session_ended') {
                  navigation.navigate('SpinDetails', {
                    activity: item,
                    wheelName: item.wheelName,
                    winners: item.winners,
                    timestamp: item.timestamp,
                    description: item.description,
                  })
                }
              }}
            >
              <View style={styles.activityIcon}>
                <Ionicons
                  name={getActivityIcon(item.type) as any}
                  size={24}
                  color={getActivityColor(item.type)}
                />
              </View>
              <View style={styles.activityContent}>
                <Text style={[styles.activityTitle, { color: theme.text }]}>
                  {item.title}
                </Text>
                <Text style={[styles.activityDescription, { color: theme.textSecondary }]}>
                  {item.description}
                </Text>
                <Text style={[styles.activityTimestamp, { color: theme.textSecondary }]}>
                  {item.timestamp.toLocaleString()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  activityItem: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    alignItems: 'center',
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  activityTimestamp: {
    fontSize: 12,
  },
  // Legacy styles for compatibility
  item: {
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
  },
  timestamp: {
    fontSize: 12,
  },
  winners: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HistoryScreen;
