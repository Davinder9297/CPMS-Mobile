import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAppDispatch, useAppSelector } from '@/hooks';
import { saveAuthSession } from '@/services/auth/session';
import { setStaffSession } from '@/store/slices/authSlice';
import * as authApi from '@/services/auth/authApi';
import { BORDER_COLOR, BORDER_WIDTH } from '@/constants/Borders';

export default function LoginBehalfScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const pmAuth = useAppSelector((state) => state.auth.pmAuth);
  const params = useLocalSearchParams<{
    staffId: string;
    fullName: string;
    nationality: string;
    grade: string;
  }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSelection = Boolean(pmAuth && params.staffId && params.fullName);

  const handleContinue = async () => {
    if (!pmAuth || !params.staffId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await authApi.loginAsStaff(params.staffId);
      const session = {
        staffId: result.staff.staffId,
        orgId: result.staff.orgId,
        fullName: result.staff.fullName,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        actingAsStaff: true,
        managerContext: { userId: pmAuth.userId, email: pmAuth.email },
      };
      await saveAuthSession(session);
      dispatch(setStaffSession(session));
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log in as this staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasSelection) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Sign-in details are incomplete</Text>
        <Pressable
          style={styles.goBackButton}
          onPress={() => router.back()}
        >
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="SalamAir"
        />
      </View>
      <View style={styles.divider} />

      <View style={styles.content}>
        <Text style={styles.heading}>
          You are Logging in on behalf of
        </Text>

        <View style={styles.staffCard}>
          <Text style={styles.staffName}>{params.fullName}</Text>
          <View style={styles.staffDetailsRow}>
            <View style={styles.staffDetailColumn}>
              <Text style={styles.staffDetailLabel}>Staff ID:</Text>
              <Text style={styles.staffDetailValue}>{params.staffId}</Text>
            </View>
            <View style={styles.staffDetailColumn}>
              <Text style={styles.staffDetailLabel}>Nationality:</Text>
              <Text style={styles.staffDetailValue}>
                {params.nationality}
              </Text>
            </View>
            <View style={styles.staffDetailColumn}>
              <Text style={styles.staffDetailLabel}>Grade:</Text>
              <Text style={styles.staffDetailValue}>{params.grade}</Text>
            </View>
          </View>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <View style={styles.buttonSection}>
        <Pressable
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.continueButtonPressed,
            isSubmitting && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
    marginBottom: 16,
  },
  goBackButton: {
    backgroundColor: '#5B8C3E',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  goBackButtonText: {
    color: '#fff',
    fontWeight: '600',
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 32,
  },
  staffCard: {
    backgroundColor: '#fff',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  staffName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  staffDetailsRow: {
    flexDirection: 'row',
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
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  buttonSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  continueButton: {
    backgroundColor: '#5B8C3E',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonPressed: {
    backgroundColor: '#4A7332',
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
});
