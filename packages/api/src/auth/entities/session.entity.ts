import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Jail } from './jail.entity';

@Entity('sessions')
@Index(['jailId'])
@Index(['token'])
@Index(['expiresAt'], { where: 'expires_at > NOW()' })
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'jail_id' })
  jailId!: string;

  @ManyToOne(() => Jail, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jail_id' })
  jail!: Jail;

  @Column({ type: 'text', unique: true })
  token!: string;

  @Column({ type: 'inet', name: 'ip_address' })
  ipAddress!: string;

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent?: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'last_accessed_at', default: () => 'NOW()' })
  lastAccessedAt!: Date;
}
