import React, { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  Dimensions,
  Platform,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "../contexts/AuthContext"
import { useTheme } from "../contexts/ThemeContext"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../navigation/RootNavigator"

type Props = NativeStackScreenProps<RootStackParamList, "Auth">

const AuthScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn: login, signUp: register, resetPassword: forgotPassword, authLoading: isLoading, checkEmailExists, sendVerificationCode, verifyCode, resetPasswordWithCode, userProfile } = useAuth()
  const { theme } = useTheme()

  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [role, setRole] = useState('participant')
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null)
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("")
  const [recoveryEmail, setRecoveryEmail] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [forgotPasswordStep, setForgotPasswordStep] = useState(1)
  const [forgotPasswordCode, setForgotPasswordCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [useRecoveryEmail, setUseRecoveryEmail] = useState(false)

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleAuth = async () => {
    setMessage(null)
    setMessageType(null)

    if (isLogin) {
      const success = await login(email, password)
      if (success) {
        const hasRole = userProfile?.role
        navigation.reset({
          index: 0,
          routes: [{ name: hasRole ? 'Main' : 'RoleSelection' }]
        })
      } else {
        setMessage("Login failed. Please check your credentials.")
        setMessageType("error")
      }
    } else {
      if (!firstName.trim() || !lastName.trim()) {
        Alert.alert("Error", "Please enter your first and last name.")
        return
      }
      if (!email.trim() || !password.trim()) {
        Alert.alert("Error", "Please enter email and password.")
        return
      }
      if (!privacyAgreed) {
        Alert.alert("Error", "Please agree to the Data Privacy Policy to continue.")
        return
      }

      if (!validateEmail(email)) {
        Alert.alert("Error", "Please enter a valid email address.")
        return
      }

      const sanitizedEmail = email.trim()
      const sanitizedRecoveryEmail = recoveryEmail.trim()

      const emailExists = await checkEmailExists(sanitizedEmail)
      if (emailExists) {
        Alert.alert("Error", "An account with this email already exists. Please try logging in instead.")
        return
      }

      if (password.length < 6) {
        Alert.alert("Error", "Password must be at least 6 characters long.")
        return
      }

      // Validate recovery email only if provided
      if (sanitizedRecoveryEmail) {
        if (!validateEmail(sanitizedRecoveryEmail)) {
          Alert.alert("Error", "Please enter a valid recovery email address.")
          return
        }

        if (sanitizedRecoveryEmail.toLowerCase() === sanitizedEmail.toLowerCase()) {
          Alert.alert("Error", "Recovery email must be different from your primary email.")
          return
        }
      }

      const success = await register(sanitizedEmail, password, firstName.trim(), lastName.trim(), role, sanitizedRecoveryEmail)
      if (success) {
        navigation.navigate('Verification', { email: sanitizedEmail })
      } else {
        setMessage("Registration failed. Please try again.")
        setMessageType("error")
      }
    }
  }

  const handleForgotPasswordSubmit = async () => {
    if (forgotPasswordStep === 1) {
      if (!forgotPasswordEmail.trim()) {
        Alert.alert("Error", "Please enter your email address.")
        return
      }

      const emailToUse = forgotPasswordEmail.trim()
      const success = await sendVerificationCode(emailToUse)
      if (success) {
        setForgotPasswordStep(2)
      }
    } else if (forgotPasswordStep === 2) {
      if (!forgotPasswordCode.trim() || !newPassword.trim()) {
        Alert.alert("Error", "Please enter the code and new password.")
        return
      }

      if (newPassword.length < 6) {
        Alert.alert("Error", "Password must be at least 6 characters long.")
        return
      }

      const emailToUse = forgotPasswordEmail.trim()
      const success = await resetPasswordWithCode(emailToUse, forgotPasswordCode, newPassword)
      if (success) {
        Alert.alert("Success", "Your password has been reset successfully. You can now log in with your new password.")
        setShowForgotPasswordModal(false)
        setForgotPasswordEmail("")
        setForgotPasswordCode("")
        setNewPassword("")
        setForgotPasswordStep(1)
        setUseRecoveryEmail(false)
        setShowNewPassword(false)
      }
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollViewContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.primary }]}>{isLogin ? "Coby Picks" : "Create your account"}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {isLogin ? "Sign in to continue" : "Create an account to get started"}
          </Text>

          <View style={styles.form}>
            {!isLogin && (
              <>
                <Text style={[styles.inputLabel, { color: theme.text }]}>First name *</Text>
                <View style={[styles.inputWrapper, styles.inputElevated, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <Ionicons name="person-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.inputBare, { color: theme.text }]}
                    placeholder="Enter your first name"
                    placeholderTextColor={theme.textSecondary}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Last name *</Text>
                <View style={[styles.inputWrapper, styles.inputElevated, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <Ionicons name="person-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.inputBare, { color: theme.text }]}
                    placeholder="Enter your last name"
                    placeholderTextColor={theme.textSecondary}
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Recovery email (optional)</Text>
                <View style={[styles.inputWrapper, styles.inputElevated, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <Ionicons name="mail-open-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.inputBare, { color: theme.text }]}
                    placeholder="Enter a recovery email (different from primary)"
                    placeholderTextColor={theme.textSecondary}
                    value={recoveryEmail}
                    onChangeText={setRecoveryEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </>
            )}
            <Text style={[styles.inputLabel, { color: theme.text }]}>Email Address *</Text>
            <View style={[styles.inputWrapper, styles.inputElevated, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Ionicons name="mail-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.inputBare, { color: theme.text }]}
                placeholder="Enter your email address"
                placeholderTextColor={theme.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Password *</Text>
            <View style={[styles.inputWrapper, styles.inputElevated, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.inputBare, { color: theme.text }]}
                placeholder="Enter your password"
                placeholderTextColor={theme.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)} accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {!isLogin && (
              <View style={[styles.privacyAgreementContainer, !privacyAgreed && { borderColor: '#EF476F', backgroundColor: 'rgba(239, 71, 111, 0.05)' }]}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setPrivacyAgreed(!privacyAgreed)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, privacyAgreed && { backgroundColor: theme.primary, borderColor: theme.primary }, !privacyAgreed && { borderColor: '#EF476F' }]}>
                    {privacyAgreed && <Ionicons name="checkmark" size={16} color={theme.surface} />}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                    I agree to the{' '}
                    <Text style={[styles.linkText, { color: theme.primary }]}>
                      Data Privacy Policy
                    </Text>
                    {' '}and understand how my data will be used.
                  </Text>
                </TouchableOpacity>
                {!privacyAgreed && <Text style={[styles.privacyError, { color: '#EF476F' }]}>✓ Required to continue</Text>}
                <Text style={[styles.privacyDetails, { color: theme.textSecondary, marginTop: privacyAgreed ? 12 : 8 }]}>
                  Your data is used only for the activities you join. We prioritize your privacy and data security.
                </Text>
              </View>
            )}

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

            <TouchableOpacity
              style={[styles.button, styles.primaryButtonShadow, { backgroundColor: theme.primary, opacity: isLoading || (!isLogin && !privacyAgreed) ? 0.6 : 1 }]}
              onPress={handleAuth}
              disabled={isLoading || (!isLogin && !privacyAgreed)}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={theme.surface} />
              ) : (
                <Text style={[styles.buttonText, { color: theme.surface }]}>{isLogin ? "Log In" : "Sign Up"}</Text>
              )}
            </TouchableOpacity>

            {isLogin && (
              <TouchableOpacity style={styles.forgotPasswordButton} onPress={() => setShowForgotPasswordModal(true)}>
                <Text style={[styles.forgotPasswordText, { color: theme.primary }]}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.toggleButton} onPress={() => setIsLogin(!isLogin)}>
              <Text style={[styles.toggleText, { color: theme.primary }]}>
                {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showForgotPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowForgotPasswordModal(false)
          setForgotPasswordStep(1)
          setForgotPasswordEmail("")
          setForgotPasswordCode("")
          setNewPassword("")
          setUseRecoveryEmail(false)
          setShowNewPassword(false)
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.modalElevated, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.primary }]}>
              {forgotPasswordStep === 1 ? "Reset Password" : "Enter Code & New Password"}
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {forgotPasswordStep === 1
                ? "Enter your email address to receive a password reset code."
                : "Enter the code sent to your email and your new password."
              }
            </Text>

            {forgotPasswordStep === 1 && (
              <>
                <View style={styles.emailTypeSelector}>
                  <TouchableOpacity
                    style={[styles.emailTypeButton, !useRecoveryEmail && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    onPress={() => setUseRecoveryEmail(false)}
                  >
                    <Text style={[styles.emailTypeText, !useRecoveryEmail && { color: theme.surface }]}>Primary Email</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.emailTypeButton, useRecoveryEmail && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    onPress={() => setUseRecoveryEmail(true)}
                  >
                    <Text style={[styles.emailTypeText, useRecoveryEmail && { color: theme.surface }]}>Recovery Email</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Email Address *</Text>
                <View style={[styles.inputWrapper, styles.inputElevated, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <Ionicons name="mail-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.inputBare, { color: theme.text }]}
                    placeholder={`Enter your ${useRecoveryEmail ? 'recovery' : 'primary'} email address`}
                    placeholderTextColor={theme.textSecondary}
                    value={forgotPasswordEmail}
                    onChangeText={setForgotPasswordEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </>
            )}

            {forgotPasswordStep === 2 && (
              <>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Verification Code *</Text>
                <View style={[styles.inputWrapper, styles.inputElevated, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <Ionicons name="key-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.inputBare, { color: theme.text }]}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor={theme.textSecondary}
                    value={forgotPasswordCode}
                    onChangeText={setForgotPasswordCode}
                    keyboardType="numeric"
                    maxLength={6}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <Text style={[styles.inputLabel, { color: theme.text }]}>New Password *</Text>
                <View style={[styles.inputWrapper, styles.inputElevated, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.inputBare, { color: theme.text }]}
                    placeholder="Enter new password (min 6 characters)"
                    placeholderTextColor={theme.textSecondary}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword((prev) => !prev)} accessibilityRole="button" accessibilityLabel={showNewPassword ? "Hide password" : "Show password"}>
                    <Ionicons name={showNewPassword ? "eye-off-outline" : "eye-outline"} size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.button, styles.primaryButtonShadow, { backgroundColor: theme.primary }]}
              onPress={handleForgotPasswordSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={theme.surface} />
              ) : (
                <Text style={[styles.buttonText, { color: theme.surface }]}>
                  {forgotPasswordStep === 1 ? "Send Reset Code" : "Reset Password"}
                </Text>
              )}
            </TouchableOpacity>

            {forgotPasswordStep === 2 && (
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => {
                  setForgotPasswordStep(1)
                  setForgotPasswordCode("")
                  setNewPassword("")
                  setShowNewPassword(false)
                }}
              >
                <Text style={[styles.toggleText, { color: theme.primary }]}>Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => {
                setShowForgotPasswordModal(false)
                setForgotPasswordStep(1)
                setForgotPasswordEmail("")
                setForgotPasswordCode("")
                setNewPassword("")
                setUseRecoveryEmail(false)
                setShowNewPassword(false)
              }}
            >
              <Text style={[styles.toggleText, { color: theme.primary }]}>Cancel</Text>
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
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: Dimensions.get('window').height,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 450,
    alignSelf: 'center',
    paddingHorizontal: Dimensions.get('window').width < 380 ? 12 : 16,
    paddingTop: Platform.OS === 'web' ? 32 : 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: Dimensions.get('window').width < 380 ? 28 : 32,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: Dimensions.get('window').width < 380 ? 15 : 17,
    marginBottom: 32,
    textAlign: "center",
  },
  form: {
    width: "100%",
  },
  inputLabel: {
    fontSize: Dimensions.get('window').width < 380 ? 13 : 14,
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
    marginBottom: Dimensions.get('window').width < 380 ? 14 : 18,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputBare: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '400',
    backgroundColor: 'transparent',
  },
  inputElevated: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  privacyAgreementContainer: {
    marginBottom: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 5,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 0,
    minWidth: 22,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: Dimensions.get('window').width < 380 ? 13 : 14,
    lineHeight: 21,
  },
  linkText: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  privacyError: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    marginLeft: 34,
  },
  privacyDetails: {
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  messageContainer: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    alignItems: "center",
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
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    marginBottom: 22,
    minHeight: 54,
  },
  primaryButtonShadow: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  buttonText: {
    fontSize: 19,
    fontWeight: "700",
  },
  toggleButton: {
    paddingVertical: 10,
  },
  toggleText: {
    fontSize: 16,
    textAlign: "center",
    fontWeight: "500",
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginBottom: 15,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
  },
  modalElevated: {
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 15,
    marginBottom: 30,
    textAlign: "center",
  },
  emailTypeSelector: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
    gap: 10,
  },
  emailTypeButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  emailTypeText: {
    fontSize: 14,
    fontWeight: "600",
  },
})

export default AuthScreen
