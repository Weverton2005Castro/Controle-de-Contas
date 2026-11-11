"use strict";

// Reprodução do bloqueio local: não verifica assinaturas nem cifra os dados.
function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(base64) {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

let cloud = null;
let profile = {};
let authenticationBusy = false;
const googleButton = document.getElementById("btnGoogle");
const biometricButton = document.getElementById("btnBiometria");
const loginStatus = document.getElementById("loginStatus");

const welcomeMessages = [
  "Que bom ter você por aqui! Vamos cuidar das suas finanças?",
  "Um novo acesso, uma nova oportunidade de se organizar.",
  "Seu futuro começa com as escolhas de hoje. Bem-vindo!",
  "Tudo pronto para acompanhar seus planos e conquistas?",
  "Vamos dar mais um passo rumo aos seus objetivos?",
  "Sua vida financeira em dia começa por aqui. Bem-vindo!"
];
const welcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
document.getElementById("welcomeLogin").textContent = welcome;

async function prepareAccount(user) {
  biometricButton.disabled = true;
  loginStatus.textContent = "Consultando seu perfil no Firebase…";
  profile = await cloud.getProfile();
  googleButton.classList.add("hidden");
  biometricButton.classList.remove("hidden");
  document.getElementById("accountIdentity").textContent = user.email || "Conta conectada";
  document.getElementById("profileName").textContent = user.displayName || "Minha conta";
  document.getElementById("profileEmail").textContent = user.email || "";
  document.getElementById("profileInitial").textContent = (user.displayName || user.email || "?").charAt(0).toUpperCase();
  document.getElementById("modalProfileInitial").textContent = document.getElementById("profileInitial").textContent;
  const modalPhoto = document.getElementById("modalProfilePhoto");
  const photo = document.getElementById("profilePhoto");
  if (user.photoURL) {
    photo.src = user.photoURL;
    modalPhoto.src = user.photoURL;
    modalPhoto.classList.remove("hidden");
    document.getElementById("modalProfileInitial").classList.add("hidden");
    photo.classList.remove("hidden");
    document.getElementById("profileInitial").classList.add("hidden");
  }
  document.getElementById("changePassword").href = "https://myaccount.google.com/signinoptions/password?authuser=" + encodeURIComponent(user.email || "");
  document.getElementById("welcomeMessage").textContent = `${user.displayName?.split(" ")[0] || "Olá"}, ${welcome}`;
  loginStatus.textContent = profile.credentialIds?.length
    ? "Confirme a entrada com o desbloqueio do dispositivo."
    : "Cadastre o desbloqueio do dispositivo para continuar.";
  biometricButton.disabled = false;
}
let sessionStorageAdapter;
try { sessionStorageAdapter = window.sessionStorage; } catch {}
const unlockSession = new IdleSession({
  storage: sessionStorageAdapter,
  onExpire: () => {
    document.getElementById("mainContent").classList.add("hidden");
    document.getElementById("profileMenu").close();
    document.getElementById("loginScreen").classList.remove("hidden");
    document.body.classList.add("login-pending");
    // Descarta dados e formulários em memória e exige novo WebAuthn.
    window.location.reload();
  }
});
for (const eventName of ["pointerdown", "pointermove", "keydown", "touchstart", "scroll", "wheel"]) {
  document.addEventListener(eventName, event => {
    if (event.isTrusted && !document.hidden) unlockSession.activity();
  }, { passive: true, capture: true });
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) unlockSession.check();
});
window.addEventListener("focus", () => unlockSession.check());
window.addEventListener("pageshow", () => unlockSession.check());

window.firebaseService = import("./firebase.js");
window.firebaseService.then(async service => {
  cloud = service;
  const user = await cloud.restoreSession();
  googleButton.textContent = "Entrar com Google";
  if (user) {
    await prepareAccount(user);
    if (unlockSession.restore(user.uid)) await mostrarFormulario(true);
  } else {
    unlockSession.clear();
  }
  googleButton.disabled = false;
  let observedUid = user?.uid || null;
  cloud.watchSession(current => {
    const nextUid = current?.uid || null;
    if (observedUid && observedUid !== nextUid && !leavingAccount) {
      unlockSession.clear();
      document.getElementById("mainContent").classList.add("hidden");
      window.location.reload();
    }
    observedUid = nextUid;
  });
}).catch(error => {
  console.error("Erro ao carregar Firebase:", error);
  googleButton.textContent = "Entrar com Google";
  googleButton.disabled = !cloud;
  loginStatus.textContent = "Não foi possível recuperar sua sessão. Verifique a conexão e tente entrar novamente.";
});
function mensagemErroFirebase(error) {
  const messages = {
    "auth/popup-blocked": "O navegador bloqueou a janela do Google. Permita popups para este site e tente novamente.",
    "auth/popup-closed-by-user": "A janela do Google foi fechada. Clique em Entrar com Google para tentar novamente.",
    "auth/unauthorized-domain": "Adicione o endereço atual aos domínios autorizados do Firebase Authentication.",
    "auth/operation-not-allowed": "O login Google não está habilitado neste projeto Firebase.",
    "auth/network-request-failed": "Não foi possível conectar ao Google. Verifique sua conexão.",
    "permission-denied": "O Firestore negou o acesso. Confira as regras publicadas no projeto contas-d8193.",
    "unavailable": "O Firestore está indisponível. Verifique sua conexão e tente novamente."
  };
  return messages[error.code] || "Não foi possível acessar o Firebase. Tente novamente e confira o console do navegador se o erro continuar.";
}

