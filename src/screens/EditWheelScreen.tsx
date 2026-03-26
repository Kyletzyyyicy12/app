import { useEffect } from "react"
import { useState } from "react"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation, useRoute } from "@react-navigation/native"
import type React from "react"
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
import { doc, getDoc, setDoc, updateDoc, collection } from "firebase/firestore"

interface WheelSlice {
  id: string
  text: string
  color: string
  emoji?: string
}

interface WheelConfig {
  id: string
  name: string
  slices: WheelSlice[]
  settings: {
    spinTime: number
    textSize: number
    sliceLayers: number
    unsaveMode: boolean
    autoHide: boolean
  }
  userId: string
  type?: string
}

const predefinedColors = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#FFB6C1",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
  "#82E0AA",
]

const getAutoNameByType = (wheelType: string): string => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  switch (wheelType) {
    case "picker": return `General Picker - ${dateStr}`;
    case "team": return `Team Picker - ${dateStr}`;
    case "yesno": return `Yes/No Picker - ${dateStr}`;
    case "number": return `Number Picker - ${dateStr}`;
    case "letter": return `Letter Picker - ${dateStr}`;
    case "country": return `Country Picker - ${dateStr}`;
    case "color": return `Color Picker - ${dateStr}`;
    case "date": return `Date Picker - ${dateStr}`;
    case "image": return `Image Picker - ${dateStr}`;
    case "instagram": return `Instagram Comment Picker - ${dateStr}`;
    case "mlb": return `MLB Picker - ${dateStr}`;
    case "nba": return `NBA Picker - ${dateStr}`;
    case "nfl": return `NFL Picker - ${dateStr}`;
    default: return `My Wheel - ${dateStr}`;
  }
};

