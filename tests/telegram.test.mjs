import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {validateTelegramInitData} from '../src/lib/telegram.ts';
const token='123456:TEST_BOT_TOKEN';
function signed(pairs){const entries=Object.entries(pairs).map(([k,v])=>`${k}=${v}`).sort().join('\n');const secret=createHmac('sha256','WebAppData').update(token).digest();const hash=createHmac('sha256',secret).update(entries).digest('hex');return new URLSearchParams({...pairs,hash}).toString();}
const now=1700000000;
function sample(){return signed({user:JSON.stringify({id:1234567,first_name:'Anna',language_code:'ru'}),auth_date:String(now)});}
test('valid Telegram signed init data authenticates user',()=>{const u=validateTelegramInitData(sample(),token,now);assert.equal(u.id,1234567);});
test('tampered Telegram data is rejected',()=>{const raw=sample().replace('Anna','Maria');assert.throws(()=>validateTelegramInitData(raw,token,now));});
test('expired Telegram init data is rejected',()=>{assert.throws(()=>validateTelegramInitData(sample(),token,now+86401));});
test('future Telegram init data is rejected',()=>{assert.throws(()=>validateTelegramInitData(sample(),token,now-61));});
test('duplicate fields are rejected',()=>{assert.throws(()=>validateTelegramInitData(sample()+'&user=fake',token,now));});
test('hash case and malformed hash are rejected',()=>{assert.throws(()=>validateTelegramInitData(sample().replace(/hash=[^&]+/,'hash=xyz'),token,now));});
