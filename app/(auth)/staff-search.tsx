import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import * as crewApi from '@/services/crew/crewApi';
import type { ManagedStaffMember } from '@/services/crew/crewApi';
import { BORDER_COLOR, BORDER_WIDTH } from '@/constants/Borders';

function StaffDetails({ staff }: { staff: ManagedStaffMember }) {
  return (
    <View style={styles.staffDetailsRow}>
      <View style={styles.staffDetailColumn}>
        <Text style={styles.staffDetailLabel}>Staff ID:</Text>
        <Text style={styles.staffDetailValue}>{staff.StaffId}</Text>
      </View>
      <View style={styles.staffDetailColumn}>
        <Text style={styles.staffDetailLabel}>Nationality:</Text>
        <Text style={styles.staffDetailValue}>{staff.PrimaryNationality}</Text>
      </View>
      <View style={styles.staffDetailColumn}>
        <Text style={styles.staffDetailLabel}>Grade:</Text>
        <Text style={styles.staffDetailValue}>{staff.CurrentGrade}</Text>
      </View>
    </View>
  );
}

export default function StaffSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [staffList, setStaffList] = useState<ManagedStaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const data = await crewApi.getManagedStaff();
        if (active) setStaffList(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load staff');
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const filteredStaff = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter(
      (s) =>
        s.Full_Name.toLowerCase().includes(q) || s.StaffId.toLowerCase().includes(q)
    );
  }, [query, staffList]);

  const handleSelectStaff = (staff: ManagedStaffMember) => {
    router.push({
      pathname: '/(auth)/login-behalf',
      params: {
        staffId: staff.StaffId,
        fullName: staff.Full_Name,
        nationality: staff.PrimaryNationality,
        grade: staff.CurrentGrade,
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="SalamAir"
        />
      </View>
      <View style={styles.divider} />

      <View style={styles.titleSection}>
        <Text style={styles.title}>Log In as:</Text>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by staff ID or name"
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.listSection}>
        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color="#5B8C3E" />
          </View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
            <Text style={styles.emptyStateText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            <FlatList
              data={filteredStaff}
              keyExtractor={(item) => item.StaffId}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.listItem,
                    pressed && styles.listItemPressed,
                  ]}
                  onPress={() => handleSelectStaff(item)}
                >
                  <Text style={styles.staffName}>{item.Full_Name}</Text>
                  <StaffDetails staff={item} />
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyStateText}>No staff found</Text>
                </View>
              }
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  logo: {
    width: 160,
    height: 30,
  },
  divider: {
    height: 3,
    backgroundColor: '#2563EB',
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
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
  listSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  listContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  listItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  listItemPressed: {
    backgroundColor: '#F9FAFB',
  },
  staffName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  staffDetailsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  staffDetailColumn: {
    flex: 1,
  },
  staffDetailLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  staffDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
