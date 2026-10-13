import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '@/components/AppHeader';
import ErrorState from '@/components/ErrorState';
import PullToRefreshControl from '@/components/PullToRefreshControl';
import SmoothScrollView from '@/components/SmoothScrollView';
import Sidebar from '@/components/Sidebar';
import AppraisalAccordion from '@/components/AppraisalAccordion';
import RichTextView from '@/components/RichTextView';
import { usePullToRefresh } from '@/hooks';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import * as pipApi from '@/services/crew/pipApi';
import type { CrewPip, CrewPipObjective, CrewPipReviewTask, PipAttachment } from '@/services/crew/pipApi';
import { BORDER_COLOR, BORDER_WIDTH } from '@/constants/Borders';

type PipTab = 'details' | 'objectives' | 'reviews';

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function isPipClosed(pip: CrewPip): boolean {
  return (pip.PIPStatus || '').toLowerCase() === 'closed';
}

// Mirrors PipManager.jsx's isReviewTaskClosed/isReviewTaskDelayed exactly —
// closed always wins over "delayed" even if TargetDate is in the past.
function isReviewDelayed(task: CrewPipReviewTask): boolean {
  const isClosed = (task.Task_Status ?? '').toUpperCase() === 'CLOSED';
  return !isClosed && !!task.TargetDate && new Date(task.TargetDate) < new Date(new Date().setHours(0, 0, 0, 0));
}

function DetailField({
  label,
  value,
  multiline = false,
  richText = false,
  style,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  richText?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldBox, multiline && styles.fieldBoxMultiline]}>
        {richText ? (
          <RichTextView html={value} style={styles.fieldValue} />
        ) : (
          <Text style={styles.fieldValue}>{value}</Text>
        )}
      </View>
    </View>
  );
}

