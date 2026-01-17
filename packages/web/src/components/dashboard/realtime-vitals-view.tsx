'use client';

import { Heart, Thermometer, Droplet, Activity } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface VitalMetric {
  id: string;
  deviceId: string;
  recordedAt: string;
  heartRate: number | null;
  temperatureCelsius: number | null;
  oxygenSaturation: number | null;
  batteryLevel: number | null;
  deviceSerial?: string;
}

export function RealtimeVitalsView(): JSX.Element {
  const [vitals, setVitals] = useState<VitalMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDevice] = useState<string | null>(null);

  const fetchVitals = useCallback(async () => {
    try {
      const url = selectedDevice
        ? `${API_URL}/vitals?deviceId=${selectedDevice}&limit=1`
        : `${API_URL}/vitals?limit=10`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch vitals');
      const data = await response.json();
      setVitals(Array.isArray(data) ? data : data.vitals || []);
    } catch (error) {
      console.error('Error fetching vitals:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDevice]);

  useEffect(() => {
    fetchVitals();
    const interval = setInterval(fetchVitals, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [fetchVitals]);

  const getVitalStatus = (type: 'heartRate' | 'temperature' | 'oxygen', value: number | null) => {
    if (value === null) return { status: 'unknown', color: 'gray' };
    
    if (type === 'heartRate') {
      if (value < 60) return { status: 'low', color: 'yellow' };
      if (value > 100) return { status: 'high', color: 'red' };
      return { status: 'normal', color: 'green' };
    }
    
    if (type === 'temperature') {
      if (value < 36.1) return { status: 'low', color: 'yellow' };
      if (value > 37.2) return { status: 'high', color: 'red' };
      return { status: 'normal', color: 'green' };
    }
    
    if (type === 'oxygen') {
      if (value < 95) return { status: 'low', color: 'red' };
      return { status: 'normal', color: 'green' };
    }
    
    return { status: 'normal', color: 'green' };
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Real-Time Vitals
        </CardTitle>
        <CardDescription>Latest vital signs from active SecureBands</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Loading vitals...</div>
        ) : vitals.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">No vital data available</div>
        ) : (
          <div className="space-y-4">
            {vitals.map((vital) => {
              const hrStatus = getVitalStatus('heartRate', vital.heartRate);
              const tempStatus = getVitalStatus('temperature', vital.temperatureCelsius);
              const o2Status = getVitalStatus('oxygen', vital.oxygenSaturation);

              return (
                <div
                  key={vital.id}
                  className="border rounded-lg p-4 space-y-3"
                  tabIndex={0}
                  role="article"
                  aria-label={`Vitals for device ${vital.deviceSerial || vital.deviceId}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">
                      {vital.deviceSerial || `Device ${vital.deviceId.slice(0, 8)}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(vital.recordedAt)}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {/* Heart Rate */}
                    <div className="flex items-center gap-2">
                      <Heart 
                        className={`h-4 w-4 ${
                          hrStatus.color === 'green' ? 'text-green-600' :
                          hrStatus.color === 'yellow' ? 'text-yellow-600' :
                          'text-red-600'
                        }`} 
                      />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Heart Rate</div>
                        <div className="font-semibold">
                          {vital.heartRate !== null ? `${vital.heartRate} bpm` : '--'}
                        </div>
                      </div>
                      {vital.heartRate !== null && (
                        <Badge
                          variant={hrStatus.status === 'normal' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {hrStatus.status}
                        </Badge>
                      )}
                    </div>

                    {/* Temperature */}
                    <div className="flex items-center gap-2">
                      <Thermometer 
                        className={`h-4 w-4 ${
                          tempStatus.color === 'green' ? 'text-green-600' :
                          tempStatus.color === 'yellow' ? 'text-yellow-600' :
                          'text-red-600'
                        }`} 
                      />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Temperature</div>
                        <div className="font-semibold">
                          {vital.temperatureCelsius !== null
                            ? `${vital.temperatureCelsius.toFixed(1)}°C`
                            : '--'}
                        </div>
                      </div>
                      {vital.temperatureCelsius !== null && (
                        <Badge
                          variant={tempStatus.status === 'normal' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {tempStatus.status}
                        </Badge>
                      )}
                    </div>

                    {/* Oxygen Saturation */}
                    <div className="flex items-center gap-2">
                      <Droplet 
                        className={`h-4 w-4 ${
                          o2Status.color === 'green' ? 'text-green-600' :
                          o2Status.color === 'yellow' ? 'text-yellow-600' :
                          'text-red-600'
                        }`} 
                      />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">SpO2</div>
                        <div className="font-semibold">
                          {vital.oxygenSaturation !== null ? `${vital.oxygenSaturation}%` : '--'}
                        </div>
                      </div>
                      {vital.oxygenSaturation !== null && (
                        <Badge
                          variant={o2Status.status === 'normal' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {o2Status.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
