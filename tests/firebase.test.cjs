const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../firebase.js'), 'utf8')
  .replace(/import\s+[\s\S]*?from\s+"[^"]+";/g, '').replace(/export /g, '');
function setup() {
  const calls = [];
  const state = { user: { uid: 'owner' }, reject: false };
  const ctx = vm.createContext({
    navigator: { onLine: true },
    initializeApp: () => ({}), initializeAuth: () => ({ async authStateReady() {}, get currentUser() { return state.user; } }),
    indexedDBLocalPersistence: {}, signOut: async () => { state.user = null; }, onAuthStateChanged() {}, memoryLocalCache: () => ({}), initializeFirestore: () => ({}),
    GoogleAuthProvider: class { setCustomParameters() {} }, browserPopupRedirectResolver: {},
    signInWithPopup: async () => ({ user: state.user }),
    doc: (...args) => args.filter(x => typeof x === 'string').join('/'),
    collection: (...args) => args.join('/'),
    getDocFromServer: async () => ({ exists: () => true, data: () => ({ theme: 'dark' }) }),
    getDocsFromServer: async () => ({ docs: [{ id: 'tx1', data: () => ({ amount: 10 }) }] }),
    setDoc: async (...args) => { if (state.reject) throw Error('denied'); calls.push(['set', ...args]); },
    deleteDoc: async ref => calls.push(['delete', ref]), arrayUnion: id => [id],
    writeBatch: () => {
      const ops = [];
      return { set: (...args) => ops.push(['set', ...args]), delete: ref => ops.push(['delete', ref]),
        commit: async () => { if (state.reject) throw Error('denied'); calls.push(['batch', ops]); } };
    }
  });
  vm.runInContext(source, ctx);
  return { ctx, calls, state };
}
test('transações são documentos por conta, sem ID duplicado nos campos', async () => {
  const s = setup(); await s.ctx.saveTransaction({ id: 'tx1', desc: 'Teste', amount: 10 });
  assert.equal(s.calls[0][1], 'users/owner/transactions/tx1');
  assert.equal(s.calls[0][2].id, undefined);
  await s.ctx.removeTransaction('tx1'); assert.equal(s.calls[1][1], 'users/owner/transactions/tx1');
  const items = await s.ctx.listTransactions(); assert.equal(items[0].id, 'tx1');
});
test('tema e identificador são salvos no perfil com merge', async () => {
  const s = setup(); await s.ctx.saveTheme('dark'); await s.ctx.saveCredential('AP+A');
  assert.equal(s.calls[0][1], 'users/owner'); assert.equal(s.calls[0][3].merge, true);
  assert.equal(s.calls[1][2].credentialIds[0], 'AP+A');
});
test('erros de escrita são propagados e offline não escreve', async () => {
  const s = setup(); s.state.reject = true;
  await assert.rejects(s.ctx.saveTransaction({ id: 'tx1' }), /denied/);
  s.ctx.navigator.onLine = false;
  await assert.rejects(s.ctx.saveTheme('light'), /Sem conexão/); assert.equal(s.calls.length, 0);
});
test('sem usuário não é possível consultar dados', async () => {
  const s = setup(); s.state.user = null;
  await assert.rejects(s.ctx.listTransactions(), /Entre com sua conta/);
});
test('importar e limpar são atômicos e limite é verificado antes do commit', async () => {
  const s = setup(); await s.ctx.importTransactions([{ id: 'a', amount: 10 }]);
  await s.ctx.clearTransactions(['a']); assert.equal(s.calls.length, 2);
  await assert.rejects(s.ctx.importTransactions(Array(451).fill({ id: 'x' })), /450/);
  assert.equal(s.calls.length, 2);
  s.state.reject = true;
  await assert.rejects(s.ctx.clearTransactions(['a']), /denied/);
  assert.equal(s.calls.length, 2);
});

test('restaura sessão existente e logout remove acesso à conta', async () => {
  const s = setup();
  assert.equal((await s.ctx.restoreSession()).uid, 'owner');
  await s.ctx.signOutAccount();
  assert.equal(await s.ctx.restoreSession(), null);
  await assert.rejects(s.ctx.listTransactions(), /Entre com sua conta/);
});
