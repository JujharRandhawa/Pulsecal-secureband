# Real-time WebSocket Module

WebSocket gateway for real-time data visualization and live updates.

## Architecture

```
Ingestion → RealtimeEmitter → RealtimeGateway → WebSocket → Frontend
Alert Creation → RealtimeEmitter → RealtimeGateway → WebSocket → Frontend
```

## Components

### RealtimeGateway
- WebSocket server using Socket.IO
- Namespace: `/realtime`
- Handles client connections/disconnections
- Manages subscriptions
- Emits events to connected clients

### RealtimeEmitterService
- Service layer to avoid circular dependencies
- Provides methods to emit events
- Used by ingestion and alert services

## Events

### Client → Server
- `subscribe:vitals` - Subscribe to vital metrics
- `unsubscribe:vitals` - Unsubscribe from vital metrics
- `subscribe:alerts` - Subscribe to alerts
- `unsubscribe:alerts` - Unsubscribe from alerts
- `subscribe:device-status` - Subscribe to device status
- `unsubscribe:device-status` - Unsubscribe from device status

### Server → Client
- `vital:metric` - Vital metric update
- `alert:created` - New alert created
- `alert:updated` - Alert status updated
- `device:status` - Device status update
- `connection:status` - Connection status change

## Integration Points

### Ingestion Service
- Emits `vital:metric` when vital metrics are ingested
- Emits `device:status` when device status is updated

### Alert Service
- Emits `alert:created` when new alerts are created
- Emits `alert:updated` when alerts are updated

## Frontend Usage

```typescript
import { useWebSocket } from '@/hooks/use-websocket';

const { socket, isConnected, subscribeVitals, subscribeAlerts } = useWebSocket();

useEffect(() => {
  if (isConnected) {
    subscribeVitals();
    subscribeAlerts();
    
    socket?.on('vital:metric', (data) => {
      // Handle vital metric
    });
    
    socket?.on('alert:created', (data) => {
      // Handle new alert
    });
  }
}, [isConnected, socket]);
```

## Configuration

WebSocket gateway uses the same CORS configuration as the REST API.

## Connection Handling

- Automatic reconnection on disconnect
- Connection status events
- Graceful error handling
- Subscription management

## Performance

- Broadcasts to all connected clients
- No filtering (all clients receive all events)
- Can be optimized with rooms/namespaces if needed
