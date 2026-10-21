import test from 'node:test';
import assert from 'node:assert/strict';
import {call,displayRules,rulePayload,splitTerms,taskGroup} from '../src/bridge.js';

test('筛选条件可以从数据库快照显示后无损转回表单载荷',()=>{
  const values={regions:['北京','上海'],authors:['完整昵称'],exclude_authors:['广告账号'],include_words:['预算','方案'],exclude_words:['广告'],include_mode:'all',text_scope:'body',note_type:'video',date_preset:'custom',date_from:'2026-10-01',date_to:'2026-10-17',min_likes:1000,max_likes:5000,max_scan:500};
  const result=rulePayload(displayRules(values));
  for(const [key,value] of Object.entries(values))assert.deepEqual(result[key],value,key);
});
test('词汇输入统一全角并去除空项与重复项',()=>{assert.deepEqual(splitTerms('ＡＩ，AI\n装修；装修'),['AI','装修']);});
test('采集任务状态不会被手动完成或仅因异常而归到已完成',()=>{
  for(const status of ['partial','stopped','error','interrupted','queued'])assert.equal(taskGroup({status}),'queued');
  for(const status of ['running','paused','waiting'])assert.equal(taskGroup({status}),'active');
  assert.equal(taskGroup({status:'completed'}),'done');
});
test('桌面调用保留 false 数据，并将后端校验失败返回给界面',async()=>{
  globalThis.window={addEventListener(){},removeEventListener(){},pywebview:{api:{snapshot:async()=>({ok:true,data:{}}),toggle_demo:async()=>({ok:true,data:false}),create_tasks:async()=>({ok:false,error:'目标数量为 1–1000 条'})}}};
  assert.equal(await call('toggle_demo'),false);
  await assert.rejects(()=>call('create_tasks',{}),/目标数量/);
  await assert.rejects(()=>call('unsupported'),/版本不匹配/);
  delete globalThis.window;
});
