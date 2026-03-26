import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../config/firebaseConfig'
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  orderBy
} from 'firebase/firestore'

interface Announcement {
  id: string
  title: string
  message: string
  type: "info" | "warning" | "success" | "urgent"
  targetRoles: string[]
  isActive: boolean
  priority: "low" | "medium" | "high" | "urgent"
  expiresAt?: Date
  createdBy: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
  readBy: Array<{
    userId: string
    userName: string
    readAt: Date
  }>
}

export const MobileAnnouncementDisplay: React.FC = () => {
  const { theme } = useTheme()
  const { currentUser, userProfile } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [hasNewAnnouncements, setHasNewAnnouncements] = useState(false)
  const [showList, setShowList] = useState(false)
  const pulseAnimation = useState(new Animated.Value(0))[0]

  const fetchAnnouncements = useCallback(async () => {
    if (!currentUser || !userProfile) return

    try {
      const q = query(
        collection(db, "announcements"),
        where("isActive", "==", true)
      )
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedAnnouncements = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          expiresAt: doc.data().expiresAt?.toDate(),
          readBy: doc.data().readBy?.map((item: any) => ({
            ...item,
            readAt: item.readAt?.toDate() || new Date()
          })) || []
        })) as Announcement[]

        // Sort by creation date (newest first)
        fetchedAnnouncements.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

        // Filter for user role and expired announcements
        const userRole = userProfile.role || 'participant'
        const userAnnouncements = fetchedAnnouncements.filter(announcement =>
          announcement.targetRoles.includes(userRole)
        )

        const activeAnnouncements = userAnnouncements.filter(announcement => {
          if (!announcement.expiresAt) return true
          return announcement.expiresAt > new Date()
        })
        
        // Check for new announcements
        const previousIds = announcements.map(a => a.id)
        const newAnnouncementIds = activeAnnouncements
          .filter(a => !previousIds.includes(a.id))
          .map(a => a.id)
        
        if (newAnnouncementIds.length > 0 && announcements.length > 0) {
          setHasNewAnnouncements(true)
          
          // Start pulse animation for new announcements
          Animated.loop(
            Animated.sequence([
              Animated.timing(pulseAnimation, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnimation, {
                toValue: 0,
                duration: 1000,
                useNativeDriver: true,
              }),
            ])
          ).start()
        }
        
        setAnnouncements(activeAnnouncements)
        
        // Calculate unread count
        const unread = activeAnnouncements.filter(announcement => 
          !announcement.readBy.some(reader => reader.userId === currentUser.uid)
        )
        setUnreadCount(unread.length)
        
        // Auto-show modal for urgent unread announcements on first load
        if (announcements.length === 0 && unread.length > 0) {
          const urgentUnread = unread.filter(a => a.priority === "urgent" || a.type === "urgent")
          if (urgentUnread.length > 0) {
            setSelectedAnnouncement(urgentUnread[0])
            setShowModal(true)
          }
        }
      })

      return unsubscribe
    } catch (error) {
      console.error("Error fetching announcements:", error)
    }
  }, [currentUser, userProfile, announcements.length])

  useEffect(() => {
    const unsubscribe = fetchAnnouncements()
    
    return () => {
      if (unsubscribe) {
        unsubscribe.then(unsub => unsub && unsub())
      }
    }
  }, [fetchAnnouncements])

  // Auto-show announcement popup on login
  useEffect(() => {
    if (currentUser && userProfile && announcements.length > 0) {
      const unreadAnnouncements = announcements.filter(announcement => 
        !announcement.readBy.some(reader => reader.userId === currentUser.uid)
      )
      
      if (unreadAnnouncements.length > 0) {
        // Show the most important unread announcement automatically
        const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 }
        const sortedUnread = unreadAnnouncements.sort((a, b) => 
          (priorityOrder[b.priority] || 1) - (priorityOrder[a.priority] || 1)
        )
        
        // Auto-show popup after a short delay
        const timer = setTimeout(() => {
          setSelectedAnnouncement(sortedUnread[0])
          setShowModal(true)
        }, 1500) // Show after 1.5 seconds to let the user settle in
        
        return () => clearTimeout(timer)
      }
    }
  }, [currentUser, userProfile, announcements])

  const markAsRead = async (announcement: Announcement) => {
    if (!currentUser) return
    
    try {
      const isAlreadyRead = announcement.readBy.some(reader => reader.userId === currentUser.uid)
      if (isAlreadyRead) return

      // ⚡ FIXED: serverTimestamp() cannot be used inside arrayUnion() - use Date() instead
      const announcementRef = doc(db, "announcements", announcement.id)
      await updateDoc(announcementRef, {
        readBy: arrayUnion({
          userId: currentUser.uid,
          userName: userProfile?.fullName || userProfile?.email || "User",
          readAt: new Date() // 🔧 Fixed: Use new Date() instead of serverTimestamp()
        })
      })
      
      console.log('✅ Successfully marked announcement as read:', announcement.title)
    } catch (error: any) {
      console.error("Error marking announcement as read:", error)
      // Provide user-friendly feedback on error
      if (error.code === 'permission-denied') {
        console.log('🔒 Permission denied when marking announcement as read - this may be expected for some user roles')
      }
    }
  }

  const handleAnnouncementClick = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement)
    setShowModal(true)
    markAsRead(announcement)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "info": return "information-circle"
      case "warning": return "warning"
      case "success": return "checkmark-circle"
      case "urgent": return "alert-circle"
      default: return "information-circle"
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "info": return "#3b82f6"
      case "warning": return "#f59e0b"
      case "success": return "#10b981"
      case "urgent": return "#ef4444"
      default: return "#6b7280"
    }
  }

  const isUnread = (announcement: Announcement) => {
    return !announcement.readBy.some(reader => reader.userId === currentUser?.uid)
  }

  if (announcements.length === 0) {
    return null
  }

  return (
    <>
      {/* Notification Bell */}
      <TouchableOpacity
        style={[styles.bellButton, { backgroundColor: theme.surface }]}
        onPress={() => {
          setHasNewAnnouncements(false)
          setShowList(true)
          pulseAnimation.stopAnimation()
          pulseAnimation.setValue(0)
        }}
      >
        <Ionicons name="notifications" size={24} color={theme.text} />
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: '#ef4444' }]}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? "9+" : unreadCount.toString()}
            </Text>
          </View>
        )}
        {hasNewAnnouncements && (
          <Animated.View 
            style={[
              styles.pulseIndicator,
              {
                opacity: pulseAnimation,
                transform: [
                  {
                    scale: pulseAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.5],
                    }),
                  },
                ],
              }
            ]}
          />
        )}
      </TouchableOpacity>

      {/* Announcements List Modal */}
      <Modal visible={showList} transparent animationType="slide" onRequestClose={() => setShowList(false)}>
        <View style={styles.overlay}>
          <View style={[styles.listContainer, { backgroundColor: theme.surface }]}>
            <View style={[styles.listHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.listTitle, { color: theme.text }]}>
                📢 Announcements
              </Text>
              <TouchableOpacity onPress={() => setShowList(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.listContent}>
              {announcements.map((announcement) => (
                <TouchableOpacity
                  key={announcement.id}
                  style={[
                    styles.announcementItem,
                    { 
                      backgroundColor: isUnread(announcement) ? theme.primary + '10' : theme.background,
                      borderColor: theme.border 
                    }
                  ]}
                  onPress={() => {
                    setShowList(false)
                    handleAnnouncementClick(announcement)
                  }}
                >
                  <View style={styles.announcementHeader}>
                    <View style={styles.iconTitleRow}>
                      <Ionicons 
                        name={getTypeIcon(announcement.type)} 
                        size={20} 
                        color={getTypeColor(announcement.type)} 
                      />
                      <Text style={[styles.announcementTitle, { color: theme.text }]}>
                        {announcement.title}
                      </Text>
                    </View>
                    {isUnread(announcement) && (
                      <View style={styles.unreadDot} />
                    )}
                  </View>
                  <Text style={[styles.announcementPreview, { color: theme.text + '80' }]} numberOfLines={2}>
                    {announcement.message}
                  </Text>
                  <Text style={[styles.announcementMeta, { color: theme.text + '60' }]}>
                    By {announcement.createdByName} • {announcement.createdAt.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Enhanced Announcement Detail Modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.overlay}>
          <Animated.View style={[styles.modernDetailContainer, { backgroundColor: theme.surface }]}>
            {selectedAnnouncement && (
              <>
                {/* Modern Header with Background */}
                <View
                  style={[
                    styles.modernDetailHeader, 
                    { 
                      backgroundColor: getTypeColor(selectedAnnouncement.type) + '20',
                      borderBottomColor: theme.border 
                    }
                  ]}
                >
                  <View style={styles.modernHeaderContent}>
                    <View style={[styles.modernTypeIcon, { backgroundColor: getTypeColor(selectedAnnouncement.type) + '20' }]}>
                      <Ionicons 
                        name={getTypeIcon(selectedAnnouncement.type)} 
                        size={28} 
                        color={getTypeColor(selectedAnnouncement.type)} 
                      />
                    </View>
                    <View style={styles.modernTitleSection}>
                      <Text style={[styles.modernDetailTitle, { color: theme.text }]}>
                        {selectedAnnouncement.title}
                      </Text>
                      <View style={styles.modernPriorityBadge}>
                        <Text style={[styles.priorityText, { color: getTypeColor(selectedAnnouncement.type) }]}>
                          {selectedAnnouncement.priority.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={[styles.modernCloseButton, { backgroundColor: theme.surface }]}
                    onPress={() => setShowModal(false)}
                  >
                    <Ionicons name="close" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.modernDetailContent} showsVerticalScrollIndicator={false}>
                  <Text style={[styles.modernDetailMessage, { color: theme.text }]}>
                    {selectedAnnouncement.message}
                  </Text>
                  
                  <View style={[styles.modernDetailMeta, { backgroundColor: theme.background + '60' }]}>
                    <View style={styles.metaRow}>
                      <Ionicons name="person-circle" size={16} color={theme.textSecondary} />
                      <Text style={[styles.modernMetaText, { color: theme.textSecondary }]}>
                        {selectedAnnouncement.createdByName}
                      </Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons name="time" size={16} color={theme.textSecondary} />
                      <Text style={[styles.modernMetaText, { color: theme.textSecondary }]}>
                        {selectedAnnouncement.createdAt.toLocaleString()}
                      </Text>
                    </View>
                    {selectedAnnouncement.expiresAt && (
                      <View style={styles.metaRow}>
                        <Ionicons name="calendar" size={16} color={theme.textSecondary} />
                        <Text style={[styles.modernMetaText, { color: theme.textSecondary }]}>
                          Expires {selectedAnnouncement.expiresAt.toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>
                </ScrollView>
                
                {/* Modern Action Button */}
                <View style={styles.modernActionSection}>
                  <TouchableOpacity 
                    style={[styles.modernActionButton, { backgroundColor: getTypeColor(selectedAnnouncement.type) }]}
                    onPress={() => {
                      markAsRead(selectedAnnouncement)
                      setShowModal(false)
                    }}
                  >
                    <Ionicons name="checkmark" size={20} color="white" />
                    <Text style={styles.modernActionButtonText}>Got it!</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  bellButton: {
    position: 'relative',
    padding: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pulseIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContent: {
    maxHeight: '85%',
  },
  announcementItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
  },
  announcementPreview: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  announcementMeta: {
    fontSize: 12,
  },
  detailContainer: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  detailContent: {
    padding: 16,
  },
  detailMessage: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  detailMeta: {
    borderTopWidth: 1,
    paddingTop: 16,
  },
  metaText: {
    fontSize: 14,
    marginBottom: 4,
  },
  
  // Modern Enhanced Modal Styles
  modernDetailContainer: {
    width: '92%',
    maxHeight: '85%',
    borderRadius: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  modernDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
  },
  modernHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modernTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modernTitleSection: {
    flex: 1,
  },
  modernDetailTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    lineHeight: 26,
  },
  modernPriorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modernCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  modernDetailContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flex: 1,
  },
  modernDetailMessage: {
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 24,
    fontWeight: '400',
  },
  modernDetailMeta: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modernMetaText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modernActionSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  modernActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modernActionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
})