'use client';
import React,{useCallback,useEffect,useMemo,useState} from 'react';
import type {Assignment,AssignmentItem,Exercise,Language,Localized,Me,Role,SetLog,Student,WorkoutItem,WorkoutTemplate} from '@/lib/types';
import {t,localized,exText,groups,type Phrase} from '@/lib/i18n';
import {demoWorkspaceId,dateShift,isLang,seedDemo,type DemoData} from '@/lib/demo';
import {api} from '@/lib/api-client';
import {videoExtension} from '@/lib/video-rules';

type Screen='dashboard'|'students'|'studentDetail'|'coachWorkout'|'exercises'|'exerciseDetail'|'exerciseNew'|'templates'|'templateNew'|'assign'|'reports'|'reportDetail'|'workout'|'history';
type WorkoutVideo={id:string;itemId:string;setIndex:number|null;status:'uploading'|'pending'|'approved'|'changes_requested';reviewNote:string;createdAt:string;studentId:string;url:string};
type BodyMeasurement={id:string;measuredOn:string;weightKg:number|null;waistCm:number|null;chestCm:number|null;bicepsCm:number|null;thighCm:number|null;hipsCm:number|null;note:string;updatedAt:string};
type MeasureKey='weightKg'|'waistCm'|'chestCm'|'bicepsCm'|'thighCm'|'hipsCm';
const measureFields:{key:MeasureKey;label:[string,string,string];unit:string;min:number;max:number}[]=[
 {key:'weightKg',label:['Вес','Weight','Težina'],unit:'kg',min:10,max:500},
 {key:'waistCm',label:['Объём талии','Waist','Struk'],unit:'cm',min:20,max:300},
 {key:'chestCm',label:['Объём груди','Chest','Grudi'],unit:'cm',min:20,max:300},
 {key:'bicepsCm',label:['Объём бицепса','Biceps','Biceps'],unit:'cm',min:10,max:150},
 {key:'thighCm',label:['Объём бедра','Thigh','Butina'],unit:'cm',min:10,max:200},
 {key:'hipsCm',label:['Объём бёдер','Hips','Kukovi'],unit:'cm',min:20,max:300}
];
type DraftExercise={group:string;equipment:string;photoUrl:string;videoUrl:string;translations:Exercise['translations']};
type DraftTemplate={title:Localized;items:WorkoutItem[]};
type WebApp={initData:string;initDataUnsafe?:{start_param?:string};ready?:()=>void;expand?:()=>void;openTelegramLink?:(url:string)=>void};
declare global {interface Window {Telegram?:{WebApp?:WebApp}}}
const DEMO=process.env.NEXT_PUBLIC_DEMO_MODE==='true';
const newDraft=():DraftExercise=>({group:'chest',equipment:'',photoUrl:'',videoUrl:'',translations:{ru:{name:'',description:'',faq:''},en:{name:'',description:'',faq:''},sr:{name:'',description:'',faq:''}}});
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const tabs:{screen:Screen;icon:string;key:Phrase}[]=[{screen:'dashboard',icon:'⌂',key:'dashboard'},{screen:'students',icon:'♧',key:'students'},{screen:'exercises',icon:'◈',key:'exercises'},{screen:'templates',icon:'▤',key:'templates'},{screen:'reports',icon:'▥',key:'reports'}];
const studentTabs:{screen:Screen;icon:string;key:Phrase}[]=[{screen:'dashboard',icon:'⌂',key:'dashboard'},{screen:'workout',icon:'▤',key:'workout'},{screen:'exercises',icon:'◈',key:'exercises'},{screen:'history',icon:'▥',key:'history'}];
const emptyData:DemoData={exercises:[],students:[],templates:[],assignments:[]};
const num=(v:string,def=0)=>{const n=Number(v);return Number.isFinite(n)?Math.max(0,n):def;};
const isoDate=(s:string,l:Language)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const [y,m,d]=s.split('-').map(Number);return new Intl.DateTimeFormat(l==='sr'?'sr-Latn-RS':l==='en'?'en-GB':'ru-RU',{day:'numeric',month:'short'}).format(new Date(y,m-1,d));};
const percent=(done:number,total:number)=>total?Math.round(done/total*100):0;
const doneSets=(a:Assignment)=>a.items.reduce((s,i)=>s+i.logs.filter(l=>l.done).length,0);
const totalSets=(a:Assignment)=>a.items.reduce((s,i)=>s+i.sets,0);
function copy(ru:string,en:string,sr:string,lang:Language){return lang==='ru'?ru:lang==='en'?en:sr;}
function safeMedia(url:string){try{const u=new URL(url);return u.protocol==='https:'?u.toString():'';}catch{return '';}}
function Video({url,lang}:{url:string;lang:Language}){const safe=safeMedia(url);if(!safe)return <div className="media-empty"><span>▶</span><b>{copy('Видео пока не добавлено','Video is not available','Video još nije dodat',lang)}</b></div>;
  let embed='';try{const u=new URL(safe);const host=u.hostname.replace(/^www\./,'');if(host==='youtu.be')embed=u.pathname.split('/')[1]||'';if(['youtube.com','m.youtube.com'].includes(host))embed=u.searchParams.get('v')||'';}catch{}
  if(embed&&/^[\w-]{11}$/.test(embed))return <div className="video-wrap"><iframe title="Exercise video" src={`https://www.youtube-nocookie.com/embed/${embed}`} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>;
  return <a className="btn full primary" href={safe} target="_blank" rel="noopener noreferrer">▶ {copy('Открыть видео','Open video','Otvori video',lang)}</a>;
}
function ProgressBar({value}:{value:number}){return <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><i style={{width:`${value}%`}}/></div>;}

