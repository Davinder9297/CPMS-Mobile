import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import AppHeader from '@/components/AppHeader';
import PullToRefreshControl from '@/components/PullToRefreshControl';
import SmoothScrollView from '@/components/SmoothScrollView';
import Sidebar from '@/components/Sidebar';
import AppraisalAccordion from '@/components/AppraisalAccordion';
import { usePullToRefresh } from '@/hooks';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import { APPRAISAL_TABS, type AppraisalTab } from '@/constants/appraisal';
import * as appraisalApi from '@/services/crew/appraisalApi';
import type {
  AppraisalObjective,
  AppraisalCycleFlags,
  AppraisalSectionMode,
  CrewAppraisal,
  AppraisalAttachment,
} from '@/services/crew/appraisalApi';
import { BORDER_COLOR, BORDER_WIDTH } from '@/constants/Borders';
import RichTextView from '@/components/RichTextView';
import { htmlToPlainText, plainTextToHtml } from '@/utils/richText';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [0, 1, 2, 3].map((offset) => String(CURRENT_YEAR - offset));

const HIDDEN_CYCLE: AppraisalCycleFlags = {
  OBJECTIVE_FLAG: 'HIDE',
  MID_YEAR_COMMENTS_FLAG: 'HIDE',
  MID_YEAR_RATING_FLAG: 'HIDE',
  YEAR_END_COMMENTS_FLAG: 'HIDE',
  YEAR_END_RATING_FLAG: 'HIDE',
};

// --- Attachment chip row, shared by the objective/mid-year/year-end sections ---
function AttachmentChip({
  attachment,
  removable,
  isDownloading,
  isDownloaded,
  onDownload,
  onRemove,
}: {
  attachment: AppraisalAttachment;
  removable: boolean;
  isDownloading: boolean;
  isDownloaded: boolean;
  onDownload: () => void;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.attachmentChip}>
      <Pressable style={styles.attachmentChipLabel} onPress={onDownload} disabled={isDownloading}>
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
      {removable && onRemove && (
        <Pressable style={styles.attachmentChipRemove} onPress={onRemove}>
          <Ionicons name="close" size={16} color="#9CA3AF" />
        </Pressable>
      )}
    </View>
  );
}

