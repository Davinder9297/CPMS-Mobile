import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import AppHeader from '@/components/AppHeader';
import ErrorState from '@/components/ErrorState';
import PullToRefreshControl from '@/components/PullToRefreshControl';
import Sidebar from '@/components/Sidebar';
import SmoothScrollView from '@/components/SmoothScrollView';
import TaskCard from '@/components/TaskCard';
import { usePullToRefresh } from '@/hooks';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import type { Task, TaskAttachment } from '@/constants/tasks';
import * as performanceApi from '@/services/performance/performanceApi';
import type { PerformanceTask } from '@/services/performance/performanceApi';
import {
  mapTaskToDisplay,
  formatDisplayDate,
  THREE_SIXTY_TASK_TYPE_ID,
} from '@/services/performance/taskMapping';
import { ApiError } from '@/services/api/client';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function TaskDetailScreen() {
  const router = useRouter();
  const { taskId, taskTypeId, taskOwnerUserId } = useLocalSearchParams<{
    taskId: string;
    taskTypeId: string;
    taskOwnerUserId: string;
  }>();
  const { handleSidebarItem } = useSidebarNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [response, setResponse] = useState('');
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [rawTask, setRawTask] = useState<PerformanceTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [downloadedFiles, setDownloadedFiles] = useState<Set<string>>(new Set());

  const is360Task = taskTypeId === THREE_SIXTY_TASK_TYPE_ID;

  // 360 feedback tasks are handled by the Give 360 Feedback screen, so a link
  // or notification that lands here is forwarded there.
  useEffect(() => {
    if (is360Task && taskId) {
      router.replace({
        pathname: '/(tabs)/feedback-360-provide',
        params: { id: taskId, from: 'my-tasks' },
      });
    }
  }, [is360Task, taskId, router]);

  const loadTask = useCallback(async () => {
    if (is360Task) return;
    if (!taskId || !taskTypeId || !taskOwnerUserId) {
      setNotFound(true);
      return;
    }
    try {
      const data = await performanceApi.getMyTaskById(taskId, taskTypeId, taskOwnerUserId);
      const mapped = mapTaskToDisplay(data);
      setTask(mapped);
      setRawTask(data);
      setResponse(mapped.notes ?? '');
      setAttachments(mapped.attachments ?? []);
      setNotFound(false);
    } catch (err) {
      setNotFound(!(err instanceof ApiError) || err.status === 404);
    }
  }, [is360Task, taskId, taskTypeId, taskOwnerUserId]);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      await loadTask();
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadTask]);

  const { refreshing, onRefresh } = usePullToRefresh(loadTask);

  const handlePickAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled) return;

    setIsUploading(true);
    setSubmitError(null);
    try {
      for (const asset of result.assets) {
        const uploaded = await performanceApi.uploadTaskFile(asset.uri, asset.mimeType ?? undefined, asset.name);
        setAttachments((prev) => [...prev, uploaded]);
      }
    } catch (err) {
      console.error('[uploadTaskFile]', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to upload attachment');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = (fileName: string) => {
    setAttachments((prev) => prev.filter((a) => a.fileName !== fileName));
  };

  const handleDownloadAttachment = async (attachment: TaskAttachment) => {
    setDownloadingFile(attachment.fileName);
    setSubmitError(null);
    try {
      await performanceApi.downloadTaskFile(attachment);
      setDownloadedFiles((prev) => new Set(prev).add(attachment.fileName));
    } catch (err) {
      console.error('[downloadTaskFile]', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to download attachment');
    } finally {
      setDownloadingFile(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <AppHeader
          onMenuPress={() => setSidebarOpen(true)}
          onProfilePress={() => router.push('/(tabs)/profile')}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#005C70" />
        </View>
        <Sidebar
          visible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeItemId="1.2"
          onItemPress={handleSidebarItem}
        />
      </View>
    );
  }

  if (!task || notFound) {
    return (
      <View style={styles.container}>
        <AppHeader
          onMenuPress={() => setSidebarOpen(true)}
          onProfilePress={() => router.push('/(tabs)/profile')}
        />
        <ErrorState
          fullScreen
          title="Task not found"
          message="This task could not be loaded."
          onRetry={() => router.replace('/(tabs)/my-tasks')}
          retryLabel="Go Back"
        />
        <Sidebar
          visible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeItemId="1.2"
          onItemPress={handleSidebarItem}
        />
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!taskId || !taskTypeId || !taskOwnerUserId) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await performanceApi.updateMyTaskAttachments(taskId, taskTypeId, taskOwnerUserId, {
        attachments,
        notes: response,
      });
      router.replace('/(tabs)/task-success');
    } catch (err) {
      console.error('[updateMyTaskAttachments]', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        onMenuPress={() => setSidebarOpen(true)}
        onProfilePress={() => router.push('/(tabs)/profile')}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SmoothScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.content}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace('/(tabs)/my-tasks')}
            >
              <View style={styles.backIcon}>
                <Ionicons name="chevron-back" size={18} color="#6B7280" />
              </View>
              <Text style={styles.backText}>Go Back</Text>
            </Pressable>

            <Text style={styles.title}>{task.title}</Text>

            <TaskCard task={task} showChevron={false} />

            {rawTask && (
              <View style={styles.detailsCard}>
                <Text style={styles.detailsHeading}>Task Information</Text>
                <DetailRow label="Task ID" value={rawTask.TaskId} />
                <DetailRow label="Task Type" value={rawTask.TaskTypeName || rawTask.TaskTypeId} />
                <DetailRow label="Crew Member" value={rawTask.crewName || rawTask.StaffId || '—'} />
                <DetailRow label="Status" value={rawTask.Task_Status || '—'} />
                <DetailRow label="Delayed" value={rawTask.isDelayed ? 'Yes' : 'No'} />
                <DetailRow label="Created" value={formatDisplayDate(rawTask.Created_Date) || '—'} />
                <DetailRow label="Target Date" value={formatDisplayDate(rawTask.TargetDate) || '—'} />
                {rawTask.NextActionDueDate && (
                  <DetailRow label="Next Action Due" value={formatDisplayDate(rawTask.NextActionDueDate)} />
                )}
                {rawTask.ActualCompletionDate && (
                  <DetailRow label="Completed On" value={formatDisplayDate(rawTask.ActualCompletionDate)} />
                )}
                {rawTask.Description && (
                  <View style={styles.detailDescription}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailDescriptionText}>{rawTask.Description}</Text>
                  </View>
                )}
              </View>
            )}

            <Text style={styles.responseHeading}>
              Please Enter your Response
            </Text>

            <Text style={styles.responseLabel}>Response</Text>
            <TextInput
              style={styles.responseInput}
              placeholder="Type your message here"
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
              value={response}
              onChangeText={setResponse}
            />

            <Pressable
              style={({ pressed }) => [
                styles.attachmentButton,
                pressed && styles.attachmentButtonPressed,
                isUploading && styles.attachmentButtonDisabled,
              ]}
              onPress={handlePickAttachment}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#6B7280" />
              ) : (
                <Ionicons name="attach" size={18} color="#6B7280" />
              )}
              <Text style={styles.attachmentText}>
                {isUploading ? 'Uploading…' : 'Attachment'}
              </Text>
            </Pressable>

            {attachments.length > 0 && (
              <View style={styles.attachmentList}>
                {attachments.map((attachment) => {
                  const isDownloading = downloadingFile === attachment.fileName;
                  const isDownloaded = downloadedFiles.has(attachment.fileName);
                  return (
                    <View key={attachment.fileName} style={styles.attachmentChip}>
                      <Pressable
                        style={styles.attachmentChipLabel}
                        onPress={() => handleDownloadAttachment(attachment)}
                        disabled={isDownloading}
                      >
                        {isDownloading ? (
                          <ActivityIndicator size="small" color="#374151" />
                        ) : (
                          <Ionicons
                            name={isDownloaded ? 'checkmark-circle' : 'download-outline'}
                            size={16}
                            color={isDownloaded ? '#16A34A' : '#374151'}
                          />
                        )}
                        <Text style={styles.attachmentChipText} numberOfLines={1}>
                          {attachment.originalName}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.attachmentChipRemove}
                        onPress={() => handleRemoveAttachment(attachment.fileName)}
                      >
                        <Ionicons name="close" size={16} color="#9CA3AF" />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            {submitError && <Text style={styles.errorText}>{submitError}</Text>}
          </View>
        </SmoothScrollView>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
              isSubmitting && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Submit</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItemId="1.2"
        onItemPress={handleSidebarItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  backText: {
    fontSize: 16,
    color: '#6B7280',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 20,
  },
  detailsHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#005C70',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
    textAlign: 'right',
  },
  detailDescription: {
    paddingTop: 10,
  },
  detailDescriptionText: {
    fontSize: 13,
    color: '#111827',
    marginTop: 4,
    lineHeight: 19,
  },
  responseHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#005C70',
    marginTop: 8,
    marginBottom: 12,
  },
  responseLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 8,
  },
  responseInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 140,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  attachmentButtonPressed: {
    backgroundColor: '#F9FAFB',
  },
  attachmentButtonDisabled: {
    opacity: 0.7,
  },
  attachmentText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
  },
  attachmentList: {
    marginTop: 12,
    gap: 8,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attachmentChipLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  attachmentChipText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
    flexShrink: 1,
  },
  attachmentChipRemove: {
    padding: 4,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginTop: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 8,
    backgroundColor: '#F5F5F5',
  },
  submitButton: {
    backgroundColor: '#5B8C3E',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonPressed: {
    backgroundColor: '#4A7332',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
});
