/** Prometheus metrics service. */

import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  // HTTP metrics
  public readonly httpRequestDuration: Histogram<string>;
  public readonly httpRequestTotal: Counter<string>;
  public readonly httpRequestErrors: Counter<string>;

  // Business metrics
  public readonly metricsIngested: Counter<string>;
  public readonly alertsCreated: Counter<string>;
  public readonly aiAnalysisCompleted: Counter<string>;
  public readonly aiAnalysisFailed: Counter<string>;
  public readonly websocketConnections: Gauge<string>;
  public readonly websocketMessages: Counter<string>;

  // System metrics
  public readonly activeJobs: Gauge<string>;
  public readonly queueDepth: Gauge<string>;
  public readonly databaseConnections: Gauge<string>;

  constructor() {
    this.registry = new Registry();

    // HTTP metrics
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestErrors = new Counter({
      name: 'http_request_errors_total',
      help: 'Total number of HTTP request errors',
      labelNames: ['method', 'route', 'error_type'],
      registers: [this.registry],
    });

    // Business metrics
    this.metricsIngested = new Counter({
      name: 'metrics_ingested_total',
      help: 'Total number of metrics ingested',
      labelNames: ['metric_type', 'device_id'],
      registers: [this.registry],
    });

    this.alertsCreated = new Counter({
      name: 'alerts_created_total',
      help: 'Total number of alerts created',
      labelNames: ['alert_type', 'severity'],
      registers: [this.registry],
    });

    this.aiAnalysisCompleted = new Counter({
      name: 'ai_analysis_completed_total',
      help: 'Total number of AI analyses completed',
      labelNames: ['analysis_type', 'status'],
      registers: [this.registry],
    });

    this.aiAnalysisFailed = new Counter({
      name: 'ai_analysis_failed_total',
      help: 'Total number of AI analyses failed',
      labelNames: ['analysis_type', 'error_type'],
      registers: [this.registry],
    });

    this.websocketConnections = new Gauge({
      name: 'websocket_connections_active',
      help: 'Number of active WebSocket connections',
      registers: [this.registry],
    });

    this.websocketMessages = new Counter({
      name: 'websocket_messages_total',
      help: 'Total number of WebSocket messages',
      labelNames: ['event_type'],
      registers: [this.registry],
    });

    // System metrics
    this.activeJobs = new Gauge({
      name: 'queue_jobs_active',
      help: 'Number of active queue jobs',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.queueDepth = new Gauge({
      name: 'queue_depth',
      help: 'Number of jobs in queue',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.databaseConnections = new Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections',
      registers: [this.registry],
    });
  }

  /**
   * Get metrics registry.
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Get metrics as string (Prometheus format).
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
