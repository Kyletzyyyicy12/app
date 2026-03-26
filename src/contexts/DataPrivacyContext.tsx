import type React from "react"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore"
import { db } from "../config/firebaseConfig"
import { useAuth } from "./AuthContext"

interface DataPrivacyContextProps {
  consentGiven: boolean | null
  checkConsentStatus: () => Promise<void>
  giveConsent: () => Promise<void>
  revokeConsent: () => Promise<void>
  isLoading: boolean
}

const DataPrivacyContext = createContext<DataPrivacyContextProps>({
  consentGiven: null,
  checkConsentStatus: async () => {},
  giveConsent: async () => {},
  revokeConsent: async () => {},
  isLoading: true,
})

interface DataPrivacyProviderProps {
  children: ReactNode
}

export const DataPrivacyProvider: React.FC<DataPrivacyProviderProps> = ({ children }) => {
  const { currentUser, authLoading } = useAuth()
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkConsentStatus = async () => {
    if (!currentUser) {
      setConsentGiven(false)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    if (!db) {
      console.error("Firestore DB is not initialized in DataPrivacyContext. Cannot perform operation.")
      setConsentGiven(false)
      setIsLoading(false)
      return
    }

    try {
      const userDocRef = doc(db, "users", currentUser.uid)
      const userDocSnap = await getDoc(userDocRef)

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data()
        setConsentGiven(userData.dataPrivacyConsentGiven || false)
      } else {
        setConsentGiven(false)
      }
    } catch (error) {
      console.error("Error checking consent status:", error)
      setConsentGiven(false)
    } finally {
      setIsLoading(false)
    }
  }

  const giveConsent = async () => {
    if (!currentUser) {
      console.error("Cannot give consent because no user is signed in.")
      return
    }

    setIsLoading(true)
    if (!db) {
      console.error("Firestore DB is not initialized in DataPrivacyContext. Cannot perform operation.")
      setIsLoading(false)
      return
    }

    try {
      const userDocRef = doc(db, "users", currentUser.uid)

      // Check if document exists before updating
      const userDoc = await getDoc(userDocRef)

      if (userDoc.exists()) {
        await updateDoc(userDocRef, {
          dataPrivacyConsentGiven: true,
          consentDate: new Date().toISOString(),
        })
      } else {
        // SECURITY FIX: Do not infer role from email - this overwrites user's original selection!
        // Always default to participant for safety and let admin change if needed
        const defaultRole = "participant"

        // Create the document if it doesn't exist
        await setDoc(userDocRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          fullName: currentUser.displayName || currentUser.email?.split('@')[0] || "User",
          role: defaultRole,
          collaborators: [],
          dataPrivacyConsentGiven: true,
          consentDate: new Date().toISOString(),
          createdAt: new Date(),
        })
      }

      setConsentGiven(true)
    } catch (error) {
      console.error("Error giving consent:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const revokeConsent = async () => {
    if (!currentUser) {
      console.error("Cannot revoke consent because no user is signed in.")
      return
    }

    setIsLoading(true)
    if (!db) {
      console.error("Firestore DB is not initialized. Cannot revoke consent.")
      setIsLoading(false)
      return
    }
    try {
      const userDocRef = doc(db, "users", currentUser.uid)

      // Check if document exists before updating
      const userDoc = await getDoc(userDocRef)

      if (userDoc.exists()) {
        await updateDoc(userDocRef, {
          dataPrivacyConsentGiven: false,
          consentRevokedDate: new Date().toISOString(),
        })
      } else {
        // SECURITY FIX: Do not infer role from email - this overwrites user's original selection!
        // Always default to participant for safety and let admin change if needed
        const defaultRole = "participant"

        // Create the document if it doesn't exist (with consent revoked)
        await setDoc(userDocRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          fullName: currentUser.displayName || currentUser.email?.split('@')[0] || "User",
          role: defaultRole,
          collaborators: [],
          dataPrivacyConsentGiven: false,
          consentRevokedDate: new Date().toISOString(),
          createdAt: new Date(),
        })
      }

      setConsentGiven(false)
    } catch (error) {
      console.error("Error revoking consent:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) {
      checkConsentStatus()
    }
  }, [currentUser, authLoading])

  return (
    <DataPrivacyContext.Provider value={{ consentGiven, checkConsentStatus, giveConsent, revokeConsent, isLoading }}>
      {children}
    </DataPrivacyContext.Provider>
  )
}

export const useDataPrivacy = () => useContext(DataPrivacyContext)