googleButton.addEventListener("click", async () => {
  googleButton.disabled = true;
  loginStatus.textContent = "Conectando à sua conta Google…";
  try {
    const user = await cloud.signIn();
    await prepareAccount(user);
  } catch (error) {
    console.error("Erro ao conectar conta:", error);
    loginStatus.textContent = mensagemErroFirebase(error);
  } finally { googleButton.disabled = false; }
});

async function loginBiometrico() {
  if (!window.PublicKeyCredential) {
    alert("Seu navegador não suporta autenticação biométrica.");
    return;
  }

  if (!cloud?.currentUser() || authenticationBusy) return;
  authenticationBusy = true;
  biometricButton.disabled = true;
  let stage = "webauthn";
  try {
    const savedIds = profile.credentialIds || [];
    if (!savedIds.length) {
      await registrarBiometria();
      return;
    }
    const publicKey = {
      challenge: Uint8Array.from("desafioLogin123", c => c.charCodeAt(0)),
      timeout: 60000,
      userVerification: "preferred",
      allowCredentials: savedIds.map(savedId => ({
        id: base64ToBuffer(savedId),
        type: "public-key",
        transports: ["internal"]
      }))
    };
    const cred = await navigator.credentials.get({ publicKey });
    if (cred) {
      stage = "application";
      await mostrarFormulario();
    }
  } catch (err) {
    console.error(`Erro na etapa ${stage}:`, err);
    const message = stage === "webauthn"
      ? (err.name === "NotAllowedError"
        ? "A autenticação foi cancelada, expirou ou a credencial não está disponível neste dispositivo. Tente novamente."
        : `Não foi possível autenticar no dispositivo: ${err.message || err.name}`)
      : `A biometria foi confirmada, mas não foi possível abrir o painel. ${err.code ? mensagemErroFirebase(err) : (err.message || "Tente novamente.")}`;
    loginStatus.textContent = message;
    alert(message);
  } finally {
    authenticationBusy = false;
    biometricButton.disabled = false;
  }
}

async function registrarBiometria() {
  const publicKey = {
    challenge: Uint8Array.from("desafioRegistro123", c => c.charCodeAt(0)),
    rp: { name: "FinanConta" },
    user: {
      id: new TextEncoder().encode(cloud.currentUser().uid),
      name: cloud.currentUser().email,
      displayName: cloud.currentUser().displayName || "Usuário FinanConta"
    },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    timeout: 60000,
    attestation: "direct"
  };
  try {
    const cred = await navigator.credentials.create({ publicKey });
    if (cred) {
      await cloud.saveCredential(bufferToBase64(cred.rawId));
      profile = await cloud.getProfile();
      alert("Biometria registrada com sucesso!");
      await mostrarFormulario();
    }
  } catch (err) {
    console.error("Erro ao registrar biometria:", err);
    alert("Erro ao registrar biometria.");
  }
}

async function mostrarFormulario(restoring = false) {
  await inicializarAplicacao(profile);
  // Carregar os dados não conta como atividade e não renova o prazo salvo.
  if (restoring) {
    if (!unlockSession.check()) return;
  } else {
    unlockSession.unlock(cloud.currentUser().uid);
  }
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("mainContent").classList.remove("hidden");
  document.body.classList.remove("login-pending");
}

document.getElementById("btnBiometria").addEventListener("click", loginBiometrico);

const profileButton = document.getElementById("btnProfile");
const profileMenu = document.getElementById("profileMenu");
function closeProfileMenu() {
  profileMenu.close();
  profileButton.setAttribute("aria-expanded", "false");
}
profileButton.addEventListener("click", () => {
  if (document.getElementById("mainContent").classList.contains("hidden")) return;
  profileMenu.showModal();
  profileButton.setAttribute("aria-expanded", "true");
});
document.getElementById("btnCloseProfile").addEventListener("click", closeProfileMenu);
profileMenu.addEventListener("click", event => {
  if (event.target === profileMenu) {
    const bounds = profileMenu.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeProfileMenu();
  }
});
profileMenu.addEventListener("close", () => {
  profileButton.setAttribute("aria-expanded", "false");
  profileButton.focus();
});
document.getElementById("modalProfilePhoto").addEventListener("error", () => {
  document.getElementById("modalProfilePhoto").classList.add("hidden");
  document.getElementById("modalProfileInitial").classList.remove("hidden");
});
document.getElementById("profilePhoto").addEventListener("error", () => {
  document.getElementById("profilePhoto").classList.add("hidden");
  document.getElementById("profileInitial").classList.remove("hidden");
});
let leavingAccount = false;
document.querySelectorAll("[data-account-action]").forEach(button => {
  button.addEventListener("click", async () => {
    if (leavingAccount || authenticationBusy || (typeof saving !== "undefined" && saving)) return;
    leavingAccount = true;
    try {
      unlockSession.clear();
      closeProfileMenu();
      // Oculta imediatamente os dados, antes de encerrar a sessão.
      document.getElementById("mainContent").classList.add("hidden");
      document.getElementById("loginScreen").classList.remove("hidden");
      document.body.classList.add("login-pending");
      await cloud.signOutAccount();
      // Recarregar descarta transações e formulários em memória da conta anterior.
      window.location.replace(window.location.pathname + window.location.search);
    } catch (error) {
      loginStatus.textContent = mensagemErroFirebase(error);
      leavingAccount = false;
    }
  });
});
