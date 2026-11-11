import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { initializeAuth, inMemoryPersistence, GoogleAuthProvider, signInWithPopup, browserPopupRedirectResolver } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {
  initializeFirestore, memoryLocalCache, doc, collection, getDocFromServer,
  getDocsFromServer, setDoc, deleteDoc, writeBatch, arrayUnion
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

export const app = initializeApp({
  apiKey: "AIzaSyBsg5Vdi5OLvIyLelDMW_FMRcY3WuH8J7s",
  authDomain: "contas-d8193.firebaseapp.com",
  projectId: "contas-d8193",
  storageBucket: "contas-d8193.firebasestorage.app",
  messagingSenderId: "1062946478447",
  appId: "1:1062946478447:web:bca392f9e6b28b1365709a",
  measurementId: "G-86M56ZYFZR"
});
const auth = initializeAuth(app, { persistence: inMemoryPersistence });
const db = initializeFirestore(app, { localCache: memoryLocalCache() });
// Analytics removido: não precisamos de armazenamento persistente de telemetria.
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

function userRef() {
  if (!auth.currentUser) throw new Error("Entre com sua conta Google.");
  return doc(db, "users", auth.currentUser.uid);
}
function online() {
  if (!navigator.onLine) throw new Error("Sem conexão. Conecte-se à internet para acessar o Firebase.");
}
export async function signIn() {
  online();
  return (await signInWithPopup(auth, provider, browserPopupRedirectResolver)).user;
}
export async function getProfile() {
  online();
  const snapshot = await getDocFromServer(userRef());
  return snapshot.exists() ? snapshot.data() : {};
}
export async function saveCredential(id) {
  online();
  await setDoc(userRef(), { credentialIds: arrayUnion(id) }, { merge: true });
}
export function currentUser() { return auth.currentUser; }
export async function saveTheme(theme) {
  online();
  await setDoc(userRef(), { theme }, { merge: true });
}
function transactions() { return collection(userRef(), "transactions"); }
export async function listTransactions() {
  online();
  const snapshot = await getDocsFromServer(transactions());
  return snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
}
export async function saveTransaction(item) {
  online();
  const { id, ...data } = item;
  await setDoc(doc(transactions(), id), data);
}
export async function removeTransaction(id) {
  online();
  await deleteDoc(doc(transactions(), id));
}
export async function importTransactions(items) {
  online();
  // Um lote atômico: falhas não deixam uma importação parcialmente concluída.
  if (items.length > 450) throw new Error("Importe no máximo 450 transações por arquivo.");
  const batch = writeBatch(db);
  for (const { id, ...data } of items) batch.set(doc(transactions(), id), data);
  await batch.commit();
}
export async function clearTransactions(ids) {
  online();
  if (ids.length > 450) throw new Error("Exclua transações individualmente até restarem no máximo 450 para limpar tudo.");
  const batch = writeBatch(db);
  for (const id of ids) batch.delete(doc(transactions(), id));
  await batch.commit();
}
