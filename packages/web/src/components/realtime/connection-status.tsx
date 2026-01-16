'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useWebSocket } from '@/hooks/use-websocket';

export function ConnectionStatus() {
  const { isConnected } = useWebSocket();

  return (
    <Badge
      variant={isConnected ? 'success' : 'destructive'}
      className="flex items-center gap-1.5"
    >
      {isConnected ? (
        <>
          <Wifi className="h-3 w-3" />
          Connected
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Disconnected
        </>
      )}
    </Badge>
  );
}
