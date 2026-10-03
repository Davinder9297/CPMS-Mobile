import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '@/components/AppHeader';
import PullToRefreshControl from '@/components/PullToRefreshControl';
import SmoothScrollView from '@/components/SmoothScrollView';
import Sidebar from '@/components/Sidebar';
import TrendChart from '@/components/TrendChart';
import { usePullToRefresh } from '@/hooks';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import type { GiveFeedbackStatus } from '@/constants/feedback360';
import * as threeSixtyApi from '@/services/crew/threeSixtyApi';
import type {
  Give360Task,
  MyThreeSixty,
  ThreeSixtyFlight,
  ThreeSixtyFlightCategory,
  ThreeSixtyTrendCategory,
} from '@/services/crew/threeSixtyApi';

type Mode = 'view' | 'give';
type SubView = 'flight' | 'trend';
// 'all' or a KPI_ID.
type GraphFilter = string;

// Both the overall roll-up and each trend category expose these numeric fields.
type RatingBoxData = Omit<ThreeSixtyTrendCategory, 'id' | 'title'>;

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function FlightCategoryCard({
  category,
  expanded,
  onToggle,
}: {
  category: ThreeSixtyFlightCategory;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.categoryCard}>
      <Pressable
        style={({ pressed }) => [
          styles.categoryHeader,
          pressed && styles.categoryHeaderPressed,
        ]}
        onPress={onToggle}
      >
        <Text style={styles.categoryTitle}>{category.title}</Text>
        <View style={styles.avgBadge}>
          <Text style={styles.avgBadgeText}>Avg: {category.avg}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#6B7280"
        />
      </Pressable>

      {expanded && (
        <View style={styles.categoryBody}>
          {category.levels.map((level) => (
            <View key={level.label} style={styles.levelRow}>
              <Text style={styles.levelLabel}>{level.label}</Text>
              <View style={styles.levelCount}>
                <Text style={styles.levelCountText}>
                  {level.count ?? '-'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function RatingStatBoxes({ category }: { category: RatingBoxData }) {
  return (
    <View style={styles.ratingBoxRow}>
      <View style={styles.ratingBoxRed}>
        <View style={styles.ratingBoxHeader}>
          <Text style={styles.ratingBoxLabelRed}>Your Avg{'\n'}Rating</Text>
          <Text style={styles.ratingBoxValueRed}>
            {category.yourAvg?.toFixed(1)}
          </Text>
        </View>
        <View style={styles.ratingBoxDividerRed} />
        <Text style={styles.ratingBoxMeta}>
          Total Flights: {category.totalFlights}
        </Text>
        <Text style={styles.ratingBoxMeta}>
          Total Votes: {category.yourVotes}
        </Text>
      </View>

      <View style={styles.ratingBoxGreen}>
        <View style={styles.ratingBoxHeader}>
          <Text style={styles.ratingBoxLabelGreen}>
            OV Avg{'\n'}Rating(CA)
          </Text>
          <Text style={styles.ratingBoxValueGreen}>
            {category.ovAvg?.toFixed(1)}
          </Text>
        </View>
        <View style={styles.ratingBoxDividerGreen} />
        <Text style={styles.ratingBoxMeta}>
          Total # Crew: {category.totalCrew}
        </Text>
        <Text style={styles.ratingBoxMeta}>
          Total Votes: {category.totalVotes}
        </Text>
      </View>
    </View>
  );
}

function TrendCategoryCard({
  category,
  expanded,
  onToggle,
}: {
  category: ThreeSixtyTrendCategory;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.categoryCard}>
      <Pressable
        style={({ pressed }) => [
          styles.categoryHeader,
          pressed && styles.categoryHeaderPressed,
        ]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={styles.categoryTitle}>{category.title}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#6B7280"
        />
      </Pressable>

      {expanded && (
        <View style={styles.trendCategoryBody}>
          <RatingStatBoxes category={category} />
        </View>
      )}
    </View>
  );
}

export default function Feedback360Screen() {
  const router = useRouter();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const { handleSidebarItem } = useSidebarNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>(
    modeParam === 'give' ? 'give' : 'view'
  );
  const [subView, setSubView] = useState<SubView>('flight');
  const [flightIndex, setFlightIndex] = useState(0);
  const [flightDropdownOpen, setFlightDropdownOpen] = useState(false);
  const [period] = useState('Last 30d');
  const [graphFilter, setGraphFilter] = useState<GraphFilter>('all');
  const [graphFilterOpen, setGraphFilterOpen] = useState(false);
  const [giveStatus, setGiveStatus] = useState<GiveFeedbackStatus>('pending');
  const [giveYear, setGiveYear] = useState(String(new Date().getFullYear()));
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 21 }, (_, i) => String(current + 5 - i));
  }, []);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [data, setData] = useState<MyThreeSixty | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (modeParam === 'give' || modeParam === 'view') {
      setMode(modeParam);
    }
  }, [modeParam]);

  const [giveTasks, setGiveTasks] = useState<Give360Task[]>([]);

  const loadThreeSixty = useCallback(async () => {
    try {
      const [res, tasks] = await Promise.all([
        threeSixtyApi.getMyThreeSixty(),
        threeSixtyApi.getGive360Tasks(),
      ]);
      setData(res);
      setGiveTasks(tasks);
      setLoadError(null);
    } catch (err) {
      console.error('[getMyThreeSixty]', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load 360 feedback');
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      await loadThreeSixty();
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadThreeSixty]);

  // Reload whenever the screen regains focus (e.g. after saving feedback on the
  // provide screen), so the Give list reflects the new status without a manual
  // pull-to-refresh. The first focus is skipped - the mount effect above loads.
  const hasFocusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      loadThreeSixty();
    }, [loadThreeSixty])
  );

  const { refreshing, onRefresh } = usePullToRefresh(loadThreeSixty);

  const filteredFlights = useMemo<ThreeSixtyFlight[]>(() => {
    const flights = data?.flights ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return flights;
    return flights.filter(
      (flight) =>
        flight.flightCode.toLowerCase().includes(q) ||
        formatDate(flight.date).includes(q)
    );
  }, [data, query]);

  const giveFeedbackList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return giveTasks.filter((item) => {
      const matchesStatus = item.status === giveStatus;
      const matchesQuery =
        !q ||
        item.code.toLowerCase().includes(q) ||
        item.route.toLowerCase().includes(q) ||
        formatDate(item.dated).includes(q) ||
        formatDate(item.submittedOn).includes(q);
      const itemDate = item.status === 'pending' ? item.dated : item.submittedOn;
      const itemYear = itemDate ? new Date(itemDate).getFullYear() : null;
      const matchesYear =
        itemYear === null || Number.isNaN(itemYear) || String(itemYear) === giveYear;
      return matchesStatus && matchesQuery && matchesYear;
    });
  }, [query, giveStatus, giveYear, giveTasks]);

  const currentFlight =
    filteredFlights[Math.min(flightIndex, filteredFlights.length - 1)];

  const graphFilterOptions = useMemo(
    () => [
      { id: 'all', label: 'Showing All' },
      ...(data?.categories ?? []).map((c) => ({ id: c.id, label: c.title })),
    ],
    [data]
  );
  const graphFilterLabel =
    graphFilterOptions.find((option) => option.id === graphFilter)?.label ??
    'Showing All';
  const chartMonths = useMemo(
    () => (data?.trend.chart.months ?? []).map((m) => m.split(' ')[0]),
    [data]
  );

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const goPrevFlight = () => {
    setFlightIndex((prev) => Math.max(0, prev - 1));
    setFlightDropdownOpen(false);
  };

  const goNextFlight = () => {
    setFlightIndex((prev) =>
      Math.min(filteredFlights.length - 1, prev + 1)
    );
    setFlightDropdownOpen(false);
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
        refreshControl={
          mode === 'view' ? (
            <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        <View style={styles.content}>
          <Text style={styles.heading}>
            1.6 Crew Self Service - 360 Feedback
          </Text>

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

          <View style={styles.modeFilterRow}>
            {(
              [
                { id: 'view', label: 'View My 360 Rating' },
                { id: 'give', label: 'Give 360 Feedback' },
              ] as const
            ).map((option) => {
              const selected = mode === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={styles.modeOption}
                  onPress={() => setMode(option.id)}
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
                      styles.modeLabel,
                      selected ? styles.modeLabelSelected : styles.modeLabelDefault,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {mode === 'view' && (
            <>
              <View style={styles.tabRow}>
                {(
                  [
                    { id: 'flight', label: 'Flight Level' },
                    { id: 'trend', label: 'Trend' },
                  ] as const
                ).map((tab) => {
                  const isActive = subView === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      style={[
                        styles.tab,
                        isActive ? styles.tabActive : styles.tabInactive,
                      ]}
                      onPress={() => setSubView(tab.id)}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          isActive ? styles.tabTextActive : styles.tabTextInactive,
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {isLoading ? (
                <ActivityIndicator style={styles.loadingIndicator} color="#2C5271" />
              ) : loadError ? (
                <Text style={styles.errorText}>{loadError}</Text>
              ) : (data?.flights.length ?? 0) === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="star-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyStateText}>No 360 ratings found</Text>
                </View>
              ) : (
                <>
              {subView === 'flight' && currentFlight && (
                <>
                  <Text style={styles.flightSectionTitle}>
                    Select a Flight, View Votes and Ratings
                  </Text>

                  <View style={styles.flightNavRow}>
                    <Pressable
                      onPress={goPrevFlight}
                      disabled={flightIndex === 0}
                      hitSlop={8}
                      style={styles.flightNavButton}
                    >
                      <Ionicons
                        name="chevron-back"
                        size={22}
                        color={flightIndex === 0 ? '#D1D5DB' : '#4B5563'}
                      />
                    </Pressable>

                    <View style={styles.flightSelectorCol}>
                      <Pressable
                        style={styles.flightDropdownButton}
                        onPress={() =>
                          setFlightDropdownOpen((prev) => !prev)
                        }
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={16}
                          color="#6B7280"
                        />
                        <Text style={styles.flightDateText}>
                          {formatDate(currentFlight.date)}
                        </Text>
                        <Ionicons
                          name="airplane"
                          size={16}
                          color="#6B7280"
                          style={styles.flightIcon}
                        />
                        <Text style={styles.flightCodeText}>
                          {currentFlight.flightCode}
                        </Text>
                        <Ionicons
                          name={
                            flightDropdownOpen ? 'chevron-up' : 'chevron-down'
                          }
                          size={16}
                          color="#6B7280"
                        />
                      </Pressable>
                    </View>

                    <Pressable
                      onPress={goNextFlight}
                      disabled={flightIndex >= filteredFlights.length - 1}
                      hitSlop={8}
                      style={styles.flightNavButtonRight}
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={22}
                        color={
                          flightIndex >= filteredFlights.length - 1
                            ? '#D1D5DB'
                            : '#4B5563'
                        }
                      />
                    </Pressable>
                  </View>

                  {flightDropdownOpen && (
                    <View style={styles.flightDropdownMenu}>
                      {filteredFlights.map((flight, index) => (
                        <Pressable
                          key={flight.id}
                          style={({ pressed }) => [
                            styles.flightDropdownItem,
                            index === flightIndex && styles.flightDropdownItemSelected,
                            pressed && styles.flightDropdownItemPressed,
                          ]}
                          onPress={() => {
                            setFlightIndex(index);
                            setFlightDropdownOpen(false);
                          }}
                        >
                          <Text style={styles.flightDropdownDate}>
                            {formatDate(flight.date)}
                          </Text>
                          <Ionicons
                            name="airplane"
                            size={14}
                            color="#6B7280"
                          />
                          <Text style={styles.flightDropdownCode}>
                            {flight.flightCode}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  <View style={styles.ratingBanner}>
                    <View style={styles.ratingBannerTextCol}>
                      <Text style={styles.ratingBannerTitle}>
                        Your Avg Rating for this flight
                      </Text>
                      <Text style={styles.ratingBannerSubtitle}>
                        Total Votes: {currentFlight.totalVotes}
                      </Text>
                    </View>
                    <Text style={styles.ratingBannerValue}>
                      {currentFlight.avgRating.toFixed(1)}
                    </Text>
                  </View>

                  <View style={styles.dividerSection}>
                    <View style={styles.dividerLine} />
                    <View style={styles.dividerLabelWrap}>
                      <Text style={styles.dividerLabel}>
                        View your votes below
                      </Text>
                    </View>
                  </View>

                  {currentFlight.categories.map((category) => (
                    <FlightCategoryCard
                      key={category.id}
                      category={category}
                      expanded={expanded[category.id] !== false}
                      onToggle={() => toggle(category.id)}
                    />
                  ))}

                  <View style={styles.flightNavButtons}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.prevButton,
                        pressed && styles.prevButtonPressed,
                      ]}
                      onPress={goPrevFlight}
                      disabled={flightIndex === 0}
                    >
                      <Text style={styles.prevButtonText}>Previous</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.nextButton,
                        pressed && styles.nextButtonPressed,
                      ]}
                      onPress={goNextFlight}
                      disabled={flightIndex >= filteredFlights.length - 1}
                    >
                      <Text style={styles.nextButtonText}>Next</Text>
                    </Pressable>
                  </View>
                </>
              )}

              {subView === 'trend' && (
                <>
                  <Text style={styles.trendSectionTitle}>Average Ratings</Text>

                  <Pressable style={styles.periodButton}>
                    <Text style={styles.periodButtonText}>{period}</Text>
                    <Ionicons name="chevron-down" size={14} color="#4B5563" />
                  </Pressable>

                  <View style={styles.overallCard}>
                    <Text style={styles.overallCardTitle}>Overall Rating</Text>
                    {data && <RatingStatBoxes category={data.trend.overall} />}
                  </View>

                  {(data?.trend.categories ?? []).map((category) => (
                    <TrendCategoryCard
                      key={category.id}
                      category={category}
                      expanded={expanded[category.id] !== false}
                      onToggle={() => toggle(category.id)}
                    />
                  ))}

                  <View style={styles.graphHeader}>
                    <Text style={styles.graphTitle}>Graph Trend</Text>
                  </View>

                  <View style={styles.graphFilterRow}>
                    <View style={styles.graphFilterDropdown}>
                      <Pressable
                        style={styles.periodButtonInline}
                        onPress={() => setGraphFilterOpen((open) => !open)}
                        accessibilityRole="button"
                        accessibilityLabel={`Graph category: ${graphFilterLabel}`}
                        accessibilityState={{ expanded: graphFilterOpen }}
                      >
                        <Text style={styles.periodButtonText}>
                          {graphFilterLabel}
                        </Text>
                        <Ionicons
                          name={graphFilterOpen ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color="#4B5563"
                        />
                      </Pressable>

                      {graphFilterOpen && (
                        <View style={styles.graphFilterMenu}>
                          {graphFilterOptions.map((option) => {
                            const isSelected = graphFilter === option.id;
                            return (
                              <Pressable
                                key={option.id}
                                style={({ pressed }) => [
                                  styles.graphFilterOption,
                                  isSelected && styles.graphFilterOptionSelected,
                                  pressed && styles.graphFilterOptionPressed,
                                ]}
                                onPress={() => {
                                  setGraphFilter(option.id);
                                  setGraphFilterOpen(false);
                                }}
                              >
                                <Text
                                  style={[
                                    styles.graphFilterOptionText,
                                    isSelected &&
                                      styles.graphFilterOptionTextSelected,
                                  ]}
                                >
                                  {option.label}
                                </Text>
                                {isSelected && (
                                  <Ionicons
                                    name="checkmark"
                                    size={16}
                                    color="#2563EB"
                                  />
                                )}
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                    <Pressable style={styles.periodButtonInline}>
                      <Text style={styles.periodButtonText}>{period}</Text>
                      <Ionicons name="chevron-down" size={14} color="#4B5563" />
                    </Pressable>
                  </View>

                  <TrendChart
                    selectedSeriesId={
                      graphFilter === 'all' ? undefined : graphFilter
                    }
                    months={chartMonths}
                    series={data?.trend.chart.series}
                  />
                </>
              )}
                </>
              )}
            </>
          )}

          {mode === 'give' && (
            <>
              <Text style={styles.giveSectionTitle}>
                Provide 360 Feedback
              </Text>

              <View style={styles.giveFilterRow}>
                <View style={styles.statusDropdownWrapper}>
                  <Pressable
                    style={styles.dropdownButton}
                    onPress={() => {
                      setStatusDropdownOpen((prev) => !prev);
                      setYearDropdownOpen(false);
                    }}
                  >
                    <Text style={styles.dropdownButtonTextFlex}>
                      {giveStatus}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#4B5563" />
                  </Pressable>
                  {statusDropdownOpen && (
                    <View style={styles.statusDropdownMenu}>
                      {(['pending', 'submitted'] as GiveFeedbackStatus[]).map(
                        (status) => (
                          <Pressable
                            key={status}
                            style={({ pressed }) => [
                              styles.dropdownItem,
                              pressed && styles.dropdownItemPressed,
                            ]}
                            onPress={() => {
                              setGiveStatus(status);
                              setStatusDropdownOpen(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>
                              {status}
                            </Text>
                          </Pressable>
                        )
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.statusDropdownWrapper}>
                  <Pressable
                    style={styles.yearButton}
                    onPress={() => {
                      setYearDropdownOpen((prev) => !prev);
                      setStatusDropdownOpen(false);
                    }}
                  >
                    <Text style={styles.yearButtonText}>{giveYear}</Text>
                    <Ionicons name="chevron-down" size={14} color="#4B5563" />
                  </Pressable>
                  {yearDropdownOpen && (
                    <View style={[styles.statusDropdownMenu, { minWidth: 90, maxHeight: 240 }]}>
                      <ScrollView nestedScrollEnabled>
                        {yearOptions.map((year) => (
                          <Pressable
                            key={year}
                            style={({ pressed }) => [
                              styles.dropdownItem,
                              pressed && styles.dropdownItemPressed,
                            ]}
                            onPress={() => {
                              setGiveYear(year);
                              setYearDropdownOpen(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>{year}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>

              {giveFeedbackList.map((item) => (
                <Pressable
                  key={item.taskId}
                  style={({ pressed }) => [
                    styles.feedbackCard,
                    pressed && styles.feedbackCardPressed,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/feedback-360-provide',
                      params: { id: item.taskId },
                    })
                  }
                >
                  <View style={styles.feedbackCardContent}>
                    <Text
                      style={[
                        styles.feedbackCode,
                        item.status === 'pending'
                          ? styles.feedbackCodePending
                          : styles.feedbackCodeDefault,
                      ]}
                    >
                      {item.code}
                    </Text>
                    <Text style={styles.feedbackMeta}>Task ID: {item.taskId}</Text>
                    <Text style={styles.feedbackMeta}>
                      {item.status === 'pending'
                        ? `Dated: ${formatDate(item.dated)}`
                        : `Submitted On: ${formatDate(item.submittedOn)}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </Pressable>
              ))}

              {giveFeedbackList.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={48}
                    color="#D1D5DB"
                  />
                  <Text style={styles.emptyStateText}>
                    No feedback items found
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </SmoothScrollView>

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
    borderWidth: 1,
    borderColor: '#D1D5DB',
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
  loadingIndicator: {
    marginTop: 24,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  modeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
    borderColor: '#9CA3AF',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  modeLabel: {
    fontSize: 14,
    flexShrink: 1,
  },
  modeLabelSelected: {
    color: '#2563EB',
    fontWeight: '500',
  },
  modeLabelDefault: {
    color: '#4B5563',
  },
  tabRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  tabInactive: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#2563EB',
  },
  tabTextInactive: {
    color: '#374151',
  },
  flightSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#005C70',
    marginBottom: 12,
  },
  flightNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  flightNavButton: {
    marginRight: 8,
  },
  flightNavButtonRight: {
    marginLeft: 8,
  },
  flightSelectorCol: {
    flex: 1,
    alignItems: 'center',
  },
  flightDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  flightDateText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#1F2937',
  },
  flightIcon: {
    marginLeft: 10,
  },
  flightCodeText: {
    marginLeft: 6,
    marginRight: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  flightDropdownMenu: {
    alignSelf: 'center',
    minWidth: 240,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  flightDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  flightDropdownItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  flightDropdownItemPressed: {
    backgroundColor: '#F9FAFB',
  },
  flightDropdownDate: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  flightDropdownCode: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  ratingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F87171',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
  },
  ratingBannerTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  ratingBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  ratingBannerSubtitle: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  ratingBannerValue: {
    fontSize: 30,
    fontWeight: '700',
    color: '#DC2626',
  },
  dividerSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#D1D5DB',
    position: 'absolute',
    top: 8,
  },
  dividerLabelWrap: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
  },
  dividerLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  categoryHeaderPressed: {
    backgroundColor: '#F9FAFB',
  },
  categoryTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    paddingRight: 8,
  },
  avgBadge: {
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  avgBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  categoryBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  levelLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  levelCount: {
    minWidth: 36,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  levelCountText: {
    fontSize: 14,
    color: '#1F2937',
  },
  trendCategoryBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  flightNavButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  prevButton: {
    flex: 1,
    borderWidth: 1,
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
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  periodButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  periodButtonText: {
    fontSize: 14,
    color: '#1F2937',
    marginRight: 4,
  },
  trendSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#005C70',
    marginBottom: 12,
  },
  overallCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    marginBottom: 12,
  },
  overallCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  ratingBoxRow: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingBoxRed: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
  },
  ratingBoxGreen: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#22C55E',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#F0FDF4',
  },
  ratingBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  ratingBoxLabelRed: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
    lineHeight: 17,
  },
  ratingBoxLabelGreen: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
    lineHeight: 17,
  },
  ratingBoxValueRed: {
    fontSize: 26,
    fontWeight: '700',
    color: '#DC2626',
  },
  ratingBoxValueGreen: {
    fontSize: 26,
    fontWeight: '700',
    color: '#16A34A',
  },
  ratingBoxDividerRed: {
    height: 1,
    backgroundColor: '#FECACA',
    marginBottom: 8,
  },
  ratingBoxDividerGreen: {
    height: 1,
    backgroundColor: '#BBF7D0',
    marginBottom: 8,
  },
  ratingBoxMeta: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 2,
  },
  graphFilterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    zIndex: 20,
  },
  graphFilterDropdown: {
    position: 'relative',
  },
  graphFilterMenu: {
    position: 'absolute',
    top: 42,
    left: 0,
    width: 210,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    zIndex: 30,
  },
  graphFilterOption: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  graphFilterOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  graphFilterOptionPressed: {
    backgroundColor: '#F3F4F6',
  },
  graphFilterOptionText: {
    flex: 1,
    paddingRight: 8,
    color: '#374151',
    fontSize: 14,
  },
  graphFilterOptionTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  graphHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  graphTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C5271',
  },
  giveSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#005C70',
    marginBottom: 12,
  },
  giveFilterRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 12,
    marginBottom: 16,
    zIndex: 10,
  },
  statusDropdownWrapper: {
    position: 'relative',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 108,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  dropdownButtonTextFlex: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    marginRight: 8,
    textTransform: 'capitalize',
  },
  statusDropdownMenu: {
    position: 'absolute',
    top: 42,
    left: 0,
    minWidth: 140,
    zIndex: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemPressed: {
    backgroundColor: '#F9FAFB',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#1F2937',
    textTransform: 'capitalize',
  },
  yearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  yearButtonText: {
    fontSize: 14,
    color: '#1F2937',
    marginRight: 4,
  },
  feedbackCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedbackCardPressed: {
    backgroundColor: '#F9FAFB',
  },
  feedbackCardContent: {
    flex: 1,
  },
  feedbackCode: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  feedbackCodePending: {
    color: '#DC2626',
  },
  feedbackCodeDefault: {
    color: '#111827',
  },
  feedbackMeta: {
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
