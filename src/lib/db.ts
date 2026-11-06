import 'server-only';
import {Pool, type PoolClient, type QueryResultRow} from 'pg';
const globalPool = globalThis as typeof globalThis & {__fat2fitPool?:Pool};
export function pool():Pool {
  if(!process.env.DATABASE_URL) throw Error('DATABASE_URL missing');
  // Vercel runs many short-lived instances. Keep each warm instance to one connection.
  // For Supabase, use the Transaction pooler URI (port 6543) copied from the Connect dialog.
  const url = new URL(process.env.DATABASE_URL);
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  const isSupabasePooler = url.hostname.endsWith('.pooler.supabase.com');
  // Supabase pooler CA must be explicitly trusted; never disable peer verification.
  const ca = process.env.SUPABASE_DB_CA_CERT?.replace(/\\n/g, '\n').trim();
  if (isSupabasePooler && !ca) {
    throw new Error('SUPABASE_DB_CA_CERT missing: download the CA from Supabase Database Settings -> SSL Configuration');
  }
  if (ca && (!ca.startsWith('-----BEGIN CERTIFICATE-----') || !ca.endsWith('-----END CERTIFICATE-----'))) {
    throw new Error('SUPABASE_DB_CA_CERT is not a valid PEM certificate');
  }
  // node-postgres would otherwise override explicit SSL config with URI sslmode.
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) url.searchParams.delete(key);
  return globalPool.__fat2fitPool ??= new Pool({
    connectionString: url.toString(),
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    ssl: local ? false : { rejectUnauthorized: true, ca, servername: url.hostname },
  });
}
export async function query<T extends QueryResultRow=QueryResultRow>(text:string,values:unknown[]=[]){return pool().query<T>(text,values);}
export async function transaction<T>(fn:(c:PoolClient)=>Promise<T>):Promise<T>{const c=await pool().connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
