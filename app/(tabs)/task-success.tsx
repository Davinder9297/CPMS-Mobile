import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '@/components/AppHeader';
import Sidebar from '@/components/Sidebar';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import { BORDER_WIDTH } from '@/constants/Borders';

export default function TaskSuccessScreen() {
  const router = useRouter();
  const { handleSidebarItem } = useSidebarNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <View style={styles.container}>
      <AppHeader
        onMenuPress={() => setSidebarOpen(true)}
        onProfilePress={() => router.push('/(tabs)/profile')}
      />

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={64} color="#5B8C3E" />
        </View>
        <Text style={styles.message}>
          Your Crew Statement has been Submitted
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          onPress={() => router.replace('/(tabs)/my-tasks')}
        >
          <Text style={styles.backButtonText}>Back to My Tasks</Text>
        </Pressable>
      </View>

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
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: 9999,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  message: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  backButton: {
    marginTop: 40,
    borderWidth: BORDER_WIDTH,
    borderColor: '#5B8C3E',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonPressed: {
    backgroundColor: '#F0FDF4',
  },
  backButtonText: {
    color: '#5B8C3E',
    fontWeight: '600',
    fontSize: 16,
  },
});
