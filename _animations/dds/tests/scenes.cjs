const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = path.join(__dirname, '../src/scenes.js');
assert.ok(fs.existsSync(source), 'DDS topic scenes must exist');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {id, style:{}, children:[], setAttribute(k,v){this[k]=v}, querySelectorAll(){return this.children}, textContent:'', innerHTML:''});
  return elements.get(id);
}
const context = {window:{}, document:{getElementById:element}, URL};
vm.runInNewContext(fs.readFileSync(source,'utf8'), context);
const topics = ['guide','basics','discovery-addressing','qos','history-persistence','security','device-adapters','realtime-linux','fault-diagnosis','observability','gva-losa'];
assert.deepEqual(Array.from(context.window.ddsTopics), topics);
const titles = [], structures = [];
for (const topic of topics) {
  elements.clear();
  const draw = context.window.createDdsScene(topic);
  titles.push(element('title').textContent);
  structures.push(element('scene').innerHTML);
  assert.match(element('fallback').textContent, /설명용/);
  assert.ok(element('fallback').textContent.startsWith(context.window.ddsSceneInfo[topic][4]), topic+' full topic explanation');
  assert.match(element('scene').innerHTML, /id="payload/);
  draw(0); const first = element('payload').transform;
  draw(7); const middle = element('payload').transform;
  draw(14); const final = element('payload').transform;
  assert.notEqual(first, middle, topic+' meaningful spatial motion');
  assert.ok(final, topic+' final transform exists');
  assert.equal(element('resolution').style.opacity, 1, topic+' final resolution visible');
  assert.ok(element('caption').textContent.startsWith(context.window.ddsSceneInfo[topic][3][3]), topic+' final caption teaches the final stage');
}
assert.equal(new Set(titles).size, 11);
assert.equal(new Set(structures).size, 11);
context.window.createDdsScene('guide');
for(const topic of topics.slice(1)) assert.ok(element('scene').innerHTML.includes('/dds/'+topic+'/'));
const guide = context.window.createDdsScene('guide');
guide(0); assert.equal(element('map-9').style.visibility, 'hidden', 'unrevealed guide links cannot receive focus');
guide(14); assert.equal(element('map-9').style.visibility, 'visible');
const recovery = context.window.createDdsScene('fault-diagnosis');
recovery(9.99); assert.equal(element('scene')['data-state'], 'RECOVERING');
assert.match(element('stage-note').textContent, /false.*2\/3/);
recovery(10); assert.equal(element('scene')['data-state'], 'HEALTHY');
assert.match(element('stage-note').textContent, /true.*3\/3/);
console.log('PASS 11 DDS topic structures, spatial motion, final resolutions and guide links');
