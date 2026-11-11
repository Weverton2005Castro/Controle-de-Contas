const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'auth.js'), 'utf8')
  .replace('import("./firebase.js")', 'Promise.resolve(mockCloud)');
async function setup(ids = [], result = {}, support = true, loadError = false, restoredUser = null) {
  const calls = [], alerts = [];
  let initialized = false;
  const elements = Object.fromEntries(['loginScreen', 'mainContent', 'btnBiometria', 'btnGoogle', 'loginStatus', 'welcomeLogin', 'lockedAccountActions', 'accountIdentity', 'profileName', 'profileEmail', 'profileInitial', 'profilePhoto', 'changePassword', 'welcomeMessage', 'btnProfile', 'profileMenu', 'modalProfileInitial', 'modalProfilePhoto', 'btnCloseProfile'].map(id => [id, {
    classList: new Set(['mainContent', 'btnBiometria'].includes(id) ? ['hidden'] : []),
    setAttribute() {}, focus() {}, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }
  }]));
  for (const el of Object.values(elements)) {
    el.classList.remove = el.classList.delete;
    el.classList.contains = el.classList.has;
  }
  const profile = { credentialIds: [...ids] };
  const context = vm.createContext({ Uint8Array, btoa, atob, TextEncoder,
    setTimeout: () => 1, clearTimeout() {},
    window: { addEventListener() {}, PublicKeyCredential: support ? function() {} : undefined },
    mockCloud: {
      async signIn() { calls.push({ method: 'signIn' }); return { uid: 'account-123', email: 'user@example.com' }; },
      async restoreSession() { return restoredUser; }, watchSession() {},
      currentUser: () => ({ uid: 'account-123', email: 'user@example.com' }),
      async getProfile() { return profile; },
      async saveCredential(id) { calls.push({ method: 'saveCredential' }); profile.credentialIds.push(id); }
    },
    navigator: { credentials: Object.fromEntries(['create', 'get'].map(method => [method, async options => {
      calls.push({ method, options }); if (result instanceof Error) throw result; return result;
    }])) },
    alert: msg => alerts.push(msg), console: { error() {} },
    inicializarAplicacao: async () => { if (loadError) throw Error('Firestore denied'); initialized = true; },
    document: { addEventListener() {}, querySelectorAll: () => [], getElementById: id => elements[id], body: { classList: { remove() {} } } }
  });
  vm.runInContext(fs.readFileSync(path.join(root, "idle-session.js"), "utf8"), context);
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { context, profile, calls, alerts, initialized: () => initialized, elements,
    signIn: () => elements.btnGoogle.listeners.click(),
    unlocked: () => !elements.mainContent.classList.has('hidden') };
}
test('abertura com/sem ID não consulta autenticador nem libera conteúdo', async () => {
  for (const ids of [[], ['AP+A']]) {
    const s = await setup(ids); assert.equal(s.calls.length, 0); assert.equal(s.unlocked(), false);
    await s.signIn(); assert.equal(s.unlocked(), false);
    assert.equal(s.elements.btnBiometria.classList.has('hidden'), false);
  }
});
test('cadastro usa conta, salva ID no banco e libera após carregamento remoto', async () => {
  const s = await setup([], { rawId: Uint8Array.from([0, 255, 128]).buffer });
  await s.signIn(); await s.context.loginBiometrico();
  assert.equal(s.profile.credentialIds[0], 'AP+A'); assert.ok(s.unlocked()); assert.ok(s.initialized());
  const p = s.calls.find(c => c.method === 'create').options.publicKey;
  assert.equal(Buffer.from(p.challenge).toString(), 'desafioRegistro123');
  assert.equal(Buffer.from(p.user.id).toString(), 'account-123');
  assert.equal(p.rp.name, 'FinanConta'); assert.equal(p.rp.id, undefined);
  assert.equal(p.pubKeyCredParams[0].alg, -7); assert.equal(p.attestation, 'direct');
  assert.equal(p.timeout, 60000); assert.equal(p.authenticatorSelection, undefined);
  assert.equal(s.calls.some(c => c.method === 'get'), false);
});
test('login busca credencial do perfil com parâmetros preservados', async () => {
  const s = await setup(['AP+A']); await s.signIn(); await s.context.loginBiometrico();
  assert.ok(s.unlocked());
  const p = s.calls.find(c => c.method === 'get').options.publicKey;
  assert.equal(Buffer.from(p.challenge).toString(), 'desafioLogin123');
  assert.deepEqual([...p.allowCredentials[0].id], [0, 255, 128]);
  assert.equal(p.allowCredentials[0].transports[0], 'internal');
  assert.equal(p.userVerification, 'preferred'); assert.equal(p.timeout, 60000);
  assert.equal(p.rpId, undefined);
});
test('nulo, falha, cancelamento e timeout não liberam nem apagam perfil', async () => {
  for (const ids of [[], ['AP+A']]) for (const result of [null, new Error('failure'), new DOMException('cancel', 'NotAllowedError'), new DOMException('timeout', 'TimeoutError')]) {
    const s = await setup(ids, result); await s.signIn(); await s.context.loginBiometrico();
    assert.equal(s.unlocked(), false); assert.deepEqual(s.profile.credentialIds, ids);
    assert.equal(s.alerts.length, result ? 1 : 0);
  }
});
test('falha no carregamento remoto impede abertura', async () => {
  const s = await setup(['AP+A'], {}, true, true); await s.signIn(); await s.context.loginBiometrico();
  assert.equal(s.unlocked(), false); assert.equal(s.alerts.length, 1);
});
test('sem suporte exibe mensagem esperada', async () => {
  const s = await setup([], null, false); await s.signIn(); await s.context.loginBiometrico();
  assert.deepEqual(s.alerts, ['Seu navegador não suporta autenticação biométrica.']);
  assert.equal(s.calls.some(c => ['get', 'create'].includes(c.method)), false);
});
test('Base64 preserva todos os bytes', async () => {
  const s = await setup(); const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
  assert.deepEqual([...s.context.base64ToBuffer(s.context.bufferToBase64(bytes.buffer))], [...bytes]);
});
test('scripts do aplicativo não usam persistência local', () => {
  for (const file of ['auth.js', 'firebase.js', 'js.js']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /localStorage|persistentLocalCache/);
  }
});

test('erros de configuração e popup recebem orientação específica', async () => {
  const s = await setup();
  for (const [code, text] of [
    ['auth/popup-blocked', 'Permita popups'],
    ['auth/unauthorized-domain', 'domínios autorizados'],
    ['permission-denied', 'regras publicadas'],
    ['auth/operation-not-allowed', 'não está habilitado']
  ]) assert.ok(s.context.mensagemErroFirebase({ code }).includes(text));
  assert.ok(s.context.mensagemErroFirebase({ code: 'unknown' }).includes('console'));
});

test('sessão restaurada exige apenas WebAuthn e não abre painel automaticamente', async () => {
  const s = await setup(['AP+A'], {}, true, false, { uid: 'account-123', email: 'user@example.com', displayName: 'Maria Silva' });
  assert.equal(s.calls.length, 0);
  assert.equal(s.elements.btnGoogle.classList.has('hidden'), true);
  assert.equal(s.elements.btnBiometria.classList.has('hidden'), false);
  assert.equal(s.unlocked(), false);
  assert.equal(s.elements.profileName.textContent, 'Maria Silva');
  await s.context.loginBiometrico();
  assert.equal(s.unlocked(), true);
  assert.equal(s.calls.some(c => c.method === 'signIn'), false);
});
