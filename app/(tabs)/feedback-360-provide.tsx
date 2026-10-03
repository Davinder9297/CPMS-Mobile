import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '@/components/AppHeader';
import ConfirmModal from '@/components/ConfirmModal';
import Sidebar from '@/components/Sidebar';
import SmoothScrollView from '@/components/SmoothScrollView';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import * as threeSixtyApi from '@/services/crew/threeSixtyApi';
import type { Give360Detail } from '@/services/crew/threeSixtyApi';

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

const ratingKey = (staffId: string, kpiId: string) => `${staffId}::${kpiId}`;

function StarRating({
  value,
  options,
  editable,
  onChange,
}: {
  value: number;
  options: number[];
  editable: boolean;
  onChange: (rating: number) => void;
}) {
  return (
    <View style={styles.starRow}>
      {options.map((option) => (
        <Pressable
          key={option}
          disabled={!editable}
          onPress={() => onChange(option)}
          hitSlop={4}
        >
          <Ionicons
            name={option <= value ? 'star' : 'star-outline'}
            size={22}
            color={option <= value ? '#5B8C3E' : '#9CA3AF'}
          />
        </Pressable>
      ))}
    </View>
  );
}

export default function Provide360FeedbackScreen() {
  const router = useRouter();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { handleSidebarItem } = useSidebarNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [expandedCrew, setExpandedCrew] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<Give360Detail | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await threeSixtyApi.getGive360Task(id);
      setDetail(res);
      const existing: Record<string, number> = {};
      for (const member of res.crew) {
        for (const kpi of member.kpis) {
          if (kpi.rating !== null) existing[ratingKey(member.staffId, kpi.id)] = kpi.rating;
        }
      }
      setRatings(existing);
      setComments(Object.fromEntries(res.crew.map((m) => [m.staffId, m.comments])));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load feedback');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isSubmitted = detail?.status === 'submitted';
  const scaleOptions = useMemo(() => detail?.scale.map((s) => s.rating) ?? [], [detail]);

  // Every KPI of every crew member must be rated before Submit is enabled.
  // (The server enforces the same rule.)
  const { totalKpis, ratedKpis } = useMemo(() => {
    let total = 0;
    let rated = 0;
    for (const member of detail?.crew ?? []) {
      for (const kpi of member.kpis) {
        total += 1;
        if (ratings[ratingKey(member.staffId, kpi.id)] !== undefined) rated += 1;
      }
    }
    return { totalKpis: total, ratedKpis: rated };
  }, [detail, ratings]);

  const canSubmit = !isSubmitted && !isSubmitting && totalKpis > 0 && ratedKpis === totalKpis;

  const isExpanded = (staffId: string) => expandedCrew[staffId] !== false;

  const toggleCrew = (staffId: string) => {
    setExpandedCrew((prev) => ({
      ...prev,
      [staffId]: !(prev[staffId] !== false),
    }));
  };

  const updateRating = (staffId: string, kpiId: string, rating: number) => {
    setRatings((prev) => ({ ...prev, [ratingKey(staffId, kpiId)]: rating }));
    setSubmitError(null);
  };

  // Back/after-submit target: My Tasks when opened from there, otherwise the
  // Give 360 Feedback list.
  const leave = () => {
    if (from === 'my-tasks') {
      router.replace('/(tabs)/my-tasks');
      return;
    }
    router.replace({
      pathname: '/(tabs)/feedback-360',
      params: { mode: 'give' },
    });
  };

  const confirmSubmit = async () => {
    setConfirmVisible(false);
    if (!detail || !canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload = detail.crew.flatMap((member) =>
        member.kpis.map((kpi) => ({
          staffId: member.staffId,
          kpiId: kpi.id,
          rating: ratings[ratingKey(member.staffId, kpi.id)],
        }))
      );
      const commentPayload = detail.crew.map((member) => ({
        staffId: member.staffId,
        comments: comments[member.staffId] ?? '',
      }));
      await threeSixtyApi.submitGive360(detail.taskId, payload, commentPayload);
      leave();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        onMenuPress={() => setSidebarOpen(true)}
        onProfilePress={() => router.push('/(tabs)/profile')}
      />

      <SmoothScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <Pressable
            style={styles.backButton}
            onPress={leave}
          >
            <View style={styles.backIconBox}>
              <Ionicons name="chevron-back" size={18} color="#6B7280" />
            </View>
            <Text style={styles.backText}>Go Back</Text>
          </Pressable>

          <Text style={styles.title}>Provide 360 Feedback</Text>

          {isLoading && <ActivityIndicator style={styles.loading} color="#2C5271" />}
          {loadError && <Text style={styles.errorText}>{loadError}</Text>}

          {detail && (
            <>
              <View style={styles.summaryCard}>
                <Pressable
                  style={styles.summaryHeader}
                  onPress={() => setSummaryExpanded((prev) => !prev)}
                >
                  <Text style={styles.summaryTitle}>{detail.code}</Text>
                  <Ionicons
                    name={summaryExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#6B7280"
                  />
                </Pressable>

                {summaryExpanded && (
                  <>
                    <Text style={[styles.summaryMetaText, styles.summaryTaskId]}>
                      Task ID: {detail.taskId}
                    </Text>
                    <View style={styles.summaryMetaRow}>
                      <View style={styles.summaryMetaCol}>
                        <Text style={styles.summaryMetaText}>
                          Date: {formatDate(detail.dated)}
                        </Text>
                      </View>
                      <View style={styles.summaryMetaCol}>
                        <Text style={styles.summaryMetaText}>
                          Route: {detail.route || '—'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>
                        {detail.status}.
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {detail.crew.map((member) => {
                const expanded = isExpanded(member.staffId);
                const memberRated = member.kpis.filter(
                  (k) => ratings[ratingKey(member.staffId, k.id)] !== undefined
                ).length;

                return (
                  <View key={member.staffId} style={styles.crewCard}>
                    <Pressable
                      style={styles.crewHeader}
                      onPress={() => toggleCrew(member.staffId)}
                    >
                      <Text style={styles.crewName}>
                        {member.name} - {member.grade}
                      </Text>
                      {member.kpis.length > 0 && (
                        <Text
                          style={[
                            styles.progressText,
                            memberRated === member.kpis.length && styles.progressTextDone,
                          ]}
                        >
                          {memberRated}/{member.kpis.length}
                        </Text>
                      )}
                      <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color="#6B7280"
                      />
                    </Pressable>

                    {expanded && (
                      <View style={styles.crewBody}>
                        {member.kpis.length === 0 && (
                          <Text style={styles.mutedText}>
                            No KPIs are set up for grade {member.grade || '—'}.
                          </Text>
                        )}
                        {member.kpis.map((kpi) => {
                          const value = ratings[ratingKey(member.staffId, kpi.id)];
                          return (
                            <View
                              key={`${member.staffId}-kpi-${kpi.id}`}
                              style={styles.kpiRow}
                            >
                              <Text style={styles.kpiLabel}>{kpi.name}</Text>
                              <StarRating
                                value={value ?? 0}
                                options={scaleOptions}
                                editable={!isSubmitted && !isSubmitting}
                                onChange={(rating) =>
                                  updateRating(member.staffId, kpi.id, rating)
                                }
                              />
                            </View>
                          );
                        })}

                        <Text style={styles.commentsLabel}>Comments:</Text>
                        {isSubmitted ? (
                          <Text style={styles.commentsText}>
                            {comments[member.staffId] || 'N/A'}
                          </Text>
                        ) : (
                          <TextInput
                            style={styles.commentsInput}
                            multiline
                            textAlignVertical="top"
                            maxLength={2000}
                            editable={!isSubmitting}
                            value={comments[member.staffId] ?? ''}
                            onChangeText={(text) =>
                              setComments((prev) => ({ ...prev, [member.staffId]: text }))
                            }
                            placeholder="Type your comments (optional)"
                            placeholderTextColor="#9CA3AF"
                          />
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              {!isSubmitted && (
                <>
                  <Text style={styles.progressSummary}>
                    {ratedKpis} of {totalKpis} KPIs rated
                    {canSubmit ? '' : ' - rate every KPI for every crew member to submit'}
                  </Text>
                  {submitError && <Text style={styles.errorText}>{submitError}</Text>}
                  <Pressable
                    style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                    disabled={!canSubmit}
                    onPress={() => setConfirmVisible(true)}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canSubmit }}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitButtonText}>Submit</Text>
                    )}
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>
      </SmoothScrollView>

      <ConfirmModal
        visible={confirmVisible}
        title="Are you sure you want to submit the feedback? It cannot be changed afterwards."
        confirmLabel="Yes, Submit"
        cancelLabel="No, Cancel"
        onConfirm={confirmSubmit}
        onCancel={() => setConfirmVisible(false)}
      />

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItemId="1.7"
        onItemPress={handleSidebarItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
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
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  summaryMetaRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  summaryMetaCol: {
    flex: 1,
  },
  summaryTaskId: {
    marginBottom: 8,
  },
  summaryMetaText: {
    fontSize: 14,
    color: '#4B5563',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FDE047',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    textTransform: 'capitalize',
  },
  crewCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  crewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  crewName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  crewBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  kpiLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    paddingRight: 12,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentsLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 8,
  },
  commentsInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 80,
  },
  commentsText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  loading: {
    marginVertical: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#B91C1C',
    marginBottom: 12,
  },
  mutedText: {
    fontSize: 14,
    color: '#6B7280',
  },
  progressText: {
    fontSize: 13,
    color: '#B45309',
    marginRight: 12,
  },
  progressTextDone: {
    color: '#5B8C3E',
  },
  progressSummary: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 4,
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#5B8C3E',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
