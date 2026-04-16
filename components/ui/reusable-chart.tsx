"use client";

import { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, ColorType, AreaSeries } from "lightweight-charts";

interface ReusableChartProps {
  data: Record<string, number>;
  gradientColors?: [string, string];
  lineColor?: string;
  height?: number;
  showGrid?: boolean;
  showVertGrid?: boolean;
  formatYAxisLabel?: (value: number) => string;
  textColor?: string;
  /**
   * Grid line color
   */
  gridColor?: string;
}

/**
 * Pin data edge-to-edge with zero gap.
 *
 * In lightweight-charts, scrollToPosition(0) aligns the last bar's RIGHT EDGE
 * to the plot boundary — leaving a barSpacing/2 gap between the data point
 * (bar center) and the edge.
 *
 * scrollToPosition(-0.5) shifts the view half a bar to the right so the last
 * bar's CENTER lands exactly at the right edge, and the first bar's CENTER lands
 * exactly at the left edge (x = 0). No gap on either side.
 */
const fillChart = (chart: IChartApi, container: HTMLDivElement, dataLength: number) => {
  if (dataLength < 2) return;
  const priceScaleWidth = chart.priceScale("right").width() || 70;
  const plotWidth = container.clientWidth - priceScaleWidth;
  if (plotWidth <= 0) return;
  const spacing = plotWidth / (dataLength - 1);
  chart.timeScale().applyOptions({ barSpacing: Math.max(spacing, 1) });
  // -0.5 = last bar center at right edge, first bar center at left edge
  chart.timeScale().scrollToPosition(-0.5, false);
};

export const ReusableChart = ({
  data,
  gradientColors = ["rgba(124, 53, 248, 0.3)", "rgba(124, 53, 248, 0.05)"],
  lineColor = "#7C35F8",
  height = 300,
  showGrid = true,
  showVertGrid,
  formatYAxisLabel,
  textColor = "#181822",
  gridColor = "rgba(226, 226, 226, 0.5)",
}: ReusableChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const formatYAxisLabelRef = useRef(formatYAxisLabel);
  const dataLengthRef = useRef<number>(0);

  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor,
        fontSize: 12,
      },
      grid: {
        vertLines: { visible: showVertGrid ?? showGrid, color: gridColor },
        horzLines: { visible: showGrid, color: gridColor },
      },
      rightPriceScale: {
        visible: true,
        borderColor: "transparent",
        minimumWidth: 70,
        scaleMargins: { top: 0.2, bottom: 0.15 },
        ...(formatYAxisLabelRef.current && {
          priceFormat: {
            type: "custom" as const,
            formatter: (price: number) => formatYAxisLabelRef.current!(price),
          },
        }),
      },
      timeScale: {
        visible: true,
        borderColor: "transparent",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 0,
        // Do NOT set fixLeftEdge / fixRightEdge — they pin bar edges (not centers),
        // creating an unavoidable half-bar gap on each side.
        minBarSpacing: 1,
      },
      crosshair: { mode: 0 },
      handleScroll: false,
      handleScale: false,
      width: chartContainerRef.current.clientWidth,
      height,
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: gradientColors[0],
      bottomColor: gradientColors[1],
      lineWidth: 2,
      lineType: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    if (data && Object.keys(data).length > 0) {
      const chartData = Object.entries(data)
        .map(([dateStr, value]) => ({ time: dateStr as any, value }))
        .sort((a, b) => a.time.localeCompare(b.time));

      if (chartData.length > 0) {
        areaSeries.setData(chartData);
        dataLengthRef.current = chartData.length;
        // Double rAF: ensures price scale width is fully settled before computing spacing
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (chartRef.current && chartContainerRef.current) {
              fillChart(chartRef.current, chartContainerRef.current, chartData.length);
            }
          });
        });
      }
    }

    const handleResize = () => {
      if (!chartContainerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      fillChart(chartRef.current, chartContainerRef.current, dataLengthRef.current);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: { textColor },
      grid: {
        vertLines: { visible: showVertGrid ?? showGrid, color: gridColor },
        horzLines: { visible: showGrid, color: gridColor },
      },
      height,
    });
    if (chartContainerRef.current) {
      chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
    }
  }, [textColor, showGrid, height, gridColor]);

  useEffect(() => {
    formatYAxisLabelRef.current = formatYAxisLabel;
  }, [formatYAxisLabel]);

  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.applyOptions({
      lineColor,
      topColor: gradientColors[0],
      bottomColor: gradientColors[1],
    });
  }, [lineColor, gradientColors]);

  useEffect(() => {
    if (!seriesRef.current || !data || Object.keys(data).length === 0) return;

    const chartData = Object.entries(data)
      .map(([dateStr, value]) => ({ time: dateStr as any, value }))
      .sort((a, b) => a.time.localeCompare(b.time));

    if (chartData.length > 0) {
      seriesRef.current.setData(chartData);
      dataLengthRef.current = chartData.length;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (chartRef.current && chartContainerRef.current) {
            fillChart(chartRef.current, chartContainerRef.current, chartData.length);
          }
        });
      });
    }
  }, [data]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full"
      style={{ height: `${height}px`, pointerEvents: "none" }}
    />
  );
};