// --- Crew-editable comments + attachments section (Mid-Year or Year-End) ---
function CrewCommentSection({
  title,
  initialValue,
  initialAttachments,
  mode,
  onSave,
}: {
  title: string;
  initialValue: string;
  initialAttachments: AppraisalAttachment[];
  mode: AppraisalSectionMode;
  onSave: (comments: string, attachments: AppraisalAttachment[]) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialValue);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [downloadedFiles, setDownloadedFiles] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setDraft(initialValue);
    setAttachments(initialAttachments);
    setError(null);
    setEditing(true);
  };

  const handlePickAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled) return;
    setIsUploading(true);
    setError(null);
    try {
      for (const asset of result.assets) {
        const uploaded = await appraisalApi.uploadAppraisalFile(asset.uri, asset.mimeType ?? undefined, asset.name);
        setAttachments((prev) => [...prev, uploaded]);
      }
    } catch (err) {
      console.error('[uploadAppraisalFile]', err);
      setError(err instanceof Error ? err.message : 'Failed to upload attachment');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadAttachment = async (attachment: AppraisalAttachment) => {
    setDownloadingFile(attachment.fileName);
    setError(null);
    try {
      await appraisalApi.downloadAppraisalFile(attachment);
      setDownloadedFiles((prev) => new Set(prev).add(attachment.fileName));
    } catch (err) {
      console.error('[downloadAppraisalFile]', err);
      setError(err instanceof Error ? err.message : 'Failed to download attachment');
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(draft, attachments);
      setEditing(false);
    } catch (err) {
      console.error('[saveAppraisalSection]', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppraisalAccordion
      title={title}
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      onEdit={mode === 'EDIT' && !editing ? startEdit : undefined}
    >
      {editing ? (
        <View>
          <TextInput
            style={styles.commentInput}
            multiline
            textAlignVertical="top"
            placeholder="Type your comments here"
            placeholderTextColor="#9CA3AF"
            value={draft}
            onChangeText={setDraft}
          />

          <Pressable
            style={[styles.attachmentButton, isUploading && styles.attachmentButtonDisabled]}
            onPress={handlePickAttachment}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#6B7280" />
            ) : (
              <Ionicons name="attach" size={16} color="#6B7280" />
            )}
            <Text style={styles.attachmentText}>{isUploading ? 'Uploading…' : 'Attachment'}</Text>
          </Pressable>

          {attachments.length > 0 && (
            <View style={styles.attachmentList}>
              {attachments.map((a) => (
                <AttachmentChip
                  key={a.fileName}
                  attachment={a}
                  removable
                  isDownloading={downloadingFile === a.fileName}
                  isDownloaded={downloadedFiles.has(a.fileName)}
                  onDownload={() => handleDownloadAttachment(a)}
                  onRemove={() => setAttachments((prev) => prev.filter((x) => x.fileName !== a.fileName))}
                />
              ))}
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.editActions}>
            <Pressable style={styles.cancelButton} onPress={() => setEditing(false)} disabled={isSaving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <View>
          <Text style={styles.bodyText}>{initialValue || 'No comments yet.'}</Text>
          {initialAttachments.length > 0 && (
            <View style={styles.attachmentList}>
              {initialAttachments.map((a) => (
                <AttachmentChip
                  key={a.fileName}
                  attachment={a}
                  removable={false}
                  isDownloading={downloadingFile === a.fileName}
                  isDownloaded={downloadedFiles.has(a.fileName)}
                  onDownload={() => handleDownloadAttachment(a)}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </AppraisalAccordion>
  );
}

// --- Read-only PM-side comments + attachments ---
function ReadOnlyCommentSection({
  title,
  value,
  attachments,
}: {
  title: string;
  value: string;
  attachments: AppraisalAttachment[];
}) {
  const [expanded, setExpanded] = useState(true);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [downloadedFiles, setDownloadedFiles] = useState<Set<string>>(new Set());

  const handleDownload = async (attachment: AppraisalAttachment) => {
    setDownloadingFile(attachment.fileName);
    try {
      await appraisalApi.downloadAppraisalFile(attachment);
      setDownloadedFiles((prev) => new Set(prev).add(attachment.fileName));
    } catch (err) {
      console.error('[downloadAppraisalFile]', err);
    } finally {
      setDownloadingFile(null);
    }
  };

  return (
    <AppraisalAccordion title={title} expanded={expanded} onToggle={() => setExpanded((v) => !v)}>
      <Text style={styles.bodyText}>{value || 'No comments yet.'}</Text>
      {attachments.length > 0 && (
        <View style={styles.attachmentList}>
          {attachments.map((a) => (
            <AttachmentChip
              key={a.fileName}
              attachment={a}
              removable={false}
              isDownloading={downloadingFile === a.fileName}
              isDownloaded={downloadedFiles.has(a.fileName)}
              onDownload={() => handleDownload(a)}
            />
          ))}
        </View>
      )}
    </AppraisalAccordion>
  );
}

export default function MyAppraisalScreen() {
  const router = useRouter();
  const { handleSidebarItem } = useSidebarNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<AppraisalTab>('objectives');
  const [year, setYear] = useState(YEAR_OPTIONS[0]);
  const [yearOpen, setYearOpen] = useState(false);
  const [objectiveIndex, setObjectiveIndex] = useState(0);

  const [objectives, setObjectives] = useState<AppraisalObjective[]>([]);
  const [appraisal, setAppraisal] = useState<CrewAppraisal | null>(null);
  const [cycle, setCycle] = useState<AppraisalCycleFlags>(HIDDEN_CYCLE);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingObjective, setEditingObjective] = useState(false);
  const [objectiveDraft, setObjectiveDraft] = useState('');
  const [isSavingObjective, setIsSavingObjective] = useState(false);
  const [objectiveError, setObjectiveError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [objectivesRes, appraisalRes, cycleRes] = await Promise.all([
        appraisalApi.getMyAppraisalObjectives(),
        appraisalApi.getMyAppraisal(year),
        appraisalApi.getAppraisalCycle(year),
      ]);
      setObjectives(objectivesRes);
      setAppraisal(appraisalRes);
      setCycle(cycleRes);
      setLoadError(null);
    } catch (err) {
      console.error('[loadMyAppraisal]', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load appraisal');
    }
  }, [year]);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      await loadAll();
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadAll]);

  const { refreshing, onRefresh } = usePullToRefresh(loadAll);

  const filteredObjectives = useMemo(() => {
    const q = query.trim().toLowerCase();
    return objectives.filter((obj) => {
      if (obj.AppraisalYear !== year) return false;
      if (!q) return true;
      return (
        (obj.AREA_OF_FOCUS ?? '').toLowerCase().includes(q) ||
        (obj.OBJ_DESC ?? '').toLowerCase().includes(q)
      );
    });
  }, [objectives, year, query]);

  useEffect(() => {
    setObjectiveIndex(0);
    setEditingObjective(false);
  }, [year, query]);

  const displayObjective = filteredObjectives[Math.min(objectiveIndex, filteredObjectives.length - 1)];

  const goPrev = () => {
    setObjectiveIndex((prev) => Math.max(0, prev - 1));
    setEditingObjective(false);
  };
  const goNext = () => {
    setObjectiveIndex((prev) => Math.min(filteredObjectives.length - 1, prev + 1));
    setEditingObjective(false);
  };

  const startEditObjective = () => {
    setObjectiveDraft(htmlToPlainText(displayObjective?.OBJ_CREW_COMMENTS));
    setObjectiveError(null);
    setEditingObjective(true);
  };

  const saveObjectiveComment = async () => {
    if (!displayObjective) return;
    setIsSavingObjective(true);
    setObjectiveError(null);
    try {
      // Unchanged text keeps the original HTML (and its formatting); edited text is saved as
      // paragraph HTML so the web app, which renders these comments as rich text, shows it right.
      const original = displayObjective.OBJ_CREW_COMMENTS ?? '';
      const comment = objectiveDraft === htmlToPlainText(original) ? original : plainTextToHtml(objectiveDraft);
      const updated = await appraisalApi.updateMyAppraisalObjective(displayObjective.AppraisalId, comment);
      setObjectives((prev) => prev.map((o) => (o.AppraisalId === updated.AppraisalId ? updated : o)));
      setEditingObjective(false);
    } catch (err) {
      console.error('[updateMyAppraisalObjective]', err);
      setObjectiveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSavingObjective(false);
    }
  };

  const saveMidYear = async (comments: string, attachments: AppraisalAttachment[]) => {
    const updated = await appraisalApi.updateMyAppraisal(year, {
      MID_CrewComments: comments,
      Mid_CrewAttachments: attachments,
    });
    setAppraisal(updated);
  };

  const saveYearEnd = async (comments: string, attachments: AppraisalAttachment[]) => {
    const updated = await appraisalApi.updateMyAppraisal(year, {
      YEAR_END_CrewComments: comments,
      Year_End_Crew_Attachments: attachments,
    });
    setAppraisal(updated);
  };

  return (
    <View style={styles.container}>
      <AppHeader
        onMenuPress={() => setSidebarOpen(true)}
        onProfilePress={() => router.push('/(tabs)/profile')}
      />

      <SmoothScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.content}>
          <Text style={styles.title}>1.2 Crew Self Service - My Appraisal</Text>

          {appraisal?.APPRAISER_STAFF && (
            <Text style={styles.appraiserLine}>
              Appraiser: {appraisal.APPRAISER_STAFF}
              {appraisal.AppraiserName ? ` - ${appraisal.AppraiserName}` : ''}
            </Text>
          )}

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <View style={styles.tabRow}>
            {APPRAISAL_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  style={[styles.tab, isActive ? styles.tabActive : styles.tabInactive]}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Text
                    style={[styles.tabText, isActive ? styles.tabTextActive : styles.tabTextInactive]}
                    numberOfLines={2}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.yearContainer}>
            <Pressable style={styles.yearButton} onPress={() => setYearOpen((v) => !v)}>
              <Text style={styles.yearText}>{year}</Text>
              <Ionicons name={yearOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#4B5563" />
            </Pressable>
            {yearOpen && (
              <View style={styles.yearMenu}>
                {YEAR_OPTIONS.map((y) => (
                  <Pressable
                    key={y}
                    style={styles.yearOption}
                    onPress={() => {
                      setYear(y);
                      setYearOpen(false);
                    }}
                  >
                    <Text style={[styles.yearOptionText, y === year && styles.yearOptionTextSelected]}>{y}</Text>
                    {y === year && <Ionicons name="checkmark" size={16} color="#5B8C3E" />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {isLoading ? (
            <ActivityIndicator style={styles.loadingIndicator} color="#005C70" />
          ) : loadError ? (
            <Text style={styles.errorText}>{loadError}</Text>
          ) : (
            <>
              {activeTab === 'objectives' &&
                (cycle.OBJECTIVE_FLAG === 'HIDE' ? (
                  <Text style={styles.naText}>Objectives aren't available for {year} yet.</Text>
                ) : filteredObjectives.length === 0 ? (
                  <Text style={styles.naText}>No objectives found.</Text>
                ) : (
                  <>
                    <View style={styles.objectiveHeader}>
                      <Text style={styles.objectiveTitle}>
                        Objective {objectiveIndex + 1} of {filteredObjectives.length}
                      </Text>
                      <View style={styles.objectiveNav}>
                        <Pressable onPress={goPrev} disabled={objectiveIndex === 0} hitSlop={8}>
                          <Ionicons
                            name="chevron-back"
                            size={22}
                            color={objectiveIndex === 0 ? '#D1D5DB' : '#005C70'}
                          />
                        </Pressable>
                        <Pressable
                          onPress={goNext}
                          disabled={objectiveIndex === filteredObjectives.length - 1}
                          hitSlop={8}
                        >
                          <Ionicons
                            name="chevron-forward"
                            size={22}
                            color={objectiveIndex === filteredObjectives.length - 1 ? '#D1D5DB' : '#005C70'}
                          />
                        </Pressable>
                      </View>
                    </View>

                    <Text style={styles.category}>{displayObjective?.AREA_OF_FOCUS || 'General'}</Text>

                    <AppraisalAccordion title="Objective" expanded onToggle={() => {}}>
                      <Text style={styles.bodyText}>{displayObjective?.OBJ_DESC || '—'}</Text>
                    </AppraisalAccordion>

                    <AppraisalAccordion
                      title="Crew Comments"
                      expanded
                      onToggle={() => {}}
                      onEdit={cycle.OBJECTIVE_FLAG === 'EDIT' && !editingObjective ? startEditObjective : undefined}
                    >
                      {editingObjective ? (
                        <View>
                          <TextInput
                            style={styles.commentInput}
                            multiline
                            textAlignVertical="top"
                            value={objectiveDraft}
                            onChangeText={setObjectiveDraft}
                          />
                          {objectiveError && <Text style={styles.errorText}>{objectiveError}</Text>}
                          <View style={styles.editActions}>
                            <Pressable
                              style={styles.cancelButton}
                              onPress={() => setEditingObjective(false)}
                              disabled={isSavingObjective}
                            >
                              <Text style={styles.cancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                              style={styles.saveButton}
                              onPress={saveObjectiveComment}
                              disabled={isSavingObjective}
                            >
                              {isSavingObjective ? (
                                <ActivityIndicator color="#FFFFFF" />
                              ) : (
                                <Text style={styles.saveText}>Save</Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <RichTextView html={displayObjective?.OBJ_CREW_COMMENTS} style={styles.bodyText} emptyText="No comments yet." />
                      )}
                    </AppraisalAccordion>

                    <AppraisalAccordion title="Appraiser Comments" expanded onToggle={() => {}}>
                      <RichTextView html={displayObjective?.OBJ_PM_COMMENTS} style={styles.bodyText} emptyText="No comments yet." />
                    </AppraisalAccordion>

                    <View style={styles.navButtons}>
                      {objectiveIndex > 0 && (
                        <Pressable
                          style={({ pressed }) => [styles.prevButton, pressed && styles.prevButtonPressed]}
                          onPress={goPrev}
                        >
                          <Text style={styles.prevButtonText}>Previous</Text>
                        </Pressable>
                      )}
                      {objectiveIndex < filteredObjectives.length - 1 && (
                        <Pressable
                          style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed]}
                          onPress={goNext}
                        >
                          <Text style={styles.nextButtonText}>Next</Text>
                        </Pressable>
                      )}
                    </View>
                  </>
                ))}

              {activeTab === 'mid_year' && (
                <>
                  <Text style={styles.reviewTitle}>Mid Year Review</Text>
                  {cycle.MID_YEAR_COMMENTS_FLAG === 'HIDE' && cycle.MID_YEAR_RATING_FLAG === 'HIDE' ? (
                    <Text style={styles.naText}>Mid-year review isn't available for {year} yet.</Text>
                  ) : (
                    <>
                      {cycle.MID_YEAR_COMMENTS_FLAG !== 'HIDE' && (
                        <>
                          <CrewCommentSection
                            key={`mid-crew-${year}`}
                            title="Appraise Comments (Crew)"
                            initialValue={appraisal?.MID_CrewComments ?? ''}
                            initialAttachments={appraisal?.Mid_CrewAttachments ?? []}
                            mode={cycle.MID_YEAR_COMMENTS_FLAG}
                            onSave={saveMidYear}
                          />
                          <ReadOnlyCommentSection
                            key={`mid-pm-${year}`}
                            title="Appraiser Comments"
                            value={appraisal?.MID_APRAISERCOMMENTS ?? ''}
                            attachments={appraisal?.MID_APRAISER_ATTACHMENTS ?? []}
                          />
                        </>
                      )}
                      {cycle.MID_YEAR_RATING_FLAG !== 'HIDE' && (
                        <AppraisalAccordion title="Mid-Year Rating" expanded onToggle={() => {}}>
                          <Text style={styles.naText}>{appraisal?.MID_RATING || 'N/A'}</Text>
                        </AppraisalAccordion>
                      )}
                    </>
                  )}
                </>
              )}

              {activeTab === 'annual_year' && (
                <>
                  <Text style={styles.reviewTitle}>Annual Year Review</Text>
                  {cycle.YEAR_END_COMMENTS_FLAG === 'HIDE' && cycle.YEAR_END_RATING_FLAG === 'HIDE' ? (
                    <Text style={styles.naText}>Year-end review isn't available for {year} yet.</Text>
                  ) : (
                    <>
                      {cycle.YEAR_END_COMMENTS_FLAG !== 'HIDE' && (
                        <>
                          <CrewCommentSection
                            key={`ye-crew-${year}`}
                            title="Appraise Comments (Crew)"
                            initialValue={appraisal?.YEAR_END_CrewComments ?? ''}
                            initialAttachments={appraisal?.Year_End_Crew_Attachments ?? []}
                            mode={cycle.YEAR_END_COMMENTS_FLAG}
                            onSave={saveYearEnd}
                          />
                          <ReadOnlyCommentSection
                            key={`ye-pm-${year}`}
                            title="Appraiser Comments"
                            value={appraisal?.Year_END_PM_COMMENTS ?? ''}
                            attachments={appraisal?.Year_END_PM_Attachment ?? []}
                          />
                        </>
                      )}
                      {cycle.YEAR_END_RATING_FLAG !== 'HIDE' && (
                        <AppraisalAccordion title="Final Rating" expanded onToggle={() => {}}>
                          <Text style={styles.naText}>{appraisal?.Year_End_Rating || 'N/A'}</Text>
                        </AppraisalAccordion>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </View>
      </SmoothScrollView>

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItemId="1.3"
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  appraiserLine: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#374151',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: BORDER_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
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
    lineHeight: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#2563EB',
  },
  tabTextInactive: {
    color: '#4B5563',
  },
  yearContainer: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    zIndex: 20,
  },
  yearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  yearText: {
    fontSize: 14,
    color: '#1F2937',
    marginRight: 4,
  },
  yearMenu: {
    position: 'absolute',
    top: 42,
    left: 0,
    minWidth: 120,
    backgroundColor: '#FFFFFF',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  yearOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  yearOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  yearOptionTextSelected: {
    color: '#5B8C3E',
    fontWeight: '600',
  },
  loadingIndicator: {
    marginTop: 24,
  },
  objectiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  objectiveTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#005C70',
  },
  objectiveNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  category: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  bodyText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  commentInput: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 100,
    backgroundColor: '#FFFFFF',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelText: {
    color: '#4B5563',
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#5B8C3E',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  navButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  prevButton: {
    flex: 1,
    borderWidth: BORDER_WIDTH,
    borderColor: '#5B8C3E',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  prevButtonPressed: {
    backgroundColor: '#F0FDF4',
  },
  prevButtonText: {
    color: '#5B8C3E',
    fontWeight: '700',
    fontSize: 16,
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#5B8C3E',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextButtonPressed: {
    backgroundColor: '#4A7332',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#005C70',
    marginBottom: 12,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
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
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
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
    marginTop: 8,
  },
  naText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
