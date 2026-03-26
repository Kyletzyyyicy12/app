import React, { useMemo, useRef, useState, useEffect } from 'react'
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet, Platform, Dimensions, Animated, PanResponder, Vibration } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'

interface Message { role: 'user' | 'assistant'; content: string }

const routeQueryToAnswer = (query: string): string => {
  const q = query.toLowerCase()
  if (q.includes('room') || q.includes('code') || q.includes('join')) {
    return 'To join a live draw: tap Join Live Draw and enter the 6-digit room code. Organizers start a live draw from the wheel screen; the code shows at the top.'
  }
  if (q.includes('live') || q.includes('broadcast')) {
    return 'Live draw: Organizer opens a wheel and taps Start Live Draw to generate a 6-digit room code. Participants enter that code to watch and chat in real time.'
  }
  if (q.includes('announcement')) {
    return 'Announcements: Admin can send announcements. You will see a pop-up after login and a bell indicator on dashboards.'
  }
  if (q.includes('wheel') || q.includes('spin') || q.includes('picker')) {
    return 'Open a wheel from your list or the gallery, adjust settings (winners, theme), then press Spin. Long-press entries to edit or delete.'
  }
  if (q.includes('team')) {
    return 'Team Picker: Add names, set number of groups or group size, then generate teams randomly and equally.'
  }
  if (q.includes('theme') || q.includes('color') || q.includes('customize')) {
    return 'Customize theme: Go to Settings → Theme & Colors to change primary/secondary colors and background.'
  }
  if (q.includes('invite') || q.includes('kick') || q.includes('moderate') || q.includes('chat')) {
    return 'Live moderation: Organizer can share room codes to invite, manage viewers, and remove disruptive participants during live sessions.'
  }
  return "Hi! I'm Coby. Ask me about Live Draw, Room Codes, Team Picker, Wheel Settings, Theme, or History. Try: ‘How do I start a live draw?’"
}

