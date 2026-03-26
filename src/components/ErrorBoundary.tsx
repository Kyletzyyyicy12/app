import React, { Component, ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: any
}

class ErrorBoundaryClass extends Component<Props & { theme: any }, State> {
  constructor(props: Props & { theme: any }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ error, errorInfo })

    // In production, you might want to send this to an error reporting service
    // Example: Sentry.captureException(error)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  handleReportError = () => {
    const { error, errorInfo } = this.state
    const errorMessage = `
Error: ${error?.message || 'Unknown error'}
Stack: ${error?.stack || 'No stack trace'}
Component Stack: ${errorInfo?.componentStack || 'No component stack'}
    `.trim()

    Alert.alert(
      'Error Report',
      'Would you like to copy this error information?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy',
          onPress: () => {
            // In a real app, you might use Clipboard.setString(errorMessage)
            console.log('Error copied to console:', errorMessage)
            Alert.alert('Error Copied', 'Error information has been copied to console.')
          }
        }
      ]
    )
  }

  render() {
    const { theme } = this.props

    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={styles.errorContainer}>
            <Ionicons
              name="warning"
              size={64}
              color={theme.error}
              style={styles.errorIcon}
            />
            <Text style={[styles.errorTitle, { color: theme.text }]}>
              Oops! Something went wrong
            </Text>
            <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>
              An unexpected error occurred. Please try restarting the app.
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                onPress={this.handleReset}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={20} color={theme.onPrimary} />
                <Text style={[styles.buttonText, { color: theme.onPrimary }]}>
                  Try Again
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, {
                  backgroundColor: 'transparent',
                  borderColor: theme.border,
                  borderWidth: 1
                }]}
                onPress={this.handleReportError}
                activeOpacity={0.8}
              >
                <Ionicons name="bug" size={20} color={theme.textSecondary} />
                <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>
                  Report Error
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )
    }

    return this.props.children
  }
}

// Wrapper component to use theme hook
const ErrorBoundary: React.FC<Props> = (props) => {
  const { theme } = useTheme()
  return <ErrorBoundaryClass {...props} theme={theme} />
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    alignItems: 'center',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
})

export default ErrorBoundary
