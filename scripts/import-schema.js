/**
 * Create all tables from database/schema.sql (drops existing tables — fresh install).
 * Usage: npm run db:import
 * Then: npm run seed
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');

async function main() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD ?? '';
  const database = process.env.DB_NAME;

  if (!user || !database) {
    console.error('Set DB_USER and DB_NAME in .env (see .env.example).');
    process.exit(1);
  }

  if (!/^[a-zA-Z0-9_]+$/.test(String(database))) {
    console.error('DB_NAME must contain only letters, numbers, and underscores.');
    process.exit(1);
  }

  if (!fs.existsSync(schemaPath)) {
    console.error('Missing file:', schemaPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Connecting to MySQL…');
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  });

  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.query(`USE \`${database}\``);

  console.log('Importing database/schema.sql …');
  console.warn('(This drops and recreates all app tables in that database.)');
  await conn.query(sql);
  await conn.end();

  console.log('Schema import finished. Next: npm run seed');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
