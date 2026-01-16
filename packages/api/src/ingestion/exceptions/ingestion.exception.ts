import { HttpException, HttpStatus } from '@nestjs/common';

export class DeviceNotFoundException extends HttpException {
  constructor(deviceIdentifier: string) {
    super(`Device not found: ${deviceIdentifier}`, HttpStatus.NOT_FOUND);
  }
}

export class IngestionValidationException extends HttpException {
  constructor(message: string, errors?: any[]) {
    super(
      {
        message,
        errors: errors || [],
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class BatchIngestionException extends HttpException {
  constructor(
    message: string,
    public readonly results: { success: number; failed: number; errors: string[] },
  ) {
    super(message, HttpStatus.PARTIAL_CONTENT);
  }
}
