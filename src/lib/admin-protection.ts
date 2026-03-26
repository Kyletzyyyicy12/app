// app/src/lib/admin-protection.ts
// Mobile Admin Account Protection System
// Ensures admin accounts are never deleted during data clearing operations

// Admin email that must be protected
const PROTECTED_ADMIN_EMAIL = 'admin@cobypicks.com'

// Check if an email is a hardcoded admin
const isHardcodedAdmin = (email: string | null | undefined): boolean => {
  if (!email) return false
  return email.toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase()
}

/**
 * Check if a user should be protected from deletion
 */
export const isProtectedAdmin = (email: string | null | undefined, uid?: string): boolean => {
  // Check by email
  if (email && isHardcodedAdmin(email)) {
    return true
  }
  
  return false
}

/**
 * Validate that a user can safely clear their data
 */
export const canClearUserData = (email: string | null | undefined): { canClear: boolean; reason?: string } => {
  if (isProtectedAdmin(email)) {
    return {
      canClear: false,
      reason: `Admin accounts cannot clear all data to maintain system access. Admin: ${email}`
    }
  }
  
  return { canClear: true }
}

/**
 * Admin account preservation during data clearing
 */
export const preserveAdminDuringClear = (currentUserEmail: string): { 
  shouldPreserve: boolean; 
  message?: string 
} => {
  if (isHardcodedAdmin(currentUserEmail)) {
    return {
      shouldPreserve: true,
      message: "Admin account data will be preserved during clearing to maintain system access."
    }
  }
  
  return { shouldPreserve: false }
}

/**
 * Get admin-safe data clearing instructions
 */
export const getAdminSafeDataClearingMessage = (userEmail: string): string => {
  if (isHardcodedAdmin(userEmail)) {
    return "As an admin, this will clear your wheel and participant data but preserve your admin account and essential system access."
  }
  
  return "This will remove all your wheels, participants, and settings from Firebase. This action cannot be undone."
}

export { PROTECTED_ADMIN_EMAIL, isHardcodedAdmin }