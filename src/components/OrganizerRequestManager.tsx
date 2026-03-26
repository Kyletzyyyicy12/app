import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../config/firebaseConfig';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

interface ParticipantRequest {
  id: string;
  sessionId: string;
  participantId: string;
  participantName: string;
  requestType: 'wheel_type_change' | 'topic_suggestion';
  requestedWheelType?: {
    id: string;
    title: string;
    description: string;
    icon: string;
    category: string;
    defaultItems: string[];
    color: string;
  };
  topicSuggestion?: string;
  message?: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: Date;
  respondedAt?: Date;
  organizerResponse?: string;
}

interface OrganizerRequestManagerProps {
  sessionId: string;
  organizerId: string;
  onWheelTypeChange?: (wheelType: any) => void;
  onTopicSuggestion?: (topic: string) => void;
}

const OrganizerRequestManager: React.FC<OrganizerRequestManagerProps> = ({
  sessionId,
  organizerId,
  onWheelTypeChange,
  onTopicSuggestion,
}) => {
  const { theme } = useTheme();
  const [requests, setRequests] = useState<ParticipantRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ParticipantRequest | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);

  // Listen to requests in real-time
  useEffect(() => {
    if (!sessionId) return;

    const requestsQuery = query(
      collection(db, 'participantRequests'),
      where('sessionId', '==', sessionId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        const requestsData: ParticipantRequest[] = [];
        snapshot.forEach((requestDoc) => {
          const data = requestDoc.data();
          requestsData.push({
            id: requestDoc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            respondedAt: data.respondedAt?.toDate(),
          } as ParticipantRequest);
        });
        setRequests(requestsData);

        // Show alert for new pending requests
        const newPendingRequests = requestsData.filter(
          (req) => req.status === 'pending' && 
          Date.now() - req.createdAt.getTime() < 5000 // Within last 5 seconds
        );

        newPendingRequests.forEach((req) => {
          // Show multiple prominent alerts
          Alert.alert(
            '🔔 URGENT: New Participant Request!',
            `${req.participantName} has requested ${req.requestType === 'wheel_type_change' ? `to change wheel to "${req.requestedWheelType?.title}"` : 'a topic suggestion'}\n\nThis requires your immediate attention.`,
            [
              {
                text: 'View Request',
                style: 'default',
                onPress: () => {
                  // Auto-open the request for quick action
                  openResponseModal(req);
                }
              },
              {
                text: 'Approve Now',
                style: 'default',
                onPress: () => {
                  if (req.requestType === 'wheel_type_change') {
                    openResponseModal(req);
                  } else {
                    handleRequestResponse(req, 'approved');
                  }
                }
              },
              {
                text: 'Later',
                style: 'cancel',
              }
            ],
            { cancelable: true }
          );
          
          // Add haptic feedback for urgent notifications
          try {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              // Urgent notification pattern: long-short-long
              navigator.vibrate([800, 200, 800]);
            }
          } catch (e) {
            // Vibration not supported, continue without error
          }
        });
      },
      (error) => {
        console.error('Error listening to requests:', error);
      }
    );

    return () => unsubscribe();
  }, [sessionId]);

  const handleRequestResponse = async (request: ParticipantRequest, status: 'approved' | 'denied') => {
    setIsResponding(true);

    try {
      // Update request status
      await updateDoc(doc(db, 'participantRequests', request.id), {
        status,
        respondedAt: serverTimestamp(),
        respondedBy: organizerId,
        organizerResponse: responseMessage.trim() || undefined,
      });

      // If approved and it's a wheel type change, trigger the change
      if (status === 'approved') {
        if (request.requestType === 'wheel_type_change' && request.requestedWheelType) {
          onWheelTypeChange?.(request.requestedWheelType);
          Alert.alert(
            '✅ Request Approved & Applied!',
            `Wheel type changed to ${request.requestedWheelType.title}`
          );
        } else if (request.requestType === 'topic_suggestion' && request.topicSuggestion) {
          onTopicSuggestion?.(request.topicSuggestion);
          Alert.alert(
            '✅ Topic Suggestion Approved!',
            `Topic suggestion noted: ${request.topicSuggestion}`
          );
        }
      } else {
        Alert.alert(
          '❌ Request Denied',
          `Request from ${request.participantName} has been denied`
        );
      }

      setShowResponseModal(false);
      setSelectedRequest(null);
      setResponseMessage('');
    } catch (error) {
      console.error('Error responding to request:', error);
      Alert.alert('Error', 'Failed to respond to request. Please try again.');
    } finally {
      setIsResponding(false);
    }
  };

  const openResponseModal = (request: ParticipantRequest) => {
    setSelectedRequest(request);
    setResponseMessage('');
    setShowResponseModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Ionicons name="time" size={16} color="#f59e0b" />;
      case 'approved':
        return <Ionicons name="checkmark-circle" size={16} color="#10b981" />;
      case 'denied':
        return <Ionicons name="close-circle" size={16} color="#ef4444" />;
      default:
        return <Ionicons name="time" size={16} color="#6b7280" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#fef3c7';
      case 'approved':
        return '#d1fae5';
      case 'denied':
        return '#fecaca';
      default:
        return '#f3f4f6';
    }
  };

  const pendingRequests = requests.filter((req) => req.status === 'pending');
  const respondedRequests = requests.filter((req) => req.status !== 'pending');

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: theme.text }]}>📝 Participant Requests</Text>
          {pendingRequests.length > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <Text style={[styles.badgeText, { color: theme.surface }]}>
                {pendingRequests.length}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Manage participant wheel type requests and topic suggestions
      </Text>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Pending Requests</Text>
          <ScrollView style={styles.requestsList} showsVerticalScrollIndicator={false}>
            {pendingRequests.map((request) => (
              <View
                key={request.id}
                style={[
                  styles.requestItem,
                  { 
                    backgroundColor: getStatusColor(request.status),
                    borderColor: theme.border,
                  }
                ]}
              >
                <View style={styles.requestHeader}>
                  <View style={styles.requestTypeRow}>
                    <Ionicons name="person" size={16} color={theme.primary} />
                    <Text style={[styles.participantName, { color: theme.text }]}>
                      {request.participantName}
                    </Text>
                    <View style={styles.requestTypeBadge}>
                      <Text style={[styles.requestTypeText, { color: theme.text }]}>
                        {request.requestType === 'wheel_type_change' 
                          ? 'Wheel Change' 
                          : 'Topic Suggestion'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                    {request.createdAt.toLocaleTimeString()}
                  </Text>
                </View>

                {request.requestType === 'wheel_type_change' && request.requestedWheelType && (
                  <View style={styles.requestContent}>
                    <Text style={[styles.requestLabel, { color: theme.text }]}>
                      Wants to change to:
                    </Text>
                    <View style={styles.wheelTypeInfo}>
                      <Text style={styles.wheelTypeIcon}>
                        {request.requestedWheelType.icon}
                      </Text>
                      <Text style={[styles.wheelTypeName, { color: theme.text }]}>
                        {request.requestedWheelType.title}
                      </Text>
                    </View>
                    <Text style={[styles.wheelTypeDesc, { color: theme.textSecondary }]}>
                      {request.requestedWheelType.description}
                    </Text>
                  </View>
                )}

                {request.requestType === 'topic_suggestion' && (
                  <View style={styles.requestContent}>
                    <Text style={[styles.requestLabel, { color: theme.text }]}>
                      Suggested Topic:
                    </Text>
                    <Text style={[styles.topicText, { color: theme.text }]}>
                      {request.topicSuggestion}
                    </Text>
                  </View>
                )}

                {request.message && (
                  <View style={styles.requestContent}>
                    <Text style={[styles.requestLabel, { color: theme.text }]}>
                      Message:
                    </Text>
                    <Text style={[styles.messageText, { color: theme.textSecondary }]}>
                      {request.message}
                    </Text>
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.approveButton, { backgroundColor: '#10b981' }]}
                    onPress={() => {
                      if (request.requestType === 'wheel_type_change') {
                        openResponseModal(request);
                      } else {
                        handleRequestResponse(request, 'approved');
                      }
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                    <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
                      Approve
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.denyButton, { backgroundColor: '#ef4444' }]}
                    onPress={() => openResponseModal(request)}
                  >
                    <Ionicons name="close-circle" size={16} color="#ffffff" />
                    <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
                      Deny
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Request History */}
      {respondedRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Request History</Text>
          <ScrollView style={styles.requestsList} showsVerticalScrollIndicator={false}>
            {respondedRequests.slice(0, 5).map((request) => (
              <View
                key={request.id}
                style={[
                  styles.requestItem,
                  { 
                    backgroundColor: getStatusColor(request.status),
                    borderColor: theme.border,
                  }
                ]}
              >
                <View style={styles.requestHeader}>
                  <View style={styles.requestTypeRow}>
                    {getStatusIcon(request.status)}
                    <Text style={[styles.participantName, { color: theme.text }]}>
                      {request.participantName}
                    </Text>
                  </View>
                  <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                    {request.respondedAt?.toLocaleTimeString()}
                  </Text>
                </View>

                {request.requestType === 'wheel_type_change' && request.requestedWheelType && (
                  <Text style={[styles.requestSummary, { color: theme.text }]}>
                    Requested: {request.requestedWheelType.icon} {request.requestedWheelType.title}
                  </Text>
                )}

                {request.requestType === 'topic_suggestion' && (
                  <Text style={[styles.requestSummary, { color: theme.text }]}>
                    Suggested: {request.topicSuggestion}
                  </Text>
                )}

                {request.organizerResponse && (
                  <View style={[styles.responseContainer, { backgroundColor: theme.background }]}>
                    <Text style={[styles.responseLabel, { color: theme.textSecondary }]}>
                      Your response:
                    </Text>
                    <Text style={[styles.responseText, { color: theme.text }]}>
                      {request.organizerResponse}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Response Modal */}
      <Modal
        visible={showResponseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowResponseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Respond to {selectedRequest?.participantName}'s Request
              </Text>
              <TouchableOpacity
                onPress={() => setShowResponseModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedRequest && (
              <View style={styles.modalBody}>
                <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
                  {selectedRequest.requestType === 'wheel_type_change' 
                    ? `They want to change the wheel to: ${selectedRequest.requestedWheelType?.title}`
                    : `Topic suggestion: ${selectedRequest.topicSuggestion}`
                  }
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>
                    Response Message (Optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      { 
                        backgroundColor: theme.background,
                        color: theme.text,
                        borderColor: theme.border,
                      }
                    ]}
                    placeholder="Add a message to explain your decision..."
                    placeholderTextColor={theme.textSecondary}
                    value={responseMessage}
                    onChangeText={setResponseMessage}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.approveButton, { backgroundColor: '#10b981' }]}
                    onPress={() => selectedRequest && handleRequestResponse(selectedRequest, 'approved')}
                    disabled={isResponding}
                  >
                    {isResponding ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                        <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>
                          Approve & Apply
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.denyButton, { backgroundColor: '#ef4444' }]}
                    onPress={() => selectedRequest && handleRequestResponse(selectedRequest, 'denied')}
                    disabled={isResponding}
                  >
                    {isResponding ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="close-circle" size={16} color="#ffffff" />
                        <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>
                          Deny Request
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* No Requests State */}
      {requests.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubble-outline" size={48} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No Participant Requests Yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Participants can request wheel type changes and suggest topics during the live session.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  requestsList: {
    maxHeight: 300,
  },
  requestItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  requestTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  participantName: {
    fontSize: 14,
    fontWeight: '500',
  },
  requestTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 4,
  },
  requestTypeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 12,
  },
  requestContent: {
    marginBottom: 8,
  },
  requestLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  wheelTypeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  wheelTypeIcon: {
    fontSize: 20,
  },
  wheelTypeName: {
    fontSize: 14,
    fontWeight: '500',
  },
  wheelTypeDesc: {
    fontSize: 12,
  },
  topicText: {
    fontSize: 14,
  },
  messageText: {
    fontSize: 12,
  },
  requestSummary: {
    fontSize: 12,
    marginBottom: 4,
  },
  responseContainer: {
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  responseText: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  denyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default OrganizerRequestManager;