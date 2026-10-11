// Run: node run_local_tests.js
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const flow = JSON.parse(fs.readFileSync('order_processing_n8n_workflow.json','utf8'));
const names = new Set(flow.nodes.map(x=>x.name));
function link(from,to,output=0) {
  assert(flow.connections[from]?.main?.[output]?.some(x=>x.node===to), `Missing edge: ${from}[${output}] -> ${to}`);
}
assert.equal(names.size, flow.nodes.length);
for(const [from,outputs] of Object.entries(flow.connections)) {
  assert(names.has(from));
  for(const route of outputs.main) for(const next of route) assert(names.has(next.node));
}
link('Receive New Order','Validate & Normalize Order');
link('Validate & Normalize Order','Order Valid?');
link('Order Valid?','Save Order to Google Sheets',0);
link('Order Valid?','400 - Invalid Order',1);
link('Save Order to Google Sheets','Notify Business Owner (Gmail)',0);
link('Save Order to Google Sheets','502 - Sheet Write Failed',1);
link('Notify Business Owner (Gmail)','200 - Order Processed',0);
link('Notify Business Owner (Gmail)','502 - Email Failed',1);
const sheet = flow.nodes.find(n=>n.name==='Save Order to Google Sheets');
assert.equal(sheet.parameters.operation,'appendOrUpdate');
assert.deepEqual(sheet.parameters.columns.matchingColumns,['order_id']);
assert.equal(sheet.onError,'continueErrorOutput');
assert.equal(flow.nodes.find(n=>n.name==='Notify Business Owner (Gmail)').onError,'continueErrorOutput');
assert.equal(flow.nodes.find(n=>n.name==='Receive New Order').parameters.authentication,'headerAuth');
const rawCode = flow.nodes.find(n=>n.name==='Validate & Normalize Order').parameters.jsCode;
function runOrder(value){
  const ctx = { $input: { first: ()=>({json:{body:value}}) }, Date, Number, String, Array, Math };
  return vm.runInNewContext(`(()=>{${rawCode}})()`,ctx,{timeout:1000})[0].json;
}
const valid = JSON.parse(fs.readFileSync('samples/valid_order.json','utf8'));
const bad = JSON.parse(fs.readFileSync('samples/invalid_order.json','utf8'));
const goodResult = runOrder(valid);
assert.equal(goodResult.valid,true);
assert.equal(goodResult.total_amount,79);
assert.equal(goodResult.currency,'USD');
const badResult = runOrder(bad);
assert.equal(badResult.valid,false);
assert(badResult.errors.length>=5);
assert.equal(badResult.total_amount,null);
const retry = JSON.parse(fs.readFileSync('samples/valid_retry.json','utf8'));
assert.equal(runOrder(retry).order_id,goodResult.order_id);
const injection = JSON.parse(fs.readFileSync('samples/formula_injection.json','utf8'));
const i = runOrder(injection);
assert.equal(i.valid,true);
assert.equal(i.product,'=1+1');
assert.equal(sheet.parameters.options.cellFormat,'RAW');
for(const name of ['200 - Order Processed','400 - Invalid Order','502 - Sheet Write Failed','502 - Email Failed']) {
  const n=flow.nodes.find(n=>n.name===name);
  assert.equal(n.type,'n8n-nodes-base.respondToWebhook');
}
console.log('PASS: 8 workflow routes, webhook authentication, error outputs, Google Sheets upsert, 4 validation scenarios.');
console.log('NOTE: local static/logic tests only; live n8n/Sheets/Gmail E2E testing NOT performed.');
