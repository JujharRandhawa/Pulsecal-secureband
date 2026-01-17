'use client';

import { FileText, Search, Filter } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  severity: string;
  performedBy: string | null;
  createdAt: string;
  newValues: Record<string, any> | null;
  oldValues: Record<string, any> | null;
  metadata: Record<string, any> | null;
}

export function AuditLogView(): JSX.Element {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<{
    action?: string;
    resourceType?: string;
    severity?: string;
  }>({});

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter.action) params.append('action', filter.action);
      if (filter.resourceType) params.append('resourceType', filter.resourceType);
      if (filter.severity) params.append('severity', filter.severity);
      params.append('limit', '100');

      const response = await fetch(`${API_URL}/audit/logs?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : data.logs || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, any> = {
      critical: { variant: 'destructive' as const, className: 'bg-red-600' },
      high: { variant: 'destructive' as const, className: 'bg-orange-600' },
      medium: { variant: 'default' as const, className: 'bg-yellow-600' },
      low: { variant: 'secondary' as const, className: 'bg-blue-600' },
      info: { variant: 'outline' as const, className: '' },
    };
    const config = variants[severity] || variants.info;
    return (
      <Badge variant={config.variant} className={config.className}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatResourceId = (id: string) => {
    return id.slice(0, 8) + '...';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Audit Log
            </CardTitle>
            <CardDescription>Immutable record of all system changes</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filter.action || ''}
              onChange={(e) => setFilter({ ...filter, action: e.target.value || undefined })}
              className="px-3 py-1 text-xs border rounded bg-white"
              aria-label="Filter by action"
            >
              <option value="">All Actions</option>
              <option value="CREATE_DEVICE">Create Device</option>
              <option value="DELETE_DEVICE">Delete Device</option>
              <option value="DEVICE_BOUND">Device Bound</option>
              <option value="DEVICE_UNBOUND">Device Unbound</option>
            </select>
            <select
              value={filter.resourceType || ''}
              onChange={(e) => setFilter({ ...filter, resourceType: e.target.value || undefined })}
              className="px-3 py-1 text-xs border rounded bg-white"
              aria-label="Filter by resource type"
            >
              <option value="">All Resources</option>
              <option value="device">Device</option>
              <option value="inmate_device">Inmate Device</option>
              <option value="alert">Alert</option>
            </select>
            <select
              value={filter.severity || ''}
              onChange={(e) => setFilter({ ...filter, severity: e.target.value || undefined })}
              className="px-3 py-1 text-xs border rounded bg-white"
              aria-label="Filter by severity"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">No audit logs found</div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                tabIndex={0}
                role="article"
                aria-label={`Audit log entry ${log.action} on ${log.resourceType}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">{formatAction(log.action)}</span>
                      <Badge variant="outline" className="text-xs">
                        {log.resourceType}
                      </Badge>
                      {getSeverityBadge(log.severity)}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Resource ID: {formatResourceId(log.resourceId)}</div>
                      {log.performedBy && <div>Performed by: {formatResourceId(log.performedBy)}</div>}
                      {log.oldValues && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-xs">
                          <div className="font-medium mb-1">Previous Values:</div>
                          <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(log.oldValues, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.newValues && (
                        <div className="mt-2 p-2 bg-green-50 rounded text-xs">
                          <div className="font-medium mb-1">New Values:</div>
                          <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(log.newValues, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    {formatTime(log.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
