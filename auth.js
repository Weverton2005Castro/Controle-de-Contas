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
googleButton.addEventListener("click", async () => {
  googleButton.disabled = true;
  try {
    await cloud.signIn();
    profile = await cloud.getProfile();
    googleButton.classList.add("hidden");
    biometricButton.classList.remove("hidden");
    loginStatus.textContent = profile.credentialIds?.length
      ? "Conta conectada. Confirme a entrada com o desbloqueio do dispositivo."
      : "Conta conectada. Cadastre o desbloqueio do dispositivo para continuar.";
  } catch (error) {
    console.error("Erro ao conectar conta:", error);
    loginStatus.textContent = "Falha ao conectar. Verifique o login Google, os domínios autorizados e as regras do Firestore.";
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
