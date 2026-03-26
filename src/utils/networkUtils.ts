import NetInfo from '@react-native-community/netinfo'

export interface NetworkStatus {
  isConnected: boolean
  isInternetReachable: boolean | null
}

export async function checkNetworkConnectivity(): Promise<NetworkStatus> {
  const state = await NetInfo.fetch()
  return {
    isConnected: !!state.isConnected,
    isInternetReachable: state.isInternetReachable ?? null,
  }
}

export async function retryWithBackoff<T>(operation: () => Promise<T>, maxRetries = 3, baseDelayMs = 300): Promise<T> {
  let attempt = 0
  let lastError: unknown
  while (attempt <= maxRetries) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const delay = baseDelayMs * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
      attempt += 1
    }
  }
  throw lastError
}

export function getNetworkErrorMessage(error: any): string {
  const message = error?.message || String(error)
  if (/network/i.test(message)) return 'Network error. Please try again.'
  if (/timeout/i.test(message)) return 'Request timed out. Please try again.'
  return message
}