function AttachmentRow({ attachment }: { attachment: PipAttachment }) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await pipApi.downloadPipFile(attachment);
      setDownloaded(true);
    } catch (err) {
      console.error('[downloadPipFile]', err);
      setError(err instanceof Error ? err.message : 'Failed to download');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View>
      <Pressable style={styles.attachmentChip} onPress={handleDownload} disabled={downloading}>
        {downloading ? (
          <ActivityIndicator size="small" color="#374151" />
        ) : (
          <Ionicons name={downloaded ? 'checkmark-circle' : 'download-outline'} size={16} color={downloaded ? '#16A34A' : '#374151'} />
        )}
        <Text style={styles.attachmentChipText} numberOfLines={1}>
          {attachment.originalName}
        </Text>
      </Pressable>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

function ObjectiveCard({ objective, editable, onSave }: {
  objective: CrewPipObjective;
  editable: boolean;
  onSave: (crewStatement: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(objective.Crew_Statement);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setDraft(objective.Crew_Statement);
    setError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (err) {
      console.error('[updateMyPipObjective]', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.objectiveBlock}>
      <Pressable style={styles.objectiveHeader} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.objectiveTitle} numberOfLines={2}>
          {objective.Obj_Improvement_Obj || 'Objective'}
        </Text>
        <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={18} color="#2C5271" />
      </Pressable>

      {expanded && (
        <>
          <AppraisalAccordion title="Improvement Objective" expanded onToggle={() => {}}>
            <Text style={styles.bodyText}>{objective.Obj_Improvement_Obj || '—'}</Text>
          </AppraisalAccordion>

          <AppraisalAccordion title="Success Criteria" expanded onToggle={() => {}}>
            <Text style={styles.bodyText}>{objective.Success_Criteria || '—'}</Text>
          </AppraisalAccordion>

          {!!objective.SupportRequired && (
            <AppraisalAccordion title="Support Required" expanded onToggle={() => {}}>
              <Text style={styles.bodyText}>{objective.SupportRequired}</Text>
            </AppraisalAccordion>
          )}

          <AppraisalAccordion
            title="Crew Statement"
            expanded
            onToggle={() => {}}
            onEdit={editable && !editing ? startEdit : undefined}
          >
            {editing ? (
              <View>
                <TextInput
                  style={styles.editInput}
                  multiline
                  textAlignVertical="top"
                  value={draft}
                  onChangeText={setDraft}
                />
                {error && <Text style={styles.errorText}>{error}</Text>}
                <View style={styles.editActions}>
                  <Pressable style={styles.cancelButton} onPress={() => setEditing(false)} disabled={isSaving}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Text style={styles.bodyText}>{objective.Crew_Statement || 'No statement yet.'}</Text>
            )}
          </AppraisalAccordion>

          <AppraisalAccordion title="Appraiser Statement" expanded onToggle={() => {}}>
            <Text style={styles.bodyText}>{objective.Appraiser_Statement || 'No statement yet.'}</Text>
          </AppraisalAccordion>
        </>
      )}
    </View>
  );
}

export default function PipDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { handleSidebarItem } = useSidebarNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PipTab>('details');

  const [pip, setPip] = useState<CrewPip | null>(null);
  const [objectives, setObjectives] = useState<CrewPipObjective[]>([]);
  const [reviewTasks, setReviewTasks] = useState<CrewPipReviewTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadPip = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      return;
    }
    try {
      const pips = await pipApi.getMyPips();
      const match = pips.find((p) => p.PIP_id === id);
      if (!match) {
        setNotFound(true);
        return;
      }
      setPip(match);
      setNotFound(false);

      const [objectivesRes, reviewsRes] = await Promise.all([
        pipApi.getMyPipObjectives(id),
        pipApi.getMyPipReviewTasks(id),
      ]);
      setObjectives(objectivesRes);
      setReviewTasks(reviewsRes);
    } catch (err) {
      console.error('[loadPip]', err);
      setNotFound(true);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      await loadPip();
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadPip]);

  const { refreshing, onRefresh } = usePullToRefresh(loadPip);

  const handleSaveObjective = async (objectiveId: string, crewStatement: string) => {
    if (!id) return;
    const updated = await pipApi.updateMyPipObjective(id, objectiveId, crewStatement);
    setObjectives((prev) => prev.map((o) => (o.ObjectiveID === updated.ObjectiveID ? updated : o)));
  };

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <AppHeader onMenuPress={() => setSidebarOpen(true)} onProfilePress={() => router.push('/(tabs)/profile')} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#005C70" />
        </View>
        <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} activeItemId="1.4" onItemPress={handleSidebarItem} />
      </View>
    );
  }

  if (!pip || notFound) {
    return (
      <View style={styles.screen}>
        <AppHeader onMenuPress={() => setSidebarOpen(true)} onProfilePress={() => router.push('/(tabs)/profile')} />
        <ErrorState
          fullScreen
          title="PIP not found"
          message="This performance improvement plan could not be loaded."
          onRetry={() => router.back()}
          retryLabel="Go Back"
        />
        <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} activeItemId="1.4" onItemPress={handleSidebarItem} />
      </View>
    );
  }

  const statusLabel = isPipClosed(pip) ? 'Closed' : 'Open';

  return (
    <View style={styles.screen}>
      <AppHeader onMenuPress={() => setSidebarOpen(true)} onProfilePress={() => router.push('/(tabs)/profile')} />

      <SmoothScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.content}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <View style={styles.backIconBox}>
              <Ionicons name="chevron-back" size={18} color="#6B7280" />
            </View>
            <Text style={styles.backText}>Go Back</Text>
          </Pressable>

          <Text style={styles.title}>
            {pip.PIP_TYPENAME || pip.PIP_id} - {statusLabel}
          </Text>
          <Text style={styles.subtitle}>Next Action Date: {formatDate(pip.TargetDate)}</Text>

          <View style={styles.tabRow}>
            {(
              [
                { id: 'details', label: 'PIP Details' },
                { id: 'objectives', label: 'PIP Objectives' },
                { id: 'reviews', label: 'Reviews' },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  style={[styles.tab, isActive ? styles.tabActive : styles.tabInactive]}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Text style={[styles.tabText, isActive ? styles.tabTextActive : styles.tabTextInactive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {activeTab === 'details' && (
            <View style={styles.detailsCard}>
              <Text style={styles.detailsHeading}>PIP Details</Text>

              <View style={styles.fieldRow}>
                <DetailField label="PIP Type" value={pip.PIP_TYPE} style={styles.fieldFlex} />
                <DetailField label="Appraisal Year" value={pip.Appraisal_year} style={styles.fieldFlex} />
              </View>

              <DetailField
                label="Description of the under performance"
                value={pip.Desc_underperformance || ''}
                multiline
                richText
                style={styles.fieldSpacing}
              />

              <View style={styles.fieldRow}>
                <DetailField label="Start Date" value={formatDate(pip.Start_Date)} style={styles.fieldFlex} />
                <DetailField label="End Date" value={formatDate(pip.End_Date)} style={styles.fieldFlex} />
              </View>

              <DetailField
                label="Aim of the performance improvement plan"
                value={pip.AIM_PIP || ''}
                multiline
                richText
                style={styles.fieldSpacing}
              />

              <View style={styles.fieldRow}>
                <DetailField label="Status" value={statusLabel} style={styles.fieldFlex} />
                <DetailField label="Target Date" value={formatDate(pip.TargetDate)} style={styles.fieldFlex} />
              </View>

              <DetailField
                label="PIP Owner"
                value={pip.OwnerName || pip.PIP_Owner_StaffId || '—'}
                style={styles.fieldSpacing}
              />

              {isPipClosed(pip) && (
                <>
                  <DetailField label="Closed By" value={pip.PIP_ClosedBy || '—'} style={styles.fieldSpacing} />
                  <DetailField label="Closure Comments" value={pip.PIP_Closure_Comments || '—'} multiline />
                </>
              )}

              {pip.Attachments.length > 0 && (
                <View style={styles.attachmentSection}>
                  <Text style={styles.fieldLabel}>Attachments</Text>
                  <View style={styles.attachmentList}>
                    {pip.Attachments.map((a) => (
                      <AttachmentRow key={a.fileName} attachment={a} />
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {activeTab === 'objectives' && (
            <>
              {objectives.length === 0 ? (
                <Text style={styles.naText}>No objectives set for this PIP yet.</Text>
              ) : (
                objectives.map((objective) => (
                  <ObjectiveCard
                    key={objective.ObjectiveID}
                    objective={objective}
                    editable={!isPipClosed(pip)}
                    onSave={(crewStatement) => handleSaveObjective(objective.ObjectiveID, crewStatement)}
                  />
                ))
              )}
            </>
          )}

          {activeTab === 'reviews' && (
            <>
              {reviewTasks.length === 0 ? (
                <Text style={styles.naText}>No reviews scheduled for this PIP yet.</Text>
              ) : (
                reviewTasks.map((task) => (
                  <View key={`${task.TaskId}-${task.TaskTypeId}-${task.TaskOwnerUserId}`} style={styles.reviewRow}>
                    <View style={styles.reviewRowMain}>
                      <Text style={styles.reviewDate}>{formatDate(task.TargetDate)}</Text>
                      <Text style={styles.reviewStatus}>{task.Task_Status || '—'}</Text>
                    </View>
                    <Text style={styles.reviewOwnerLine}>
                      Owner: {task.OwnerName || 'Unknown'} ({task.VAR3 || '—'})
                    </Text>
                    {isReviewDelayed(task) && <Text style={styles.reviewDelayed}>Delayed</Text>}
                  </View>
                ))
              )}
            </>
          )}
        </View>
      </SmoothScrollView>

      <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} activeItemId="1.4" onItemPress={handleSidebarItem} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
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
  backIconBox: {
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: BORDER_WIDTH,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  tabInactive: {
    backgroundColor: '#F3F4F6',
    borderColor: BORDER_COLOR,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#2563EB',
  },
  tabTextInactive: {
    color: '#4B5563',
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    padding: 16,
  },
  detailsHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#005C70',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  fieldBox: {
    backgroundColor: '#fff',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldBoxMultiline: {
    minHeight: 90,
  },
  fieldValue: {
    fontSize: 16,
    color: '#111827',
  },
  fieldSpacing: {
    marginBottom: 16,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  fieldFlex: {
    flex: 1,
  },
  attachmentSection: {
    marginTop: 4,
  },
  attachmentList: {
    gap: 8,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attachmentChipText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
    flexShrink: 1,
  },
  objectiveBlock: {
    marginBottom: 16,
  },
  objectiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  objectiveTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#2C5271',
    marginRight: 8,
  },
  bodyText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  editInput: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 100,
    backgroundColor: '#fff',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    borderWidth: BORDER_WIDTH,
    borderColor: '#5B8C3E',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#5B8C3E',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#5B8C3E',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginTop: 8,
  },
  naText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  reviewOwnerLine: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  reviewRow: {
    backgroundColor: '#fff',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  reviewRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  reviewStatus: {
    fontSize: 13,
    color: '#6B7280',
  },
  reviewDelayed: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
});
