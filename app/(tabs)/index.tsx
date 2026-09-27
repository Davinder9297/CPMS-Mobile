import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '@/components/AppHeader';
import Sidebar from '@/components/Sidebar';
import { useAppSelector } from '@/hooks';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import { NAV_SECTIONS, type NavItem } from '@/constants/navigation';

const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(
  (section) => section.items
);

export default function DashboardScreen() {
  const router = useRouter();
  const { staffSession } = useAppSelector((state) => state.auth);
  const { handleSidebarItem } = useSidebarNavigation();
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ALL_NAV_ITEMS.filter((item) =>
      item.label.toLowerCase().includes(q)
    );
  }, [query]);

  const handleResultPress = (item: NavItem) => {
    setQuery('');
    handleSidebarItem(item);
  };

  return (
    <View style={styles.container}>
      <AppHeader
        onMenuPress={() => setSidebarOpen(true)}
        onProfilePress={() => router.push('/(tabs)/profile')}
      />

      <View style={styles.content}>
        <Text style={styles.title}>
          1. Crew Self Service Dashboard
        </Text>

        <View style={styles.searchWrapper}>
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

          {query.trim().length > 0 && (
            <View style={styles.resultsContainer}>
              {searchResults.length > 0 ? (
                searchResults.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.resultItem}
                    onPress={() => handleResultPress(item)}
                  >
                    <Ionicons name="arrow-forward" size={16} color="#6B7280" />
                    <Text style={styles.resultLabel}>{item.label}</Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.noResultsText}>No matching section found</Text>
              )}
            </View>
          )}
        </View>

        {staffSession && (
          <View style={styles.staffCard}>
            <Text style={styles.staffLabel}>Logged in as</Text>
            <Text style={styles.staffName}>
              {staffSession.fullName}
            </Text>
            <Text style={styles.staffMeta}>{staffSession.staffId}</Text>
          </View>
        )}
      </View>

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItemId="1.1"
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  searchWrapper: {
    position: 'relative',
    zIndex: 10,
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
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#374151',
  },
  resultsContainer: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  resultLabel: {
    fontSize: 15,
    color: '#111827',
  },
  noResultsText: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#9CA3AF',
  },
  staffCard: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
  },
  staffLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  staffMeta: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
});
