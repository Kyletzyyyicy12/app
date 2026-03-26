import React, { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useTheme } from '../contexts/ThemeContext'

interface PerformanceMetrics {
  renderCount: number
  averageRenderTime: number
  memoryUsage: number
  lastRenderTime: number
  componentName: string
  timestamp: Date
}

interface PerformanceMonitorProps {
  children: React.ReactNode
  componentName?: string
  enableLogging?: boolean
  showMetrics?: boolean
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  children,
  componentName = 'Unknown',
  enableLogging = false,
  showMetrics = false
}) => {
  const { theme } = useTheme()
  const renderCount = useRef(0)
  const renderTimes = useRef<number[]>([])
  const startTime = useRef(0)
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderCount: 0,
    averageRenderTime: 0,
    memoryUsage: 0,
    lastRenderTime: 0,
    componentName,
    timestamp: new Date()
  })
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    renderCount.current += 1
    const endTime = performance.now()
    const renderTime = startTime.current ? endTime - startTime.current : 0

    renderTimes.current.push(renderTime)

    // Keep only last 50 render times for average calculation
    if (renderTimes.current.length > 50) {
      renderTimes.current.shift()
    }

    const averageRenderTime = renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length

    const newMetrics: PerformanceMetrics = {
      renderCount: renderCount.current,
      averageRenderTime,
      memoryUsage: 0, // Will be populated by performance.memory if available
      lastRenderTime: renderTime,
      componentName,
      timestamp: new Date()
    }

    setMetrics(newMetrics)

    if (enableLogging) {
      console.log(`📊 ${componentName} Performance:`, {
        renderCount: renderCount.current,
        renderTime: `${renderTime.toFixed(2)}ms`,
        averageRenderTime: `${averageRenderTime.toFixed(2)}ms`,
        timestamp: new Date().toISOString()
      })
    }

    startTime.current = performance.now()
  })

  const getPerformanceColor = (avgTime: number) => {
    if (avgTime < 16) return theme.primary // Excellent performance
    if (avgTime < 33) return '#ff9800' // Good performance (orange)
    return theme.error // Poor performance
  }

  const resetMetrics = () => {
    renderCount.current = 0
    renderTimes.current = []
    setMetrics({
      renderCount: 0,
      averageRenderTime: 0,
      memoryUsage: 0,
      lastRenderTime: 0,
      componentName,
      timestamp: new Date()
    })
  }

  if (!showMetrics) {
    return <>{children}</>
  }

  return (
    <View style={styles.container}>
      {showDetails && (
        <View style={[styles.metricsContainer, { backgroundColor: theme.surface }]}>
          <View style={styles.metricsHeader}>
            <Text style={[styles.metricsTitle, { color: theme.text }]}>
              📊 {componentName} Performance
            </Text>
            <TouchableOpacity onPress={resetMetrics} style={styles.resetButton}>
              <Text style={[styles.resetButtonText, { color: theme.primary }]}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.metricsScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.metricRow}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Render Count:</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {metrics.renderCount}
              </Text>
            </View>

            <View style={styles.metricRow}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Last Render:</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {metrics.lastRenderTime.toFixed(2)}ms
              </Text>
            </View>

            <View style={styles.metricRow}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Average Render:</Text>
              <Text style={[styles.metricValue, {
                color: getPerformanceColor(metrics.averageRenderTime)
              }]}>
                {metrics.averageRenderTime.toFixed(2)}ms
              </Text>
            </View>

            <View style={styles.metricRow}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Performance:</Text>
              <Text style={[styles.metricValue, {
                color: getPerformanceColor(metrics.averageRenderTime)
              }]}>
                {metrics.averageRenderTime < 16 ? 'Excellent' :
                 metrics.averageRenderTime < 33 ? 'Good' : 'Needs Optimization'}
              </Text>
            </View>

            <View style={styles.metricRow}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Last Updated:</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {metrics.timestamp.toLocaleTimeString()}
              </Text>
            </View>
          </ScrollView>
        </View>
      )}

      <TouchableOpacity
        style={[styles.toggleButton, { backgroundColor: theme.primary }]}
        onPress={() => setShowDetails(!showDetails)}
      >
        <Text style={[styles.toggleButtonText, { color: theme.surface }]}>
          {showDetails ? 'Hide' : 'Show'} Metrics
        </Text>
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
  toggleButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  metricsContainer: {
    position: 'absolute',
    top: 50,
    right: 10,
    width: 250,
    maxHeight: 300,
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
  metricsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  metricsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  resetButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsScroll: {
    flex: 1,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  metricLabel: {
    fontSize: 12,
    flex: 1,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
})

export default PerformanceMonitor