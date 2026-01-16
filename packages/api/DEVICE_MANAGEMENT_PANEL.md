# Device Management Panel

Admin-only panel for managing SecureBand devices with full CRUD operations, audit logging, and security controls.

## Features

- ✅ List all SecureBands with filtering
- ✅ Show device status (active/offline/revoked/inventory/maintenance)
- ✅ Add new SecureBand devices
- ✅ Remove/revoke SecureBand devices
- ✅ Display last data timestamp
- ✅ Show firmware version
- ✅ Display battery level
- ✅ Admin-only access control
- ✅ Confirmation prompts for destructive actions
- ✅ Comprehensive audit logging

## API Endpoints

### List Devices
```http
GET /device-management-panel?status=active
```

Query Parameters:
- `status` (optional): Filter by status (`active`, `inventory`, `maintenance`, `revoked`, or omit for all)

Response:
```json
[
  {
    "id": "uuid",
    "serialNumber": "DEV-12345",
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "firmwareVersion": "1.0.0",
    "hardwareVersion": "HW-1.0",
    "status": "active",
    "lastSeenAt": "2024-01-15T10:30:00Z",
    "batteryLevel": 85,
    "connectionStatus": "connected",
    "isStreaming": true,
    "assignedToInmate": "uuid",
    "timeSinceLastSeen": "5 minutes ago"
  }
]
```

### Get Statistics
```http
GET /device-management-panel/statistics
```

Response:
```json
{
  "total": 150,
  "active": 120,
  "offline": 15,
  "revoked": 5,
  "lowBattery": 8
}
```

### Get Device by ID
```http
GET /device-management-panel/:id
```

### Create Device
```http
POST /device-management-panel
Content-Type: application/json

{
  "serialNumber": "DEV-12345",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "firmwareVersion": "1.0.0",
  "hardwareVersion": "HW-1.0",
  "manufacturedDate": "2024-01-01",
  "deployedDate": "2024-01-15"
}
```

**Required Fields:**
- `serialNumber`: Unique device serial number
- `macAddress`: MAC address in format `XX:XX:XX:XX:XX:XX` or `XX-XX-XX-XX-XX-XX`

**Optional Fields:**
- `firmwareVersion`: Firmware version string
- `hardwareVersion`: Hardware version string
- `manufacturedDate`: ISO date string
- `deployedDate`: ISO date string

### Update Device
```http
PUT /device-management-panel/:id
Content-Type: application/json

{
  "firmwareVersion": "1.1.0",
  "status": "maintenance",
  "deployedDate": "2024-01-20"
}
```

### Remove Device
```http
DELETE /device-management-panel/:id
Content-Type: application/json

{
  "reason": "Device damaged, returned to manufacturer"
}
```

**Note:** Device removal requires a reason (logged in audit trail). Devices currently assigned to inmates cannot be removed.

## Security

### Admin Guard
All endpoints are protected by `AdminGuard` which:
- Checks for authenticated user
- Verifies user has admin role
- Returns `403 Forbidden` if not authorized

### Audit Logging
All device operations are logged:
- **CREATE**: Logs device creation with new values
- **UPDATE**: Logs changes with old/new values
- **DELETE**: Logs as critical action requiring approval, includes reason

Audit entries include:
- User ID
- IP address
- User agent
- Request method/path
- Timestamp
- Old/new values
- Reason (for deletions)

## Device Status

- **inventory**: Device in stock, not assigned
- **active**: Device assigned and streaming
- **maintenance**: Device under maintenance
- **revoked**: Device removed from system (cannot be reused)

## Enriched Device Data

The API enriches device data with:
- **batteryLevel**: Latest battery level from device status
- **connectionStatus**: Latest connection status
- **isStreaming**: Whether device is actively streaming
- **assignedToInmate**: Inmate ID if device is assigned
- **timeSinceLastSeen**: Human-readable time since last data

## Frontend

The frontend panel (`/devices`) provides:
- Real-time device list with filtering
- Statistics dashboard
- Add device dialog with validation
- Remove device confirmation dialog
- Status badges and indicators
- Battery level visualization
- Connection status indicators
- Auto-refresh every 30 seconds

## Error Handling

- **409 Conflict**: Duplicate serial number or MAC address
- **404 Not Found**: Device not found
- **403 Forbidden**: Admin access required
- **400 Bad Request**: Invalid input data

## Example Usage

### Add a Device
```bash
curl -X POST http://localhost:3001/device-management-panel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "serialNumber": "DEV-12345",
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "firmwareVersion": "1.0.0"
  }'
```

### Remove a Device
```bash
curl -X DELETE http://localhost:3001/device-management-panel/<device-id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "reason": "Device damaged"
  }'
```

## Integration

The device management panel integrates with:
- **Device Binding Service**: Checks for active assignments before removal
- **Device Streaming Service**: Shows streaming status
- **Device Health Monitor**: Provides last seen timestamps
- **Audit Service**: Logs all operations
- **Real-time Gateway**: Updates device status in real-time

## Next Steps

1. **Authentication**: Implement actual admin authentication (currently placeholder)
2. **Permissions**: Add role-based permissions for device management
3. **Bulk Operations**: Add bulk import/export functionality
4. **Device History**: Show device assignment history
5. **Firmware Updates**: Add firmware update tracking
