'use client';
import React,{useCallback,useEffect,useMemo,useState} from 'react';
import type {Assignment,AssignmentItem,Exercise,Language,Localized,Me,Role,SetLog,Student,WorkoutItem,WorkoutTemplate,WorkoutType} from '@/lib/types';
import {t,localized,exText,groups,type Phrase} from '@/lib/i18n';
import {demoWorkspaceId,dateShift,isLang,seedDemo,type DemoData} from '@/lib/demo';
import {api} from '@/lib/api-client';
import {videoExtension} from '@/lib/video-rules';
import {compareMeasurements} from '@/lib/report-schedule';

type Screen='dashboard'|'students'|'studentDetail'|'coachWorkout'|'exercises'|'exerciseDetail'|'exerciseNew'|'templates'|'templateNew'|'assign'|'reports'|'reportDetail'|'workout'|'history';
type WorkoutVideo={id:string;itemId:string;setIndex:number|null;status:'uploading'|'pending'|'approved'|'changes_requested';reviewNote:string;createdAt:string;studentId:string;url:string};
type BodyMeasurement={id:string;measuredOn:string;weightKg:number|null;muscleMassKg:number|null;waistCm:number|null;chestCm:number|null;bicepsCm:number|null;thighCm:number|null;hipsCm:number|null;note:string;updatedAt:string};
type DashboardFilter='all'|'today'|'tomorrow'|'workouts'|'videos';
type MeasurementReminder={studentId:string;studentName:string;dueOn:string;status:'pending'|'sent'};
type CoachDashboard={today:number;tomorrow:number;workoutsPending:number;videosPending:number;reminders:MeasurementReminder[]};
type MeasureKey='weightKg'|'muscleMassKg'|'waistCm'|'chestCm'|'bicepsCm'|'thighCm'|'hipsCm';
const measureFields:{key:MeasureKey;label:[string,string,string];unit:string;min:number;max:number}[]=[
 {key:'weightKg',label:['Вес','Weight','Težina'],unit:'kg',min:10,max:500},
 {key:'muscleMassKg',label:['Мышечная масса','Muscle mass','Mišićna masa'],unit:'kg',min:1,max:300},
 {key:'waistCm',label:['Объём талии','Waist','Struk'],unit:'cm',min:20,max:300},
 {key:'chestCm',label:['Объём груди','Chest','Grudi'],unit:'cm',min:20,max:300},
 {key:'bicepsCm',label:['Объём бицепса','Biceps','Biceps'],unit:'cm',min:10,max:150},
 {key:'thighCm',label:['Объём бедра','Thigh','Butina'],unit:'cm',min:10,max:200},
 {key:'hipsCm',label:['Объём бёдер','Hips','Kukovi'],unit:'cm',min:20,max:300}
];
type DraftExercise={group:string;equipment:string;photoUrl:string;videoUrl:string;translations:Exercise['translations']};
type DraftTemplate={title:Localized;items:WorkoutItem[];workoutType:WorkoutType};
type WebApp={initData:string;initDataUnsafe?:{start_param?:string};ready?:()=>void;expand?:()=>void;openTelegramLink?:(url:string)=>void};
declare global {interface Window {Telegram?:{WebApp?:WebApp}}}
const DEMO=process.env.NEXT_PUBLIC_DEMO_MODE==='true';
const newDraft=():DraftExercise=>({group:'chest',equipment:'',photoUrl:'',videoUrl:'',translations:{ru:{name:'',description:'',coachTips:'',faq:''},en:{name:'',description:'',coachTips:'',faq:''},cg:{name:'',description:'',coachTips:'',faq:''}}});
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const tabs:{screen:Screen;icon:string;key:Phrase}[]=[{screen:'dashboard',icon:'⌂',key:'dashboard'},{screen:'students',icon:'♧',key:'students'},{screen:'exercises',icon:'◈',key:'exercises'},{screen:'templates',icon:'▤',key:'templates'},{screen:'reports',icon:'▥',key:'reports'}];
const studentTabs:{screen:Screen;icon:string;key:Phrase}[]=[{screen:'dashboard',icon:'⌂',key:'dashboard'},{screen:'workout',icon:'▤',key:'workout'},{screen:'exercises',icon:'◈',key:'exercises'},{screen:'history',icon:'▥',key:'history'}];
const trainingTypes:WorkoutType[]=['strength','circuit','cardio'];
const trainingLabel=(v:WorkoutType,lang:Language)=>v==='strength'?copy('Силовая','Strength','Snaga',lang):v==='circuit'?copy('Круговая','Circuit','Kružni',lang):copy('Кардио','Cardio','Kardio',lang);
const emptyData:DemoData={exercises:[],students:[],templates:[],assignments:[]};
const num=(v:string,def=0)=>{const n=Number(v);return Number.isFinite(n)?Math.max(0,n):def;};
const isoDate=(s:string,l:Language)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const [y,m,d]=s.split('-').map(Number);return new Intl.DateTimeFormat(l==='cg'?'cnr-Latn-ME':l==='en'?'en-GB':'ru-RU',{day:'numeric',month:'short'}).format(new Date(y,m-1,d));};
const percent=(done:number,total:number)=>total?Math.round(done/total*100):0;
const doneSets=(a:Assignment)=>a.items.reduce((s,i)=>s+i.logs.filter(l=>l.done).length,0);
const totalSets=(a:Assignment)=>a.items.reduce((s,i)=>s+i.sets,0);
function copy(ru:string,en:string,cg:string,lang:Language){return lang==='ru'?ru:lang==='en'?en:cg;}
function safeMedia(url:string){try{const u=new URL(url);return u.protocol==='https:'?u.toString():'';}catch{return '';}}
function Video({url,lang}:{url:string;lang:Language}){const safe=safeMedia(url);if(!safe)return <div className="media-empty"><span>▶</span><b>{copy('Видео пока не добавлено','Video is not available','Video još nije dodat',lang)}</b></div>;
  let embed='';try{const u=new URL(safe);const host=u.hostname.replace(/^www\./,'');if(host==='youtu.be')embed=u.pathname.split('/')[1]||'';if(['youtube.com','m.youtube.com'].includes(host))embed=u.searchParams.get('v')||'';}catch{}
  if(embed&&/^[\w-]{11}$/.test(embed))return <div className="video-wrap"><iframe title="Exercise video" src={`https://www.youtube-nocookie.com/embed/${embed}`} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>;
  return <a className="btn full primary" href={safe} target="_blank" rel="noopener noreferrer">▶ {copy('Открыть видео','Open video','Otvori video',lang)}</a>;
}
function ProgressBar({value}:{value:number}){return <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><i style={{width:`${value}%`}}/></div>;}

