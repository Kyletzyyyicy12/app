import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import type React from "react"
import { Ionicons } from "@expo/vector-icons"
import EditWheelScreen from "../screens/EditWheelScreen"
import HomeScreen from "../screens/HomeScreen"
import HistoryScreen from "../screens/HistoryScreen"
import SpinDetailsScreen from "../screens/SpinDetailsScreen"
import WheelScreen from "../screens/WheelScreen"
import JoinLiveDrawScreen from "../screens/JoinLiveDrawScreen"
import WheelCategoryScreen from "../screens/WheelCategoryScreen"
import SavedWheelsScreen from "../screens/SavedWheelsScreen"
import SettingsScreen from "../screens/SettingsScreen"
import CustomizeThemeScreen from "../screens/CustomizeThemeScreen"
import WebLiveRoomScreen from "../screens/WebLiveRoomScreen"
import LiveRoomViewerScreen from "../screens/LiveRoomViewerScreen"
import OrganizerLiveRoomScreen from "../screens/OrganizerLiveRoomScreen"
import TeamPickerScreen from "../screens/TeamPickerScreen"
import { useAuth } from "../contexts/AuthContext"
import { Platform } from "react-native"

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

// Stack Navigator for the Home Tab
const HomeStack: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Wheel" component={WheelScreen} />
      <Stack.Screen name="WheelCategory" component={WheelCategoryScreen} />
      <Stack.Screen name="SavedWheels" component={SavedWheelsScreen} />
      <Stack.Screen name="EditWheel" component={EditWheelScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="SpinDetails" component={SpinDetailsScreen} />
      <Stack.Screen name="TeamPicker" component={TeamPickerScreen} />
      <Stack.Screen
        name="JoinLiveDraw"
        component={JoinLiveDrawScreen}
        options={{ headerShown: true, title: "Join Live Draw" }}
      />
      <Stack.Screen
        name="WebLiveRoom"
        component={WebLiveRoomScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LiveRoomViewer"
        component={LiveRoomViewerScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="OrganizerLiveRoom"
        component={OrganizerLiveRoomScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  )
}

// Stack Navigator for the Settings Tab
const SettingsStack: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="CustomizeTheme" component={CustomizeThemeScreen} />
    </Stack.Navigator>
  )
}



// Stack Navigator for the Join Draw Tab (Students)
const JoinDrawStack: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JoinDraw" component={JoinLiveDrawScreen} />
    </Stack.Navigator>
  )
}

// Stack Navigator for the Live Room Tab (Organizers)
const OrganizerLiveRoomStack: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OrganizerLiveRoom" component={OrganizerLiveRoomScreen} />
    </Stack.Navigator>
  )
}

// Tab Navigator with Role-Based Navigation
const TabNavigator: React.FC = () => {
  const { userProfile } = useAuth()

  // Get user role
  const getUserRole = () => {
    return userProfile?.role?.toLowerCase() || 'participant'
  }

  const role = getUserRole()

  // Always land on the Home tab after login or role switch; role still controls available tabs
  const initialTab = 'HomeTab'

  return (
    <>
      <Tab.Navigator
        key={role}
        initialRouteName={initialTab}
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap

            if (route.name === 'HomeTab') {
              iconName = focused ? 'home' : 'home-outline'
            } else if (route.name === 'LiveRoomTab') {
              iconName = focused ? 'radio' : 'radio-outline'
            } else if (route.name === 'JoinDrawTab') {
              iconName = focused ? 'radio' : 'radio-outline'
            } else if (route.name === 'SettingsTab') {
              iconName = focused ? 'settings' : 'settings-outline'
            } else {
              iconName = 'help-outline'
            }

            return <Ionicons name={iconName} size={size} color={color} />
          },
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: '#CCCCCC',
          tabBarStyle: {
            backgroundColor: '#65171D',
            borderTopColor: '#65171D',
          },
          headerShown: false,
        })}
      >
        {/* Home tab - available to all roles */}
        <Tab.Screen
          name="HomeTab"
          component={HomeStack}
          options={{ title: 'Home' }}
        />

        {/* Live Room tab - for organizers */}
        {(role === 'organizer' || role === 'admin' || role === 'teacher') && (
          <Tab.Screen
            name="LiveRoomTab"
            component={OrganizerLiveRoomStack}
            options={{ title: 'Live Room' }}
          />
        )}

        {/* Join Draw tab - only for participants */}
        {role === 'participant' && (
          <Tab.Screen
            name="JoinDrawTab"
            component={JoinDrawStack}
            options={{ title: 'Join Draw' }}
          />
        )}

        {/* Settings tab - available to all roles */}
        <Tab.Screen
          name="SettingsTab"
          component={SettingsStack}
          options={{ title: 'Settings' }}
        />
      </Tab.Navigator>
    </>
    )
}

const MainNavigator: React.FC = () => {
  return <TabNavigator />
}

export default MainNavigator
