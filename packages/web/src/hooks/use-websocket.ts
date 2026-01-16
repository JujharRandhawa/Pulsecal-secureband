'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export enum RealtimeEvent {
  // Client events
  SUBSCRIBE_VITALS = 'subscribe:vitals',
  UNSUBSCRIBE_VITALS = 'unsubscribe:vitals',
  SUBSCRIBE_ALERTS = 'subscribe:alerts',
  UNSUBSCRIBE_ALERTS = 'unsubscribe:alerts',
  SUBSCRIBE_DEVICE_STATUS = 'subscribe:device-status',
  UNSUBSCRIBE_DEVICE_STATUS = 'unsubscribe:device-status',

  // Server events
  VITAL_METRIC = 'vital:metric',
  ALERT_CREATED = 'alert:created',
  ALERT_UPDATED = 'alert:updated',
  DEVICE_STATUS = 'device:status',
  CONNECTION_STATUS = 'connection:status',
}

export interface VitalMetricEvent {
  deviceId: string;
  inmateDeviceId: string | null;
  metricId: string;
  heartRate: number | null;
  temperatureCelsius: number | null;
  oxygenSaturation: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  batteryLevel: number | null;
  signalStrength: number | null;
  recordedAt: string;
}

export interface AlertEvent {
  alertId: string;
  deviceId: string;
  inmateDeviceId: string | null;
  alertType: string;
  severity: string;
  status: string;
  description: string;
  triggeredAt: string;
}

export interface DeviceStatusEvent {
  deviceId: string;
  connectionStatus: string;
  batteryLevel: number | null;
  signalStrength: number | null;
  recordedAt: string;
}

export interface ConnectionStatusEvent {
  connected: boolean;
  timestamp: string;
  message?: string;
}

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = true,
    reconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = options;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusEvent | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (socket?.connected) {
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    // Socket.IO handles protocol conversion automatically, just use the base URL
    const wsUrl = apiUrl;

    const newSocket = io(`${wsUrl}/realtime`, {
      transports: ['websocket', 'polling'],
      reconnection: reconnect,
      reconnectionDelay: reconnectInterval,
      reconnectionAttempts: maxReconnectAttempts,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      console.log('WebSocket connected');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);

      if (reconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectInterval);
      }
    });

    newSocket.on(RealtimeEvent.CONNECTION_STATUS, (data: ConnectionStatusEvent) => {
      setConnectionStatus(data);
      setIsConnected(data.connected);
    });

    setSocket(newSocket);

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      newSocket.close();
    };
  }, [reconnect, reconnectInterval, maxReconnectAttempts, socket]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.close();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket]);

  const subscribeVitals = useCallback(
    (deviceId?: string) => {
      if (socket?.connected) {
        socket.emit(RealtimeEvent.SUBSCRIBE_VITALS, { deviceId });
      }
    },
    [socket],
  );

  const unsubscribeVitals = useCallback(() => {
    if (socket?.connected) {
      socket.emit(RealtimeEvent.UNSUBSCRIBE_VITALS);
    }
  }, [socket]);

  const subscribeAlerts = useCallback(() => {
    if (socket?.connected) {
      socket.emit(RealtimeEvent.SUBSCRIBE_ALERTS);
    }
  }, [socket]);

  const unsubscribeAlerts = useCallback(() => {
    if (socket?.connected) {
      socket.emit(RealtimeEvent.UNSUBSCRIBE_ALERTS);
    }
  }, [socket]);

  const subscribeDeviceStatus = useCallback(() => {
    if (socket?.connected) {
      socket.emit(RealtimeEvent.SUBSCRIBE_DEVICE_STATUS);
    }
  }, [socket]);

  const unsubscribeDeviceStatus = useCallback(() => {
    if (socket?.connected) {
      socket.emit(RealtimeEvent.UNSUBSCRIBE_DEVICE_STATUS);
    }
  }, [socket]);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    socket,
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    subscribeVitals,
    unsubscribeVitals,
    subscribeAlerts,
    unsubscribeAlerts,
    subscribeDeviceStatus,
    unsubscribeDeviceStatus,
  };
}
