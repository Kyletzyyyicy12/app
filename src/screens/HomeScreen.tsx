import React from "react"
import { useAuth } from "../contexts/AuthContext"
import StudentHomeScreen from "./StudentHomeScreen"
import OrganizerHomeScreen from "./OrganizerHomeScreen"


const HomeScreen: React.FC = () => {
  const { userProfile } = useAuth()

  // Route to appropriate home screen based on user role
  const getUserRole = () => {
    return userProfile?.role?.toLowerCase() || 'participant'
  }

  const renderRoleBasedHome = () => {
    const role = getUserRole()

    switch (role) {
      case 'organizer':
        return <OrganizerHomeScreen />
      case 'participant':
      default:
        return <StudentHomeScreen />
    }
  }

  return renderRoleBasedHome()
}

export default HomeScreen
