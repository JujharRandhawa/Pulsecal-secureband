# SecureBand Data Pipeline Optimization

This document describes the optimized and finalized SecureBand data ingestion pipeline with robust validation, sequence tracking, and heartbeat monitoring.

## Overview

The data pipeline has been enhanced with:
- **Packet validation** - Comprehensive validation of all incoming data
- **Sequence tracking** - Detection of missing and delayed packets
- **Timestamp correction** - Automatic correction of clock skew and future dates
- **Raw data separation** - Raw sensor data stored separately from AI inferences
- **Heartbeat monitoring** - Enhanced device heartbeat tracking and offline detection

## Architecture

```
Device → DeviceAuthGuard → IngestionController → PacketValidator → IngestionService
                                                      ↓
                                              Validation Results
                                                      ↓
                                              Timestamp Correction
                                                      ↓
                                              Sequence Tracking
                                                      ↓
                                              Store Raw Data
                                                      ↓
                                              Update Health Monitor
                                                      ↓
                                              Publish Event (AI Analysis)
```

## 1. Packet Validation

### Validation Service (`PacketValidatorService`)

Validates all incoming packets before storage:

#### Device Validation
- Verifies device exists in database
- Checks device is not revoked
- Warns if device status is not active

#### Timestamp Validation
- **Future timestamp detection**: Flags timestamps > 1 minute in future
- **Clock skew detection**: Warns if timestamp > 5 minutes old
- **Network delay detection**: Warns if delay > 10 seconds
- **Automatic correction**: Uses server time for future timestamps

#### Data Range Validation
- **Heart rate**: 0-250 bpm
- **Temperature**: 30-45°C (warns on unusual values)
- **Oxygen saturation**: 0-100%
- **Blood pressure**: Systolic 50-250, Diastolic 30-150
- **Battery level**: 0-100%
- **Coordinates**: Valid numeric values

#### Sequence Validation
- Detects duplicate packets
- Detects out-of-order (delayed) packets
- Detects missing packets (gaps in sequence)
- Tracks sequence numbers per device

## 2. Sequence Tracking

### Packet Sequence Entity

Stores sequence information for each packet:

```typescript
{
  deviceId: string;
  sequenceNumber: number;
  recordedAt: Date;
  receivedAt: Date;
  status: 'received' | 'missing' | 'delayed' | 'duplicate';
  expectedSequence?: number;
  delayMs?: number;
}
```

### Missing Packet Detection

- **Gap detection**: Identifies gaps in sequence numbers
- **Gap alerting**: Alerts if gap > 100 packets
- **Gap recording**: Records all missing sequences in database
- **Statistics**: Provides missing packet statistics per device

### Delayed Packet Handling

- **Out-of-order detection**: Identifies packets arriving out of order
- **Delay calculation**: Calculates delay in milliseconds
- **Metadata storage**: Stores delay information for analysis

### Duplicate Packet Detection

- **Duplicate detection**: Identifies packets with same sequence number
- **Warning logging**: Logs warnings for duplicate packets
- **Tracking**: Records duplicates for network quality analysis

## 3. Timestamp Accuracy

### Timestamp Correction

The pipeline automatically corrects timestamps:

1. **Future timestamps**: Replaced with server time
2. **Clock skew**: Warns but preserves original timestamp
3. **Network delay**: Calculates and logs delay

### Timestamp Validation Rules

| Condition | Action | Example |
|-----------|--------|---------|
| Future > 1 min | Use server time | Device clock 2 min ahead |
| Past > 5 min | Warn, keep original | Delayed packet |
| Network delay > 10s | Warn | Slow network |

### Corrected Timestamp Usage

All stored metrics use corrected timestamps:
- `VitalMetric.recordedAt` - Uses corrected timestamp
- `LocationMetric.recordedAt` - Uses corrected timestamp
- `DeviceStatus.recordedAt` - Uses corrected timestamp

## 4. Raw Data Storage

### Data Separation

Raw sensor data is stored separately from AI inferences:

#### Raw Data Tables
- **`vital_metrics`** - Raw vital signs (heart rate, temperature, SpO2, BP)
- **`location_metrics`** - Raw location data (IMU coordinates)
- **`device_status`** - Raw device status (heartbeat, battery, signal)

