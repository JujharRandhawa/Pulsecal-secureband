'use client';

import { Trash2, Battery, Wifi, WifiOff } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Device {
  id: string;
  serialNumber: string;
  macAddress: string;
  firmwareVersion: string | null;
  status: string;
  lastSeenAt: Date | string | null;
  batteryLevel: number | null;
  connectionStatus: string | null;
  isStreaming: boolean;
  timeSinceLastSeen: string | null;
}

interface DeviceListProps {
  devices: Device[];
  onRemove: (deviceId: string, serialNumber: string) => void;
}

export function DeviceList({ devices, onRemove }: DeviceListProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'inventory':
        return <Badge variant="secondary">Inventory</Badge>;
      case 'maintenance':
        return <Badge variant="outline">Maintenance</Badge>;
      case 'revoked':
        return <Badge variant="destructive">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getBatteryColor = (level: number | null) => {
    if (level === null) return 'text-muted-foreground';
    if (level < 20) return 'text-destructive';
    if (level < 50) return 'text-yellow-500';
    return 'text-green-500';
  };

  if (devices.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No devices found. Add a device to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Serial Number</TableHead>
            <TableHead>MAC Address</TableHead>
            <TableHead>Firmware</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Battery</TableHead>
            <TableHead>Connection</TableHead>
            <TableHead>Last Seen</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices.map((device) => (
            <TableRow key={device.id}>
              <TableCell className="font-medium">
                {device.serialNumber}
                {device.isStreaming && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Streaming
                  </Badge>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {device.macAddress}
              </TableCell>
              <TableCell>
                {device.firmwareVersion || (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>{getStatusBadge(device.status)}</TableCell>
              <TableCell>
                {device.batteryLevel !== null ? (
                  <div className="flex items-center gap-2">
                    <Battery
                      className={`h-4 w-4 ${getBatteryColor(device.batteryLevel)}`}
                    />
                    <span className="text-sm">{device.batteryLevel}%</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {device.connectionStatus ? (
                  <div className="flex items-center gap-2">
                    {device.connectionStatus === 'connected' ? (
                      <>
                        <Wifi className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Connected</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm capitalize">
                          {device.connectionStatus}
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {device.lastSeenAt ? (
                  <div>
                    <div className="text-sm">
                      {typeof device.lastSeenAt === 'string' 
                        ? new Date(device.lastSeenAt).toLocaleDateString()
                        : device.lastSeenAt.toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {device.timeSinceLastSeen}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Never</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(device.id, device.serialNumber)}
                  disabled={device.status === 'revoked'}
                  title="Remove device"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
