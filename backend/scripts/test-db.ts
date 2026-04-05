import 'dotenv/config';
import { initializeDatabase, query, pool } from '../src/services/db';

async function test() {
  try {
    await initializeDatabase();
    const { rows } = await query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('Tables created:', rows.map((r: any) => r.table_name));
    const { rows: scannerRows } = await query('SELECT * FROM scanner_state');
    console.log('Scanner state:', scannerRows);
    const { rows: botRows } = await query('SELECT * FROM round_bot_state');
    console.log('Bot state:', botRows);
    await pool.end();
    console.log('SUCCESS: Database ready!');
  } catch (err) {
    console.error('FAILED:', err);
    process.exit(1);
  }
}
test();
