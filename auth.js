"use strict";

// Reprodução do bloqueio local: não verifica assinaturas nem cifra os dados.
function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(base64) {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

async function loginBiometrico() {
  if (!window.PublicKeyCredential) {
    alert("Seu navegador não suporta autenticação biométrica.");
    return;
  }

  try {
    const savedId = localStorage.getItem("credentialId");
    if (!savedId) {
      await registrarBiometria();
      return;
    }
    const publicKey = {
      challenge: Uint8Array.from("desafioLogin123", c => c.charCodeAt(0)),
      timeout: 60000,
      userVerification: "preferred",
      allowCredentials: [{
        id: base64ToBuffer(savedId),
        type: "public-key",
        transports: ["internal"]
      }]
    };
    const cred = await navigator.credentials.get({ publicKey });
    if (cred) mostrarFormulario();
  } catch (err) {
    console.error("Erro na autenticação biométrica:", err);
    alert("Falha na autenticação biométrica.");
  }
}

async function registrarBiometria() {
  const publicKey = {
    challenge: Uint8Array.from("desafioRegistro123", c => c.charCodeAt(0)),
    rp: { name: "FinanConta" },
    user: {
      id: Uint8Array.from("usuario123", c => c.charCodeAt(0)),
      name: "usuario@example.com",
      displayName: "Usuário Local"
    },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    timeout: 60000,
    attestation: "direct"
  };
  try {
    const cred = await navigator.credentials.create({ publicKey });
    if (cred) {
      localStorage.setItem("credentialId", bufferToBase64(cred.rawId));
      alert("Biometria registrada com sucesso!");
      mostrarFormulario();
    }
  } catch (err) {
    console.error("Erro ao registrar biometria:", err);
    alert("Erro ao registrar biometria.");
  }
}

function mostrarFormulario() {
  inicializarAplicacao();
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("mainContent").classList.remove("hidden");
  document.body.classList.remove("login-pending");
}

document.getElementById("btnBiometria").addEventListener("click", loginBiometrico);
