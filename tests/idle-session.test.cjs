const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../idle-session.js'), 'utf8'), ctx);
const IdleSession = vm.runInContext('IdleSession', ctx);
function setup() {
  const data = new Map();
  const storage = { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  let time = 1000, expired = 0;
  const make = () => new IdleSession({ storage, now: () => time, schedule: () => 1, cancel() {}, onExpire: () => expired++ });
  return { data, storage, make, advance: n => time += n, expired: () => expired };
}
test('reload restaura mesma conta sem estender prazo', () => {
  const s = setup(); s.make().unlock('a'); s.advance(60000);
  const reload = s.make(); assert.equal(reload.restore('a'), true);
  assert.equal(reload.lastActivity, 1000);
  s.advance(240000); assert.equal(reload.check(), false); assert.equal(s.expired(), 1);
});
test('atividade renova por cinco minutos', () => {
  const s = setup(); const session = s.make(); session.unlock('a');
  s.advance(240000); session.activity(); s.advance(240000); assert.equal(session.check(), true);
  s.advance(60000); assert.equal(session.check(), false);
});
test('atividade após suspensão não reabre sessão expirada', () => {
  const s = setup(); const session = s.make(); session.unlock('a');
  s.advance(300001); session.activity(); assert.equal(session.uid, null); assert.equal(s.expired(), 1);
});
test('outra conta, prazo expirado e logout exigem novo desbloqueio', () => {
  const s = setup(); s.make().unlock('a'); assert.equal(s.make().restore('b'), false);
  s.make().unlock('a'); s.advance(300000); assert.equal(s.make().restore('a'), false);
  const session = s.make(); session.unlock('a'); session.clear(); assert.equal(s.make().restore('a'), false);
});
test('armazenamento indisponível ou adulterado não abre sessão', () => {
  const s = setup(); s.data.set('financonta_unlock_session_v1', 'invalid'); assert.equal(s.make().restore('a'), false);
  s.data.set('financonta_unlock_session_v1', JSON.stringify({ uid: 'a', lastActivity: 9999999 })); assert.equal(s.make().restore('a'), false);
  const session = new IdleSession({ storage: undefined, now: () => 1000, schedule: () => 1, cancel() {}, onExpire() {} });
  session.unlock('a'); assert.equal(session.check(), true); assert.equal(session.restore('a'), false);
});