const EditWheelScreen: React.FC = () => {
  const navigation = useNavigation<any>()
  const route = useRoute()
  const { theme } = useTheme()
  const { currentUser, authLoading } = useAuth()

  const [wheelId, setWheelId] = useState<string | null>(null)
  const [wheelName, setWheelName] = useState("My Wheel")
  const [slices, setSlices] = useState<WheelSlice[]>([
    { id: "1", text: "YES", color: "#4ECDC4" },
    { id: "2", text: "NO", color: "#FF6B6B" },
  ])
  const [settings, setSettings] = useState({
    spinTime: 3,
    textSize: 14,
    sliceLayers: 1,
    unsaveMode: false,
    autoHide: false,
  })
  const [wheelTypeState, setWheelTypeState] = useState<string | undefined>(undefined)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newSliceText, setNewSliceText] = useState("")
  const [newSliceEmoji, setNewSliceEmoji] = useState("")
  const [selectedColor, setSelectedColor] = useState(predefinedColors[0])
  const [editingSlice, setEditingSlice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (currentUser && !authLoading) {
      try {
        const params = route.params as any
        const routeWheelId = params?.wheelId || null
        const wheelType = params?.wheelType || null
        const categoryTitle = params?.categoryTitle || null

        setWheelId(routeWheelId)

        if (wheelType && !routeWheelId) {
          // New wheel with specific type
          initializeWheelByType(wheelType, categoryTitle)
          setWheelTypeState(wheelType)
        } else {
          // Existing wheel or default new wheel
          loadWheelData(routeWheelId)
        }
      } catch (error) {
        console.error("Error processing route params:", error)
        // Initialize with default values if there's an error
        setWheelName("New Wheel")
        setSlices([
          { id: "1", text: "YES", color: "#4ECDC4" },
          { id: "2", text: "NO", color: "#FF6B6B" },
        ])
        setSettings({ spinTime: 3, textSize: 14, sliceLayers: 1, unsaveMode: false, autoHide: false })
      }
    } else if (!currentUser && !authLoading) {
      Alert.alert("Authentication Required", "Please log in to edit wheels.")
      navigation.goBack()
    }
  }, [currentUser, authLoading, route.params])

  const initializeWheelByType = (wheelType: string, categoryTitle?: string) => {
    // Auto-name the wheel based on the wheel type for participants
    const autoName = categoryTitle || getAutoNameByType(wheelType);
    setWheelName(autoName);
    setWheelTypeState(wheelType);

    switch (wheelType) {
      case "picker":
        setSlices([
          { id: "1", text: "Option 1", color: "#FF6B6B" },
          { id: "2", text: "Option 2", color: "#4ECDC4" },
          { id: "3", text: "Option 3", color: "#45B7D1" },
          { id: "4", text: "Option 4", color: "#96CEB4" },
        ])
        break
      case "team":
        setSlices([
          { id: "1", text: "Team A", color: "#FF6B6B" },
          { id: "2", text: "Team B", color: "#4ECDC4" },
          { id: "3", text: "Team C", color: "#45B7D1" },
          { id: "4", text: "Team D", color: "#96CEB4" },
        ])
        break
      case "yesno":
        setSlices([
          { id: "1", text: "YES", color: "#4ECDC4", emoji: "✅" },
          { id: "2", text: "NO", color: "#FF6B6B", emoji: "❌" },
        ])
        break
      case "number":
        setSlices([
          { id: "1", text: "1", color: "#FF6B6B" },
          { id: "2", text: "2", color: "#4ECDC4" },
          { id: "3", text: "3", color: "#45B7D1" },
          { id: "4", text: "4", color: "#96CEB4" },
          { id: "5", text: "5", color: "#FFEAA7" },
          { id: "6", text: "6", color: "#DDA0DD" },
        ])
        break
      case "letter":
        setSlices([
          { id: "1", text: "A", color: "#FF6B6B" },
          { id: "2", text: "B", color: "#4ECDC4" },
          { id: "3", text: "C", color: "#45B7D1" },
          { id: "4", text: "D", color: "#96CEB4" },
          { id: "5", text: "E", color: "#FFEAA7" },
          { id: "6", text: "F", color: "#DDA0DD" },
        ])
        break
      case "country":
        setSlices([
          { id: "1", text: "USA", color: "#FF6B6B", emoji: "🇺🇸" },
          { id: "2", text: "Canada", color: "#4ECDC4", emoji: "🇨🇦" },
          { id: "3", text: "UK", color: "#45B7D1", emoji: "🇬🇧" },
          { id: "4", text: "France", color: "#96CEB4", emoji: "🇫🇷" },
          { id: "5", text: "Germany", color: "#FFEAA7", emoji: "🇩🇪" },
          { id: "6", text: "Japan", color: "#DDA0DD", emoji: "🇯🇵" },
        ])
        break
      case "state":
        setSlices([
          { id: "1", text: "California", color: "#FF6B6B" },
          { id: "2", text: "Texas", color: "#4ECDC4" },
          { id: "3", text: "Florida", color: "#45B7D1" },
          { id: "4", text: "New York", color: "#96CEB4" },
          { id: "5", text: "Illinois", color: "#FFEAA7" },
          { id: "6", text: "Pennsylvania", color: "#DDA0DD" },
        ])
        break
      case "color":
        setSlices([
          { id: "1", text: "Red", color: "#FF6B6B", emoji: "🔴" },
          { id: "2", text: "Blue", color: "#4ECDC4", emoji: "🔵" },
          { id: "3", text: "Green", color: "#96CEB4", emoji: "🟢" },
          { id: "4", text: "Yellow", color: "#FFEAA7", emoji: "🟡" },
          { id: "5", text: "Purple", color: "#DDA0DD", emoji: "🟣" },
          { id: "6", text: "Orange", color: "#FFA500", emoji: "🟠" },
        ])
        break
      case "date":
        const today = new Date()
        const dates = []
        for (let i = 0; i < 7; i++) {
          const date = new Date(today)
          date.setDate(today.getDate() + i)
          dates.push({
            id: (i + 1).toString(),
            text: date.toLocaleDateString(),
            color: predefinedColors[i % predefinedColors.length]
          })
        }
        setSlices(dates)
        break
      case "image":
        setSlices([
          { id: "1", text: "Image 1", color: "#FF6B6B", emoji: "🖼️" },
          { id: "2", text: "Image 2", color: "#4ECDC4", emoji: "🖼️" },
          { id: "3", text: "Image 3", color: "#45B7D1", emoji: "🖼️" },
          { id: "4", text: "Image 4", color: "#96CEB4", emoji: "🖼️" },
        ])
        break
      case "instagram":
        setSlices([
          { id: "1", text: "Comment 1", color: "#E4405F", emoji: "📱" },
          { id: "2", text: "Comment 2", color: "#833AB4", emoji: "📱" },
          { id: "3", text: "Comment 3", color: "#F56040", emoji: "📱" },
          { id: "4", text: "Comment 4", color: "#FCAF45", emoji: "📱" },
        ])
        break
      case "mlb":
        setSlices([
          { id: "1", text: "Yankees", color: "#132448", emoji: "⚾" },
          { id: "2", text: "Red Sox", color: "#BD3039", emoji: "⚾" },
          { id: "3", text: "Dodgers", color: "#005A9C", emoji: "⚾" },
          { id: "4", text: "Giants", color: "#FD5A1E", emoji: "⚾" },
        ])
        break
      case "nba":
        setSlices([
          { id: "1", text: "Lakers", color: "#552583", emoji: "🏀" },
          { id: "2", text: "Warriors", color: "#1D428A", emoji: "🏀" },
          { id: "3", text: "Bulls", color: "#CE1141", emoji: "🏀" },
          { id: "4", text: "Celtics", color: "#007A33", emoji: "🏀" },
        ])
        break
      case "nfl":
        setSlices([
          { id: "1", text: "Patriots", color: "#002244", emoji: "🏈" },
          { id: "2", text: "Cowboys", color: "#003594", emoji: "🏈" },
          { id: "3", text: "Packers", color: "#203731", emoji: "🏈" },
          { id: "4", text: "49ers", color: "#AA0000", emoji: "🏈" },
        ])
        break
      default:
        // Default picker wheel
        setSlices([
          { id: "1", text: "Option 1", color: "#FF6B6B" },
          { id: "2", text: "Option 2", color: "#4ECDC4" },
        ])
    }
    setIsLoading(false)
  }

  const loadWheelData = async (id: string | undefined) => {
    if (!db) {
      console.error("Firestore DB instance is undefined in EditWheelScreen (loadWheelData).")
      Alert.alert("Error", "Firebase is not properly initialized. Please restart the app.")
      setIsLoading(false)
      return
    }
    if (!currentUser?.uid) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      if (id && typeof id === 'string' && id.trim() !== '') {
        const wheelDocRef = doc(collection(db, "wheels"), id)
        const wheelDoc = await getDoc(wheelDocRef)

        if (wheelDoc.exists()) {
          const wheelData = wheelDoc.data() as WheelConfig
          if (wheelData.userId !== currentUser?.uid) {
            Alert.alert("Access Denied", "You do not have permission to edit this wheel.")
            navigation.goBack()
            return
          }
          setWheelName(wheelData.name || "Untitled Wheel")
          setSlices(wheelData.slices || [
            { id: "1", text: "YES", color: "#4ECDC4" },
            { id: "2", text: "NO", color: "#FF6B6B" },
          ])
          setSettings(
            wheelData.settings || { spinTime: 3, textSize: 14, sliceLayers: 1, unsaveMode: false, autoHide: false },
          )
          if ((wheelData as any).type) {
            setWheelTypeState((wheelData as any).type)
          }
        } else {
          console.warn("Wheel document not found for ID:", id, "Treating as new wheel.")
          initializeDefaultWheel()
        }
      } else {
        // No valid ID provided, create new wheel
        initializeDefaultWheel()
      }
    } catch (error) {
      console.error("Error loading wheel data from Firestore:", error)
      Alert.alert("Error", "Failed to load wheel data.")
      initializeDefaultWheel()
    } finally {
      setIsLoading(false)
    }
  }

  const initializeDefaultWheel = () => {
    setWheelName("New Wheel")
    setSlices([
      { id: "1", text: "YES", color: "#4ECDC4" },
      { id: "2", text: "NO", color: "#FF6B6B" },
    ])
    setSettings({ spinTime: 3, textSize: 14, sliceLayers: 1, unsaveMode: false, autoHide: false })
  }

  const saveWheel = async () => {
    if (!db) {
      console.error("Firestore DB instance is undefined in EditWheelScreen (saveWheel).")
      Alert.alert("Error", "Firebase is not properly initialized. Cannot save wheel.")
      return
    }
    if (!currentUser?.uid) {
      Alert.alert("Error", "You must be logged in to save wheels.")
      return
    }
    if (!wheelName.trim()) {
      Alert.alert("Error", "Wheel name cannot be empty.")
      return
    }
    if (slices.length < 2) {
      Alert.alert("Error", "A wheel must have at least 2 slices.")
      return
    }

    setIsLoading(true)
    try {
      const wheelData: Omit<WheelConfig, "id"> = {
        name: wheelName.trim(),
        slices,
        settings,
        userId: currentUser.uid,
        type: wheelTypeState,
      }

      if (wheelId) {
        const wheelDocRef = doc(collection(db, "wheels"), wheelId)
        await updateDoc(wheelDocRef, wheelData)
        Alert.alert("Success", "Wheel updated successfully!", [{ text: "OK", onPress: () => navigation.goBack() }])
      } else {
        const newWheelDocRef = doc(collection(db, "wheels"))
        await setDoc(newWheelDocRef, wheelData)
        setWheelId(newWheelDocRef.id)
        Alert.alert("Success", "New wheel created successfully!", [{ text: "OK", onPress: () => navigation.goBack() }])
      }
    } catch (error) {
      console.error("Error saving wheel to Firestore:", error)
      Alert.alert("Error", "Failed to save wheel.")
    } finally {
      setIsLoading(false)
    }
  }

  const addSlice = () => {
    if (!newSliceText.trim()) {
      Alert.alert("Error", "Please enter slice text")
      return
    }
    const newSlice: WheelSlice = {
      id: Date.now().toString(),
      text: newSliceText.trim(),
      color: selectedColor,
      emoji: newSliceEmoji.trim() || undefined,
    }
    setSlices([...slices, newSlice])
    setNewSliceText("")
    setNewSliceEmoji("")
    setShowAddModal(false)
  }

  const removeSlice = (id: string) => {
    if (slices.length <= 2) {
      Alert.alert("Error", "Wheel must have at least 2 slices")
      return
    }
    setSlices(slices.filter((slice) => slice.id !== id))
  }

  const updateSliceTextAndEmoji = (id: string, fullText: string) => {
    setSlices(
      slices.map((s) => {
        if (s.id === id) {
          const parts = fullText.split(" ")
          let newText = fullText
          let newEmoji: string | undefined = undefined

          if (parts.length > 1 && /\p{Emoji}/u.test(parts[parts.length - 1])) {
            newEmoji = parts.pop()
            newText = parts.join(" ")
          }
          return { ...s, text: newText, emoji: newEmoji }
        }
        return s
      }),
    )
  }

  const importFromList = () => {
    Alert.alert("Import Options", "Choose import method:", [
      { text: "Manual Entry", onPress: () => setShowAddModal(true) },
      { text: "Voice Input", onPress: () => Alert.alert("Coming Soon", "Voice input feature coming soon!") },
      { text: "Cancel", style: "cancel" },
    ])
  }

  const renderSlice = (slice: WheelSlice) => (
    <View key={slice.id} style={[styles.sliceItem, { backgroundColor: theme.surface }]}>
      <View style={[styles.colorIndicator, { backgroundColor: slice.color }]} />
      {editingSlice === slice.id ? (
        <TextInput
          style={[styles.sliceInput, { color: "#333" }]}
          value={`${slice.text}${slice.emoji ? ` ${slice.emoji}` : ""}`}
          onChangeText={(fullText) => updateSliceTextAndEmoji(slice.id, fullText)}
          onBlur={() => setEditingSlice(null)}
          autoFocus
        />
      ) : (
        <TouchableOpacity style={styles.sliceTextContainer} onPress={() => setEditingSlice(slice.id)}>
          <Text style={[styles.sliceText, { color: "#333" }]}>
            {slice.text} {slice.emoji}
          </Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.removeButton} onPress={() => removeSlice(slice.id)}>
        <Ionicons name="close" size={20} color={theme.error} />
      </TouchableOpacity>
    </View>
  )

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading editor...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={saveWheel} style={styles.saveButton}>
          <Text style={[styles.saveButtonText, { color: theme.text }]}>Save</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content}>
        {/* Wheel Name */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Wheel Name</Text>
          <TextInput
            style={[styles.nameInput, { borderColor: theme.textSecondary, color: "#333" }]}
            value={wheelName}
            onChangeText={setWheelName}
            placeholder="Enter wheel name"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* Settings */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Settings</Text>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: "#333" }]}>Unsave mode</Text>
            <TouchableOpacity
              style={[styles.toggle, { backgroundColor: settings.unsaveMode ? theme.primary : theme.textSecondary }]}
              onPress={() => setSettings({ ...settings, unsaveMode: !settings.unsaveMode })}
            >
              <Text style={[styles.toggleText, { color: theme.surface }]}>{settings.unsaveMode ? "ON" : "OFF"}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: "#333" }]}>Auto Hide</Text>
            <TouchableOpacity
              style={[styles.toggle, { backgroundColor: settings.autoHide ? theme.primary : theme.textSecondary }]}
              onPress={() => setSettings({ ...settings, autoHide: !settings.autoHide })}
            >
              <Text style={[styles.toggleText, { color: theme.surface }]}>{settings.autoHide ? "ON" : "OFF"}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: "#333" }]}>Text size</Text>
            <Text style={[styles.settingValue, { color: theme.primary }]}>{settings.textSize}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: "#333" }]}>Slice Layers</Text>
            <Text style={[styles.settingValue, { color: theme.primary }]}>{settings.sliceLayers}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: "#333" }]}>Spin time</Text>
            <Text style={[styles.settingValue, { color: theme.primary }]}>{settings.spinTime}s</Text>
          </View>
        </View>

        {/* Slices */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <View style={styles.slicesHeader}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>Slices ({slices.length})</Text>
            <TouchableOpacity onPress={() => {}}>
              <Ionicons name="shuffle" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.sliceActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add" size={16} color={theme.surface} />
              <Text style={[styles.actionButtonText, { color: theme.surface }]}>ADD SLICE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.secondary }]}
              onPress={importFromList}
            >
              <Ionicons name="list" size={16} color={theme.surface} />
              <Text style={[styles.actionButtonText, { color: theme.surface }]}>ADD LIST</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.slicesList}>{slices.map((slice) => renderSlice(slice))}</View>
        </View>

        {/* Theme Customization */}
        <TouchableOpacity
          style={[styles.section, { backgroundColor: theme.surface }]}
          onPress={() =>
            navigation.navigate('SettingsTab' as never, { screen: 'CustomizeTheme' } as never)
          }
        >
          <View style={styles.themeSection}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.primary }]}>Customize Colors</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Choose how you want to customize the wheel colors
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Slice Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.primary }]}>Add Slice</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { color: "#333" }]}>
              Fill in the contents of the slice (each item can be one line). Tap the mic to use voice input.
            </Text>
            <TextInput
              style={[styles.modalInput, { borderColor: theme.textSecondary, color: "#333" }]}
              value={newSliceText}
              onChangeText={setNewSliceText}
              placeholder="Insert/paste or use voice..."
              placeholderTextColor={theme.textSecondary}
              multiline
            />
            <TextInput
              style={[
                styles.modalInput,
                { borderColor: theme.textSecondary, minHeight: 50, marginBottom: 10, color: "#333" },
              ]}
              value={newSliceEmoji}
              onChangeText={setNewSliceEmoji}
              placeholder="Optional: Add an emoji (e.g., 🍕)"
              placeholderTextColor={theme.textSecondary}
            />
            <TouchableOpacity style={styles.voiceButton}>
              <Ionicons name="mic" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.colorLabel, { color: "#333" }]}>Choose Color:</Text>
            <View style={styles.colorPicker}>
              {predefinedColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.selectedColor,
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.textSecondary }]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.surface }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: theme.primary }]} onPress={addSlice}>
                <Text style={[styles.modalButtonText, { color: theme.surface }]}>ADD</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
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
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
  },
  settingValue: {
    fontSize: 16,
    fontWeight: "bold",
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
  slicesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sliceActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    flex: 1,
    justifyContent: "center",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  slicesList: {
    gap: 12,
  },
  sliceItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  sliceTextContainer: {
    flex: 1,
  },
  sliceText: {
    fontSize: 16,
  },
  sliceInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  removeButton: {
    padding: 4,
  },
  themeSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  voiceButton: {
    alignSelf: "center",
    padding: 12,
    marginBottom: 20,
  },
  colorLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  colorPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedColor: {
    borderColor: "#333",
    borderWidth: 3,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
  },
})

export default EditWheelScreen
