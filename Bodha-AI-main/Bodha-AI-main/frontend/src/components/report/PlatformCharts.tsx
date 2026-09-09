import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';

import { useTranslation } from 'react-i18next';

import type { PlatformRecommendation } from '../../types';
import { formatCurrency, PLATFORM_COLORS } from '../../utils/format';

interface PlatformChartsProps {
  platforms: PlatformRecommendation[];
}

interface ChartDatum {
  name: string;
  id: string;
  fitScore: number;
  estimatedProfit: number;
  color: string;
}

const AXIS_TICK = { fill: '#4a4f4a', fontSize: 12, fontWeight: 500 };
const GRID_LINE = '#cfc8ba';

/**
 * Profit is anchored at zero so gains and losses read against a common
 * baseline, with headroom added on both sides. Without the padding a
 * loss-protected platform (every value negative) would stretch its bar across
 * the whole plot and collide with the axis labels.
 */
function profitDomain(profits: number[]): [number, number] {
  const low = Math.min(0, ...profits);
  const high = Math.max(0, ...profits);
  const padding = Math.max((high - low) * 0.15, 1);

  return [low === 0 ? 0 : low - padding, high === 0 ? padding : high + padding];
}

/**
 * Fit score and profit are measured on different scales (0-100 vs rupees), so
 * they get one chart each rather than a dual axis, which would invite a false
 * visual comparison between the two.
 */
export function PlatformCharts({ platforms }: PlatformChartsProps) {
  const { t } = useTranslation();
  const available = platforms.filter((platform) => !platform.unavailable);

  if (available.length === 0) {
    return (
      <p className="border-t border-rule pt-4 text-sm text-ink-muted">
        {t('report.chartsNeed')}
      </p>
    );
  }

  const data: ChartDatum[] = available.map((platform) => ({
    name: platform.name,
    id: platform.id,
    fitScore: platform.fitScore,
    estimatedProfit: platform.estimatedProfit,
    color: PLATFORM_COLORS[platform.id],
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title={t('report.fitChart')} caption={t('report.fitCaption')}>
        <HorizontalBars
          data={[...data].sort((a, b) => b.fitScore - a.fitScore)}
          dataKey="fitScore"
          domain={[0, 100]}
          formatValue={(value) => value.toFixed(1)}
        />
      </ChartCard>

      <ChartCard title={t('report.profitChart')} caption={t('report.profitCaption')}>
        <HorizontalBars
          data={[...data].sort((a, b) => b.estimatedProfit - a.estimatedProfit)}
          dataKey="estimatedProfit"
          domain={profitDomain(data.map((datum) => datum.estimatedProfit))}
          formatValue={(value) => formatCurrency(value)}
        />
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="border-t border-rule pt-5">
      <figcaption className="mb-5">
        <h3 className="font-display text-base font-medium text-ink-muted">{title}</h3>
        <p className="mt-1 text-ambient text-ink-muted">{caption}</p>
      </figcaption>
      {children}
    </figure>
  );
}

interface HorizontalBarsProps {
  data: ChartDatum[];
  dataKey: 'fitScore' | 'estimatedProfit';
  domain?: [number, number];
  formatValue: (value: number) => string;
}

function HorizontalBars({ data, dataKey, domain, formatValue }: HorizontalBarsProps) {
  return (
    <div style={{ width: '100%', height: data.length * 52 + 16 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 64, bottom: 0, left: 0 }}
          barCategoryGap={12}
        >
          <XAxis type="number" domain={domain ?? [0, 'dataMax']} hide />
          <YAxis
            type="category"
            dataKey="name"
            width={82}
            tickLine={false}
            axisLine={{ stroke: GRID_LINE }}
            tick={AXIS_TICK}
          />
          <Tooltip
            cursor={{ fill: 'rgba(13, 107, 76, 0.06)' }}
            content={<ChartTooltip formatValue={formatValue} dataKey={dataKey} />}
          />
          <Bar dataKey={dataKey} radius={0} isAnimationActive={false}>
            {data.map((entry) => (
              // A 2px surface ring keeps adjacent fills from touching.
              <Cell key={entry.id} fill={entry.color} stroke="#f3efe6" strokeWidth={2} />
            ))}
            <LabelList
              dataKey={dataKey}
              position="right"
              offset={10}
              formatter={(value: number) => formatValue(value)}
              style={{ fill: '#141814', fontSize: 12, fontWeight: 500, fontFamily: 'IBM Plex Mono, ui-monospace, monospace' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ChartTooltipProps extends TooltipProps<number, string> {
  formatValue: (value: number) => string;
  dataKey: 'fitScore' | 'estimatedProfit';
}

function ChartTooltip({ active, payload, formatValue, dataKey }: ChartTooltipProps) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;

  const datum = payload[0].payload as ChartDatum;
  const label = dataKey === 'fitScore' ? t('report.fitScore') : t('report.netProfit');

  return (
    <div className="border border-rule bg-[#faf8f3] px-3 py-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <span
          className="h-2.5 w-2.5"
          style={{ backgroundColor: datum.color }}
          aria-hidden="true"
        />
        {datum.name}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {label}: <span className="figure font-medium text-ink">{formatValue(datum[dataKey])}</span>
      </p>
    </div>
  );
}
