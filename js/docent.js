import {
  createSession,
  resetSession,
  sessionExists,
  subscribeToSession,
  updateSessionQuestion
} from "./firebase.js";
import { QUESTION_BANK, DEFAULT_QUESTION_ID, getQuestion, valueToColor } from "./questions.js";

const PIN_CODE = "8319";

const pinGate = document.getElementById("pinGate");
const pinForm = document.getElementById("pinForm");
const pinInput = document.getElementById("pinInput");
const pinFeedback = document.getElementById("pinFeedback");

const activeCodeEl = document.getElementById("activeCode");
const avgDisplay = document.getElementById("avgDisplay");
const countDisplay = document.getElementById("countDisplay");
const newSessionBtn = document.getElementById("newSessionBtn");
const resetSessionBtn = document.getElementById("resetSessionBtn");
const sessionStatus = document.getElementById("sessionStatus");
const joinForm = document.getElementById("joinForm");
const joinCodeInput = document.getElementById("joinCode");
const lastUpdatedEl = document.getElementById("lastUpdated");
const questionOptions = document.getElementById("questionOptions");
const activeQuestionTitle = document.getElementById("activeQuestionTitle");
const activeQuestionLeft = document.getElementById("activeQuestionLeft");
const activeQuestionRight = document.getElementById("activeQuestionRight");
const meterTrack = document.getElementById("meterTrack");
const meterPointer = document.getElementById("meterPointer");
const meterValue = document.getElementById("meterValue");
const meterLeftLabel = document.getElementById("meterLeftLabel");
const meterRightLabel = document.getElementById("meterRightLabel");

let activeCode = null;
let sessionUnsubscribe = null;
let selectedQuestionId = DEFAULT_QUESTION_ID;

const sanitize = (value) => (value || "").replace(/\D/g, "").slice(0, 4);

const formatCode = (code) => (code ? code.split("").join(" ") : "- - - -");

const setStatus = (message, type = "info") => {
  sessionStatus.textContent = message || "";
  sessionStatus.classList.remove("error", "success");
  if (type === "error") sessionStatus.classList.add("error");
  if (type === "success") sessionStatus.classList.add("success");
};

const unlockDocentUI = () => {
  document.body.classList.remove("locked");
  pinGate?.classList.add("hidden");
  if (pinFeedback) {
    pinFeedback.classList.remove("error");
    pinFeedback.textContent = "";
  }
};

const requirePin = () => {
  if (!pinGate) return;
  document.body.classList.add("locked");
  pinGate.classList.remove("hidden");
  pinInput?.focus();
};

pinForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = (pinInput?.value || "").trim();
  if (value === PIN_CODE) {
    unlockDocentUI();
    return;
  }
  if (pinFeedback) {
    pinFeedback.textContent = "Onjuiste code. Probeer opnieuw.";
    pinFeedback.classList.add("error");
  }
  if (pinInput) {
    pinInput.value = "";
    pinInput.focus();
  }
});

const highlightQuestionOption = (questionId) => {
  if (!questionOptions) return;
  const options = questionOptions.querySelectorAll(".question-option");
  options.forEach((option) => {
    const input = option.querySelector("input");
    const isActive = input?.value === questionId;
    option.classList.toggle("active", Boolean(isActive));
    if (input) input.checked = Boolean(isActive);
  });
};

const updateActiveQuestion = (questionId) => {
  const question = getQuestion(questionId);
  if (activeQuestionTitle) activeQuestionTitle.textContent = question.title;
  if (activeQuestionLeft) activeQuestionLeft.textContent = question.leftLabel;
  if (activeQuestionRight) activeQuestionRight.textContent = question.rightLabel;
  if (meterLeftLabel) meterLeftLabel.textContent = question.leftLabel;
  if (meterRightLabel) meterRightLabel.textContent = question.rightLabel;
};

const renderQuestionOptions = () => {
  if (!questionOptions) return;
  questionOptions.innerHTML = "";
  QUESTION_BANK.forEach((question) => {
    const label = document.createElement("label");
    label.className = "question-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "questionOption";
    input.value = question.id;
    input.checked = question.id === selectedQuestionId;
    input.addEventListener("change", () => {
      selectedQuestionId = question.id;
      highlightQuestionOption(question.id);
      if (activeCode) {
        updateSessionQuestion(activeCode, question.id).catch(() => {
          setStatus("Vraag kon niet worden bijgewerkt. Probeer opnieuw.", "error");
        });
      } else {
        updateActiveQuestion(question.id);
      }
    });

    const copyWrapper = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = question.title;
    const description = document.createElement("span");
    description.className = "form-hint";
    description.textContent = question.description;
    copyWrapper.append(title, description);

    label.append(input, copyWrapper);
    if (question.id === selectedQuestionId) label.classList.add("active");
    questionOptions.append(label);
  });
};

