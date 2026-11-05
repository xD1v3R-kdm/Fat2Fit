import process from 'node:process';

// Production deploys fail closed rather than publishing an accidental anonymous demo.
const enforce = process.argv.includes('--production') || process.env.VERCEL === '1';
if (!enforce) {
  console.log('Fat2Fit: local build, remote deployment preflight skipped.');
  process.exit(0);
}
const errors=[];
const warnings=[];
const required=(key)=>{
  const value=process.env[key]?.trim();
  if (!value || ['CHANGE_ME', 'placeholder'].some(x=>value.includes(x))) errors.push(`${key}: supply a real value`);
  return value||'';
};
const demo=required('NEXT_PUBLIC_DEMO_MODE');
if(demo!=='false')errors.push('NEXT_PUBLIC_DEMO_MODE must be exactly false for public deploys');
const db=required('DATABASE_URL');
if(db){
 try{
  const uri=new URL(db);
  if(!['postgresql:','postgres:'].includes(uri.protocol)||!uri.password||!uri.hostname)errors.push('DATABASE_URL: invalid PostgreSQL URI');
  else if(uri.port!=='6543')warnings.push('DATABASE_URL: not port 6543; Supabase on Vercel normally uses transaction pooler');
 }catch{errors.push('DATABASE_URL: invalid URL');}
}
const token=required('TELEGRAM_BOT_TOKEN');
if(token&&!/^\d+:[\w-]{20,}$/.test(token))errors.push('TELEGRAM_BOT_TOKEN: invalid format');
const secret=required('SESSION_SECRET');
if(secret.length<32)errors.push('SESSION_SECRET: must be at least 32 characters');
const coaches=required('BOOTSTRAP_COACH_TELEGRAM_IDS');
if(coaches&&!/^\d+(,\s*\d+)*$/.test(coaches))errors.push('BOOTSTRAP_COACH_TELEGRAM_IDS: expected comma-separated Telegram numeric IDs');
const bot=required('TELEGRAM_BOT_USERNAME');
if(bot&&!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(bot))errors.push('TELEGRAM_BOT_USERNAME: invalid format, omit @');
const mini=required('TELEGRAM_MINI_APP_SHORT_NAME');
if(mini&&!/^[A-Za-z0-9_]{3,64}$/.test(mini))errors.push('TELEGRAM_MINI_APP_SHORT_NAME: invalid format');
const supabaseUrl=required('SUPABASE_URL');
if(supabaseUrl&&!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl))errors.push('SUPABASE_URL: invalid Supabase HTTPS URL');
const storageSecret=required('SUPABASE_SERVICE_ROLE_KEY');
if(storageSecret&&storageSecret.length<25)errors.push('SUPABASE_SERVICE_ROLE_KEY: invalid length');
const appUrl=process.env.NEXT_PUBLIC_APP_URL;
if(appUrl){try{const u=new URL(appUrl);if(u.protocol!=='https:')warnings.push('NEXT_PUBLIC_APP_URL: use HTTPS for public deployment');}catch{errors.push('NEXT_PUBLIC_APP_URL: invalid URL');}}
for(const w of warnings)console.warn(`Fat2Fit warning: ${w}`);
if(errors.length){for(const err of errors)console.error(`Fat2Fit deployment blocked: ${err}`);process.exit(1);}
console.log('Fat2Fit production preflight passed (secret values not printed).');
