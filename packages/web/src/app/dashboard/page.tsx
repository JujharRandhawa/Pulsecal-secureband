'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DeviceStatusIndicators } from '@/components/dashboard/device-status-indicators';
import { RealtimeVitalsView } from '@/components/dashboard/realtime-vitals-view';
import { HistoricalCharts } from '@/components/dashboard/historical-charts';
import { AlertsPanel } from '@/components/dashboard/alerts-panel';
import { AuditLogView } from '@/components/dashboard/audit-log-view';
import { Activity, AlertTriangle, TrendingUp, FileText } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface DashboardStats {
  totalDevices: number;
  activeDevices: number;
  offlineDevices: number;
  openAlerts: number;
  criticalAlerts: number;
}

export default function DashboardPage(): JSX.Element {
  const [stats, setStats] = useState<DashboardStats>({
    totalDevices: 0,
    activeDevices: 0,
    offlineDevices: 0,
    openAlerts: 0,
    criticalAlerts: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchStats = useCallback(async () => {
    try {
      const [devicesRes, alertsRes] = await Promise.all([
        fetch(`${API_URL}/device-management-panel/statistics`),
        fetch(`${API_URL}/alerts?status=open&limit=100`),
      ]);

      if (devicesRes.ok) {
        const devicesData = await devicesRes.json();
        setStats((prev) => ({
          ...prev,
          totalDevices: devicesData.total || 0,
          activeDevices: devicesData.active || 0,
          offlineDevices: devicesData.offline || 0,
        }));
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        const alerts = Array.isArray(alertsData) ? alertsData : alertsData.alerts || [];
        setStats((prev) => ({
          ...prev,
          openAlerts: alerts.length,
          criticalAlerts: alerts.filter((a: any) => a.severity === 'critical').length,
        }));
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">SecureBand Monitoring & Management</p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-sm">
                <Activity className="mr-1 h-3 w-3" />
                Live
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '...' : stats.totalDevices}</div>
              <p className="text-xs text-muted-foreground">Registered SecureBands</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {isLoading ? '...' : stats.activeDevices}
              </div>
              <p className="text-xs text-muted-foreground">Currently connected</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offline</CardTitle>
              <Activity className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">
                {isLoading ? '...' : stats.offlineDevices}
              </div>
              <p className="text-xs text-muted-foreground">Not connected</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {isLoading ? '...' : stats.openAlerts}
              </div>
              <p className="text-xs text-muted-foreground">Requiring attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {isLoading ? '...' : stats.criticalAlerts}
              </div>
              <p className="text-xs text-muted-foreground">Immediate action</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="vitals" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Vitals</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Audit Log</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <DeviceStatusIndicators />
              <RealtimeVitalsView />
            </div>
            <HistoricalCharts />
          </TabsContent>

          <TabsContent value="vitals" className="space-y-4">
            <RealtimeVitalsView />
            <HistoricalCharts />
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <AlertsPanel />
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <AuditLogView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
