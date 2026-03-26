import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Modern color palette - Maroon theme
const COLORS = {
  primary: '#8e0b16',
  primaryLight: '#b8424a',
  primaryDark: '#66181E',
  secondary: '#66181E',
  accent: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  surface: '#ffffff',
  surfaceSecondary: '#f8fafc',
  text: '#1e293b',
  textSecondary: '#64748b',
  textLight: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
};

// Available wheel types
const AVAILABLE_WHEEL_TYPES = [
  {
    id: 'team-picker',
    name: 'Team Picker Wheel',
    description: 'Generate random teams from a list of names',
    icon: '👥',
    color: '#2563eb',
    defaultItems: ['Team Alpha', 'Team Beta', 'Team Gamma', 'Team Delta'],
    isCustomizable: true,
    category: 'entertainment'
  },
  {
    id: 'yes-no-picker',
    name: 'Yes No Picker Wheel',
    description: 'Quick yes or no decisions made easy',
    icon: '❓',
    color: '#16a34a',
    defaultItems: ['Yes', 'No'],
    isCustomizable: false,
    category: 'personal'
  },
  {
    id: 'number-picker',
    name: 'Number Picker Wheel',
    description: 'Pick random numbers for games, draws, or decisions',
    icon: '🔢',
    color: '#dc2626',
    defaultItems: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    isCustomizable: true,
    category: 'academic'
  },
  {
    id: 'letter-picker',
    name: 'Letter Picker Wheel',
    description: 'Generate random letters from the alphabet',
    icon: '🔤',
    color: '#7c3aed',
    defaultItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
    isCustomizable: true,
    category: 'academic'
  }
];

// Available themes
const AVAILABLE_THEMES = [
  { id: 'school', name: 'School Colors', colors: ['#8e0b16', '#66181E'] },
  { id: 'rainbow', name: 'Rainbow', colors: ['#ff0080', '#00ff80', '#0080ff', '#ff8000', '#8000ff'] },
  { id: 'neon', name: 'Neon', colors: ['#39ff14', '#ff073a'] },
  { id: 'ocean', name: 'Ocean', colors: ['#0077be', '#00a8cc', '#00b4d8', '#48cae4', '#90e0ef'] },
  { id: 'sunset', name: 'Sunset', colors: ['#ff4500', '#ff6347', '#ff7f50', '#ffa500', '#ffb6c1'] },
  { id: 'purple', name: 'Purple Galaxy', colors: ['#9932cc', '#6a0dad', '#9370db', '#ba55d3', '#dda0dd'] },
  { id: 'forest', name: 'Forest', colors: ['#228b22', '#006400', '#32cd32', '#90ee90', '#98fb98'] },
  { id: 'pink', name: 'Hot Pink', colors: ['#ff1493', '#ff69b4', '#ffb6c1', '#ffc0cb', '#ffe4e1'] },
  { id: 'gold', name: 'Golden Luxury', colors: ['#ffd700', '#daa520', '#b8860b', '#f0e68c', '#fafad2'] },
  { id: 'cyber', name: 'Cyber Blue', colors: ['#00ffff', '#1e90ff', '#4169e1', '#0000ff', '#191970'] },
  { id: 'fireice', name: 'Fire & Ice', colors: ['#dc143c', '#4169e1', '#ff6347', '#87ceeb', '#ffffff'] },
  { id: 'lime', name: 'Lime Splash', colors: ['#32cd32', '#adff2f', '#7fff00', '#00ff00', '#90ee90'] },
  { id: 'dark', name: 'Midnight Dark', colors: ['#2c2c2c', '#4a4a4a', '#696969', '#808080', '#a9a9a9'] },
  { id: 'pastel', name: 'Cotton Candy', colors: ['#ffb6c1', '#dda0dd', '#b0e0e6', '#d1f2eb', '#f8cecc'] },
  { id: 'volcanic', name: 'Volcanic Orange', colors: ['#ff4500', '#ff8c00', '#ffa500', '#ffd700', '#ffff00'] },
  { id: 'arctic', name: 'Arctic Frost', colors: ['#b0e0e6', '#87ceeb', '#4682b4', '#4169e1', '#000080'] },
  { id: 'tropical', name: 'Tropical Sunset', colors: ['#ff7f50', '#ffa500', '#ffff00', '#adff2f', '#32cd32'] },
  { id: 'royal', name: 'Royal Crown', colors: ['#4b0082', '#800080', '#9932cc', '#ba55d3', '#dda0dd'] }
];

