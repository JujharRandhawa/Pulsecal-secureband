'use client';

import { Activity, Battery, Signal, Plus, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

import { AddDeviceDialog } from '@/components/device-management/add-device-dialog';
import { DeviceList } from '@/components/device-management/device-list';
import { RemoveDeviceDialog } from '@/components/device-management/remove-device-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

interface Statistics {
  total: number;
  active: number;
  offline: number;
  revoked: number;
  lowBattery: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DeviceManagementPage(): JSX.Element {
  const [devices, setDevices] = useState<Device[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    total: 0,
    active: 0,
    offline: 0,
    revoked: 0,
    lowBattery: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<{ id: string; serial: string } | null>(null);

  const fetchDevices = async (status?: string) => {
    try {
      const url = status && status !== 'all' 
        ? `${API_URL}/device-management-panel?status=${status}`
        : `${API_URL}/device-management-panel`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch devices');
      }
      const data = await response.json();
      setDevices(data);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await fetch(`${API_URL}/device-management-panel/statistics`);
      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }
      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  useEffect(() => {
    fetchDevices(statusFilter);
    fetchStatistics();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDevices(statusFilter);
      fetchStatistics();
    }, 30000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const handleAddDevice = async (deviceData: {
    serialNumber: string;
    macAddress: string;
    firmwareVersion?: string;
    hardwareVersion?: string;
    manufacturedDate?: string;
    deployedDate?: string;
  }) => {
    try {
      const response = await fetch(`${API_URL}/device-management-panel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deviceData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add device');
      }

      // Refresh device list
      await fetchDevices(statusFilter);
      await fetchStatistics();
    } catch (error) {
      console.error('Error adding device:', error);
      throw error;
    }
  };

  const handleRemoveDevice = async (reason: string) => {
    if (!selectedDevice) return;

    try {
      const response = await fetch(`${API_URL}/device-management-panel/${selectedDevice.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to remove device');
      }

      // Refresh device list
      await fetchDevices(statusFilter);
      await fetchStatistics();
    } catch (error) {
      console.error('Error removing device:', error);
      throw error;
    }
  };

  const openRemoveDialog = (deviceId: string, serialNumber: string) => {
    setSelectedDevice({ id: deviceId, serial: serialNumber });
    setRemoveDialogOpen(true);
  };

  const filteredDevices = devices.filter((device) => {
    if (statusFilter === 'all') return true;
    return device.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Device Management</h1>
          <p className="text-muted-foreground">
            Manage SecureBand devices, view status, and monitor health
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Device
        </Button>
      </div>

      {/* Device Statistics */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.total}</div>
            <p className="text-xs text-muted-foreground">
              Registered in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Signal className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.active}</div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
            <Signal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.offline}</div>
            <p className="text-xs text-muted-foreground">
              Not connected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Battery</CardTitle>
            <Battery className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.lowBattery}</div>
            <p className="text-xs text-muted-foreground">
              Below 20% charge
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revoked</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.revoked}</div>
            <p className="text-xs text-muted-foreground">
              Removed from system
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Device List */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Devices</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="revoked">Revoked</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {statusFilter === 'all'
                  ? 'All Devices'
                  : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) + ' Devices'}
              </CardTitle>
              <CardDescription>
                {statusFilter === 'all'
                  ? 'Complete list of all devices'
                  : `Devices with status: ${statusFilter}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="rounded-lg border p-8 text-center">
                  <p className="text-sm text-muted-foreground">Loading devices...</p>
                </div>
              ) : (
                <DeviceList devices={filteredDevices} onRemove={openRemoveDialog} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddDeviceDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddDevice}
      />

      {selectedDevice && (
        <RemoveDeviceDialog
          open={removeDialogOpen}
          onOpenChange={setRemoveDialogOpen}
          deviceSerial={selectedDevice.serial}
          onRemove={handleRemoveDevice}
        />
      )}
    </div>
  );
}
