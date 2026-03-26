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
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
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

interface WheelType {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultSlices: string[];
}

interface ParticipantRequestComponentProps {
  sessionId: string;
  participantId: string;
  participantName: string;
  availableWheelTypes: WheelType[];
}

const ParticipantRequestComponent: React.FC<ParticipantRequestComponentProps> = ({
  sessionId,
  participantId,
  participantName,
  availableWheelTypes,
}) => {
  const { theme } = useTheme();
  const [requests, setRequests] = useState<ParticipantRequest[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState<'wheel_type_change' | 'topic_suggestion'>('wheel_type_change');
  const [selectedWheelType, setSelectedWheelType] = useState<string>('');
  const [topicSuggestion, setTopicSuggestion] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Listen to requests in real-time
  useEffect(() => {
    if (!sessionId) return;

    const requestsQuery = query(
      collection(db, 'participantRequests'),
      where('sessionId', '==', sessionId),
      where('participantId', '==', participantId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        const requestsData: ParticipantRequest[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          requestsData.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            respondedAt: data.respondedAt?.toDate(),
          } as ParticipantRequest);
        });
        setRequests(requestsData);
      },
      (error) => {
        console.error('Error listening to requests:', error);
      }
    );

    return () => unsubscribe();
  }, [sessionId, participantId]);

  const submitRequest = async () => {
    if (!sessionId || !participantId) return;

    if (requestType === 'wheel_type_change' && !selectedWheelType) {
      Alert.alert('Error', 'Please select a wheel type');
      return;
    }

    if (requestType === 'topic_suggestion' && !topicSuggestion.trim()) {
      Alert.alert('Error', 'Please enter a topic suggestion');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedWheel = availableWheelTypes.find((wheel) => wheel.id === selectedWheelType);

      const requestData = {
        sessionId,
        participantId,
        participantName,
        requestType,
        ...(requestType === 'wheel_type_change' && selectedWheel && {
          requestedWheelType: {
            id: selectedWheel.id,
            title: selectedWheel.name,
            description: selectedWheel.description,
            icon: selectedWheel.icon,
            category: 'mobile', // Set category for mobile requests
            defaultItems: selectedWheel.defaultSlices,
            color: selectedWheel.color,
          },
        }),
        ...(requestType === 'topic_suggestion' && {
          topicSuggestion: topicSuggestion.trim(),
        }),
        ...(message.trim() && { message: message.trim() }), // Only include message if it's not empty
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'participantRequests'), requestData);

      Alert.alert('✅ Request Submitted!', 'Your request has been sent to the organizer');

      // Reset form
      setSelectedWheelType('');
      setTopicSuggestion('');
      setMessage('');
      setShowRequestModal(false);
    } catch (error) {
      console.error('Error submitting request:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>📝 Request Changes</Text>
        {pendingRequests.length > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.primary }]}>
            <Text style={[styles.badgeText, { color: theme.surface }]}>
              {pendingRequests.length}
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Request wheel type changes or suggest topics
      </Text>

      {/* Request Button */}
      <TouchableOpacity
        style={[styles.requestButton, { backgroundColor: theme.primary }]}
        onPress={() => setShowRequestModal(true)}
      >
        <Ionicons name="send" size={20} color={theme.surface} />
        <Text style={[styles.requestButtonText, { color: theme.surface }]}>
          Make Request
        </Text>
      </TouchableOpacity>

      {/* Recent Requests */}
      {requests.length > 0 && (
        <View style={styles.requestsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Requests</Text>
          <ScrollView style={styles.requestsList} showsVerticalScrollIndicator={false}>
            {requests.slice(0, 3).map((request) => (
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
                    <Text style={[styles.requestTypeText, { color: theme.text }]}>
                      {request.requestType === 'wheel_type_change' 
                        ? 'Wheel Change' 
                        : 'Topic Suggestion'}
                    </Text>
                  </View>
                  <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                    {request.createdAt.toLocaleTimeString()}
                  </Text>
                </View>

                {request.requestType === 'wheel_type_change' && request.requestedWheelType && (
                  <Text style={[styles.requestContent, { color: theme.text }]}>
                    {request.requestedWheelType.icon} {request.requestedWheelType.title}
                  </Text>
                )}

                {request.requestType === 'topic_suggestion' && (
                  <Text style={[styles.requestContent, { color: theme.text }]}>
                    {request.topicSuggestion}
                  </Text>
                )}

                {request.organizerResponse && (
                  <View style={[styles.responseContainer, { backgroundColor: theme.background }]}>
                    <Text style={[styles.responseLabel, { color: theme.textSecondary }]}>
                      Organizer Response:
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

      {/* Request Modal */}
      <Modal
        visible={showRequestModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Submit Request
              </Text>
              <TouchableOpacity
                onPress={() => setShowRequestModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Request Type Selection */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Request Type</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setRequestType('wheel_type_change')}
                  >
                    <Ionicons
                      name={requestType === 'wheel_type_change' ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={theme.primary}
                    />
                    <Text style={[styles.radioText, { color: theme.text }]}>
                      Change Wheel Type
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setRequestType('topic_suggestion')}
                  >
                    <Ionicons
                      name={requestType === 'topic_suggestion' ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={theme.primary}
                    />
                    <Text style={[styles.radioText, { color: theme.text }]}>
                      Suggest Topic
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Wheel Type Selection */}
              {requestType === 'wheel_type_change' && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>Select Wheel Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.wheelTypeGrid}>
                      {availableWheelTypes.map((wheelType) => (
                        <TouchableOpacity
                          key={wheelType.id}
                          style={[
                            styles.wheelTypeCard,
                            {
                              backgroundColor: selectedWheelType === wheelType.id ? theme.primary + '20' : theme.background,
                              borderColor: selectedWheelType === wheelType.id ? theme.primary : theme.border,
                            }
                          ]}
                          onPress={() => setSelectedWheelType(wheelType.id)}
                        >
                          <Text style={styles.wheelTypeIcon}>{wheelType.icon}</Text>
                          <Text style={[styles.wheelTypeName, { color: theme.text }]} numberOfLines={2}>
                            {wheelType.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Topic Suggestion */}
              {requestType === 'topic_suggestion' && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>Topic Suggestion</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                    placeholder="Enter your topic suggestion..."
                    placeholderTextColor={theme.textSecondary}
                    value={topicSuggestion}
                    onChangeText={setTopicSuggestion}
                    multiline
                  />
                </View>
              )}

              {/* Additional Message */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Additional Message (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="Add any details about your request..."
                  placeholderTextColor={theme.textSecondary}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                />
              </View>
            </ScrollView>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: theme.primary,
                  opacity: isSubmitting ? 0.7 : 1,
                }
              ]}
              onPress={submitRequest}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={theme.surface} />
              ) : (
                <Text style={[styles.submitButtonText, { color: theme.surface }]}>
                  Submit Request
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
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
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  requestButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  requestsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  requestsList: {
    maxHeight: 200,
  },
  requestItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  requestTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestTypeText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  timeText: {
    fontSize: 12,
  },
  requestContent: {
    fontSize: 14,
    marginBottom: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  radioGroup: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioText: {
    fontSize: 16,
    marginLeft: 12,
  },
  wheelTypeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  wheelTypeCard: {
    width: 100,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  wheelTypeIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  wheelTypeName: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    margin: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ParticipantRequestComponent;