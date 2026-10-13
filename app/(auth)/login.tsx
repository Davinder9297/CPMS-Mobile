import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAppDispatch } from '@/hooks';
import SmoothScrollView from '@/components/SmoothScrollView';
import { setStaffSession } from '@/store/slices/authSlice';
import { saveAuthSession } from '@/services/auth/session';
import * as authApi from '@/services/auth/authApi';
import { BORDER_COLOR, BORDER_WIDTH } from '@/constants/Borders';

export default function LoginScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Web only: on wide viewports lay the screen out as two columns (image on the
  // left, form on the right). Native and narrow mobile-web keep the original
  // stacked layout untouched.
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && width >= 768;

  const handleLogin = async () => {
    if (!staffId.trim() || !password) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await authApi.login(staffId.trim(), password);
      const session = {
        staffId: result.staff.staffId,
        orgId: result.staff.orgId,
        fullName: result.staff.fullName,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        actingAsStaff: false,
        managerContext: null,
      };
      await saveAuthSession(session);
      dispatch(setStaffSession(session));
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleBlock = (
    <View style={styles.titleSection}>
      <Text style={styles.title}>Welcome Back</Text>
    </View>
  );

  const formBlock = (
    <View style={styles.formSection}>
      <View>
        <Text style={styles.label}>Staff ID</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. CP2203"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="characters"
          autoComplete="off"
          value={staffId}
          onChangeText={setStaffId}
        />
      </View>

      <View>
        <View style={styles.passwordHeader}>
          <Text style={styles.labelNoMargin}>Password</Text>
          <Pressable onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={22}
              color="#6B7280"
            />
          </Pressable>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#9CA3AF"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={styles.forgotPassword}>
          <Text style={styles.forgotPasswordText}>Forgot Password</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );

  const buttonBlock = (
    <View style={styles.buttonSection}>
      <Pressable
        style={({ pressed }) => [
          styles.loginButton,
          pressed && styles.loginButtonPressed,
          isSubmitting && styles.loginButtonDisabled,
        ]}
        onPress={handleLogin}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.loginButtonText}>Login</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.managerLink}
        onPress={() => router.push('/(auth)/manager-login')}
      >
        <Text style={styles.managerLinkText}>
          Performance Manager? Sign in here
        </Text>
      </Pressable>
    </View>
  );

  if (isWideWeb) {
    return (
      <View style={styles.webRoot}>
        <View style={styles.webImagePane}>
          <Image
            source={require('../../assets/images/airplane.png')}
            style={styles.webImageFull}
            resizeMode="cover"
          />
        </View>
        <KeyboardAvoidingView style={styles.webFormPane}>
          <SmoothScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.webFormScrollContent}
            bounces={false}
          >
            <View style={styles.webFormInner}>
              <View style={styles.webLogoHeader}>
                <Image
                  source={require('../../assets/images/logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                  accessibilityLabel="SalamAir"
                />
              </View>
              {titleBlock}
              {formBlock}
              {buttonBlock}
            </View>
          </SmoothScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SmoothScrollView style={styles.scrollView} bounces={false}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="SalamAir"
          />
        </View>
        <View style={styles.divider} />

        <View style={styles.bannerSection}>
          <View style={styles.bannerContainer}>
            <Image
              source={require('../../assets/images/airplane.png')}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          </View>
        </View>

        {titleBlock}
        {formBlock}
        {buttonBlock}
      </SmoothScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  // Web wide-screen two-column layout (image left, form right).
  webRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
  },
  webImagePane: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  webImageFull: {
    width: '100%',
    height: '100%',
  },
  webFormPane: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webFormScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 48,
  },
  webFormInner: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 40,
  },
  webLogoHeader: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  header: {
    alignItems: 'center',
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
    marginHorizontal: 0,
  },
  bannerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  bannerContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  formSection: {
    paddingHorizontal: 20,
    gap: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  labelNoMargin: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  input: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#374151',
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotPasswordText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  buttonSection: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  loginButton: {
    backgroundColor: '#5B8C3E',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  loginButtonPressed: {
    backgroundColor: '#4A7332',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  managerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  managerLinkText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
  },
});
