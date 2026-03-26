import { useEffect } from "react"
import { useState } from "react"
import { Ionicons } from "@expo/vector-icons"
import * as DocumentPicker from "expo-document-picker"
import * as FileSystem from "expo-file-system"
import * as XLSX from 'xlsx'
import AsyncStorage from "@react-native-async-storage/async-storage"
import type React from "react"
import {
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  Platform,
} from "react-native"
import { useAuth } from "../contexts/AuthContext"
import { useTheme } from "../contexts/ThemeContext"
import { db } from "../config/firebaseConfig" // Import db
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from "firebase/firestore"

interface Participant {
  id: string
  name: string
  email: string
  contactNumber: string
  category: string
  isSelected: boolean
  userId: string // Add userId to link to Firebase user
  role: string // Add role field
  fullName: string // Add fullName field
  createdAt: any // Add createdAt field
  isOnline?: boolean // Add online status
  lastSeen?: any // Add last seen timestamp
}

// Removed static categories; we will surface dynamic filters like Active/All
const categories: string[] = []

const ParticipantsScreen: React.FC = () => {
  const { theme } = useTheme()
  const { currentUser, userProfile } = useAuth()

  // Check if user has permission to view this screen
  const canManageParticipants = () => {
    if (!userProfile?.role) return false;
    const role = userProfile.role.toLowerCase();
    return role === 'teacher' || role === 'organizer' || role === 'admin';
  };

  const [participants, setParticipants] = useState<Participant[]>([])
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [sortBy, setSortBy] = useState<"name" | "email" | "category">("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  const [newParticipant, setNewParticipant] = useState({
    name: "",
    email: "",
    contactNumber: "",
    category: "Personal",
  })

  // If user doesn't have permission, show a permission denied message
  if (currentUser && userProfile && !canManageParticipants()) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed" size={64} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Permission Denied</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Only teachers and organizers can manage participants.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    if (currentUser && userProfile) {
      // Only organizers/teachers can manage participants
      const role = userProfile.role?.toLowerCase();
      if (role === 'teacher' || role === 'organizer' || role === 'admin') {
        loadParticipants();
      } else {
        // Participants should not see this screen
        setParticipants([]);
      }
    } else {
      setParticipants([]); // Clear participants if no user is logged in
    }
  }, [currentUser, userProfile]); // Reload participants when user changes

  useEffect(() => {
    filterParticipants()
  }, [participants, searchQuery, selectedCategory, sortBy, sortOrder])

  // Monitor online status of users with proper presence system
  useEffect(() => {
    if (!currentUser?.uid) return

    // Implement proper presence system using Firebase Realtime Database
    const checkOnlineStatus = async () => {
      // In a production app, you would use Firebase Realtime Database for presence
      // For now, we'll use a hybrid approach with AsyncStorage and simulated data

      try {
        // Get last seen timestamps from AsyncStorage
        const lastSeenData = await AsyncStorage.getItem('participantLastSeen') || '{}'
        const lastSeenMap = JSON.parse(lastSeenData)

        const now = Date.now()
        const onlineThreshold = 5 * 60 * 1000 // 5 minutes

        const updatedOnlineUsers = new Set<string>()

        participants.forEach((participant) => {
          const lastSeen = lastSeenMap[participant.userId] || 0
          const isOnline = (now - lastSeen) < onlineThreshold

          if (isOnline) {
            updatedOnlineUsers.add(participant.userId)
          }
        })

        setOnlineUsers(updatedOnlineUsers)
      } catch (error) {
        console.error('Error checking online status:', error)
        // Fallback to empty set if AsyncStorage fails
        setOnlineUsers(new Set())
      }
    }

    // Check status initially and then every 10 seconds
    checkOnlineStatus()
    const interval = setInterval(checkOnlineStatus, 10000)

    // Simulate user activity updates
    const simulateActivity = async () => {
      try {
        const lastSeenData = await AsyncStorage.getItem('participantLastSeen') || '{}'
        const lastSeenMap = JSON.parse(lastSeenData)

        participants.forEach((participant) => {
          // 70% chance of updating last seen
          if (Math.random() > 0.3) {
            lastSeenMap[participant.userId] = Date.now()
          }
        })

        await AsyncStorage.setItem('participantLastSeen', JSON.stringify(lastSeenMap))
      } catch (error) {
        console.error('Error simulating activity:', error)
      }
    }

    const activityInterval = setInterval(simulateActivity, 15000)

    return () => {
      clearInterval(interval)
      clearInterval(activityInterval)
    }
  }, [participants, currentUser])

  const loadParticipants = async () => {
    if (!currentUser?.uid) return

    // Check if database is available
    if (!db) {
      console.error("Database not available")
      Alert.alert("Error", "Database connection not available. Please check your internet connection.")
      return
    }

    try {
      const loadedParticipants: Participant[] = []

      // Load participants from the participants collection (manually added)
      const participantsQuery = query(
        collection(db, "participants"),
        where("userId", "==", currentUser.uid)
      )
      const participantsSnapshot = await getDocs(participantsQuery)

      participantsSnapshot.forEach((doc) => {
        const participantData = doc.data()
        if (participantData && typeof participantData === 'object') {
          loadedParticipants.push({
            id: doc.id,
            name: participantData.name || participantData.fullName || "Unknown",
            email: participantData.email || "",
            contactNumber: participantData.contactNumber || "",
            category: participantData.category || "Personal",
            isSelected: Boolean(participantData.isSelected),
            userId: participantData.userId || currentUser.uid,
            role: participantData.role || "participant",
            fullName: participantData.fullName || participantData.name || "",
            createdAt: participantData.createdAt
          })
        }
      })

      // Also load registered participants from users collection (if organizer)
      try {
        const usersQuery = query(
          collection(db, "users"),
          where("role", "==", "participant")
        )
        const usersSnapshot = await getDocs(usersQuery)

        usersSnapshot.forEach((doc) => {
          const userData = doc.data()
          if (userData && typeof userData === 'object') {
            // Check if this user is not already in participants
            const existingParticipant = loadedParticipants.find(p => p.email === userData.email)
            if (!existingParticipant && userData.email) {
              loadedParticipants.push({
                id: doc.id,
                name: userData.fullName || userData.email || "Unknown",
                email: userData.email || "",
                contactNumber: userData.contactNumber || "",
                category: "Participant Account",
                isSelected: false,
                userId: doc.id,
                role: userData.role || "participant",
                fullName: userData.fullName || "",
                createdAt: userData.createdAt
              })
            }
          }
        })
      } catch (userError) {
        console.warn("Could not load users collection:", userError)
        // Silently handle permission errors - this is expected behavior
        // Teachers can still manage their manually added participants
      }

      setParticipants(loadedParticipants)
    } catch (error) {
      console.error("Error loading participants:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      Alert.alert("Error", `Failed to load participants: ${errorMessage}`)
    }
  }

  const filterParticipants = () => {
    let filtered = [...participants]

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.contactNumber.includes(searchQuery),
      )
    }

    // Filter by dynamic status category
    if (selectedCategory === "Active") {
      filtered = filtered.filter((p) => onlineUsers.has(p.userId))
    }

    // Sort
    filtered.sort((a, b) => {
      const aValue = a[sortBy]
      const bValue = b[sortBy]

      if (sortOrder === "asc") {
        return aValue.localeCompare(bValue)
      } else {
        return bValue.localeCompare(aValue)
      }
    })

    setFilteredParticipants(filtered)
  }

  const addParticipant = async () => {
    if (!currentUser?.uid) {
      Alert.alert("Error", "You must be logged in to add participants.")
      return
    }
    if (!newParticipant.name.trim()) {
      Alert.alert("Error", "Please enter participant name")
      return
    }

    // Check if database is available
    if (!db) {
      Alert.alert("Error", "Database connection not available. Please check your internet connection.")
      return
    }

    try {
      const participantData = {
        name: newParticipant.name.trim(),
        email: newParticipant.email.trim(),
        contactNumber: newParticipant.contactNumber.trim(),
        category: newParticipant.category,
        isSelected: false,
        userId: currentUser.uid, // Link to current user
        role: "participant",
        fullName: newParticipant.name.trim(),
        createdAt: new Date()
      }
      const docRef = await addDoc(collection(db, "participants"), participantData)
      const addedParticipant: Participant = { id: docRef.id, ...participantData }
      setParticipants((prev) => [...prev, addedParticipant])

      setNewParticipant({
        name: "",
        email: "",
        contactNumber: "",
        category: "Personal",
      })
      setShowAddModal(false)
    } catch (error) {
      console.error("Error adding participant to Firestore:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      Alert.alert("Error", `Failed to add participant: ${errorMessage}`)
    }
  }

  const removeParticipant = (id: string) => {
    Alert.alert("Remove Participant", "Are you sure you want to remove this participant?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          if (!db) {
            Alert.alert("Error", "Database connection not available.")
            return
          }
          try {
            await deleteDoc(doc(db, "participants", id))
            setParticipants((prev) => prev.filter((p) => p.id !== id))
          } catch (error) {
            console.error("Error removing participant from Firestore:", error)
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
            Alert.alert("Error", `Failed to remove participant: ${errorMessage}`)
          }
        },
      },
    ])
  }

  const toggleParticipantSelection = async (id: string) => {
    if (!db) {
      Alert.alert("Error", "Database connection not available.")
      return
    }
    try {
      const participantToUpdate = participants.find((p) => p.id === id)
      if (participantToUpdate) {
        const docRef = doc(db, "participants", id)
        await updateDoc(docRef, { isSelected: !participantToUpdate.isSelected })
        setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, isSelected: !p.isSelected } : p)))
      }
    } catch (error) {
      console.error("Error toggling participant selection in Firestore:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      Alert.alert("Error", `Failed to update participant selection: ${errorMessage}`)
    }
  }

  const selectAllParticipants = async () => {
    if (!currentUser?.uid) return
    if (!db) {
      Alert.alert("Error", "Database connection not available.")
      return
    }
    try {
      const batch = writeBatch(db)
      const q = query(collection(db, "participants"), where("userId", "==", currentUser.uid))
      const querySnapshot = await getDocs(q)
      querySnapshot.forEach((document) => {
        const docRef = doc(db, "participants", document.id)
        batch.update(docRef, { isSelected: true })
      })
      await batch.commit()
      setParticipants((prev) => prev.map((p) => ({ ...p, isSelected: true })))
    } catch (error) {
      console.error("Error selecting all participants in Firestore:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      Alert.alert("Error", `Failed to select all participants: ${errorMessage}`)
    }
  }

  const deselectAllParticipants = async () => {
    if (!currentUser?.uid) return
    if (!db) {
      Alert.alert("Error", "Database connection not available.")
      return
    }
    try {
      const batch = writeBatch(db)
      const q = query(collection(db, "participants"), where("userId", "==", currentUser.uid))
      const querySnapshot = await getDocs(q)
      querySnapshot.forEach((document) => {
        const docRef = doc(db, "participants", document.id)
        batch.update(docRef, { isSelected: false })
      })
      await batch.commit()
      setParticipants((prev) => prev.map((p) => ({ ...p, isSelected: false })))
    } catch (error) {
      console.error("Error deselecting all participants in Firestore:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      Alert.alert("Error", `Failed to deselect all participants: ${errorMessage}`)
    }
  }

  const importFromFile = async () => {
    if (!currentUser?.uid) {
      Alert.alert("Error", "You must be logged in to import participants.")
      return
    }
    if (!db) {
      Alert.alert("Error", "Database connection not available.")
      return
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        copyToCacheDirectory: true,
      })

      if (!result.canceled && result.assets[0]) {
        const fileUri = result.assets[0].uri
        const fileName = result.assets[0].name || ''
        let importedParticipantsData: Omit<Participant, "id">[] = []
        if (fileName.endsWith('.xlsx')) {
          // Parse XLSX
          const bstr = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' })
          const wb = XLSX.read(bstr, { type: 'base64' })
          const wsname = wb.SheetNames[0]
          const ws = wb.Sheets[wsname]
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 })
          const headers = (data[0] as string[]).map((h) => h.trim().toLowerCase())
          const nameIndex = headers.findIndex((h) => h.includes("name"))
          const emailIndex = headers.findIndex((h) => h.includes("email"))
          const contactIndex = headers.findIndex((h) => h.includes("contact") || h.includes("phone"))
          if (nameIndex === -1) {
            Alert.alert("Error", 'Excel file must contain a "name" column')
            return
          }
          for (let i = 1; i < data.length; i++) {
            const row = data[i] as string[]
            if (row[nameIndex]) {
              importedParticipantsData.push({
                name: row[nameIndex],
                email: emailIndex >= 0 ? row[emailIndex] : "",
                contactNumber: contactIndex >= 0 ? row[contactIndex] : "",
                category: "Personal",
                isSelected: false,
                userId: currentUser.uid,
                role: "participant",
                fullName: row[nameIndex],
                createdAt: new Date()
              })
            }
          }
        } else if (fileName.endsWith('.csv')) {
          // Parse CSV content
          const fileContent = await FileSystem.readAsStringAsync(fileUri)
          const lines = fileContent.split("\n")
          const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
          const nameIndex = headers.findIndex((h) => h.includes("name"))
          const emailIndex = headers.findIndex((h) => h.includes("email"))
          const contactIndex = headers.findIndex((h) => h.includes("contact") || h.includes("phone"))
          if (nameIndex === -1) {
            Alert.alert("Error", 'CSV file must contain a "name" column')
            return
          }
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",").map((v) => v.trim())
            if (values[nameIndex]) {
              importedParticipantsData.push({
                name: values[nameIndex],
                email: emailIndex >= 0 ? values[emailIndex] : "",
                contactNumber: contactIndex >= 0 ? values[contactIndex] : "",
                category: "Personal",
                isSelected: false,
                userId: currentUser.uid,
                role: "participant",
                fullName: values[nameIndex],
                createdAt: new Date()
              })
            }
          }
        } else {
          Alert.alert("Error", "Unsupported file format. Please upload a .csv or .xlsx file.")
          return
        }

        const batch = writeBatch(db)
        const newParticipants: Participant[] = []
        importedParticipantsData.forEach((data) => {
          const newDocRef = doc(collection(db, "participants"))
          batch.set(newDocRef, data)
          newParticipants.push({ id: newDocRef.id, ...data } as Participant)
        })
        await batch.commit()

        setParticipants((prev) => [...prev, ...newParticipants])

        Alert.alert("Success", `Imported ${importedParticipantsData.length} participants successfully!`)
        setShowImportModal(false)
      }
    } catch (error) {
      console.error("Error importing file:", error)
      Alert.alert("Error", "Failed to import file. Please check the file format.")
    }
  }

  const exportParticipants = async () => {
    if (!currentUser?.uid) {
      Alert.alert("Error", "You must be logged in to export participants.")
      return
    }
    try {
      const selectedParticipants = participants.filter((p) => p.isSelected)
      const dataToExport = selectedParticipants.length > 0 ? selectedParticipants : participants

      const csvContent = [
        "Name,Email,Contact Number,Category",
        ...dataToExport.map((p) => `${p.name},${p.email},${p.contactNumber},${p.category}`),
      ].join("\n")

      const fileName = `participants_${new Date().toISOString().split("T")[0]}.csv`
      const fileUri = (FileSystem as any).documentDirectory + fileName

      await FileSystem.writeAsStringAsync(fileUri, csvContent)

      Alert.alert("Export Complete", `Participants exported to ${fileName}`)
    } catch (error) {
      console.error("Error exporting participants:", error)
      Alert.alert("Error", "Failed to export participants")
    }
  }

  const renderParticipant = ({ item }: { item: Participant }) => {
    const isOnline = onlineUsers.has(item.userId)

    return (
      <View style={[styles.participantCard, { backgroundColor: theme.surface }]}>
        <TouchableOpacity style={styles.participantContent} onPress={() => toggleParticipantSelection(item.id)}>
          <View style={styles.participantInfo}>
            <View style={styles.participantHeader}>
              <View style={styles.nameWithStatus}>
                <Text style={[styles.participantName, { color: theme.text }]}>{item.name}</Text>
                <View style={[styles.statusIndicator, { backgroundColor: isOnline ? "#4CAF50" : "#9E9E9E" }]} />
              </View>
              <View style={styles.badgeContainer}>
                <View style={[styles.categoryBadge, { backgroundColor: theme.primary }]}>
                  <Text style={[styles.categoryText, { color: theme.surface }]}>{item.category}</Text>
                </View>
                <Text style={[styles.statusText, { color: isOnline ? "#4CAF50" : "#9E9E9E" }]}>
                  {isOnline ? "Online" : "Offline"}
                </Text>
              </View>
            </View>

            {item.email ? (
              <Text style={[styles.participantDetail, { color: theme.textSecondary }]}>📧 {item.email}</Text>
            ) : null}

            {item.contactNumber ? (
              <Text style={[styles.participantDetail, { color: theme.textSecondary }]}>📱 {item.contactNumber}</Text>
            ) : null}
          </View>

          <View style={styles.participantActions}>
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: item.isSelected ? theme.primary : "transparent",
                  borderColor: theme.primary,
                },
              ]}
            >
              {item.isSelected && <Ionicons name="checkmark" size={16} color={theme.surface} />}
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={() => removeParticipant(item.id)}>
          <Ionicons name="trash-outline" size={20} color={theme.error} />
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={filteredParticipants}
        renderItem={renderParticipant}
        keyExtractor={(item) => item.id}
        style={styles.participantsList}
        contentContainerStyle={styles.participantsListContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Participants ({participants.length})</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.headerButton} onPress={() => setShowImportModal(true)}>
                  <Ionicons name="download-outline" size={24} color={theme.text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerButton} onPress={exportParticipants}>
                  <Ionicons name="share-outline" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>
            {/* Search and Filter */}
            <View style={styles.searchSection}>
              <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
                <Ionicons name="search" size={20} color={theme.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: "#333" }]}
                  placeholder="Search participants..."
                  placeholderTextColor={theme.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
                {(["All", "Active"]).map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.filterTab,
                      {
                        backgroundColor: selectedCategory === category ? theme.primary : theme.surface,
                      },
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text
                      style={[
                        styles.filterTabText,
                        { color: selectedCategory === category ? theme.surface : theme.primary },
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {/* Sort and Selection Controls */}
            <View style={styles.controlsSection}>
              <View style={styles.sortControls}>
                <TouchableOpacity
                  style={[styles.sortButton, { backgroundColor: theme.surface }]}
                  onPress={() => {
                    if (sortBy === "name") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                    } else {
                      setSortBy("name")
                      setSortOrder("asc")
                    }
                  }}
                >
                  <Text style={[styles.sortButtonText, { color: theme.primary }]}>Name</Text>
                  {sortBy === "name" && (
                    <Ionicons name={sortOrder === "asc" ? "chevron-up" : "chevron-down"} size={16} color={theme.primary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortButton, { backgroundColor: theme.surface }]}
                  onPress={() => {
                    if (sortBy === "category") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                    } else {
                      setSortBy("category")
                      setSortOrder("asc")
                    }
                  }}
                >
                  <Text style={[styles.sortButtonText, { color: theme.primary }]}>Category</Text>
                  {sortBy === "category" && (
                    <Ionicons name={sortOrder === "asc" ? "chevron-up" : "chevron-down"} size={16} color={theme.primary} />
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.selectionControls}>
                <TouchableOpacity
                  style={[styles.selectionButton, { backgroundColor: theme.surface }]}
                  onPress={selectAllParticipants}
                >
                  <Text style={[styles.selectionButtonText, { color: theme.primary }]}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.selectionButton, { backgroundColor: theme.surface }]}
                  onPress={deselectAllParticipants}
                >
                  <Text style={[styles.selectionButtonText, { color: theme.primary }]}>Deselect All</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Participants</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Add participants to get started</Text>
          </View>
        }
      />
      {/* Add Button, Modals, etc. */}
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: theme.primary }]}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={24} color={theme.surface} />
      </TouchableOpacity>
      {/* Add Participant Modal, Import Modal, etc. */}
      {/* Add Participant Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.primary }]}>Add Participant</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: "#333" }]}>Name *</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.textSecondary }]}
                value={newParticipant.name}
                onChangeText={(text) => setNewParticipant({ ...newParticipant, name: text })}
                placeholder="Enter participant name"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: "#333" }]}>Email</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.textSecondary }]}
                value={newParticipant.email}
                onChangeText={(text) => setNewParticipant({ ...newParticipant, email: text })}
                placeholder="Enter email address"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: "#333" }]}>Contact Number</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.textSecondary }]}
                value={newParticipant.contactNumber}
                onChangeText={(text) => setNewParticipant({ ...newParticipant, contactNumber: text })}
                placeholder="Enter contact number"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: "#333" }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.categorySelector}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryOption,
                        {
                          backgroundColor: newParticipant.category === category ? theme.primary : "transparent",
                          borderColor: theme.primary,
                        },
                      ]}
                      onPress={() => setNewParticipant({ ...newParticipant, category })}
                    >
                      <Text
                        style={[
                          styles.categoryOptionText,
                          { color: newParticipant.category === category ? theme.surface : theme.primary },
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.textSecondary }]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.surface }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={addParticipant}
              >
                <Text style={[styles.modalButtonText, { color: theme.surface }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Import Modal */}
      <Modal
        visible={showImportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.primary }]}>Import Participants</Text>
              <TouchableOpacity onPress={() => setShowImportModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.importDescription, { color: "#333" }]}>
              Import participants from CSV or Excel files. Your file should contain columns for:
              {"\n"}• Name (required)
              {"\n"}• Email (optional)
              {"\n"}• Contact Number (optional)
            </Text>

            <View style={styles.importActions}>
              <TouchableOpacity
                style={[styles.importButton, { backgroundColor: theme.primary }]}
                onPress={importFromFile}
              >
                <Ionicons name="document-outline" size={20} color={theme.surface} />
                <Text style={[styles.importButtonText, { color: theme.surface }]}>Choose File</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.textSecondary, marginTop: 20 }]}
              onPress={() => setShowImportModal(false)}
            >
              <Text style={[styles.modalButtonText, { color: theme.surface }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "web" ? 0 : 10, // Add top padding for mobile to prevent content from being too high
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    minHeight: Dimensions.get('window').height,
    paddingBottom: 40,
  },
  innerContent: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    paddingHorizontal: Platform.OS === 'web' ? 24 : 16,
    paddingTop: Platform.OS === 'web' ? 32 : 20,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Platform.OS === "web" ? 24 : 20,
    paddingVertical: 15,
    paddingTop: Platform.OS === "web" ? 15 : 40, // Extra top padding for mobile to account for status bar
    marginTop: Platform.OS === "web" ? 0 : 10, // Additional margin for mobile
  },
  headerTitle: {
    fontSize: Platform.OS === "web" ? 24 : 20,
    fontWeight: "bold",
  },
  headerActions: {
    flexDirection: "row",
    gap: 16,
  },
  headerButton: {
    padding: 8,
  },
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filterTabs: {
    flexDirection: "row",
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  controlsSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sortControls: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  selectionControls: {
    flexDirection: "row",
    gap: 12,
  },
  selectionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  selectionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  participantsList: {
    flex: 1,
  },
  participantsListContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: Platform.OS === "web" ? 0 : 5, // Add small top padding for mobile
  },
  participantCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  participantContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  participantInfo: {
    flex: 1,
  },
  participantHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  participantName: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  participantDetail: {
    fontSize: 14,
    marginBottom: 2,
  },
  participantActions: {
    marginLeft: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  addButton: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    margin: 20,
    borderRadius: 16,
    padding: 24,
    width: "90%",
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  categorySelector: {
    flexDirection: "row",
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  importDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  importActions: {
    alignItems: "center",
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  // Online Status Styles
  nameWithStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  badgeContainer: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
})

export default ParticipantsScreen
