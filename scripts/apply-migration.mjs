import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  try {
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251002120000_fresh_start.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('Applying migration...');

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('Migration error:', error);
    } else {
      console.log('Migration applied successfully!');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

applyMigration();
