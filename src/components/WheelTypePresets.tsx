import React, { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Alert, TextInput } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { db } from "../config/firebaseConfig"
import { collection, addDoc, serverTimestamp, getDocs, query, where, onSnapshot, orderBy } from "firebase/firestore"
import { useTheme } from "../contexts/ThemeContext"
import { useAuth } from "../contexts/AuthContext"

interface WheelTypePreset {
  value: string
  label: string
  description: string
  category: string
  icon: string
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
}

const WHEEL_TYPE_PRESETS: WheelTypePreset[] = [
  // Educational Wheels
  {
    value: "student-selector",
    label: "Student Selector",
    description: "Randomly select students for questions, presentations, or activities",
    category: "Educational",
    icon: "🎓",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultItems: ["Student 1", "Student 2", "Student 3", "Student 4", "Student 5", "Student 6"],
    defaultSettings: {
      allowRealTimeCollection: true,
      maxParticipants: 50,
      requiresApproval: false,
      congratsMessage: "🎓 Congratulations, {winner}! You've been selected!"
    }
  },
  {
    value: "topic-picker",
    label: "Topic Picker",
    description: "Select random topics for discussions, essays, or research projects",
    category: "Educational",
    icon: "📚",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultItems: ["Climate Change", "Technology Impact", "Social Media", "Education Reform", "Space Exploration", "Art & Culture"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "quiz-question",
    label: "Quiz Question Selector",
    description: "Randomly select quiz questions for interactive learning",
    category: "Educational",
    icon: "❓",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultItems: ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5", "Bonus Question"],
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: false
    }
  },
  // Activity Wheels
  {
    value: "icebreaker",
    label: "Icebreaker Activities",
    description: "Fun icebreaker activities to start classes or meetings",
    category: "Activities",
    icon: "🧊",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultItems: ["Two Truths & a Lie", "Human Bingo", "Name Game", "This or That", "Show & Tell", "Quick Draw"],
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: false,
      congratsMessage: "🎉 Great choice, {winner}! Let's get started!"
    }
  },
  {
    value: "brain-break",
    label: "Brain Break Activities",
    description: "Quick energizing activities for classroom breaks",
    category: "Activities",
    icon: "🧠",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultItems: ["Stretch Break", "Dance Party", "Deep Breathing", "Quick Walk", "Desk Yoga", "Mindful Moment"],
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: false
    }
  },
  // Decision Making
  {
    value: "yes-no-maybe",
    label: "Yes/No/Maybe Decider",
    description: "Three-option decision maker for quick choices",
    category: "Decision",
    icon: "🤔",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: false,
    canBeShared: true,
    defaultItems: ["Yes", "No", "Maybe"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "priority-picker",
    label: "Priority Picker",
    description: "Help prioritize tasks or activities",
    category: "Decision",
    icon: "📋",
    allowedRoles: ["organizer"],
    isActivityWheel: false,
    canBeShared: true,
    defaultItems: ["High Priority", "Medium Priority", "Low Priority", "Urgent", "Can Wait"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  // Games & Fun
  {
    value: "team-picker",
    label: "Team Picker Wheel",
    description: "Randomly assign participants to teams for group activities and games",
    category: "Games",
    icon: "👥",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: true,
    canBeShared: true,
    defaultItems: ["Team Alpha", "Team Beta", "Team Gamma", "Team Delta", "Team Echo", "Team Foxtrot"],
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: false,
      congratsMessage: "Welcome to {winner}! 🎉"
    }
  },
  {
    value: "truth-dare",
    label: "Truth or Dare",
    description: "Classic truth or dare game for social activities",
    category: "Games",
    icon: "🎭",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: true,
    canBeShared: true,
    defaultItems: ["Truth", "Dare", "Truth", "Dare", "Truth", "Dare"],
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: true
    }
  }
]

interface WheelTypePresetsProps {
  onPresetAdded?: () => void
}

