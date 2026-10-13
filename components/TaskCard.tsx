import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Task, TaskStatus } from '@/constants/tasks';
import { BORDER_COLOR, BORDER_WIDTH } from '@/constants/Borders';

const STATUS_STYLES: Record<
  TaskStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  open: {
    bg: '#FEE2E2',
    text: '#DC2626',
    dot: '#DC2626',
    label: 'Open',
  },
  pending: {
    bg: '#FEF9C3',
    text: '#A16207',
    dot: '#CA8A04',
    label: 'Pending',
  },
  closed: {
    bg: '#DCFCE7',
    text: '#15803D',
    dot: '#16A34A',
    label: 'Closed',
  },
};

interface TaskCardProps {
  task: Task;
  taskNumber?: number;
  onPress?: () => void;
  onAcknowledge?: () => void;
  showChevron?: boolean;
}

export default function TaskCard({
  task,
  taskNumber,
  onPress,
  onAcknowledge,
  showChevron = true,
}: TaskCardProps) {
  const status = STATUS_STYLES[task.status];

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>
          {taskNumber ? `(${taskNumber}) - ` : ''}
          {task.title}
        </Text>
        {showChevron && (
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        )}
      </View>

      <Text style={styles.label}>Workflow Type:</Text>
      <Text style={styles.workflowType} numberOfLines={3}>
        {task.workflowType}
      </Text>

      <View style={styles.separator} />

      <View style={styles.footer}>
        <Text style={styles.dueDate}>Action Due: {task.actionDue}</Text>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <View
            style={[styles.statusDot, { backgroundColor: status.dot }]}
          />
          <Text style={[styles.statusText, { color: status.text }]}>
            {status.label}
          </Text>
        </View>
      </View>

      {task.showAcknowledge && (
        <Pressable
          style={({ pressed }) => [
            styles.acknowledgeButton,
            pressed && styles.acknowledgeButtonPressed,
          ]}
          onPress={(e) => {
            e.stopPropagation?.();
            onAcknowledge?.();
          }}
        >
          <Text style={styles.acknowledgeText}>Acknowledge</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  cardPressed: {
    backgroundColor: '#F9FAFB',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    paddingRight: 8,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  workflowType: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dueDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  acknowledgeButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderWidth: BORDER_WIDTH,
    borderColor: '#5B8C3E',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  acknowledgeButtonPressed: {
    backgroundColor: '#F0FDF4',
  },
  acknowledgeText: {
    color: '#5B8C3E',
    fontWeight: '600',
    fontSize: 14,
  },
});
