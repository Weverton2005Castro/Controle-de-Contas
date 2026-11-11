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

window.firebaseService = import("./firebase.js");
window.firebaseService.then(service => {
  cloud = service;
  googleButton.disabled = false;
  googleButton.textContent = "Entrar com Google";
}).catch(error => {
  console.error("Erro ao carregar Firebase:", error);
  loginStatus.textContent = "Não foi possível carregar o Firebase. Verifique a conexão e recarregue a página.";
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
    await cloud.signIn();
    loginStatus.textContent = "Consultando seu perfil no Firebase…";
    profile = await cloud.getProfile();
    googleButton.classList.add("hidden");
    biometricButton.classList.remove("hidden");
    loginStatus.textContent = profile.credentialIds?.length
      ? "Conta conectada. Confirme a entrada com o desbloqueio do dispositivo."
      : "Conta conectada. Cadastre o desbloqueio do dispositivo para continuar.";
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
    if (cred) await mostrarFormulario();
  } catch (err) {
    console.error("Erro na autenticação biométrica:", err);
    alert("Falha na autenticação biométrica ou no carregamento do Firebase.");
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

async function mostrarFormulario() {
  await inicializarAplicacao(profile);
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("mainContent").classList.remove("hidden");
  document.body.classList.remove("login-pending");
}

document.getElementById("btnBiometria").addEventListener("click", loginBiometrico);
