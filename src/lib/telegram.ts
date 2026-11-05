import {createHmac, timingSafeEqual} from 'node:crypto';
export type TelegramUser = {id:number;first_name:string;last_name?:string;username?:string;language_code?:string};
/** Official Telegram bot-token HMAC validation; rejects replays older than 24 hours. */
export function validateTelegramInitData(raw:string, token:string, now=Math.floor(Date.now()/1000)):TelegramUser{
  if(!raw || raw.length>8192 || !token) throw Error('Invalid init data');
  const p=new URLSearchParams(raw);
  const entries=[...p.entries()];
  if(new Set(entries.map(([k])=>k)).size!==entries.length) throw Error('Duplicate init data fields');
  const hash=p.get('hash');const date=Number(p.get('auth_date'));
  if(!hash || !/^[a-f0-9]{64}$/i.test(hash) || !Number.isSafeInteger(date) || date>now+60 || date<now-86400)throw Error('Expired init data');
  const check=entries.filter(([k])=>k!=='hash').map(([k,v])=>`${k}=${v}`).sort().join('\n');
  const secret=createHmac('sha256','WebAppData').update(token).digest();
  const expected=createHmac('sha256',secret).update(check).digest();
  const received=Buffer.from(hash,'hex');
  if(received.length!==expected.length || !timingSafeEqual(received,expected))throw Error('Invalid Telegram signature');
  let u:TelegramUser;
  try{u=JSON.parse(p.get('user')||'null');}catch{throw Error('Missing Telegram user');}
  if(!u || !Number.isSafeInteger(u.id) || u.id<=0 || typeof u.first_name!=='string')throw Error('Invalid Telegram user');
  return u;
}
