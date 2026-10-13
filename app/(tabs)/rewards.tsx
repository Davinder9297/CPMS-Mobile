import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '@/components/AppHeader';
import PullToRefreshControl from '@/components/PullToRefreshControl';
import SmoothScrollView from '@/components/SmoothScrollView';
import Sidebar from '@/components/Sidebar';
import { useAppSelector, usePullToRefresh } from '@/hooks';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import * as rewardsApi from '@/services/crew/rewardsApi';
import type { CrewReward } from '@/services/crew/rewardsApi';
import { BORDER_COLOR, BORDER_WIDTH } from '@/constants/Borders';

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

// The year filter groups rewards by their award year.
function rewardYear(reward: CrewReward): string {
  if (reward.date) {
    const d = new Date(reward.date);
    if (!Number.isNaN(d.getTime())) return String(d.getFullYear());
  }
  return 'Unknown';
}

export default function RewardsScreen() {
  const router = useRouter();
  const { staffSession } = useAppSelector((state) => state.auth);
  const { handleSidebarItem } = useSidebarNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('');
  const [yearOpen, setYearOpen] = useState(false);

  const [rewards, setRewards] = useState<CrewReward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const staffLabel = staffSession
    ? `${staffSession.staffId} | ${staffSession.fullName}`
    : 'Rewards';

  const loadRewards = useCallback(async () => {
    try {
      const data = await rewardsApi.getMyRewards();
      setRewards(data);
      setLoadError(null);
    } catch (err) {
      console.error('[getMyRewards]', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load rewards');
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      await loadRewards();
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadRewards]);

  const { refreshing, onRefresh } = usePullToRefresh(loadRewards);

  // Real (numeric) years newest-first; the "Unknown" bucket (rewards with no
  // date) always sorts last so it never becomes the default selection.
  const years = useMemo(() => {
    const unique = Array.from(new Set(rewards.map(rewardYear)));
    const numeric = unique
      .filter((y) => y !== 'Unknown')
      .sort((a, b) => Number(b) - Number(a));
    return unique.includes('Unknown') ? [...numeric, 'Unknown'] : numeric;
  }, [rewards]);

  useEffect(() => {
    if (years.length && !years.includes(year)) {
      setYear(years[0]);
    }
  }, [years, year]);

  const filteredRewards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rewards.filter((reward) => {
      const matchesYear = !year || rewardYear(reward) === year;
      const matchesQuery =
        !q ||
        reward.code.toLowerCase().includes(q) ||
        reward.type.toLowerCase().includes(q) ||
        formatDate(reward.date).includes(q);
      return matchesYear && matchesQuery;
    });
  }, [rewards, query, year]);

  const handleDownload = async (reward: CrewReward) => {
    if (!reward.letterFileName) return;
    try {
      await rewardsApi.downloadRewardLetter(reward.letterFileName);
    } catch (err) {
      Alert.alert(
        'Download failed',
        err instanceof Error ? err.message : 'Could not download the letter.'
      );
    }
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
        <View style={styles.headerSection}>
          <Text style={styles.title}>1.5 Crew Self Service - Rewards</Text>

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
        </View>

        <View style={styles.content}>
          <View style={styles.yearWrapper}>
            <Pressable
              style={styles.yearButton}
              onPress={() => setYearOpen((prev) => !prev)}
            >
              <Text style={styles.yearText}>{year || '—'}</Text>
              <Ionicons name="chevron-down" size={14} color="#4B5563" />
            </Pressable>
            {yearOpen && years.length > 0 && (
              <View style={styles.yearMenu}>
                {years.map((y) => (
                  <Pressable
                    key={y}
                    style={({ pressed }) => [styles.yearItem, pressed && styles.yearItemPressed]}
                    onPress={() => {
                      setYear(y);
                      setYearOpen(false);
                    }}
                  >
                    <Text style={styles.yearItemText}>{y}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <Text style={styles.staffTitle}>{staffLabel} - Rewards</Text>

          {isLoading ? (
            <ActivityIndicator style={styles.loadingIndicator} color="#005C70" />
          ) : loadError ? (
            <Text style={styles.errorText}>{loadError}</Text>
          ) : (
            <>
              {filteredRewards.map((reward) => (
                <View key={reward.id} style={styles.rewardCard}>
                  <Text style={styles.rewardCode}>{reward.code || '—'}</Text>

                  <View style={styles.rewardDetails}>
                    <View style={styles.rewardField}>
                      <Text style={styles.fieldLabel}>Type:</Text>
                      <Text style={styles.fieldValue}>{reward.type || '—'}</Text>
                    </View>
                    <View style={styles.rewardField}>
                      <Text style={styles.fieldLabel}>Date:</Text>
                      <Text style={styles.fieldValue}>{formatDate(reward.date)}</Text>
                    </View>
                    <View style={styles.rewardField}>
                      <Text style={styles.fieldLabel}>Points:</Text>
                      <Text style={styles.fieldValue}>
                        {reward.points != null ? String(reward.points) : '—'}
                      </Text>
                    </View>
                  </View>

                  {reward.letterFileName ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.downloadButton,
                        pressed && styles.downloadButtonPressed,
                      ]}
                      onPress={() => handleDownload(reward)}
                    >
                      <Ionicons name="download-outline" size={18} color="#374151" />
                      <Text style={styles.downloadText}>Download Letter</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.noLetterText}>No letter attached</Text>
                  )}
                </View>
              ))}

              {filteredRewards.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="trophy-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No rewards found</Text>
                </View>
              )}
            </>
          )}
        </View>
      </SmoothScrollView>

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItemId="1.6"
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
  headerSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
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
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#374151',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  yearWrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: 16,
    zIndex: 10,
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
    top: 44,
    left: 0,
    minWidth: 100,
    backgroundColor: '#fff',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 20,
  },
  yearItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
  },
  yearItemPressed: {
    backgroundColor: '#F9FAFB',
  },
  yearItemText: {
    fontSize: 14,
    color: '#1F2937',
  },
  staffTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#005C70',
    marginBottom: 16,
  },
  loadingIndicator: {
    marginTop: 24,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  rewardCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  rewardCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  rewardDetails: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  rewardField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: '#1F2937',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  downloadButtonPressed: {
    backgroundColor: '#F9FAFB',
  },
  downloadText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  noLetterText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 16,
  },
});
