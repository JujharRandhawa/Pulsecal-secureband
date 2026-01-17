'use client';

import { AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Alert {
  id: string;
  deviceId: string;
  alertType: string;
  severity: string;
  status: string;
  description: string | null;
  explanation: string | null;
  confidence: number | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  deviceSerial?: string;
}

export function AlertsPanel(): JSX.Element {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'acknowledged' | 'resolved'>('open');

  const fetchAlerts = useCallback(async () => {
    try {
      const statusParam = filter === 'all' ? '' : `&status=${filter}`;
      const response = await fetch(`${API_URL}/alerts?limit=100${statusParam}`);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      const data = await response.json();
      setAlerts(Array.isArray(data) ? data : data.alerts || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      const response = await fetch(`${API_URL}/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to acknowledge alert');
      await fetchAlerts();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      alert('Failed to acknowledge alert. Please try again.');
    }
  };

  const handleResolve = async (alertId: string, notes?: string) => {
    try {
      const response = await fetch(`${API_URL}/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionNotes: notes || 'Resolved via dashboard' }),
      });
      if (!response.ok) throw new Error('Failed to resolve alert');
      await fetchAlerts();
    } catch (error) {
      console.error('Error resolving alert:', error);
      alert('Failed to resolve alert. Please try again.');
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, any> = {
      critical: { variant: 'destructive' as const, className: 'bg-red-600' },
      high: { variant: 'destructive' as const, className: 'bg-orange-600' },
      medium: { variant: 'default' as const, className: 'bg-yellow-600' },
      low: { variant: 'secondary' as const, className: 'bg-blue-600' },
    };
    const config = variants[severity] || variants.medium;
    return (
      <Badge variant={config.variant} className={config.className}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'acknowledged':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAlertType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const filteredAlerts = alerts.sort((a, b) => {
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const severityDiff = (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
    if (severityDiff !== 0) return severityDiff;
    return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime();
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alerts
            </CardTitle>
            <CardDescription>Monitor and manage system alerts</CardDescription>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs rounded ${
                filter === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              aria-label="Show all alerts"
            >
              All
            </button>
            <button
              onClick={() => setFilter('open')}
              className={`px-3 py-1 text-xs rounded ${
                filter === 'open'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              aria-label="Show open alerts"
            >
              Open
            </button>
            <button
              onClick={() => setFilter('acknowledged')}
              className={`px-3 py-1 text-xs rounded ${
                filter === 'acknowledged'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              aria-label="Show acknowledged alerts"
            >
              Acknowledged
            </button>
            <button
              onClick={() => setFilter('resolved')}
              className={`px-3 py-1 text-xs rounded ${
                filter === 'resolved'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              aria-label="Show resolved alerts"
            >
              Resolved
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Loading alerts...</div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">No alerts found</div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="border rounded-lg p-4 space-y-3 hover:bg-gray-50 transition-colors"
                tabIndex={0}
                role="article"
                aria-label={`Alert ${alert.alertType} ${alert.severity}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {getStatusIcon(alert.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{formatAlertType(alert.alertType)}</span>
                        {getSeverityBadge(alert.severity)}
                        {alert.confidence !== null && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(alert.confidence * 100)}% confidence
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {alert.deviceSerial || `Device ${alert.deviceId.slice(0, 8)}`}
                      </div>
                      {alert.description && (
                        <div className="text-sm text-gray-900 mb-1">{alert.description}</div>
                      )}
                      {alert.explanation && (
                        <div className="text-xs text-muted-foreground italic">{alert.explanation}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    {formatTime(alert.triggeredAt)}
                  </div>
                </div>

                {alert.status === 'open' && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAcknowledge(alert.id)}
                      className="flex-1"
                      aria-label={`Acknowledge alert ${alert.id}`}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Acknowledge
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleResolve(alert.id)}
                      className="flex-1"
                      aria-label={`Resolve alert ${alert.id}`}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Resolve
                    </Button>
                  </div>
                )}

                {alert.status === 'acknowledged' && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <div className="text-xs text-muted-foreground">
                      Acknowledged {alert.acknowledgedAt && formatTime(alert.acknowledgedAt)}
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleResolve(alert.id)}
                      className="ml-auto"
                      aria-label={`Resolve alert ${alert.id}`}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Resolve
                    </Button>
                  </div>
                )}

                {alert.status === 'resolved' && alert.resolvedAt && (
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Resolved {formatTime(alert.resolvedAt)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
