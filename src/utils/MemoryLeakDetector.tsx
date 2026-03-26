import React, { Component, ReactNode } from 'react'
import { Alert } from 'react-native'

interface State {
  hasError: boolean
  error?: Error
}

interface Props {
  children: ReactNode
  componentName?: string
  onMemoryWarning?: () => void
}

class MemoryLeakDetector extends Component<Props, State> {
  private mounted = false
  private timers: NodeJS.Timeout[] = []
  private intervals: NodeJS.Timeout[] = []
  private eventListeners: (() => void)[] = []

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  componentDidMount() {
    this.mounted = true
    console.log(`🚀 ${this.props.componentName || 'Component'} mounted`)

    // Set up memory warning listener
    if (this.props.onMemoryWarning) {
      this.props.onMemoryWarning()
    }
  }

  componentWillUnmount() {
    this.mounted = false
    console.log(`🗑️ ${this.props.componentName || 'Component'} unmounting - cleaning up resources`)

    // Clear all timers
    this.timers.forEach(clearTimeout)
    this.timers = []

    // Clear all intervals
    this.intervals.forEach(clearInterval)
    this.intervals = []

    // Clean up event listeners
    this.eventListeners.forEach(cleanup => cleanup())
    this.eventListeners = []
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error(`❌ Error in ${this.props.componentName || 'Component'}:`, error, errorInfo)
    this.setState({ hasError: true, error })
  }

  // Utility method to safely set timeouts
  public setSafeTimeout = (callback: () => void, delay: number): NodeJS.Timeout => {
    const timer = setTimeout(() => {
      if (this.mounted) {
        callback()
      }
      // Remove from tracking
      this.timers = this.timers.filter(t => t !== timer)
    }, delay)

    this.timers.push(timer)
    return timer
  }

  // Utility method to safely set intervals
  public setSafeInterval = (callback: () => void, delay: number): NodeJS.Timeout => {
    const interval = setInterval(() => {
      if (this.mounted) {
        callback()
      }
    }, delay)

    this.intervals.push(interval)
    return interval
  }

  // Utility method to track event listeners for cleanup
  public addEventListenerCleanup = (cleanup: () => void): void => {
    this.eventListeners.push(cleanup)
  }

  // Method to check if component is still mounted
  public isMounted = (): boolean => {
    return this.mounted
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          backgroundColor: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '8px',
          margin: '10px'
        }}>
          <h3>🚨 Component Error Detected</h3>
          <p><strong>Component:</strong> {this.props.componentName || 'Unknown'}</p>
          <p><strong>Error:</strong> {this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Dismiss
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// HOC for easier usage
export function withMemoryLeakDetection<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  return function MemoryLeakProtectedComponent(props: P) {
    return (
      <MemoryLeakDetector componentName={componentName}>
        <Component {...props} />
      </MemoryLeakDetector>
    )
  }
}

export default MemoryLeakDetector