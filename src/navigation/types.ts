import type { NavigatorScreenParams } from "@react-navigation/native"

// Activity Item interface for navigation parameters - SINGLE SOURCE OF TRUTH
export interface ActivityItem {
  id: string
  type: 'spin' | 'wheel_created' | 'wheel_edited' | 'participant_added' | 'live_session_ended' | 'participant_joined' | 'participant_session_ended'
  title: string
  description: string
  timestamp: Date
  wheelName?: string
  winners: string[] // Always an array of strings, never undefined
}

// Home Stack params
export type HomeStackParamList = {
  Home: undefined
  Wheel: { wheelId: string }
  WheelCategory: undefined
  SavedWheels: undefined
  EditWheel: { wheelId: string }
  History: undefined
  SpinDetails: {
    activity: ActivityItem
    wheelName?: string
    winners?: string[]
    timestamp: Date
    description: string
  }
  TeamPicker: { wheelId: string }
  JoinLiveDraw: undefined
  WebLiveRoom: { roomCode: string }
  LiveRoomViewer: { sessionId: string; roomCode: string }
  OrganizerLiveRoom: { sessionId?: string }
}

// Settings Stack params
export type SettingsStackParamList = {
  Settings: undefined
  CustomizeTheme: undefined
}

// Join Draw Stack params
export type JoinDrawStackParamList = {
  JoinDraw: undefined
}

// Organizer Live Room Stack params
export type OrganizerLiveRoomStackParamList = {
  OrganizerLiveRoom: undefined
}

// Tab Navigator params
export type TabNavigatorParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>
  LiveRoomTab: NavigatorScreenParams<OrganizerLiveRoomStackParamList>
  JoinDrawTab: NavigatorScreenParams<JoinDrawStackParamList>
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>
}
