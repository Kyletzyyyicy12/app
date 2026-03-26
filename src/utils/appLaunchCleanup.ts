// App Launch Cleanup Utility
// This utility ensures fresh authentication state when the app is launched or QR code is scanned

import AsyncStorage from '@react-native-async-storage/async-storage'
import { signOut } from 'firebase/auth'
import { auth } from '../config/firebaseConfig'

// Check if we're in development mode
const isDevelopment = __DEV__

export interface AppLaunchConfig {
  clearCache: boolean
  signOutExistingUsers: boolean
  showWelcomeMessage: boolean
  enableInProduction?: boolean // Allow disabling in production
}

export const defaultLaunchConfig: AppLaunchConfig = {
  clearCache: true,
  signOutExistingUsers: true,
  showWelcomeMessage: true,
  enableInProduction: false, // Disabled in production by default
}

/**
 * Performs app launch cleanup to ensure fresh authentication state
 * @param config Configuration options for cleanup behavior
 */
export const performAppLaunchCleanup = async (config: AppLaunchConfig = defaultLaunchConfig): Promise<void> => {
  // Skip in production unless explicitly enabled
  if (!isDevelopment && !config.enableInProduction) {
    console.log('ℹ️ Auto-logout disabled in production build')
    return
  }
  
  console.log('🚀 Performing app launch cleanup for fresh authentication...')
  
  const startTime = Date.now()
  const cleanupTasks: Promise<any>[] = []
  
  try {
    // Task 1: Sign out existing Firebase users
    if (config.signOutExistingUsers) {
      cleanupTasks.push(
        signOut(auth)
          .then(() => console.log('✅ Firebase signOut completed'))
          .catch((error) => console.log('ℹ️ Firebase signOut skipped (no user was signed in):', error.message))
      )
    }
    
    // Task 2: Clear authentication-related cache
    if (config.clearCache) {
      cleanupTasks.push(
        clearAuthCache()
          .then(() => console.log('✅ Authentication cache cleared'))
          .catch((error) => console.log('⚠️ Cache clearing failed:', error.message))
      )
    }
    
    // Wait for all cleanup tasks to complete
    await Promise.allSettled(cleanupTasks)
    
    const duration = Date.now() - startTime
    console.log(`🎉 App launch cleanup completed in ${duration}ms`)
    
    // Optional: Show welcome message to user
    if (config.showWelcomeMessage) {
      console.log('📱 App is ready for fresh authentication')
    }
    
  } catch (error) {
    console.error('❌ App launch cleanup failed:', error)
  }
}

/**
 * Clears authentication-related data from AsyncStorage while preserving user profiles
 * STRATEGY: Clear auth tokens and sessions but preserve user profile data (including roles)
 */
const clearAuthCache = async (): Promise<void> => {
  try {
    // Get all stored keys
    const allKeys = await AsyncStorage.getAllKeys()
    
    // Identify authentication-related keys but PRESERVE user profiles
    const authKeys = allKeys.filter(key => 
      (key.includes('auth') ||
       key.includes('firebase') ||
       key.includes('session') ||
       key.includes('token') ||
       key.includes('login') ||
       key.includes('credential')) &&
      !key.startsWith('userProfile:') && // PRESERVE: User profiles contain role data
      !key.includes('user') // PRESERVE: Other user data
    )
    
    if (authKeys.length > 0) {
      await AsyncStorage.multiRemove(authKeys)
      console.log(`🗑️ Cleared ${authKeys.length} authentication cache items:`, authKeys)
    } else {
      console.log('ℹ️ No authentication cache found to clear')
    }
    
  } catch (error) {
    console.error('❌ Failed to clear authentication cache:', error)
    throw error
  }
}

/**
 * Validates that cleanup was successful
 */
export const validateCleanupSuccess = async (): Promise<boolean> => {
  try {
    // Check Firebase auth state
    const currentUser = auth.currentUser
    if (currentUser) {
      console.log('⚠️ Cleanup validation failed: User still signed in')
      return false
    }
    
    // Check for remaining auth cache (but allow user profiles)
    const allKeys = await AsyncStorage.getAllKeys()
    const remainingAuthKeys = allKeys.filter(key => 
      (key.includes('auth') ||
       key.includes('firebase') ||
       key.includes('token') ||
       key.includes('session')) &&
      !key.startsWith('userProfile:') && // Allow: User profiles should remain
      !key.includes('user') // Allow: Other user data should remain
    )
    
    if (remainingAuthKeys.length > 0) {
      console.log('⚠️ Cleanup validation warning: Some auth cache remains:', remainingAuthKeys)
    }
    
    console.log('✅ Cleanup validation passed: App is ready for fresh authentication')
    return true
    
  } catch (error) {
    console.error('❌ Cleanup validation failed:', error)
    return false
  }
}

/**
 * Emergency cleanup function for debugging
 */
export const emergencyCleanup = async (): Promise<void> => {
  console.log('🚨 Performing emergency cleanup...')
  
  try {
    // Force sign out
    await signOut(auth)
    
    // Clear ALL AsyncStorage data (use with caution)
    await AsyncStorage.clear()
    
    console.log('🚨 Emergency cleanup completed - ALL data cleared')
    
  } catch (error) {
    console.error('❌ Emergency cleanup failed:', error)
  }
}

// Export for development/debugging
export const debugCleanupInfo = async (): Promise<void> => {
  console.log('🔍 Debug: Current authentication state...')
  
  try {
    // Check Firebase auth
    const currentUser = auth.currentUser
    console.log('Firebase User:', currentUser ? `${currentUser.uid} (${currentUser.email})` : 'None')
    
    // Check AsyncStorage keys (excluding preserved user data)
    const allKeys = await AsyncStorage.getAllKeys()
    const authKeys = allKeys.filter(key => 
      (key.includes('auth') ||
       key.includes('firebase') ||
       key.includes('token')) &&
      !key.startsWith('userProfile:') // Exclude: User profiles are preserved
    )
    
    console.log('AsyncStorage auth keys:', authKeys.length, authKeys)
    
    // Get values for auth keys (first 3 only to avoid spam)
    for (const key of authKeys.slice(0, 3)) {
      try {
        const value = await AsyncStorage.getItem(key)
        console.log(`  ${key}:`, value ? value.substring(0, 100) + '...' : 'null')
      } catch (e) {
        console.log(`  ${key}: Error reading`)
      }
    }
    
  } catch (error) {
    console.error('❌ Debug info failed:', error)
  }
}