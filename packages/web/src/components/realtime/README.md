# Real-time Components

Components for real-time data visualization and WebSocket integration.

## Components

### `useWebSocket` Hook
- WebSocket connection management
- Automatic reconnection
- Subscription management
- Connection status tracking

### `VitalChart`
- Real-time line charts for vital metrics
- Supports heart rate, temperature, oxygen saturation
- Configurable data point limits
- Device filtering

### `AlertBanner`
- Toast-style alert notifications
- Severity-based styling
- Auto-dismiss option
- Manual dismiss

### `ConnectionStatus`
- Visual connection indicator
- Badge component
- Shows connected/disconnected state

## Usage Examples

### Basic WebSocket Connection

```tsx
import { useWebSocket } from '@/hooks/use-websocket';

function MyComponent() {
  const { isConnected, socket } = useWebSocket();
  
  useEffect(() => {
    if (socket) {
      socket.on('vital:metric', (data) => {
        console.log('Vital metric:', data);
      });
    }
  }, [socket]);
  
  return <div>Connected: {isConnected ? 'Yes' : 'No'}</div>;
}
```

### Vital Chart

```tsx
import { VitalChart } from '@/components/realtime/vital-chart';

<VitalChart 
  metricType="heartRate" 
  deviceId="device-123"
  maxDataPoints={50}
/>
```

### Alert Banner

```tsx
import { AlertBanner } from '@/components/realtime/alert-banner';

<AlertBanner 
  maxAlerts={5}
  autoDismiss={true}
  dismissTimeout={10000}
/>
```

## Reconnection Logic

- Automatic reconnection on disconnect
- Exponential backoff (configurable)
- Max reconnection attempts
- Connection status events

## Chart Library

Uses Recharts for visualization:
- Responsive charts
- Real-time updates
- Tooltips and legends
- Customizable styling