interface WheelCustomizerProps {
  visible: boolean;
  onClose: () => void;
  customTitle: string;
  customMessage: string;
  customWinnerWord: string;
  allowManualWinnerSelection: boolean;
  selectedTheme: string;
  wheelType: any;
  availableWheelTypes: any[];
  onTitleChange: (title: string) => void;
  onMessageChange: (message: string) => void;
  onWinnerWordChange: (word: string) => void;
  onManualSelectionChange: (allow: boolean) => void;
  onThemeChange: (theme: string) => void;
  onWheelTypeChange: (wheelType: any) => void;
}

const WheelCustomizer: React.FC<WheelCustomizerProps> = ({
  visible,
  onClose,
  customTitle,
  customMessage,
  customWinnerWord,
  allowManualWinnerSelection,
  selectedTheme,
  wheelType,
  availableWheelTypes,
  onTitleChange,
  onMessageChange,
  onWinnerWordChange,
  onManualSelectionChange,
  onThemeChange,
  onWheelTypeChange
}) => {
  const [tempTitle, setTempTitle] = useState(customTitle);
  const [tempMessage, setTempMessage] = useState(customMessage);
  const [tempWinnerWord, setTempWinnerWord] = useState(customWinnerWord);
  const [tempManualSelection, setTempManualSelection] = useState(allowManualWinnerSelection);
  const [tempTheme, setTempTheme] = useState(selectedTheme);
  const [tempWheelType, setTempWheelType] = useState(wheelType);

  // Reset temp values when modal opens
  React.useEffect(() => {
    if (visible) {
      setTempTitle(customTitle);
      setTempMessage(customMessage);
      setTempWinnerWord(customWinnerWord);
      setTempManualSelection(allowManualWinnerSelection);
      setTempTheme(selectedTheme);
      setTempWheelType(wheelType);
    }
  }, [visible, customTitle, customMessage, customWinnerWord, allowManualWinnerSelection, selectedTheme, wheelType]);

  const handleSave = () => {
    onTitleChange(tempTitle);
    onMessageChange(tempMessage);
    onWinnerWordChange(tempWinnerWord);
    onManualSelectionChange(tempManualSelection);
    onThemeChange(tempTheme);
    if (tempWheelType !== wheelType) {
      onWheelTypeChange(tempWheelType);
    }
    onClose();
    Alert.alert('Success', 'Wheel settings updated!');
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all custom settings to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setTempTitle('');
            setTempMessage('');
            setTempWinnerWord('Winner');
            setTempManualSelection(false);
            setTempTheme('school');
            setTempWheelType(AVAILABLE_WHEEL_TYPES[0]);
          }
        }
      ]
    );
  };

  const renderThemePreview = (theme: any) => (
    <View style={styles.themePreview}>
      {theme.colors.slice(0, 5).map((color: string, index: number) => (
        <View
          key={index}
          style={[styles.themeColor, { backgroundColor: color }]}
        />
      ))}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Ionicons name="settings" size={24} color={COLORS.primary} />
              <Text style={styles.title}>Wheel Customizer</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Custom Title Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="text" size={20} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Custom Wheel Title</Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={tempTitle}
                onChangeText={setTempTitle}
                placeholder="Enter custom wheel title..."
                placeholderTextColor={COLORS.textLight}
                maxLength={50}
              />
              <Text style={styles.helperText}>
                Leave empty to use the default wheel type title
              </Text>
            </View>

            {/* Custom Message Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="chatbubble" size={20} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Winner Announcement Message</Text>
              </View>
              <TextInput
                style={[styles.textInput, { height: 80 }]}
                value={tempMessage}
                onChangeText={setTempMessage}
                placeholder="🎉 Congratulations {name}! You're our winner! 🎊"
                placeholderTextColor={COLORS.textLight}
                multiline
                maxLength={200}
                textAlignVertical="top"
              />
              <Text style={styles.helperText}>
                Use {'{name}'} to include the winner's name. Use {'{winner}'} for custom winner word.
              </Text>
            </View>

            {/* Custom Winner Word Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trophy" size={20} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Custom Winner Word</Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={tempWinnerWord}
                onChangeText={setTempWinnerWord}
                placeholder="Winner"
                placeholderTextColor={COLORS.textLight}
                maxLength={20}
              />
              <Text style={styles.helperText}>
                This word replaces "winner" in all announcements
              </Text>
            </View>

            {/* Manual Winner Selection */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="hand-left" size={20} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Manual Winner Selection</Text>
              </View>
              <TouchableOpacity
                style={styles.toggleContainer}
                onPress={() => setTempManualSelection(!tempManualSelection)}
              >
                <View style={[styles.toggle, tempManualSelection && styles.toggleActive]}>
                  <View style={[styles.toggleKnob, tempManualSelection && styles.toggleKnobActive]} />
                </View>
                <Text style={styles.toggleText}>
                  {tempManualSelection ? 'Enabled' : 'Disabled'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.helperText}>
                Allow manual selection instead of random wheel spin
              </Text>
            </View>

            {/* Wheel Type Selection */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="game-controller" size={20} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Wheel Type</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.wheelTypeScroll}>
                {availableWheelTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.wheelTypeCard,
                      tempWheelType?.id === type.id && styles.wheelTypeCardActive
                    ]}
                    onPress={() => setTempWheelType(type)}
                  >
                    <Text style={styles.wheelTypeIcon}>{type.icon}</Text>
                    <Text style={[
                      styles.wheelTypeName,
                      tempWheelType?.id === type.id && styles.wheelTypeNameActive
                    ]}>
                      {type.name}
                    </Text>
                    <Text style={styles.wheelTypeItems}>
                      {type.defaultItems?.length || 0} items
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Theme Selection */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="color-palette" size={20} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Wheel Theme</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.themeScroll}>
                {AVAILABLE_THEMES.map((theme) => (
                  <TouchableOpacity
                    key={theme.id}
                    style={[
                      styles.themeCard,
                      tempTheme === theme.id && styles.themeCardActive
                    ]}
                    onPress={() => setTempTheme(theme.id)}
                  >
                    {renderThemePreview(theme)}
                    <Text style={[
                      styles.themeName,
                      tempTheme === theme.id && styles.themeNameActive
                    ]}>
                      {theme.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
            >
              <Text style={styles.resetButtonText}>Reset All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '95%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceSecondary,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.border,
    padding: 2,
  },
  toggleActive: {
    backgroundColor: COLORS.primary,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  toggleKnobActive: {
    transform: [{ translateX: 22 }],
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  wheelTypeScroll: {
    marginTop: 8,
  },
  wheelTypeCard: {
    width: 120,
    padding: 12,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
  },
  wheelTypeCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  wheelTypeIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  wheelTypeName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  wheelTypeNameActive: {
    color: COLORS.primary,
  },
  wheelTypeItems: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  themeScroll: {
    marginTop: 8,
  },
  themeCard: {
    width: 100,
    padding: 12,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
  },
  themeCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  themePreview: {
    flexDirection: 'row',
    marginBottom: 8,
    height: 20,
  },
  themeColor: {
    flex: 1,
    height: '100%',
    marginHorizontal: 1,
    borderRadius: 2,
  },
  themeName: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  themeNameActive: {
    color: COLORS.primary,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  resetButton: {
    flex: 1,
    backgroundColor: COLORS.error,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    color: COLORS.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: COLORS.surface,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WheelCustomizer;