import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('login_attempts')
@Index(['jailName', 'ipAddress', 'attemptedAt'])
@Index(['ipAddress', 'attemptedAt'])
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, name: 'jail_name' })
  jailName!: string;

  @Column({ type: 'inet', name: 'ip_address' })
  ipAddress!: string;

  @Column({ type: 'boolean', default: false })
  success!: boolean;

  @Column({ type: 'text', nullable: true, name: 'failure_reason' })
  failureReason?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'attempted_at' })
  attemptedAt!: Date;
}
