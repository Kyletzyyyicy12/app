import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  Modal,
  FlatList,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import ConfettiCannon from 'react-native-confetti-cannon';
import { db } from '../config/firebaseConfig';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#8e0b16',
  surface: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  success: '#10b981',
};

interface Person {
  id: string;
  name: string;
  gender?: 'M' | 'F';
  label?: string;
  isLeader?: boolean;
}

interface Team {
  id: string;
  name: string;
  customName?: string;
  members: Person[];
}

type DistributionType = 'groups' | 'size';
type BalanceType = 'default' | 'label'; // Removed gender option

interface TeamPickerScreenProps {
  sessionId?: string;
}

const TeamPickerScreen: React.FC<TeamPickerScreenProps> = ({ sessionId }) => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  // State for inputs
  const [inputText, setInputText] = useState('');
  const [peopleCount, setPeopleCount] = useState(0);
  
  // State for controller
  const [distributionType, setDistributionType] = useState<DistributionType>('groups');
  const [numGroups, setNumGroups] = useState(4);
  const [peoplePerGroup, setPeoplePerGroup] = useState(4);
  const [balanceType, setBalanceType] = useState<BalanceType>('default');
  
  // State for results
  const [teams, setTeams] = useState<Team[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  // State for Configure Names modal
  const [showConfigureModal, setShowConfigureModal] = useState(false);
  const [configuredPeople, setConfiguredPeople] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Update people count when input changes
  useEffect(() => {
    const names = inputText
      .split(/[\n,]/)
      .map(name => name.trim())
      .filter(name => name.length > 0);
    setPeopleCount(names.length);
  }, [inputText]);

  // Parse names from input text with gender and label support
  const parseNames = (): Person[] => {
    const names = inputText
      .split(/[\n,]/)
      .map(name => name.trim())
      .filter(name => name.length > 0);
    
    return names.map((nameStr, index) => {
      const genderMatch = nameStr.match(/\((M|F)\)/i);
      const gender = genderMatch ? (genderMatch[1].toUpperCase() as 'M' | 'F') : undefined;
      
      const labelMatch = nameStr.match(/\[([^\]]+)\]/);
      const label = labelMatch ? labelMatch[1].trim() : undefined;
      
      const cleanName = nameStr
        .replace(/\((M|F)\)/gi, '')
        .replace(/\[[^\]]+\]/g, '')
        .trim();
      
      return {
        id: `person-${index}`,
        name: cleanName,
        gender,
        label
      };
    });
  };

  // Generate teams with advanced distribution logic
  const generateTeams = () => {
    const people = parseNames();
    
    if (people.length === 0) {
      Alert.alert('No Names Found', 'Please enter some names to generate teams');
      return;
    }

    // Validate sessionId if provided
    if (sessionId && (typeof sessionId !== 'string' || sessionId.trim().length === 0)) {
      console.error('❌ Invalid sessionId provided:', sessionId);
      Alert.alert('Warning', 'Invalid session ID. Teams will be generated locally only.');
    }

    let actualNumGroups: number;
    if (distributionType === 'groups') {
      actualNumGroups = Math.min(numGroups, people.length);
    } else {
      actualNumGroups = Math.ceil(people.length / peoplePerGroup);
    }

    actualNumGroups = Math.max(1, Math.min(100, actualNumGroups));

    let shuffledPeople = [...people];
    
    // Apply balance type distribution (removed gender balance)
    if (balanceType === 'label') {
      const labelGroups: { [key: string]: Person[] } = {};
      shuffledPeople.forEach(person => {
        const key = person.label || 'No Label';
        if (!labelGroups[key]) labelGroups[key] = [];
        labelGroups[key].push(person);
      });
      
      Object.keys(labelGroups).forEach(key => {
        labelGroups[key] = labelGroups[key].sort(() => Math.random() - 0.5);
      });
      
      shuffledPeople = [];
      const labelKeys = Object.keys(labelGroups);
      const maxLabelLength = Math.max(...labelKeys.map(key => labelGroups[key].length));
      
      for (let i = 0; i < maxLabelLength; i++) {
        labelKeys.forEach(key => {
          if (i < labelGroups[key].length) {
            shuffledPeople.push(labelGroups[key][i]);
          }
        });
      }
    } else {
      shuffledPeople = shuffledPeople.sort(() => Math.random() - 0.5);
    }

    const newTeams: Team[] = [];
    for (let i = 0; i < actualNumGroups; i++) {
      let teamName: string;
      if (i < 3) {
        teamName = `group${i + 1}`;
      } else {
        teamName = `Team ${i + 1}`;
      }

      newTeams.push({
        id: `team-${i}`,
        name: teamName,
        customName: teamName,
        members: []
      });
    }

    shuffledPeople.forEach((person, index) => {
      const teamIndex = index % actualNumGroups;
      newTeams[teamIndex].members.push(person);
    });

    setTeams(newTeams);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);

    // 🔥 CRITICAL: Broadcast teams to Firebase for participants to see
    if (sessionId && typeof sessionId === 'string' && sessionId.trim().length > 0) {
      console.log('🚀 BROADCASTING TEAMS TO FIREBASE:', {
        sessionId,
        teamsCount: newTeams.length,
        totalPeople: people.length,
        timestamp: new Date().toISOString()
      });

      // Clean teams data - remove any undefined fields
      const cleanTeams = newTeams.map((team, index) => ({
        id: team.id || `team-${index}-${Date.now()}`,
        name: team.name || `Team ${index + 1}`,
        customName: team.customName || team.name || `Team ${index + 1}`,
        members: team.members.map((member, memberIndex) => {
          const cleanMember: any = {
            id: member.id || `person-${memberIndex}-${Date.now()}`,
            name: member.name || 'Unknown'
          };
          
          // Only add optional fields if they have values
          if (member.gender) {
            cleanMember.gender = member.gender;
          }
          if (member.label) {
            cleanMember.label = member.label;
          }
          
          return cleanMember;
        })
      }));

      console.log('🧹 Clean teams data:', JSON.stringify(cleanTeams, null, 2));

      // Validate that sessionId exists as a document before updating
      try {
        updateDoc(doc(db, 'liveDrawSessions', sessionId), {
          teams: cleanTeams,
          teamsUpdatedAt: serverTimestamp(),
          teamRandomizationComplete: true,
          updatedAt: serverTimestamp()
        }).then(() => {
          console.log('✅ TEAMS SUCCESSFULLY BROADCAST TO PARTICIPANTS');
          Alert.alert('Teams Generated! 🎉', `Created ${newTeams.length} teams with ${people.length} people\n\nParticipants can now see the results!`);
        }).catch((error) => {
          console.error('❌ ERROR BROADCASTING TEAMS:', error);
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          console.error('Session ID:', sessionId);
          Alert.alert('Teams Generated! 🎉', `Created ${newTeams.length} teams with ${people.length} people\n\nNote: Failed to sync with participants.\n${error.message}`);
        });
      } catch (error) {
        console.error('❌ CRITICAL ERROR IN UPDATEDOC:', error);
        Alert.alert('Teams Generated! 🎉', `Created ${newTeams.length} teams with ${people.length} people\n\nNote: Could not sync with participants.`);
      }
    } else {
      console.log('⚠️ No valid sessionId provided, teams generated locally only');
      Alert.alert('Teams Generated! 🎉', `Created ${newTeams.length} teams with ${people.length} people`);
    }
  };

  const resetAll = () => {
    setInputText('');
    setTeams([]);
    setPeopleCount(0);
    setDistributionType('groups');
    setBalanceType('default');
    setNumGroups(4);
    setPeoplePerGroup(4);
    setConfiguredPeople([]);
  };

  // File upload handler
  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
        copyToCacheDirectory: true,
      });

      // Check if user cancelled
      if (result.canceled) {
        return;
      }

      // Get the first selected file
      if (result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const fileUri = file.uri;
        const fileName = file.name;

        // Read file content
        const fileContent = await FileSystem.readAsStringAsync(fileUri);

        // Parse the file content
        let names: string[] = [];
        
        if (fileName.endsWith('.csv')) {
          // Parse CSV - assume one name per line or comma-separated
          names = fileContent.split(/[\n,]/).map(name => name.trim()).filter(name => name.length > 0);
        } else {
          // Parse text/word - assume one name per line
          names = fileContent.split('\n').map(name => name.trim()).filter(name => name.length > 0);
        }

        // Set the input text with the parsed names
        setInputText(names.join('\n'));
        Alert.alert('Success', `Loaded ${names.length} names from file`);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Error', 'Failed to read file. Please try again.');
    }
  };

  // Open Configure Names modal
  const openConfigureModal = () => {
    const people = parseNames();
    console.log('📝 Opening Configure Modal:', {
      inputText,
      peopleCount: people.length,
      people: people.map(p => p.name)
    });
    
    if (people.length === 0) {
      Alert.alert('No Names', 'Please enter some names first');
      return;
    }
    
    setConfiguredPeople(people);
    setSearchQuery(''); // Clear search when opening
    setShowConfigureModal(true);
  };

  // Save configured people and update input text
  const saveConfiguredPeople = () => {
    const formattedNames = configuredPeople.map(person => {
      let nameStr = person.name;
      if (person.label) {
        nameStr += ` [${person.label}]`;
      }
      if (person.gender) {
        nameStr += ` (${person.gender})`;
      }
      return nameStr;
    }).join('\n');
    
    setInputText(formattedNames);
    setShowConfigureModal(false);
    Alert.alert('Success', 'Names configured successfully');
  };

  // Update person in configured list
  const updateConfiguredPerson = (index: number, field: keyof Person, value: any) => {
    const updated = [...configuredPeople];
    updated[index] = { ...updated[index], [field]: value };
    setConfiguredPeople(updated);
  };

  // Filtered people for search
  const filteredPeople = searchQuery.trim() === '' 
    ? configuredPeople 
    : configuredPeople.filter(person =>
        person.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

  // Debug logging
  useEffect(() => {
    if (showConfigureModal) {
      console.log('🔍 Configure Modal State:', {
        configuredPeopleCount: configuredPeople.length,
        searchQuery,
        filteredPeopleCount: filteredPeople.length,
        configuredPeople: configuredPeople.map(p => p.name),
        filteredPeople: filteredPeople.map(p => p.name)
      });
    }
  }, [showConfigureModal, configuredPeople, filteredPeople, searchQuery]);

  // Radio Button Component
  const RadioButton = ({ selected, onPress, label }: { selected: boolean; onPress: () => void; label: string }) => (
    <TouchableOpacity onPress={onPress} style={styles.radioButton}>
      <View style={[styles.radioCircle, selected && styles.radioSelected]} />
      <Text style={[styles.radioLabel, { color: theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {showConfetti && (
        <ConfettiCannon
          count={200}
          origin={{ x: width / 2, y: 0 }}
          autoStart
          fadeOut
        />
      )}

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Team Picker Wheel – Random Team Generator</Text>
        <TouchableOpacity onPress={resetAll} style={styles.resetButton}>
          <Ionicons name="refresh" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Split names into equal groups, pairs, or custom sizes. Balance by labels.
        </Text>

        <View style={styles.gridContainer}>
          {/* Input Names Section */}
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.badge, { backgroundColor: COLORS.primary }]}>
                <Text style={styles.badgeText}>1</Text>
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Input Names</Text>
            </View>

            <View style={styles.peopleCount}>
              <View style={[styles.badge, { backgroundColor: COLORS.primary }]}>
                <Text style={styles.badgeText}>{peopleCount}</Text>
              </View>
              <Text style={[styles.countLabel, { color: theme.textSecondary }]}>people</Text>
            </View>

            <TextInput
              style={[styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
              placeholder="Enter names (one per line)

Alice
Bob
Carol [Teacher]"
              placeholderTextColor={theme.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              numberOfLines={6}
            />

            {/* File Upload and Configure Buttons */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#3b82f6' }]}
                onPress={handleFileUpload}
              >
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Upload File</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#8b5cf6' }]}
                onPress={openConfigureModal}
              >
                <Ionicons name="settings-outline" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Configure Names</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.helpBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
              <Text style={[styles.helpText, { color: '#1e40af' }]}>
                <Text style={{ fontWeight: 'bold' }}>Tips:</Text> Upload CSV/Word file or configure leaders & labels
              </Text>
            </View>
          </View>

          {/* Setup & Distribution Section */}
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.badge, { backgroundColor: COLORS.primary }]}>
                <Text style={styles.badgeText}>2</Text>
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Setup & Distribution</Text>
            </View>

            {/* Balance Type */}
            <Text style={[styles.label, { color: theme.text }]}>Distribution balance:</Text>
            <View style={styles.radioGroup}>
              <RadioButton
                selected={balanceType === 'default'}
                onPress={() => setBalanceType('default')}
                label="Random"
              />
              <RadioButton
                selected={balanceType === 'label'}
                onPress={() => setBalanceType('label')}
                label="Label balance"
              />
            </View>

            {/* Group Size */}
            <Text style={[styles.label, { color: theme.text }]}>Group size method:</Text>
            <View style={styles.radioGroup}>
              <View style={styles.radioWithInput}>
                <RadioButton
                  selected={distributionType === 'groups'}
                  onPress={() => setDistributionType('groups')}
                  label="Number of groups"
                />
                {distributionType === 'groups' && (
                  <TextInput
                    style={[styles.numberInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    value={numGroups.toString()}
                    onChangeText={(text) => setNumGroups(Math.max(1, parseInt(text) || 4))}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                )}
              </View>
              <View style={styles.radioWithInput}>
                <RadioButton
                  selected={distributionType === 'size'}
                  onPress={() => setDistributionType('size')}
                  label="People per group"
                />
                {distributionType === 'size' && (
                  <TextInput
                    style={[styles.numberInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    value={peoplePerGroup.toString()}
                    onChangeText={(text) => setPeoplePerGroup(Math.max(1, parseInt(text) || 4))}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.generateButton, { backgroundColor: COLORS.primary }]}
              onPress={generateTeams}
              disabled={peopleCount === 0}
            >
              <Ionicons name="shuffle" size={20} color={COLORS.surface} />
              <Text style={[styles.generateButtonText, { color: COLORS.surface }]}>START RANDOMIZATION</Text>
            </TouchableOpacity>
          </View>

          {/* Results Section */}
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.badge, { backgroundColor: COLORS.primary }]}>
                <Text style={styles.badgeText}>3</Text>
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Results & Export</Text>
            </View>

            {teams.length > 0 ? (
              <View style={styles.resultsContent}>
                <View style={[styles.summaryBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                  <View style={[styles.badge, { backgroundColor: COLORS.success }]}>
                    <Text style={styles.badgeText}>{teams.length} Teams</Text>
                  </View>
                  <Text style={[styles.countLabel, { color: '#15803d' }]}>
                    {peopleCount} people
                  </Text>
                </View>

                <ScrollView style={styles.teamsList} showsVerticalScrollIndicator={false}>
                  {teams.slice(0, 6).map((team) => (
                    <View key={team.id} style={[styles.teamCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <View style={styles.teamHeader}>
                        <Text style={[styles.teamName, { color: COLORS.primary }]}>
                          {team.customName || team.name}
                        </Text>
                        <View style={[styles.badge, { backgroundColor: theme.border }]}>
                          <Text style={[styles.badgeText, { color: theme.text }]}>{team.members.length}</Text>
                        </View>
                      </View>
                      <View style={styles.membersList}>
                        {team.members.slice(0, 3).map((member, index) => (
                          <View key={member.id} style={styles.memberRow}>
                            <View style={[styles.memberIndex, { backgroundColor: theme.border }]}>
                              <Text style={[styles.memberIndexText, { color: theme.text }]}>{index + 1}</Text>
                            </View>
                            <Text style={[styles.memberName, { color: theme.text }]}>{member.name}</Text>
                            {member.gender && (
                              <Text style={[styles.memberGender, { color: theme.textSecondary }]}>
                                {member.gender === 'M' ? '♂' : '♀'}
                              </Text>
                            )}
                          </View>
                        ))}
                        {team.members.length > 3 && (
                          <Text style={[styles.moreMembers, { color: theme.textSecondary }]}>
                            +{team.members.length - 3} more
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                  {teams.length > 6 && (
                    <Text style={[styles.moreTeams, { color: theme.textSecondary }]}>
                      +{teams.length - 6} more teams
                    </Text>
                  )}
                </ScrollView>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people" size={48} color={theme.textSecondary} style={{ opacity: 0.3 }} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No teams yet</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Enter names and start randomization</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      {/* Configure Names Modal */}
      <Modal
        visible={showConfigureModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowConfigureModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowConfigureModal(false)} style={styles.modalBackButton}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Configure People Settings</Text>
            <TouchableOpacity onPress={saveConfiguredPeople} style={styles.modalSaveButton}>
              <Text style={[styles.modalSaveText, { color: COLORS.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Subtitle */}
          <View style={styles.modalSubtitleContainer}>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Set leaders and labels for each person without typing format codes
            </Text>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchContainer, { backgroundColor: theme.surface }]}>
            <Ionicons name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search by full name..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* People List */}
          <FlatList
            data={filteredPeople}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={styles.peopleList}
            renderItem={({ item, index }) => {
              const actualIndex = configuredPeople.findIndex(p => p.id === item.id);
              
              // Calculate team assignment (based on distribution)
              let teamName = '';
              if (distributionType === 'groups') {
                const teamIndex = actualIndex % numGroups;
                teamName = teamIndex < 3 ? `group${teamIndex + 1}` : `Team ${teamIndex + 1}`;
              } else {
                const teamIndex = Math.floor(actualIndex / peoplePerGroup);
                teamName = teamIndex < 3 ? `group${teamIndex + 1}` : `Team ${teamIndex + 1}`;
              }
              
              // Team colors
              const teamColors = [
                { bg: '#fee2e2', text: '#991b1b', border: '#8e0b16' },      // Team Alpha - Red
                { bg: '#dbeafe', text: '#1e40af', border: '#2563eb' },      // Team Beta - Blue
                { bg: '#d1fae5', text: '#065f46', border: '#10b981' },      // Team Gamma - Green
                { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },      // Team Delta - Yellow
                { bg: '#e9d5ff', text: '#6b21a8', border: '#a855f7' },      // Team Echo - Purple
                { bg: '#fed7aa', text: '#9a3412', border: '#ea580c' },      // Team Zeta - Orange
              ];
              
              const teamColorScheme = teamColors[actualIndex % numGroups] || teamColors[0];
              
              return (
                <View style={[styles.personCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {/* Name and Team Header */}
                  <View style={styles.personHeader}>
                    <View style={styles.personHeaderLeft}>
                      <Text style={[styles.personName, { color: theme.text }]}>{item.name}</Text>
                      <View style={[styles.teamBadge, { backgroundColor: teamColorScheme.bg, borderColor: teamColorScheme.border }]}>
                        <Text style={[styles.teamBadgeText, { color: teamColorScheme.text }]}>
                          {teamName === 'group1' ? 'Team Alpha' :
                           teamName === 'group2' ? 'Team Beta' :
                           teamName === 'group3' ? 'Team Gamma' :
                           teamName === 'group4' ? 'Team Delta' :
                           teamName === 'group5' ? 'Team Echo' :
                           teamName}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Leader Toggle */}
                  <View style={styles.personRow}>
                    <View style={styles.personRowLeft}>
                      <Ionicons name="star" size={20} color={COLORS.primary} />
                      <Text style={[styles.personRowLabel, { color: theme.text }]}>Leader</Text>
                    </View>
                    <Switch
                      value={item.isLeader || false}
                      onValueChange={(value) => updateConfiguredPerson(actualIndex, 'isLeader', value)}
                      trackColor={{ false: '#d1d5db', true: COLORS.primary }}
                      thumbColor="#fff"
                    />
                  </View>

                  {/* Label Input */}
                  <View style={styles.personRow}>
                    <View style={styles.personRowLeft}>
                      <Ionicons name="pricetag" size={20} color="#6b7280" />
                      <Text style={[styles.personRowLabel, { color: theme.text }]}>Label (Optional)</Text>
                    </View>
                  </View>
                  <TextInput
                    style={[styles.labelInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                    placeholder="e.g., Teacher, Student"
                    placeholderTextColor={theme.textSecondary}
                    value={item.label || ''}
                    onChangeText={(value) => updateConfiguredPerson(actualIndex, 'label', value)}
                  />

                  {/* Display current label if set */}
                  {item.label && (
                    <View style={[styles.currentLabelBadge, { backgroundColor: '#dbeafe' }]}>
                      <Text style={styles.currentLabelText}>{item.label}</Text>
                    </View>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
                <Text style={[styles.emptyListText, { color: theme.textSecondary }]}>
                  {searchQuery ? 'No people found matching your search' : 'No people to configure'}
                </Text>
                <Text style={[styles.emptyListText, { color: theme.textSecondary, fontSize: 12, marginTop: 8 }]}>
                  Debug: {configuredPeople.length} people configured, {filteredPeople.length} filtered
                </Text>
              </View>
            }
            ListHeaderComponent={
              configuredPeople.length > 0 ? (
                <View style={{ padding: 16, backgroundColor: '#f0f9ff', marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, color: '#1e40af', fontWeight: '600' }}>
                    {filteredPeople.length} {filteredPeople.length === 1 ? 'person' : 'people'} 
                    {searchQuery ? ` matching "${searchQuery}"` : ''}
                  </Text>
                </View>
              ) : null
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  resetButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 20,
  },
  gridContainer: {
    gap: 16,
    paddingBottom: 24,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.surface,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  radioGroup: {
    gap: 8,
    marginBottom: 16,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  radioSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  radioLabel: {
    fontSize: 14,
  },
  radioWithInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  numberInput: {
    width: 60,
    height: 32,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  peopleCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  countLabel: {
    fontSize: 12,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  helpBox: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  helpText: {
    fontSize: 12,
    lineHeight: 16,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  generateButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultsContent: {
    gap: 12,
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  teamsList: {
    maxHeight: 300,
  },
  teamCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
  },
  membersList: {
    gap: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberIndex: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberIndexText: {
    fontSize: 10,
    fontWeight: '600',
  },
  memberName: {
    fontSize: 12,
    flex: 1,
  },
  memberGender: {
    fontSize: 12,
  },
  moreMembers: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  moreTeams: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  // Action buttons (Upload & Configure)
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  // Configure Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  modalSaveButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalSubtitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  peopleList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  personCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  personHeaderLeft: {
    flex: 1,
    gap: 8,
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
  },
  teamBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  teamBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  personRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  personRowLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  labelInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  currentLabelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 4,
  },
  currentLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyListText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
});

export default TeamPickerScreen;