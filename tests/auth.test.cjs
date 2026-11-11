const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../auth.js'), 'utf8');
function setup(savedId, result, support = true) {
  const data = new Map(savedId ? [['credentialId', savedId]] : []);
  const calls = [], alerts = [];
  let initialized = 0;
  const elements = Object.fromEntries(['loginScreen', 'mainContent', 'btnBiometria'].map(id => [id, {
    classList: new Set(id === 'mainContent' ? ['hidden'] : []), addEventListener() {}
  }]));
  for (const el of Object.values(elements)) el.classList.remove = el.classList.delete;
  const context = vm.createContext({ Uint8Array, btoa, atob,
    window: { PublicKeyCredential: support ? function() {} : undefined },
    navigator: { credentials: Object.fromEntries(['create', 'get'].map(method => [method, async options => {
      calls.push({ method, options }); if (result instanceof Error) throw result; return result;
    }])) },
    localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) },
    alert: msg => alerts.push(msg), console: { error() {} },
    inicializarAplicacao: () => initialized++,
    document: { getElementById: id => elements[id], body: { classList: { remove() {} } } }
  });
  vm.runInContext(source, context);
  return { context, data, calls, alerts, unlocked: () => initialized > 0, elements };
}
test('entrada permanece bloqueada com e sem ID, sem solicitar credenciais', () => {
  for (const id of [null, 'AP+A']) {
    const s = setup(id, null);
    assert.equal(s.calls.length, 0); assert.equal(s.unlocked(), false);
    assert.ok(s.elements.mainContent.classList.has('hidden'));
  }
});
test('cadastro salva bytes e libera sem autenticação extra', async () => {
  const s = setup(null, { rawId: Uint8Array.from([0, 255, 128]).buffer });
  await s.context.loginBiometrico();
  assert.equal(s.data.get('credentialId'), 'AP+A'); assert.ok(s.unlocked());
  assert.equal(s.calls.length, 1); assert.equal(s.calls[0].method, 'create');
  const p = s.calls[0].options.publicKey;
  assert.equal(Buffer.from(p.challenge).toString(), 'desafioRegistro123');
  assert.equal(p.rp.name, 'FinanConta'); assert.equal(p.rp.id, undefined);
  assert.equal(Buffer.from(p.user.id).toString(), 'usuario123');
  assert.equal(p.pubKeyCredParams[0].alg, -7); assert.equal(p.attestation, 'direct');
  assert.equal(p.timeout, 60000); assert.equal(p.authenticatorSelection, undefined);
});
test('login usa ID e parâmetros da referência', async () => {
  const s = setup('AP+A', {}); await s.context.loginBiometrico();
  assert.ok(s.unlocked()); assert.equal(s.calls[0].method, 'get');
  const p = s.calls[0].options.publicKey;
  assert.equal(Buffer.from(p.challenge).toString(), 'desafioLogin123');
  assert.deepEqual([...p.allowCredentials[0].id], [0, 255, 128]);
  assert.equal(p.allowCredentials[0].transports[0], 'internal');
  assert.equal(p.userVerification, 'preferred'); assert.equal(p.timeout, 60000);
  assert.equal(p.rpId, undefined);
});
test('nulo, falha, cancelamento e timeout mantêm bloqueio e ID', async () => {
  for (const id of [null, 'AP+A']) for (const result of [null, new Error('failure'), new DOMException('cancel', 'NotAllowedError'), new DOMException('timeout', 'TimeoutError')]) {
    const s = setup(id, result); await s.context.loginBiometrico();
    assert.equal(s.unlocked(), false); assert.equal(s.data.get('credentialId'), id || undefined);
    assert.equal(s.alerts.length, result ? 1 : 0);
  }
});
test('sem suporte exibe mensagem esperada', async () => {
  const s = setup(null, null, false); await s.context.loginBiometrico();
  assert.deepEqual(s.alerts, ['Seu navegador não suporta autenticação biométrica.']);
  assert.equal(s.calls.length, 0);
});
test('Base64 preserva todos os bytes', () => {
  const s = setup(); const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
  assert.deepEqual([...s.context.base64ToBuffer(s.context.bufferToBase64(bytes.buffer))], [...bytes]);
});
