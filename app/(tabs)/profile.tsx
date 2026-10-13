import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';

import AppHeader from '@/components/AppHeader';
import Avatar from '@/components/Avatar';
import ConfirmModal from '@/components/ConfirmModal';
import PullToRefreshControl from '@/components/PullToRefreshControl';
import Sidebar from '@/components/Sidebar';
import SmoothScrollView from '@/components/SmoothScrollView';
import { useAppDispatch, useAppSelector, usePullToRefresh } from '@/hooks';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import {
  cancelAllTrackedNotifications,
  resetNotificationInitialization,
} from '@/services/notifications';
import { clearAuthSession } from '@/services/auth/session';
import { logout } from '@/store/slices/authSlice';
import * as crewApi from '@/services/crew/crewApi';
import type { StaffProfile } from '@/services/crew/crewApi';
import * as authApi from '@/services/auth/authApi';
import type { LineManager } from '@/services/auth/authApi';
import { BORDER_COLOR, BORDER_WIDTH } from '@/constants/Borders';

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${d.getFullYear()}`;
}

interface ProfileFieldProps {
  label: string;
  value: string;
  style?: StyleProp<ViewStyle>;
}

function ProfileField({ label, value, style }: ProfileFieldProps) {
  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInput}>
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
    </View>
  );
}

interface ManagerCardProps {
  name: string;
  designation: string;
  contact: string;
}

function ManagerCard({ name, designation, contact }: ManagerCardProps) {
  return (
    <View style={styles.managerCard}>
      <View style={styles.managerHeader}>
        <Avatar name={name} size="sm" backgroundColor="#1A5276" />
        <Text style={styles.managerName}>{name}</Text>
      </View>
      <View style={styles.managerRow}>
        <Text style={styles.managerLabel}>Designation:</Text>
        <Text style={styles.managerValue}>{designation}</Text>
      </View>
      <View style={styles.managerRow}>
        <Text style={styles.managerLabel}>Contact:</Text>
        <Text style={styles.managerValue}>{contact}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { staffSession } = useAppSelector((state) => state.auth);
  const { handleSidebarItem } = useSidebarNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [lineManager, setLineManager] = useState<LineManager | null>(null);
  const [isLoadingManager, setIsLoadingManager] = useState(true);

  const loadProfileData = useCallback(async () => {
    if (!staffSession) return;

    const [profileResult, managerResult] = await Promise.allSettled([
      crewApi.getStaffById(staffSession.staffId),
      authApi.getLineManager(),
    ]);

    if (profileResult.status === 'fulfilled') {
      setStaffProfile(profileResult.value);
      setProfileError(null);
    } else {
      setProfileError(
        profileResult.reason instanceof Error ? profileResult.reason.message : 'Failed to load profile'
      );
    }

    if (managerResult.status === 'fulfilled') {
      setLineManager(managerResult.value);
    }
    // On manager lookup failure, previous state is kept — section just stays empty on first load.
  }, [staffSession]);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoadingProfile(true);
      setIsLoadingManager(true);
      await loadProfileData();
      if (active) {
        setIsLoadingProfile(false);
        setIsLoadingManager(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadProfileData]);

  const { refreshing, onRefresh } = usePullToRefresh(loadProfileData);

  const profile = {
    name: staffProfile?.Full_Name ?? staffSession?.fullName ?? '',
    staffId: staffProfile?.StaffId ?? staffSession?.staffId ?? '',
    grade: staffProfile?.CurrentGrade ?? '—',
    nationality: staffProfile?.PrimaryNationality ?? '—',
    dateOfJoining: staffProfile?.DOJ ? formatDate(staffProfile.DOJ) : '—',
  };

  const handleLogout = () => {
    setLogoutVisible(false);
    void (async () => {
      await cancelAllTrackedNotifications();
      await clearAuthSession();
      resetNotificationInitialization();
      dispatch(logout());
      router.replace('/(auth)/login');
    })();
  };

  return (
    <View style={styles.container}>
      <AppHeader
        onMenuPress={() => setSidebarOpen(true)}
        onProfilePress={() => {}}
      />

      <SmoothScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerSection}>
          <Text style={styles.pageTitle}>Your Profile</Text>
        </View>

        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Profile Details</Text>

          {isLoadingProfile && (
            <ActivityIndicator style={styles.fieldSpacing} color="#1A5276" />
          )}
          {profileError && (
            <Text style={[styles.fieldLabel, styles.fieldSpacing, styles.errorText]}>
              {profileError}
            </Text>
          )}

          <View style={styles.avatarContainer}>
            <Avatar name={profile.name} size="xl" />
          </View>

          <ProfileField label="Name" value={profile.name} style={styles.fieldSpacing} />

          <View style={styles.rowFields}>
            <ProfileField
              label="Staff ID"
              value={profile.staffId}
              style={styles.flexField}
            />
            <ProfileField
              label="Grade"
              value={profile.grade}
              style={styles.flexField}
            />
          </View>

          <ProfileField
            label="Nationality"
            value={profile.nationality}
            style={styles.fieldSpacing}
          />
          <ProfileField
            label="Date of Joining"
            value={profile.dateOfJoining}
          />
        </View>

        <View style={styles.managersSection}>
          <Text style={styles.sectionTitle}>
            Your Managers at Salam Air
          </Text>

          {isLoadingManager && <ActivityIndicator color="#1A5276" />}

          {!isLoadingManager && lineManager && (
            <ManagerCard
              name={lineManager.name}
              designation={lineManager.designation ?? '—'}
              contact={lineManager.email ?? lineManager.phone ?? '—'}
            />
          )}

          {!isLoadingManager && !lineManager && (
            <Text style={styles.fieldLabel}>No line manager assigned</Text>
          )}
        </View>

        <View style={styles.logoutSection}>
          <Pressable
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.logoutButtonPressed,
            ]}
            onPress={() => setLogoutVisible(true)}
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </View>
      </SmoothScrollView>

      <ConfirmModal
        visible={logoutVisible}
        title="Log out of CPMS?"
        message="You will need to sign in again to access your account."
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleLogout}
        onCancel={() => setLogoutVisible(false)}
      />

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItemId=""
        onItemPress={handleSidebarItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  detailsSection: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A5276',
    marginBottom: 16,
  },
  avatarContainer: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldValue: {
    fontSize: 16,
    color: '#111827',
  },
  fieldSpacing: {
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  flexField: {
    flex: 1,
  },
  managerCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  managerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  managerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  managerRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  managerLabel: {
    fontSize: 14,
    color: '#6B7280',
    width: 96,
  },
  managerValue: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  managersSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  logoutSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  logoutButton: {
    borderWidth: BORDER_WIDTH,
    borderColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  logoutButtonPressed: {
    backgroundColor: '#FEF2F2',
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 16,
  },
});
