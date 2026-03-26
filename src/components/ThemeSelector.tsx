import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native'
import { useTheme } from '../contexts/ThemeContext'

interface ThemeSelectorProps {
  onClose?: () => void
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ onClose }) => {
  const { theme, currentThemeName, setTheme, clearThemeCache, predefinedThemes } = useTheme()

  const handleThemeSelect = (themeName: string) => {
    setTheme(themeName)
    if (onClose) {
      onClose()
    }
  }

  const renderThemePreview = (themeOption: { name: string; theme: any }) => {
    const isSelected = currentThemeName === themeOption.name
    const previewTheme = themeOption.theme

    return (
      <TouchableOpacity
        key={themeOption.name}
        style={[
          styles.themeCard,
          {
            backgroundColor: previewTheme.surface,
            borderColor: isSelected ? previewTheme.primary : previewTheme.border,
            borderWidth: isSelected ? 2 : 1,
          }
        ]}
        onPress={() => handleThemeSelect(themeOption.name)}
        activeOpacity={0.8}
      >
        {/* Theme preview */}
        <View style={styles.previewContainer}>
          <View style={[styles.previewHeader, { backgroundColor: previewTheme.primary }]}>
            <View style={[styles.previewDot, { backgroundColor: previewTheme.onPrimary }]} />
            <View style={[styles.previewDot, { backgroundColor: previewTheme.onPrimary }]} />
            <View style={[styles.previewDot, { backgroundColor: previewTheme.onPrimary }]} />
          </View>
          <View style={styles.previewContent}>
            <View style={[styles.previewText, { backgroundColor: previewTheme.textSecondary }]} />
            <View style={[styles.previewButton, { backgroundColor: previewTheme.primary }]} />
          </View>
        </View>

        {/* Theme name */}
        <Text style={[styles.themeName, { color: previewTheme.text }]}>
          {themeOption.name.replace('-dark', ' (Dark)').replace('-', ' ')}
        </Text>

        {/* Selection indicator */}
        {isSelected && (
          <View style={[styles.selectedIndicator, { backgroundColor: previewTheme.primary }]}>
            <Text style={[styles.checkmark, { color: previewTheme.onPrimary }]}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Choose Theme</Text>
        <TouchableOpacity
          onPress={onClose}
          style={[styles.closeButton, { backgroundColor: theme.surface }]}
        >
          <Text style={[styles.closeText, { color: theme.textSecondary }]}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.themesGrid}>
          {predefinedThemes.map(renderThemePreview)}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.surface }]}>
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          Current: {currentThemeName.replace('-dark', ' (Dark)').replace('-', ' ')}
        </Text>
        <TouchableOpacity
          style={[styles.clearCacheButton, { borderColor: theme.error }]}
          onPress={async () => {
            await clearThemeCache()
            if (onClose) onClose()
          }}
        >
          <Text style={[styles.clearCacheText, { color: theme.error }]}>
            Clear Cache
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  themeCard: {
    width: (Dimensions.get('window').width - 56) / 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    position: 'relative',
  },
  previewContainer: {
    marginBottom: 12,
  },
  previewHeader: {
    height: 24,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  previewContent: {
    backgroundColor: '#F5F5F5',
    height: 40,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewText: {
    height: 8,
    borderRadius: 4,
    flex: 1,
    marginRight: 8,
  },
  previewButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  themeName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 12,
  },
  clearCacheButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'center',
  },
  clearCacheText: {
    fontSize: 12,
    fontWeight: '600',
  },
})

export default ThemeSelector