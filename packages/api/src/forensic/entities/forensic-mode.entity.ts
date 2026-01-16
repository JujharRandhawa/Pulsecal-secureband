import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('forensic_mode')
@Index(['enabled'], { unique: true, where: 'enabled = true' })
export class ForensicMode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'enabled_at' })
  enabledAt?: Date;

  @Column({ type: 'uuid', nullable: true, name: 'enabled_by' })
  enabledBy?: string;

  @Column({ type: 'text', name: 'enabled_reason' })
  enabledReason!: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'disabled_at' })
  disabledAt?: Date;

  @Column({ type: 'uuid', nullable: true, name: 'disabled_by' })
  disabledBy?: string;

  @Column({ type: 'text', nullable: true, name: 'disabled_reason' })
  disabledReason?: string;

  @Column({ type: 'boolean', default: true, name: 'read_only' })
  readOnly!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
