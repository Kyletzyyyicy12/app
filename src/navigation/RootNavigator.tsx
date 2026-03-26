import React from "react"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { useAuth } from "../contexts/AuthContext"
import LoadingScreen from "../screens/LoadingScreen"
import AuthScreen from "../screens/AuthScreen"
import VerificationScreen from "../screens/VerificationScreen"
import RoleSelectionScreen from "../screens/RoleSelectionScreen"
import MainNavigator from "./MainNavigator"

export type RootStackParamList = {
  Auth: undefined
  Verification: { email: string }
  RoleSelection: undefined
  Main: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

const RootNavigator: React.FC = () => {
  const { currentUser, userProfile, authLoading } = useAuth()

  // Note: Removed forced logout to allow proper loading screen display
  // Users will remain logged in between sessions unless they manually logout

  if (authLoading || (currentUser && !userProfile)) {
    return <LoadingScreen />
  }

  const initialRoute = currentUser
    ? (userProfile?.role ? "Main" : "RoleSelection")
    : "Auth"

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
      {currentUser ? (
        <>
          <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
          <Stack.Screen name="Main" component={MainNavigator} />
        </>
      ) : (
        <>
          <Stack.Screen name="Auth" component={AuthScreen} />
          <Stack.Screen name="Verification" component={VerificationScreen} />
        </>
      )}
    </Stack.Navigator>
  )
}

export default RootNavigator
