import { View, Text, useWindowDimensions, StyleSheet } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';

import { TREND_MONTHS, TREND_SERIES } from '@/constants/feedback360';
import { BORDER_COLOR, BORDER_WIDTH } from '@/constants/Borders';

interface TrendSeries {
  id: string;
  label: string;
  color?: string;
  data: (number | null)[];
}

interface TrendChartProps {
  selectedSeriesId?: string;
  // Real data (falls back to the mock constants when omitted). Series values may
  // be null for months with no votes — those points are simply skipped.
  months?: string[];
  series?: TrendSeries[];
}

// Palette assigned by series index when real data doesn't carry its own colour.
const SERIES_COLORS = ['#3B82F6', '#22C55E', '#A16207', '#A855F7', '#EF4444', '#0EA5E9'];

export default function TrendChart({ selectedSeriesId, months, series }: TrendChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const chartMonths = months && months.length ? months : TREND_MONTHS;
  const allSeries: TrendSeries[] = (series && series.length ? series : TREND_SERIES).map(
    (s, i) => ({ ...s, color: s.color ?? SERIES_COLORS[i % SERIES_COLORS.length] })
  );
  const visibleSeries = selectedSeriesId
    ? allSeries.filter((s) => s.id === selectedSeriesId)
    : allSeries;
  const chartWidth = Math.max(screenWidth - 48, 280);
  const chartHeight = 200;
  const paddingLeft = 28;
  const paddingRight = 12;
  const paddingTop = 16;
  const paddingBottom = 28;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const maxY = 5;
  const minY = 0;

  const getX = (index: number) =>
    paddingLeft + (index / Math.max(1, chartMonths.length - 1)) * plotWidth;

  const getY = (value: number) =>
    paddingTop + ((maxY - value) / (maxY - minY)) * plotHeight;

  return (
    <View style={styles.container}>
      <Svg width={chartWidth} height={chartHeight}>
        {[0, 1, 2, 3, 4, 5].map((tick) => {
          const y = getY(tick);
          return (
            <Line
              key={`grid-${tick}`}
              x1={paddingLeft}
              y1={y}
              x2={chartWidth - paddingRight}
              y2={y}
              stroke="#E5E7EB"
              strokeWidth={1}
            />
          );
        })}

        {[0, 1, 2, 3, 4, 5].map((tick) => (
          <SvgText
            key={`label-${tick}`}
            x={paddingLeft - 8}
            y={getY(tick) + 4}
            fontSize="10"
            fill="#9CA3AF"
            textAnchor="end"
          >
            {tick}
          </SvgText>
        ))}

        {visibleSeries.map((s) => {
          const points = s.data
            .map((value, index) => (value == null ? null : `${getX(index)},${getY(value)}`))
            .filter((p): p is string => p !== null)
            .join(' ');

          return (
            <Polyline
              key={s.id}
              points={points}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
            />
          );
        })}

        {visibleSeries.map((s) =>
          s.data.map((value, index) =>
            value == null ? null : (
              <Circle
                key={`${s.id}-${index}`}
                cx={getX(index)}
                cy={getY(value)}
                r={3}
                fill={s.color}
              />
            )
          )
        )}

        {chartMonths.map((month, index) => (
          <SvgText
            key={`${month}-${index}`}
            x={getX(index)}
            y={chartHeight - 8}
            fontSize="10"
            fill="#6B7280"
            textAnchor="middle"
          >
            {month}
          </SvgText>
        ))}
      </Svg>

      <View style={styles.legend}>
        {visibleSeries.map((series) => (
          <View key={series.id} style={styles.legendItem}>
            <View
              style={[styles.legendSwatch, { backgroundColor: series.color }]}
            />
            <Text style={styles.legendLabel}>{series.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    padding: 12,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    columnGap: 16,
    rowGap: 8,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 12,
    color: '#374151',
  },
});
