import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'

interface AccessibilityIssue {
  id: string
  type: 'error' | 'warning' | 'info'
  message: string
  suggestion: string
  element?: string
  impact: 'minor' | 'moderate' | 'serious' | 'critical'
}

interface AccessibilityCheckerProps {
  children: React.ReactNode
  enableA11yCheck?: boolean
  showA11yPanel?: boolean
  componentName?: string
}

const AccessibilityChecker: React.FC<AccessibilityCheckerProps> = ({
  children,
  enableA11yCheck = true,
  showA11yPanel = false,
  componentName = 'Component'
}) => {
  const { theme } = useTheme()
  const [issues, setIssues] = useState<AccessibilityIssue[]>([])
  const [showPanel, setShowPanel] = useState(showA11yPanel)
  const [scanCount, setScanCount] = useState(0)

  // Common accessibility checks
  const runAccessibilityChecks = () => {
    const newIssues: AccessibilityIssue[] = []

    // Check for minimum touch targets
    newIssues.push({
      id: 'touch-target-size',
      type: 'warning',
      message: 'Ensure all touchable elements have minimum 44x44px size',
      suggestion: 'Use TouchableOpacity with proper padding and minHeight: 44',
      impact: 'moderate'
    })

    // Check for color contrast (this would need actual color analysis)
    newIssues.push({
      id: 'color-contrast',
      type: 'info',
      message: 'Verify text has sufficient contrast against background',
      suggestion: 'Aim for WCAG AA compliance (4.5:1 ratio for normal text)',
      impact: 'serious'
    })

    // Check for screen reader compatibility
    newIssues.push({
      id: 'screen-reader',
      type: 'warning',
      message: 'Consider adding accessibilityLabel for screen readers',
      suggestion: 'Add accessibilityLabel prop to interactive elements',
      impact: 'moderate'
    })

    // Check for keyboard navigation
    newIssues.push({
      id: 'keyboard-navigation',
      type: 'info',
      message: 'Ensure all functionality is accessible via keyboard',
      suggestion: 'Test with keyboard-only navigation',
      impact: 'minor'
    })

    // Check for focus management
    newIssues.push({
      id: 'focus-management',
      type: 'warning',
      message: 'Manage focus order and provide visible focus indicators',
      suggestion: 'Use accessibilityRole and accessibilityState props',
      impact: 'moderate'
    })

    // Check for heading hierarchy (if applicable)
    newIssues.push({
      id: 'heading-hierarchy',
      type: 'info',
      message: 'Use proper heading hierarchy for screen readers',
      suggestion: 'Implement accessibilityRole="header" for headings',
      impact: 'minor'
    })

    // Check for error announcements
    newIssues.push({
      id: 'error-announcements',
      type: 'warning',
      message: 'Announce errors and validation messages to screen readers',
      suggestion: 'Use AccessibilityInfo.announceForAccessibility()',
      impact: 'serious'
    })

    // Check for loading states
    newIssues.push({
      id: 'loading-states',
      type: 'info',
      message: 'Communicate loading states to assistive technologies',
      suggestion: 'Add accessibilityState={{ busy: isLoading }}',
      impact: 'moderate'
    })

    setIssues(newIssues)
    setScanCount(prev => prev + 1)
  }

  useEffect(() => {
    if (enableA11yCheck) {
      runAccessibilityChecks()
    }
  }, [enableA11yCheck, componentName])

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return '#d32f2f'
      case 'serious': return '#f57c00'
      case 'moderate': return '#fbc02d'
      case 'minor': return '#388e3c'
      default: return theme.textSecondary
    }
  }

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'critical': return 'close-circle'
      case 'serious': return 'warning'
      case 'moderate': return 'information-circle'
      case 'minor': return 'checkmark-circle'
      default: return 'help-circle'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'error': return '#d32f2f'
      case 'warning': return '#f57c00'
      case 'info': return '#1976d2'
      default: return theme.textSecondary
    }
  }

  const runQuickScan = () => {
    Alert.alert(
      'Accessibility Scan',
      `Found ${issues.length} accessibility considerations for ${componentName}`,
      [
        { text: 'OK' },
        { text: 'Detailed Report', onPress: () => setShowPanel(true) }
      ]
    )
  }

  if (!enableA11yCheck) {
    return <>{children}</>
  }

  return (
    <View style={styles.container}>
      {showPanel && (
        <View style={[styles.a11yPanel, { backgroundColor: theme.surface }]}>
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitle, { color: theme.text }]}>
              ♿ Accessibility Report
            </Text>
            <View style={styles.panelActions}>
              <TouchableOpacity
                style={[styles.panelButton, { backgroundColor: theme.primary }]}
                onPress={runAccessibilityChecks}
              >
                <Ionicons name="refresh" size={16} color={theme.surface} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.panelButton, { backgroundColor: theme.error }]}
                onPress={() => setShowPanel(false)}
              >
                <Ionicons name="close" size={16} color={theme.surface} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.panelSubtitle, { color: theme.textSecondary }]}>
            {componentName} • Scan #{scanCount}
          </Text>

          <ScrollView style={styles.issuesList} showsVerticalScrollIndicator={false}>
            {issues.map((issue) => (
              <View key={issue.id} style={[styles.issueItem, {
                borderLeftColor: getImpactColor(issue.impact),
                borderLeftWidth: 4
              }]}>
                <View style={styles.issueHeader}>
                  <View style={styles.issueIconContainer}>
                    <Ionicons
                      name={getImpactIcon(issue.impact) as any}
                      size={20}
                      color={getImpactColor(issue.impact)}
                    />
                  </View>
                  <View style={styles.issueContent}>
                    <View style={styles.issueTitleRow}>
                      <Text style={[styles.issueTitle, { color: theme.text }]}>
                        {issue.message}
                      </Text>
                      <View style={[styles.issueBadge, {
                        backgroundColor: getTypeColor(issue.type)
                      }]}>
                        <Text style={styles.issueBadgeText}>
                          {issue.type.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.issueSuggestion, { color: theme.textSecondary }]}>
                      💡 {issue.suggestion}
                    </Text>
                    <Text style={[styles.issueImpact, {
                      color: getImpactColor(issue.impact)
                    }]}>
                      Impact: {issue.impact}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <TouchableOpacity
        style={[styles.a11yButton, { backgroundColor: theme.primary }]}
        onPress={runQuickScan}
        accessibilityLabel="Run accessibility scan"
      >
        <Ionicons name="accessibility" size={20} color={theme.surface} />
      </TouchableOpacity>

      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  a11yButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  a11yPanel: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 100,
    borderRadius: 12,
    padding: 16,
    zIndex: 999,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  panelSubtitle: {
    fontSize: 12,
    marginBottom: 16,
  },
  panelActions: {
    flexDirection: 'row',
    gap: 8,
  },
  panelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  issuesList: {
    flex: 1,
  },
  issueItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  issueIconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  issueContent: {
    flex: 1,
  },
  issueTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  issueTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  issueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  issueBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  issueSuggestion: {
    fontSize: 12,
    marginBottom: 4,
    lineHeight: 16,
  },
  issueImpact: {
    fontSize: 11,
    fontWeight: '600',
  },
})

export default AccessibilityChecker