# Device Management - Automatic Streaming

Automatic data ingestion pipeline that starts streaming immediately after SecureBand binding.

## Overview

When a SecureBand is bound to an inmate, the system automatically:
1. ✅ Starts data streaming
2. ✅ Creates data stream pipeline
3. ✅ Begins monitoring device health
4. ✅ Updates dashboard in real-time
5. ✅ Handles reconnections gracefully
6. ✅ Stops streaming when device is removed
7. ✅ Marks device offline if silent

## Components

### DeviceBindingService
- **bindDevice()**: Binds device to inmate and automatically starts streaming
- **unbindDevice()**: Unbinds device and stops streaming
- **handleReconnection()**: Handles device reconnection after being offline

### DeviceStreamingService
- **startStreaming()**: Registers device for streaming
- **stopStreaming()**: Unregisters device from streaming
- **isStreaming()**: Checks if device is actively streaming
- **updateLastDataReceived()**: Updates last data received timestamp

### DeviceHealthMonitor
- **registerDevice()**: Registers device for health monitoring
- **unregisterDevice()**: Unregisters device from monitoring
- **updateLastSeen()**: Updates last seen timestamp
- **checkDeviceHealth()**: Periodic health checks (every minute)
- **markDeviceOffline()**: Marks device as offline if silent for 5+ minutes

## Data Flow

```
1. Device Bound to Inmate
   ↓
2. DeviceBindingService.bindDevice()
   ├─ Create InmateDevice assignment
   ├─ Update device status to 'active'
   └─ Start streaming (automatic)
       ↓
3. DeviceStreamingService.startStreaming()
   ├─ Register device in active streams
   └─ Register with health monitor
       ↓
4. Device Begins Sending Data
   ↓
5. Ingestion Service Receives Data
   ├─ Check if device is streaming
   ├─ Handle reconnection if needed
   ├─ Update last data received
   └─ Process and store metrics
       ↓
6. Real-time Updates
   ├─ WebSocket events emitted
   └─ Dashboard updates instantly
```

## Reconnection Logic

When a device sends data after being offline:

1. **Ingestion Service** receives data
2. **Checks streaming status** - if not streaming, calls `handleReconnection()`
3. **DeviceBindingService** checks for active assignment
4. **If assigned**: Resumes streaming automatically
5. **If not assigned**: Data is still ingested but not streamed

## Device Removal

When device is unbound:

1. **DeviceBindingService.unbindDevice()** called
2. **Stop streaming** - removes from active streams
3. **Unregister from health monitor**
4. **Update assignment** - mark as unassigned
5. **Update device status** - mark as 'inventory'
6. **Streaming stops** - no more data processing

## Silent Device Detection

Health monitor checks devices every minute:

1. **Calculate time since last seen**
2. **If > 5 minutes**: Mark device as offline
3. **Create offline status record**
4. **Emit WebSocket event** - notify dashboard
5. **Device remains in streaming** - will resume when data arrives

## API Endpoints

### Bind Device
```http
POST /device-management/bind
Content-Type: application/json

{
  "inmateId": "uuid",
  "deviceId": "uuid",
  "assignmentReason": "Optional reason"
}
```

### Unbind Device
```http
DELETE /device-management/unbind/:inmateDeviceId
```

### Get Active Streams
```http
POST /device-management/streaming/active
```

### Get Stream Info
```http
POST /device-management/streaming/:deviceId
```

## Integration Points

### Ingestion Service
- Checks device streaming status on data receipt
- Handles reconnection automatically
- Updates streaming service timestamps

### Event Pipeline
- Processes metrics from streaming devices
- Creates alerts based on streaming data
- Triggers AI analysis

### Real-time Gateway
- Emits WebSocket events for streaming devices
- Updates dashboard instantly
- Shows connection status

## Configuration

### Silent Threshold
- Default: 5 minutes
- Configurable via `SILENT_THRESHOLD_MS`

### Health Check Interval
- Default: 1 minute
- Configurable via `CHECK_INTERVAL_MS`

## Behavior

### Automatic Start
- ✅ No manual start button needed
- ✅ Streaming begins immediately on binding
- ✅ Dashboard updates instantly

### Automatic Stop
- ✅ Streaming stops on unbinding
- ✅ Device marked as offline if silent
- ✅ Health monitor unregisters device

### Reconnection
- ✅ Automatic resume when data arrives
- ✅ No manual intervention needed
- ✅ Seamless recovery

## Example Flow

```typescript
// 1. Bind device (automatic streaming starts)
const assignment = await deviceBindingService.bindDevice({
  inmateId: 'inmate-123',
  deviceId: 'device-456',
  assignmentReason: 'New assignment',
});
// Streaming started automatically!

// 2. Device sends data
await ingestionService.ingestPpgData({
  deviceSerial: 'DEV-456',
  heartRate: 72,
  // ... other data
});
// Data processed, dashboard updates instantly

// 3. Device goes offline (silent for 5+ minutes)
// Health monitor marks as offline automatically
// WebSocket event sent to dashboard

// 4. Device reconnects (sends data again)
await ingestionService.ingestPpgData({...});
// Reconnection handled automatically
// Streaming resumes, dashboard updates

// 5. Unbind device
await deviceBindingService.unbindDevice({
  inmateDeviceId: assignment.id,
});
// Streaming stopped automatically
```
