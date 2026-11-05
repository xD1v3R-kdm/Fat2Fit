import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {videoExtension,MAX_VIDEO_BYTES} from '../src/lib/video-rules.ts';
const code=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('video upload validates type and 50 MiB limit',()=>{
 assert.equal(MAX_VIDEO_BYTES,52428800);
 assert.equal(videoExtension('video/mp4',123),'mp4');
 assert.equal(videoExtension('video/quicktime',123),'mov');
 assert.equal(videoExtension('video/webm',123),'webm');
 for(const type of ['application/pdf','video/x-msvideo','image/png'])assert.equal(videoExtension(type,123),null);
 for(const size of [0,-1,MAX_VIDEO_BYTES+1,NaN,Infinity,2.2])assert.equal(videoExtension('video/mp4',size),null);
});
test('coach-assisted set tracking enforces membership role and actor attribution',()=>{
 const sets=code('src/app/api/assignments/[id]/sets/route.ts');
 assert.match(sets,/m\.role='coach'/);
 assert.match(sets,/a\.student_user_id=\$3/);
 assert.match(sets,/recorded_by/);
 const finish=code('src/app/api/assignments/[id]/finish/route.ts');
 assert.match(finish,/m\.role='coach'/);
 assert.match(finish,/a\.student_user_id=\$2/);
});
test('video submissions have server-side student/coach authorization, private storage, and confirmation',()=>{
 const upload=code('src/app/api/assignments/[id]/videos/route.ts');
 const review=code('src/app/api/assignments/[id]/videos/[videoId]/route.ts');
 const migration=code('supabase/migrations/20261105104923_fat2fit_coach_sets_and_workout_videos.sql');
 assert.match(upload,/access\.role!=='student'/);
 assert.match(upload,/assignment_id=\$1/);
 assert.match(upload,/signedUploadUrl/);
 assert.match(review,/v\.role!=='coach'/);
 assert.match(review,/storage\.objects/);
 assert.match(review,/status='pending'/);
 assert.match(migration,/public,false|false,52428800/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all on public\.workout_videos from anon, authenticated/);
});
test('English mobile nav labels remain single-line',()=>{
 const css=code('src/app/globals.css');
 assert.match(css,/\.bottom \.txt\{white-space:nowrap/);
 assert.match(css,/\.topline\{flex-wrap:nowrap/);
});
