import React from 'react'
import { NavigationContainer, DefaultTheme, LinkingOptions } from '@react-navigation/native'
import * as Linking from 'expo-linking'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './src/contexts/AuthContext'
import { ThemeProvider } from './src/contexts/ThemeContext'
import { NotificationProvider } from './src/contexts/NotificationContext'
import { CollaborativeLiveRoomProvider } from './src/contexts/CollaborativeLiveRoomContext'
import RootNavigator from './src/navigation/RootNavigator'
import CobyAssistant from './src/components/CobyAssistant'

export default function App() {

  const linking: LinkingOptions<ReactNavigation.RootParamList> = {
    prefixes: [Linking.createURL('/'), 'cobypicks://'],
    config: {
      screens: {
        Auth: 'auth',
        Main: {
          screens: {
            HomeTab: {
              screens: {
                JoinLiveDraw: 'join',
                LiveRoomViewer: 'live/:sessionId',
              },
            },
          },
        },
      },
    },
  }
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <CollaborativeLiveRoomProvider>
              <NavigationContainer theme={DefaultTheme} linking={linking}>
                <StatusBar style="auto" />
                <RootNavigator />
                {/* Global Coby assistant floating button */}
                <CobyAssistant />
              </NavigationContainer>
            </CollaborativeLiveRoomProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
