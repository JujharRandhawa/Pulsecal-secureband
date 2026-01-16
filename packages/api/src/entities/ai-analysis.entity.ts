/** Entity for storing AI analysis results. */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Device } from './device.entity';

export enum AnalysisType {
  SIGNAL_QUALITY = 'signal_quality',
  ANOMALY_DETECTION = 'anomaly_detection',
  RISK_SCORING = 'risk_scoring',
}

export enum AnalysisStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  FALLBACK = 'fallback',
}

@Entity('ai_analyses')
@Index(['deviceId', 'recordedAt'])
@Index(['inmateDeviceId', 'recordedAt'])
@Index(['analysisType', 'status'])
@Index(['recordedAt'])
export class AiAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  deviceId: string;

  @ManyToOne(() => Device)
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @Column({ type: 'uuid', nullable: true })
  inmateDeviceId: string | null;

  @Column({
    type: 'enum',
    enum: AnalysisType,
  })
  analysisType: AnalysisType;

  @Column({
    type: 'enum',
    enum: AnalysisStatus,
    default: AnalysisStatus.PENDING,
  })
  status: AnalysisStatus;

  @Column({ type: 'uuid', nullable: true })
  metricId: string | null; // Reference to the metric that triggered this analysis

  @Column({ type: 'timestamptz' })
  recordedAt: Date; // When the metric was recorded

  @Column({ type: 'timestamptz' })
  analyzedAt: Date; // When the analysis was performed

  // Analysis results (JSONB for flexibility)
  @Column({ type: 'jsonb', nullable: true })
  results: Record<string, any> | null;

  // Explainable outputs
  @Column({ type: 'text', nullable: true })
  explanation: string | null; // Human-readable explanation

  @Column({ type: 'jsonb', nullable: true })
  recommendations: string[] | null; // List of recommendations

  @Column({ type: 'jsonb', nullable: true })
  evidence: Record<string, any> | null; // Supporting evidence

  // Confidence/quality scores
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  confidence: number | null; // 0-1 confidence score

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  qualityScore: number | null; // 0-1 quality score

  // Error handling
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null; // Error message if analysis failed

  @Column({ type: 'jsonb', nullable: true })
  errorDetails: Record<string, any> | null; // Additional error details

  // Fallback information
  @Column({ type: 'boolean', default: false })
  usedFallback: boolean; // Whether fallback logic was used

  @Column({ type: 'text', nullable: true })
  fallbackReason: string | null; // Reason for using fallback

  // Model versioning
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'model_version' })
  modelVersion: string | null; // Model version used for this analysis

  @CreateDateColumn()
  createdAt: Date;
}
