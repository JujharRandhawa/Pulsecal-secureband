'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Heart, Thermometer } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ChartDataPoint {
  timestamp: string;
  value: number;
}

interface HistoricalData {
  heartRate: ChartDataPoint[];
  temperature: ChartDataPoint[];
  oxygenSaturation: ChartDataPoint[];
}

export function HistoricalCharts(): JSX.Element {
  const [data, setData] = useState<HistoricalData>({
    heartRate: [],
    temperature: [],
    oxygenSaturation: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const fetchHistoricalData = useCallback(async () => {
    try {
      const hours = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : 168;
      const url = selectedDevice
        ? `${API_URL}/vitals/historical?deviceId=${selectedDevice}&hours=${hours}`
        : `${API_URL}/vitals/historical?hours=${hours}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch historical data');
      const result = await response.json();
      
      setData({
        heartRate: result.heartRate || [],
        temperature: result.temperature || [],
        oxygenSaturation: result.oxygenSaturation || [],
      });
    } catch (error) {
      console.error('Error fetching historical data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, selectedDevice]);

  useEffect(() => {
    fetchHistoricalData();
  }, [fetchHistoricalData]);

  const SimpleLineChart = ({ data, label, color, unit }: {
    data: ChartDataPoint[];
    label: string;
    color: string;
    unit: string;
  }) => {
    if (data.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          No data available
        </div>
      );
    }

    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = 800;
    const height = 200;

    const points = data.map((point, index) => {
      const x = (index / (data.length - 1 || 1)) * width;
      const y = height - ((point.value - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    // Use CSS variables for colors
    const colorMap: Record<string, string> = {
      red: '#dc2626',
      orange: '#ea580c',
      blue: '#2563eb',
    };
    const strokeColor = colorMap[color] || '#000';

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="h-3 w-3 rounded-full" 
              style={{ backgroundColor: strokeColor }}
            />
            <span className="text-sm font-medium">{label}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {data.length > 0 && (
              <>
                Min: {min.toFixed(1)}{unit} | Max: {max.toFixed(1)}{unit} | 
                Latest: {data[data.length - 1].value.toFixed(1)}{unit}
              </>
            )}
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-gray-50">
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            <polyline
              points={points}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {data.map((point, index) => {
              const x = (index / (data.length - 1 || 1)) * width;
              const y = height - ((point.value - min) / range) * height;
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="3"
                  fill={strokeColor}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Historical Trends
            </CardTitle>
            <CardDescription>Vital signs trends over time</CardDescription>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeRange('1h')}
              className={`px-3 py-1 text-xs rounded ${
                timeRange === '1h'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              aria-label="1 hour view"
            >
              1H
            </button>
            <button
              onClick={() => setTimeRange('24h')}
              className={`px-3 py-1 text-xs rounded ${
                timeRange === '24h'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              aria-label="24 hour view"
            >
              24H
            </button>
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1 text-xs rounded ${
                timeRange === '7d'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              aria-label="7 day view"
            >
              7D
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Loading chart data...</div>
        ) : (
          <Tabs defaultValue="heartRate" className="space-y-4">
            <TabsList>
              <TabsTrigger value="heartRate" className="flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Heart Rate
              </TabsTrigger>
              <TabsTrigger value="temperature" className="flex items-center gap-2">
                <Thermometer className="h-4 w-4" />
                Temperature
              </TabsTrigger>
              <TabsTrigger value="oxygen" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Oxygen
              </TabsTrigger>
            </TabsList>

            <TabsContent value="heartRate">
              <SimpleLineChart
                data={data.heartRate}
                label="Heart Rate"
                color="red"
                unit=" bpm"
              />
            </TabsContent>

            <TabsContent value="temperature">
              <SimpleLineChart
                data={data.temperature}
                label="Temperature"
                color="orange"
                unit="°C"
              />
            </TabsContent>

            <TabsContent value="oxygen">
              <SimpleLineChart
                data={data.oxygenSaturation}
                label="Oxygen Saturation"
                color="blue"
                unit="%"
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
