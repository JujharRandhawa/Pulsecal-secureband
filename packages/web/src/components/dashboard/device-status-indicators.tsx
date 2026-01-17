'use client';

import { Activity, Battery, Signal, Wifi, WifiOff, CheckCircle2, XCircle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface DeviceStatus {
  id: string;
  serialNumber: string;
  status: string;
  connectionStatus: string | null;
  batteryLevel: number | null;
  lastSeenAt: string | null;
  firmwareVersion: string | null;
}

export function DeviceStatusIndicators(): JSX.Element {
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/device-management-panel?status=active&limit=10`);
      if (!response.ok) throw new Error('Failed to fetch devices');
      const data = await response.json();
      setDevices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const getStatusBadge = (status: string, connectionStatus: string | null) => {
    if (status === 'revoked') {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    if (connectionStatus === 'connected') {
      return <Badge className="bg-green-600">Connected</Badge>;
    }
    if (connectionStatus === 'disconnected') {
      return <Badge variant="secondary">Disconnected</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const getBatteryIcon = (level: number | null) => {
    if (level === null) return <Battery className="h-4 w-4 text-gray-400" />;
    if (level < 20) return <Battery className="h-4 w-4 text-red-600" />;
    if (level < 50) return <Battery className="h-4 w-4 text-yellow-600" />;
    return <Battery className="h-4 w-4 text-green-600" />;
  };

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return 'Never';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          SecureBand Status
        </CardTitle>
        <CardDescription>Real-time device connection and health status</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Loading devices...</div>
        ) : devices.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">No active devices</div>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                tabIndex={0}
                role="button"
                aria-label={`Device ${device.serialNumber} status`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    // Could navigate to device details
                  }
                }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    {device.connectionStatus === 'connected' ? (
                      <Wifi className="h-5 w-5 text-green-600" />
                    ) : (
                      <WifiOff className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{device.serialNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      Last seen: {formatLastSeen(device.lastSeenAt)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getBatteryIcon(device.batteryLevel)}
                  {device.batteryLevel !== null && (
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {device.batteryLevel}%
                    </span>
                  )}
                  {getStatusBadge(device.status, device.connectionStatus)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
