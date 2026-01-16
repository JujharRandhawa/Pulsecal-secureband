'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWebSocket, VitalMetricEvent } from '@/hooks/use-websocket';
import { Heart, Thermometer, Droplets } from 'lucide-react';

interface VitalChartProps {
  deviceId?: string;
  metricType: 'heartRate' | 'temperature' | 'oxygenSaturation';
  maxDataPoints?: number;
}

const metricConfig = {
  heartRate: {
    title: 'Heart Rate',
    unit: 'bpm',
    icon: Heart,
    color: '#ef4444',
    yAxisDomain: [40, 180] as [number, number],
  },
  temperature: {
    title: 'Temperature',
    unit: '°C',
    icon: Thermometer,
    color: '#f59e0b',
    yAxisDomain: [35, 40] as [number, number],
  },
  oxygenSaturation: {
    title: 'Oxygen Saturation',
    unit: '%',
    icon: Droplets,
    color: '#3b82f6',
    yAxisDomain: [85, 100] as [number, number],
  },
};

export function VitalChart({
  deviceId,
  metricType,
  maxDataPoints = 50,
}: VitalChartProps) {
  const { socket, isConnected, subscribeVitals, unsubscribeVitals } =
    useWebSocket();
  const [data, setData] = useState<Array<{ time: string; value: number }>>(
    [],
  );

  const config = metricConfig[metricType];

  useEffect(() => {
    if (isConnected && socket) {
      subscribeVitals(deviceId);

      const handleVitalMetric = (event: VitalMetricEvent) => {
        // Filter by device if specified
        if (deviceId && event.deviceId !== deviceId) {
          return;
        }

        // Get the metric value based on type
        let value: number | null = null;
        if (metricType === 'heartRate') {
          value = event.heartRate;
        } else if (metricType === 'temperature') {
          value = event.temperatureCelsius;
        } else if (metricType === 'oxygenSaturation') {
          value = event.oxygenSaturation;
        }

        if (value !== null) {
          setData((prev) => {
            const newData = [
              ...prev,
              {
                time: new Date(event.recordedAt).toLocaleTimeString(),
                value,
              },
            ];
            // Keep only last N data points
            return newData.slice(-maxDataPoints);
          });
        }
      };

      socket.on('vital:metric', handleVitalMetric);

      return () => {
        socket.off('vital:metric', handleVitalMetric);
        unsubscribeVitals();
      };
    }
  }, [
    socket,
    isConnected,
    deviceId,
    metricType,
    maxDataPoints,
    subscribeVitals,
    unsubscribeVitals,
  ]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <config.icon className="h-5 w-5" />
          <CardTitle>{config.title}</CardTitle>
        </div>
        <CardDescription>
          Real-time {config.title.toLowerCase()} monitoring
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isConnected ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Connecting to real-time updates...
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Waiting for data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={config.yAxisDomain}
                tick={{ fontSize: 12 }}
                label={{
                  value: config.unit,
                  angle: -90,
                  position: 'insideLeft',
                }}
              />
              <Tooltip
                formatter={(value: number) => [`${value} ${config.unit}`, config.title]}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke={config.color}
                strokeWidth={2}
                dot={false}
                name={config.title}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