#### AI Analysis Table
- **`ai_analyses`** - AI inference results (separate table)
  - Links to metrics via `metricId`
  - Stores analysis type, results, confidence scores
  - Includes explainable outputs

### Raw Data Schema

```typescript
// Raw sensor data (vital_metrics)
{
  deviceId: string;
  recordedAt: Date;  // Corrected timestamp
  heartRate: number | null;
  temperatureCelsius: number | null;
  oxygenSaturation: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  batteryLevel: number | null;
  signalStrength: number | null;
  additionalMetrics: {
    sequenceNumber?: number;
    validationWarnings?: string[];
    sequenceStatus?: string;
  }
}

// AI analysis (ai_analyses) - Separate table
{
  metricId: string;  // Reference to raw metric
  analysisType: 'signal_quality' | 'anomaly_detection' | 'risk_scoring';
  results: Record<string, any>;
  confidence: number;
  qualityScore: number;
  explanation: string;
}
```

## 5. Heartbeat Monitoring

### Enhanced Health Monitor

The `DeviceHealthMonitor` has been enhanced with:

#### Health Status Types
- **ONLINE**: Data received within 2 minutes
- **DEGRADED**: No data for 2-5 minutes
- **OFFLINE**: No data for 5+ minutes
- **UNKNOWN**: Device not registered for monitoring

#### Heartbeat Tracking
- **Last seen timestamp**: Updated on every data packet
- **Health check interval**: Every 30 seconds
- **Automatic registration**: Devices auto-register when data received

#### Offline Detection
- **Threshold**: 5 minutes without data
- **Alert creation**: Creates alerts with 15-minute cooldown
- **WebSocket notifications**: Real-time UI updates
- **Automatic resolution**: Resolves alerts on reconnection

### Heartbeat Flow

```
Device sends data
    ↓
IngestionService.ingestDeviceStatus()
    ↓
PacketValidator.validatePacket()
    ↓
Store raw status
    ↓
DeviceHealthMonitor.updateLastSeen()
    ↓
Check health status
    ↓
Mark offline if threshold exceeded
    ↓
Create alert (if needed)
    ↓
Emit WebSocket event
```

## 6. Missing/Delayed Packet Handling

### Handling Strategy

#### Missing Packets
1. **Detection**: Gap in sequence numbers detected
2. **Recording**: Missing sequences recorded in `packet_sequences` table
3. **Alerting**: Large gaps (>100 packets) trigger warnings
4. **Statistics**: Missing packet stats available via API

#### Delayed Packets
1. **Detection**: Out-of-order sequence numbers
2. **Recording**: Delayed status recorded with delay time
3. **Storage**: Packet stored with original timestamp (not corrected)
4. **Analysis**: Delay metrics available for network quality analysis

#### Duplicate Packets
1. **Detection**: Same sequence number received twice
2. **Warning**: Warning logged
3. **Storage**: Duplicate status recorded
4. **Handling**: Original packet kept, duplicate flagged

### Packet Sequence Statistics

```typescript
// Get missing packet statistics
const stats = await packetValidator.getMissingPacketsStats(
  deviceId,
  startTime,
  endTime
);

// Returns:
{
  totalMissing: number;
  totalDelayed: number;
  totalDuplicate: number;
  gaps: Array<{
    start: number;
    end: number;
    count: number;
  }>;
}
```

## 7. Data Flow

### Complete Ingestion Flow

```
1. Device sends packet with sequence number
   ↓
2. DeviceAuthGuard validates device token
   ↓
3. IngestionController receives packet
   ↓
4. PacketValidator validates:
   - Device exists and active
   - Timestamp valid (corrects if needed)
   - Sequence number (detects missing/delayed)
   - Data ranges
   ↓
5. IngestionService stores raw data:
   - Uses corrected timestamp
   - Stores validation metadata
   - Stores sequence information
   ↓
6. DeviceHealthMonitor updates:
   - Last seen timestamp
   - Health status
   - Offline detection
   ↓
7. EventPublisher publishes event:
   - For AI analysis (separate process)
   - For real-time updates
   ↓
8. RealtimeEmitter sends WebSocket:
   - Real-time UI updates
   - Alert notifications
```

