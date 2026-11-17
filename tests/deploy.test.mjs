import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const script=new URL('../scripts/vercel-preflight.mjs',import.meta.url);
function run(vars={}){return spawnSync(process.execPath,[script.pathname,'--production'],{encoding:'utf8',env:{PATH:process.env.PATH,...vars}});}
const good={NEXT_PUBLIC_DEMO_MODE:'false',DATABASE_URL:'postgresql://postgres.example:hello@aws-0-eu.pooler.supabase.com:6543/postgres',TELEGRAM_BOT_TOKEN:'12345678:abcdefghijklmnopqrstuvwxyz123456',SESSION_SECRET:'a'.repeat(64),BOOTSTRAP_COACH_TELEGRAM_IDS:'12345678',TELEGRAM_BOT_USERNAME:'Fat2FitTestBot',TELEGRAM_MINI_APP_SHORT_NAME:'fat2fit',SUPABASE_URL:'https://example123.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test_service_role_long_key_never_real_123456789',SUPABASE_DB_CA_CERT:'-----BEGIN CERTIFICATE-----\\nCI TEST FIXTURE NOT FOR PRODUCTION\\n-----END CERTIFICATE-----'};
test('blocks absent production configuration',()=>assert.notEqual(run().status,0));
test('blocks anonymous demo publishing',()=>{const r=run({...good,NEXT_PUBLIC_DEMO_MODE:'true'});assert.notEqual(r.status,0);assert.match(r.stderr,/DEMO_MODE/);});
test('accepts complete production configuration without logging secrets',()=>{const r=run(good);assert.equal(r.status,0,r.stderr);assert.doesNotMatch(r.stdout, /abcdefghijklmnopqrstuvwxyz/);});
test('server-side pg pool is capped for serverless',()=>{const s=readFileSync(new URL('../src/lib/db.ts',import.meta.url),'utf8');assert.match(s,/max:\s*1/);});
