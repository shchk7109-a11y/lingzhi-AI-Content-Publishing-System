// Migration script: Transfer users from users.json to SQLite via Prisma
// Run with: node scripts/migrate-users.mjs

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const BetterSqlite3 = require('../node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3/index.js');
const bcrypt = require('../node_modules/.pnpm/bcryptjs@3.0.3/node_modules/bcryptjs/dist/bcrypt.js');

const DB_PATH = join(__dirname, '../dev.db');
const USERS_JSON_PATH = join(__dirname, '../data/users.json');

async function migrate() {
  if (!existsSync(USERS_JSON_PATH)) {
    console.log('No users.json found, skipping migration.');
    return;
  }

  const db = new BetterSqlite3(DB_PATH);
  
  // Read existing users from JSON
  const usersJson = JSON.parse(readFileSync(USERS_JSON_PATH, 'utf-8'));
  console.log(`Found ${usersJson.length} user(s) in users.json`);

  for (const user of usersJson) {
    // Check if user already exists in DB
    const existing = db.prepare('SELECT id FROM User WHERE username = ?').get(user.username);
    if (existing) {
      console.log(`User "${user.username}" already exists in DB, skipping.`);
      continue;
    }

    // Hash the plain-text password
    const hashedPassword = await bcrypt.hash(user.passwordHash, 12);
    
    // Insert into DB
    db.prepare(`
      INSERT INTO User (id, username, password, role, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.username,
      hashedPassword,
      user.role,
      user.status,
      user.createdAt,
      new Date().toISOString()
    );
    
    console.log(`✓ Migrated user: "${user.username}" (role: ${user.role}, status: ${user.status})`);
  }

  db.close();
  console.log('\nMigration complete!');
}

migrate().catch(console.error);
