import React, { useMemo, useState, useCallback } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Platform,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import { useTheme } from "../contexts/ThemeContext"
import { useAuth } from "../contexts/AuthContext"

const ROLES = [
  {
    id: "organizer" as const,
    title: "Organizer",
    description: "Create activities, manage participants, coordinate events",
    icon: "person-add",
    features: [
      "Create and manage live activities",
      "Invite participants to join",
      "View detailed analytics",
      "Manage multiple sessions"
    ],
    color: "#8e0b16"
  },
  {
    id: "participant" as const,
    title: "Participant",
    description: "Join activities, participate in live draws, view results",
    icon: "people",
    features: [
      "Join live sessions with room codes",
      "Participate in interactive draws",
      "Browse and use picker wheels",
      "View activity results"
    ],
    color: "#2563eb"
  }
]

const RoleSelectionScreen: React.FC = () => {
  const navigation = useNavigation<any>()
  const { theme } = useTheme()
  const { currentUser, userProfile, setUserRole } = useAuth()
  const [selectedRole, setSelectedRole] = useState<"organizer" | "participant" | null>(userProfile?.role === 'organizer' ? 'organizer' : userProfile?.role === 'participant' ? 'participant' : null)
  const [loading, setLoading] = useState(false)

  const roles = useMemo(() => ROLES, [])

  const onSelect = useCallback((roleId: "organizer" | "participant") => {
    if (loading) return
    setSelectedRole(roleId)
  }, [loading])

  const handleRoleSelect = useCallback(async () => {
    if (!selectedRole || !currentUser) return

    setLoading(true)
    try {
      // Navigate immediately for snappy feel; persist role in background
      navigation.reset({ index: 0, routes: [{ name: "Main" }] })
      await setUserRole(selectedRole)
    } catch (error) {
      console.error("Error updating role:", error)
      navigation.reset({ index: 0, routes: [{ name: "Main" }] })
    } finally {
      setLoading(false)
    }
  }, [currentUser, navigation, selectedRole, setUserRole])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.primary }]}>Choose Your Role</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Select how you want to use Coby Picks today
          </Text>
        </View>

        <View style={styles.rolesContainer}>
          {roles.map((role) => {
            const isSelected = selectedRole === role.id

            return (
              <TouchableOpacity
                key={role.id}
                style={[
                  styles.roleCard,
                  {
                    borderColor: isSelected ? role.color : theme.border,
                    backgroundColor: isSelected ? `${role.color}10` : theme.surface,
                    borderWidth: isSelected ? 2 : 1,
                  }
                ]}
                onPress={() => onSelect(role.id)}
                disabled={loading}
              >
                <View style={styles.roleHeader}>
                  <View
                    style={[
                      styles.roleIcon,
                      { backgroundColor: `${role.color}15` }
                    ]}
                  >
                    <Ionicons name={role.icon as any} size={26} color={role.color} />
                  </View>
                  {isSelected && (
                    <View style={[styles.selectedIndicator, { backgroundColor: role.color }]}>
                      <Ionicons name="checkmark" size={16} color="white" />
                    </View>
                  )}
                </View>

                <Text style={[styles.roleTitle, { color: role.color }]}>{role.title}</Text>
                <Text style={[styles.roleDescription, { color: theme.textSecondary }]}>
                  {role.description}
                </Text>

                <View style={styles.featuresList}>
                  {role.features.map((feature, index) => (
                    <View key={index} style={styles.featureItem}>
                      <View style={[styles.featureDot, { backgroundColor: role.color }]} />
                      <Text style={[styles.featureText, { color: theme.text }]}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              {
                backgroundColor: selectedRole ? roles.find(r => r.id === selectedRole)?.color : theme.textSecondary,
                opacity: !selectedRole || loading ? 0.5 : 1
              }
            ]}
            onPress={handleRoleSelect}
            disabled={!selectedRole || loading}
          >
            <Text style={styles.continueButtonText}>
              {loading ? "Setting up..." : "Continue as"} {selectedRole && roles.find(r => r.id === selectedRole)?.title}
            </Text>
            {!loading && selectedRole && (
              <Ionicons name="arrow-forward" size={20} color="white" style={styles.continueIcon} />
            )}
          </TouchableOpacity>

          <Text style={[styles.hintText, { color: theme.textSecondary }]}>
            You can change your role anytime from your dashboard
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "ios" ? 20 : 32,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 21,
  },
  rolesContainer: {
    gap: 16,
    marginBottom: 28,
  },
  roleCard: {
    borderRadius: 14,
    padding: 18,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    maxWidth: 480,
    alignSelf: "center",
  },
  roleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  roleIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 6,
  },
  roleDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  featuresList: {
    gap: 10,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  featureDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 6,
    flexShrink: 0,
  },
  featureText: {
    fontSize: 13,
    lineHeight: 17,
    flex: 1,
  },
  footer: {
    alignItems: "center",
    gap: 12,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 180,
  },
  continueButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
  continueIcon: {
    marginLeft: 8,
  },
  hintText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
})

export default RoleSelectionScreen
