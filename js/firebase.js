import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const sanitizeCode = (code) => (code || "").replace(/\D/g, "").slice(0, 4);

const randomCode = () => String(Math.floor(1000 + Math.random() * 9000));

async function codeExists(code) {
  if (!code) return false;
  const snapshot = await get(ref(database, `sessions/${code}`));
  return snapshot.exists();
}

export async function createSession(questionId = null) {
  let attempts = 0;
  let code = randomCode();
  while (await codeExists(code)) {
    code = randomCode();
    attempts += 1;
    if (attempts > 20) {
      throw new Error("Kon geen vrije sessiecode vinden. Probeer opnieuw.");
    }
  }

  await set(ref(database, `sessions/${code}`), {
    createdAt: Date.now(),
    question: questionId,
    values: {}
  });

  return code;
}

export async function sessionExists(rawCode) {
  const code = sanitizeCode(rawCode);
  return codeExists(code);
}

export async function resetSession(rawCode) {
  const code = sanitizeCode(rawCode);
  if (!code) throw new Error("Geen sessiecode om te resetten.");
  await update(ref(database, `sessions/${code}`), { values: {} });
}

export async function updateSessionQuestion(rawCode, questionId) {
  const code = sanitizeCode(rawCode);
  if (!code) throw new Error("Geen sessiecode om te wijzigen.");
  await update(ref(database, `sessions/${code}`), { question: questionId });
}

export async function saveStudentValue(rawCode, studentId, value) {
  const code = sanitizeCode(rawCode);
  if (!code || !studentId) return;
  await set(ref(database, `sessions/${code}/values/${studentId}`), value);
}

export function subscribeToSession(rawCode, callback) {
  const code = sanitizeCode(rawCode);
  if (!code) throw new Error("Geen geldige sessiecode.");
  const sessionRef = ref(database, `sessions/${code}`);

  const handler = (snapshot) => {
    callback(snapshot.val());
  };

  onValue(sessionRef, handler);
  return () => off(sessionRef, "value", handler);
}
