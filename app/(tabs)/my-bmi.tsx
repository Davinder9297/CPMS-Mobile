import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '@/components/AppHeader';
import PullToRefreshControl from '@/components/PullToRefreshControl';
import Sidebar from '@/components/Sidebar';
import SmoothScrollView from '@/components/SmoothScrollView';
import { usePullToRefresh } from '@/hooks';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import * as bmiApi from '@/services/crew/bmiApi';
import type {
  BmiAttachment,
  BmiRagStatus,
  BmiReference,
  CrewBmiView,
} from '@/services/crew/bmiApi';
import { BORDER_COLOR, BORDER_WIDTH } from '@/constants/Borders';

// Download control for a reading's attachments. Downloads every file for that
// reading in turn; shows a spinner while running and a tick when done.
function BmiAttachmentCell({ attachments }: { attachments: BmiAttachment[] }) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  if (attachments.length === 0) {
    return <Text style={styles.noAttachment}>—</Text>;
  }

  const handleDownload = async () => {
    setDownloading(true);
    try {
      for (const attachment of attachments) {
        await bmiApi.downloadBmiFile(attachment);
      }
      setDownloaded(true);
      Alert.alert(
        'Downloaded',
        attachments.length === 1
          ? `“${attachments[0].originalName}” was saved to your device${
              Platform.OS === 'android' ? ' (Download folder)' : ' (Files app)'
            }.`
          : `${attachments.length} files were saved to your device${
              Platform.OS === 'android' ? ' (Download folder)' : ' (Files app)'
            }.`
      );
    } catch (err) {
      console.error('[downloadBmiFile]', err);
      Alert.alert(
        'Download failed',
        err instanceof Error
          ? err.message
          : 'Could not download the attachment.'
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Pressable
      style={styles.attachButton}
      onPress={handleDownload}
      disabled={downloading}
      accessibilityLabel={`Download ${attachments.length} attachment${attachments.length > 1 ? 's' : ''}`}
    >
      {downloading ? (
        <ActivityIndicator size="small" color="#12677A" />
      ) : (
        <Ionicons
          name={downloaded ? 'checkmark-circle' : 'download-outline'}
          size={18}
          color={downloaded ? '#16A34A' : '#12677A'}
        />
      )}
      {attachments.length > 1 && (
        <Text style={styles.attachCount}>{attachments.length}</Text>
      )}
    </Pressable>
  );
}

// RAG status -> the label + swatch colour the screen renders (matches the web
// BMI_RAG_INDICATOR colours).
const RAG_META: Record<BmiRagStatus, { label: string; color: string }> = {
  green: { label: 'Healthy', color: '#65B33B' },
  amber: { label: 'Review', color: '#E1D71C' },
  red: { label: 'Action required', color: '#E60012' },
};

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

export default function MyBmiScreen() {
  const router = useRouter();
  const { handleSidebarItem } = useSidebarNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');

  const [view, setView] = useState<CrewBmiView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadBmi = useCallback(async () => {
    try {
      const data = await bmiApi.getMyBmi();
      setView(data);
      setLoadError(null);
    } catch (err) {
      console.error('[getMyBmi]', err);
      setLoadError(
        err instanceof Error ? err.message : 'Failed to load BMI history'
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      await loadBmi();
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadBmi]);

  const { refreshing, onRefresh } = usePullToRefresh(loadBmi);

  // Reference weight table popup (same MSTR_BMI_REFDATA table the web page
  // shows), fetched the first time it is opened.
  const [showReference, setShowReference] = useState(false);
  const [reference, setReference] = useState<BmiReference | null>(null);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  const loadReference = useCallback(async () => {
    setReferenceLoading(true);
    setReferenceError(null);
    try {
      setReference(await bmiApi.getMyBmiReference());
    } catch (err) {
      console.error('[getMyBmiReference]', err);
      setReferenceError(
        err instanceof Error ? err.message : 'Failed to load reference table'
      );
    } finally {
      setReferenceLoading(false);
    }
  }, []);

  const openReference = () => {
    setShowReference(true);
    if (!reference) loadReference();
  };

  const referenceRows = useMemo(() => {
    const rows = reference?.rows ?? [];
    return reference?.gender
      ? rows.filter((r) => r.Crew_Sex === reference.gender)
      : rows;
  }, [reference]);

  const filteredReadings = useMemo(() => {
    const readings = view?.readings ?? [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return readings;

    return readings.filter((reading) => {
      const label = RAG_META[reading.status].label.toLowerCase();
      return (
        formatDate(reading.date).includes(normalizedQuery) ||
        reading.bmi.toLowerCase().includes(normalizedQuery) ||
        (reading.heightMts ?? '').includes(normalizedQuery) ||
        (reading.weightKg ?? '').includes(normalizedQuery) ||
        label.includes(normalizedQuery)
      );
    });
  }, [view, query]);

  return (
    <View style={styles.container}>
      <AppHeader
        onMenuPress={() => setSidebarOpen(true)}
        onProfilePress={() => router.push('/(tabs)/profile')}
      />

      <SmoothScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerSection}>
          <Text style={styles.title}>1.8 My BMI</Text>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={22} color="#737373" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor="#737373"
              value={query}
              onChangeText={setQuery}
              accessibilityLabel="Search BMI history"
            />
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My BMI History</Text>
            <Pressable
              onPress={openReference}
              accessibilityRole="button"
              accessibilityLabel="Open BMI reference table"
              hitSlop={8}
            >
              <Text style={styles.referenceLink}>Reference table</Text>
            </Pressable>
          </View>

          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.headerCell, styles.dateCell]}>Date</Text>
              <Text style={[styles.headerCell, styles.heightCell]}>
                Height (m)
              </Text>
              <Text style={[styles.headerCell, styles.weightCell]}>
                Weight (kg)
              </Text>
              <Text style={[styles.headerCell, styles.bmiCell]}>BMI</Text>
              <Text style={[styles.headerCell, styles.statusCell]}>Status</Text>
              <Text style={[styles.headerCell, styles.attachmentCell]}>
                File
              </Text>
            </View>

            {isLoading ? (
              <View style={styles.emptyRow}>
                <ActivityIndicator color="#12677A" />
              </View>
            ) : loadError ? (
              <View style={styles.emptyRow}>
                <Text style={styles.errorText}>{loadError}</Text>
              </View>
            ) : (
              <>
                {filteredReadings.map((reading) => {
                  const meta = RAG_META[reading.status];
                  return (
                    <View key={reading.seq} style={styles.tableRow}>
                      <Text style={[styles.bodyCell, styles.dateCell]}>
                        {formatDate(reading.date)}
                      </Text>
                      <Text style={[styles.bodyCell, styles.heightCell]}>
                        {reading.heightMts ?? '—'}
                      </Text>
                      <Text style={[styles.bodyCell, styles.weightCell]}>
                        {reading.weightKg ?? '—'}
                      </Text>
                      <Text style={[styles.bodyCell, styles.bmiCell]}>
                        {Number(reading.bmi).toFixed(1)}
                      </Text>
                      <View
                        style={[styles.bodyCellContainer, styles.statusCell]}
                      >
                        <View
                          style={[
                            styles.statusIndicator,
                            { backgroundColor: meta.color },
                          ]}
                          accessibilityLabel={meta.label}
                        />
                      </View>
                      <View
                        style={[
                          styles.bodyCellContainer,
                          styles.attachmentCell,
                        ]}
                      >
                        <BmiAttachmentCell attachments={reading.attachments} />
                      </View>
                    </View>
                  );
                })}

                {filteredReadings.length === 0 && (
                  <View style={styles.emptyRow}>
                    <Text style={styles.emptyText}>No BMI readings found</Text>
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.targetColumn}>
              <Text style={styles.summaryLabel}>My BMI Target</Text>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {view?.targetBmi || '—'}
                </Text>
              </View>
            </View>

            <View style={styles.reviewColumn}>
              <Text style={styles.summaryLabel}>Next Review</Text>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {formatDate(view?.nextReviewDate ?? null)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </SmoothScrollView>

      <Modal
        visible={showReference}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReference(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                BMI Reference Table
                {reference?.gender
                  ? ` (${reference.gender === 'M' ? 'Male' : 'Female'})`
                  : ''}
              </Text>
              <Pressable
                onPress={() => setShowReference(false)}
                accessibilityRole="button"
                accessibilityLabel="Close reference table"
                hitSlop={10}
              >
                <Ionicons name="close" size={24} color="#737373" />
              </Pressable>
            </View>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendSwatch,
                    { backgroundColor: RAG_META.green.color },
                  ]}
                />
                <Text style={styles.legendText}>Green: Min – Max</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendSwatch,
                    { backgroundColor: RAG_META.amber.color },
                  ]}
                />
                <Text style={styles.legendText}>
                  Amber: within Lower – Upper tolerance
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendSwatch,
                    { backgroundColor: RAG_META.red.color },
                  ]}
                />
                <Text style={styles.legendText}>Red: outside tolerance</Text>
              </View>
            </View>

            <View style={[styles.refRow, styles.refHeader]}>
              {!reference?.gender && (
                <Text style={[styles.refHeaderCell, styles.refSexCell]}>
                  Sex
                </Text>
              )}
              <Text style={[styles.refHeaderCell, styles.refCell]}>
                Height (m)
              </Text>
              <Text style={[styles.refHeaderCell, styles.refCell]}>
                Lower Tol.
              </Text>
              <Text style={[styles.refHeaderCell, styles.refCell]}>Min Wt</Text>
              <Text style={[styles.refHeaderCell, styles.refCell]}>Max Wt</Text>
              <Text style={[styles.refHeaderCell, styles.refCell]}>
                Upper Tol.
              </Text>
            </View>

            {referenceLoading ? (
              <View style={styles.emptyRow}>
                <ActivityIndicator color="#12677A" />
              </View>
            ) : referenceError ? (
              <View style={styles.emptyRow}>
                <Text style={styles.errorText}>{referenceError}</Text>
                <Pressable onPress={loadReference} hitSlop={8}>
                  <Text style={styles.referenceLink}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                nestedScrollEnabled
              >
                {referenceRows.map((r) => (
                  <View key={`${r.Crew_Sex}-${r.Seq_Id}`} style={styles.refRow}>
                    {!reference?.gender && (
                      <Text style={[styles.refBodyCell, styles.refSexCell]}>
                        {r.Crew_Sex}
                      </Text>
                    )}
                    <Text style={[styles.refBodyCell, styles.refCell]}>
                      {Number(r.Height_mtrs).toFixed(2)}
                    </Text>
                    <Text
                      style={[
                        styles.refBodyCell,
                        styles.refCell,
                        styles.refAmber,
                      ]}
                    >
                      {r.Wt_lower_tolerance}
                    </Text>
                    <Text
                      style={[
                        styles.refBodyCell,
                        styles.refCell,
                        styles.refGreen,
                      ]}
                    >
                      {r.Min_wt_KG}
                    </Text>
                    <Text
                      style={[
                        styles.refBodyCell,
                        styles.refCell,
                        styles.refGreen,
                      ]}
                    >
                      {r.Max_wt_KG}
                    </Text>
                    <Text
                      style={[
                        styles.refBodyCell,
                        styles.refCell,
                        styles.refAmber,
                      ]}
                    >
                      {r.Wt_Upper_tolerance}
                    </Text>
                  </View>
                ))}
                {referenceRows.length === 0 && (
                  <View style={styles.emptyRow}>
                    <Text style={styles.emptyText}>
                      No reference data available
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItemId="1.8"
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
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  title: {
    color: '#151515',
    fontSize: 21,
    fontWeight: '600',
    marginBottom: 16,
  },
  searchContainer: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    paddingVertical: 12,
    color: '#292929',
    fontSize: 16,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#12677A',
    fontSize: 18,
    fontWeight: '700',
  },
  referenceLink: {
    color: '#2563EB',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  table: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    backgroundColor: '#FFFFFF',
  },
  tableRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
  },
  tableHeader: {
    minHeight: 40,
    backgroundColor: '#12677A',
  },
  headerCell: {
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  bodyCell: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    color: '#666666',
    fontSize: 14,
  },
  bodyCellContainer: {
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  dateCell: {
    flex: 1.25,
    borderRightWidth: BORDER_WIDTH,
    borderRightColor: BORDER_COLOR,
  },
  heightCell: {
    flex: 0.85,
    borderRightWidth: BORDER_WIDTH,
    borderRightColor: BORDER_COLOR,
  },
  weightCell: {
    flex: 0.9,
    borderRightWidth: BORDER_WIDTH,
    borderRightColor: BORDER_COLOR,
  },
  bmiCell: {
    flex: 0.65,
    borderRightWidth: BORDER_WIDTH,
    borderRightColor: BORDER_COLOR,
  },
  statusCell: {
    flex: 0.7,
    borderRightWidth: BORDER_WIDTH,
    borderRightColor: BORDER_COLOR,
  },
  attachmentCell: {
    flex: 0.55,
  },
  statusIndicator: {
    width: 20,
    height: 20,
    borderRadius: 2,
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attachCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#12677A',
  },
  noAttachment: {
    color: '#999999',
    fontSize: 15,
  },
  emptyRow: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyText: {
    color: '#737373',
    fontSize: 14,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 28,
    marginTop: 36,
  },
  targetColumn: {
    flex: 0.8,
  },
  reviewColumn: {
    flex: 1.35,
  },
  summaryLabel: {
    color: '#555555',
    fontSize: 16,
    marginBottom: 10,
  },
  summaryCard: {
    minHeight: 88,
    justifyContent: 'center',
    borderWidth: BORDER_WIDTH,
    borderColor: '#555555',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  summaryValue: {
    color: '#111111',
    fontSize: 28,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
  },
  modalTitle: {
    flex: 1,
    color: '#151515',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 12,
  },
  legend: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    color: '#555555',
    fontSize: 12,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    paddingBottom: 16,
  },
  refRow: {
    flexDirection: 'row',
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
  },
  refHeader: {
    backgroundColor: '#12677A',
    borderBottomWidth: 0,
  },
  refCell: {
    flex: 1,
  },
  refSexCell: {
    width: 44,
  },
  refHeaderCell: {
    paddingHorizontal: 8,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  refBodyCell: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    color: '#444444',
    fontSize: 14,
  },
  refGreen: {
    backgroundColor: '#DCFCE7',
  },
  refAmber: {
    backgroundColor: '#FEF3C7',
  },
});
