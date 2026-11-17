import test from 'node:test';
import assert from 'node:assert/strict';
import {seedDemo,demoTemplates} from '../src/lib/demo.ts';
import {t,exText,localized} from '../src/lib/i18n.ts';
test('demo has workouts and isolated assignment snapshots',()=>{
 const a=seedDemo();const b=seedDemo();assert.ok(a.assignments.length>=2);
 a.assignments[0].items[0].weight=999;
 assert.notEqual(a.assignments[0].items[0].weight,a.templates[0].items[0].weight);
 assert.notEqual(a.assignments[0].items[0].weight,b.assignments[0].items[0].weight);
});
test('RU/EN/CG catalogue, UI and Coach Tips translate',()=>{
 const seed=seedDemo();
 for(const lang of ['ru','en','cg']){
  assert.ok(t('dashboard',lang));
  assert.ok(t('coachTips',lang));
  assert.ok(exText(seed.exercises[0],lang,'name'));
  assert.ok(localized(seed.templates[0].title,lang));
 }
 const ex={...seed.exercises[0],translations:{
  ru:{name:'Жим',description:'Техника',coachTips:'Положение лопаток',faq:'Ошибки'},
  en:{name:'Press',description:'Technique',coachTips:'Shoulder blade position',faq:'Mistakes'},
  cg:{name:'Potisak',description:'Tehnika',coachTips:'Položaj lopatica',faq:'Greške'}
 }};
 assert.equal(exText(ex,'ru','coachTips'),'Положение лопаток');
 assert.equal(exText(ex,'en','coachTips'),'Shoulder blade position');
 assert.equal(exText(ex,'cg','coachTips'),'Položaj lopatica');
 // Old exercises without Coach Tips still render without errors.
 assert.equal(exText(seed.exercises[0],'ru','coachTips'),'');
});
