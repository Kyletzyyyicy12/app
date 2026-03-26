import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, Alert, StyleSheet, SafeAreaView, ScrollView } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useDataPrivacy } from "../contexts/DataPrivacyContext"
import { useTheme } from "../contexts/ThemeContext"
import { useAuth } from "../contexts/AuthContext"

const DataPrivacyConsentScreen = () => {
  const navigation = useNavigation()
  const { theme } = useTheme()
  const { currentUser } = useAuth()
  const { consentGiven, giveConsent, isLoading } = useDataPrivacy()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // If consent is already given, the AppNavigator will automatically
    // navigate to MainApp, so we don't need to do anything here
    if (consentGiven) {
      console.log("Consent already given, AppNavigator will handle navigation")
    }
  }, [consentGiven])

  const handleConsent = async () => {
    if (!currentUser) {
      Alert.alert("Error", "No user logged in")
      return
    }

    setLoading(true)
    try {
      await giveConsent()
      // Don't manually navigate - let AppNavigator handle it automatically
      // when consentGiven state changes
    } catch (error) {
      console.error("Error giving consent:", error)
      Alert.alert("Error", "Failed to save consent. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleDecline = () => {
    Alert.alert(
      "Data Privacy Required",
      "This app requires data privacy consent to function properly. Without consent, you cannot use the app features.",
      [
        { text: "Review Again", style: "default" },
        {
          text: "Exit App",
          style: "destructive",
          onPress: () => {
            // In a real app, you might want to close the app or logout
            console.log("User declined consent")
          },
        },
      ],
    )
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.primary }]}>Data Privacy Consent</Text>

          <Text style={[styles.description, { color: theme.text }]}>
            We need your consent to process your data in order to provide you with the best experience using our app.
          </Text>

          <View style={styles.consentDetails}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>What data we collect:</Text>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>
              • Your email address and profile information
            </Text>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>• Wheel configurations and spin history</Text>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>• Participant lists you create</Text>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>• App usage analytics</Text>

            <Text style={[styles.sectionTitle, { color: theme.primary }]}>How we use your data:</Text>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>• To provide and improve our services</Text>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>• To sync your data across devices</Text>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>• To send you important updates</Text>

            <Text style={[styles.note, { color: theme.textSecondary }]}>
              You can revoke this consent at any time in the app settings.
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.acceptButton, { backgroundColor: theme.primary }]}
              onPress={handleConsent}
              disabled={loading}
            >
              <Text style={[styles.buttonText, { color: theme.surface }]}>
                {loading ? "Processing..." : "I Accept"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.declineButton, { borderColor: theme.error }]}
              onPress={handleDecline}
              disabled={loading}
            >
              <Text style={[styles.buttonText, { color: theme.error }]}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 24,
  },
  consentDetails: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
  },
  bulletPoint: {
    fontSize: 14,
    marginBottom: 5,
    lineHeight: 20,
  },
  note: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 15,
    textAlign: "center",
  },
  buttonContainer: {
    gap: 15,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: "center",
  },
  acceptButton: {
    // backgroundColor set dynamically
  },
  declineButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
})

export default DataPrivacyConsentScreen
