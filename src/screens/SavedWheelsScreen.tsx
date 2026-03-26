import React, { useState } from "react"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { useTheme } from "../contexts/ThemeContext"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../config/firebaseConfig"
import { doc, setDoc, collection, query, getDocs } from "firebase/firestore"

const SavedWheelsScreen: React.FC = () => {
  const navigation = useNavigation<any>()
  const { theme } = useTheme()
  const { currentUser } = useAuth()

  const [wheelTitle, setWheelTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("📚 Academic")
  const [itemsText, setItemsText] = useState("")
  const [numberOfWinners, setNumberOfWinners] = useState("1 Winner")
  const [confettiAnimation, setConfettiAnimation] = useState(true)
  const [soundEffects, setSoundEffects] = useState(true)
  const [endingMessage, setEndingMessage] = useState("Congratulations, {winner}!")
  const [isSaving, setIsSaving] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState("")

  const categories = [
    "📚 Academic",
    "🎯 General",
    "🎲 Games",
    "🏆 Awards",
    "👥 Social",
    "💼 Business",
    "🎨 Creative",
    "🏃 Sports",
  ]

  const createWheel = async () => {
    if (!db) {
      Alert.alert("Error", "Firebase is not properly initialized.")
      return
    }
    if (!currentUser?.uid) {
      Alert.alert("Error", "You must be logged in to create wheels.")
      return
    }
    if (!wheelTitle.trim()) {
      Alert.alert("Error", "Wheel title is required.")
      return
    }

    // Parse items from textarea
    const items = itemsText.split('\n').map(item => item.trim()).filter(item => item.length > 0)
    if (items.length < 2) {
      Alert.alert("Error", "At least 2 items are required.")
      return
    }

    setIsSaving(true)
    try {
      // Create slices from items
      const slices = items.map((item, index) => ({
        id: (index + 1).toString(),
        text: item,
        color: getColorForIndex(index),
      }))

      const wheelData = {
        name: wheelTitle.trim(),
        description: description.trim(),
        category,
        slices,
        settings: {
          spinTime: 3,
          textSize: 14,
          sliceLayers: 1,
          unsaveMode: false,
          autoHide: false,
          numberOfWinners: parseInt(numberOfWinners.split(' ')[0]),
          confettiAnimation,
          soundEffects,
          endingMessage,
        },
        userId: currentUser.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "custom",
      }

      const newWheelDocRef = doc(collection(db, "wheels"))
      await setDoc(newWheelDocRef, wheelData)

      Alert.alert("Success", "Your custom wheel has been created!", [
        {
          text: "OK",
          onPress: () => navigation.navigate("Wheel", { wheelId: newWheelDocRef.id })
        }
      ])
    } catch (error) {
      console.error("Error saving wheel:", error)
      Alert.alert("Error", "Failed to create wheel. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const getColorForIndex = (index: number) => {
    const colors = [
      "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
      "#DDA0DD", "#FFB6C1", "#98D8C8", "#F7DC6F", "#BB8FCE",
      "#85C1E9", "#82E0AA"
    ]
    return colors[index % colors.length]
  }

  const handleImportParticipants = () => {
    if (!importText.trim()) {
      Alert.alert("Error", "Please enter participant names to import.")
      return
    }

    // Parse the imported text - split by newlines, commas, or semicolons
    const importedItems = importText
      .split(/[\n,;]/)
      .map(item => item.trim())
      .filter(item => item.length > 0)

    if (importedItems.length === 0) {
      Alert.alert("Error", "No valid participant names found.")
      return
    }

    // Add to existing items, avoiding duplicates
    const existingItems = itemsText.split('\n').map(item => item.trim()).filter(item => item.length > 0)
    const newItems = [...existingItems]

    importedItems.forEach(name => {
      if (!newItems.includes(name)) {
        newItems.push(name)
      }
    })

    setItemsText(newItems.join('\n'))
    setImportText("")
    setShowImportModal(false)

    Alert.alert("Success", `Imported ${importedItems.length} participant names.`)
  }

  const renderCategoryModal = () => (
    <Modal visible={showCategoryModal} transparent animationType="slide" onRequestClose={() => setShowCategoryModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.primary }]}>Select Category</Text>
            <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.categoryList}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryItem, category === cat && styles.selectedCategory]}
                onPress={() => {
                  setCategory(cat)
                  setShowCategoryModal(false)
                }}
              >
                <Text style={[styles.categoryText, { color: theme.text }]}>{cat}</Text>
                {category === cat && (
                  <Ionicons name="checkmark" size={20} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )

  const renderImportModal = () => (
    <Modal visible={showImportModal} transparent animationType="slide" onRequestClose={() => setShowImportModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.primary }]}>Import Participants</Text>
            <TouchableOpacity onPress={() => setShowImportModal(false)}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
            Paste participant names below. Separate names with new lines, commas, or semicolons.
          </Text>

          <TextInput
            style={[styles.importTextInput, { borderColor: theme.textSecondary, color: theme.text }]}
            value={importText}
            onChangeText={setImportText}
            placeholder="Alice Johnson&#10;Bob Smith&#10;Charlie Brown&#10;Diana Prince"
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalCancelButton, { borderColor: theme.textSecondary }]}
              onPress={() => setShowImportModal(false)}
            >
              <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalImportButton, { backgroundColor: theme.primary }]}
              onPress={handleImportParticipants}
            >
              <Text style={[styles.modalImportText, { color: theme.surface }]}>Import</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={createWheel} style={styles.createButton} disabled={isSaving}>
          <Text style={[styles.createButtonText, { color: isSaving ? theme.textSecondary : theme.primary }]}>
            {isSaving ? "Creating..." : "Create Wheel"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={[styles.mainTitle, { color: theme.text }]}>Create New Custom Wheel</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Design your own wheel with custom participants. This wheel can be used for both live draws and solo play.
          </Text>
        </View>

        {/* Wheel Title */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Wheel Title *</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.textSecondary, color: theme.text }]}
            value={wheelTitle}
            onChangeText={setWheelTitle}
            placeholder="e.g., Class Presentation Order, Team Assignments"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* Description */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.textSecondary, color: theme.text }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Brief description of this wheel's purpose"
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Category */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Category</Text>
          <TouchableOpacity
            style={[styles.categorySelector, { borderColor: theme.textSecondary }]}
            onPress={() => setShowCategoryModal(true)}
          >
            <Text style={[styles.categorySelectorText, { color: theme.text }]}>{category}</Text>
            <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Items */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Items *</Text>
          <Text style={[styles.itemsHint, { color: theme.textSecondary }]}>
            Enter items (one per line):
          </Text>
          <TextInput
            style={[styles.itemsInput, { borderColor: theme.textSecondary, color: theme.text }]}
            value={itemsText}
            onChangeText={setItemsText}
            placeholder="Alice Johnson&#10;Bob Smith&#10;Charlie Brown&#10;Diana Prince"
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <Text style={[styles.itemsSubtext, { color: theme.textSecondary }]}>
            Enter each item name on a separate line. Minimum 2 items required.
          </Text>
        </View>

        {/* Import Section */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <View style={styles.importButtonsContainer}>
            <TouchableOpacity
              style={[styles.importButton, { borderColor: theme.primary }]}
              onPress={async () => {
                try {
                  // Fetch users from Firebase
                  const usersQuery = query(collection(db, "users"))
                  const usersSnapshot = await getDocs(usersQuery)

                  const userNames: string[] = []
                  usersSnapshot.forEach((doc) => {
                    const userData = doc.data()
                    // Skip system administrator accounts
                    if (userData.role === 'admin' || userData.role === 'system') {
                      return
                    }

                    if (userData.displayName || userData.name || userData.fullName) {
                      const name = userData.displayName || userData.name || userData.fullName
                      // Also skip if the name contains "System Administrator"
                      if (!name.toLowerCase().includes('system administrator')) {
                        userNames.push(name)
                      }
                    }
                  })

                  if (userNames.length > 0) {
                    // Add user names to the items, avoiding duplicates
                    const existingItems = itemsText.split('\n').map(item => item.trim()).filter(item => item.length > 0)
                    const newItems = [...existingItems]

                    userNames.forEach(name => {
                      if (!newItems.includes(name)) {
                        newItems.push(name)
                      }
                    })

                    setItemsText(newItems.join('\n'))
                    Alert.alert("Success", `Auto-filled ${userNames.length} participant names from accounts.`)
                  } else {
                    Alert.alert("No Accounts Found", "No user accounts with names were found to auto-fill.")
                  }
                } catch (error) {
                  console.error("Error auto-filling participant names:", error)
                  Alert.alert("Error", "Failed to auto-fill participant names. Please try again.")
                }
              }}
            >
              <Ionicons name="person-add" size={20} color={theme.primary} />
              <Text style={[styles.importButtonText, { color: theme.primary }]}>Auto-fill for people with accounts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.importButton, { borderColor: theme.secondary || '#666' }]}
              onPress={() => {
                Alert.alert(
                  "Import Participants",
                  "Choose how to import participant names:",
                  [
                    {
                      text: "Paste from Clipboard",
                      onPress: () => {
                        setShowImportModal(true)
                      }
                    },
                    {
                      text: "Upload File",
                      onPress: () => {
                        Alert.alert("File Upload", "File upload functionality would be implemented here. For now, you can paste participant names directly into the items field above.")
                      }
                    },
                    { text: "Cancel", style: "cancel" }
                  ]
                )
              }}
            >
              <Ionicons name="cloud-upload" size={20} color={theme.secondary || '#666'} />
              <Text style={[styles.importButtonText, { color: theme.secondary || '#666' }]}>Import participants</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Wheel Settings */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Wheel Settings</Text>

          {/* Number of Winners */}
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>Number of Winners</Text>
            <TouchableOpacity style={[styles.winnerSelector, { borderColor: theme.textSecondary }]}>
              <Text style={[styles.winnerSelectorText, { color: theme.text }]}>{numberOfWinners}</Text>
              <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Confetti Animation */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={[styles.settingEmoji, { color: theme.text }]}>🎊</Text>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Confetti Animation</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, { backgroundColor: confettiAnimation ? theme.primary : theme.textSecondary }]}
              onPress={() => setConfettiAnimation(!confettiAnimation)}
            >
              <Text style={[styles.toggleText, { color: theme.surface }]}>{confettiAnimation ? "On" : "Off"}</Text>
            </TouchableOpacity>
          </View>

          {/* Sound Effects */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={[styles.settingEmoji, { color: theme.text }]}>🔊</Text>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Sound Effects</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, { backgroundColor: soundEffects ? theme.primary : theme.textSecondary }]}
              onPress={() => setSoundEffects(!soundEffects)}
            >
              <Text style={[styles.toggleText, { color: theme.surface }]}>{soundEffects ? "On" : "Off"}</Text>
            </TouchableOpacity>
          </View>

          {/* Ending Message */}
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>Ending Message</Text>
          </View>
          <TextInput
            style={[styles.messageInput, { borderColor: theme.textSecondary, color: theme.text }]}
            value={endingMessage}
            onChangeText={setEndingMessage}
            placeholder="Congratulations, {winner}!"
            placeholderTextColor={theme.textSecondary}
          />
          <Text style={[styles.messageHint, { color: theme.textSecondary }]}>
            Use {"{winner}"} as placeholder for the selected item's name
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: theme.textSecondary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.createWheelButton, { backgroundColor: theme.primary }]}
            onPress={createWheel}
            disabled={isSaving}
          >
            <Text style={[styles.createWheelButtonText, { color: theme.surface }]}>
              {isSaving ? "Creating..." : "Create Wheel"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {renderCategoryModal()}
      {renderImportModal()}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  titleSection: {
    paddingVertical: 20,
    alignItems: "center",
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  section: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
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
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categorySelectorText: {
    fontSize: 16,
  },
  itemsHint: {
    fontSize: 14,
    marginBottom: 8,
  },
  itemsInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
  },
  itemsSubtext: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  importButtonsContainer: {
    gap: 12,
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  importButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  settingEmoji: {
    fontSize: 16,
  },
  settingLabel: {
    fontSize: 16,
  },
  winnerSelector: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  winnerSelectorText: {
    fontSize: 14,
  },
  toggle: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 50,
    alignItems: "center",
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 8,
  },
  messageHint: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 20,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  createWheelButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  createWheelButtonText: {
    fontSize: 16,
    fontWeight: "bold",
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
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  modalSubtitle: {
    fontSize: 16,
    color: "gray",
    textAlign: "center",
    marginBottom: 20,
  },
  importTextInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalImportButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  modalImportText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
  categoryList: {
    maxHeight: 300,
  },
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  selectedCategory: {
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  categoryText: {
    fontSize: 16,
  },
})

export default SavedWheelsScreen
