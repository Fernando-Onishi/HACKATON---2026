import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAnalytics, isSupported } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js';
import { browserLocalPersistence, getAuth, setPersistence } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC7ASHj9LT9GEtJ2NF3g6-RD5YZPGPU450',
  authDomain: 'hackaton-2026-71859.firebaseapp.com',
  projectId: 'hackaton-2026-71859',
  storageBucket: 'hackaton-2026-71859.firebasestorage.app',
  messagingSenderId: '429880633196',
  appId: '1:429880633196:web:28884ffbcfbedd97be3549',
  measurementId: 'G-FYBVXK45RJ'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const authReady = setPersistence(auth, browserLocalPersistence);
const db = getFirestore(app);
let writeQueue = Promise.resolve();

isSupported().then((supported) => {
  if (supported) getAnalytics(app);
}).catch(() => {});

export async function loadUserState(userId) {
  const snapshot = await getDoc(doc(db, 'users', userId));
  return snapshot.exists() ? snapshot.data().state || null : null;
}

export function saveUserState(userId, state) {
  const snapshot = JSON.parse(JSON.stringify(state));
  writeQueue = writeQueue.catch(() => {}).then(() => setDoc(doc(db, 'users', userId), { state: snapshot, updatedAt: serverTimestamp() }));
  return writeQueue;
}

export async function deleteUserState(userId) {
  await deleteDoc(doc(db, 'users', userId));
}