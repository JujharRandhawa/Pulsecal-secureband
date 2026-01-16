# Real-time Data Visualization - Implementation Summary

## Overview

WebSocket-based real-time data visualization has been implemented for PulseCal SecureBand, enabling live updates for vital metrics, alerts, and device status.

## What Was Implemented

### Backend (NestJS) ✅

1. **WebSocket Gateway**
   - Socket.IO integration
   - Namespace: `/realtime`
   - Connection/disconnection handling
   - Subscription management
   - Event broadcasting

2. **RealtimeEmitterService**
   - Service layer to avoid circular dependencies
   - Provides clean API for emitting events
   - Used by ingestion and alert services

3. **Event Integration**
   - Vital metrics emitted on ingestion
   - Alerts emitted on creation/update
   - Device status emitted on status updates

### Frontend (Next.js) ✅

1. **WebSocket Hook (`useWebSocket`)**
   - Connection management
   - Automatic reconnection with exponential backoff
   - Subscription methods
   - Connection status tracking

2. **VitalChart Component**
   - Real-time line charts using Recharts
   - Supports heart rate, temperature, oxygen saturation
   - Configurable data point limits
   - Device filtering support

3. **AlertBanner Component**
   - Toast-style notifications
   - Severity-based styling
   - Auto-dismiss option
   - Manual dismiss

4. **ConnectionStatus Component**
   - Visual connection indicator
   - Badge component

5. **Live Overview Integration**
   - Real-time charts added
   - Alert banner integrated
   - Connection status in header

## File Structure

### Backend
```
packages/api/src/realtime/
├── types/
│   └── realtime.types.ts      # Event type definitions
├── services/
│   └── realtime-emitter.service.ts  # Event emitter service
├── realtime.gateway.ts        # WebSocket gateway
├── realtime.module.ts         # Module configuration
└── README.md                  # Documentation
```

### Frontend
```
packages/web/src/
├── hooks/
│   └── use-websocket.ts      # WebSocket hook
└── components/
    └── realtime/
        ├── vital-chart.tsx    # Chart component
        ├── alert-banner.tsx   # Alert notifications
        └── connection-status.tsx  # Status indicator
```

## WebSocket Events

### Client Events
- `subscribe:vitals` - Subscribe to vital metrics
- `unsubscribe:vitals` - Unsubscribe from vital metrics
- `subscribe:alerts` - Subscribe to alerts
- `unsubscribe:alerts` - Unsubscribe from alerts
- `subscribe:device-status` - Subscribe to device status
- `unsubscribe:device-status` - Unsubscribe from device status

### Server Events
- `vital:metric` - Vital metric update
- `alert:created` - New alert created
- `alert:updated` - Alert status updated
- `device:status` - Device status update
- `connection:status` - Connection status change

## Dependencies Added

### Backend
- `@nestjs/websockets` - WebSocket support
- `@nestjs/platform-socket.io` - Socket.IO adapter
- `socket.io` - WebSocket library (peer dependency)

### Frontend
- `socket.io-client` - WebSocket client
- `recharts` - Chart library

## Connection Flow

1. **Client connects** → WebSocket gateway
2. **Client subscribes** → To specific event types
3. **Backend emits** → Events on data ingestion/alert creation
4. **Client receives** → Real-time updates
5. **Client visualizes** → Charts and alerts update automatically

## Reconnection Logic

- **Automatic**: Reconnects on disconnect
- **Backoff**: Exponential (configurable, default 3s)
- **Max Attempts**: Configurable (default 10)
- **Status Events**: Client notified of connection changes

## Graceful Disconnect Handling

- Connection status tracking
- Automatic cleanup on unmount
- Subscription management
- Error logging

## Usage Example

### Backend (Automatic)
Events are automatically emitted when:
- Metrics are ingested
- Alerts are created
- Device status changes

### Frontend
```tsx
import { VitalChart } from '@/components/realtime/vital-chart';
import { AlertBanner } from '@/components/realtime/alert-banner';

// In your page/component
<VitalChart metricType="heartRate" />
<AlertBanner maxAlerts={5} />
```

## Configuration

### Environment Variables

**Backend:**
- Uses same CORS configuration as REST API
- WebSocket port: Same as HTTP port (3001)

**Frontend:**
- `NEXT_PUBLIC_API_URL` - API base URL (default: http://localhost:3001)
- WebSocket automatically connects to `/realtime` namespace

## Performance Considerations

- Events broadcast to all connected clients
- No filtering (can be optimized with rooms if needed)
- Chart components limit data points (default: 50)
- Alert banner limits displayed alerts (default: 5)

## Testing

```bash
# Start backend
cd packages/api
pnpm start:dev

# Start frontend
cd packages/web
pnpm dev

# Ingest test data (triggers WebSocket events)
curl -X POST http://localhost:3001/ingestion/ppg \
  -H "Content-Type: application/json" \
  -d '{
    "deviceSerial": "DEV-001",
    "recordedAt": "2024-01-15T10:30:00Z",
    "heartRate": 150
  }'
```

## Future Enhancements

- [ ] Room-based subscriptions (filter by device/facility)
- [ ] WebSocket authentication
- [ ] Rate limiting per client
- [ ] Message queuing for offline clients
- [ ] Compression for large payloads
- [ ] Metrics dashboard for WebSocket connections