export const CobyAssistant: React.FC = () => {
   const { theme } = useTheme()
   const [open, setOpen] = useState(false)
   const [input, setInput] = useState('')
   const [isLoading, setIsLoading] = useState(false)
   const [messages, setMessages] = useState<Message[]>([
     { role: 'assistant', content: "Hi, I'm Coby. How can I help you today?" },
   ])
   const loadingAnimation = useRef(new Animated.Value(0)).current
   const animationRef = useRef<Animated.CompositeAnimation | null>(null)

   // Drag functionality
   const [position] = useState({ x: 20, y: Dimensions.get('window').height - 120 })
   const pan = useRef(new Animated.ValueXY(position)).current
   const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    // Cleanup function to stop any running animations
    return () => {
      if (animationRef.current) {
        animationRef.current.stop()
        animationRef.current = null
      }
      loadingAnimation.stopAnimation()
      loadingAnimation.setValue(0)
    }
  }, [])

  const send = () => {
    const text = input.trim()
    if (!text || isLoading) return

    setIsLoading(true)
    setInput('')

    // Start loading animation
    animationRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(loadingAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(loadingAnimation, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    )
    animationRef.current.start()

    // Simulate processing time
    setTimeout(() => {
      const answer = routeQueryToAnswer(text)
      setMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: answer }])
      setIsLoading(false)
      if (animationRef.current) {
        animationRef.current.stop()
        animationRef.current = null
      }
      loadingAnimation.setValue(0)
    }, 800 + Math.random() * 400) // Random delay between 800-1200ms
  }

  const quickTips = useMemo(() => [
    'How do I start a live draw?',
    'Where do I enter the room code?',
    'How do I split names into teams?',
    'How do announcements show after login?',
    'How do I change theme colors?',
  ], [])

  // Enhanced pan responder for smooth drag functionality
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true)
        // Provide immediate haptic feedback for drag start
        if (Platform.OS === 'android') {
          Vibration.vibrate(30)
        }
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value
        })
        pan.setValue({ x: 0, y: 0 })
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        setIsDragging(false)
        pan.flattenOffset()

        // Enhanced boundary detection for smooth positioning
        const { width, height } = Dimensions.get('window')
        const buttonSize = 56 // Button size
        const margin = 20 // Safe margin from edges

        const finalX = Math.max(margin, Math.min((pan.x as any)._value, width - buttonSize - margin))
        const finalY = Math.max(60, Math.min((pan.y as any)._value, height - buttonSize - 120))

        // Smooth animation to final position
        Animated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
          tension: 65,
          friction: 8,
        }).start()
      },
      onPanResponderTerminate: () => {
        setIsDragging(false)
      },
    })
  )

  return (
    <>
      {/* Floating draggable button */}
      <Animated.View
         style={[
           styles.fab,
           {
             backgroundColor: isDragging ? theme.primary + 'E6' : theme.primary,
             shadowColor: isDragging ? theme.primary : '#000',
             shadowOpacity: isDragging ? 0.6 : 0.3,
             shadowRadius: isDragging ? 12 : 4,
             elevation: isDragging ? 16 : 6,
             transform: [
               { translateX: pan.x },
               { translateY: pan.y },
               { scale: isDragging ? 1.1 : 1 }
             ]
           }
         ]}
         {...panResponder.current.panHandlers}
       >
         <TouchableOpacity
           onPress={() => !isDragging && setOpen(true)}
           activeOpacity={0.8}
           style={styles.fabTouchable}
           accessibilityLabel="Open Coby assistant"
           accessibilityHint="Double tap to open assistant, drag to move button"
         >
           <Ionicons
             name="chatbubble-ellipses"
             size={isDragging ? 28 : 26}
             color={theme.onPrimary}
           />
         </TouchableOpacity>
       </Animated.View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
          <View style={[styles.sheet, { backgroundColor: theme.surface }] }>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
               <View style={styles.titleContainer}>
                 <Ionicons name="help-circle" size={20} color={theme.primary} style={styles.titleIcon} />
                 <Text style={[styles.title, { color: theme.text }]}>Coby Assistant</Text>
               </View>
               <TouchableOpacity
                 onPress={() => setOpen(false)}
                 style={styles.closeButton}
                 accessibilityLabel="Close assistant"
               >
                 <Ionicons name="close" size={20} color={theme.textSecondary} />
               </TouchableOpacity>
             </View>

            <View style={styles.body}>
               {messages.map((m, idx) => (
                 <View key={idx} style={[styles.bubble, m.role === 'assistant' ? [styles.aBubble, { backgroundColor: theme.isDark ? '#2a2a2a' : '#f4f4f5' }] : [styles.uBubble, { backgroundColor: theme.isDark ? '#1f2937' : '#eef2ff' }]]}>
                   <Text style={[styles.bubbleText, { color: theme.text }]}>{m.content}</Text>
                 </View>
               ))}

               {/* Loading indicator */}
               {isLoading && (
                 <View style={[styles.bubble, styles.aBubble, { backgroundColor: theme.isDark ? '#2a2a2a' : '#f4f4f5' }]}>
                   <View style={styles.loadingContainer}>
                     <Animated.View
                       style={[
                         styles.loadingDot,
                         {
                           backgroundColor: theme.primary,
                           transform: [{ scale: loadingAnimation.interpolate({
                             inputRange: [0, 1],
                             outputRange: [0.3, 1],
                           }) }],
                           opacity: loadingAnimation.interpolate({
                             inputRange: [0, 1],
                             outputRange: [0.3, 1],
                           }),
                         },
                       ]}
                     />
                     <Animated.View
                       style={[
                         styles.loadingDot,
                         {
                           backgroundColor: theme.primary,
                           transform: [{ scale: loadingAnimation.interpolate({
                             inputRange: [0, 0.5, 1],
                             outputRange: [0.3, 1, 0.3],
                           }) }],
                           opacity: loadingAnimation.interpolate({
                             inputRange: [0, 0.5, 1],
                             outputRange: [0.3, 1, 0.3],
                           }),
                         },
                       ]}
                     />
                     <Animated.View
                       style={[
                         styles.loadingDot,
                         {
                           backgroundColor: theme.primary,
                           transform: [{ scale: loadingAnimation.interpolate({
                             inputRange: [0, 1],
                             outputRange: [0.3, 1],
                           }) }],
                           opacity: loadingAnimation.interpolate({
                             inputRange: [0, 1],
                             outputRange: [0.3, 1],
                           }),
                         },
                       ]}
                     />
                   </View>
                 </View>
               )}

              <View style={styles.tipsRow}>
                {quickTips.map((t) => (
                  <TouchableOpacity key={t} onPress={() => setMessages(prev => [...prev, { role: 'user', content: t }, { role: 'assistant', content: routeQueryToAnswer(t) }])} style={[styles.tipChip, { backgroundColor: theme.isDark ? '#0b1220' : '#f8fafc', borderColor: theme.border }]}>
                    <Text style={[styles.tipText, { color: theme.text }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                value={input}
                onChangeText={setInput}
                placeholder="Ask Coby…"
                placeholderTextColor={theme.textSecondary}
                onSubmitEditing={send}
                returnKeyType="send"
              />
              <TouchableOpacity
                onPress={send}
                style={[styles.sendBtn, { backgroundColor: theme.primary }]}
                disabled={!input.trim()}
                accessibilityLabel="Send message"
              >
                 <Ionicons name="send" size={18} color={theme.onPrimary} />
               </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: Platform.select({ ios: 40, android: 30, default: 20 }),
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 200,
    // Enhanced touch area
    minWidth: 56,
    minHeight: 56,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.select({ ios: 24, android: 16, default: 16 }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: {
    marginRight: 2,
  },
  closeButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    maxHeight: Math.min(420, Dimensions.get('window').height * 0.6),
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 8,
    maxWidth: '92%',
  },
  aBubble: { backgroundColor: '#f4f4f5', alignSelf: 'flex-start' },
  uBubble: { backgroundColor: '#eef2ff', alignSelf: 'flex-end' },
  bubbleText: { color: '#111' },
  tipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 6 },
  tipChip: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  tipText: { color: '#111', fontSize: 12 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 12, android: 8, default: 8 }),
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  fabTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default CobyAssistant
