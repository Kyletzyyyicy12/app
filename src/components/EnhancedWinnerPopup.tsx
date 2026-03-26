import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image as RNImage,
  Animated
} from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Winner {
  id: string;
  name: string;
  image?: {
    url: string;
    alt?: string;
  };
  color?: string;
}

interface EnhancedWinnerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  winners: Winner[];
  wheelType?: "image-picker" | "regular";
  showConfetti?: boolean;
  autoClose?: number;
  theme?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  imageSize?: "sm" | "md" | "lg" | "xl";
  customTitle?: string;
  customWinnerMessage?: string;
  customWinnerWord?: string;
  congratsMessage?: string;
}

export const EnhancedWinnerPopup: React.FC<EnhancedWinnerPopupProps> = ({
  isOpen,
  onClose,
  winners,
  wheelType = "regular",
  showConfetti = true,
  autoClose = 0,
  theme = { primary: "#8e0b16", secondary: "#66181E", accent: "#ffffff" },
  imageSize = "xl",
  customTitle = "",
  customWinnerMessage = "",
  customWinnerWord = "WINNER",
  congratsMessage = "🎉 Selected! 🎉"
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    if (isOpen) {
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto close if specified
      if (autoClose > 0) {
        const timer = setTimeout(() => {
          onClose();
        }, autoClose * 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, autoClose]);

  useEffect(() => {
    if (!isOpen) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [isOpen]);

  if (!isOpen || winners.length === 0) return null;

  const isImagePicker = wheelType === "image-picker";
  const winner = winners[0];

  // Determine image size
  const getImageSize = () => {
    switch (imageSize) {
      case "sm": return { width: 120, height: 120 };
      case "md": return { width: 160, height: 160 };
      case "lg": return { width: 200, height: 200 };
      case "xl": return { width: 220, height: 220 };
      default: return { width: 160, height: 160 };
    }
  };

  const imageDimensions = getImageSize();

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.primary }]}>
            <Text style={styles.title}>
              {customTitle || `${customWinnerWord}`}
            </Text>
          </View>

          {/* Winner Content */}
          <View style={styles.content}>
            {/* Winner Image */}
            {winner.image?.url && (
              <View style={styles.imageContainer}>
                <RNImage
                  source={{ uri: winner.image.url }}
                  style={[
                    styles.winnerImage,
                    imageDimensions,
                    { borderColor: theme.accent }
                  ]}
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Winner Text */}
            <View style={styles.winnerInfo}>
              <Text style={[styles.winnerName, { color: theme.primary }]}>
                {winner.name}
              </Text>
              <Text style={[styles.selectedText, { color: theme.primary }]}>
                SELECTED
              </Text>
            </View>

            {/* Congratulations Message */}
            <View style={[styles.messageContainer, { backgroundColor: `${theme.primary}10` }]}>
              <Text style={[styles.congratsMessage, { color: theme.primary }]}>
                {congratsMessage}
              </Text>
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.primary }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={[styles.closeButtonText, { color: theme.accent }]}>
                Awesome!
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  imageContainer: {
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  winnerImage: {
    borderRadius: 15,
    borderWidth: 4,
  },
  winnerInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  winnerName: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  selectedText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  messageContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  congratsMessage: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EnhancedWinnerPopup;
