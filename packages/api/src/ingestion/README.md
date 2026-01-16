# Device Data Ingestion Pipeline

High-performance ingestion pipeline for device data from BLE gateways.

## Overview

The ingestion pipeline receives JSON payloads from BLE gateways containing:
- **PPG Data**: Heart rate, oxygen saturation, blood pressure
- **Temperature Data**: Body temperature readings
- **IMU Data**: Position tracking (x, y, z coordinates)
- **Device Status**: Connection health, battery level, signal strength

## Architecture

- **Async Processing**: Endpoints return immediately (HTTP 202 Accepted) and process data asynchronously
- **Batch Insertion**: Data is inserted in batches of 500 records for optimal performance
- **Device Lookup Caching**: Device serial numbers are cached for 5 minutes to reduce database queries
- **Error Handling**: Comprehensive error handling with detailed logging

## API Endpoints

### POST `/ingestion/ppg`

Ingest PPG (photoplethysmography) data.

**Request Body:**
```json
{
  "deviceSerial": "DEV-001",
  "recordedAt": "2024-01-15T10:30:00Z",
  "heartRate": 72,
  "oxygenSaturation": 98,
  "bloodPressureSystolic": 120,
  "bloodPressureDiastolic": 80,
  "batteryLevel": 85,
  "signalStrength": -45,
  "additionalMetrics": {}
}
```

**Response:** `202 Accepted`
```json
{
  "status": "accepted",
  "message": "PPG data ingestion initiated"
}
```

### POST `/ingestion/temperature`

Ingest temperature data.

**Request Body:**
```json
{
  "deviceSerial": "DEV-001",
  "recordedAt": "2024-01-15T10:30:00Z",
  "temperatureCelsius": 36.5,
  "batteryLevel": 85,
  "signalStrength": -45
}
```

### POST `/ingestion/imu`

Ingest IMU (Inertial Measurement Unit) data for location tracking.

**Request Body:**
```json
{
  "deviceSerial": "DEV-001",
  "recordedAt": "2024-01-15T10:30:00Z",
  "xCoordinate": 12.5,
  "yCoordinate": 8.3,
  "zCoordinate": 1.2,
  "accuracyMeters": 2.5,
  "locationMethod": "ble_triangulation",
  "zoneId": "zone-uuid-here"
}
```

### POST `/ingestion/status`

Ingest device status information.

**Request Body:**
```json
{
  "deviceSerial": "DEV-001",
  "recordedAt": "2024-01-15T10:30:00Z",
  "connectionStatus": "connected",
  "gatewaySerial": "GW-001",
  "batteryLevel": 85,
  "signalStrength": -45,
  "systemStatus": {
    "firmware": "1.2.3",
    "uptime": 3600
  }
}
```

**Connection Status Values:**
- `connected`
- `disconnected`
- `error`
- `maintenance`

### POST `/ingestion/batch`

Ingest multiple metrics in a single request (up to 1000 metrics).

**Request Body:**
```json
{
  "metrics": [
    {
      "deviceSerial": "DEV-001",
      "recordedAt": "2024-01-15T10:30:00Z",
      "heartRate": 72
    },
    {
      "deviceSerial": "DEV-001",
      "recordedAt": "2024-01-15T10:30:01Z",
      "temperatureCelsius": 36.5
    },
    {
      "deviceSerial": "DEV-002",
      "recordedAt": "2024-01-15T10:30:00Z",
      "xCoordinate": 12.5,
      "yCoordinate": 8.3
    }
  ]
}
```

**Response:** `202 Accepted`
```json
{
  "status": "accepted",
  "message": "Batch ingestion initiated",
  "queued": 3
}
```

## Validation

All endpoints validate:
- Required fields (deviceSerial, recordedAt)
- Data type correctness
- Value ranges (e.g., heart rate 0-250, temperature 30-45°C)
- Date format (ISO 8601)

## Performance Considerations

1. **Async Processing**: All endpoints return immediately and process data asynchronously
2. **Batch Inserts**: Data is inserted in batches of 500 records
3. **Device Caching**: Device lookups are cached for 5 minutes
4. **Connection Pooling**: Database connection pool configured (max 20 connections)
5. **TimescaleDB Optimization**: Leverages TimescaleDB hypertables for efficient time-series storage

## Error Handling

- **400 Bad Request**: Invalid input data
- **404 Not Found**: Device not found
- **500 Internal Server Error**: Server-side errors

All errors are logged with full context for debugging.

## Database Tables

- `vital_metrics` - PPG and temperature data
- `location_metrics` - IMU/position data
- `device_status` - Device connection status

All tables are TimescaleDB hypertables optimized for time-series data.
