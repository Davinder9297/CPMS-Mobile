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
import TaskCard from '@/components/TaskCard';
import { usePullToRefresh } from '@/hooks';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import { TASK_SECTIONS, type Task, type TaskSection } from '@/constants/tasks';
import * as performanceApi from '@/services/performance/performanceApi';
import {
  mapTaskToDisplay,
  parseTaskId,
  THREE_SIXTY_TASK_TYPE_ID,
} from '@/services/performance/taskMapping';

type TaskFilter = 'all' | TaskSection;

const TASK_FILTERS: { key: TaskFilter; label: string }[] = [
  { key: 'all', label: 'Showing All' },
  { key: 'delayed', label: 'Delayed Task' },
  { key: 'current', label: 'Current Task' },
  { key: 'future', label: 'Future Task' },
  { key: 'closed', label: 'Closed Task' },
];

export default function MyTasksScreen() {
  const router = useRouter();
  const { handleSidebarItem } = useSidebarNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<TaskFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<TaskSection, boolean>>({
    current: false,
    delayed: false,
    closed: false,
    future: false,
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      const data = await performanceApi.getMyTasks();
      setTasks(data.map(mapTaskToDisplay));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      await loadTasks();
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadTasks]);

  const { refreshing, onRefresh } = usePullToRefresh(loadTasks);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesFilter =
        selectedFilter === 'all' || task.section === selectedFilter;
      const matchesQuery =
        !q ||
        task.title.toLowerCase().includes(q) ||
        task.workflowType.toLowerCase().includes(q);

      return matchesFilter && matchesQuery;
    });
  }, [query, selectedFilter, tasks]);

  const selectedFilterLabel =
    TASK_FILTERS.find((filter) => filter.key === selectedFilter)?.label ??
    'Showing All';

  const toggleSection = (key: TaskSection) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const navigateToTask = (id: string) => {
    const key = parseTaskId(id);
    if (!key) return;
    // 360 feedback tasks go straight to the screen where the feedback is given.
    if (key.taskTypeId === THREE_SIXTY_TASK_TYPE_ID) {
      router.push({
        pathname: '/(tabs)/feedback-360-provide',
        params: { id: key.taskId, from: 'my-tasks' },
      });
      return;
    }
    router.push({
      pathname: '/(tabs)/task-detail',
      params: { taskId: key.taskId, taskTypeId: key.taskTypeId, taskOwnerUserId: key.taskOwnerUserId },
    });
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
          <Text style={styles.title}>
            1.1 Crew Self Service - My Tasks
          </Text>

          {isLoading && <ActivityIndicator style={styles.loadingIndicator} color="#2C5271" />}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {!isLoading && !error && tasks.length === 0 && (
            <Text style={styles.emptyText}>No tasks assigned to you right now</Text>
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

          <View style={styles.filterContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.filterButton,
                pressed && styles.filterButtonPressed,
              ]}
              onPress={() => setFilterOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={`Task filter: ${selectedFilterLabel}`}
              accessibilityState={{ expanded: filterOpen }}
            >
              <Text style={styles.filterText}>{selectedFilterLabel}</Text>
              <Ionicons
                name={filterOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#4B5563"
              />
            </Pressable>

            {filterOpen && (
              <View style={styles.filterMenu}>
                {TASK_FILTERS.map((filter) => {
                  const isSelected = selectedFilter === filter.key;
                  return (
                    <Pressable
                      key={filter.key}
                      style={({ pressed }) => [
                        styles.filterOption,
                        isSelected && styles.filterOptionSelected,
                        pressed && styles.filterOptionPressed,
                      ]}
                      onPress={() => {
                        setSelectedFilter(filter.key);
                        setFilterOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          isSelected && styles.filterOptionTextSelected,
                        ]}
                      >
                        {filter.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={17} color="#5B8C3E" />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {TASK_SECTIONS.map((section) => {
            const sectionTasks = filteredTasks.filter(
              (task) => task.section === section.key
            );
            if (sectionTasks.length === 0) return null;

            const isExpanded = expanded[section.key];
            const hasMoreTasks = sectionTasks.length > 2;
            const visibleTasks = isExpanded
              ? sectionTasks
              : sectionTasks.slice(0, 2);
            const sectionDate = sectionTasks[0]?.sectionDate;

            return (
              <View key={section.key} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {section.title} ({sectionTasks.length})
                  </Text>
                </View>
                {sectionDate && (
                  <Text style={styles.sectionDate}>
                    {sectionDate}
                  </Text>
                )}

                {visibleTasks.map((task, index) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      taskNumber={index + 1}
                      onPress={() => navigateToTask(task.id)}
                      onAcknowledge={() => navigateToTask(task.id)}
                    />
                  ))}
                {hasMoreTasks && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.sectionToggle,
                      pressed && styles.sectionTogglePressed,
                    ]}
                    onPress={() => toggleSection(section.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${section.title}`}
                    accessibilityState={{ expanded: isExpanded }}
                  >
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={22}
                      color="#2C5271"
                    />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </SmoothScrollView>

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
    marginBottom: 16,
  },
  loadingIndicator: {
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    marginBottom: 16,
  },
  emptyText: {
    color: '#6B7280',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#374151',
  },
  filterContainer: {
    alignSelf: 'flex-start',
    marginBottom: 20,
    zIndex: 20,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  filterButtonPressed: {
    backgroundColor: '#F9FAFB',
  },
  filterText: {
    fontSize: 14,
    color: '#374151',
    marginRight: 10,
  },
  filterMenu: {
    position: 'absolute',
    top: 42,
    left: 0,
    minWidth: 190,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  filterOption: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterOptionSelected: {
    backgroundColor: '#F0FDF4',
  },
  filterOptionPressed: {
    backgroundColor: '#F3F4F6',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  filterOptionTextSelected: {
    color: '#5B8C3E',
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C5271',
  },
  sectionDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  sectionToggle: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 32,
    borderRadius: 16,
  },
  sectionTogglePressed: {
    backgroundColor: '#E5E7EB',
  },
});
