import type React from "react"
import { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, Image } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useTheme, type Theme } from "../contexts/ThemeContext"
import { Ionicons } from "@expo/vector-icons"
import * as ImagePicker from 'expo-image-picker'
import BackgroundWrapper from "../components/BackgroundWrapper"

const predefinedThemes = [
  {
    name: "Classic Red",
    theme: {
      primary: "#8B2635",
      secondary: "#A0434F",
      background: "#8B2635",
      surface: "#FFFFFF",
      text: "#FFFFFF",
      textSecondary: "#CCCCCC",
      accent: "#D4AF37",
      error: "#FF6B6B",
      success: "#4ECDC4",
    },
  },
  {
    name: "Ocean Blue",
    theme: {
      primary: "#2E86AB",
      secondary: "#A23B72",
      background: "#2E86AB",
      surface: "#FFFFFF",
      text: "#FFFFFF",
      textSecondary: "#CCCCCC",
      accent: "#F18F01",
      error: "#FF6B6B",
      success: "#4ECDC4",
    },
  },
  {
    name: "Forest Green",
    theme: {
      primary: "#2D5016",
      secondary: "#4F7942",
      background: "#2D5016",
      surface: "#FFFFFF",
      text: "#FFFFFF",
      textSecondary: "#CCCCCC",
      accent: "#8FBC8F",
      error: "#FF6B6B",
      success: "#4ECDC4",
    },
  },
  {
    name: "Purple Dream",
    theme: {
      primary: "#6A4C93",
      secondary: "#8B5A96",
      background: "#6A4C93",
      surface: "#FFFFFF",
      text: "#FFFFFF",
      textSecondary: "#CCCCCC",
      accent: "#FFD23F",
      error: "#FF6B6B",
      success: "#4ECDC4",
    },
  },
  {
    name: "Sunset Orange",
    theme: {
      primary: "#FF6B35",
      secondary: "#F7931E",
      background: "#FF6B35",
      surface: "#FFFFFF",
      text: "#FFFFFF",
      textSecondary: "#CCCCCC",
      accent: "#FFD23F",
      error: "#FF6B6B",
      success: "#4ECDC4",
    },
  },
  {
    name: "Dark Mode",
    theme: {
      primary: "#BB86FC",
      secondary: "#03DAC6",
      background: "#121212",
      surface: "#1E1E1E",
      text: "#FFFFFF",
      textSecondary: "#AAAAAA",
      accent: "#03DAC6",
      error: "#CF6679",
      success: "#4ECDC4",
    },
  },
]

const colorOptions = [
  "#8B2635",
  "#2E86AB",
  "#2D5016",
  "#6A4C93",
  "#FF6B35",
  "#E91E63",
  "#9C27B0",
  "#673AB7",
  "#3F51B5",
  "#2196F3",
  "#03A9F4",
  "#00BCD4",
  "#009688",
  "#4CAF50",
  "#8BC34A",
  "#CDDC39",
  "#FFEB3B",
  "#FFC107",
  "#FF9800",
  "#FF5722",
  "#795548",
  "#9E9E9E",
  "#607D8B",
  "#000000",
]

