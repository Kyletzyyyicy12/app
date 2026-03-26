// Must be first for Expo Go gesture handler
import 'react-native-gesture-handler';

// Essential polyfills
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Set up Buffer if needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (global as any).Buffer === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ;(global as any).Buffer = require('buffer').Buffer
  } catch (e) {
    console.warn('Failed to load Buffer:', e)
  }
}

import { registerRootComponent } from 'expo'
import App from './App'

registerRootComponent(App)
