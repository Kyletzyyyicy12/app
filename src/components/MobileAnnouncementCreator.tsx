import React, { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Alert, TextInput } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../config/firebaseConfig'
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'

interface MobileAnnouncementCreatorProps {
  isVisible: boolean
  onClose: () => void
  onSuccess?: () => void
}

export const MobileAnnouncementCreator: React.FC<MobileAnnouncementCreatorProps> = ({
  isVisible,
  onClose,
  onSuccess
}) => {
  const { theme } = useTheme()
  const { currentUser, userProfile } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'success' | 'urgent',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    targetRoles: ['organizer', 'participant'] as string[],
    expiresAt: '',
  })

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.message.trim()) {
      Alert.alert('Validation Error', 'Please fill in both title and message')
      return
    }

    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to create announcements')
      return
    }

    setIsSubmitting(true)

    try {
      const announcementData = {
        title: formData.title.trim(),
        message: formData.message.trim(),
        type: formData.type,
        priority: formData.priority,
        targetRoles: formData.targetRoles,
        isActive: true,
        createdBy: currentUser.uid,
        createdByName: userProfile?.fullName || userProfile?.email || currentUser.email?.split('@')[0] || 'Organizer',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        readBy: [],
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : null,
      }

      await addDoc(collection(db, 'announcements'), announcementData)

      Alert.alert(
        'Success',
        'Your announcement has been created successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setFormData({
                title: '',
                message: '',
                type: 'info',
                priority: 'medium',
                targetRoles: ['organizer', 'participant'],
                expiresAt: '',
              })
              onClose()
              onSuccess?.()
            }
          }
        ]
      )
    } catch (error: any) {
      console.error('Error creating announcement:', error)
      Alert.alert(
        'Error',
        'Failed to create announcement. Please try again.',
        [{ text: 'OK' }]
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleRole = (role: string) => {
    setFormData(prev => ({
      ...prev,
      targetRoles: prev.targetRoles.includes(role)
        ? prev.targetRoles.filter(r => r !== role)
        : [...prev.targetRoles, role]
    }))
  }

  const typeOptions = [
    { value: 'info', label: '📢 Info', icon: 'information-circle' },
    { value: 'warning', label: '⚠️ Warning', icon: 'warning' },
    { value: 'success', label: '✅ Success', icon: 'checkmark-circle' },
    { value: 'urgent', label: '🚨 Urgent', icon: 'alert-circle' },
  ]

  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ]

  const roleOptions = ['organizer', 'participant', 'admin']

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>📢 Create Announcement</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Type Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Type</Text>
              <View style={styles.typeGrid}>
                {typeOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.typeOption,
                      {
                        backgroundColor: formData.type === option.value ? theme.primary + '20' : theme.background,
                        borderColor: formData.type === option.value ? theme.primary : theme.border
                      }
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, type: option.value as any }))}
                  >
                    <Ionicons
                      name={option.icon as any}
                      size={20}
                      color={formData.type === option.value ? theme.primary : theme.textSecondary}
                    />
                    <Text style={[
                      styles.typeLabel,
                      {
                        color: formData.type === option.value ? theme.primary : theme.textSecondary
                      }
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Priority Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Priority</Text>
              <View style={styles.priorityGrid}>
                {priorityOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.priorityOption,
                      {
                        backgroundColor: formData.priority === option.value ? theme.primary + '20' : theme.background,
                        borderColor: formData.priority === option.value ? theme.primary : theme.border
                      }
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, priority: option.value as any }))}
                  >
                    <Text style={[
                      styles.priorityLabel,
                      {
                        color: formData.priority === option.value ? theme.primary : theme.textSecondary
                      }
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Title Input */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Title</Text>
              <TextInput
                style={[styles.textInput, {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text
                }]}
                value={formData.title}
                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                placeholder="Enter announcement title"
                placeholderTextColor={theme.textSecondary}
                maxLength={100}
              />
              <Text style={[styles.charCount, { color: theme.textSecondary }]}>
                {formData.title.length}/100
              </Text>
            </View>

            {/* Message Input */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Message</Text>
              <TextInput
                style={[styles.textArea, {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text
                }]}
                value={formData.message}
                onChangeText={(text) => setFormData(prev => ({ ...prev, message: text }))}
                placeholder="Enter your announcement message"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
                maxLength={500}
              />
              <Text style={[styles.charCount, { color: theme.textSecondary }]}>
                {formData.message.length}/500
              </Text>
            </View>

            {/* Target Roles */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Target Audience</Text>
              <View style={styles.rolesContainer}>
                {roleOptions.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleChip,
                      {
                        backgroundColor: formData.targetRoles.includes(role) ? theme.primary + '20' : theme.background,
                        borderColor: formData.targetRoles.includes(role) ? theme.primary : theme.border
                      }
                    ]}
                    onPress={() => toggleRole(role)}
                  >
                    <Text style={[
                      styles.roleText,
                      {
                        color: formData.targetRoles.includes(role) ? theme.primary : theme.textSecondary
                      }
                    ]}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                    {formData.targetRoles.includes(role) && (
                      <Ionicons name="close" size={16} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Expiration Date */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Expiration Date (Optional)</Text>
              <TextInput
                style={[styles.textInput, {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text
                }]}
                value={formData.expiresAt}
                onChangeText={(text) => setFormData(prev => ({ ...prev, expiresAt: text }))}
                placeholder="YYYY-MM-DDTHH:MM"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.actions, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.background }]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, {
                backgroundColor: isSubmitting ? theme.textSecondary : theme.primary
              }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitText}>
                {isSubmitting ? 'Creating...' : 'Create Announcement'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxHeight: '85%',
    borderRadius: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  priorityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityOption: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  priorityLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  rolesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})