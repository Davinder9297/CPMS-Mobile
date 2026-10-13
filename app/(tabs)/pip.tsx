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

import AppHeader from '@/components/AppHeader';
import PullToRefreshControl from '@/components/PullToRefreshControl';
import SmoothScrollView from '@/components/SmoothScrollView';
import Sidebar from '@/components/Sidebar';
import { usePullToRefresh } from '@/hooks';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import * as pipApi from '@/services/crew/pipApi';
import type { CrewPip } from '@/services/crew/pipApi';
import { BORDER_COLOR, BORDER_WIDTH } from '@/constants/Borders';

type PipStatusFilter = 'open' | 'closed';

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function isPipClosed(pip: CrewPip): boolean {
  return (pip.PIPStatus || '').toLowerCase() === 'closed';
}

export default function PipListScreen() {
  const router = useRouter();
  const { handleSidebarItem } = useSidebarNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PipStatusFilter>('open');

  const [pips, setPips] = useState<CrewPip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPips = useCallback(async () => {
    try {
      const data = await pipApi.getMyPips();
      setPips(data);
      setLoadError(null);
    } catch (err) {
      console.error('[getMyPips]', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load PIPs');
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      await loadPips();
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadPips]);

  const { refreshing, onRefresh } = usePullToRefresh(loadPips);

  const filteredPips = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pips.filter((pip) => {
      const closed = isPipClosed(pip);
      const matchesStatus = statusFilter === 'closed' ? closed : !closed;
      const matchesQuery =
        !q ||
        (pip.PIP_TYPENAME ?? '').toLowerCase().includes(q) ||
        (pip.PIP_id ?? '').toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [pips, query, statusFilter]);

  return (
    <View style={styles.screen}>
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
          <Text style={styles.heading}>1.4 Crew Self Service - PIP</Text>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <View style={styles.statusFilterRow}>
            {(['open', 'closed'] as PipStatusFilter[]).map((status) => {
              const selected = statusFilter === status;
              return (
                <Pressable
                  key={status}
                  style={styles.statusOption}
                  onPress={() => setStatusFilter(status)}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      selected ? styles.radioOuterSelected : styles.radioOuterDefault,
                    ]}
                  >
                    {selected && <View style={styles.radioInner} />}
                  </View>
                  <Text
                    style={[
                      styles.statusLabel,
                      selected ? styles.statusLabelSelected : styles.statusLabelDefault,
                    ]}
                  >
                    {status}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.listTitle}>
            List of {statusFilter === 'open' ? 'Open' : 'Closed'} PIP&apos;s
          </Text>

          {isLoading ? (
            <ActivityIndicator style={styles.loadingIndicator} color="#2C5271" />
          ) : loadError ? (
            <Text style={styles.errorText}>{loadError}</Text>
          ) : (
            <>
              {filteredPips.map((pip) => (
                <Pressable
                  key={pip.PIP_id}
                  style={({ pressed }) => [styles.pipCard, pressed && styles.pipCardPressed]}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/pip-detail',
                      params: { id: pip.PIP_id },
                    })
                  }
                >
                  <View style={styles.pipCardContent}>
                    <Text style={styles.pipCode}>{pip.PIP_TYPENAME || pip.PIP_id}</Text>
                    <Text style={styles.pipDate}>Next Action Date: {formatDate(pip.TargetDate)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </Pressable>
              ))}

              {filteredPips.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="document-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyStateText}>No PIPs found</Text>
                </View>
              )}
            </>
          )}
        </View>
      </SmoothScrollView>

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItemId="1.4"
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
    paddingTop: 20,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
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
  statusFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: 16,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  radioOuterSelected: {
    borderColor: '#2563EB',
  },
  radioOuterDefault: {
    borderColor: BORDER_COLOR,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  statusLabel: {
    fontSize: 16,
    textTransform: 'capitalize',
  },
  statusLabelSelected: {
    color: '#111827',
    fontWeight: '500',
  },
  statusLabelDefault: {
    color: '#4B5563',
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C5271',
    marginBottom: 16,
  },
  loadingIndicator: {
    marginTop: 24,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  pipCard: {
    backgroundColor: '#fff',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pipCardPressed: {
    backgroundColor: '#F9FAFB',
  },
  pipCardContent: {
    flex: 1,
  },
  pipCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  pipDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 16,
  },
});
