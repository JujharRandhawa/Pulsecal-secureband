/** DTO for device response with additional computed fields. */

import { Device } from '../../entities/device.entity';

export interface DeviceResponseDto extends Device {
  batteryLevel: number | null;
  connectionStatus: string | null;
  isStreaming: boolean;
  assignedToInmate: string | null; // Inmate ID if assigned
  timeSinceLastSeen: string | null; // Human-readable time
}