export default function Fat2Fit(){
 const [lang,setLang]=useState<Language>('ru'),[mode,setMode]=useState<Role>('coach'),[screen,setScreen]=useState<Screen>('dashboard');
 const [data,setData]=useState<DemoData>(emptyData),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[toast,setToast]=useState('');
 const [me,setMe]=useState<Me|null>(null),[workspaceId,setWorkspaceId]=useState('');
 const [studentId,setStudentId]=useState('anna'),[selectedStudent,setSelectedStudent]=useState(''),[exerciseId,setExerciseId]=useState(''),[reportId,setReportId]=useState('');
 const [search,setSearch]=useState(''),[group,setGroup]=useState('all');
 const [draftExercise,setDraftExercise]=useState<DraftExercise>(newDraft),[draftLang,setDraftLang]=useState<Language>('ru');
 const [draftTemplate,setDraftTemplate]=useState<DraftTemplate>({title:{ru:''},items:[]});
 const [editingExerciseId,setEditingExerciseId]=useState(''),[editingTemplateId,setEditingTemplateId]=useState('');
 const [assignStudent,setAssignStudent]=useState(''),[assignTemplate,setAssignTemplate]=useState(''),[assignDate,setAssignDate]=useState(dateShift());
 const [inviteLink,setInviteLink]=useState(''),[workoutDraft,setWorkoutDraft]=useState<Record<string,{reps:number;weight:number}>>({}),[note,setNote]=useState(''),[effort,setEffort]=useState(6);
 const [bodyMeasurements,setBodyMeasurements]=useState<Record<string,BodyMeasurement[]>>({});
 const [bodyCounts,setBodyCounts]=useState<Record<string,number>>({});
 const [measureDate,setMeasureDate]=useState(dateShift());
 const [measureDraft,setMeasureDraft]=useState<Partial<Record<MeasureKey,string>>>({});
 const [measureNote,setMeasureNote]=useState('');
 const [measureBusy,setMeasureBusy]=useState(false);
 const [returnScreen,setReturnScreen]=useState<Screen>('exercises');
 const [videosByAssignment,setVideosByAssignment]=useState<Record<string,WorkoutVideo[]>>({});
 const [reviewNotes,setReviewNotes]=useState<Record<string,string>>({});
 const [uploadingVideo,setUploadingVideo]=useState(false);
 const notify=(message:string)=>{setToast(message);setTimeout(()=>setToast(''),4200);};
 const fail=(e:unknown)=>setError(e instanceof Error?e.message:String(e));
 const loadLive=useCallback(async(ws:string,role:Role)=>{
   const [exercises,templates,students,assignments]=await Promise.all([
    api<Exercise[]>(`/exercises?workspaceId=${encodeURIComponent(ws)}`),
    api<WorkoutTemplate[]>(`/templates?workspaceId=${encodeURIComponent(ws)}`),
    role==='coach'?api<Student[]>(`/students?workspaceId=${encodeURIComponent(ws)}`):Promise.resolve([] as Student[]),
    api<Assignment[]>(`/assignments?workspaceId=${encodeURIComponent(ws)}`)
   ]);setData({exercises,templates,students,assignments});
 },[]);
 useEffect(()=>{
  let alive=true;
  const init=async()=>{
   try{
    const stored=(localStorage.getItem('fat2fit-03-lang') ?? localStorage.getItem('gymtrack-03-lang'));if(stored&&isLang(stored)&&alive)setLang(stored);
    if(DEMO){
      const saved=(localStorage.getItem('fat2fit-03-demo') ?? localStorage.getItem('gymtrack-03-demo'));let d=seedDemo();
      if(saved){try{const parsed=JSON.parse(saved);if(Array.isArray(parsed.exercises)&&Array.isArray(parsed.assignments)&&Array.isArray(parsed.templates)&&Array.isArray(parsed.students))d=parsed;}catch{}}
      if(alive){setData(d);setStudentId('anna');setWorkspaceId(demoWorkspaceId);setReady(true);}return;
    }
    const tg=window.Telegram?.WebApp;tg?.ready?.();tg?.expand?.();
    if(!tg?.initData)throw Error('Open Fat2Fit using its Telegram bot. Demo mode can be enabled locally.');
    await api('/auth/telegram','POST',{initData:tg.initData});
    const q=new URLSearchParams(window.location.search);
    const start=tg.initDataUnsafe?.start_param||q.get('invite')||'';
    if(start.startsWith('invite_')||q.get('invite')){
      const token=start.startsWith('invite_')?start.slice(7):start;
      try{await api('/invitations/redeem','POST',{token});}catch(e){if(alive)fail(e);}
    }
    const identity=await api<Me>('/me');if(!alive)return;
    setMe(identity);if(!stored||!isLang(stored))setLang(identity.language);
    const membership=identity.memberships.find(m=>m.role==='coach')||identity.memberships[0];
    if(membership){setWorkspaceId(membership.workspaceId);setMode(membership.role);setStudentId(identity.id);await loadLive(membership.workspaceId,membership.role);}
    if(alive)setReady(true);
   }catch(e){if(alive){fail(e);setReady(true);}}
  };void init();return ()=>{alive=false;};
 },[loadLive]);
 useEffect(()=>{if(!ready)return;try{localStorage.setItem('fat2fit-03-lang',lang);if(DEMO)localStorage.setItem('fat2fit-03-demo',JSON.stringify(data));}catch{}},[data,lang,ready]);
 const refresh=async()=>{if(!DEMO&&workspaceId)await loadLive(workspaceId,mode);};
 useEffect(()=>{
   if(DEMO||!workspaceId||!['workout','coachWorkout'].includes(screen))return;
   let fetching=false;
   const interval=window.setInterval(()=>{if(document.hidden||fetching)return;fetching=true;void loadLive(workspaceId,mode).catch(fail).finally(()=>{fetching=false;});},5000);
   return ()=>window.clearInterval(interval);
 },[screen,workspaceId,mode,loadLive]);

 const changeLanguage=(l:Language)=>{setLang(l);if(!DEMO)void api('/me','PATCH',{language:l}).catch(fail);};
 const selectScreen=(s:Screen)=>{setScreen(s);setError('');setSearch('');setGroup('all');};
 const myAssignments=useMemo(()=>data.assignments.filter(a=>a.studentId===studentId).sort((a,b)=>b.date.localeCompare(a.date)),[data.assignments,studentId]);
 const activeAssignment=myAssignments.filter(a=>a.status==='planned'||a.status==='active').sort((a,b)=>a.date.localeCompare(b.date))[0];
 const currentExercise=data.exercises.find(e=>e.id===exerciseId);
 const currentStudent=data.students.find(s=>s.id===selectedStudent);
 const currentReport=data.assignments.find(a=>a.id===reportId);
 const coachActiveAssignment=screen==='coachWorkout'&&mode==='coach'&&currentReport&&['planned','active'].includes(currentReport.status)?currentReport:null;
 const shownAssignment=mode==='coach'?coachActiveAssignment:activeAssignment;
 const templateTitle=(w:WorkoutTemplate|Assignment)=>localized(w.title,lang);
 const exerciseName=(id:string)=>{const e=data.exercises.find(x=>x.id===id);return e?exText(e,lang,'name'):copy('Упражнение удалено','Exercise unavailable','Vežba nije dostupna',lang);};
 const updateData=(transform:(d:DemoData)=>DemoData)=>setData(d=>transform(structuredClone(d)));
 const addExercise=async(e:React.FormEvent)=>{e.preventDefault();setError('');
  if(!Object.values(draftExercise.translations).some(x=>x.name.trim()))return setError(copy('Введите название хотя бы на одном языке','Enter a name in at least one language','Unesite naziv na barem jednom jeziku',lang));
  if([draftExercise.videoUrl,draftExercise.photoUrl].some(v=>v&&!safeMedia(v)))return setError(copy('Ссылки должны начинаться с https://','Links must start with https://','Linkovi moraju počinjati sa https://',lang));
  setBusy(true);try{
   if(DEMO){updateData(d=>({...d,exercises:editingExerciseId?d.exercises.map(x=>x.id===editingExerciseId?{...draftExercise,id:x.id,workspaceId:demoWorkspaceId}:x):[...d.exercises,{...draftExercise,id:uid(),workspaceId:demoWorkspaceId}]}));}
   else{if(editingExerciseId)await api(`/exercises/${editingExerciseId}`,'PATCH',{workspaceId,...draftExercise});else await api('/exercises','POST',{workspaceId,...draftExercise});await refresh();}
   setEditingExerciseId('');
   selectScreen('exercises');notify(copy('Упражнение добавлено','Exercise added','Vežba je dodata',lang));
  }catch(e){fail(e);}finally{setBusy(false);}
 };
 const addTemplate=async(e:React.FormEvent)=>{e.preventDefault();if(!draftTemplate.items.length)return setError(copy('Добавьте хотя бы одно упражнение','Add at least one exercise','Dodajte barem jednu vežbu',lang));
  if(!Object.values(draftTemplate.title).some(Boolean))return setError(copy('Введите название шаблона','Enter a template title','Unesite naziv šablona',lang));
  setBusy(true);try{
   if(DEMO)updateData(d=>({...d,templates:editingTemplateId?d.templates.map(x=>x.id===editingTemplateId?{...draftTemplate,id:x.id,workspaceId:x.workspaceId}:x):[...d.templates,{...draftTemplate,id:uid(),workspaceId:demoWorkspaceId}]}));
   else{if(editingTemplateId)await api(`/templates/${editingTemplateId}`,'PATCH',{workspaceId,...draftTemplate});else await api('/templates','POST',{workspaceId,...draftTemplate});await refresh();}
   setEditingTemplateId('');
   selectScreen('templates');notify(copy('Шаблон сохранён','Template saved','Šablon je sačuvan',lang));
  }catch(e){fail(e);}finally{setBusy(false);}
 };
 const assign=async(e:React.FormEvent)=>{e.preventDefault();if(!assignStudent||!assignTemplate)return setError(copy('Выберите ученика и шаблон','Select a student and template','Izaberite učenika i šablon',lang));
  setBusy(true);try{
   if(DEMO){const templ=data.templates.find(t=>t.id===assignTemplate);if(!templ)throw Error('No template');
    updateData(d=>({...d,assignments:[...d.assignments,{id:uid(),workspaceId:demoWorkspaceId,studentId:assignStudent,templateId:templ.id,title:templ.title,date:assignDate,status:'planned',items:templ.items.map(i=>({...i,id:uid(),logs:[]})),note:'',effort:6}]}));}
   else{await api('/assignments','POST',{workspaceId,studentId:assignStudent,templateId:assignTemplate,date:assignDate});await refresh();}
   selectScreen('students');notify(copy('Тренировка назначена','Workout assigned','Trening je dodeljen',lang));
  }catch(e){fail(e);}finally{setBusy(false);}
 };
 const invite=async()=>{setBusy(true);try{if(DEMO){setInviteLink('');notify(copy('Для реальной ссылки нужен Telegram и сервер','A real invite needs Telegram and server','Za pravi poziv potreban je Telegram i server',lang));}
  else{const result=await api<{link:string}>('/invitations','POST',{workspaceId});setInviteLink(result.link);}}
  catch(e){fail(e);}finally{setBusy(false);}
 };
 const clipboardCopy=async(text:string)=>{
  try{
   if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);}
   else throw Error('Clipboard API not available');
   notify(copy('Скопировано','Copied','Kopirano',lang));
   return;
  }catch{
   const element=document.createElement('textarea');
   element.value=text;element.setAttribute('readonly','');
   element.style.position='fixed';element.style.top='0';element.style.left='0';element.style.opacity='0';
   document.body.appendChild(element);element.focus();element.select();element.setSelectionRange(0,text.length);
   const success=document.execCommand('copy');
   document.body.removeChild(element);
   if(success)notify(copy('Скопировано','Copied','Kopirano',lang));
   else setError(copy('Не удалось автоматически скопировать. Нажмите на поле со ссылкой и выберите «Копировать».','Copy failed. Select the link field and use Copy.','Kopiranje nije uspelo. Izaberite vezu i kopirajte.',lang));
  }
 };
 const shareInvite=async()=>{
  if(!inviteLink)return;
  const tg=window.Telegram?.WebApp;
  if(tg?.openTelegramLink){
   tg.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(inviteLink));
  }else if(navigator.share){
   try{await navigator.share({title:'Fat2Fit',url:inviteLink});}catch(e){if((e as Error)?.name!=='AbortError')fail(e);}
  }else{
   await clipboardCopy(inviteLink);
  }
 };
 const loadBody=useCallback(async(id:string,ws:string)=>{
  const response=await api<{measurements:BodyMeasurement[];completedWorkouts:number}>(`/measurements?workspaceId=${encodeURIComponent(ws)}&studentId=${encodeURIComponent(id)}`);
  setBodyMeasurements(old=>({...old,[id]:response.measurements}));
  setBodyCounts(old=>({...old,[id]:response.completedWorkouts}));
 },[]);
 useEffect(()=>{
  if(!ready||DEMO||!workspaceId)return;
  const id=mode==='coach'&&screen==='studentDetail'?selectedStudent:mode==='student'&&['dashboard','history'].includes(screen)?studentId:'';
  if(id)void loadBody(id,workspaceId).catch(fail);
 },[ready,mode,screen,workspaceId,selectedStudent,studentId,loadBody]);
 const saveBody=async(id:string)=>{
  if(!id||measureBusy)return;
  setError('');
  const payload:Record<string,unknown>={workspaceId,studentId:id,measuredOn:measureDate,note:measureNote.trim()};
  let count=0;
  for(const field of measureFields){
   const raw=(measureDraft[field.key]||'').trim().replace(',','.');
   if(!raw)continue;
   const val=Number(raw);
   if(!Number.isFinite(val)||val<field.min||val>field.max){
    setError(copy('Проверьте значение: ','Check value: ','Proverite vrednost: ',lang)+field.label[lang==='ru'?0:lang==='en'?1:2]);
    return;
   }
   payload[field.key]=val;count++;
  }
  if(!count){setError(copy('Добавьте хотя бы один замер','Enter at least one measurement','Dodajte bar jedno merenje',lang));return;}
  setMeasureBusy(true);
  try{
   if(DEMO){
    const row:BodyMeasurement={id:uid(),measuredOn:measureDate,weightKg:null,waistCm:null,chestCm:null,bicepsCm:null,thighCm:null,hipsCm:null,note:measureNote.trim(),updatedAt:new Date().toISOString()};
    for(const key of measureFields.map(x=>x.key)) if(typeof payload[key]==='number')row[key]=payload[key] as number;
    setBodyMeasurements(old=>({...old,[id]:[row,...(old[id]||[]).filter(x=>x.measuredOn!==measureDate)].sort((a,b)=>b.measuredOn.localeCompare(a.measuredOn))}));
   }else{
    await api('/measurements','POST',payload);
    await loadBody(id,workspaceId);
   }
   setMeasureDraft({});setMeasureNote('');setMeasureDate(dateShift());
   notify(mode==='student'?copy('Результаты отправлены тренеру','Results sent to coach','Rezultati poslati treneru',lang):copy('Замеры сохранены','Measurements saved','Merenja sačuvana',lang));
  }catch(e){fail(e);}finally{setMeasureBusy(false);}
 };
 const formatBody=(m:BodyMeasurement)=>measureFields.filter(f=>m[f.key]!=null).map(f=>`${f.label[lang==='ru'?0:lang==='en'?1:2]}: ${m[f.key]} ${f.unit}`).join('\n');
 const shareBody=async(id:string)=>{
  const rows=bodyMeasurements[id]||[];
  const latest=rows[0];
  const title=mode==='coach'?data.students.find(s=>s.id===id)?.name||'Fat2Fit':me?.name||'Fat2Fit';
  const completed=bodyCounts[id]??data.assignments.filter(a=>a.studentId===id&&a.status==='completed').length;
  const report=`Fat2Fit — ${title}\n${copy('Завершено тренировок','Completed workouts','Završeni treninzi',lang)}: ${completed}${latest?'\n'+latest.measuredOn+'\n'+formatBody(latest):''}`;
  if(navigator.share){
   try{await navigator.share({text:report,title:'Fat2Fit'});return;}
   catch(e){if((e as Error)?.name==='AbortError')return;}
  }
  await clipboardCopy(report);
 };
 const measurementPanel=(id:string)=>{
  const rows=bodyMeasurements[id]||[];
  const total=bodyCounts[id]??data.assignments.filter(a=>a.studentId===id&&a.status==='completed').length;
  const fieldLabel=(f:typeof measureFields[number])=>f.label[lang==='ru'?0:lang==='en'?1:2];
  return <section className="card stack measurements">
   <div className="spread"><h2 className="section-title">{copy('Замеры и прогресс','Measurements & progress','Merenja i napredak',lang)}</h2><span className="badge blue">{total} {copy('тренировок','workouts','treninga',lang)}</span></div>
   <p className="small muted">{mode==='student'?copy('Сохранённые результаты доступны вашему тренеру.','Your coach can see saved measurements.','Trener vidi sačuvane rezultate.',lang):copy('Фиксируйте замеры ученика. История доступна и самому ученику.','Record student measurements. Students can see their history.','Beležite merenja učenika.',lang)}</p>
   <label className="field">{copy('Дата замера','Measurement date','Datum merenja',lang)}<input type="date" className="input" value={measureDate} max={dateShift()} onChange={e=>setMeasureDate(e.target.value)}/></label>
   <div className="measurement-grid">
    {measureFields.map(f=><label className="field" key={f.key}>{fieldLabel(f)}, {f.unit}<input className="input" type="number" inputMode="decimal" min={f.min} max={f.max} step="0.1" placeholder="—" value={measureDraft[f.key]||''} onChange={e=>setMeasureDraft(d=>({...d,[f.key]:e.target.value}))}/></label>)}
   </div>
   <label className="field">{copy('Комментарий (необязательно)','Note (optional)','Napomena (opciono)',lang)}<textarea maxLength={500} value={measureNote} onChange={e=>setMeasureNote(e.target.value)}/></label>
   <button className="btn primary full" type="button" disabled={measureBusy} onClick={()=>void saveBody(id)}>{measureBusy?'…':mode==='student'?copy('Сохранить и отправить тренеру','Save & send to coach','Sačuvaj i pošalji treneru',lang):copy('Сохранить замеры','Save measurements','Sačuvaj merenja',lang)}</button>
   <div className="spread"><h3 className="section-title">{copy('История замеров','Measurement history','Istorija merenja',lang)}</h3><button type="button" className="link-button" onClick={()=>void shareBody(id)}>{copy('Поделиться сводкой','Share summary','Podeli sažetak',lang)}</button></div>
   {rows.slice(0,12).map(m=><div className="measurement-record" key={m.id}><b>{isoDate(m.measuredOn,lang)}</b><div className="measurement-grid small">{measureFields.filter(f=>m[f.key]!=null).map(f=><div key={f.key}><span className="muted">{fieldLabel(f)}</span><strong>{m[f.key]} {f.unit}</strong></div>)}</div>{m.note&&<p className="small muted">{m.note}</p>}</div>)}
   {!rows.length&&<p className="small muted">{copy('Замеров пока нет','No measurements yet','Još nema merenja',lang)}</p>}
   <p className="small muted">{copy('Повторное сохранение на ту же дату обновит существующую запись.','Saving again on the same date updates that entry.','Ponovno čuvanje za isti datum menja zapis.',lang)}</p>
  </section>;
 };
 const loadVideos=useCallback(async(assignmentId:string)=>{
   if(DEMO)return;
   const videos=await api<WorkoutVideo[]>(`/assignments/${assignmentId}/videos`);
   setVideosByAssignment(v=>({...v,[assignmentId]:videos}));
 },[]);
 useEffect(()=>{
   if(!ready||DEMO)return;
   const id=screen==='coachWorkout'||screen==='reportDetail'?reportId:mode==='student'&&screen==='workout'?activeAssignment?.id:null;
   if(id)void loadVideos(id).catch(fail);
 },[screen,reportId,ready,mode,activeAssignment?.id,loadVideos]);
 const uploadTechnique=async(a:Assignment,item:AssignmentItem,file:File)=>{
   if(!videoExtension(file.type,file.size)){setError(copy('MP4, MOV или WebM до 50 МБ','MP4, MOV or WebM up to 50 MB','MP4, MOV ili WebM do 50 MB',lang));return;}
   setUploadingVideo(true);setError('');
   try{
     if(DEMO){const video:WorkoutVideo={id:uid(),itemId:item.id,setIndex:null,status:'pending',reviewNote:'',studentId:a.studentId,createdAt:new Date().toISOString(),url:URL.createObjectURL(file)};setVideosByAssignment(v=>({...v,[a.id]:[video,...(v[a.id]||[])]}));updateData(d=>{const row=d.assignments.find(x=>x.id===a.id);if(row)row.pendingVideos=(row.pendingVideos||0)+1;return d;});}
     else{
       const token=await api<{id:string;uploadUrl:string}>(`/assignments/${a.id}/videos`,'POST',{itemId:item.id,mimeType:file.type,size:file.size});
       const uploaded=await fetch(token.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type,'x-upsert':'false'},body:file});
       if(!uploaded.ok)throw Error(copy('Загрузка видео не удалась','Video upload failed','Otpremanje videa nije uspelo',lang));
       await api(`/assignments/${a.id}/videos/${token.id}`,'PATCH',{action:'confirm'});
       await loadVideos(a.id);
     }
     notify(copy('Видео отправлено тренеру','Video sent for review','Video poslat treneru na pregled',lang));
   }catch(e){fail(e);}finally{setUploadingVideo(false);}
 };
 const reviewTechnique=async(a:Assignment,video:WorkoutVideo,status:'approved'|'changes_requested')=>{
   const comment=(reviewNotes[video.id]||'').trim();
   if(status==='changes_requested'&&!comment){setError(copy('Напишите, что нужно исправить','Explain what to improve','Napišite šta treba ispraviti',lang));return;}
   setBusy(true);setError('');
   try{
     if(DEMO){setVideosByAssignment(v=>({...v,[a.id]:(v[a.id]||[]).map(x=>x.id===video.id?{...x,status,reviewNote:comment}:x)}));if(video.status==='pending')updateData(d=>{const row=d.assignments.find(x=>x.id===a.id);if(row)row.pendingVideos=Math.max(0,(row.pendingVideos||0)-1);return d;});}
     else{await api(`/assignments/${a.id}/videos/${video.id}`,'PATCH',{action:'review',status,note:comment});await Promise.all([loadVideos(a.id),refresh()]);}
     notify(copy('Результат проверки сохранён','Review saved','Pregled je sačuvan',lang));
   }catch(e){fail(e);}finally{setBusy(false);}
 };
 const videoReview=(a:Assignment,forCoach:boolean,itemId?:string)=>{
  const videos=(videosByAssignment[a.id]||[]).filter(v=>!itemId||v.itemId===itemId);
  return <section className="card stack"><h2 className="section-title">{copy('Проверка техники','Technique review','Provera tehnike',lang)}</h2>
   {videos.map(v=><div key={v.id} className="video-review stack"><div className="spread"><b>{exerciseName(v.itemId)}</b><span className={`badge ${v.status==='approved'?'good':v.status==='pending'?'blue':'warn'}`}>{v.status==='approved'?copy('Техника верная','Approved','Odobreno',lang):v.status==='changes_requested'?copy('Нужна корректировка','Needs correction','Potrebna ispravka',lang):v.status==='pending'?copy('Ожидает проверки','Pending review','Čeka pregled',lang):copy('Загружается','Uploading','Otpremanje',lang)}</span></div>
    {v.url&&<video controls playsInline preload="metadata" className="review-player" src={v.url}/>} {v.reviewNote&&<p className="detail-paragraph">{v.reviewNote}</p>}
    {forCoach&&v.status!=='uploading'&&<><label className="field">{copy('Комментарий к технике','Technique feedback','Komentar o tehnici',lang)}<textarea maxLength={2000} value={reviewNotes[v.id]??v.reviewNote} onChange={e=>setReviewNotes(n=>({...n,[v.id]:e.target.value}))}/></label><div className="review-actions"><button type="button" className="btn primary" disabled={busy} onClick={()=>void reviewTechnique(a,v,'approved')}>{copy('✓ Верно','✓ Approve','✓ Odobri',lang)}</button><button type="button" className="btn" disabled={busy} onClick={()=>void reviewTechnique(a,v,'changes_requested')}>{copy('↻ Исправить','↻ Correct','↻ Ispravka',lang)}</button></div></>}
   </div>)}
   {!videos.length&&<p className="small muted">{copy('Видео пока нет','No videos submitted yet','Još nema videa',lang)}</p>}
  </section>;
 };
 const videoPicker=(a:Assignment,item:AssignmentItem)=><div className="upload-box"><label className="upload-label">＋ {copy('Видео на проверку','Submit video for review','Pošalji video na pregled',lang)}<input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" disabled={uploadingVideo} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadTechnique(a,item,f);e.target.value='';}} /></label><span className="small muted">MP4 / MOV / WebM · 50 MB</span></div>;
 const setLocalSet=(a:Assignment,item:AssignmentItem,setIndex:number,patch:{reps?:number;weight?:number})=>{
   updateData(d=>{const x=d.assignments.find(y=>y.id===a.id);const i=x?.items.find(y=>y.id===item.id);if(!x||!i)return d;
    const prev=i.logs.find(l=>l.setIndex===setIndex)||{setIndex,reps:item.reps,weight:item.weight,done:false};
    i.logs=[...i.logs.filter(l=>l.setIndex!==setIndex),{...prev,...patch}];return d;});
 };
 const toggleSet=async(a:Assignment,item:AssignmentItem,setIndex:number)=>{
  const prev=item.logs.find(l=>l.setIndex===setIndex);
  const key=`${item.id}-${setIndex}`;
  const edited=workoutDraft[key]||{reps:prev?.reps??item.reps,weight:prev?.weight??item.weight};
  const patch={...edited,done:!prev?.done,recordedBy:mode==='coach'?'demo-coach':a.studentId};
  if(DEMO){setLocalSet(a,item,setIndex,patch);updateData(d=>{const x=d.assignments.find(x=>x.id===a.id);if(x)x.status='active';return d;});return;}
  setBusy(true);try{await api(`/assignments/${a.id}/sets`,'PATCH',{itemId:item.id,setIndex,...patch});await refresh();}
  catch(e){fail(e);}finally{setBusy(false);}
 };
 const finishWorkout=async(a:Assignment)=>{if(!doneSets(a)){setError(copy('Отметьте хотя бы один подход','Complete at least one set','Završite barem jednu seriju',lang));return;}
   setBusy(true);try{if(DEMO)updateData(d=>{const x=d.assignments.find(y=>y.id===a.id);if(x){x.status='completed';x.note=note;x.effort=effort;}return d;});
    else{await api(`/assignments/${a.id}/finish`,'POST',{note,effort});await refresh();}
    if(mode==='coach'){setReportId(a.id);selectScreen('reportDetail');}else selectScreen('history');notify(copy('Тренировка завершена','Workout completed','Trening je završen',lang));
   }catch(e){fail(e);}finally{setBusy(false);}
 };
 const setDraftTranslation=(key:'name'|'description'|'faq',v:string)=>setDraftExercise(d=>({...d,translations:{...d.translations,[draftLang]:{...d.translations[draftLang], [key]:v}}}));
 const addTemplateExercise=(ex:Exercise)=>setDraftTemplate(d=>({...d,items:[...d.items,{id:uid(),exerciseId:ex.id,sets:3,reps:10,weight:0,rest:90}]}));
 const updateTemplateItem=(id:string,field:'sets'|'reps'|'weight'|'rest',value:string)=>setDraftTemplate(d=>({...d,items:d.items.map(i=>i.id===id?{...i,[field]:num(value)}:i)}));
 const navs=mode==='coach'?tabs:studentTabs;
 const currentTab:Screen=screen==='studentDetail'||screen==='assign'||screen==='coachWorkout'?'students':screen==='exerciseDetail'||screen==='exerciseNew'?'exercises':screen==='templateNew'?'templates':screen==='reportDetail'?'reports':screen;
 const header=(kicker:string,title:string,sub?:string)=><div><p className="kicker">{kicker}</p><h1 className="screen-heading">{title}</h1>{sub&&<p className="screen-sub">{sub}</p>}</div>;
 const back=(s:Screen)=><button type="button" className="back" onClick={()=>selectScreen(s)}>← {t('back',lang)}</button>;
 const avatar=(name:string)=><span className="avatar">{name.slice(0,1).toUpperCase()}</span>;
 const statusLabel=(a:Assignment)=><span className={`badge ${a.status==='completed'?'good':a.status==='active'?'blue':'warn'}`}>{t(a.status==='completed'?'complete':a.status,lang)}</span>;
 const exCard=(ex:Exercise,action:()=>void)=><button type="button" key={ex.id} className="exercise-tile" onClick={action}><span className="thumb">{ex.photoUrl?<img src={safeMedia(ex.photoUrl)} alt="" loading="lazy"/>:<span className="thumb-fallback">✦</span>}</span><span className="grow"><b>{exText(ex,lang,'name')}</b><span className="small muted" style={{display:'block'}}>{localized(groups[ex.group]||groups.other,lang)} · {ex.equipment||'—'}</span></span><span style={{color:'#7d9bc1'}}>›</span></button>;
 const assignmentsFor=(id:string)=>data.assignments.filter(a=>a.studentId===id).sort((a,b)=>b.date.localeCompare(a.date));

 function dashboard(){if(mode==='student')return <div className="view stack">{header(copy('ЛИЧНЫЙ КАБИНЕТ','YOUR ACCOUNT','MOJ NALOG',lang),t('dashboard',lang))}<div className="hero"><div className="eyebrow">{t('today',lang)} · {isoDate(dateShift(),lang)}</div><h2>{activeAssignment?templateTitle(activeAssignment):t('noAssignments',lang)}</h2><p>{activeAssignment?`${activeAssignment.items.length} ${t('exercises',lang).toLowerCase()} · ${totalSets(activeAssignment)} ${t('sets',lang).toLowerCase()}`:t('studentIntro',lang)}</p>{activeAssignment&&<button className="btn dark" onClick={()=>selectScreen('workout')}>{t('started',lang)} →</button>}</div><div className="stats"><div className="stat-card"><strong>{myAssignments.length}</strong><span>{t('workout',lang)}</span></div><div className="stat-card"><strong>{myAssignments.filter(a=>a.status==='completed').length}</strong><span>{t('complete',lang)}</span></div><div className="stat-card"><strong>{myAssignments.length?percent(myAssignments.filter(a=>a.status==='completed').length,myAssignments.length):0}%</strong><span>{t('progress',lang)}</span></div></div><h2 className="section-title">{t('history',lang)}</h2>{myAssignments.slice(0,3).map(a=><button key={a.id} className="tile" onClick={()=>{setReportId(a.id);selectScreen(a.status==='completed'?'history':'workout');}}><span className="grow"><b>{templateTitle(a)}</b><span className="small muted" style={{display:'block'}}>{isoDate(a.date,lang)}</span></span>{statusLabel(a)}</button>)}</div>;
 const completed=data.assignments.filter(a=>a.status==='completed').length;
 const pending=data.assignments.filter(a=>(a.pendingVideos||0)>0);
 return <div className="view stack">{header(copy('РАБОЧЕЕ ПРОСТРАНСТВО','WORKSPACE','RADNI PROSTOR',lang),t('dashboard',lang))}<section className="hero"><div className="eyebrow">{t('today',lang)} · {isoDate(dateShift(),lang)}</div><h2>{copy('Всё под контролем','Keep everyone on track','Sve pod kontrolom',lang)}</h2><p>{t('dashboardIntro',lang)}</p><button className="btn dark" onClick={()=>{setAssignStudent(data.students[0]?.id||'');setAssignTemplate(data.templates[0]?.id||'');selectScreen('assign');}}>＋ {t('assign',lang)}</button></section><div className="stats"><div className="stat-card"><strong>{data.students.length}</strong><span>{t('students',lang)}</span></div><div className="stat-card"><strong>{completed}</strong><span>{t('complete',lang)}</span></div><div className="stat-card"><strong>{data.templates.length}</strong><span>{t('templates',lang)}</span></div></div>{pending.length>0&&<div className="card stack"><b>🎥 {copy('Видео ждут проверки','Videos awaiting review','Video čeka pregled',lang)} · {pending.reduce((n,a)=>n+(a.pendingVideos||0),0)}</b>{pending.slice(0,3).map(a=><button className="tile" type="button" key={`review-${a.id}`} onClick={()=>{setReportId(a.id);selectScreen('reportDetail');}}><span className="grow">{templateTitle(a)} · {data.students.find(s=>s.id===a.studentId)?.name||'—'}</span><span className="badge blue">{a.pendingVideos}</span></button>)}</div>}<div className="quick"><button onClick={()=>{setEditingExerciseId('');setDraftExercise(newDraft());selectScreen('exerciseNew');}}><b style={{display:'block',fontSize:23}}>＋</b><strong>{t('createExercise',lang)}</strong></button><button onClick={()=>{setEditingTemplateId('');setDraftTemplate({title:{ru:''},items:[]});selectScreen('templateNew');}}><b style={{display:'block',fontSize:23}}>▤</b><strong>{t('createTemplate',lang)}</strong></button></div><div className="spread"><h2 className="section-title">{t('students',lang)}</h2><button className="link-button" onClick={()=>selectScreen('students')}>{t('open',lang)} →</button></div>{data.students.slice(0,3).map(s=><button key={s.id} className="tile" onClick={()=>{setSelectedStudent(s.id);selectScreen('studentDetail');}}>{avatar(s.name)}<span className="grow"><b>{s.name}</b><span className="small muted" style={{display:'block'}}>{assignmentsFor(s.id).length} {t('workout',lang).toLowerCase()}</span></span>›</button>)}</div>;
 }
 function studentsView(){if(screen==='studentDetail'){
 const list=assignmentsFor(selectedStudent);return <div className="view stack">{back('students')}{header(t('students',lang),currentStudent?.name||'—')}<div className="stats"><div className="stat-card"><strong>{list.length}</strong><span>{t('workout',lang)}</span></div><div className="stat-card"><strong>{list.filter(a=>a.status==='completed').length}</strong><span>{t('complete',lang)}</span></div><div className="stat-card"><strong>{percent(list.filter(a=>a.status==='completed').length,list.length)}%</strong><span>{t('progress',lang)}</span></div></div>{measurementPanel(selectedStudent)}<button className="btn primary full" onClick={()=>{setAssignStudent(selectedStudent);setAssignTemplate(data.templates[0]?.id||'');selectScreen('assign');}}>＋ {t('assign',lang)}</button><h2 className="section-title">{copy('Тренировки ученика','Student workouts','Treninzi učenika',lang)}</h2>{list.filter(a=>['planned','active'].includes(a.status)).map(a=><button className="btn coach-workout-link full" type="button" key={`coach-${a.id}`} onClick={()=>{setReportId(a.id);setWorkoutDraft({});selectScreen('coachWorkout');}}>{copy('✓ Отмечать подходы','✓ Track sets','✓ Beleži serije',lang)} · {templateTitle(a)}</button>)}<h2 className="section-title">{t('history',lang)}</h2>{list.map(a=><button key={a.id} className="tile" onClick={()=>{setReportId(a.id);selectScreen('reportDetail');}}><span className="grow"><b>{templateTitle(a)}</b><span className="small muted" style={{display:'block'}}>{isoDate(a.date,lang)} · {doneSets(a)}/{totalSets(a)} {t('sets',lang).toLowerCase()}</span></span>{statusLabel(a)}</button>)}{!list.length&&<div className="card empty">{t('noAssignments',lang)}</div>}</div>;
 }
 return <div className="view stack">{header(copy('ВАША КОМАНДА','YOUR CLIENTS','VAŠI KLIJENTI',lang),t('students',lang))}<button className="btn primary full" disabled={busy} onClick={()=>void invite()}>＋ {t('invite',lang)}</button>{inviteLink&&<div className="card stack"><b>{t('copyInvite',lang)}</b><input className="input invitation-input" aria-label={t('copyInvite',lang)} readOnly value={inviteLink} onFocus={e=>e.currentTarget.select()}/><div className="invite-actions"><button type="button" className="btn primary" onClick={()=>void clipboardCopy(inviteLink)}>{copy('Скопировать','Copy link','Kopiraj link',lang)}</button><button type="button" className="btn" onClick={()=>void shareInvite()}>{copy('Поделиться','Share','Podeli',lang)}</button></div><small>{copy('Одноразовая ссылка действительна 7 дней','Single-use link expires in 7 days','Link važi 7 dana, samo jednom',lang)}</small></div>}<h2 className="section-title">{t('students',lang)} · {data.students.length}</h2>{data.students.map(s=><button key={s.id} className="tile" onClick={()=>{setSelectedStudent(s.id);selectScreen('studentDetail');}}>{avatar(s.name)}<span className="grow"><b>{s.name}</b><span className="small muted" style={{display:'block'}}>{assignmentsFor(s.id).filter(a=>a.status==='completed').length}/{assignmentsFor(s.id).length} {t('complete',lang).toLowerCase()}</span><ProgressBar value={percent(assignmentsFor(s.id).filter(a=>a.status==='completed').length,assignmentsFor(s.id).length)}/></span><span>›</span></button>)}{!data.students.length&&<div className="card empty">{t('noStudents',lang)}</div>}</div>;
 }
 function exercisesView(){if(screen==='exerciseDetail'&&currentExercise){const ex=currentExercise;return <div className="view stack">{back(returnScreen)}{header(localized(groups[ex.group]||groups.other,lang),exText(ex,lang,'name'))}{ex.photoUrl?<img className="exercise-photo" src={safeMedia(ex.photoUrl)} alt={exText(ex,lang,'name')}/>:<div className="screen-cover">✦</div>}<div className="card stack"><h2 className="section-title">{t('technique',lang)}</h2><p className="detail-paragraph">{exText(ex,lang,'description')||'—'}</p><hr className="divider"/><h2 className="section-title">{t('faq',lang)}</h2><p className="detail-paragraph">{exText(ex,lang,'faq')||'—'}</p></div><h2 className="section-title">{t('video',lang)}</h2><Video url={ex.videoUrl} lang={lang}/>{mode==='coach'&&<button type="button" className="btn full" onClick={()=>{setEditingExerciseId(ex.workspaceId?ex.id:'');setDraftExercise({group:ex.group,equipment:ex.equipment,photoUrl:ex.photoUrl,videoUrl:ex.videoUrl,translations:structuredClone(ex.translations)});setDraftLang(lang);selectScreen('exerciseNew');}}>{ex.workspaceId?copy('Редактировать упражнение','Edit exercise','Uredi vežbu',lang):copy('Создать свою версию','Create my own version','Napravi svoju verziju',lang)}</button>}</div>;
 }
 if(screen==='exerciseNew'&&mode==='coach')return <form className="view stack" onSubmit={e=>void addExercise(e)}>{back('exercises')}{header(copy('КАТАЛОГ','LIBRARY','BIBLIOTEKA',lang),t('createExercise',lang))}<div className="card stack"><label className="field">{t('group',lang)}<select value={draftExercise.group} onChange={e=>setDraftExercise(d=>({...d,group:e.target.value}))}>{Object.keys(groups).map(g=><option key={g} value={g}>{localized(groups[g],lang)}</option>)}</select></label><label className="field">{t('equipment',lang)}<input className="input" value={draftExercise.equipment} maxLength={120} onChange={e=>setDraftExercise(d=>({...d,equipment:e.target.value}))}/></label><div className="chips">{(['ru','en','sr'] as Language[]).map(l=><button type="button" key={l} className={`chip ${draftLang===l?'on':''}`} onClick={()=>setDraftLang(l)}>{l.toUpperCase()}</button>)}</div><label className="field">{t('name',lang)} ({draftLang.toUpperCase()})<input required={draftLang==='ru'&&!Object.values(draftExercise.translations).some(x=>x.name.trim())} className="input" maxLength={120} value={draftExercise.translations[draftLang]?.name||''} onChange={e=>setDraftTranslation('name',e.target.value)}/></label><label className="field">{t('technique',lang)}<textarea maxLength={3000} value={draftExercise.translations[draftLang]?.description||''} onChange={e=>setDraftTranslation('description',e.target.value)}/></label><label className="field">{t('faq',lang)}<textarea maxLength={2000} value={draftExercise.translations[draftLang]?.faq||''} onChange={e=>setDraftTranslation('faq',e.target.value)}/></label><div className="meta">{copy('Переводы сохраняются отдельно для каждого языка','Translations are saved separately by language','Prevodi se čuvaju odvojeno po jeziku',lang)}</div><label className="field">{t('photo',lang)}<input className="input" type="url" placeholder="https://..." value={draftExercise.photoUrl} onChange={e=>setDraftExercise(d=>({...d,photoUrl:e.target.value}))}/></label><label className="field">{t('video',lang)}<input className="input" type="url" placeholder="https://..." value={draftExercise.videoUrl} onChange={e=>setDraftExercise(d=>({...d,videoUrl:e.target.value}))}/></label></div><button disabled={busy} className="btn primary full" type="submit">{t('save',lang)}</button></form>;
 return <div className="view stack">{header(copy('БИБЛИОТЕКА','LIBRARY','BIBLIOTEKA',lang),t('exercises',lang),copy('База упражнений с видео и описаниями','Exercises with videos and guides','Vežbe sa video zapisima i uputstvima',lang))}{mode==='coach'&&<button className="btn primary full" onClick={()=>{setDraftExercise(newDraft());setDraftLang(lang);selectScreen('exerciseNew');}}>＋ {t('createExercise',lang)}</button>}<input className="input" aria-label={t('search',lang)} placeholder={`⌕  ${t('search',lang)}`} value={search} onChange={e=>setSearch(e.target.value)}/><div className="chips">{['all',...Object.keys(groups)].map(g=><button type="button" className={`chip ${group===g?'on':''}`} key={g} onClick={()=>setGroup(g)}>{g==='all'?copy('Все','All','Sve',lang):localized(groups[g],lang)}</button>)}</div><div className="library-list">{data.exercises.filter(ex=>(group==='all'||ex.group===group)&&(!search||`${exText(ex,lang,'name')} ${ex.equipment}`.toLowerCase().includes(search.toLowerCase()))).map(ex=>exCard(ex,()=>{setExerciseId(ex.id);setReturnScreen('exercises');selectScreen('exerciseDetail');}))}</div>{!data.exercises.length&&<div className="card empty">{t('addFirst',lang)}</div>}</div>;
 }
 function templatesView(){if(screen==='templateNew')return <form className="view stack" onSubmit={e=>void addTemplate(e)}>{back('templates')}{header(copy('КОНСТРУКТОР','BUILDER','KREATOR',lang),t('createTemplate',lang))}<div className="card stack"><label className="field">{t('workoutTitle',lang)}<input className="input" required maxLength={120} value={draftTemplate.title[lang]||''} onChange={e=>setDraftTemplate(d=>({...d,title:{...d.title,[lang]:e.target.value}}))}/></label><div className="small muted">{copy('Название можно перевести, переключив язык приложения','Switch app language to add a translation','Promenite jezik da biste dodali prevod',lang)}</div></div><h2 className="section-title">{t('exercises',lang)} · {draftTemplate.items.length}</h2>{draftTemplate.items.map((i,n)=><div className="exercise" key={i.id}><div className="spread"><div className="row"><span className="ex-number">{n+1}</span><b>{exerciseName(i.exerciseId)}</b></div><button type="button" className="link-button" onClick={()=>setDraftTemplate(d=>({...d,items:d.items.filter(x=>x.id!==i.id)}))}>✕</button></div><div className="two-col" style={{marginTop:12}}>{(['sets','reps','weight','rest'] as const).map(f=><label className="field" key={f}>{t(f,lang)}<input type="number" className="input" min={f==='sets'||f==='reps'?1:0} max={f==='sets'?30:f==='reps'?1000:f==='weight'?9999:3600} value={i[f]} onChange={e=>updateTemplateItem(i.id,f,e.target.value)}/></label>)}</div></div>)}<h2 className="section-title">＋ {t('addToTemplate',lang)}</h2>{data.exercises.map(ex=>exCard(ex,()=>addTemplateExercise(ex)))}<button disabled={busy||!draftTemplate.items.length} className="btn primary full" type="submit">{t('save',lang)}</button></form>;
 return <div className="view stack">{header(copy('КОНСТРУКТОР','BUILDER','KREATOR',lang),t('templates',lang))}<button className="btn primary full" onClick={()=>{setEditingTemplateId('');setDraftTemplate({title:{ru:''},items:[]});selectScreen('templateNew');}}>＋ {t('createTemplate',lang)}</button>{data.templates.map(w=><div className="card stack" key={w.id}><div className="row"><span className="ex-number">▤</span><span className="grow"><b>{templateTitle(w)}</b><span className="small muted" style={{display:'block'}}>{w.items.length} {t('exercises',lang).toLowerCase()} · {w.items.reduce((n,i)=>n+i.sets,0)} {t('sets',lang).toLowerCase()}</span></span></div><hr className="divider"/>{w.items.map(i=><div key={i.id} className="spread small"><span>{exerciseName(i.exerciseId)}</span><b>{i.sets} × {i.reps}</b></div>)}</div>)}{!data.templates.length&&<div className="card empty">{t('noTemplates',lang)}</div>}</div>;
 }
 function assignView(){return <form className="view stack" onSubmit={e=>void assign(e)}>{back('students')}{header(copy('ПЛАНИРОВАНИЕ','SCHEDULE','RASPORED',lang),t('assign',lang))}<div className="card stack"><label className="field">{t('studentPicker',lang)}<select required value={assignStudent} onChange={e=>setAssignStudent(e.target.value)}><option value="">—</option>{data.students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="field">{t('templatePicker',lang)}<select required value={assignTemplate} onChange={e=>setAssignTemplate(e.target.value)}><option value="">—</option>{data.templates.filter(w=>w.items.length).map(w=><option key={w.id} value={w.id}>{templateTitle(w)}</option>)}</select></label><label className="field">{t('date',lang)}<input type="date" className="input" required value={assignDate} onChange={e=>setAssignDate(e.target.value)}/></label></div><button type="submit" className="btn primary full" disabled={busy||!data.students.length||!data.templates.some(w=>w.items.length)}>{t('assign',lang)}</button></form>;
 }
 function reportView(){if(screen==='reportDetail'&&currentReport){const a=currentReport;return <div className="view stack">{back('reports')}{header(isoDate(a.date,lang),templateTitle(a))}<div className="spread">{statusLabel(a)}<b>{doneSets(a)}/{totalSets(a)} {t('sets',lang).toLowerCase()}</b></div><ProgressBar value={percent(doneSets(a),totalSets(a))}/>{a.items.map((i,index)=><div className="card stack" key={i.id}><b>{index+1}. {exerciseName(i.exerciseId)}</b>{Array.from({length:i.sets},(_,j)=>{const l=i.logs.find(x=>x.setIndex===j);return <div className="spread small" key={j}><span>{j+1}. {l?.done?'✓':'○'}</span><span>{l?.reps??'—'} × {l?.weight??'—'} {t('weight',lang).split(',')[1]||'kg'}</span></div>;})}</div>)}{a.note&&<div className="card"><b>{t('comment',lang)}</b><p className="detail-paragraph">{a.note}</p></div>}{['planned','active'].includes(a.status)&&<button className="btn primary full" onClick={()=>{setWorkoutDraft({});selectScreen('coachWorkout');}}>{copy('Отмечать подходы ученика','Track student sets','Beleži serije učenika',lang)}</button>}{videoReview(a,true)}</div>;
 }
 return <div className="view stack">{header(copy('АКТИВНОСТЬ','ACTIVITY','AKTIVNOST',lang),t('reports',lang))}{data.assignments.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(a=><button key={a.id} className="tile" onClick={()=>{setReportId(a.id);selectScreen('reportDetail');}}><span className="grow"><b>{templateTitle(a)}</b><span className="small muted" style={{display:'block'}}>{data.students.find(s=>s.id===a.studentId)?.name||'—'} · {isoDate(a.date,lang)} · {doneSets(a)}/{totalSets(a)}</span></span>{a.pendingVideos? <span className="badge blue">🎥 {a.pendingVideos}</span>:null}{statusLabel(a)}</button>)}{!data.assignments.length&&<div className="card empty">{t('noResults',lang)}</div>}</div>;
 }
 function workoutView(){if(!shownAssignment)return <div className="view stack">{header(t('today',lang),t('workout',lang))}<div className="card empty">{t('noAssignments',lang)}</div></div>;
 const a=shownAssignment;return <div className="view stack">{mode==='coach'&&back('studentDetail')}{header(mode==='coach'?copy('Совместная тренировка','Coach-assisted workout','Trening sa trenerom',lang):isoDate(a.date,lang),templateTitle(a))}<div className="spread"><span className="small muted">{t('sets',lang)}</span><b>{doneSets(a)}/{totalSets(a)}</b></div><ProgressBar value={percent(doneSets(a),totalSets(a))}/>{a.items.map((item,n)=><div key={item.id} className="exercise stack"><div className="row"><span className="ex-number">{n+1}</span><span className="grow"><b>{exerciseName(item.exerciseId)}</b><span className="small muted" style={{display:'block'}}>{item.sets} × {item.reps} · {item.weight} kg · {item.rest}s</span></span><button type="button" className="link-button" onClick={()=>{setExerciseId(item.exerciseId);setReturnScreen(mode==='coach'?'coachWorkout':'workout');selectScreen('exerciseDetail');}}>ⓘ</button></div><div className="set-row small muted" style={{marginTop:12}}><span>№</span><span style={{textAlign:'center'}}>{t('reps',lang)}</span><span style={{textAlign:'center'}}>{t('weight',lang)}</span><span>✓</span></div>{Array.from({length:item.sets},(_,i)=>{const log=item.logs.find(l=>l.setIndex===i);const key=`${item.id}-${i}`;const values=workoutDraft[key]||{reps:log?.reps??item.reps,weight:log?.weight??item.weight};return <div className="set-row" key={i}><b className="small">{i+1}</b><input aria-label={`${t('reps',lang)} ${i+1}`} type="number" inputMode="numeric" min="0" max="1000" value={values.reps} onChange={e=>setWorkoutDraft(d=>({...d,[key]:{...values,reps:num(e.target.value)}}))}/><input aria-label={`${t('weight',lang)} ${i+1}`} type="number" inputMode="decimal" min="0" max="9999" step="0.5" value={values.weight} onChange={e=>setWorkoutDraft(d=>({...d,[key]:{...values,weight:num(e.target.value)}}))}/><button className={log?.done?'checked':''} type="button" disabled={busy} aria-pressed={Boolean(log?.done)} aria-label={`Set ${i+1}: ${log?.done?'done':'not done'}`} onClick={()=>void toggleSet(a,item,i)}>{log?.done?'✓':'○'}</button></div>;})}{mode==='student'&&videoPicker(a,item)}{(videosByAssignment[a.id]||[]).some(v=>v.itemId===item.id)&&videoReview(a,mode==='coach',item.id)}</div>)}<div className="card stack"><label className="field">{mode==='coach'?copy('Комментарий тренера','Coach note','Napomena trenera',lang):t('comment',lang)}<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={2000}/></label><label className="field">RPE · {effort}/10<input type="range" min="1" max="10" value={effort} onChange={e=>setEffort(Number(e.target.value))}/></label><button className="btn primary full" disabled={!doneSets(a)||busy} onClick={()=>void finishWorkout(a)}>{t('finish',lang)}</button></div></div>;
 }
 function historyView(){const completed=myAssignments.filter(a=>a.status==='completed');return <div className="view stack">{header(copy('РЕЗУЛЬТАТЫ','YOUR RESULTS','REZULTATI',lang),t('history',lang))}{measurementPanel(studentId)}{completed.map(a=><div key={a.id} className="card stack"><div className="spread"><b>{templateTitle(a)}</b>{statusLabel(a)}</div><div className="small muted">{isoDate(a.date,lang)} · {doneSets(a)}/{totalSets(a)} {t('sets',lang).toLowerCase()} · RPE {a.effort}/10</div>{a.items.map(i=><div className="spread small" key={i.id}><span>{exerciseName(i.exerciseId)}</span><b>{i.logs.filter(l=>l.done).length}/{i.sets}</b></div>)}{a.note&&<p className="detail-paragraph">{a.note}</p>}{a.items.map(item=><div key={`upload-${item.id}`}>{videoPicker(a,item)}</div>)}<button type="button" className="btn full" onClick={()=>void loadVideos(a.id).catch(fail)}>{copy('Показать проверки','View feedback','Prikaži pregled',lang)}</button>{(videosByAssignment[a.id]||[]).length>0&&videoReview(a,false)}</div>)}{!completed.length&&<div className="card empty">{t('noResults',lang)}</div>}</div>;
 }
 if(!ready)return <div id="phone"><header className="top"><div className="brand"><span className="mark">↗</span> Fat2Fit</div></header><main id="stage" className="view"><div className="card">{copy('Загрузка…','Loading…','Učitavanje…',lang)}</div></main></div>;
 if(!DEMO&&!workspaceId)return <div id="phone"><header className="top"><div className="brand"><span className="mark">↗</span> Fat2Fit</div></header><main id="stage" className="view stack"><div className="card stack">
 <h2>{error?copy('Не удалось войти','Sign-in failed','Prijava nije uspela',lang):copy('Нет доступа','Access required','Pristup nije dozvoljen',lang)}</h2>
 {error?<><p className="small muted">{copy('Ошибка входа на сервере. Проверьте настройки подключения и повторите попытку.','The server could not complete sign-in. Check the connection settings and retry.','Server nije uspeo da dovrši prijavu. Proverite podešavanja i pokušajte ponovo.',lang)}</p><p className="small muted">{error}</p><button type="button" className="btn primary full" onClick={()=>window.location.reload()}>{copy('Повторить вход','Retry sign-in','Pokušaj ponovo',lang)}</button></>
 :<p className="small muted">{copy('Откройте Mini App по приглашению тренера. Если вы тренер, ваш Telegram ID должен быть добавлен администратором.','Open the Mini App with a coach invitation. Coaches must be added by an administrator.','Otvorite Mini App preko pozivnice trenera.',lang)}</p>}
 </div></main></div>;
 let content:React.ReactNode;
 if(screen==='dashboard')content=dashboard();else if(screen==='students'||screen==='studentDetail')content=studentsView();else if(screen==='exercises'||screen==='exerciseDetail'||screen==='exerciseNew')content=exercisesView();else if(screen==='templates'||screen==='templateNew')content=templatesView();else if(screen==='assign')content=assignView();else if(screen==='reports'||screen==='reportDetail')content=reportView();else if(screen==='workout'||screen==='coachWorkout')content=workoutView();else content=historyView();
 return <div id="phone"><header className="top"><div className="topline"><div className="brand"><span className="mark" aria-hidden="true">↗</span><span>Fat2Fit</span>{DEMO&&<span className="preview">{t('preview',lang)}</span>}</div><div className="top-actions"><select className="lang-select" aria-label={t('language',lang)} value={lang} onChange={e=>changeLanguage(e.target.value as Language)}><option value="ru">RU</option><option value="en">EN</option><option value="sr">SR</option></select>{DEMO&&<div className="role">{(['coach','student'] as Role[]).map(r=><button type="button" className={mode===r?'on':''} key={r} aria-pressed={mode===r} onClick={()=>{setMode(r);setScreen('dashboard');setError('');}}>{t(r,lang)}</button>)}</div>}</div></div></header>{error&&<div role="alert" className="alert" style={{background:'#fff0f0',color:'#9a3440'}}>{error}<button type="button" className="link-button" onClick={()=>setError('')}>✕</button></div>}{toast&&<div className="alert" role="status">{toast}</div>}<main id="stage">{content}<p className="footer-note">{DEMO?copy('Деморежим · данные в браузере','Demo mode · browser data','Demo režim · podaci u pregledaču',lang):t('signedIn',lang)}</p></main><nav className={`bottom ${mode==='student'?'student':''}`} aria-label="Fat2Fit">{navs.map(({screen:s,icon,key})=><button type="button" key={s} aria-current={currentTab===s?'page':undefined} onClick={()=>selectScreen(s)}><span className="ico" aria-hidden="true">{icon}</span><span className="txt">{t(key,lang)}</span></button>)}</nav></div>;
}
