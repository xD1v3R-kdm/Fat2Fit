import type {Language,Localized,Exercise} from './types';
export const langs:Language[]=['ru','en','cg'];
export const dictionary = {
  coach:['Тренер','Coach','Trener'], student:['Ученик','Student','Učenik'],
  dashboard:['Главная','Home','Početna'], students:['Ученики','Students','Učenici'],
  exercises:['Упражнения','Exercises','Vježbe'], templates:['Шаблоны','Templates','Šabloni'],
  reports:['Отчёты','Reports','Izvještaji'], workout:['Тренировка','Workout','Trening'],
  today:['Сегодня','Today','Danas'], assign:['Назначить тренировку','Assign workout','Dodeli trening'],
  createExercise:['Добавить упражнение','Add exercise','Dodaj vježbu'],
  createTemplate:['Создать шаблон','New template','Novi šablon'],
  noStudents:['Пока нет учеников','No students yet','Još nema učenika'],
  noTemplates:['Пока нет шаблонов','No templates yet','Još nema šablona'],
  noAssignments:['Нет назначенных тренировок','No assigned workouts','Nema dodeljenih treninga'],
  search:['Поиск упражнений','Search exercises','Pretraži vježbe'],
  add:['Добавить','Add','Dodaj'], save:['Сохранить','Save','Sačuvaj'], cancel:['Отмена','Cancel','Otkaži'],
  name:['Название','Name','Naziv'], group:['Группа мышц','Muscle group','Mišićna grupa'],
  equipment:['Оборудование','Equipment','Oprema'], technique:['Техника','Technique','Tehnika'],
  faq:['FAQ / ошибки','FAQ / mistakes','FAQ / greške'], photo:['Ссылка на фото','Photo URL','Link fotografije'],
  video:['Ссылка на видео','Video URL','Link videa'], newTemplate:['Новый шаблон','New template','Novi šablon'],
  addToTemplate:['Добавить в шаблон','Add to template','Dodaj u šablon'],
  sets:['Подходы','Sets','Serije'], reps:['Повторения','Reps','Ponavljanja'],
  weight:['Вес, кг','Weight, kg','Težina, kg'], rest:['Отдых, сек','Rest, sec','Odmor, sek'],
  started:['Начать тренировку','Start workout','Započni trening'],
  finish:['Завершить тренировку','Finish workout','Završi trening'],
  complete:['Завершена','Completed','Završen'], active:['В процессе','In progress','U toku'],
  planned:['Назначена','Scheduled','Zakazan'], skipped:['Пропущена','Skipped','Preskočen'],
  history:['История','History','Istorija'], progress:['Прогресс','Progress','Napredak'],
  open:['Открыть','Open','Otvori'], back:['Назад','Back','Nazad'],
  comment:['Комментарий тренеру','Comment to coach','Komentar treneru'],
  language:['Язык','Language','Jezik'], studentPicker:['Ученик','Student','Učenik'],
  templatePicker:['Шаблон','Template','Šablon'], date:['Дата','Date','Datum'],
  invite:['Пригласить ученика','Invite student','Pozovi učenika'],
  copyInvite:['Ссылка для приглашения','Invitation link','Link za poziv'],
  dashboardIntro:['Управляйте тренировками и результатами','Manage workouts and progress','Upravljajte treninzima i napretkom'],
  studentIntro:['Ваша следующая тренировка','Your next workout','Vaš sljedeći trening'],
  addFirst:['Создайте первое упражнение','Create your first exercise','Napravite prvu vježbu'],
  preview:['ДЕМО','DEMO','DEMO'],
  error:['Ошибка. Попробуйте ещё раз.','Something went wrong. Try again.','Došlo je do greške. Pokušajte ponovo.'],
  signedIn:['Подключено к серверу','Connected to server','Povezano sa serverom'],
  guest:['Нужен доступ по приглашению','An invitation is required','Potreban je poziv'],
  workoutTitle:['Название тренировки','Workout title','Naziv treninga'],
  noResults:['Нет результатов','No results','Nema rezultata'],
} as const;
export type Phrase = keyof typeof dictionary;
export function t(key:Phrase, lang:Language):string {return dictionary[key][langs.indexOf(lang)];}
export function localized(v:Localized, lang:Language):string{return v[lang]||v.ru||v.en||v.cg||(v as Record<string,string>).sr||'';}
export function exText(ex:Exercise, lang:Language, key:'name'|'description'|'faq'):string{
  return ex.translations[lang]?.[key] || ex.translations.ru?.[key] || ex.translations.en?.[key] || Object.values(ex.translations).find(x=>x[key])?.[key] || '';
}
export const groups: Record<string,Localized>={chest:{ru:'Грудь',en:'Chest',cg:'Grudi'},back:{ru:'Спина',en:'Back',cg:'Leđa'},legs:{ru:'Ноги',en:'Legs',cg:'Noge'},core:{ru:'Кор',en:'Core',cg:'Trup'},shoulders:{ru:'Плечи',en:'Shoulders',cg:'Ramena'},arms:{ru:'Руки',en:'Arms',cg:'Ruke'},cardio:{ru:'Кардио',en:'Cardio',cg:'Kardio'},other:{ru:'Другое',en:'Other',cg:'Ostalo'}};