## 8. Error Handling

### Graceful Degradation

The pipeline handles errors gracefully:

1. **Validation errors**: Reject packet, log error, continue processing
2. **Storage errors**: Log error, don't crash pipeline
3. **Event publishing errors**: Log warning, continue ingestion
4. **WebSocket errors**: Log warning, don't fail ingestion

### Error Types

| Error Type | Handling | Impact |
|------------|----------|--------|
| Invalid device | Reject packet | No data stored |
| Invalid timestamp | Correct and warn | Data stored with correction |
| Missing sequence | Record gap, warn | Data stored, gap tracked |
| Delayed packet | Record delay, warn | Data stored, delay tracked |
| Storage failure | Log error, retry | Packet lost (logged) |
| Event publish failure | Log warning | No AI analysis triggered |

## 9. Performance Optimizations

### Batch Processing
- Batch size: 500 records per batch
- Parallel processing: Multiple batches processed concurrently
- Transaction management: Batches use transactions for consistency

### Memory Management
- Sequence tracking: In-memory cache with periodic cleanup
- Window size: Last 1000 sequences per device tracked
- Cleanup interval: Every 60 seconds

### Database Optimization
- Indexes: Optimized indexes on deviceId, recordedAt, sequenceNumber
- Partitioning: Time-series tables partitioned by date
- Batch inserts: Bulk inserts for better performance

## 10. Monitoring and Observability

### Metrics Tracked

- **Packet validation rate**: Success/failure ratio
- **Missing packet count**: Per device, per time period
- **Delayed packet count**: Per device, per time period
- **Timestamp corrections**: Count of corrected timestamps
- **Offline device count**: Devices marked offline
- **Health status distribution**: Online/degraded/offline counts

### Logging

- **Validation warnings**: Logged for analysis
- **Sequence gaps**: Logged with gap details
- **Timestamp corrections**: Logged with correction reason
- **Offline events**: Logged with duration
- **Error events**: Logged with full stack traces

## 11. API Endpoints

### Ingestion Endpoints

All endpoints require `DeviceAuthGuard`:

- `POST /ingestion/ppg` - Ingest PPG data
- `POST /ingestion/temperature` - Ingest temperature data
- `POST /ingestion/imu` - Ingest IMU data
- `POST /ingestion/status` - Ingest device status (heartbeat)
- `POST /ingestion/batch` - Batch ingestion

### Validation Metadata

All DTOs now support optional `sequenceNumber`:

```typescript
{
  deviceSerial: string;
  recordedAt: string;
  sequenceNumber?: number;  // Optional, for sequence tracking
  // ... other fields
}
```

## 12. Configuration

### Environment Variables

```bash
# Timestamp validation
MAX_TIMESTAMP_DRIFT_MS=300000  # 5 minutes
MAX_FUTURE_TIMESTAMP_MS=60000  # 1 minute

# Sequence tracking
MAX_SEQUENCE_GAP=100           # Alert threshold
SEQUENCE_WINDOW_SIZE=1000      # In-memory window

# Health monitoring
SILENT_THRESHOLD_MS=300000     # 5 minutes (offline)
DEGRADED_THRESHOLD_MS=120000  # 2 minutes (degraded)
CHECK_INTERVAL_MS=30000        # 30 seconds
ALERT_COOLDOWN_MS=900000       # 15 minutes
```

## 13. Testing

### Test Scenarios

1. **Valid packet**: Should be stored successfully
2. **Invalid device**: Should be rejected
3. **Future timestamp**: Should be corrected
4. **Missing sequence**: Should detect gap
5. **Delayed packet**: Should detect out-of-order
6. **Duplicate packet**: Should detect duplicate
7. **Offline device**: Should mark offline after timeout
8. **Reconnection**: Should mark online and resolve alert

## 14. Future Enhancements

1. **Packet retransmission**: Request missing packets from device
2. **Adaptive thresholds**: Adjust thresholds based on network quality
3. **Compression**: Compress old sequence data
4. **Analytics**: Advanced analytics on packet loss patterns
5. **ML-based anomaly detection**: Detect unusual packet patterns

---

**Last Updated**: 2026-01-15
**Version**: 2.0.0
