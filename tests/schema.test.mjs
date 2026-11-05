import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/001_initial.sql',import.meta.url),'utf8');
test('tenant isolation relations exist',()=>{
 for(const table of ['users','workspaces','memberships','invitations','exercises','workout_templates','template_exercises','assignments','assignment_exercises','set_logs'])assert.match(sql,new RegExp(`create table public\\.${table}\\s*\\(`));
 assert.match(sql,/foreign key\(workspace_id,student_user_id\) references public.memberships/i);
});
test('database migration enables RLS and revokes public grants',()=>{assert.match(sql,/enable row level security/i);assert.match(sql,/revoke all on public\.%I from anon, authenticated/i);});
test('SQL migration parentheses are balanced outside quoted strings',()=>{
 // Lightweight structural check, not a substitute for executing the PostgreSQL migration.
 let depth=0,inString=false,inLineComment=false;
 for(let i=0;i<sql.length;i++){
  const c=sql[i],n=sql[i+1];
  if(inLineComment){if(c==='\n')inLineComment=false;continue;}
  if(!inString&&c==='-'&&n==='-'){inLineComment=true;i++;continue;}
  if(c==="'"){if(inString&&n==="'"){i++;continue;}inString=!inString;continue;}
  if(inString)continue;
  if(c==='(')depth++;
  if(c===')')depth--;
  assert.ok(depth>=0,`SQL closing parenthesis at ${i}`);
 }
 assert.equal(depth,0,'Unclosed SQL parentheses');
});
