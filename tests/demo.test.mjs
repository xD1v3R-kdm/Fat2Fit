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
test('RU/EN/SR initial catalogue and interface translate',()=>{
 const seed=seedDemo();
 for(const lang of ['ru','en','sr']){assert.ok(t('dashboard',lang));assert.ok(exText(seed.exercises[0],lang,'name'));assert.ok(localized(seed.templates[0].title,lang));}
});
