import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
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
import RichTextView from '@/components/RichTextView';
import { usePullToRefresh } from '@/hooks';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import * as disciplinaryApi from '@/services/crew/disciplinaryApi';
import type {
  CrewDisciplinaryDetail,
  DisciplinaryAttachment,
} from '@/services/crew/disciplinaryApi';
import { BORDER_COLOR, BORDER_WIDTH } from '@/constants/Borders';

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
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

function AttachmentRow({ attachment }: { attachment: DisciplinaryAttachment }) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await disciplinaryApi.downloadDisciplinaryFile(attachment);
      setDownloaded(true);
    } catch (err) {
      console.error('[downloadDisciplinaryFile]', err);
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
          <Ionicons
            name={downloaded ? 'checkmark-circle' : 'download-outline'}
            size={16}
            color={downloaded ? '#16A34A' : '#374151'}
          />
        )}
        <Text style={styles.attachmentChipText} numberOfLines={1}>
          {attachment.originalName || attachment.fileName}
        </Text>
      </Pressable>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

export default function DisciplinaryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { handleSidebarItem } = useSidebarNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [detail, setDetail] = useState<CrewDisciplinaryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      return;
    }
    try {
      const data = await disciplinaryApi.getMyDisciplinaryDetail(id);
      setDetail(data);
      setNotFound(false);
    } catch (err) {
      console.error('[getMyDisciplinaryDetail]', err);
      setNotFound(true);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      await loadDetail();
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadDetail]);

  const { refreshing, onRefresh } = usePullToRefresh(loadDetail);

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <AppHeader onMenuPress={() => setSidebarOpen(true)} onProfilePress={() => router.push('/(tabs)/profile')} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#005C70" />
        </View>
        <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} activeItemId="1.5" onItemPress={handleSidebarItem} />
      </View>
    );
  }

  if (!detail || notFound) {
    return (
      <View style={styles.screen}>
        <AppHeader onMenuPress={() => setSidebarOpen(true)} onProfilePress={() => router.push('/(tabs)/profile')} />
        <ErrorState
          fullScreen
          title="Record not found"
          message="This disciplinary record could not be loaded."
          onRetry={() => router.back()}
          retryLabel="Go Back"
        />
        <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} activeItemId="1.5" onItemPress={handleSidebarItem} />
      </View>
    );
  }

  const statusLabel = detail.status === 'closed' ? 'Closed' : 'Open';
  const isStatusOpen = detail.status === 'open';
  const hasFlight = !!(detail.flightNumber || detail.flightRoute || detail.flightDate);

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

          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {detail.code}
              {detail.title ? ` - ${detail.title}` : ''}
            </Text>
            <View style={[styles.statusBadge, isStatusOpen ? styles.statusBadgeOpen : styles.statusBadgeClosed]}>
              <View style={[styles.statusDot, { backgroundColor: isStatusOpen ? '#DC2626' : '#16A34A' }]} />
              <Text style={[styles.statusText, isStatusOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.subtitle}>Incident Date: {formatDate(detail.openDate)}</Text>

          {/* Incident Details */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsHeading}>Incident Details</Text>

            <View style={styles.opsRow}>
              <DetailField label="Location" value={detail.incidentLocation || '—'} style={styles.fieldFlex} />
              <View style={styles.opsCodeCol}>
                <Text style={styles.fieldLabel}>Ops Code</Text>
                <View style={styles.opsCodeBox}>
                  <Text style={styles.opsCodeText}>{detail.code || '—'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.fieldRow}>
              <DetailField label="Reported By" value={detail.incidentReportedBy || '—'} style={styles.fieldFlex} />
              <DetailField label="Date & Time" value={formatDate(detail.openDate)} style={styles.fieldFlex} />
            </View>

            <DetailField
              label="Incident Summary"
              value={detail.description || '—'}
              multiline
              richText
              style={styles.fieldSpacing}
            />

            {detail.attachments.length > 0 && (
              <View style={styles.attachmentSection}>
                <Text style={styles.fieldLabel}>Attachments</Text>
                <View style={styles.attachmentList}>
                  {detail.attachments.map((a) => (
                    <AttachmentRow key={a.fileName} attachment={a} />
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Flight Details */}
          {hasFlight && (
            <View style={styles.detailsCard}>
              <Text style={styles.detailsHeading}>Flight Details</Text>
              <View style={styles.fieldRow}>
                <DetailField label="Flight" value={detail.flightNumber || '—'} style={styles.fieldFlex} />
                <DetailField label="Org - Dst" value={detail.flightRoute || '—'} style={styles.fieldFlex} />
              </View>
              <DetailField label="Flight Date" value={formatDate(detail.flightDate)} />
            </View>
          )}

          {/* Workflow */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsHeading}>Workflow</Text>
            <View style={styles.fieldRow}>
              <DetailField label="Workflow Owner" value={detail.ownerName || '—'} style={styles.fieldFlex} />
              <DetailField
                label="Appraisal Year"
                value={detail.appraisalYear != null ? String(detail.appraisalYear) : '—'}
                style={styles.fieldFlex}
              />
            </View>
            <DetailField label="Points" value={detail.points != null ? String(detail.points) : '—'} />
          </View>

          {/* Reported Crew */}
          {detail.crewInvolved.length > 0 && (
            <View style={styles.detailsCard}>
              <Text style={styles.detailsHeading}>Reported Crew</Text>
              <View style={styles.crewHeaderRow}>
                <Text style={[styles.crewHeaderCell, styles.crewColId]}>Staff ID</Text>
                <Text style={[styles.crewHeaderCell, styles.crewColName]}>Name</Text>
                <Text style={[styles.crewHeaderCell, styles.crewColGrade]}>Grade</Text>
              </View>
              {detail.crewInvolved.map((c) => (
                <View key={c.staffId} style={styles.crewRow}>
                  <Text style={[styles.crewCell, styles.crewColId]}>{c.staffId}</Text>
                  <Text style={[styles.crewCell, styles.crewColName]}>{c.name || '—'}</Text>
                  <Text style={[styles.crewCell, styles.crewColGrade]}>{c.grade || '—'}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Outcome */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsHeading}>Outcome</Text>
            {detail.outcomes.length === 0 ? (
              <View style={styles.outcomeBox}>
                <Text style={styles.outcomePending}>To be decided</Text>
              </View>
            ) : (
              detail.outcomes.map((o) => {
                const closed = (o.status || '').toUpperCase() === 'CLOSED';
                return (
                  <View key={o.seq} style={styles.outcomeCard}>
                    <View style={styles.outcomeTopRow}>
                      <Text style={styles.outcomeName}>{o.name || '—'}</Text>
                      <View style={[styles.statusBadge, closed ? styles.statusBadgeClosed : styles.statusBadgeOpen]}>
                        <View style={[styles.statusDot, { backgroundColor: closed ? '#16A34A' : '#DC2626' }]} />
                        <Text style={[styles.statusText, closed ? styles.statusTextClosed : styles.statusTextOpen]}>
                          {closed ? 'Closed' : 'Open'}
                        </Text>
                      </View>
                    </View>
                    {!!o.finalPoints && <Text style={styles.outcomeMeta}>Points: {o.finalPoints}</Text>}
                    {!!o.decisionNotes && <Text style={styles.outcomeNotes}>{o.decisionNotes}</Text>}
                    {closed && !!o.closedBy && (
                      <Text style={styles.outcomeMeta}>
                        Closed by {o.closedBy}
                        {o.closedAt ? ` on ${formatDate(o.closedAt)}` : ''}
                      </Text>
                    )}
                    {!!o.reopenReason && <Text style={styles.outcomeMeta}>Reopen reason: {o.reopenReason}</Text>}
                  </View>
                );
              })
            )}
          </View>
        </View>
      </SmoothScrollView>

      <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} activeItemId="1.5" onItemPress={handleSidebarItem} />
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    padding: 16,
    marginBottom: 16,
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
  opsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  opsCodeCol: {
    width: 96,
  },
  opsCodeBox: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opsCodeText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
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
  crewHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#2C5271',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  crewHeaderCell: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  crewRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: BORDER_WIDTH,
    borderRightWidth: BORDER_WIDTH,
    borderBottomWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
  },
  crewCell: {
    fontSize: 14,
    color: '#374151',
  },
  crewColId: {
    width: 90,
  },
  crewColName: {
    flex: 1,
  },
  crewColGrade: {
    width: 70,
  },
  outcomeBox: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingVertical: 20,
    alignItems: 'center',
  },
  outcomePending: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  outcomeCard: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
  },
  outcomeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outcomeName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    paddingRight: 8,
  },
  outcomeMeta: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 6,
  },
  outcomeNotes: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginTop: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusBadgeOpen: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeClosed: {
    backgroundColor: '#DCFCE7',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextOpen: {
    color: '#DC2626',
  },
  statusTextClosed: {
    color: '#15803D',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginTop: 8,
  },
});
