import { View, Text, ScrollView, Pressable, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppDispatch, useAppSelector } from '@/hooks';
import { setThemeMode } from '@/store/slices/appSlice';
import { BORDER_COLOR, BORDER_WIDTH } from '@/constants/Borders';

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const { themeMode } = useAppSelector((state) => state.app);
  const { isAuthenticated, staffSession } = useAppSelector((state) => state.auth);

  const isDarkMode = themeMode === 'dark';

  return (
    <ScrollView style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={styles.header}>
        <Text style={[styles.title, isDarkMode && styles.titleDark]}>
          Settings
        </Text>
      </View>

      {isAuthenticated && staffSession && (
        <View style={[styles.userCard, isDarkMode && styles.userCardDark]}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {staffSession.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={[styles.userName, isDarkMode && styles.userNameDark]}>
                {staffSession.fullName}
              </Text>
              <Text style={[styles.userEmail, isDarkMode && styles.userEmailDark]}>
                {staffSession.staffId}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, isDarkMode && styles.sectionLabelDark]}>
          Appearance
        </Text>
        <View style={[styles.sectionCard, isDarkMode && styles.sectionCardDark]}>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons
                name="moon-outline"
                size={20}
                color={isDarkMode ? '#6366F1' : '#6B7280'}
              />
              <Text style={[styles.settingTitle, isDarkMode && styles.settingTitleDark]}>
                Dark Mode
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={(value) => {
                dispatch(setThemeMode(value ? 'dark' : 'light'));
              }}
              trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </View>

      <View style={styles.sectionWithTopMargin}>
        <Text style={[styles.sectionLabel, isDarkMode && styles.sectionLabelDark]}>
          General
        </Text>
        <View style={[styles.sectionCard, isDarkMode && styles.sectionCardDark]}>
          <SettingItem icon="notifications-outline" title="Notifications" isDarkMode={isDarkMode} />
          <SettingItem icon="shield-outline" title="Privacy" isDarkMode={isDarkMode} />
          <SettingItem icon="help-circle-outline" title="Help & Support" isDarkMode={isDarkMode} />
          <SettingItem icon="information-circle-outline" title="About" isDarkMode={isDarkMode} isLast />
        </View>
      </View>

      <View style={styles.signOutSection}>
        <Pressable
          style={({ pressed }) => [
            styles.signOutButton,
            isDarkMode && styles.signOutButtonDark,
            pressed && (isDarkMode ? styles.signOutButtonPressedDark : styles.signOutButtonPressed),
          ]}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SettingItem({
  icon,
  title,
  isDarkMode,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  isDarkMode: boolean;
  isLast?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingItem,
        !isLast && (isDarkMode ? styles.settingItemBorderDark : styles.settingItemBorder),
        pressed && (isDarkMode ? styles.settingItemPressedDark : styles.settingItemPressed),
      ]}
    >
      <View style={styles.settingRowLeft}>
        <Ionicons name={icon} size={20} color="#6B7280" />
        <Text style={[styles.settingTitle, isDarkMode && styles.settingTitleDark]}>
          {title}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  titleDark: {
    color: '#fff',
  },
  userCard: {
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    marginBottom: 24,
  },
  userCardDark: {
    backgroundColor: 'rgba(49, 46, 129, 0.2)',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  userNameDark: {
    color: '#fff',
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  userEmailDark: {
    color: '#9CA3AF',
  },
  section: {
    paddingHorizontal: 24,
  },
  sectionWithTopMargin: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  sectionLabelDark: {
    color: '#6B7280',
  },
  sectionCard: {
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  sectionCardDark: {
    backgroundColor: '#1F2937',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingTitle: {
    marginLeft: 12,
    fontSize: 16,
    color: '#111827',
  },
  settingTitleDark: {
    color: '#fff',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingItemBorder: {
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
  },
  settingItemBorderDark: {
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: '#374151',
  },
  settingItemPressed: {
    backgroundColor: '#F3F4F6',
  },
  settingItemPressedDark: {
    backgroundColor: '#374151',
  },
  signOutSection: {
    paddingHorizontal: 24,
    marginTop: 32,
    marginBottom: 24,
  },
  signOutButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: BORDER_WIDTH,
    borderColor: '#FCA5A5',
  },
  signOutButtonDark: {
    borderColor: '#991B1B',
  },
  signOutButtonPressed: {
    backgroundColor: '#FEF2F2',
  },
  signOutButtonPressedDark: {
    backgroundColor: 'rgba(127, 29, 29, 0.2)',
  },
  signOutText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 16,
  },
});
