import type React from "react"
import { useState, useEffect } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  FlatList,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useTheme } from "../contexts/ThemeContext"
import { useAuth } from "../contexts/AuthContext"
import { Ionicons } from "@expo/vector-icons"
import { db } from "../config/firebaseConfig"
import { collection, query, where, getDocs, orderBy, doc, setDoc, deleteDoc } from "firebase/firestore"

interface WheelCategoryItem {
  id: string
  title: string
  subtitle?: string
  emoji: string
  type: string
}

interface WheelCategoryGroup {
  id: string
  title: string
  emoji: string
  items: WheelCategoryItem[]
}

interface WheelType {
  id: string
  value: string
  label: string
  description: string
  enabled: boolean
  order: number
  allowedRoles: string[]
  isActivityWheel: boolean
  canBeShared: boolean
  defaultItems?: string[]
  defaultSettings: {
    allowRealTimeCollection: boolean
    maxParticipants?: number
    requiresApproval: boolean
    congratsMessage?: string
  }
  createdAt: any
  updatedAt: any
  isPreset?: boolean
  category?: string
  icon?: string
}


const WheelCategoryScreen: React.FC = () => {
  const navigation = useNavigation<any>()
  const { theme } = useTheme()
  const { userProfile, currentUser } = useAuth()
  const { width } = Dimensions.get("window")
  const isTablet = width > 768

  const [wheelTypes, setWheelTypes] = useState<WheelType[]>([])
  const [loading, setLoading] = useState(true)
  const [userWheelTypes, setUserWheelTypes] = useState<WheelType[]>([])
  const [customWheels, setCustomWheels] = useState<any[]>([])
  const [creatingWheel, setCreatingWheel] = useState<string | null>(null)

  // Custom Wheel Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [wheelTitle, setWheelTitle] = useState("")
  const [wheelDescription, setWheelDescription] = useState("")
  const [wheelCategory, setWheelCategory] = useState("📚 Academic")
  const [numWinners, setNumWinners] = useState("1")
  const [itemsText, setItemsText] = useState("")
  const [isCreatingCustomWheel, setIsCreatingCustomWheel] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  // Check if user is a participant (can only create wheels for solo use)
  const isParticipant = () => {
    if (!userProfile?.role) return true; // Default to participant if no role
    const role = userProfile.role.toLowerCase();
    return role === 'participant';
  };

  // Check if user is an organizer/teacher/admin
  const isOrganizer = () => {
    if (!userProfile?.role) return false;
    const role = userProfile.role.toLowerCase();
    return role === 'teacher' || role === 'organizer' || role === 'admin';
  };

  // Fetch wheel types and custom wheels from Firestore
  const fetchWheelTypes = async () => {
    try {
      setLoading(true)

      // Fetch global wheel types
      const globalQuery = query(collection(db, "wheelTypes"), orderBy("order", "asc"))
      const globalSnapshot = await getDocs(globalQuery)
      const globalTypes: WheelType[] = []

      globalSnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.enabled) {
          globalTypes.push({
            id: doc.id,
            ...data
          } as WheelType)
        }
      })

      // Fetch user-specific wheel types if user is logged in
      let userSpecificTypes: WheelType[] = []
      if (currentUser?.uid) {
        const userQuery = query(
          collection(db, "userWheelTypes"),
          where("userId", "==", currentUser.uid)
        )
        const userSnapshot = await getDocs(userQuery)

        userSpecificTypes = userSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        } as WheelType))
      }

      // Fetch custom wheels created by the user
      let customWheelsData: any[] = []
      if (currentUser?.uid) {
        const customWheelsQuery = query(
          collection(db, "wheels"),
          where("userId", "==", currentUser.uid),
          where("type", "==", "custom"),
          where("saved", "==", true)
        )
        const customWheelsSnapshot = await getDocs(customWheelsQuery)

        customWheelsData = customWheelsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }))
      }

      // Combine and filter based on user role
      const userRole = userProfile?.role?.toLowerCase() || 'participant'
      const allTypes = [...globalTypes, ...userSpecificTypes]

      const filteredTypes = allTypes.filter(type =>
        type.allowedRoles.includes(userRole) ||
        type.allowedRoles.includes('organizer') && isOrganizer() ||
        type.allowedRoles.includes('participant') && isParticipant()
      )

      setWheelTypes(filteredTypes)
      setUserWheelTypes(userSpecificTypes)
      setCustomWheels(customWheelsData)
    } catch (error) {
      console.error("Error fetching wheel types:", error)
      Alert.alert("Error", "Failed to load wheel types")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWheelTypes()
  }, [userProfile, currentUser])

  const createOrFindWheel = async (wheelType: WheelType) => {
    if (!currentUser?.uid) {
      Alert.alert("Error", "You must be logged in to create wheels.")
      return
    }

    // Prevent multiple simultaneous wheel creation
    if (creatingWheel === wheelType.id) {
      return
    }

    setCreatingWheel(wheelType.id)

    try {
      // First, check if user already has a wheel of this type
      const existingWheelQuery = query(
        collection(db, "wheels"),
        where("userId", "==", currentUser.uid),
        where("type", "==", wheelType.value)
      )
      const existingWheelSnapshot = await getDocs(existingWheelQuery)

      let wheelId: string

      if (!existingWheelSnapshot.empty) {
        // Use existing wheel
        const existingWheel = existingWheelSnapshot.docs[0]
        wheelId = existingWheel.id

        // Update the existing wheel with fresh data to ensure it has the latest default slices
        const slices = getDefaultSlicesForWheelType(wheelType)
        const updatedWheelData = {
          name: wheelType.label,
          slices,
          settings: {
            spinTime: 3,
            textSize: 14,
            sliceLayers: 1,
            unsaveMode: false,
            autoHide: false,
          },
          updatedAt: new Date(),
        }
        await setDoc(existingWheel.ref, updatedWheelData, { merge: true })
      } else {
        // Create new wheel
        const wheelName = wheelType.label
        const slices = getDefaultSlicesForWheelType(wheelType)
        const wheelData = {
          name: wheelName,
          slices,
          settings: {
            spinTime: 3,
            textSize: 14,
            sliceLayers: 1,
            unsaveMode: false,
            autoHide: false,
          },
          userId: currentUser.uid,
          type: wheelType.value,
          createdAt: new Date(),
        }

        const wheelDocRef = doc(collection(db, "wheels"))
        await setDoc(wheelDocRef, wheelData)
        wheelId = wheelDocRef.id
      }

      // Navigate to wheel
      navigation.navigate("Wheel", {
        wheelId: wheelId,
      })
    } catch (error) {
      console.error("Error with wheel operation:", error)
      Alert.alert("Error", "Failed to process wheel. Please try again.")
    } finally {
      setCreatingWheel(null)
    }
  }

  const getDefaultSlicesForWheelType = (wheelType: WheelType) => {
    // Updated colors to match web version - SWU Red & White theme with vibrant colors
    const predefinedColors = [
      "#A00000", "#FFFFFF", "#FF6B6B", "#4ECDC4",
      "#45B7D1", "#F7B731", "#A23B72", "#0077B6",
      "#0096C7", "#00B4D8", "#48CAE4", "#90E0EF"
    ]

    // If the wheel type has defaultItems defined, use those instead of hardcoded values
    if (wheelType.defaultItems && wheelType.defaultItems.length > 0) {
      return wheelType.defaultItems.map((item, index) => ({
        id: (index + 1).toString(),
        text: item,
        color: predefinedColors[index % predefinedColors.length],
      }))
    }

    // Fallback to hardcoded values based on wheel type value
    switch (wheelType.value) {
      case "picker":
        return [
          { id: "1", text: "Option 1", color: "#FF6B6B" },
          { id: "2", text: "Option 2", color: "#4ECDC4" },
          { id: "3", text: "Option 3", color: "#45B7D1" },
          { id: "4", text: "Option 4", color: "#96CEB4" },
        ]
      case "team":
        return [
          { id: "1", text: "Team A", color: "#FF6B6B" },
          { id: "2", text: "Team B", color: "#4ECDC4" },
          { id: "3", text: "Team C", color: "#45B7D1" },
          { id: "4", text: "Team D", color: "#96CEB4" },
        ]
      case "yesno":
        return [
          { id: "1", text: "YES", color: "#4ECDC4", emoji: "✅" },
          { id: "2", text: "NO", color: "#FF6B6B", emoji: "❌" },
        ]
      case "number":
        return [
          { id: "1", text: "1", color: "#FF6B6B" },
          { id: "2", text: "2", color: "#4ECDC4" },
          { id: "3", text: "3", color: "#45B7D1" },
          { id: "4", text: "4", color: "#96CEB4" },
          { id: "5", text: "5", color: "#FFEAA7" },
        ]
      case "letter":
        return [
          { id: "1", text: "A", color: "#FF6B6B" },
          { id: "2", text: "B", color: "#4ECDC4" },
          { id: "3", text: "C", color: "#45B7D1" },
          { id: "4", text: "D", color: "#96CEB4" },
          { id: "5", text: "E", color: "#FFEAA7" },
        ]
      case "country":
        return [
          { id: "1", text: "USA", color: "#FF6B6B", emoji: "🇺🇸" },
          { id: "2", text: "Canada", color: "#4ECDC4", emoji: "🇨🇦" },
          { id: "3", text: "UK", color: "#45B7D1", emoji: "🇬🇧" },
          { id: "4", text: "France", color: "#96CEB4", emoji: "🇫🇷" },
        ]
      case "color":
        return [
          { id: "1", text: "Red", color: "#FF6B6B", emoji: "🔴" },
          { id: "2", text: "Blue", color: "#4ECDC4", emoji: "🔵" },
          { id: "3", text: "Green", color: "#96CEB4", emoji: "🟢" },
          { id: "4", text: "Yellow", color: "#FFEAA7", emoji: "🟡" },
        ]
      default:
        return [
          { id: "1", text: "Option 1", color: "#FF6B6B" },
          { id: "2", text: "Option 2", color: "#4ECDC4" },
        ]
    }
  }

  const createCustomWheel = async () => {
    // Validation
    if (!wheelTitle.trim()) {
      Alert.alert("Error", "Wheel title is required.")
      return
    }

    const items = itemsText
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0)

    if (items.length < 2) {
      Alert.alert("Error", "Please enter at least 2 items.")
      return
    }

    const winnersNum = parseInt(numWinners) || 1
    if (winnersNum < 1 || winnersNum > 10) {
      Alert.alert("Error", "Number of winners must be between 1 and 10.")
      return
    }

    if (!currentUser?.uid) {
      Alert.alert("Error", "You must be logged in to create wheels.")
      return
    }

    setIsCreatingCustomWheel(true)

    try {
      // Create custom wheel with user items
      const predefinedColors = [
        "#A00000", "#FFFFFF", "#FF6B6B", "#4ECDC4",
        "#45B7D1", "#F7B731", "#A23B72", "#0077B6",
        "#0096C7", "#00B4D8", "#48CAE4", "#90E0EF"
      ]

      const slices = items.map((item, index) => ({
        id: (index + 1).toString(),
        text: item,
        color: predefinedColors[index % predefinedColors.length],
      }))

      const wheelData = {
        name: wheelTitle,
        description: wheelDescription,
        category: wheelCategory,
        slices,
        settings: {
          spinTime: 3,
          textSize: 14,
          sliceLayers: 1,
          unsaveMode: false,
          autoHide: false,
          numWinners: winnersNum,
        },
        userId: currentUser.uid,
        type: "custom",
        saved: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const wheelDocRef = doc(collection(db, "wheels"))
      await setDoc(wheelDocRef, wheelData)

      // Reset form
      setWheelTitle("")
      setWheelDescription("")
      setWheelCategory("📚 Academic")
      setNumWinners("1")
      setItemsText("")

      // Show success alert with navigation options
      Alert.alert(
        "✓ Wheel Created Successfully!",
        `"${wheelTitle}" has been saved.`,
        [
          {
            text: "Back to Categories",
            onPress: () => {
              setShowCreateModal(false)
              // Refresh custom wheels list
              fetchWheelTypes()
            },
            style: "default"
          },
          {
            text: "Use Wheel Now",
            onPress: () => {
              setShowCreateModal(false)
              // Navigate to the new wheel
              navigation.navigate("Wheel", {
                wheelId: wheelDocRef.id,
              })
            },
            style: "default"
          }
        ],
        { cancelable: false }
      )
    } catch (error) {
      console.error("Error creating custom wheel:", error)
      Alert.alert("Error", "Failed to create custom wheel. Please try again.")
    } finally {
      setIsCreatingCustomWheel(false)
    }
  }

  const confirmDeleteCustomWheel = (customWheel: any) => {
    Alert.alert(
      'Delete Wheel',
      `Are you sure you want to delete "${customWheel.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'wheels', customWheel.id))
              // Refresh the custom wheels list
              setCustomWheels(prev => prev.filter(w => w.id !== customWheel.id))
              Alert.alert('Success', 'Wheel deleted successfully!')
            } catch (error) {
              console.error('Error deleting wheel:', error)
              Alert.alert('Error', 'Failed to delete wheel. Please try again.')
            }
          }
        },
      ]
    )
  }

  const handleCategorySelect = async (wheelType: WheelType) => {
    // Special handling for team-picker - navigate to TeamPickerScreen instead of creating a wheel
    if (wheelType.value === 'team-picker') {
      navigation.navigate("TeamPicker")
      return
    }

    // Special handling for image-picker - create wheel for solo use
    if (wheelType.value === 'image-picker') {
      // For solo image picker wheels, create the wheel and navigate to WheelScreen
      await createOrFindWheel(wheelType)
      return
    }

    // For participants, show a message that they can only use wheels solo
    if (isParticipant()) {
      Alert.alert(
        "Solo Wheel Creation",
        "As a participant, you can create wheels for solo use only. These wheels cannot be used in live sessions.",
        [
          {
            text: "Continue",
            onPress: () => {
              createOrFindWheel(wheelType)
            }
          },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } else {
      await createOrFindWheel(wheelType)
    }
  }

  // Group wheel types by category
  const groupedWheelTypes = wheelTypes.reduce((acc, wheelType) => {
    const category = wheelType.category || 'General'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(wheelType)
    return acc
  }, {} as Record<string, WheelType[]>)

  const renderCreateCustomWheelCard = () => {
    return (
      <TouchableOpacity
        style={[
          styles.categoryCard,
          {
            backgroundColor: theme.surface,
            width: isTablet ? "48%" : "100%",
            borderWidth: 2,
            borderColor: theme.primary,
            borderStyle: 'dashed',
          },
        ]}
        onPress={() => setShowCreateModal(true)}
      >
        <View style={styles.cardContent}>
          <View style={[styles.iconContainer, {
            backgroundColor: theme.primary,
          }]}>
            <Ionicons name="add" size={32} color={theme.surface} />
          </View>
          <View style={styles.textContent}>
            <Text style={[styles.categoryTitle, { color: theme.text }]}>
              Create Custom Wheel
            </Text>
            <Text style={[styles.categoryDescription, { color: theme.textSecondary }]} numberOfLines={2}>
              Design your own wheel with custom participants.
            </Text>
          </View>
          <View style={styles.arrowContainer}>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderWheelTypeCard = (wheelType: WheelType) => {
    const isLoading = creatingWheel === wheelType.id

    return (
      <TouchableOpacity
        key={wheelType.id}
        style={[
          styles.categoryCard,
          {
            backgroundColor: theme.surface,
            width: isTablet ? "48%" : "100%",
            opacity: isLoading ? 0.6 : 1,
          },
        ]}
        onPress={() => handleCategorySelect(wheelType)}
        disabled={isLoading}
      >
        <View style={styles.cardContent}>
          <View style={[styles.iconContainer, {
            backgroundColor: isLoading ? theme.textSecondary : theme.primary
          }]}>
            {isLoading ? (
              <Ionicons name="refresh" size={24} color={theme.surface} />
            ) : (
              <Text style={{ fontSize: 24 }}>{wheelType.icon || '🎯'}</Text>
            )}
          </View>
          <View style={styles.textContent}>
            <Text style={[styles.categoryTitle, { color: theme.text }]}>
              {isLoading ? "Creating..." : wheelType.label}
            </Text>
            <Text style={[styles.categoryDescription, { color: theme.textSecondary }]} numberOfLines={2}>
              {wheelType.description}
            </Text>
          </View>
          <View style={styles.arrowContainer}>
            {isLoading ? (
              <Ionicons
                name="refresh"
                size={20}
                color={theme.textSecondary}
                style={{ transform: [{ rotate: '45deg' }] }}
              />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderCustomWheelCard = (customWheel: any) => {
    return (
      <TouchableOpacity
        key={customWheel.id}
        style={[
          styles.categoryCard,
          {
            backgroundColor: theme.surface,
            width: isTablet ? "48%" : "100%",
          },
        ]}
        onPress={() => {
          navigation.navigate("Wheel", {
            wheelId: customWheel.id,
          })
        }}
        onLongPress={() => confirmDeleteCustomWheel(customWheel)}
        delayLongPress={400}
      >
        <View style={styles.cardContent}>
          <View style={[styles.iconContainer, {
            backgroundColor: theme.secondary || '#666'
          }]}>
            <Text style={{ fontSize: 24 }}>🎯</Text>
          </View>
          <View style={styles.textContent}>
            <Text style={[styles.categoryTitle, { color: theme.text }]}>
              {customWheel.name}
            </Text>
            <Text style={[styles.categoryDescription, { color: theme.textSecondary }]} numberOfLines={2}>
              {customWheel.description || `Custom wheel with ${customWheel.slices?.length || 0} items`}
            </Text>
            <Text style={[styles.customWheelMeta, { color: theme.textSecondary }]}>
              {customWheel.slices?.length || 0} items • Created {customWheel.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
            </Text>
          </View>
          <View style={styles.arrowContainer}>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Picker Wheel Categories</Text>
          {isParticipant() && (
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Solo use only - not for live sessions
            </Text>
          )}
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading wheel types...</Text>
          </View>
        ) : (
          <>
            {/* Create Custom Wheel Card */}
            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.groupHeader, { color: theme.text }]}>
                ✨ Quick Create
              </Text>
              <View style={[styles.categoriesContainer, { flexDirection: isTablet ? "row" : "column" }]}>
                {renderCreateCustomWheelCard()}
              </View>
            </View>

            {/* Custom Wheels Section */}
            {customWheels.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.groupHeader, { color: theme.text }]}>
                  🎯 My Custom Wheels
                </Text>
                <View style={[styles.categoriesContainer, { flexDirection: isTablet ? "row" : "column" }]}>
                  {customWheels.map(renderCustomWheelCard)}
                </View>
              </View>
            )}

            {/* Preset Wheel Types */}
            {Object.keys(groupedWheelTypes).length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="albums-outline" size={64} color={theme.textSecondary} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No wheel types available</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  {isOrganizer() ? 'Add wheel types using the admin panel' : 'Contact your administrator to add wheel types'}
                </Text>
              </View>
            ) : (
              Object.entries(groupedWheelTypes).map(([category, types]) => (
                <View key={category} style={{ marginBottom: 12 }}>
                  <Text style={[styles.groupHeader, { color: theme.text }]}>
                    📁 {category}
                  </Text>
                  <View style={[styles.categoriesContainer, { flexDirection: isTablet ? "row" : "column" }]}>
                    {types.map(renderWheelTypeCard)}
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Create Custom Wheel Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          if (!isCreatingCustomWheel) {
            setShowCreateModal(false)
          }
        }}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border || '#e0e0e0' }]}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCreateModal(false)}
              disabled={isCreatingCustomWheel}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>Create Custom Wheel</Text>
            <View style={{ width: 40 }} />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollView}>
              {/* Wheel Title */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Wheel Title *</Text>
                <Text style={[styles.formHint, { color: theme.textSecondary }]}>e.g., Class Presentation Order, Team Assignments</Text>
                <TextInput
                  style={[styles.textInput, { color: theme.text, borderColor: theme.border || '#ddd', backgroundColor: theme.surface }]}
                  placeholder="Enter wheel title"
                  placeholderTextColor={theme.textSecondary}
                  value={wheelTitle}
                  onChangeText={setWheelTitle}
                  editable={!isCreatingCustomWheel}
                />
              </View>

              {/* Description */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Description (Optional)</Text>
                <Text style={[styles.formHint, { color: theme.textSecondary }]}>Brief description of this wheel's purpose</Text>
                <TextInput
                  style={[styles.textInput, { color: theme.text, borderColor: theme.border || '#ddd', backgroundColor: theme.surface, height: 80 }]}
                  placeholder="Enter description..."
                  placeholderTextColor={theme.textSecondary}
                  value={wheelDescription}
                  onChangeText={setWheelDescription}
                  multiline
                  editable={!isCreatingCustomWheel}
                />
              </View>

              {/* Category Selector */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Category</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, { borderColor: theme.border || '#ddd', backgroundColor: theme.surface }]}
                  onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                  disabled={isCreatingCustomWheel}
                >
                  <Text style={[styles.dropdownText, { color: theme.text }]}>{wheelCategory}</Text>
                  <Ionicons name={showCategoryPicker ? "chevron-up" : "chevron-down"} size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                {showCategoryPicker && (
                  <View style={[styles.categoryDropdown, { backgroundColor: theme.surface, borderColor: theme.border || '#ddd' }]}>
                    {['📚 Academic', '🎮 Games', '🏆 Competition', '🎓 School', '💼 Business', '🎨 Creative', '🌟 Other'].map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.categoryOption, wheelCategory === cat && { backgroundColor: theme.primary }]}
                        onPress={() => {
                          setWheelCategory(cat)
                          setShowCategoryPicker(false)
                        }}
                      >
                        <Text style={[styles.categoryOptionText, { color: wheelCategory === cat ? theme.surface : theme.text }]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Number of Winners */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Number of Random Winners</Text>
                <Text style={[styles.formHint, { color: theme.textSecondary }]}>Maximum: 10 winners</Text>
                <View style={styles.winnerInputContainer}>
                  <TouchableOpacity
                    style={[styles.winnerButton, { backgroundColor: theme.primary }]}
                    onPress={() => setNumWinners(Math.max(1, parseInt(numWinners) - 1).toString())}
                    disabled={parseInt(numWinners) <= 1 || isCreatingCustomWheel}
                  >
                    <Text style={[styles.winnerButtonText, { color: theme.surface }]}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.winnerInput, { color: theme.text, borderColor: theme.border || '#ddd', backgroundColor: theme.surface }]}
                    placeholder="1"
                    placeholderTextColor={theme.textSecondary}
                    value={numWinners}
                    onChangeText={(val) => {
                      const num = parseInt(val) || 1
                      if (num >= 1 && num <= 10) setNumWinners(num.toString())
                    }}
                    keyboardType="number-pad"
                    editable={!isCreatingCustomWheel}
                  />
                  <TouchableOpacity
                    style={[styles.winnerButton, { backgroundColor: theme.primary }]}
                    onPress={() => setNumWinners(Math.min(10, parseInt(numWinners) + 1).toString())}
                    disabled={parseInt(numWinners) >= 10 || isCreatingCustomWheel}
                  >
                    <Text style={[styles.winnerButtonText, { color: theme.surface }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Items Input */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Items *</Text>
                <Text style={[styles.formHint, { color: theme.textSecondary }]}>✎ Enter ONE item PER LINE (minimum 2 items)</Text>
                <Text style={[styles.formHint, { color: theme.textSecondary, fontStyle: 'italic', marginTop: 4 }]}>Example:</Text>
                <Text style={[styles.formHint, { color: theme.textSecondary, marginTop: 2 }]}>Alice Johnson{"\n"}Bob Smith{"\n"}Charlie Brown</Text>
                <TextInput
                  style={[styles.itemsInput, { color: theme.text, borderColor: theme.border || '#ddd', backgroundColor: theme.surface }]}
                  placeholder="Alice Johnson\nBob Smith\nCharlie Brown\nDiana Prince"
                  placeholderTextColor={theme.textSecondary}
                  value={itemsText}
                  onChangeText={setItemsText}
                  multiline
                  editable={!isCreatingCustomWheel}
                />
              </View>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: theme.primary }]}
                  onPress={() => setShowCreateModal(false)}
                  disabled={isCreatingCustomWheel}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.primary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createButton, { backgroundColor: theme.primary, opacity: isCreatingCustomWheel ? 0.6 : 1 }]}
                  onPress={createCustomWheel}
                  disabled={isCreatingCustomWheel}
                >
                  <Text style={[styles.createButtonText, { color: theme.surface }]}>
                    {isCreatingCustomWheel ? 'Creating...' : 'Create Wheel'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Platform.OS === "web" ? 24 : 16,
    paddingTop: Platform.OS === "web" ? 24 : Platform.OS === "ios" ? 16 : 28,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: Platform.OS === "web" ? 20 : 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Platform.OS === "web" ? 24 : 16,
    paddingBottom: 24,
    maxWidth: 1000,
    alignSelf: "center",
    width: "100%",
  },
  groupHeader: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  categoriesContainer: {
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
  },
  categoryCard: {
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    marginBottom: 16,
  },
  cardContent: {
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  textContent: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  customWheelMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  arrowContainer: {
    marginLeft: 8,
  },

  // Loading and Empty States
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
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

  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Dimensions.get('window').width < 380 ? 12 : 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalHeaderTitle: {
    fontSize: Dimensions.get('window').width < 380 ? 16 : 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
  },
  modalScrollView: {
    flex: 1,
    paddingHorizontal: Dimensions.get('window').width < 380 ? 12 : 16,
    paddingTop: Dimensions.get('window').width < 380 ? 12 : 16,
  },
  formSection: {
    marginBottom: Dimensions.get('window').width < 380 ? 16 : 20,
  },
  formLabel: {
    fontSize: Dimensions.get('window').width < 380 ? 14 : 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  formHint: {
    fontSize: Dimensions.get('window').width < 380 ? 11 : 12,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Dimensions.get('window').width < 380 ? 10 : 12,
    paddingVertical: Dimensions.get('window').width < 380 ? 8 : 10,
    fontSize: Dimensions.get('window').width < 380 ? 13 : 14,
  },
  itemsInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Dimensions.get('window').width < 380 ? 10 : 12,
    paddingVertical: Dimensions.get('window').width < 380 ? 8 : 10,
    fontSize: Dimensions.get('window').width < 380 ? 13 : 14,
    height: Dimensions.get('window').width < 380 ? 120 : 150,
    textAlignVertical: 'top',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Dimensions.get('window').width < 380 ? 10 : 12,
    paddingVertical: Dimensions.get('window').width < 380 ? 8 : 10,
  },
  dropdownText: {
    fontSize: Dimensions.get('window').width < 380 ? 13 : 14,
  },
  categoryDropdown: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 200,
  },
  categoryOption: {
    paddingHorizontal: Dimensions.get('window').width < 380 ? 10 : 12,
    paddingVertical: Dimensions.get('window').width < 380 ? 10 : 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  categoryOptionText: {
    fontSize: Dimensions.get('window').width < 380 ? 13 : 14,
  },
  winnerInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Dimensions.get('window').width < 380 ? 8 : 12,
  },
  winnerButton: {
    width: Dimensions.get('window').width < 380 ? 40 : 44,
    height: Dimensions.get('window').width < 380 ? 40 : 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerButtonText: {
    fontSize: Dimensions.get('window').width < 380 ? 18 : 20,
    fontWeight: '600',
  },
  winnerInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Dimensions.get('window').width < 380 ? 10 : 12,
    paddingVertical: Dimensions.get('window').width < 380 ? 8 : 10,
    fontSize: Dimensions.get('window').width < 380 ? 13 : 14,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: Dimensions.get('window').width < 380 ? 8 : 12,
    paddingVertical: Dimensions.get('window').width < 380 ? 16 : 20,
    paddingBottom: 40,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: Dimensions.get('window').width < 380 ? 12 : 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: Dimensions.get('window').width < 380 ? 14 : 16,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: Dimensions.get('window').width < 380 ? 12 : 14,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: Dimensions.get('window').width < 380 ? 14 : 16,
    fontWeight: '600',
  },
})

export default WheelCategoryScreen