const updateLastUpdated = (timestamp, hasData) => {
  if (!lastUpdatedEl) return;
  if (!hasData) {
    lastUpdatedEl.textContent = "Nog geen data";
    return;
  }
  lastUpdatedEl.textContent = `Laatste update: ${new Date(timestamp).toLocaleTimeString("nl-NL")}`;
};

const updateMeter = (avg, hasData) => {
  if (!meterTrack || !meterPointer || !meterValue) return;
  const clamped = Math.max(0, Math.min(100, avg));
  const color = hasData ? valueToColor(clamped) : "var(--accent)";
  const position = hasData ? clamped : 50;
  meterPointer.style.left = `${position}%`;
  meterPointer.style.background = color;
  meterPointer.style.opacity = hasData ? 1 : 0.4;
  meterValue.textContent = hasData ? `${clamped}%` : "--";
  meterTrack.classList.toggle("empty", !hasData);
};

const renderSummary = (values) => {
  const entries = Object.values(values || {});
  const count = entries.length;
  const avg = count ? Math.round(entries.reduce((sum, val) => sum + Number(val), 0) / count) : 0;
  avgDisplay.textContent = count ? `${avg}%` : "--";
  countDisplay.textContent = String(count);
  updateMeter(avg, count > 0);
  if (count) {
    avgDisplay.style.color = valueToColor(avg);
    updateLastUpdated(Date.now(), true);
  } else {
    avgDisplay.style.color = "var(--accent)";
    updateLastUpdated(null, false);
  }
};

const handleSessionPayload = (payload) => {
  if (!payload) {
    renderSummary({});
    setStatus("Sessie is niet meer actief.", "error");
    document.body.classList.remove("session-live");
    return;
  }

  document.body.classList.add("session-live");
  const questionId = payload.question || DEFAULT_QUESTION_ID;
  selectedQuestionId = questionId;
  highlightQuestionOption(questionId);
  updateActiveQuestion(questionId);
  renderSummary(payload.values || {});
  setStatus("Live gekoppeld.", "success");
};

const activateCode = (code) => {
  if (sessionUnsubscribe) {
    sessionUnsubscribe();
    sessionUnsubscribe = null;
  }
  activeCode = code;
  document.body.classList.toggle("session-live", Boolean(code));
  activeCodeEl.textContent = formatCode(code);
  resetSessionBtn.disabled = !code;
  updateMeter(0, false);
  updateLastUpdated(null, false);
  if (code) {
    try {
      sessionUnsubscribe = subscribeToSession(code, handleSessionPayload);
    } catch (error) {
      console.error(error);
      setStatus("Kon sessie niet koppelen. Probeer opnieuw.", "error");
      activeCode = null;
      document.body.classList.remove("session-live");
      resetSessionBtn.disabled = true;
    }
  } else {
    document.body.classList.remove("session-live");
  }
};

const startNewSession = async () => {
  setStatus("Nieuwe sessie wordt aangemaakt...");
  newSessionBtn.disabled = true;
  try {
    const code = await createSession(selectedQuestionId);
    activateCode(code);
  } catch (error) {
    console.error(error);
    setStatus("Kon geen sessie starten. Probeer opnieuw.", "error");
  } finally {
    newSessionBtn.disabled = false;
  }
};

const attemptJoin = async (code) => {
  setStatus("Code wordt gecontroleerd...");
  const exists = await sessionExists(code);
  if (!exists) {
    setStatus("Onbekende code. Start een nieuwe sessie of controleer het nummer.", "error");
    return;
  }
  activateCode(code);
};

newSessionBtn.addEventListener("click", () => {
  startNewSession();
});

resetSessionBtn.addEventListener("click", async () => {
  if (!activeCode) return;
  resetSessionBtn.disabled = true;
  setStatus("Sessie wordt leeggemaakt...");
  try {
    await resetSession(activeCode);
    avgDisplay.textContent = "0%";
    countDisplay.textContent = "0";
    updateMeter(0, false);
    updateLastUpdated(null, false);
    setStatus("Sessie is gereset.");
  } catch (error) {
    console.error(error);
    setStatus("Reset mislukt. Probeer opnieuw.", "error");
  } finally {
    resetSessionBtn.disabled = false;
  }
});

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = sanitize(joinCodeInput.value);
  if (code.length !== 4) {
    setStatus("Voer vier cijfers in.", "error");
    return;
  }
  attemptJoin(code);
});

window.addEventListener("beforeunload", () => {
  if (sessionUnsubscribe) {
    sessionUnsubscribe();
  }
});

renderQuestionOptions();
updateActiveQuestion(selectedQuestionId);
updateMeter(0, false);
requirePin();
