const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add any custom configuration here
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'expo-barcode-scanner': require.resolve('expo-barcode-scanner'),
};

module.exports = config;