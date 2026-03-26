import type React from "react"
import { createContext, useState, useEffect, useContext, useMemo, useCallback, type ReactNode } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Appearance } from "react-native"

interface Theme {
  primary: string
  secondary: string
  background: string
  surface: string
  text: string
  textSecondary: string
  border: string
  error: string
  success: string
  accent: string
  onPrimary: string
  onSecondary: string
  onBackground: string
  onSurface: string
  onError: string
  isDark: boolean
  backgroundImage?: string
}

interface ThemeContextType {
   theme: Theme
   currentThemeName: string
   setTheme: (themeName: string) => Promise<void>
   toggleTheme: () => Promise<void>
   resetTheme: () => Promise<void>
   clearThemeCache: () => Promise<void>
   updateTheme: (updates: Partial<Theme>) => Promise<void>
   setBackgroundImage: (imageUri: string | null) => Promise<void>
   predefinedThemes: { name: string; theme: Theme }[]
}

const lightTheme: Theme = {
  primary: "#8E0B16", // Restored original maroon color
  secondary: "#FFC107", // Restored original yellow
  background: "#FFFFFF", // Restored original white
  surface: "#FFFFFF", // Restored original white
  text: "#212121", // High contrast dark text
  textSecondary: "#757575", // Medium gray for secondary text
  border: "#BDBDBD", // Restored original border color
  error: "#D32F2F", // Material Design error red
  success: "#4CAF50", // Material Design success green
  accent: "#FF6B35", // Restored original accent color
  onPrimary: "#FFFFFF",
  onSecondary: "#212121",
  onBackground: "#212121",
  onSurface: "#212121",
  onError: "#FFFFFF",
  isDark: false,
}

const darkTheme: Theme = {
  primary: "#8E0B16", // Restored original maroon for consistency
  secondary: "#FFD54F", // Restored original yellow
  background: "#121212", // Standard Material Design dark background
  surface: "#1E1E1E", // Elevated surface for cards
  text: "#FFFFFF", // Pure white for maximum contrast
  textSecondary: "#AAAAAA", // Good contrast for secondary text
  border: "#616161", // Restored original border color
  error: "#EF9A9A", // Material Design error red
  success: "#4CAF50", // Material Design success green
  accent: "#FF6B35", // Restored original accent color
  onPrimary: "#FFFFFF",
  onSecondary: "#212121",
  onBackground: "#FFFFFF",
  onSurface: "#FFFFFF",
  onError: "#212121",
  isDark: true,
}

