/**
 * Script to create a new jail account
 * Usage: ts-node src/auth/scripts/create-jail.ts <jailName> <password>
 */

import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { Jail } from '../entities/jail.entity';

async function createJail(jailName: string, password: string) {
  // Initialize database connection
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'pulsecal_secureband',
    entities: [Jail],
    synchronize: false,
  });

  await dataSource.initialize();

  try {
    // Check if jail already exists
    const jailRepository = dataSource.getRepository(Jail);
    const existingJail = await jailRepository.findOne({
      where: { name: jailName },
    });

    if (existingJail) {
      console.error(`Jail "${jailName}" already exists`);
      process.exit(1);
    }

    // Hash password
    console.log('Hashing password...');
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    // Create jail
    const jail = jailRepository.create({
      name: jailName,
      passwordHash,
      passwordChangedAt: new Date(),
      isActive: true,
    });

    await jailRepository.save(jail);

    console.log(`✅ Jail "${jailName}" created successfully`);
    console.log(`   ID: ${jail.id}`);
    console.log(`   Password changed at: ${jail.passwordChangedAt}`);
  } catch (error) {
    console.error('Error creating jail:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: ts-node create-jail.ts <jailName> <password>');
  process.exit(1);
}

const [jailName, password] = args;
createJail(jailName, password).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