const CustomizeThemeScreen: React.FC = () => {
  const navigation = useNavigation()
  const { theme, updateTheme, resetTheme, setBackgroundImage: setThemeBackgroundImage } = useTheme()
  const [selectedTab, setSelectedTab] = useState<"predefined" | "custom" | "background">("predefined")
  const [customTheme, setCustomTheme] = useState<Theme>(theme)
  const [backgroundImage, setBackgroundImage] = useState<string | null>(theme.backgroundImage || null)

  useEffect(() => {
    setBackgroundImage(theme.backgroundImage || null)
  }, [theme.backgroundImage])

  const applyPredefinedTheme = (newTheme: Partial<Theme>) => {
    updateTheme(newTheme)
    Alert.alert("Theme Applied", "Your new theme has been applied successfully!")
  }

  const updateCustomColor = (colorKey: keyof Theme, color: string) => {
    const updatedTheme = { ...customTheme, [colorKey]: color }
    setCustomTheme(updatedTheme)
  }

  const applyCustomTheme = () => {
    updateTheme(customTheme)
    Alert.alert("Custom Theme Applied", "Your custom theme has been applied successfully!")
  }

  const resetToDefault = () => {
    Alert.alert("Reset Theme", "Are you sure you want to reset to the default theme?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          resetTheme()
          setCustomTheme(theme)
          setBackgroundImage(null)
          await setThemeBackgroundImage(null)
          Alert.alert("Theme Reset", "Theme has been reset to default.")
        },
      },
    ])
  }

  const pickBackgroundImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Permission to access camera roll is required!")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri
      setBackgroundImage(imageUri)
      await setThemeBackgroundImage(imageUri)
      Alert.alert("Background Applied", "Background image has been applied successfully!")
    }
  }

  const removeBackgroundImage = async () => {
    setBackgroundImage(null)
    await setThemeBackgroundImage(null)
    Alert.alert("Background Removed", "Background image has been removed!")
  }

  const renderColorPicker = (label: string, colorKey: keyof Theme, currentColor: string) => (
    <View style={styles.colorPickerSection}>
      <Text style={[styles.colorLabel, { color: "#333" }]}>{label}</Text>
      <View style={styles.colorGrid}>
        {colorOptions.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              currentColor === color && styles.selectedColorOption,
            ]}
            onPress={() => updateCustomColor(colorKey, color)}
          />
        ))}
      </View>
    </View>
  )

  const renderPreview = () => (
    <View style={[styles.previewContainer, { backgroundColor: theme.surface }]}>
      <Text style={[styles.previewTitle, { color: theme.primary }]}>Preview</Text>

      {/* Wheel Preview */}
      <View style={styles.wheelPreview}>
        <View style={[styles.miniWheel, { backgroundColor: theme.background }]}>
          <View style={[styles.wheelSegment, { backgroundColor: theme.primary }]} />
          <View style={[styles.wheelSegment, { backgroundColor: theme.secondary }]} />
          <View style={[styles.wheelSegment, { backgroundColor: theme.accent }]} />
          <View style={[styles.wheelSegment, { backgroundColor: theme.success }]} />
        </View>
        <Text style={[styles.previewText, { color: "#333" }]}>Tap to customize</Text>
      </View>

      {/* Color Indicators */}
      <View style={styles.colorIndicators}>
        <View style={styles.colorIndicator}>
          <View style={[styles.colorSwatch, { backgroundColor: theme.primary }]} />
          <Text style={[styles.colorName, { color: "#333" }]}>Primary</Text>
        </View>
        <View style={styles.colorIndicator}>
          <View style={[styles.colorSwatch, { backgroundColor: theme.secondary }]} />
          <Text style={[styles.colorName, { color: "#333" }]}>Secondary</Text>
        </View>
        <View style={styles.colorIndicator}>
          <View style={[styles.colorSwatch, { backgroundColor: theme.accent }]} />
          <Text style={[styles.colorName, { color: "#333" }]}>Accent</Text>
        </View>
      </View>
    </View>
  )

  return (
    <BackgroundWrapper>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: theme.text }]}>Customize Theme</Text>

          <TouchableOpacity onPress={resetToDefault}>
            <Ionicons name="refresh" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Tap on any segment to change its color</Text>

      {renderPreview()}

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, { backgroundColor: selectedTab === "predefined" ? theme.primary : "transparent" }]}
          onPress={() => setSelectedTab("predefined")}
        >
          <Text style={[styles.tabText, { color: selectedTab === "predefined" ? theme.surface : theme.textSecondary }]}>
            THEMES
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, { backgroundColor: selectedTab === "custom" ? theme.primary : "transparent" }]}
          onPress={() => setSelectedTab("custom")}
        >
          <Text style={[styles.tabText, { color: selectedTab === "custom" ? theme.surface : theme.textSecondary }]}>
            COLORS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, { backgroundColor: selectedTab === "background" ? theme.primary : "transparent" }]}
          onPress={() => setSelectedTab("background")}
        >
          <Text style={[styles.tabText, { color: selectedTab === "background" ? theme.surface : theme.textSecondary }]}>
            BACKGROUND
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {selectedTab === "predefined" ? (
          <View style={styles.predefinedThemes}>
            {predefinedThemes.map((themeOption, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.themeCard, { backgroundColor: theme.surface }]}
                onPress={() => applyPredefinedTheme(themeOption.theme)}
              >
                <View style={styles.themePreview}>
                  <View style={[styles.themeColor, { backgroundColor: themeOption.theme.primary }]} />
                  <View style={[styles.themeColor, { backgroundColor: themeOption.theme.secondary }]} />
                  <View style={[styles.themeColor, { backgroundColor: themeOption.theme.accent }]} />
                  <View style={[styles.themeColor, { backgroundColor: themeOption.theme.success }]} />
                </View>
                <Text style={[styles.themeName, { color: "#333" }]}>{themeOption.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : selectedTab === "custom" ? (
          <View style={[styles.customSection, { backgroundColor: theme.surface }]}>
            {renderColorPicker("Primary Color", "primary", customTheme.primary)}
            {renderColorPicker("Secondary Color", "secondary", customTheme.secondary)}
            {renderColorPicker("Background Color", "background", customTheme.background)}
            {renderColorPicker("Accent Color", "accent", customTheme.accent)}
            {renderColorPicker("Success Color", "success", customTheme.success)}
            {renderColorPicker("Error Color", "error", customTheme.error)}

            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: theme.primary }]}
              onPress={applyCustomTheme}
            >
              <Text style={[styles.applyButtonText, { color: theme.surface }]}>Apply Custom Theme</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.backgroundSection, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>Background Settings</Text>
            <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
              Customize your app's background with a personal image
            </Text>

            {backgroundImage && (
              <View style={styles.currentBackground}>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Current Background:</Text>
                <View style={styles.imageContainer}>
                  <Image source={{ uri: backgroundImage }} style={styles.backgroundPreview} />
                  <View style={[styles.imageOverlay, { backgroundColor: `${theme.background}20` }]} />
                </View>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.backgroundButton, { backgroundColor: theme.primary }]}
                onPress={pickBackgroundImage}
              >
                <Ionicons name="image" size={20} color={theme.surface} />
                <Text style={[styles.backgroundButtonText, { color: theme.surface }]}>
                  {backgroundImage ? "Change Background" : "Upload Background"}
                </Text>
              </TouchableOpacity>

              {backgroundImage && (
                <TouchableOpacity
                  style={[styles.backgroundButton, styles.removeButton, { backgroundColor: theme.error }]}
                  onPress={removeBackgroundImage}
                >
                  <Ionicons name="trash" size={20} color={theme.surface} />
                  <Text style={[styles.backgroundButtonText, { color: theme.surface }]}>Remove Background</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.backgroundInfo, { backgroundColor: `${theme.primary}10` }]}>
              <Ionicons name="information-circle" size={20} color={theme.primary} style={styles.infoIcon} />
              <View style={styles.infoTextContainer}>
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                  • Background images are applied across all screens
                </Text>
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                  • For best results, use portrait images (9:16 ratio)
                </Text>
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                  • Changes are saved automatically when applied
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.bottomButton, { backgroundColor: theme.surface }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.bottomButtonText, { color: theme.primary }]}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            Alert.alert("Theme Saved", "Your theme preferences have been saved!")
            navigation.goBack()
          }}
        >
          <Text style={[styles.bottomButtonText, { color: theme.surface }]}>Save & Apply</Text>
        </TouchableOpacity>
      </View>
      </SafeAreaView>
    </BackgroundWrapper>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  subtitle: {
    textAlign: "center",
    fontSize: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  previewContainer: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  wheelPreview: {
    alignItems: "center",
    marginBottom: 20,
  },
  miniWheel: {
    width: 120,
    height: 120,
    borderRadius: 60,
    flexDirection: "row",
    flexWrap: "wrap",
    overflow: "hidden",
    marginBottom: 12,
  },
  wheelSegment: {
    width: "50%",
    height: "50%",
  },
  previewText: {
    fontSize: 14,
    fontStyle: "italic",
  },
  colorIndicators: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  colorIndicator: {
    alignItems: "center",
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginBottom: 8,
  },
  colorName: {
    fontSize: 12,
    fontWeight: "600",
  },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
  },
  predefinedThemes: {
    paddingHorizontal: 20,
    gap: 16,
  },
  themeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    marginBottom: 4,
  },
  themePreview: {
    flexDirection: "row",
    marginRight: 16,
  },
  themeColor: {
    width: 24,
    height: 24,
    marginRight: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  themeName: {
    fontSize: 16,
    fontWeight: "600",
  },
  customSection: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  colorPickerSection: {
    marginBottom: 24,
  },
  colorLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: "transparent",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  selectedColorOption: {
    borderColor: "#333",
    borderWidth: 4,
    elevation: 4,
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  applyButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  bottomActions: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
  },
  bottomButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  bottomButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },

  // Background Section Styles
  backgroundSection: {
    padding: 20,
    margin: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "600",
  },
  currentBackground: {
    marginBottom: 20,
  },
  imageContainer: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
  },
  backgroundPreview: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    resizeMode: "cover",
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 20,
  },
  backgroundButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  removeButton: {
    marginTop: 8,
  },
  backgroundButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  backgroundInfo: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
  },
})

export default CustomizeThemeScreen
