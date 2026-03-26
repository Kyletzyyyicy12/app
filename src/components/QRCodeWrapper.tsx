import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Simple QR code placeholder for web compatibility
const QRCodeWrapper = ({ value, size = 180, ...props }: { value: string; size?: number; [key: string]: any }) => {
  // For now, we'll show a placeholder since react-native-qrcode-svg has compatibility issues
  // In a production app, you might want to use a web-compatible QR code library
  
  return (
    <View 
      style={[
        styles.qrPlaceholder, 
        { 
          width: size, 
          height: size 
        }
      ]} 
      {...props}
    >
      <Text style={styles.qrText}>QR Code</Text>
      <Text style={styles.qrValue} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  qrPlaceholder: {
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  qrText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  qrValue: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
});

export default QRCodeWrapper;