const predefinedThemes = [
   { name: "light", theme: lightTheme },
   { name: "dark", theme: darkTheme },

   // 1. School Colors
   {
     name: "school-colors",
     theme: {
       ...lightTheme,
       primary: "#8e0b16",
       secondary: "#66181E",
       accent: "#FF6B35",
       background: "#FFFFFF",
       surface: "#F8F9FA",
     },
   },
   {
     name: "school-colors-dark",
     theme: {
       ...darkTheme,
       primary: "#8e0b16",
       secondary: "#66181E",
       accent: "#FF6B35",
       background: "#121212",
       surface: "#1E1E1E",
     },
   },

   // 2. Rainbow Bright
   {
     name: "rainbow-bright",
     theme: {
       ...lightTheme,
       primary: "#FF0000",
       secondary: "#FF7F00",
       accent: "#FFFF00",
       background: "#FFFFFF",
       surface: "#F8F9FA",
     },
   },
   {
     name: "rainbow-bright-dark",
     theme: {
       ...darkTheme,
       primary: "#FF4444",
       secondary: "#FF9933",
       accent: "#FFFF44",
       background: "#0D0D0D",
       surface: "#1A1A1A",
     },
   },

   // 3. Neon Electric
   {
     name: "neon-electric",
     theme: {
       ...lightTheme,
       primary: "#00FF00",
       secondary: "#00FFFF",
       accent: "#FF00FF",
       background: "#000000",
       surface: "#111111",
       text: "#FFFFFF",
       textSecondary: "#CCCCCC",
     },
   },
   {
     name: "neon-electric-dark",
     theme: {
       ...darkTheme,
       primary: "#00FF00",
       secondary: "#00FFFF",
       accent: "#FF00FF",
       background: "#000000",
       surface: "#0A0A0A",
       text: "#FFFFFF",
       textSecondary: "#CCCCCC",
     },
   },

   // 4. Ocean Depths
   {
     name: "ocean-depths",
     theme: {
       ...lightTheme,
       primary: "#001122",
       secondary: "#003366",
       accent: "#0066CC",
       background: "#E6F3FF",
       surface: "#FFFFFF",
     },
   },
   {
     name: "ocean-depths-dark",
     theme: {
       ...darkTheme,
       primary: "#001122",
       secondary: "#003366",
       accent: "#0066CC",
       background: "#000011",
       surface: "#001122",
     },
   },

   // 5. Sunset Blaze
   {
     name: "sunset-blaze",
     theme: {
       ...lightTheme,
       primary: "#FF4500",
       secondary: "#FF6347",
       accent: "#FFD700",
       background: "#FFF8DC",
       surface: "#FFFFFF",
     },
   },
   {
     name: "sunset-blaze-dark",
     theme: {
       ...darkTheme,
       primary: "#FF4500",
       secondary: "#FF6347",
       accent: "#FFD700",
       background: "#1A0A00",
       surface: "#2A1A00",
     },
   },

   // 6. Purple Galaxy
   {
     name: "purple-galaxy",
     theme: {
       ...lightTheme,
       primary: "#4B0082",
       secondary: "#6A0DAD",
       accent: "#9370DB",
       background: "#F8F0FF",
       surface: "#FFFFFF",
     },
   },
   {
     name: "purple-galaxy-dark",
     theme: {
       ...darkTheme,
       primary: "#4B0082",
       secondary: "#6A0DAD",
       accent: "#9370DB",
       background: "#0A001A",
       surface: "#1A002A",
     },
   },

   // 7. Emerald Forest
   {
     name: "emerald-forest",
     theme: {
       ...lightTheme,
       primary: "#006400",
       secondary: "#228B22",
       accent: "#32CD32",
       background: "#F0FFF0",
       surface: "#FFFFFF",
     },
   },
   {
     name: "emerald-forest-dark",
     theme: {
       ...darkTheme,
       primary: "#006400",
       secondary: "#228B22",
       accent: "#32CD32",
       background: "#001A00",
       surface: "#002A00",
     },
   },

   // 8. Hot Pink
   {
     name: "hot-pink",
     theme: {
       ...lightTheme,
       primary: "#FF1493",
       secondary: "#FF69B4",
       accent: "#FFB6C1",
       background: "#FFF0F5",
       surface: "#FFFFFF",
     },
   },
   {
     name: "hot-pink-dark",
     theme: {
       ...darkTheme,
       primary: "#FF1493",
       secondary: "#FF69B4",
       accent: "#FFB6C1",
       background: "#1A0010",
       surface: "#2A0020",
     },
   },

   // 9. Golden Luxury
   {
     name: "golden-luxury",
     theme: {
       ...lightTheme,
       primary: "#DAA520",
       secondary: "#FFD700",
       accent: "#B8860B",
       background: "#FFFACD",
       surface: "#FFFFFF",
     },
   },
   {
     name: "golden-luxury-dark",
     theme: {
       ...darkTheme,
       primary: "#DAA520",
       secondary: "#FFD700",
       accent: "#B8860B",
       background: "#1A1500",
       surface: "#2A2200",
     },
   },

   // 10. Cyber Blue
   {
     name: "cyber-blue",
     theme: {
       ...lightTheme,
       primary: "#00BFFF",
       secondary: "#1E90FF",
       accent: "#4169E1",
       background: "#F0F8FF",
       surface: "#FFFFFF",
     },
   },
   {
     name: "cyber-blue-dark",
     theme: {
       ...darkTheme,
       primary: "#00BFFF",
       secondary: "#1E90FF",
       accent: "#4169E1",
       background: "#000A1A",
       surface: "#001A2A",
     },
   },

   // 11. Fire & Ice
   {
     name: "fire-ice",
     theme: {
       ...lightTheme,
       primary: "#FF4500",
       secondary: "#00CED1",
       accent: "#FF6347",
       background: "#F5F5F5",
       surface: "#FFFFFF",
     },
   },
   {
     name: "fire-ice-dark",
     theme: {
       ...darkTheme,
       primary: "#FF4500",
       secondary: "#00CED1",
       accent: "#FF6347",
       background: "#0A0A0A",
       surface: "#1A1A1A",
     },
   },

   // 12. Lime Splash
   {
     name: "lime-splash",
     theme: {
       ...lightTheme,
       primary: "#32CD32",
       secondary: "#00FF00",
       accent: "#7FFF00",
       background: "#F0FFF0",
       surface: "#FFFFFF",
     },
   },
   {
     name: "lime-splash-dark",
     theme: {
       ...darkTheme,
       primary: "#32CD32",
       secondary: "#00FF00",
       accent: "#7FFF00",
       background: "#001A00",
       surface: "#002A00",
     },
   },

   // 13. Midnight Dark
   {
     name: "midnight-dark",
     theme: {
       ...lightTheme,
       primary: "#191970",
       secondary: "#000080",
       accent: "#483D8B",
       background: "#F8F8FF",
       surface: "#FFFFFF",
     },
   },
   {
     name: "midnight-dark-dark",
     theme: {
       ...darkTheme,
       primary: "#191970",
       secondary: "#000080",
       accent: "#483D8B",
       background: "#000011",
       surface: "#000022",
     },
   },

   // 14. Cotton Candy
   {
     name: "cotton-candy",
     theme: {
       ...lightTheme,
       primary: "#FFB6C1",
       secondary: "#E6A8D7",
       accent: "#DDA0DD",
       background: "#FFF0F5",
       surface: "#FFFFFF",
     },
   },
   {
     name: "cotton-candy-dark",
     theme: {
       ...darkTheme,
       primary: "#FFB6C1",
       secondary: "#E6A8D7",
       accent: "#DDA0DD",
       background: "#1A0010",
       surface: "#2A0020",
     },
   },

   // 15. Volcanic Orange
   {
     name: "volcanic-orange",
     theme: {
       ...lightTheme,
       primary: "#FF4500",
       secondary: "#FF6347",
       accent: "#DC143C",
       background: "#FFF8DC",
       surface: "#FFFFFF",
     },
   },
   {
     name: "volcanic-orange-dark",
     theme: {
       ...darkTheme,
       primary: "#FF4500",
       secondary: "#FF6347",
       accent: "#DC143C",
       background: "#1A0A00",
       surface: "#2A1A00",
     },
   },

   // 16. Arctic Frost
   {
     name: "arctic-frost",
     theme: {
       ...lightTheme,
       primary: "#87CEEB",
       secondary: "#B0E0E6",
       accent: "#F0FFFF",
       background: "#F0FFFF",
       surface: "#FFFFFF",
     },
   },
   {
     name: "arctic-frost-dark",
     theme: {
       ...darkTheme,
       primary: "#87CEEB",
       secondary: "#B0E0E6",
       accent: "#F0FFFF",
       background: "#001122",
       surface: "#002233",
     },
   },

   // 17. Tropical Sunset
   {
     name: "tropical-sunset",
     theme: {
       ...lightTheme,
       primary: "#FF7F50",
       secondary: "#FFA07A",
       accent: "#20B2AA",
       background: "#FFF8DC",
       surface: "#FFFFFF",
     },
   },
   {
     name: "tropical-sunset-dark",
     theme: {
       ...darkTheme,
       primary: "#FF7F50",
       secondary: "#FFA07A",
       accent: "#20B2AA",
       background: "#1A0F0A",
       surface: "#2A1F1A",
     },
   },
]

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const colorScheme = Appearance.getColorScheme()
  const defaultTheme = colorScheme === "dark" ? darkTheme : lightTheme
  const defaultThemeName = colorScheme === "dark" ? "dark" : "light"

  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [currentThemeName, setCurrentThemeName] = useState<string>(defaultThemeName)

  useEffect(() => {
    let isMounted = true; // Track if component is still mounted
    let subscription: any = null;
    
    const loadTheme = async () => {
      try {
        const savedThemeName = await AsyncStorage.getItem("appTheme")
        const savedBackgroundImage = await AsyncStorage.getItem("backgroundImage")

        let loadedTheme = defaultTheme
        let loadedThemeName = defaultThemeName

        if (savedThemeName) {
          const foundTheme = predefinedThemes.find((t) => t.name === savedThemeName)
          if (foundTheme) {
            loadedTheme = foundTheme.theme
            loadedThemeName = foundTheme.name
            console.log('Theme loaded from storage:', savedThemeName)
          } else {
            console.warn('Saved theme not found:', savedThemeName, 'falling back to default')
          }
        } else {
          console.log('No saved theme found, using default:', defaultThemeName)
        }

        // Add background image to theme if it exists
        if (savedBackgroundImage) {
          loadedTheme = { ...loadedTheme, backgroundImage: savedBackgroundImage }
        }

        // Defer state updates to prevent useInsertionEffect warnings
        setTimeout(() => {
          if (isMounted) {
            setThemeState(loadedTheme)
            setCurrentThemeName(loadedThemeName)
          }
        }, 0)
      } catch (error) {
        console.error("Failed to load theme from AsyncStorage:", error)
        setTimeout(() => {
          if (isMounted) {
            setThemeState(defaultTheme)
            setCurrentThemeName(defaultThemeName)
          }
        }, 0)
      }
    }

    const setupAppearanceListener = () => {
      subscription = Appearance.addChangeListener(({ colorScheme: newColorScheme }) => {
        // Only auto-switch if the user hasn't manually selected a specific theme
        // Don't override user-selected themes like "blue", "green", etc.
        const defaultThemes = ["light", "dark"]
        if (defaultThemes.includes(currentThemeName) && isMounted) {
          const newDefaultTheme = newColorScheme === "dark" ? darkTheme : lightTheme
          const newDefaultThemeName = newColorScheme === "dark" ? "dark" : "light"
          if (currentThemeName === defaultThemeName || currentThemeName === newDefaultThemeName) {
            // Defer state updates to prevent useInsertionEffect warnings
            setTimeout(() => {
              if (isMounted) {
                setThemeState(newDefaultTheme)
                setCurrentThemeName(newDefaultThemeName)
              }
            }, 0)
          }
        }
      })
    }

    // Initialize theme loading and appearance listener
    loadTheme().then(() => {
      if (isMounted) {
        setupAppearanceListener()
      }
    })

    return () => {
      isMounted = false; // Mark as unmounted
      if (subscription) {
        subscription.remove()
      }
    }
  }, [defaultThemeName, defaultTheme, currentThemeName])

  const setTheme = useCallback(async (themeName: string) => {
    console.log('Setting theme to:', themeName)
    const foundTheme = predefinedThemes.find((t) => t.name === themeName)
    if (foundTheme) {
      setThemeState(foundTheme.theme)
      setCurrentThemeName(foundTheme.name)
      try {
        await AsyncStorage.setItem("appTheme", themeName)
        console.log('Theme saved successfully:', themeName)
      } catch (error) {
        console.error("Failed to save theme to AsyncStorage:", error)
      }
    } else {
      console.warn(`Theme "${themeName}" not found.`)
    }
  }, [])

  const toggleTheme = useCallback(async () => {
    const newThemeName = currentThemeName === "light" ? "dark" : "light"
    await setTheme(newThemeName)
  }, [currentThemeName, setTheme])

  const resetTheme = useCallback(async () => {
    await setTheme("light")
  }, [setTheme])

  const clearThemeCache = useCallback(async () => {
    console.log('Clearing theme cache...')
    try {
      await AsyncStorage.removeItem("appTheme")
      await AsyncStorage.removeItem("backgroundImage")
      await AsyncStorage.removeItem("customTheme")
      // Reset to system default
      const colorScheme = Appearance.getColorScheme()
      const defaultTheme = colorScheme === "dark" ? darkTheme : lightTheme
      const defaultThemeName = colorScheme === "dark" ? "dark" : "light"
      setThemeState(defaultTheme)
      setCurrentThemeName(defaultThemeName)
      console.log('Theme cache cleared, reset to:', defaultThemeName)
    } catch (error) {
      console.error("Failed to clear theme cache:", error)
    }
  }, [])

  const updateTheme = useCallback(async (updates: Partial<Theme>) => {
    const updatedTheme = { ...theme, ...updates }
    setThemeState(updatedTheme)
    try {
      await AsyncStorage.setItem("customTheme", JSON.stringify(updatedTheme))
    } catch (error) {
      console.error("Failed to save custom theme:", error)
    }
  }, [theme])

  const setBackgroundImage = useCallback(async (imageUri: string | null) => {
    const updatedTheme = { ...theme, backgroundImage: imageUri || undefined }
    setThemeState(updatedTheme)
    try {
      if (imageUri) {
        await AsyncStorage.setItem("backgroundImage", imageUri)
      } else {
        await AsyncStorage.removeItem("backgroundImage")
      }
    } catch (error) {
      console.error("Failed to save background image:", error)
    }
  }, [theme])

  const contextValue = useMemo(() => ({
    theme,
    currentThemeName,
    setTheme,
    toggleTheme,
    resetTheme,
    clearThemeCache,
    updateTheme,
    setBackgroundImage,
    predefinedThemes,
  }), [theme, currentThemeName, setTheme, toggleTheme, resetTheme, clearThemeCache, updateTheme, setBackgroundImage])

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

export type { Theme }
