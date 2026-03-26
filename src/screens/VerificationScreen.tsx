import type React from "react"
import { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "../contexts/AuthContext"
import { useTheme } from "../contexts/ThemeContext"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../navigation/RootNavigator"

type Props = NativeStackScreenProps<RootStackParamList, "Verification">

const VerificationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { email } = route.params
  const { verifyCode, authLoading: isLoading } = useAuth()
  const { theme } = useTheme()

  const [verificationCode, setVerificationCode] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null)

  const handleVerificationSubmit = async () => {
    setMessage(null)
    setMessageType(null)

    if (!verificationCode.trim()) {
      Alert.alert("Error", "Please enter the verification code.")
      return
    }

    const success = await verifyCode(email, verificationCode)
    if (success) {
      // Navigation will be handled by AuthContext onAuthStateChanged
      // The user will be automatically redirected to Main screen
      setMessage("Verification successful! Redirecting to app...")
      setMessageType("success")
    } else {
      setMessage("Verification failed. Please try again.")
      setMessageType("error")
    }
  }

  const handleResendCode = async () => {
    // For now, show alert - in future could implement resend functionality
    Alert.alert("Resend Code", "Please go back to sign up and try again, or contact support.")
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
          <Text style={[styles.backButtonText, { color: theme.primary }]}>Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: theme.primary }]}>Verify Your Email</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          A verification code has been sent to {email}. Please enter it below to complete your account creation.
        </Text>

        {message && (
          <View
            style={[
              styles.messageContainer,
              messageType === "success" ? styles.successMessageBg : styles.errorMessageBg,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                messageType === "success" ? styles.successMessageText : styles.errorMessageText,
              ]}
            >
              {message}
            </Text>
          </View>
        )}

        <View style={styles.form}>
          <Text style={[styles.inputLabel, { color: theme.text }]}>Verification Code *</Text>
          <View style={[styles.inputWrapper, styles.inputElevated, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Ionicons name="key-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.inputBare, { color: theme.text }]}
              placeholder="Enter 6-digit code"
              placeholderTextColor={theme.textSecondary}
              value={verificationCode}
              onChangeText={(text) => {
                // Only allow numbers and limit to 6 digits
                const numericText = text.replace(/[^0-9]/g, '').slice(0, 6)
                setVerificationCode(numericText)
              }}
              keyboardType="numeric"
              maxLength={6}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButtonShadow, { backgroundColor: theme.primary }]}
            onPress={handleVerificationSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={theme.surface} />
            ) : (
              <Text style={[styles.buttonText, { color: theme.surface }]}>Verify & Complete Sign Up</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.resendButton} onPress={handleResendCode}>
            <Text style={[styles.resendText, { color: theme.primary }]}>Didn't receive code? Tap to resend</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    lineHeight: 24,
  },
  messageContainer: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
  },
  successMessageBg: {
    backgroundColor: "rgba(6, 214, 160, 0.1)",
    borderColor: "rgba(6, 214, 160, 0.5)",
  },
  successMessageText: {
    color: "#06D6A0",
  },
  errorMessageBg: {
    backgroundColor: "rgba(239, 71, 111, 0.1)",
    borderColor: "rgba(239, 71, 111, 0.5)",
  },
  errorMessageText: {
    color: "#EF476F",
  },
  form: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 30,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputBare: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '400',
  },
  inputElevated: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  primaryButtonShadow: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "700",
  },
  resendButton: {
    alignSelf: "center",
    marginTop: 20,
  },
  resendText: {
    fontSize: 14,
    fontWeight: "500",
  },
})

export default VerificationScreen