export function WheelTypePresets({ onPresetAdded }: WheelTypePresetsProps) {
  const { theme } = useTheme()
  const { currentUser, userProfile } = useAuth()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [addingPreset, setAddingPreset] = useState<string | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<WheelTypePreset | null>(null)
  const [targetSelectionOpen, setTargetSelectionOpen] = useState(false)
  const [multipleTargetSelectionOpen, setMultipleTargetSelectionOpen] = useState(false)
  const [distributionTarget, setDistributionTarget] = useState<"all" | "participants" | "organizers" | "specific">("all")
  const [specificUserEmails, setSpecificUserEmails] = useState("")
  const [customMessage, setCustomMessage] = useState("")
  const [existingWheelTypes, setExistingWheelTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set())

  const addPresetToDatabase = async (preset: WheelTypePreset, isMultiple = false, distTarget?: string, specificEmails?: string) => {
    if (!isMultiple) {
      setAddingPreset(preset.value)
    }
    try {
      // Determine allowed roles based on distribution target
      let allowedRoles = preset.allowedRoles
      if (distTarget === "all") {
        // For "All Users", include only organizers and participants (exclude admin)
        allowedRoles = ["organizer", "participant"]
      } else if (distTarget === "participants") {
        // For "Participants Only", only allow participants
        allowedRoles = ["participant"]
      } else if (distTarget === "organizers") {
        // For "Organizers Only", only allow organizers
        allowedRoles = ["organizer"]
      }
      // For "specific", keep original roles but handle via user-specific entries

      const docRef = await addDoc(collection(db, "wheelTypes"), {
        value: preset.value,
        label: preset.label,
        description: preset.description,
        enabled: true,
        order: Date.now(), // Use timestamp for order
        allowedRoles: allowedRoles,
        isActivityWheel: preset.isActivityWheel,
        canBeShared: preset.canBeShared,
        defaultItems: preset.defaultItems || ["Option 1", "Option 2", "Option 3", "Option 4"],
        defaultSettings: preset.defaultSettings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isPreset: true,
        category: preset.category,
        icon: preset.icon,
        distributionTarget: distTarget || "all",
        specificUsers: distTarget === "specific" && specificEmails ? specificEmails.split(",").map(email => email.trim()).filter(Boolean) : []
      })

      // Broadcast the change to all users by creating a system notification
      await addDoc(collection(db, "systemNotifications"), {
        type: "wheelTypeAdded",
        wheelTypeId: docRef.id,
        wheelTypeLabel: preset.label,
        message: `New wheel type "${preset.label}" is now available!`,
        createdAt: serverTimestamp(),
        isActive: true,
        targetRoles: preset.allowedRoles,
        priority: "normal"
      })

      Alert.alert("Success", `"${preset.label}" has been added and is now available to users.`)
      onPresetAdded?.()
    } catch (error: any) {
      console.error("Error adding preset:", error)
      Alert.alert("Error", error.message || "Failed to add wheel type")
    } finally {
      if (!isMultiple) {
        setAddingPreset(null)
      }
    }
  }

  const togglePresetSelection = (presetValue: string) => {
    const newSelected = new Set(selectedPresets)
    if (newSelected.has(presetValue)) {
      newSelected.delete(presetValue)
    } else {
      newSelected.add(presetValue)
    }
    setSelectedPresets(newSelected)
  }

  const addMultiplePresets = async () => {
    if (selectedPresets.size === 0) return

    const selectedPresetObjects = WHEEL_TYPE_PRESETS.filter(preset =>
      selectedPresets.has(preset.value)
    )

    setAddingPreset("multiple")
    try {
      // Add all selected presets
      for (const preset of selectedPresetObjects) {
        await addPresetToDatabase(preset, true, distributionTarget, specificUserEmails)
      }

      setSelectedPresets(new Set())
      Alert.alert("Success", `${selectedPresetObjects.length} wheel types have been added and are now available.`)
    } catch (error: any) {
      console.error("Error adding multiple presets:", error)
      Alert.alert("Error", error.message || "Failed to add wheel types")
    } finally {
      setAddingPreset(null)
    }
  }

  // Load existing wheel types to filter out already added presets
  useEffect(() => {
    const q = query(collection(db, "wheelTypes"), orderBy("order", "asc"))

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const existingValues = querySnapshot.docs.map(doc => doc.data().value)
      setExistingWheelTypes(existingValues)
      setLoading(false)
    }, (error) => {
      console.error("Error loading existing wheel types:", error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Filter out presets that are already added
  const availablePresets = WHEEL_TYPE_PRESETS.filter(preset =>
    !existingWheelTypes.includes(preset.value)
  )

  const groupedPresets = availablePresets.reduce((acc, preset) => {
    if (!acc[preset.category]) {
      acc[preset.category] = []
    }
    acc[preset.category].push(preset)
    return acc
  }, {} as Record<string, WheelTypePreset[]>)

  return (
    <>
      <TouchableOpacity
        style={[styles.triggerButton, { backgroundColor: theme.primary }]}
        onPress={() => setIsDialogOpen(true)}
      >
        <Ionicons name="sparkles" size={20} color={theme.surface} />
        <Text style={[styles.triggerButtonText, { color: theme.surface }]}>Add from Presets</Text>
      </TouchableOpacity>

      <Modal
        visible={isDialogOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDialogOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Wheel Type Presets</Text>
              <TouchableOpacity onPress={() => setIsDialogOpen(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Add Selected Button */}
            {selectedPresets.size > 0 && (
              <View style={styles.addSelectedContainer}>
                <TouchableOpacity
                  style={[styles.addSelectedButton, { backgroundColor: theme.primary }]}
                  onPress={() => setMultipleTargetSelectionOpen(true)}
                  disabled={addingPreset !== null}
                >
                  <Ionicons name="add" size={16} color={theme.surface} />
                  <Text style={[styles.addSelectedText, { color: theme.surface }]}>
                    Add Selected ({selectedPresets.size})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading available presets...</Text>
                </View>
              ) : Object.keys(groupedPresets).length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="sparkles" size={48} color={theme.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>All Presets Added!</Text>
                  <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                    All available wheel type presets have been added to your system.
                  </Text>
                </View>
              ) : (
                <View style={styles.presetsContainer}>
                  {Object.entries(groupedPresets).map(([category, presets]) => (
                    <View key={category} style={styles.categorySection}>
                      <Text style={[styles.categoryTitle, { color: theme.primary }]}>{category}</Text>
                      <View style={styles.presetsGrid}>
                        {presets.map((preset) => (
                          <TouchableOpacity
                            key={preset.value}
                            style={[
                              styles.presetCard,
                              { backgroundColor: theme.background },
                              selectedPresets.has(preset.value) && { borderColor: theme.primary, borderWidth: 2 }
                            ]}
                            onPress={() => togglePresetSelection(preset.value)}
                            disabled={addingPreset === preset.value || addingPreset === "multiple"}
                          >
                            <View style={styles.presetHeader}>
                              <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => togglePresetSelection(preset.value)}
                              >
                                {selectedPresets.has(preset.value) ? (
                                  <Ionicons name="checkbox" size={20} color={theme.primary} />
                                ) : (
                                  <Ionicons name="square-outline" size={20} color={theme.textSecondary} />
                                )}
                              </TouchableOpacity>
                              <Text style={styles.presetIcon}>{preset.icon}</Text>
                              <Text style={[styles.presetTitle, { color: theme.text }]} numberOfLines={2}>
                                {preset.label}
                              </Text>
                            </View>
                            <Text style={[styles.presetDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                              {preset.description}
                            </Text>
                            <View style={styles.presetBadges}>
                              {preset.allowedRoles.map((role) => (
                                <View key={role} style={[styles.badge, { backgroundColor: theme.primary + '20' }]}>
                                  <Text style={[styles.badgeText, { color: theme.primary }]}>{role}</Text>
                                </View>
                              ))}
                              {preset.isActivityWheel && (
                                <View style={[styles.badge, { backgroundColor: '#10b98120' }]}>
                                  <Text style={[styles.badgeText, { color: '#10b981' }]}>Activity</Text>
                                </View>
                              )}
                            </View>
                            <TouchableOpacity
                              style={[styles.addButton, { backgroundColor: theme.primary }]}
                              onPress={() => {
                                setSelectedPreset(preset)
                                setTargetSelectionOpen(true)
                              }}
                              disabled={addingPreset === preset.value || addingPreset === "multiple"}
                            >
                              {addingPreset === preset.value ? (
                                <Text style={[styles.addButtonText, { color: theme.surface }]}>Adding...</Text>
                              ) : (
                                <>
                                  <Ionicons name="add" size={16} color={theme.surface} />
                                  <Text style={[styles.addButtonText, { color: theme.surface }]}>Add Now</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Target Selection Modal */}
      <Modal
        visible={targetSelectionOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTargetSelectionOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.targetModalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Choose Distribution Target</Text>
              <TouchableOpacity onPress={() => setTargetSelectionOpen(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.targetDescription, { color: theme.textSecondary }]}>
              Select who should receive the "{selectedPreset?.label}" wheel type.
            </Text>

            <View style={styles.targetOptions}>
              {[
                { value: "all", label: "All Users", icon: "people" },
                { value: "participants", label: "Participants Only", icon: "person" },
                { value: "organizers", label: "Organizers Only", icon: "school" }
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.targetOption,
                    { borderColor: theme.border },
                    distributionTarget === option.value && { borderColor: theme.primary, backgroundColor: theme.primary + '10' }
                  ]}
                  onPress={() => setDistributionTarget(option.value as any)}
                >
                  <Ionicons name={option.icon as any} size={20} color={distributionTarget === option.value ? theme.primary : theme.textSecondary} />
                  <Text style={[styles.targetOptionText, { color: theme.text }]}>{option.label}</Text>
                  {distributionTarget === option.value && (
                    <Ionicons name="checkmark" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.border }]}
                onPress={() => {
                  setTargetSelectionOpen(false)
                  setDistributionTarget("all")
                  setSpecificUserEmails("")
                  setCustomMessage("")
                  setSelectedPreset(null)
                }}
              >
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  if (selectedPreset) {
                    addPresetToDatabase(selectedPreset, false, distributionTarget, specificUserEmails)
                    setTargetSelectionOpen(false)
                    setDistributionTarget("all")
                    setSpecificUserEmails("")
                    setCustomMessage("")
                    setSelectedPreset(null)
                  }
                }}
                disabled={addingPreset !== null}
              >
                <Ionicons name="sparkles" size={16} color={theme.surface} />
                <Text style={[styles.confirmButtonText, { color: theme.surface }]}>Add Wheel Type</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Multiple Target Selection Modal */}
      <Modal
        visible={multipleTargetSelectionOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMultipleTargetSelectionOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.targetModalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Choose Distribution Target</Text>
              <TouchableOpacity onPress={() => setMultipleTargetSelectionOpen(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.targetDescription, { color: theme.textSecondary }]}>
              Select who should receive the {selectedPresets.size} selected wheel types.
            </Text>

            <View style={styles.targetOptions}>
              {[
                { value: "all", label: "All Users", icon: "people" },
                { value: "participants", label: "Participants Only", icon: "person" },
                { value: "organizers", label: "Organizers Only", icon: "school" }
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.targetOption,
                    { borderColor: theme.border },
                    distributionTarget === option.value && { borderColor: theme.primary, backgroundColor: theme.primary + '10' }
                  ]}
                  onPress={() => setDistributionTarget(option.value as any)}
                >
                  <Ionicons name={option.icon as any} size={20} color={distributionTarget === option.value ? theme.primary : theme.textSecondary} />
                  <Text style={[styles.targetOptionText, { color: theme.text }]}>{option.label}</Text>
                  {distributionTarget === option.value && (
                    <Ionicons name="checkmark" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.border }]}
                onPress={() => {
                  setMultipleTargetSelectionOpen(false)
                  setDistributionTarget("all")
                  setSpecificUserEmails("")
                  setCustomMessage("")
                }}
              >
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  addMultiplePresets()
                  setMultipleTargetSelectionOpen(false)
                  setDistributionTarget("all")
                  setSpecificUserEmails("")
                  setCustomMessage("")
                }}
                disabled={addingPreset !== null}
              >
                <Ionicons name="sparkles" size={16} color={theme.surface} />
                <Text style={[styles.confirmButtonText, { color: theme.surface }]}>Add {selectedPresets.size} Wheel Types</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  triggerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addSelectedContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  addSelectedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  addSelectedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  presetsContainer: {
    gap: 24,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  presetsGrid: {
    gap: 12,
  },
  presetCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkboxContainer: {
    marginRight: 8,
  },
  presetIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  presetTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  presetDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  presetBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  targetModalContent: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  targetDescription: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  targetOptions: {
    gap: 12,
    marginBottom: 24,
  },
  targetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  targetOptionText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
})

export default WheelTypePresets