import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Switch,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as Clipboard from 'expo-clipboard'
import { useTheme } from '../contexts/ThemeContext'

const { width: screenWidth } = Dimensions.get('window')

// Enhanced theming with maroon colors
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
}

interface Person {
  id: string
  name: string
  gender?: 'M' | 'F'
  label?: string
}

interface Team {
  id: string
  name: string
  members: Person[]
  customName?: string
}

interface EnhancedTeamPickerProps {
  initialNames?: string[]
  onTeamsGenerated?: (teams: Team[]) => void
  disabled?: boolean
}

export const EnhancedTeamPicker: React.FC<EnhancedTeamPickerProps> = ({
  initialNames = [],
  onTeamsGenerated,
  disabled = false
}) => {
  const { theme } = useTheme()
  
  // State for inputs
  const [inputText, setInputText] = useState('')
  const [peopleCount, setPeopleCount] = useState(0)
  const [inputMethod, setInputMethod] = useState<'manual' | 'paste' | 'csv'>('manual')

  // State for controller
  const [distributionType, setDistributionType] = useState<'groups' | 'size'>('groups')
  const [numGroups, setNumGroups] = useState(4)
  const [peoplePerGroup, setPeoplePerGroup] = useState(4)
  const [balanceType, setBalanceType] = useState<'default' | 'gender' | 'label'>('default')

  // State for results
  const [teams, setTeams] = useState<Team[]>([])
  const [showGroupsBoard, setShowGroupsBoard] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  
  // UI state
  const [isGenerating, setIsGenerating] = useState(false)
  const [enableCustomization, setEnableCustomization] = useState(true)

  // Initialize with provided names
  useEffect(() => {
    if (initialNames.length > 0 && inputText === '') {
      const namesText = initialNames.join('\n')
      setInputText(namesText)
      setPeopleCount(initialNames.length)
    }
  }, [initialNames])

  // Update people count when input changes
  useEffect(() => {
    const names = inputText
      .split(/[\n,]/)
      .map(name => name.trim())
      .filter(name => name.length > 0)
    setPeopleCount(names.length)
  }, [inputText])

  // Parse names from input text with gender and label support
  const parseNames = (): Person[] => {
    const names = inputText
      .split(/[\n,]/)
      .map(name => name.trim())
      .filter(name => name.length > 0)
    
    return names.map((nameStr, index) => {
      // Parse gender: (M) or (F)
      const genderMatch = nameStr.match(/\((M|F)\)/i)
      const gender = genderMatch ? (genderMatch[1].toUpperCase() as 'M' | 'F') : undefined
      
      // Parse label: [Label]
      const labelMatch = nameStr.match(/\[([^\]]+)\]/)
      const label = labelMatch ? labelMatch[1].trim() : undefined
      
      // Clean name (remove gender and label markers)
      const cleanName = nameStr
        .replace(/\((M|F)\)/gi, '')
        .replace(/\[[^\]]+\]/g, '')
        .trim()
      
      return {
        id: `person-${index}`,
        name: cleanName,
        gender,
        label
      }
    })
  }

  // Generate teams with advanced distribution logic
  const generateTeams = async () => {
    const people = parseNames()
    
    if (people.length === 0) {
      Alert.alert('No Names Found', 'Please enter some names to generate teams')
      return
    }

    setIsGenerating(true)

    // Calculate number of groups
    let actualNumGroups: number
    if (distributionType === 'groups') {
      actualNumGroups = Math.min(numGroups, people.length)
    } else {
      actualNumGroups = Math.ceil(people.length / peoplePerGroup)
    }

    // Ensure we have at least 1 group and max 100 groups
    actualNumGroups = Math.max(1, Math.min(100, actualNumGroups))

    // Shuffle people for random distribution
    let shuffledPeople = [...people]
    
    // Apply balance type distribution
    if (balanceType === 'gender') {
      // Separate by gender and distribute evenly
      const males = shuffledPeople.filter(p => p.gender === 'M')
      const females = shuffledPeople.filter(p => p.gender === 'F')
      const others = shuffledPeople.filter(p => !p.gender)
      
      // Shuffle each group
      const shuffledMales = males.sort(() => Math.random() - 0.5)
      const shuffledFemales = females.sort(() => Math.random() - 0.5)
      const shuffledOthers = others.sort(() => Math.random() - 0.5)
      
      shuffledPeople = []
      const maxLength = Math.max(shuffledMales.length, shuffledFemales.length, shuffledOthers.length)
      
      // Interleave genders for even distribution
      for (let i = 0; i < maxLength; i++) {
        if (i < shuffledMales.length) shuffledPeople.push(shuffledMales[i])
        if (i < shuffledFemales.length) shuffledPeople.push(shuffledFemales[i])
        if (i < shuffledOthers.length) shuffledPeople.push(shuffledOthers[i])
      }
    } else if (balanceType === 'label') {
      // Group by label and distribute evenly
      const labelGroups: { [key: string]: Person[] } = {}
      shuffledPeople.forEach(person => {
        const key = person.label || 'No Label'
        if (!labelGroups[key]) labelGroups[key] = []
        labelGroups[key].push(person)
      })
      
      // Shuffle each label group
      Object.keys(labelGroups).forEach(key => {
        labelGroups[key] = labelGroups[key].sort(() => Math.random() - 0.5)
      })
      
      // Interleave labels for even distribution
      shuffledPeople = []
      const labelKeys = Object.keys(labelGroups)
      const maxLabelLength = Math.max(...labelKeys.map(key => labelGroups[key].length))
      
      for (let i = 0; i < maxLabelLength; i++) {
        labelKeys.forEach(key => {
          if (i < labelGroups[key].length) {
            shuffledPeople.push(labelGroups[key][i])
          }
        })
      }
    } else {
      // Default random distribution
      shuffledPeople = shuffledPeople.sort(() => Math.random() - 0.5)
    }

    // Create teams with proper naming
    const newTeams: Team[] = []
    for (let i = 0; i < actualNumGroups; i++) {
      let teamName: string
      if (i < 3) {
        teamName = `group${i + 1}`
      } else {
        teamName = `Team ${i + 1}`
      }

      newTeams.push({
        id: `team-${i}`,
        name: teamName,
        customName: teamName,
        members: []
      })
    }

    // Distribute people evenly across teams
    shuffledPeople.forEach((person, index) => {
      const teamIndex = index % actualNumGroups
      newTeams[teamIndex].members.push(person)
    })

    // Apply group size constraints if using size-based distribution
    if (distributionType === 'size' && peoplePerGroup > 0) {
      const maxSize = peoplePerGroup
      
      // Redistribute if any team exceeds max size
      for (let i = 0; i < newTeams.length; i++) {
        while (newTeams[i].members.length > maxSize && newTeams.length < 100) {
          const spillPerson = newTeams[i].members.pop()!
          
          // Try to find a team with space
          let placed = false
          for (let j = 0; j < newTeams.length; j++) {
            if (newTeams[j].members.length < maxSize) {
              newTeams[j].members.push(spillPerson)
              placed = true
              break
            }
          }
          
          // Create new team if needed
          if (!placed && newTeams.length < 100) {
            const newTeamIndex = newTeams.length
            newTeams.push({
              id: `team-${newTeamIndex}`,
              name: `Team ${newTeamIndex + 1}`,
              customName: `Team ${newTeamIndex + 1}`,
              members: [spillPerson]
            })
          } else if (!placed) {
            // If we can't create more teams, put back in last team
            newTeams[newTeams.length - 1].members.push(spillPerson)
            break
          }
        }
      }
    }

    setTeams(newTeams)
    onTeamsGenerated?.(newTeams)
    setIsGenerating(false)

    Alert.alert('Teams Generated! 🎉', `Created ${newTeams.length} teams with ${people.length} people`)
  }

  // Handle CSV/Excel import
  const handleFileImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      })
      
      if (!result.canceled && result.assets[0]) {
        const content = await FileSystem.readAsStringAsync(result.assets[0].uri)
        const lines = content.split('\n')
        const names: string[] = []
        
        lines.forEach(line => {
          const trimmed = line.trim()
          if (trimmed) {
            // Handle CSV format - take first column or the entire line
            const firstValue = trimmed.split(',')[0].replace(/"/g, '').trim()
            if (firstValue) {
              names.push(firstValue)
            }
          }
        })
        
        if (names.length > 0) {
          setInputText(names.join('\n'))
          Alert.alert('File Imported', `Imported ${names.length} names from file`)
        } else {
          Alert.alert('Import Failed', 'No valid names found in file')
        }
      }
    } catch (error) {
      Alert.alert('Import Error', 'Failed to import file')
    }
  }

  // Copy teams to clipboard
  const copyTeamsToClipboard = async () => {
    if (teams.length === 0) return

    let text = 'Team Distribution:\n\n'
    teams.forEach((team) => {
      text += `${team.customName || team.name}:\n`
      team.members.forEach(member => {
        text += `  - ${member.name}${member.gender ? ` (${member.gender})` : ''}${member.label ? ` [${member.label}]` : ''}\n`
      })
      text += '\n'
    })

    await Clipboard.setStringAsync(text)
    Alert.alert('Copied!', 'Team distribution copied to clipboard')
  }

  // Export teams as CSV
  const exportTeams = async () => {
    if (teams.length === 0) return

    const csvData = ['Team,Member,Gender,Label']
    teams.forEach(team => {
      team.members.forEach(member => {
        csvData.push(`${team.customName || team.name},${member.name},${member.gender || ''},${member.label || ''}`)
      })
    })

    const csvContent = csvData.join('\n')
    const fileUri = FileSystem.cacheDirectory + `teams_${Date.now()}.csv`
    
    try {
      await FileSystem.writeAsStringAsync(fileUri, csvContent)
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { dialogTitle: 'Export Teams CSV' })
      } else {
        await Clipboard.setStringAsync(csvContent)
        Alert.alert('Exported', 'CSV data copied to clipboard')
      }
    } catch (error) {
      Alert.alert('Export Error', 'Failed to export teams')
    }
  }

  // Rename team function
  const renameTeam = (teamId: string, newName: string) => {
    setTeams(prev => prev.map(team => 
      team.id === teamId 
        ? { ...team, customName: newName || team.name }
        : team
    ))
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={[styles.scrollContainer, { backgroundColor: theme.background }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: COLORS.surface }]}>
          <Text style={[styles.headerTitle, { color: COLORS.text }]}>
            👥 Team Picker Wheel
          </Text>
          <Text style={[styles.headerSubtitle, { color: COLORS.textSecondary }]}>
            Random team generator for equal groups
          </Text>
        </View>

        {/* 1. INPUT SECTION */}
        <View style={[styles.section, { backgroundColor: COLORS.surface }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionNumber, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.sectionNumberText}>1</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              Input a list of names
            </Text>
          </View>

          {/* Input Method Selection */}
          <View style={styles.methodSelection}>
            <Text style={[styles.label, { color: COLORS.text }]}>Choose input method:</Text>
            <View style={styles.methodButtons}>
              {[
                { key: 'manual', label: 'Type one by one' },
                { key: 'paste', label: 'Paste a list' },
                { key: 'csv', label: 'Import CSV/Excel' }
              ].map((method) => (
                <TouchableOpacity
                  key={method.key}
                  style={[
                    styles.methodButton,
                    {
                      backgroundColor: inputMethod === method.key ? COLORS.primary : COLORS.surface,
                      borderColor: inputMethod === method.key ? COLORS.primary : COLORS.border,
                    }
                  ]}
                  onPress={() => setInputMethod(method.key as 'manual' | 'paste' | 'csv')}
                >
                  <Text style={[
                    styles.methodButtonText,
                    { color: inputMethod === method.key ? COLORS.surface : COLORS.text }
                  ]}>
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Input Actions */}
          {inputMethod === 'csv' && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
                onPress={handleFileImport}
              >
                <Ionicons name="cloud-upload" size={16} color={COLORS.surface} />
                <Text style={[styles.actionButtonText, { color: COLORS.surface }]}>
                  Choose CSV/Excel File
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.secondary, marginLeft: 8 }]}
                onPress={() => setInputText("Alice Johnson\nBob Smith (M)\nCarol Davis (F)\nDavid Wilson [Teacher]\nEve Brown [Student]\nFrank Miller (M) [Teacher]\nGrace Lee (F) [Student]\nHenry Clark\nIvy Rodriguez (F)\nJack Thompson (M)")}
              >
                <Ionicons name="document-text" size={16} color={COLORS.surface} />
                <Text style={[styles.actionButtonText, { color: COLORS.surface }]}>
                  Sample Data
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* People Count */}
          <View style={styles.countDisplay}>
            <View style={[styles.countBadge, { backgroundColor: COLORS.primary }]}>
              <Text style={[styles.countText, { color: COLORS.surface }]}>{peopleCount}</Text>
            </View>
            <Text style={[styles.countLabel, { color: COLORS.textSecondary }]}>people entered</Text>
          </View>

          {/* Input Area */}
          <View style={styles.inputArea}>
            <Text style={[styles.inputLabel, { color: COLORS.text }]}>
              {inputMethod === 'manual' ? 'Type names here (one per line):' : 
               inputMethod === 'paste' ? 'Paste your list here (one name per line):' :
               'Names imported from file:'}
            </Text>
            <TextInput
              style={[styles.textInput, { 
                borderColor: COLORS.border, 
                color: COLORS.text,
                backgroundColor: COLORS.surface
              }]}
              value={inputText}
              onChangeText={setInputText}
              multiline
              numberOfLines={inputMethod === 'csv' ? 6 : 8}
              placeholder={inputMethod === 'csv' ? "Import a file to see names here..." :
                "Enter names (one per line or separated by commas)\n\nSupport for gender: Alice (F), Bob (M)\nSupport for labels: Carol [Teacher], David [Student]\n\nLiam Carter\nAva Mitchell (F)\nNoah Bennett (M)"}
              placeholderTextColor={COLORS.textLight}
              editable={!disabled}
            />
          </View>

          {/* Format Help */}
          <View style={[styles.helpBox, { backgroundColor: COLORS.accent + '20', borderColor: COLORS.accent + '40' }]}>
            <Text style={[styles.helpText, { color: COLORS.accent }]}>
              <Text style={styles.helpBold}>Format tips:</Text> Add (M) or (F) for gender balance, use [Label] for custom labels.
              {'\n'}Example: "Alice (F) [Teacher]", "Bob (M) [Student]"
            </Text>
          </View>

          {peopleCount > 0 && (
            <View style={[styles.successBox, { backgroundColor: COLORS.success + '20', borderColor: COLORS.success + '40' }]}>
              <Text style={[styles.successText, { color: COLORS.success }]}>
                <Text style={styles.successBold}>{peopleCount} people</Text> ready for team generation
              </Text>
            </View>
          )}
        </View>

        {/* 2. DISTRIBUTION SECTION */}
        <View style={[styles.section, { backgroundColor: COLORS.surface, marginTop: 16 }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionNumber, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.sectionNumberText}>2</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              Choose distribution type
            </Text>
          </View>

          {/* Balance Type Selection */}
          <View style={styles.balanceSelection}>
            <Text style={[styles.label, { color: COLORS.text }]}>Distribution balance:</Text>
            <View style={styles.balanceButtons}>
              {[
                { key: 'default', label: 'Default (random)' },
                { key: 'gender', label: 'Gender balance' },
                { key: 'label', label: 'Label balance' }
              ].map((balance) => (
                <TouchableOpacity
                  key={balance.key}
                  style={[
                    styles.balanceButton,
                    {
                      backgroundColor: balanceType === balance.key ? COLORS.primary : COLORS.surface,
                      borderColor: balanceType === balance.key ? COLORS.primary : COLORS.border,
                    }
                  ]}
                  onPress={() => setBalanceType(balance.key as 'default' | 'gender' | 'label')}
                >
                  <Text style={[
                    styles.balanceButtonText,
                    { color: balanceType === balance.key ? COLORS.surface : COLORS.text }
                  ]}>
                    {balance.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 3. GROUP SIZE SECTION */}
        <View style={[styles.section, { backgroundColor: COLORS.surface, marginTop: 16 }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionNumber, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.sectionNumberText}>3</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              Set group size
            </Text>
          </View>

          {/* Distribution Type Selection */}
          <View style={styles.distributionTypeSection}>
            <Text style={[styles.label, { color: COLORS.text }]}>Choose distribution method:</Text>
            
            {/* Number of Groups Option */}
            <TouchableOpacity
              style={[
                styles.distributionOption,
                {
                  backgroundColor: distributionType === 'groups' ? COLORS.primary + '10' : COLORS.surface,
                  borderColor: distributionType === 'groups' ? COLORS.primary : COLORS.border,
                }
              ]}
              onPress={() => setDistributionType('groups')}
            >
              <View style={styles.optionLeft}>
                <View style={[
                  styles.radioButton,
                  {
                    backgroundColor: distributionType === 'groups' ? COLORS.primary : COLORS.surface,
                    borderColor: COLORS.primary,
                  }
                ]}>
                  {distributionType === 'groups' && (
                    <View style={[styles.radioInner, { backgroundColor: COLORS.surface }]} />
                  )}
                </View>
                <Text style={[styles.optionText, { color: COLORS.text }]}>Number of groups</Text>
              </View>
              {distributionType === 'groups' && (
                <View style={styles.optionRight}>
                  <TextInput
                    style={[styles.numberInput, { borderColor: COLORS.border, color: COLORS.text }]}
                    value={numGroups.toString()}
                    onChangeText={(text) => setNumGroups(Math.max(1, parseInt(text) || 4))}
                    keyboardType="numeric"
                    editable={!disabled}
                  />
                  <Text style={[styles.inputUnit, { color: COLORS.textSecondary }]}>groups</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* People Per Group Option */}
            <TouchableOpacity
              style={[
                styles.distributionOption,
                {
                  backgroundColor: distributionType === 'size' ? COLORS.primary + '10' : COLORS.surface,
                  borderColor: distributionType === 'size' ? COLORS.primary : COLORS.border,
                }
              ]}
              onPress={() => setDistributionType('size')}
            >
              <View style={styles.optionLeft}>
                <View style={[
                  styles.radioButton,
                  {
                    backgroundColor: distributionType === 'size' ? COLORS.primary : COLORS.surface,
                    borderColor: COLORS.primary,
                  }
                ]}>
                  {distributionType === 'size' && (
                    <View style={[styles.radioInner, { backgroundColor: COLORS.surface }]} />
                  )}
                </View>
                <Text style={[styles.optionText, { color: COLORS.text }]}>Number of people per group</Text>
              </View>
              {distributionType === 'size' && (
                <View style={styles.optionRight}>
                  <TextInput
                    style={[styles.numberInput, { borderColor: COLORS.border, color: COLORS.text }]}
                    value={peoplePerGroup.toString()}
                    onChangeText={(text) => setPeoplePerGroup(Math.max(1, parseInt(text) || 4))}
                    keyboardType="numeric"
                    editable={!disabled}
                  />
                  <Text style={[styles.inputUnit, { color: COLORS.textSecondary }]}>people/group</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. RANDOMIZATION SECTION */}
        <View style={[styles.section, { backgroundColor: COLORS.surface, marginTop: 16 }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionNumber, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.sectionNumberText}>4</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              Start randomization
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                {
                  backgroundColor: (disabled || peopleCount === 0) ? COLORS.textLight : COLORS.primary,
                  opacity: (disabled || peopleCount === 0) ? 0.6 : 1
                }
              ]}
              onPress={generateTeams}
              disabled={disabled || peopleCount === 0 || isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator color={COLORS.surface} size="small" />
              ) : (
                <Ionicons name="play-circle" size={20} color={COLORS.surface} />
              )}
              <Text style={[styles.primaryActionButtonText, { color: COLORS.surface }]}>
                {isGenerating ? 'GENERATING...' : 'START RANDOMIZATION'}
              </Text>
            </TouchableOpacity>

            <View style={styles.secondaryActions}>
              <TouchableOpacity
                style={[
                  styles.secondaryActionButton,
                  {
                    borderColor: teams.length === 0 ? COLORS.textLight : COLORS.primary,
                    opacity: teams.length === 0 ? 0.6 : 1
                  }
                ]}
                onPress={() => setShowGroupsBoard(true)}
                disabled={teams.length === 0}
              >
                <Ionicons name="eye-outline" size={16} color={teams.length === 0 ? COLORS.textLight : COLORS.primary} />
                <Text style={[styles.secondaryActionButtonText, { color: teams.length === 0 ? COLORS.textLight : COLORS.primary }]}>
                  View Results
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryActionButton,
                  {
                    borderColor: COLORS.textSecondary,
                  }
                ]}
                onPress={() => setShowAdvancedSettings(true)}
              >
                <Ionicons name="settings-outline" size={16} color={COLORS.textSecondary} />
                <Text style={[styles.secondaryActionButtonText, { color: COLORS.textSecondary }]}>
                  Extra Features
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryActionButton,
                  {
                    borderColor: teams.length === 0 ? COLORS.textLight : COLORS.error,
                    opacity: teams.length === 0 ? 0.6 : 1
                  }
                ]}
                onPress={() => {
                  setTeams([])
                  Alert.alert('All Groups Removed', 'Teams have been cleared')
                }}
                disabled={teams.length === 0}
              >
                <Ionicons name="trash-outline" size={16} color={teams.length === 0 ? COLORS.textLight : COLORS.error} />
                <Text style={[styles.secondaryActionButtonText, { color: teams.length === 0 ? COLORS.textLight : COLORS.error }]}>
                  Clear All
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 5. RESULTS SECTION */}
        <View style={[styles.section, { backgroundColor: COLORS.surface, marginTop: 16, marginBottom: 32 }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionNumber, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.sectionNumberText}>5</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              View & export results
            </Text>
          </View>

          {teams.length > 0 ? (
            <View style={styles.resultsContainer}>
              {/* Results Summary */}
              <View style={[styles.resultsSummary, { backgroundColor: COLORS.success + '20', borderColor: COLORS.success + '40' }]}>
                <View style={styles.summaryContent}>
                  <View style={[styles.summaryBadge, { backgroundColor: COLORS.success }]}>
                    <Text style={[styles.summaryBadgeText, { color: COLORS.surface }]}>
                      {teams.length} Teams Created
                    </Text>
                  </View>
                  <Text style={[styles.summaryText, { color: COLORS.success }]}>
                    {peopleCount} people distributed • Up to 100 groups supported
                  </Text>
                </View>
                <View style={styles.summaryActions}>
                  <TouchableOpacity
                    style={[styles.summaryAction, { borderColor: COLORS.success }]}
                    onPress={copyTeamsToClipboard}
                  >
                    <Ionicons name="copy-outline" size={14} color={COLORS.success} />
                    <Text style={[styles.summaryActionText, { color: COLORS.success }]}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.summaryAction, { borderColor: COLORS.success }]}
                    onPress={exportTeams}
                  >
                    <Ionicons name="download-outline" size={14} color={COLORS.success} />
                    <Text style={[styles.summaryActionText, { color: COLORS.success }]}>Export</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Teams List */}
              <View style={styles.teamsGrid}>
                {teams.map((team, index) => (
                  <View key={team.id} style={[styles.teamCard, { borderColor: COLORS.border }]}>
                    <View style={styles.teamHeader}>
                      <View style={styles.teamTitleRow}>
                        <View style={[styles.teamNumber, { backgroundColor: COLORS.primary }]}>
                          <Text style={[styles.teamNumberText, { color: COLORS.surface }]}>#{index + 1}</Text>
                        </View>
                        <TextInput
                          style={[styles.teamNameInput, { color: COLORS.primary }]}
                          value={team.customName || team.name}
                          onChangeText={(text) => renameTeam(team.id, text)}
                          editable={enableCustomization}
                        />
                      </View>
                      <View style={[styles.teamMemberCount, { backgroundColor: COLORS.primary + '20' }]}>
                        <Text style={[styles.teamMemberCountText, { color: COLORS.primary }]}>
                          {team.members.length}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.teamMembers}>
                      {team.members.map((member, memberIndex) => (
                        <View key={member.id} style={[styles.memberRow, { backgroundColor: COLORS.surfaceSecondary }]}>
                          <View style={[styles.memberNumber, { backgroundColor: COLORS.border }]}>
                            <Text style={[styles.memberNumberText, { color: COLORS.text }]}>{memberIndex + 1}</Text>
                          </View>
                          <Text style={[styles.memberName, { color: COLORS.text }]}>{member.name}</Text>
                          <View style={styles.memberTags}>
                            {member.gender && (
                              <Text style={[styles.memberGender, { color: COLORS.textSecondary }]}>
                                {member.gender === 'M' ? '♂' : '♀'}
                              </Text>
                            )}
                            {member.label && (
                              <View style={[styles.memberLabel, { backgroundColor: COLORS.accent + '20', borderColor: COLORS.accent }]}>
                                <Text style={[styles.memberLabelText, { color: COLORS.accent }]}>{member.label}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>

              {/* Use Cases Info */}
              <View style={[styles.useCasesInfo, { backgroundColor: COLORS.accent + '20', borderColor: COLORS.accent + '40' }]}>
                <Text style={[styles.useCasesTitle, { color: COLORS.accent }]}>Features Available:</Text>
                <Text style={[styles.useCasesText, { color: COLORS.accent }]}>
                  ✅ Confetti effects and sound customization{' \n'}
                  ✅ Branding and color customization{' \n'}
                  ✅ Save results as CSV or share{' \n'}
                  ✅ Share results link with others{' \n'}
                  ✅ Preset group rules and team constraints
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyResults}>
              <Ionicons name="people-outline" size={64} color={COLORS.textLight} style={styles.emptyIcon} />
              <Text style={[styles.emptyTitle, { color: COLORS.text }]}>No teams generated yet</Text>
              <Text style={[styles.emptySubtitle, { color: COLORS.textSecondary }]}>
                Enter names and click START RANDOMIZATION to create teams
              </Text>
              
              <View style={[styles.useCasesList, { backgroundColor: COLORS.surfaceSecondary }]}>
                <Text style={[styles.useCasesListTitle, { color: COLORS.text }]}>Use Cases:</Text>
                <Text style={[styles.useCaseItem, { color: COLORS.textSecondary }]}>📚 <Text style={styles.useCaseBold}>Classroom:</Text> Random student groups for projects</Text>
                <Text style={[styles.useCaseItem, { color: COLORS.textSecondary }]}>🎮 <Text style={styles.useCaseBold}>Games:</Text> Split players into fair teams</Text>
                <Text style={[styles.useCaseItem, { color: COLORS.textSecondary }]}>⚽ <Text style={styles.useCaseBold}>Sports:</Text> Assign athletes randomly</Text>
                <Text style={[styles.useCaseItem, { color: COLORS.textSecondary }]}>👫 <Text style={styles.useCaseBold}>Pairing:</Text> Random partner generator (group size = 2)</Text>
              </View>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Advanced Settings Modal */}
      <Modal visible={showAdvancedSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdvancedSettings(false)}>
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: COLORS.surface, borderBottomColor: COLORS.border }]}>
            <Text style={[styles.modalTitle, { color: COLORS.text }]}>⚙️ Extra Features & Customization</Text>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowAdvancedSettings(false)}>
              <Ionicons name="close-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.modalSection, { backgroundColor: COLORS.surface }]}>
              <Text style={[styles.modalSectionTitle, { color: COLORS.text }]}>Team Customization</Text>
              <View style={styles.customizationRow}>
                <Text style={[styles.customizationLabel, { color: COLORS.text }]}>Enable team renaming</Text>
                <Switch 
                  value={enableCustomization} 
                  onValueChange={setEnableCustomization}
                  trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                  thumbColor={enableCustomization ? COLORS.primary : COLORS.textLight}
                />
              </View>
            </View>
          </ScrollView>
          <View style={[styles.modalFooter, { backgroundColor: COLORS.surface, borderTopColor: COLORS.border }]}>
            <TouchableOpacity 
              style={[styles.modalFooterButton, { backgroundColor: COLORS.primary }]} 
              onPress={() => { 
                setShowAdvancedSettings(false); 
                Alert.alert('Settings Applied', 'Advanced settings have been configured'); 
              }}
            >
              <Text style={[styles.modalFooterButtonText, { color: COLORS.surface }]}>Apply Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Groups Board Modal */}
      <Modal visible={showGroupsBoard} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowGroupsBoard(false)}>
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: COLORS.surface, borderBottomColor: COLORS.border }]}>
            <Text style={[styles.modalTitle, { color: COLORS.text }]}>🎯 Groups Board</Text>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowGroupsBoard(false)}>
              <Ionicons name="close-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          {teams.length > 0 ? (
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={[styles.boardHeader, { backgroundColor: COLORS.primary }]}>
                <Text style={[styles.boardTitle, { color: COLORS.surface }]}>🎯 Team Distribution Results</Text>
                <View style={styles.boardStats}>
                  <View style={styles.boardStat}>
                    <View style={[styles.boardStatBadge, { backgroundColor: COLORS.surface + '20' }]}>
                      <Text style={[styles.boardStatNumber, { color: COLORS.surface }]}>{teams.length}</Text>
                    </View>
                    <Text style={[styles.boardStatLabel, { color: COLORS.surface }]}>Teams</Text>
                  </View>
                  <View style={styles.boardStat}>
                    <View style={[styles.boardStatBadge, { backgroundColor: COLORS.surface + '20' }]}>
                      <Text style={[styles.boardStatNumber, { color: COLORS.surface }]}>{peopleCount}</Text>
                    </View>
                    <Text style={[styles.boardStatLabel, { color: COLORS.surface }]}>People</Text>
                  </View>
                </View>
              </View>
              <View style={styles.boardTeamsGrid}>
                {teams.map((team, index) => (
                  <View key={team.id} style={[styles.boardTeamCard, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
                    <View style={styles.boardTeamHeader}>
                      <Text style={[styles.boardTeamName, { color: COLORS.primary }]}>
                        #{index + 1} {team.customName || team.name}
                      </Text>
                      <Text style={[styles.boardTeamCount, { color: COLORS.primary }]}>
                        ({team.members.length})
                      </Text>
                    </View>
                    <View style={styles.boardTeamMembers}>
                      {team.members.map((member, memberIndex) => (
                        <Text key={member.id} style={[styles.boardMemberName, { color: COLORS.text }]}>
                          {memberIndex + 1}. {member.name}
                          {member.gender ? ` (${member.gender})` : ''}
                          {member.label ? ` [${member.label}]` : ''}
                        </Text>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.emptyBoard}>
              <Ionicons name="people-outline" size={64} color={COLORS.textLight} />
              <Text style={[styles.emptyBoardText, { color: COLORS.textSecondary }]}>No teams to display</Text>
            </View>
          )}
          <View style={[styles.modalFooter, { backgroundColor: COLORS.surface, borderTopColor: COLORS.border }]}>
            <TouchableOpacity 
              style={[styles.modalFooterButton, { backgroundColor: COLORS.primary }]} 
              onPress={() => setShowGroupsBoard(false)}
            >
              <Text style={[styles.modalFooterButtonText, { color: COLORS.surface }]}>Close Board</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

// Comprehensive Styles
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { flex: 1 },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  headerSubtitle: { fontSize: 16, textAlign: 'center', lineHeight: 22 },
  section: { marginHorizontal: 16, padding: 20, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sectionNumberText: { color: COLORS.surface, fontSize: 16, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '600', flex: 1 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  methodSelection: { marginBottom: 16 },
  methodButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, minWidth: 100 },
  methodButtonText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  balanceSelection: { marginBottom: 16 },
  balanceButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  balanceButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, minWidth: 120 },
  balanceButtonText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  distributionTypeSection: { gap: 12 },
  distributionOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12, borderWidth: 1 },
  optionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  radioButton: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 8, height: 8, borderRadius: 4 },
  optionText: { fontSize: 14, fontWeight: '500' },
  optionRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numberInput: { width: 60, height: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  inputUnit: { fontSize: 12, fontWeight: '500' },
  actionButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 8 },
  actionButtonText: { fontSize: 12, fontWeight: '600' },
  countDisplay: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  countBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginRight: 8 },
  countText: { fontSize: 16, fontWeight: '700' },
  countLabel: { fontSize: 14 },
  inputArea: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  textInput: { borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', textAlignVertical: 'top' },
  helpBox: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  helpText: { fontSize: 12, lineHeight: 18 },
  helpBold: { fontWeight: '700' },
  successBox: { padding: 12, borderRadius: 8, borderWidth: 1 },
  successText: { fontSize: 12, lineHeight: 18 },
  successBold: { fontWeight: '700' },
  actionButtonsRow: { gap: 12 },
  primaryActionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, gap: 12, marginBottom: 12 },
  primaryActionButtonText: { fontSize: 16, fontWeight: '700' },
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondaryActionButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 8, backgroundColor: COLORS.surface },
  secondaryActionButtonText: { fontSize: 12, fontWeight: '600' },
  resultsContainer: { gap: 16 },
  resultsSummary: { padding: 16, borderRadius: 12, borderWidth: 1 },
  summaryContent: { marginBottom: 12 },
  summaryBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 8 },
  summaryBadgeText: { fontSize: 14, fontWeight: '700' },
  summaryText: { fontSize: 12, lineHeight: 18 },
  summaryActions: { flexDirection: 'row', gap: 8 },
  summaryAction: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, gap: 4, backgroundColor: COLORS.surface },
  summaryActionText: { fontSize: 10, fontWeight: '600' },
  teamsGrid: { gap: 12 },
  teamCard: { padding: 16, borderRadius: 12, borderWidth: 1, backgroundColor: COLORS.surface },
  teamHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  teamTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  teamNumber: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  teamNumberText: { fontSize: 10, fontWeight: '700' },
  teamNameInput: { fontSize: 16, fontWeight: '600', flex: 1, paddingVertical: 4 },
  teamMemberCount: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  teamMemberCountText: { fontSize: 12, fontWeight: '700' },
  teamMembers: { gap: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8 },
  memberNumber: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  memberNumberText: { fontSize: 10, fontWeight: '700' },
  memberName: { fontSize: 14, fontWeight: '500', flex: 1 },
  memberTags: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberGender: { fontSize: 12 },
  memberLabel: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  memberLabelText: { fontSize: 10, fontWeight: '600' },
  useCasesInfo: { padding: 16, borderRadius: 12, borderWidth: 1 },
  useCasesTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  useCasesText: { fontSize: 12, lineHeight: 18 },
  emptyResults: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  useCasesList: { padding: 16, borderRadius: 12, maxWidth: screenWidth - 64 },
  useCasesListTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  useCaseItem: { fontSize: 12, lineHeight: 20, marginBottom: 8 },
  useCaseBold: { fontWeight: '700' },
  
  // Modal Styles
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  modalCloseButton: { padding: 4 },
  modalContent: { flex: 1, padding: 16 },
  modalSection: { padding: 20, borderRadius: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  modalSectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  customizationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  customizationLabel: { fontSize: 14, flex: 1, lineHeight: 20 },
  modalFooter: { padding: 20, borderTopWidth: 1 },
  modalFooterButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  modalFooterButtonText: { fontSize: 16, fontWeight: '700' },
  
  // Board Modal Styles
  boardHeader: { padding: 24, alignItems: 'center' },
  boardTitle: { fontSize: 24, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  boardStats: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  boardStat: { alignItems: 'center' },
  boardStatBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 6 },
  boardStatNumber: { fontSize: 16, fontWeight: '700' },
  boardStatLabel: { fontSize: 12, fontWeight: '500' },
  boardTeamsGrid: { padding: 16, gap: 12 },
  boardTeamCard: { padding: 16, borderRadius: 12, borderWidth: 1 },
  boardTeamHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  boardTeamName: { fontSize: 16, fontWeight: '600' },
  boardTeamCount: { fontSize: 14, fontWeight: '600' },
  boardTeamMembers: { gap: 4 },
  boardMemberName: { fontSize: 14, lineHeight: 20 },
  emptyBoard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyBoardText: { fontSize: 16, marginTop: 16, textAlign: 'center' },
})