export default function Fat2Fit(){
 const [lang,setLang]=useState<Language>('ru'),[mode,setMode]=useState<Role>('coach'),[screen,setScreen]=useState<Screen>('dashboard');
 const [theme,setTheme]=useState<'light'|'dark'>('light');
 const [data,setData]=useState<DemoData>(emptyData),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[toast,setToast]=useState('');
 const [me,setMe]=useState<Me|null>(null),[workspaceId,setWorkspaceId]=useState('');
 const [studentId,setStudentId]=useState('anna'),[selectedStudent,setSelectedStudent]=useState(''),[exerciseId,setExerciseId]=useState(''),[reportId,setReportId]=useState('');
 const [search,setSearch]=useState(''),[group,setGroup]=useState('all');
 const [exerciseScope,setExerciseScope]=useState<'all'|'shared'|'mine'>('all');
 const [draftExercise,setDraftExercise]=useState<DraftExercise>(newDraft),[draftLang,setDraftLang]=useState<Language>('ru');
 const [draftTemplate,setDraftTemplate]=useState<DraftTemplate>({title:{ru:''},items:[],workoutType:'strength'});
 const [editingExerciseId,setEditingExerciseId]=useState(''),[editingTemplateId,setEditingTemplateId]=useState('');
 const [assignStudent,setAssignStudent]=useState(''),[assignTemplate,setAssignTemplate]=useState(''),[assignDate,setAssignDate]=useState(dateShift());
 const [assignSource,setAssignSource]=useState<'template'|'manual'>('template');
 const [manualTitle,setManualTitle]=useState('');
 const [manualType,setManualType]=useState<WorkoutType>('strength');
 const [manualItems,setManualItems]=useState<WorkoutItem[]>([]);
 const [inviteLink,setInviteLink]=useState(''),[workoutDraft,setWorkoutDraft]=useState<Record<string,{reps:number;weight:number}>>({}),[note,setNote]=useState(''),[effort,setEffort]=useState(6);
 const [bodyMeasurements,setBodyMeasurements]=useState<Record<string,BodyMeasurement[]>>({});
 const [bodyFirst,setBodyFirst]=useState<Record<string,BodyMeasurement|null>>({});
 const [bodyCounts,setBodyCounts]=useState<Record<string,number>>({});
 const [resultSummaryOpen,setResultSummaryOpen]=useState(false);
 const [coachDashboard,setCoachDashboard]=useState<CoachDashboard|null>(null);
 const [remindersOpen,setRemindersOpen]=useState(false);
 const [requestBusy,setRequestBusy]=useState(false);
 const [reportFilter,setReportFilter]=useState<DashboardFilter>('all');
 const [measureDate,setMeasureDate]=useState(dateShift());
 const [measureDraft,setMeasureDraft]=useState<Partial<Record<MeasureKey,string>>>({});
 const [measureNote,setMeasureNote]=useState('');
 const [measureBusy,setMeasureBusy]=useState(false);
 const [returnScreen,setReturnScreen]=useState<Screen>('exercises');
 const [videosByAssignment,setVideosByAssignment]=useState<Record<string,WorkoutVideo[]>>({});
 const [reviewNotes,setReviewNotes]=useState<Record<string,string>>({});
 const [uploadingVideo,setUploadingVideo]=useState(false);
 const [historyAccess,setHistoryAccess]=useState<'full'|'summary'>('full');
 const [workoutSummary,setWorkoutSummary]=useState({strength:0,circuit:0,cardio:0,total:0});
 const [historyBusy,setHistoryBusy]=useState(false);
 useEffect(()=>{
  try{
   const saved=localStorage.getItem('fat2fit-theme');
   if(saved==='light'||saved==='dark')setTheme(saved);
  }catch{}
 },[]);
 const changeTheme=()=>{
  const next=theme==='light'?'dark':'light';
  setTheme(next);
  try{localStorage.setItem('fat2fit-theme',next);}catch{}
 };
 const notify=(message:string)=>{setToast(message);setTimeout(()=>setToast(''),4200);};
 const measurementKey=(id:string,ws=workspaceId)=>`${ws}:${id}`;
 const loadCoachDashboard=useCallback(async(ws:string)=>{
  if(DEMO)return;
  const dashboard=await api<CoachDashboard>(`/coach-dashboard?workspaceId=${encodeURIComponent(ws)}&date=${dateShift()}`);
  setCoachDashboard(dashboard);
 },[]);
 const openDashboardList=(filter:DashboardFilter)=>{setReportFilter(filter);selectScreen('reports');};
 const requestMeasurements=async(reminder:MeasurementReminder,action:'send'|'skip')=>{
  if(requestBusy||!workspaceId)return;
  if(action==='skip'&&!window.confirm(copy('Пропустить этот ежемесячный отчёт?','Skip this monthly report?','Preskočiti ovaj mjesečni izvještaj?',lang)))return;
  setRequestBusy(true);setError('');
  try{
   await api('/measurement-requests','POST',{workspaceId,studentId:reminder.studentId,dueOn:reminder.dueOn,action});
   await loadCoachDashboard(workspaceId);
   notify(action==='send'?copy('Запрос отправлен ученику','Request sent to student','Zahtjev je poslat učeniku',lang):copy('Запрос пропущен','Request skipped','Zahtjev je preskočen',lang));
  }catch(e){fail(e);}finally{setRequestBusy(false);}
 };
 const reviewWorkout=async(a:Assignment,status:'approved'|'changes_requested')=>{
  if(busy)return;
  setBusy(true);setError('');
  try{
   await api(`/assignments/${a.id}/review`,'PATCH',{status,note:reviewNotes['workout-'+a.id]||''});
   await refresh();await loadCoachDashboard(workspaceId);
   notify(copy('Проверка тренировки сохранена','Workout review saved','Pregled treninga je sačuvan',lang));
  }catch(e){fail(e);}finally{setBusy(false);}
 };
 const fail=(e:unknown)=>setError(e instanceof Error?e.message:String(e));
 useEffect(()=>{
   if(!ready||DEMO||!workspaceId||mode!=='coach'||screen!=='dashboard')return;
   void loadCoachDashboard(workspaceId).catch(fail);
 },[ready,workspaceId,mode,screen,loadCoachDashboard]);
 useEffect(()=>{
   if(DEMO||!ready)return;
   const onForeground=()=>{if(!document.hidden&&workspaceId&&mode==='coach')void loadCoachDashboard(workspaceId).catch(fail);};
   document.addEventListener('visibilitychange',onForeground);
   return ()=>document.removeEventListener('visibilitychange',onForeground);
 },[ready,workspaceId,mode,loadCoachDashboard]);
 const loadSummary=useCallback(async(ws:string,id:string)=>{
  const response=await api<{counts:{strength:number;circuit:number;cardio:number};total:number;historyVisibility:'full'|'summary'}>(`/workout-summary?workspaceId=${encodeURIComponent(ws)}&studentId=${encodeURIComponent(id)}`);
  setWorkoutSummary({...response.counts,total:response.total});
  setHistoryAccess(response.historyVisibility);
 },[]);
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
    const storedRaw=(localStorage.getItem('fat2fit-03-lang') ?? localStorage.getItem('gymtrack-03-lang'));
     const stored=storedRaw==='sr'?'cg':storedRaw;
     if(stored&&isLang(stored)&&alive)setLang(stored);
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
    let newWorkspaceId='';
    if(start.startsWith('invite_')||q.get('invite')){
      const token=start.startsWith('invite_')?start.slice(7):start;
      try{const redeemed=await api<{workspaceId:string}>('/invitations/redeem','POST',{token});newWorkspaceId=redeemed.workspaceId;}catch(e){if(alive)fail(e);}
    }
    const identity=await api<Me>('/me');if(!alive)return;
    setMe(identity);if(!stored||!isLang(stored))setLang(identity.language);
    const membership=identity.memberships.find(m=>m.workspaceId===newWorkspaceId)
      ||identity.memberships.find(m=>m.role==='coach')||identity.memberships[0];
    if(membership){setWorkspaceId(membership.workspaceId);setMode(membership.role);setStudentId(identity.id);setHistoryAccess(membership.historyVisibility||'full');await loadLive(membership.workspaceId,membership.role);await loadSummary(membership.workspaceId,identity.id);if(membership.role==='coach')await loadCoachDashboard(membership.workspaceId);}
    if(alive)setReady(true);
   }catch(e){if(alive){fail(e);setReady(true);}}
  };void init();return ()=>{alive=false;};
 },[loadLive,loadSummary,loadCoachDashboard]);
 useEffect(()=>{if(!ready)return;try{localStorage.setItem('fat2fit-03-lang',lang);if(DEMO)localStorage.setItem('fat2fit-03-demo',JSON.stringify(data));}catch{}},[data,lang,ready]);
 const refresh=async()=>{if(!DEMO&&workspaceId){await loadLive(workspaceId,mode);if(mode==='student')await loadSummary(workspaceId,studentId);else await loadCoachDashboard(workspaceId);}};
 useEffect(()=>{
   if(DEMO||!workspaceId||!['workout','coachWorkout'].includes(screen))return;
   let fetching=false;
   const interval=window.setInterval(()=>{if(document.hidden||fetching)return;fetching=true;void loadLive(workspaceId,mode).catch(fail).finally(()=>{fetching=false;});},5000);
   return ()=>window.clearInterval(interval);
 },[screen,workspaceId,mode,loadLive]);

 const changeLanguage=(l:Language)=>{setLang(l);if(!DEMO)void api('/me','PATCH',{language:l}).catch(fail);};
 const chooseWorkspace=(ws:string)=>{
  const member=me?.memberships.find(m=>m.workspaceId===ws);
  if(!member)return;
  setWorkspaceId(ws);setMode(member.role);setCoachDashboard(null);
  setInviteLink('');setReportId('');setSelectedStudent('');setReportFilter('all');
  setResultSummaryOpen(false);setExerciseScope('all');selectScreen('dashboard');
  void loadLive(ws,member.role).then(()=>loadSummary(ws,studentId)).then(()=>{
   if(member.role==='coach')return loadCoachDashboard(ws);
  }).catch(fail);
 };
 const selectScreen=(s:Screen)=>{setScreen(s);setError('');setSearch('');setGroup('all');};
 const canCoach=DEMO||Boolean(me?.memberships.some(m=>m.workspaceId===workspaceId&&m.role==='coach'));
 const switchMode=(role:Role)=>{
  if(role==='coach'&&!canCoach)return;
  setMode(role);selectScreen('dashboard');setInviteLink('');
  if(!DEMO&&workspaceId)void loadLive(workspaceId,role).then(()=>loadSummary(workspaceId,studentId)).catch(fail);
 };
 const setStudentHistory=async(id:string,value:'full'|'summary')=>{
  if(historyBusy||!canCoach)return;
  setHistoryBusy(true);
  try{
   if(DEMO)setData(d=>({...d,students:d.students.map(s=>s.id===id?{...s,historyVisibility:value}:s)}));
   else{await api(`/students/${id}/settings`,'PATCH',{workspaceId,historyVisibility:value});await refresh();}
   notify(copy('Настройки истории сохранены','History preference saved','Podešavanja istorije sačuvana',lang));
  }catch(e){fail(e);}finally{setHistoryBusy(false);}
 };
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
   selectScreen('exercises');notify(editingExerciseId?copy('Упражнение обновлено','Exercise updated','Vježba je izmijenjena',lang):copy('Упражнение добавлено','Exercise added','Vježba je dodata',lang));setEditingExerciseId('');
  }catch(e){fail(e);}finally{setBusy(false);}
 };
 const changeExerciseSharing=async(ex:Exercise)=>{
  if(!workspaceId||ex.workspaceId!==workspaceId||busy)return;
  setBusy(true);setError('');
  try{
   if(DEMO)updateData(d=>({...d,exercises:d.exercises.map(item=>item.id===ex.id
    ?{...item,isShared:!Boolean(item.isShared)}:item)}));
   else{
    await api(`/exercises/${ex.id}/sharing`,'PATCH',
     {workspaceId,isShared:!Boolean(ex.isShared)});
    await refresh();
   }
   notify(ex.isShared
    ?copy('Упражнение больше не публикуется','Exercise is now private','Vježba je sada privatna',lang)
    :copy('Упражнение доступно всем тренерам','Exercise shared with all coaches','Vježba je dostupna svim trenerima',lang));
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
 const assign=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(!assignStudent||(assignSource==='template'?!assignTemplate:!manualTitle.trim()||!manualItems.length))
   return setError(copy('Выберите ученика и тренировку','Choose a student and workout','Odaberite učenika i trening',lang));
  setBusy(true);try{
   if(DEMO){
    const templ=assignSource==='template'?data.templates.find(t=>t.id===assignTemplate):undefined;
    if(assignSource==='template'&&!templ)throw Error('No template');
    const chosen=templ?.items||manualItems;
    updateData(d=>({...d,assignments:[...d.assignments,{
     id:uid(),workspaceId:demoWorkspaceId,studentId:assignStudent,templateId:templ?.id||null,
     title:templ?.title||{[lang]:manualTitle.trim()},workoutType:templ?.workoutType||manualType,
     date:assignDate,status:'planned',items:chosen.map(i=>({...i,id:uid(),logs:[]})),note:'',effort:6
    }]}));
   }else{
    await api('/assignments','POST',assignSource==='template'
      ?{workspaceId,studentId:assignStudent,templateId:assignTemplate,date:assignDate}
      :{workspaceId,studentId:assignStudent,source:'manual',title:{[lang]:manualTitle.trim()},
         workoutType:manualType,items:manualItems,date:assignDate});
    await refresh();
   }
   setManualItems([]);setManualTitle('');
   if(assignStudent===studentId&&canCoach){switchMode('student');}else selectScreen('students');
   notify(copy('Тренировка назначена','Workout assigned','Trening je dodijeljen',lang));
  }catch(e){fail(e);}finally{setBusy(false);}
 };
 const invite=async()=>{setBusy(true);try{if(DEMO){setInviteLink('');notify(copy('Для реальной ссылки нужен Telegram и сервер','A real invite needs Telegram and server','Za pravi poziv potreban je Telegram i server',lang));}
  else{const result=await api<{link:string}>('/invitations','POST',{workspaceId});setInviteLink(result.link);}}
  catch(e){fail(e);}finally{setBusy(false);}
 };
 const clipboardCopy=async(text:string)=>{
  // Try synchronous selection first: iOS Telegram WebView often restricts
  // asynchronous clipboard access after the tap's user activation expires.
  const element=document.createElement('textarea');
  element.value=text;element.setAttribute('readonly','');
  element.style.position='fixed';element.style.top='0';element.style.left='0';element.style.opacity='0';
  document.body.appendChild(element);element.focus();element.select();element.setSelectionRange(0,text.length);
  let success=false;
  try{success=document.execCommand('copy');}catch{}
  document.body.removeChild(element);
  if(!success&&navigator.clipboard?.writeText){
   try{await navigator.clipboard.writeText(text);success=true;}catch{}
  }
  if(success)notify(copy('Скопировано','Copied','Kopirano',lang));
  else setError(copy('Автокопирование недоступно. Выделите ссылку в поле и скопируйте вручную или нажмите «Поделиться».','Automatic copy is unavailable. Select the link or tap Share.','Kopirajte vezu ručno ili izaberite Podeli.',lang));
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
  const response=await api<{measurements:BodyMeasurement[];firstMeasurement:BodyMeasurement|null;completedWorkouts:number}>(`/measurements?workspaceId=${encodeURIComponent(ws)}&studentId=${encodeURIComponent(id)}`);
  const key=`${ws}:${id}`;
  setBodyMeasurements(old=>({...old,[key]:response.measurements}));
  setBodyFirst(old=>({...old,[key]:response.firstMeasurement}));
  setBodyCounts(old=>({...old,[key]:response.completedWorkouts}));
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
    const row:BodyMeasurement={id:uid(),measuredOn:measureDate,weightKg:null,muscleMassKg:null,waistCm:null,chestCm:null,bicepsCm:null,thighCm:null,hipsCm:null,note:measureNote.trim(),updatedAt:new Date().toISOString()};
    for(const key of measureFields.map(x=>x.key)) if(typeof payload[key]==='number')row[key]=payload[key] as number;
    const key=measurementKey(id);
    const updated=[row,...(bodyMeasurements[key]||[]).filter(x=>x.measuredOn!==measureDate)].sort((a,b)=>b.measuredOn.localeCompare(a.measuredOn));
    setBodyMeasurements(old=>({...old,[key]:updated}));
    setBodyFirst(old=>({...old,[key]:updated[updated.length-1]||null}));
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
  const rows=bodyMeasurements[measurementKey(id)]||[];
  const latest=rows[0];
  const title=mode==='coach'?data.students.find(s=>s.id===id)?.name||'Fat2Fit':me?.name||'Fat2Fit';
  const completed=bodyCounts[measurementKey(id)]??data.assignments.filter(a=>a.studentId===id&&a.status==='completed').length;
  const report=`Fat2Fit — ${title}\n${copy('Завершено тренировок','Completed workouts','Završeni treninzi',lang)}: ${completed}${latest?'\n'+latest.measuredOn+'\n'+formatBody(latest):''}`;
  if(navigator.share){
   try{await navigator.share({text:report,title:'Fat2Fit'});return;}
   catch(e){if((e as Error)?.name==='AbortError')return;}
  }
  await clipboardCopy(report);
 };
 const measurementProgress=(id:string)=>{
  const key=measurementKey(id);
  const history=bodyMeasurements[key]||[];
  const first=bodyFirst[key]||history[history.length-1]||null;
  const latest=history[0]||null;
  const canCompare=Boolean(first&&latest&&first.id!==latest.id);
  const labels=lang==='ru'?0:lang==='en'?1:2;
  const changes=first&&latest?compareMeasurements(first,latest,measureFields.map(f=>f.key)):{};
  const fmt=(n:number)=>new Intl.NumberFormat(lang==='ru'?'ru-RU':lang==='en'?'en-GB':'sr-Latn-ME',
    {maximumFractionDigits:2}).format(n);
  return <section className="card stack results-summary">
   <button type="button" className="summary-toggle" aria-expanded={resultSummaryOpen}
    onClick={()=>setResultSummaryOpen(x=>!x)}>
    <span className="summary-title"><span className="results-symbol">↗</span><span>
     <strong>{copy('Мои результаты','My results','Moji rezultati',lang)}</strong>
     <small className="muted">{copy('Прогресс с первого отчёта','Progress since your first report','Napredak od prvog izvještaja',lang)}</small>
    </span></span>
    <span aria-hidden="true">{resultSummaryOpen?'⌃':'⌄'}</span>
   </button>
   {resultSummaryOpen&&<div className="results-expanded">
    {!first||!latest?<p className="small muted">{copy('Добавьте первый замер, чтобы отслеживать прогресс.','Add your first measurements to track progress.','Dodajte prva mjerenja kako biste pratili napredak.',lang)}</p>
    :<>
      <div className="result-date-grid">
       <div><small className="muted">{copy('Первый отчёт','First report','Prvi izvještaj',lang)}</small><strong>{first.measuredOn}</strong></div>
       <div><small className="muted">{copy('Последний отчёт','Latest report','Posljednji izvještaj',lang)}</small><strong>{latest.measuredOn}</strong></div>
      </div>
      <div className="result-compare-head"><b>{copy('Показатель','Metric','Parametar',lang)}</b><b>{copy('Было','Before','Bilo',lang)}</b><b>{copy('Стало','Now','Sada',lang)}</b><b>{copy('Изменение','Change','Promjena',lang)}</b></div>
      {measureFields.map(field=>{
       const before=first[field.key],after=latest[field.key];
       const delta=canCompare?changes[field.key]:null;
       return <div key={field.key} className="result-compare-row">
        <span>{field.label[labels]}</span>
        <span>{typeof before==='number'?fmt(before):'—'}</span>
        <span>{typeof after==='number'?fmt(after):'—'}</span>
        <strong>{typeof delta==='number'?`${delta>0?'+':delta<0?'−':''}${fmt(Math.abs(delta))} ${field.unit}`:'—'}</strong>
       </div>;
      })}
      {!canCompare&&<p className="small muted">{copy('Для расчёта изменений нужен второй отчёт.','A second report is needed to calculate changes.','Za prikaz promjena potreban je još jedan izvještaj.',lang)}</p>}
      <p className="small muted">{copy('Изменение = последний замер − первый. Положительное или отрицательное значение не означает оценку результата.','Change = latest minus first. Positive or negative is not a fitness judgment.','Promjena = posljednje mjerenje minus prvo. Predznak nije ocjena napretka.',lang)}</p>
     </>
    }
   </div>}
  </section>;
 };
 const measurementPanel=(id:string)=>{
  const rows=bodyMeasurements[measurementKey(id)]||[];
  const total=bodyCounts[measurementKey(id)]??data.assignments.filter(a=>a.studentId===id&&a.status==='completed').length;
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
   {rows.slice(0,12).map(m=><div className="measurement-record" key={m.id}><div className="spread"><b>{isoDate(m.measuredOn,lang)}</b><button type="button" className="link-button" onClick={()=>{const draft:Partial<Record<MeasureKey,string>>={};for(const f of measureFields)if(m[f.key]!=null)draft[f.key]=String(m[f.key]);setMeasureDate(m.measuredOn);setMeasureDraft(draft);setMeasureNote(m.note);}}>{copy('Изменить','Edit','Izmeni',lang)}</button></div><div className="measurement-grid small">{measureFields.filter(f=>m[f.key]!=null).map(f=><div key={f.key}><span className="muted">{fieldLabel(f)}</span><strong>{m[f.key]} {f.unit}</strong></div>)}</div>{m.note&&<p className="small muted">{m.note}</p>}</div>)}
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
 const setDraftTranslation=(key:'name'|'description'|'coachTips'|'faq',v:string)=>setDraftExercise(d=>({...d,translations:{...d.translations,[draftLang]:{...d.translations[draftLang], [key]:v}}}));
 const addTemplateExercise=(ex:Exercise)=>setDraftTemplate(d=>({...d,items:[...d.items,{id:uid(),exerciseId:ex.id,sets:3,reps:10,weight:0,rest:90}]}));
 const updateTemplateItem=(id:string,field:'sets'|'reps'|'weight'|'rest',value:string)=>setDraftTemplate(d=>({...d,items:d.items.map(i=>i.id===id?{...i,[field]:num(value)}:i)}));
 const navs=mode==='coach'?tabs:studentTabs;
 const currentTab:Screen=screen==='studentDetail'||screen==='assign'||screen==='coachWorkout'?'students':screen==='exerciseDetail'||screen==='exerciseNew'?'exercises':screen==='templateNew'?'templates':screen==='reportDetail'?'reports':screen;
 const header=(kicker:string,title:string,sub?:string)=><div><p className="kicker">{kicker}</p><h1 className="screen-heading">{title}</h1>{sub&&<p className="screen-sub">{sub}</p>}</div>;
 const back=(s:Screen)=><button type="button" className="back" onClick={()=>selectScreen(s)}>← {t('back',lang)}</button>;
 const avatar=(name:string)=><span className="avatar">{name.slice(0,1).toUpperCase()}</span>;
 const statusLabel=(a:Assignment)=><span className={`badge ${a.status==='completed'?'good':a.status==='active'?'blue':'warn'}`}>{t(a.status==='completed'?'complete':a.status,lang)}</span>;
 const exCard=(ex:Exercise,action:()=>void)=><button type="button" key={ex.id} className="exercise-tile" onClick={action}><span className="thumb">{ex.photoUrl?<img src={safeMedia(ex.photoUrl)} alt="" loading="lazy"/>:<span className="thumb-fallback">✦</span>}</span><span className="grow"><b>{exText(ex,lang,'name')}</b><span className="small muted" style={{display:'block'}}>{localized(groups[ex.group]||groups.other,lang)} · {ex.equipment||'—'}</span>
  {mode==='coach'&&<span className="exercise-access-meta">{ex.workspaceId===workspaceId
    ?ex.isShared?copy('Моё · опубликовано','Mine · shared','Moje · podijeljeno',lang):copy('Моё · личное','Mine · private','Moje · privatno',lang)
    :ex.workspaceId===null?copy('Общая база','Shared catalog','Zajednički katalog',lang)
    :ex.isShared?copy('От другого тренера','From another coach','Od drugog trenera',lang)
    :copy('Сохранено в тренировке','Used in a workout','Korišćeno u treningu',lang)}</span>}
  </span><span style={{color:'#7d9bc1'}}>›</span></button>;
 const assignmentsFor=(id:string)=>data.assignments.filter(a=>a.studentId===id).sort((a,b)=>b.date.localeCompare(a.date));

 function dashboard(){if(mode==='student')return <div className="view stack">{canCoach&&<button className="btn primary full" type="button" onClick={()=>{setAssignStudent(studentId);setAssignTemplate(data.templates[0]?.id||'');switchMode('coach');selectScreen('assign');}}>{copy('＋ Назначить тренировку себе','＋ Assign myself a workout','＋ Dodeli sebi trening',lang)}</button>}<div className="hero"><div className="eyebrow">{t('today',lang)} · {isoDate(dateShift(),lang)}</div><h2>{activeAssignment?templateTitle(activeAssignment):t('noAssignments',lang)}</h2><p>{activeAssignment?`${activeAssignment.items.length} ${t('exercises',lang).toLowerCase()} · ${totalSets(activeAssignment)} ${t('sets',lang).toLowerCase()}`:t('studentIntro',lang)}</p>{activeAssignment&&<button className="btn dark" onClick={()=>selectScreen('workout')}>{t('started',lang)} →</button>}</div><div className="stats"><div className="stat-card"><strong>{myAssignments.length}</strong><span>{t('workout',lang)}</span></div><div className="stat-card"><strong>{myAssignments.filter(a=>a.status==='completed').length}</strong><span>{t('complete',lang)}</span></div><div className="stat-card"><strong>{myAssignments.length?percent(myAssignments.filter(a=>a.status==='completed').length,myAssignments.length):0}%</strong><span>{t('progress',lang)}</span></div></div>{historyAccess==='summary'&&!canCoach?<div className="card stack"><b>{copy('Количество завершённых тренировок','Completed workouts by type','Završeni treninzi po vrsti',lang)}</b><div className="history-summary">{trainingTypes.map(type=><div key={type}><strong>{workoutSummary[type]}</strong><span>{trainingLabel(type,lang)}</span></div>)}</div></div>:null}<h2 className="section-title">{t('history',lang)}</h2>{(historyAccess==='summary'&&!canCoach?myAssignments.filter(a=>a.status!=='completed'&&a.status!=='skipped'):myAssignments).slice(0,3).map(a=><button key={a.id} className="tile" onClick={()=>{setReportId(a.id);selectScreen(a.status==='completed'?'history':'workout');}}><span className="grow"><b>{templateTitle(a)}</b><span className="small muted" style={{display:'block'}}>{isoDate(a.date,lang)}</span></span>{statusLabel(a)}</button>)}</div>;
 const completed=data.assignments.filter(a=>a.status==='completed').length;
 const pending=data.assignments.filter(a=>(a.pendingVideos||0)>0);
 return <div className="view stack"><section className="hero coach-control">
  <div className="eyebrow">{t('today',lang)} · {isoDate(dateShift(),lang)}</div>
  <h2>{!coachDashboard?copy('Загрузка сводки','Loading overview','Učitavanje pregleda',lang):
    coachDashboard.workoutsPending||coachDashboard.videosPending||coachDashboard.reminders.length
    ?copy('Требует внимания','Needs attention','Zahtijeva pažnju',lang)
    :copy('Всё под контролем','Everything on track','Sve je pod kontrolom',lang)}</h2>
  <div className="coach-kpi-grid">
   {([
    {label:copy('Тренировок сегодня','Workouts today','Treninga danas',lang),value:coachDashboard?.today,filter:'today'},
    {label:copy('Тренировок завтра','Workouts tomorrow','Treninga sjutra',lang),value:coachDashboard?.tomorrow,filter:'tomorrow'},
    {label:copy('Тренировок на проверке','Workouts awaiting review','Treninga za pregled',lang),value:coachDashboard?.workoutsPending,filter:'workouts'},
    {label:copy('Видео на проверке','Videos awaiting review','Video snimaka za pregled',lang),value:coachDashboard?.videosPending,filter:'videos'}
   ] as {label:string;value:number|undefined;filter:DashboardFilter}[]).map(k=>
    <button type="button" key={k.filter} className="coach-kpi" onClick={()=>openDashboardList(k.filter)}>
     <strong>{k.value??'—'}</strong><span>{k.label}</span>
    </button>)}
  </div>
  {Boolean(coachDashboard?.reminders.length)&&<div className="coach-reminder-box">
   <button type="button" className="coach-reminder-trigger" aria-expanded={remindersOpen} onClick={()=>setRemindersOpen(x=>!x)}>
    <span>🔔 {coachDashboard!.reminders.length===1?
     coachDashboard!.reminders[0].status==='sent'
      ?copy('Ожидаем замеры от','Awaiting measurements from','Čekamo mjerenja od',lang)+' '+coachDashboard!.reminders[0].studentName
      :copy('Запросить замеры у','Request measurements from','Zatraži mjerenja od',lang)+' '+coachDashboard!.reminders[0].studentName
     :copy('Запросы замеров','Measurement requests','Zahtjevi za mjerenja',lang)+' · '+coachDashboard!.reminders.length}</span>
    <span aria-hidden="true">{remindersOpen?'⌃':'›'}</span>
   </button>
   {remindersOpen&&<div className="coach-reminder-list">
    {coachDashboard!.reminders.map(item=><div className="coach-reminder-item" key={item.studentId+item.dueOn}>
     <div className="grow"><b>{item.studentName}</b><small>{copy('Дата отчёта','Report date','Datum izvještaja',lang)} {item.dueOn} · {item.status==='sent'?copy('Запрос отправлен','Sent','Poslato',lang):copy('Запросить','Request','Zatraži',lang)}</small></div>
     {item.status==='pending'&&<button type="button" disabled={requestBusy} className="btn sm dark" onClick={()=>void requestMeasurements(item,'send')}>{copy('Запросить','Request','Zatraži',lang)}</button>}
     <button type="button" disabled={requestBusy} className="coach-reminder-skip" onClick={()=>void requestMeasurements(item,'skip')}>{copy('Пропустить','Skip','Preskoči',lang)}</button>
    </div>)}
   </div>}
  </div>}
 </section><div className="stats"><div className="stat-card"><strong>{data.students.length}</strong><span>{t('students',lang)}</span></div><div className="stat-card"><strong>{completed}</strong><span>{t('complete',lang)}</span></div><div className="stat-card"><strong>{data.templates.length}</strong><span>{t('templates',lang)}</span></div></div>{pending.length>0&&<div className="card stack"><b>🎥 {copy('Видео ждут проверки','Videos awaiting review','Video čeka pregled',lang)} · {pending.reduce((n,a)=>n+(a.pendingVideos||0),0)}</b>{pending.slice(0,3).map(a=><button className="tile" type="button" key={`review-${a.id}`} onClick={()=>{setReportId(a.id);selectScreen('reportDetail');}}><span className="grow">{templateTitle(a)} · {data.students.find(s=>s.id===a.studentId)?.name||'—'}</span><span className="badge blue">{a.pendingVideos}</span></button>)}</div>}<button type="button" className="btn primary full new-workout-action" onClick={()=>{
  setAssignStudent('');
  setAssignTemplate('');
  setAssignDate(dateShift());
  setAssignSource(data.templates.some(x=>x.items.length)?'template':'manual');
  setManualTitle('');setManualItems([]);setManualType('strength');
  selectScreen('assign');
 }}>＋ {copy('Новая тренировка','New workout','Novi trening',lang)}</button><div className="spread"><h2 className="section-title">{t('students',lang)}</h2><button className="link-button" onClick={()=>selectScreen('students')}>{t('open',lang)} →</button></div>{data.students.slice(0,3).map(s=><button key={s.id} className="tile" onClick={()=>{setSelectedStudent(s.id);selectScreen('studentDetail');}}>{avatar(s.name)}<span className="grow"><b>{s.name}</b><span className="small muted" style={{display:'block'}}>{assignmentsFor(s.id).length} {t('workout',lang).toLowerCase()}</span></span>›</button>)}</div>;
 }
 function studentsView(){if(screen==='studentDetail'){
 const list=assignmentsFor(selectedStudent);return <div className="view stack">{back('students')}{header(t('students',lang),currentStudent?.name||'—')}<div className="stats"><div className="stat-card"><strong>{list.length}</strong><span>{t('workout',lang)}</span></div><div className="stat-card"><strong>{list.filter(a=>a.status==='completed').length}</strong><span>{t('complete',lang)}</span></div><div className="stat-card"><strong>{percent(list.filter(a=>a.status==='completed').length,list.length)}%</strong><span>{t('progress',lang)}</span></div></div><section className="history-privacy"><b>{copy('Доступ ученика к истории','Student history access','Pristup istoriji',lang)}</b><p className="small muted">{copy('Полная история показывает все упражнения и подходы. Сводка показывает только количество завершённых занятий по типам.','Full history shows exercises and sets. Summary shows completed workout counts by category only.','Puna istorija prikazuje vežbe i serije. Sažetak prikazuje broj treninga po tipu.',lang)}</p><label className="field">{copy('Что видит ученик','Student can see','Učenik može da vidi',lang)}<select disabled={historyBusy} value={currentStudent?.historyVisibility||'full'} onChange={e=>void setStudentHistory(selectedStudent,e.target.value as 'full'|'summary')}><option value="full">{copy('Вся история упражнений','Full workout history','Svi treninzi i vežbe',lang)}</option><option value="summary">{copy('Только количество тренировок по типам','Only totals by workout type','Samo broj treninga po vrsti',lang)}</option></select></label></section>{measurementPanel(selectedStudent)}<button className="btn primary full" onClick={()=>{setAssignStudent(selectedStudent);setAssignTemplate(data.templates[0]?.id||'');selectScreen('assign');}}>＋ {t('assign',lang)}</button><h2 className="section-title">{copy('Тренировки ученика','Student workouts','Treninzi učenika',lang)}</h2>{list.filter(a=>['planned','active'].includes(a.status)).map(a=><button className="btn coach-workout-link full" type="button" key={`coach-${a.id}`} onClick={()=>{setReportId(a.id);setWorkoutDraft({});selectScreen('coachWorkout');}}>{copy('✓ Отмечать подходы','✓ Track sets','✓ Beleži serije',lang)} · {templateTitle(a)}</button>)}<h2 className="section-title">{t('history',lang)}</h2>{list.map(a=><button key={a.id} className="tile" onClick={()=>{setReportId(a.id);selectScreen('reportDetail');}}><span className="grow"><b>{templateTitle(a)}</b><span className="small muted" style={{display:'block'}}>{isoDate(a.date,lang)} · {doneSets(a)}/{totalSets(a)} {t('sets',lang).toLowerCase()}</span></span>{statusLabel(a)}</button>)}{!list.length&&<div className="card empty">{t('noAssignments',lang)}</div>}</div>;
 }
 return <div className="view stack"><h2 className="section-title">{t('students',lang)} · {data.students.length}</h2>{data.students.map(s=><button key={s.id} className="tile" onClick={()=>{setSelectedStudent(s.id);selectScreen('studentDetail');}}>{avatar(s.name)}<span className="grow"><b>{s.name}</b><span className="small muted" style={{display:'block'}}>{assignmentsFor(s.id).filter(a=>a.status==='completed').length}/{assignmentsFor(s.id).length} {t('complete',lang).toLowerCase()}</span><ProgressBar value={percent(assignmentsFor(s.id).filter(a=>a.status==='completed').length,assignmentsFor(s.id).length)}/></span><span>›</span></button>)}{!data.students.length&&<div className="card empty">{t('noStudents',lang)}</div>}<button className="btn primary full" disabled={busy} onClick={()=>void invite()}>＋ {t('invite',lang)}</button>{inviteLink&&<div className="card stack"><b>{t('copyInvite',lang)}</b><input className="input invitation-input" aria-label={t('copyInvite',lang)} readOnly value={inviteLink} onFocus={e=>e.currentTarget.select()}/><div className="invite-actions"><button type="button" className="btn primary" onClick={()=>void clipboardCopy(inviteLink)}>{copy('Скопировать','Copy link','Kopiraj link',lang)}</button><button type="button" className="btn" onClick={()=>void shareInvite()}>{copy('Поделиться','Share','Podeli',lang)}</button></div><small>{copy('Одноразовая ссылка действительна 7 дней','Single-use link expires in 7 days','Link važi 7 dana, samo jednom',lang)}</small></div>}</div>;
 }
 function exercisesView(){if(screen==='exerciseDetail'&&currentExercise){const ex=currentExercise;return <div className="view stack">{back(returnScreen)}{header(localized(groups[ex.group]||groups.other,lang),exText(ex,lang,'name'))}{ex.photoUrl?<img className="exercise-photo" src={safeMedia(ex.photoUrl)} alt={exText(ex,lang,'name')}/>:<div className="screen-cover">✦</div>}<div className="card stack"><h2 className="section-title">{t('technique',lang)}</h2><p className="detail-paragraph">{exText(ex,lang,'description')||'—'}</p><hr className="divider"/><h2 className="section-title">{t('coachTips',lang)}</h2><p className="detail-paragraph">{exText(ex,lang,'coachTips')||'—'}</p><hr className="divider"/><h2 className="section-title">{t('faq',lang)}</h2><p className="detail-paragraph">{exText(ex,lang,'faq')||'—'}</p></div><h2 className="section-title">{t('video',lang)}</h2><Video url={ex.videoUrl} lang={lang}/>
 {mode==='coach'&&ex.workspaceId===workspaceId&&<section className="card stack exercise-sharing" aria-label={copy('Доступность упражнения','Exercise visibility','Vidljivost vježbe',lang)}>
  <div className="spread"><b>{copy('Доступ к упражнению','Exercise access','Pristup vježbi',lang)}</b>
   <span className={`badge ${ex.isShared?'good':'blue'}`}>{ex.isShared?copy('Общее','Shared','Zajedničko',lang):copy('Личное','Private','Privatno',lang)}</span>
  </div>
  <p className="small muted">{ex.isShared
   ?copy('Доступно всем тренерам. Их собственные изменения не затронут ваш оригинал.','Available to all coaches; their local edits do not change your original.','Dostupno svim trenerima. Njihove izmjene ne mijenjaju original.',lang)
   :copy('Пока видно только вашей команде. Публикация откроет только это упражнение, но не данные учеников.','Visible only to your team. Sharing exposes this exercise, not student data.','Vidljivo samo vašem timu. Dijeljenje ne otkriva podatke učenika.',lang)}</p>
  <button type="button" className={`btn full ${ex.isShared?'':'softblue'}`} disabled={busy} onClick={()=>void changeExerciseSharing(ex)}>
   {ex.isShared?copy('Сделать личным','Make private','Postavi kao privatno',lang):copy('Поделиться со всеми тренерами','Share with all coaches','Podijeli sa svim trenerima',lang)}
  </button>
 </section>}
 {mode==='coach'&&<button type="button" className="btn full" onClick={()=>{setEditingExerciseId(ex.id);setDraftExercise({group:ex.group,equipment:ex.equipment,photoUrl:ex.photoUrl,videoUrl:ex.videoUrl,translations:structuredClone(ex.translations)});setDraftLang(lang);selectScreen('exerciseNew');}}>{ex.workspaceId!==workspaceId?copy('Настроить для моей команды','Customize for my team','Prilagodi za moj tim',lang):copy('Редактировать упражнение','Edit exercise','Uredi vježbu',lang)}</button>}</div>;
 }
 if(screen==='exerciseNew'&&mode==='coach')return <form className="view stack" onSubmit={e=>void addExercise(e)}>{back('exercises')}{header(copy('КАТАЛОГ','LIBRARY','BIBLIOTEKA',lang),t('createExercise',lang))}<div className="card stack"><label className="field">{t('group',lang)}<select value={draftExercise.group} onChange={e=>setDraftExercise(d=>({...d,group:e.target.value}))}>{Object.keys(groups).map(g=><option key={g} value={g}>{localized(groups[g],lang)}</option>)}</select></label><label className="field">{t('equipment',lang)}<input className="input" value={draftExercise.equipment} maxLength={120} onChange={e=>setDraftExercise(d=>({...d,equipment:e.target.value}))}/></label><div className="chips">{(['ru','en','cg'] as Language[]).map(l=><button type="button" key={l} className={`chip ${draftLang===l?'on':''}`} onClick={()=>setDraftLang(l)}>{l.toUpperCase()}</button>)}</div><label className="field">{t('name',lang)} ({draftLang.toUpperCase()})<input required={draftLang==='ru'&&!Object.values(draftExercise.translations).some(x=>x.name.trim())} className="input" maxLength={120} value={draftExercise.translations[draftLang]?.name||''} onChange={e=>setDraftTranslation('name',e.target.value)}/></label><label className="field">{t('technique',lang)}<textarea maxLength={3000} value={draftExercise.translations[draftLang]?.description||''} onChange={e=>setDraftTranslation('description',e.target.value)}/></label><label className="field">{t('coachTips',lang)}<textarea maxLength={2000} placeholder={copy('Практические рекомендации ученику','Practical coaching cues','Praktični savjeti za učenika',lang)} value={draftExercise.translations[draftLang]?.coachTips||''} onChange={e=>setDraftTranslation('coachTips',e.target.value)}/></label><label className="field">{t('faq',lang)}<textarea maxLength={2000} value={draftExercise.translations[draftLang]?.faq||''} onChange={e=>setDraftTranslation('faq',e.target.value)}/></label><div className="meta">{copy('Переводы сохраняются отдельно для каждого языка','Translations are saved separately by language','Prevodi se čuvaju odvojeno po jeziku',lang)}</div><label className="field">{t('photo',lang)}<input className="input" type="url" placeholder="https://..." value={draftExercise.photoUrl} onChange={e=>setDraftExercise(d=>({...d,photoUrl:e.target.value}))}/></label><label className="field">{t('video',lang)}<input className="input" type="url" placeholder="https://..." value={draftExercise.videoUrl} onChange={e=>setDraftExercise(d=>({...d,videoUrl:e.target.value}))}/></label></div><button disabled={busy} className="btn primary full" type="submit">{t('save',lang)}</button></form>;
 return <div className="view stack">{mode==='coach'&&<button className="btn primary full" onClick={()=>{setDraftExercise(newDraft());setDraftLang(lang);selectScreen('exerciseNew');}}>＋ {t('createExercise',lang)}</button>}<input className="input" aria-label={t('search',lang)} placeholder={`⌕  ${t('search',lang)}`} value={search} onChange={e=>setSearch(e.target.value)}/>{mode==='coach'&&<div className="exercise-scope" role="group" aria-label={copy('Каталог упражнений','Exercise catalog','Katalog vježbi',lang)}>
 {(['all','shared','mine'] as const).map(scope=><button key={scope} type="button"
 className={exerciseScope===scope?'active':''} aria-pressed={exerciseScope===scope}
 onClick={()=>setExerciseScope(scope)}>
  {scope==='all'?copy('Все','All','Sve',lang)
   :scope==='shared'?copy('Общие','Shared','Zajedničke',lang)
   :copy('Мои','Mine','Moje',lang)}
 </button>)}</div>}
 <div className="chips">{['all',...Object.keys(groups)].map(g=><button type="button" className={`chip ${group===g?'on':''}`} key={g} onClick={()=>setGroup(g)}>{g==='all'?copy('Все','All','Sve',lang):localized(groups[g],lang)}</button>)}</div><div className="library-list">{data.exercises.filter(ex=>(exerciseScope==='all'||mode!=='coach'
  ||(exerciseScope==='mine'?ex.workspaceId===workspaceId:(ex.workspaceId===null||Boolean(ex.isShared))))
  &&(group==='all'||ex.group===group)&&(!search||`${exText(ex,lang,'name')} ${ex.equipment}`.toLowerCase().includes(search.toLowerCase()))).map(ex=>exCard(ex,()=>{setExerciseId(ex.id);setReturnScreen('exercises');selectScreen('exerciseDetail');}))}</div>{!data.exercises.length&&<div className="card empty">{t('addFirst',lang)}</div>}</div>;
 }
 function templatesView(){if(screen==='templateNew')return <form className="view stack" onSubmit={e=>void addTemplate(e)}>{back('templates')}{header(copy('КОНСТРУКТОР','BUILDER','KREATOR',lang),t('createTemplate',lang))}<div className="card stack"><label className="field">{t('workoutTitle',lang)}<input className="input" required maxLength={120} value={draftTemplate.title[lang]||''} onChange={e=>setDraftTemplate(d=>({...d,title:{...d.title,[lang]:e.target.value}}))}/></label><label className="field">{copy('Тип тренировки','Workout category','Vrsta treninga',lang)}<select value={draftTemplate.workoutType} onChange={e=>setDraftTemplate(d=>({...d,workoutType:e.target.value as WorkoutType}))}>{trainingTypes.map(x=><option key={x} value={x}>{trainingLabel(x,lang)}</option>)}</select></label><div className="small muted">{copy('Название можно перевести, переключив язык приложения','Switch app language to add a translation','Promenite jezik da biste dodali prevod',lang)}</div></div><h2 className="section-title">{t('exercises',lang)} · {draftTemplate.items.length}</h2>{draftTemplate.items.map((i,n)=><div className="exercise" key={i.id}><div className="spread"><div className="row"><span className="ex-number">{n+1}</span><b>{exerciseName(i.exerciseId)}</b></div><button type="button" className="link-button" onClick={()=>setDraftTemplate(d=>({...d,items:d.items.filter(x=>x.id!==i.id)}))}>✕</button></div><div className="two-col" style={{marginTop:12}}>{(['sets','reps','weight','rest'] as const).map(f=><label className="field" key={f}>{t(f,lang)}<input type="number" className="input" min={f==='sets'||f==='reps'?1:0} max={f==='sets'?30:f==='reps'?1000:f==='weight'?9999:3600} value={i[f]} onChange={e=>updateTemplateItem(i.id,f,e.target.value)}/></label>)}</div></div>)}<h2 className="section-title">＋ {t('addToTemplate',lang)}</h2>{data.exercises.map(ex=>exCard(ex,()=>addTemplateExercise(ex)))}<button disabled={busy||!draftTemplate.items.length} className="btn primary full" type="submit">{t('save',lang)}</button></form>;
 return <div className="view stack"><button className="btn primary full" onClick={()=>{setEditingTemplateId('');setDraftTemplate({title:{ru:''},items:[],workoutType:'strength'});selectScreen('templateNew');}}>＋ {t('createTemplate',lang)}</button>{data.templates.map(w=><div className="card stack" key={w.id}><div className="row"><span className="ex-number">▤</span><span className="grow"><b>{templateTitle(w)}</b><span className="small muted" style={{display:'block'}}>{trainingLabel(w.workoutType||'strength',lang)} · {w.items.length} {t('exercises',lang).toLowerCase()} · {w.items.reduce((n,i)=>n+i.sets,0)} {t('sets',lang).toLowerCase()}</span></span></div><hr className="divider"/>{w.items.map(i=><div key={i.id} className="spread small"><span>{exerciseName(i.exerciseId)}</span><b>{i.sets} × {i.reps}</b></div>)}<button type="button" className="btn full" onClick={()=>{setEditingTemplateId(w.id);setDraftTemplate({title:structuredClone(w.title),items:structuredClone(w.items),workoutType:w.workoutType||'strength'});selectScreen('templateNew');}}>{copy('Изменить тип или упражнения','Edit category or exercises','Uredi vrstu ili vežbe',lang)}</button></div>)}{!data.templates.length&&<div className="card empty">{t('noTemplates',lang)}</div>}</div>;
 }
 function assignView(){
  const manual=assignSource==='manual';
  const addManual=(ex:Exercise)=>{
   if(manualItems.length>=30)return setError(copy('Не больше 30 упражнений','30 exercises maximum','Najviše 30 vježbi',lang));
   setManualItems(old=>[...old,{id:uid(),exerciseId:ex.id,sets:3,reps:10,weight:0,rest:90}]);
  };
  const updateManual=(id:string,key:'sets'|'reps'|'weight'|'rest',value:string)=>{
   const min=key==='sets'||key==='reps'?1:0;
   const max=key==='sets'?30:key==='reps'?1000:key==='weight'?9999:3600;
   const amount=Math.min(max,Math.max(min,num(value)));
   setManualItems(old=>old.map(i=>i.id===id?{...i,[key]:amount}:i));
  };
  return <form className="view stack" onSubmit={e=>void assign(e)}>
   {back('students')}
   {header(copy('ПЛАНИРОВАНИЕ','SCHEDULE','PLANIRANJE',lang),t('assign',lang))}
   <div className="card stack">
    <label className="field">{t('studentPicker',lang)}
     <select required value={assignStudent} onChange={e=>setAssignStudent(e.target.value)}>
      <option value="">—</option>
      {canCoach&&me&&<option value={me.id}>{copy('Я сам(а) · мои тренировки','Myself · my workouts','Ja · moji treninzi',lang)}</option>}
      {data.students.map(student=><option key={student.id} value={student.id}>{student.name}</option>)}
     </select>
    </label>
    <p className="labelpad">{copy('Как создать тренировку','Workout source','Kako napraviti trening',lang)}</p>
    <div className="assignment-mode" role="group" aria-label={copy('Источник тренировки','Workout source','Izbor treninga',lang)}>
     <button type="button" aria-pressed={!manual} className={!manual?'active':''} onClick={()=>setAssignSource('template')}>{copy('По шаблону','From template','Iz šablona',lang)}</button>
     <button type="button" aria-pressed={manual} className={manual?'active':''} onClick={()=>setAssignSource('manual')}>{copy('Набрать упражнения','Pick exercises','Odaberi vježbe',lang)}</button>
    </div>
    {!manual&&<label className="field">{t('templatePicker',lang)}
     <select required value={assignTemplate} onChange={e=>setAssignTemplate(e.target.value)}>
      <option value="">—</option>
      {data.templates.filter(w=>w.items.length).map(w=><option key={w.id} value={w.id}>{templateTitle(w)}</option>)}
     </select>
    </label>}
    {manual&&<>
      <label className="field">{copy('Название тренировки','Workout title','Naziv treninga',lang)}
       <input className="input" required maxLength={120} value={manualTitle} onChange={e=>setManualTitle(e.target.value)} placeholder={copy('Тренировка на сегодня','Today’s workout','Današnji trening',lang)} />
      </label>
      <label className="field">{copy('Тип тренировки','Workout type','Vrsta treninga',lang)}
       <select value={manualType} onChange={e=>setManualType(e.target.value as WorkoutType)}>
        {trainingTypes.map(k=><option key={k} value={k}>{trainingLabel(k,lang)}</option>)}
       </select>
      </label>
    </>}
    <label className="field">{t('date',lang)}<input type="date" className="input" required value={assignDate} onChange={e=>setAssignDate(e.target.value)}/></label>
   </div>
   {manual&&<>
     <div className="spread"><h2 className="section-title">{copy('Добавленные упражнения','Selected exercises','Odabrane vježbe',lang)} · {manualItems.length}</h2></div>
     {manualItems.map((item,index)=><div className="exercise stack" key={item.id}>
      <div className="spread"><b>{index+1}. {exerciseName(item.exerciseId)}</b><button className="link-button" type="button" onClick={()=>setManualItems(v=>v.filter(x=>x.id!==item.id))} aria-label={copy('Убрать упражнение','Remove exercise','Ukloni vježbu',lang)}>✕</button></div>
      <div className="two-col">{(['sets','reps','weight','rest'] as const).map(field=><label className="field" key={field}>{t(field,lang)}
        <input type="number" className="input" inputMode="decimal" min={field==='sets'||field==='reps'?1:0} max={field==='sets'?30:field==='reps'?1000:field==='weight'?9999:3600} step={field==='weight'?'0.5':'1'} value={item[field]} onChange={e=>updateManual(item.id,field,e.target.value)}/>
      </label>)}</div>
     </div>)}
     <h2 className="section-title">{copy('Добавить упражнения из каталога','Add exercises from library','Dodaj vježbe iz kataloga',lang)}</h2>
     <input className="input" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={copy('Поиск по названию','Search by name','Pretraga po nazivu',lang)} aria-label={copy('Поиск упражнений','Search exercises','Pretraga vježbi',lang)}/>
     {data.exercises.filter(ex=>!search||exText(ex,lang,'name').toLowerCase().includes(search.toLowerCase())).map(ex=><button className="exercise-tile" type="button" key={ex.id} onClick={()=>addManual(ex)}>
      <span className="thumb"><span className="thumb-fallback">＋</span></span>
      <span className="grow"><b>{exText(ex,lang,'name')}</b><small className="small muted" style={{display:'block'}}>{localized(groups[ex.group]||groups.other,lang)}</small></span>
      <span className="badge blue">{copy('Добавить','Add','Dodaj',lang)}</span>
     </button>)}
   </>}
   <button type="submit" className="btn primary full" disabled={busy||!assignStudent||(manual?!manualItems.length||!manualTitle.trim():!assignTemplate)}>
    {t('assign',lang)}
   </button>
  </form>;
 }
 function reportView(){if(screen==='reportDetail'&&currentReport){const a=currentReport;return <div className="view stack">{back('reports')}{header(isoDate(a.date,lang),templateTitle(a))}<div className="spread">{statusLabel(a)}<b>{doneSets(a)}/{totalSets(a)} {t('sets',lang).toLowerCase()}</b></div><ProgressBar value={percent(doneSets(a),totalSets(a))}/>{a.items.map((i,index)=><div className="card stack" key={i.id}><b>{index+1}. {exerciseName(i.exerciseId)}</b>{Array.from({length:i.sets},(_,j)=>{const l=i.logs.find(x=>x.setIndex===j);return <div className="spread small" key={j}><span>{j+1}. {l?.done?'✓':'○'}</span><span>{l?.reps??'—'} × {l?.weight??'—'} {t('weight',lang).split(',')[1]||'kg'}</span></div>;})}</div>)}{a.note&&<div className="card"><b>{t('comment',lang)}</b><p className="detail-paragraph">{a.note}</p></div>}{['planned','active'].includes(a.status)&&<button className="btn primary full" onClick={()=>{setWorkoutDraft({});selectScreen('coachWorkout');}}>{copy('Отмечать подходы ученика','Track student sets','Beleži serije učenika',lang)}</button>}{videoReview(a,true)}
  {a.status==='completed'&&a.studentId!==studentId&&<section className="card stack">
   <h2 className="section-title">{copy('Проверка тренировки','Workout review','Pregled treninga',lang)}</h2>
   <p className="small muted">{a.reviewStatus==='approved'?copy('Тренировка подтверждена','Workout approved','Trening je odobren',lang):
    a.reviewStatus==='changes_requested'?copy('Запрошены исправления','Changes requested','Zatražene su izmjene',lang):
    copy('Ожидает решения тренера','Awaiting coach review','Čeka pregled trenera',lang)}</p>
   <label className="field">{copy('Комментарий ученику','Feedback to student','Komentar učeniku',lang)}
    <textarea value={reviewNotes['workout-'+a.id]??a.reviewNote??''} onChange={e=>setReviewNotes(x=>({...x,['workout-'+a.id]:e.target.value}))} maxLength={2000}/>
   </label>
   <div className="review-buttons">
    <button type="button" className="btn primary" disabled={busy} onClick={()=>void reviewWorkout(a,'approved')}>{copy('Подтвердить','Approve','Odobri',lang)}</button>
    <button type="button" className="btn" disabled={busy||!(reviewNotes['workout-'+a.id]??a.reviewNote??'').trim()} onClick={()=>void reviewWorkout(a,'changes_requested')}>{copy('Попросить исправить','Request changes','Zatraži izmjene',lang)}</button>
   </div>
  </section>}
  </div>;
 }
 const shown=data.assignments.filter(a=>{
  if(reportFilter!=='all'&&a.studentId===studentId)return false;
  if(reportFilter==='today')return a.date===dateShift();
  if(reportFilter==='tomorrow')return a.date===dateShift(1);
  if(reportFilter==='workouts')return a.status==='completed'&&a.reviewStatus==='pending';
  if(reportFilter==='videos')return (a.pendingVideos||0)>0;
  return true;
 }).sort((a,b)=>b.date.localeCompare(a.date));
 const filterName=reportFilter==='today'?copy('Тренировки сегодня','Today’s workouts','Treninzi danas',lang)
  :reportFilter==='tomorrow'?copy('Тренировки завтра','Tomorrow’s workouts','Treninzi sjutra',lang)
  :reportFilter==='workouts'?copy('Тренировки на проверке','Workouts to review','Treninzi za pregled',lang)
  :reportFilter==='videos'?copy('Видео на проверке','Videos to review','Video snimci za pregled',lang):t('reports',lang);
 return <div className="view stack">
 {reportFilter!=='all'&&<div className="spread"><span className="small muted">{filterName}</span><button type="button" className="btn" onClick={()=>setReportFilter('all')}>{copy('Все отчёты','All reports','Svi izvještaji',lang)}</button></div>}
 {shown.map(a=><button key={a.id} className="tile" onClick={()=>{setReportId(a.id);selectScreen('reportDetail');}}><span className="grow"><b>{templateTitle(a)}</b><span className="small muted" style={{display:'block'}}>{data.students.find(s=>s.id===a.studentId)?.name||'—'} · {isoDate(a.date,lang)} · {doneSets(a)}/{totalSets(a)}</span></span>{a.pendingVideos? <span className="badge blue">🎥 {a.pendingVideos}</span>:null}{statusLabel(a)}</button>)}{!shown.length&&<div className="card empty">{t('noResults',lang)}</div>}</div>;
 }
 function workoutView(){if(!shownAssignment)return <div className="view stack"><div className="card empty">{t('noAssignments',lang)}</div></div>;
 const a=shownAssignment;return <div className="view stack">{mode==='coach'&&back('studentDetail')}{header(mode==='coach'?copy('Совместная тренировка','Coach-assisted workout','Trening sa trenerom',lang):isoDate(a.date,lang),templateTitle(a))}
 {a.reviewStatus==='changes_requested'&&a.reviewNote&&<div className="card stack">
  <b>{copy('Тренер попросил внести исправления','Coach requested changes','Trener je zatražio izmjene',lang)}</b>
  <p className="detail-paragraph">{a.reviewNote}</p>
  <p className="small muted">{copy('Исправьте подходы и завершите тренировку ещё раз.','Update your sets and finish the workout again.','Ispravite serije i ponovo završite trening.',lang)}</p>
 </div>}
 <div className="spread"><span className="small muted">{t('sets',lang)}</span><b>{doneSets(a)}/{totalSets(a)}</b></div><ProgressBar value={percent(doneSets(a),totalSets(a))}/>{a.items.map((item,n)=><div key={item.id} className="exercise stack"><div className="row"><span className="ex-number">{n+1}</span><span className="grow"><b>{exerciseName(item.exerciseId)}</b><span className="small muted" style={{display:'block'}}>{item.sets} × {item.reps} · {item.weight} kg · {item.rest}s</span></span><button type="button" className="link-button" onClick={()=>{setExerciseId(item.exerciseId);setReturnScreen(mode==='coach'?'coachWorkout':'workout');selectScreen('exerciseDetail');}}>ⓘ</button></div><div className="set-row small muted" style={{marginTop:12}}><span>№</span><span style={{textAlign:'center'}}>{t('reps',lang)}</span><span style={{textAlign:'center'}}>{t('weight',lang)}</span><span>✓</span></div>{Array.from({length:item.sets},(_,i)=>{const log=item.logs.find(l=>l.setIndex===i);const key=`${item.id}-${i}`;const values=workoutDraft[key]||{reps:log?.reps??item.reps,weight:log?.weight??item.weight};return <div className="set-row" key={i}><b className="small">{i+1}</b><input aria-label={`${t('reps',lang)} ${i+1}`} type="number" inputMode="numeric" min="0" max="1000" value={values.reps} onChange={e=>setWorkoutDraft(d=>({...d,[key]:{...values,reps:num(e.target.value)}}))}/><input aria-label={`${t('weight',lang)} ${i+1}`} type="number" inputMode="decimal" min="0" max="9999" step="0.5" value={values.weight} onChange={e=>setWorkoutDraft(d=>({...d,[key]:{...values,weight:num(e.target.value)}}))}/><button className={log?.done?'checked':''} type="button" disabled={busy} aria-pressed={Boolean(log?.done)} aria-label={`Set ${i+1}: ${log?.done?'done':'not done'}`} onClick={()=>void toggleSet(a,item,i)}>{log?.done?'✓':'○'}</button></div>;})}{mode==='student'&&videoPicker(a,item)}{(videosByAssignment[a.id]||[]).some(v=>v.itemId===item.id)&&videoReview(a,mode==='coach',item.id)}</div>)}<div className="card stack"><label className="field">{mode==='coach'?copy('Комментарий тренера','Coach note','Napomena trenera',lang):t('comment',lang)}<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={2000}/></label><label className="field">RPE · {effort}/10<input type="range" min="1" max="10" value={effort} onChange={e=>setEffort(Number(e.target.value))}/></label><button className="btn primary full" disabled={!doneSets(a)||busy} onClick={()=>void finishWorkout(a)}>{t('finish',lang)}</button></div></div>;
 }
 function historyView(){const completed=myAssignments.filter(a=>a.status==='completed');return <div className="view stack">{measurementProgress(studentId)}{measurementPanel(studentId)}{historyAccess==='summary'&&!canCoach?<section className="card stack"><h2 className="section-title">{copy('Завершённые тренировки по типам','Completed workouts by category','Završeni treninzi po vrsti',lang)}</h2><div className="history-summary">{trainingTypes.map(type=><div key={type}><strong>{workoutSummary[type]}</strong><span>{trainingLabel(type,lang)}</span></div>)}</div><p className="small muted">{copy('Подробная история тренировок скрыта настройками тренера.','Detailed workout history is hidden by your coach.','Detaljnu istoriju je sakrio trener.',lang)}</p></section>:completed.map(a=><div key={a.id} className="card stack"><div className="spread"><b>{templateTitle(a)}</b>{statusLabel(a)}</div><div className="small muted">{isoDate(a.date,lang)} · {doneSets(a)}/{totalSets(a)} {t('sets',lang).toLowerCase()} · RPE {a.effort}/10</div>{a.items.map(i=><div className="spread small" key={i.id}><span>{exerciseName(i.exerciseId)}</span><b>{i.logs.filter(l=>l.done).length}/{i.sets}</b></div>)}{a.note&&<p className="detail-paragraph">{a.note}</p>}
 {a.reviewStatus&&a.reviewStatus!=='not_required'&&<p className="small muted">
  {a.reviewStatus==='approved'?copy('✓ Проверено тренером','✓ Reviewed by coach','✓ Trener je pregledao',lang):
   a.reviewStatus==='pending'?copy('Ожидает проверки тренера','Waiting for coach review','Čeka pregled trenera',lang):
   copy('Требуются исправления','Changes requested','Potrebne su izmjene',lang)}
 </p>}
 {a.reviewNote&&<p className="detail-paragraph">{a.reviewNote}</p>}
 {a.items.map(item=><div key={`upload-${item.id}`}>{videoPicker(a,item)}</div>)}<button type="button" className="btn full" onClick={()=>void loadVideos(a.id).catch(fail)}>{copy('Показать проверки','View feedback','Prikaži pregled',lang)}</button>{(videosByAssignment[a.id]||[]).length>0&&videoReview(a,false)}</div>)}{historyAccess==='full'&& !completed.length&&<div className="card empty">{t('noResults',lang)}</div>}</div>;
 }
 if(!ready)return <div id="phone" data-theme={theme}><header className="top"><div className="brand"><span className="mark">↗</span> Fat2Fit</div></header><main id="stage" className="view"><div className="card">{copy('Загрузка…','Loading…','Učitavanje…',lang)}</div></main></div>;
 if(!DEMO&&!workspaceId)return <div id="phone" data-theme={theme}><header className="top"><div className="brand"><span className="mark">↗</span> Fat2Fit</div></header><main id="stage" className="view stack"><div className="card stack">
 <h2>{error?copy('Не удалось войти','Sign-in failed','Prijava nije uspela',lang):copy('Нет доступа','Access required','Pristup nije dozvoljen',lang)}</h2>
 {error?<><p className="small muted">{copy('Ошибка входа на сервере. Проверьте настройки подключения и повторите попытку.','The server could not complete sign-in. Check the connection settings and retry.','Server nije uspeo da dovrši prijavu. Proverite podešavanja i pokušajte ponovo.',lang)}</p><p className="small muted">{error}</p><button type="button" className="btn primary full" onClick={()=>window.location.reload()}>{copy('Повторить вход','Retry sign-in','Pokušaj ponovo',lang)}</button></>
 :<p className="small muted">{copy('Откройте Mini App по приглашению тренера. Если вы тренер, ваш Telegram ID должен быть добавлен администратором.','Open the Mini App with a coach invitation. Coaches must be added by an administrator.','Otvorite Mini App preko pozivnice trenera.',lang)}</p>}
 </div></main></div>;
 let content:React.ReactNode;
 if(screen==='dashboard')content=dashboard();else if(screen==='students'||screen==='studentDetail')content=studentsView();else if(screen==='exercises'||screen==='exerciseDetail'||screen==='exerciseNew')content=exercisesView();else if(screen==='templates'||screen==='templateNew')content=templatesView();else if(screen==='assign')content=assignView();else if(screen==='reports'||screen==='reportDetail')content=reportView();else if(screen==='workout'||screen==='coachWorkout')content=workoutView();else content=historyView();
 return <div id="phone" data-theme={theme}><header className="top"><div className="topline"><div className="brand"><span className="mark" aria-hidden="true">↗</span><span>Fat2Fit</span>{DEMO&&<span className="preview">{t('preview',lang)}</span>}</div><div className="top-actions">{canCoach&&<button type="button" className="mode-toggle" aria-pressed={mode==='student'} aria-label={mode==='coach'?copy('Режим тренера. Переключить на мои тренировки','Coach mode. Switch to my workouts','Režim trenera. Pređi na moje treninge',lang):copy('Мои тренировки. Переключить на тренера','My workouts. Switch to coach mode','Moji treninzi. Pređi na režim trenera',lang)} title={mode==='coach'?copy('Тренер → Мои тренировки','Coach → My workouts','Trener → Moji treninzi',lang):copy('Мои тренировки → Тренер','My workouts → Coach','Moji treninzi → Trener',lang)} onClick={()=>switchMode(mode==='coach'?'student':'coach')}><span>{mode==='coach'?copy('Тренер','Coach','Trener',lang):copy('Мои','Mine','Moji',lang)}</span><span className="mode-switch-glyph" aria-hidden="true">⇅</span></button>}<button type="button" className="theme-toggle" aria-label={theme==='light'?copy('Включить тёмную тему','Enable dark theme','Uključi tamnu temu',lang):copy('Включить светлую тему','Enable light theme','Uključi svijetlu temu',lang)} title={theme==='light'?copy('Тёмная тема','Dark theme','Tamna tema',lang):copy('Светлая тема','Light theme','Svijetla tema',lang)} aria-pressed={theme==='dark'} onClick={changeTheme}>{theme==='dark'?'☀':'☾'}</button><select className="lang-select" aria-label={t('language',lang)} value={lang} onChange={e=>changeLanguage(e.target.value as Language)}><option value="ru">RU</option><option value="en">EN</option><option value="cg">CG</option></select></div></div></header>{!DEMO&&me&&me.memberships.length>1&&<div className="workspace-picker">
  <label htmlFor="fat2fit-coach-picker">{copy('Тренер и команда','Coach / team','Trener i tim',lang)}</label>
  <select id="fat2fit-coach-picker" aria-label={copy('Выбрать тренера','Select coach','Odaberi trenera',lang)}
    value={workspaceId} onChange={e=>chooseWorkspace(e.target.value)}>
   {me.memberships.map(m=><option key={m.workspaceId} value={m.workspaceId}>
    {m.workspaceName} · {m.role==='coach'?copy('Тренер','Coach','Trener',lang):copy('Ученик','Student','Učenik',lang)}
   </option>)}
  </select>
 </div>}{error&&<div role="alert" className="alert" style={{background:'#fff0f0',color:'#9a3440'}}>{error}<button type="button" className="link-button" onClick={()=>setError('')}>✕</button></div>}{toast&&<div className="alert" role="status">{toast}</div>}<main id="stage">{content}</main><nav className={`bottom ${mode==='student'?'student':''}`} aria-label="Fat2Fit">{navs.map(({screen:s,icon,key})=><button type="button" key={s} aria-current={currentTab===s?'page':undefined} onClick={()=>selectScreen(s)}><span className="ico" aria-hidden="true">{icon}</span><span className="txt">{t(key,lang)}</span></button>)}</nav></div>;
}
