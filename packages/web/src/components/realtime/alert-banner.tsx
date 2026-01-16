'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWebSocket, AlertEvent } from '@/hooks/use-websocket';
import { cn } from '@/lib/utils';

interface AlertBannerProps {
  maxAlerts?: number;
  autoDismiss?: boolean;
  dismissTimeout?: number;
}

export function AlertBanner({
  maxAlerts = 5,
  autoDismiss = false,
  dismissTimeout = 10000,
}: AlertBannerProps) {
  const { socket, isConnected, subscribeAlerts, unsubscribeAlerts } =
    useWebSocket();
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);

  useEffect(() => {
    if (isConnected && socket) {
      subscribeAlerts();

      const handleAlertCreated = (event: AlertEvent) => {
        setAlerts((prev) => {
          // Add new alert at the beginning
          const newAlerts = [event, ...prev];
          // Keep only last N alerts
          return newAlerts.slice(0, maxAlerts);
        });

        // Auto-dismiss after timeout if enabled
        if (autoDismiss) {
          setTimeout(() => {
            setAlerts((prev) => prev.filter((a) => a.alertId !== event.alertId));
          }, dismissTimeout);
        }
      };

      socket.on('alert:created', handleAlertCreated);

      return () => {
        socket.off('alert:created', handleAlertCreated);
        unsubscribeAlerts();
      };
    }
  }, [
    socket,
    isConnected,
    maxAlerts,
    autoDismiss,
    dismissTimeout,
    subscribeAlerts,
    unsubscribeAlerts,
  ]);

  const dismissAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.alertId !== alertId));
  };

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-16 right-6 z-50 space-y-2 max-w-md">
      {alerts.map((alert) => {
        const severityVariant =
          alert.severity === 'critical'
            ? 'critical'
            : alert.severity === 'high'
              ? 'destructive'
              : alert.severity === 'medium'
                ? 'warning'
                : 'default';

        return (
          <div
            key={alert.alertId}
            className={cn(
              'flex items-start gap-3 rounded-lg border bg-card p-4 shadow-lg',
              'animate-in slide-in-from-right-5',
            )}
          >
            <AlertCircle
              className={cn(
                'h-5 w-5 mt-0.5',
                alert.severity === 'critical' && 'text-red-600',
                alert.severity === 'high' && 'text-orange-600',
                alert.severity === 'medium' && 'text-yellow-600',
                alert.severity === 'low' && 'text-blue-600',
              )}
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={severityVariant}>{alert.severity}</Badge>
                <span className="text-sm font-medium">{alert.alertType}</span>
              </div>
              <p className="text-sm text-muted-foreground">{alert.description}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(alert.triggeredAt).toLocaleString()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => dismissAlert(alert.alertId)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
