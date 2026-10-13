import { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_COLOR, BORDER_WIDTH } from '@/constants/Borders';

interface AppraisalAccordionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  children: ReactNode;
}

export default function AppraisalAccordion({
  title,
  expanded,
  onToggle,
  onEdit,
  children,
}: AppraisalAccordionProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        onPress={onToggle}
      >
        <Text style={styles.title}>{title}</Text>
        {onEdit && (
          <Pressable
            style={styles.editButton}
            onPress={(e) => {
              e.stopPropagation?.();
              onEdit();
            }}
            hitSlop={8}
          >
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        )}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#6B7280"
        />
      </Pressable>

      {expanded && (
        <View style={styles.content}>
          <View style={styles.contentInner}>{children}</View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerPressed: {
    backgroundColor: '#F9FAFB',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  editButton: {
    marginRight: 12,
  },
  editText: {
    fontSize: 14,
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: BORDER_WIDTH,
    borderTopColor: BORDER_COLOR,
  },
  contentInner: {
    paddingTop: 12,
  },
});
