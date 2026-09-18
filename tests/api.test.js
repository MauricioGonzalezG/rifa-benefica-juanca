import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { createStore } from '../lib/store.js';
import { createHandler } from '../lib/handler.js';
const password = 'test-password-at-least-16';
test('authorization, validation, persistence and concurrent device conflicts', async () => {
  const client = createClient({ url: 'file::memory:' });
  const store = createStore(client);
  const handler = createHandler(() => store, () => password);
  async function call(method, body, key) {
    const headers = {};
    const req = { method, body, headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${encodeURIComponent(key)}` } : {}) } };
    const res = { setHeader(k,v) { headers[k] = v; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; } };
    await handler(req, res);
    return { code: res.code, data: res.data, headers };
  }
  try {
    const initial = await call('GET');
    assert.equal(initial.code,200); assert.deepEqual(initial.data.numbers,[]);
    assert.equal(initial.data.canEdit,false); assert.equal(initial.headers['Cache-Control'],'no-store');
    assert.equal((await call('PUT',{numbers:[1],revision:0})).code,401);
    assert.equal((await call('GET',undefined,'wrong')).code,401);
    assert.equal((await call('GET',undefined,password)).data.canEdit,true);
    for (const numbers of [[0],[101],[1,1],['1'],[1.5]]) assert.equal((await call('PUT',{numbers,revision:0},password)).code,400);
    assert.equal((await call('PUT','{invalid',password)).code,400);
    assert.equal((await call('PUT',{numbers:[1],revision:-1},password)).code,400);
    const saved = await call('PUT',{numbers:[100,1,50],revision:0},password);
    assert.equal(saved.code,200); assert.deepEqual(saved.data.numbers,[1,50,100]);
    assert.deepEqual((await createStore(client).read()).numbers,[1,50,100]);
    const conflict = await call('PUT',{numbers:[2],revision:0},password);
    assert.equal(conflict.code,409); assert.deepEqual(conflict.data.numbers,[1,50,100]);
    const results = await Promise.all([store.replace([3],1),store.replace([4],1)]);
    assert.equal(results.filter(Boolean).length,1); assert.equal((await store.read()).revision,2);
    assert.equal((await call('DELETE')).code,405);
  } finally { client.close(); }
});
test('configuration and database failures do not expose secrets', async () => {
  for (const getPassword of [() => '',() => password]) {
    let result;
    const handler = createHandler(() => { throw new Error('private credential details'); },getPassword);
    const res = {setHeader(){},status(code){this.code=code;return this},json(data){result={code:this.code,data};}};
    await handler({method:'GET',headers:{}},res);
    assert.equal(result.code,503); assert.ok(!JSON.stringify(result).includes('private credential'));
  }
});
