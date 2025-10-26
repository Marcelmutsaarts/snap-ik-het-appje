import { sessionExists, saveStudentValue, subscribeToSession } from "./firebase.js";
import { DEFAULT_QUESTION_ID, getQuestion, valueToColor } from "./questions.js";

const sessionForm = document.getElementById("sessionForm");
const sessionInput = document.getElementById("sessionCode");
const sessionFeedback = document.getElementById("sessionFeedback");
const sliderSection = document.getElementById("sliderSection");
const slider = document.getElementById("understandingSlider");
const valueLabel = document.getElementById("valueLabel");
const questionTitle = document.getElementById("questionTitle");
const leftLabel = document.getElementById("leftLabel");
const rightLabel = document.getElementById("rightLabel");

const STORAGE_KEYS = {
  studentId: "bt_student_id",
  sessionCode: "bt_active_session"
};

let activeSessionCode = null;
let debounceTimer = null;
let sessionUnsubscribe = null;
let currentQuestionId = DEFAULT_QUESTION_ID;

const randomId = () =>
  (self.crypto?.randomUUID?.() || `student-${Math.random().toString(36).slice(2, 10)}`);

const getStudentId = () => {
  const stored = localStorage.getItem(STORAGE_KEYS.studentId);
  if (stored) return stored;
  const fresh = randomId();
  localStorage.setItem(STORAGE_KEYS.studentId, fresh);
  return fresh;
};

const studentId = getStudentId();

const sanitize = (value) => (value || "").replace(/\D/g, "").slice(0, 4);

const updateSliderVisuals = (value) => {
  const percent = Number(value);
  const color = valueToColor(percent);
  valueLabel.textContent = `${percent}%`;
  valueLabel.style.color = color;
  slider.style.setProperty("--thumb-color", color);
  slider.style.background = `linear-gradient(90deg, ${color} 0%, ${color} ${percent}%, rgba(255,255,255,0.15) ${percent}%, rgba(255,255,255,0.15) 100%)`;
};

const updateQuestionCopy = (questionId) => {
  const question = getQuestion(questionId);
  if (questionTitle) questionTitle.textContent = question.title;
  if (leftLabel) leftLabel.textContent = question.leftLabel;
  if (rightLabel) rightLabel.textContent = question.rightLabel;
};

const showSliderSection = () => {
  sliderSection.classList.remove("hidden");
  sessionFeedback.textContent = "Verbonden! Gebruik de slider om je standpunt te delen.";
  sessionFeedback.classList.remove("error");
  sessionFeedback.classList.add("success");
  updateQuestionCopy(currentQuestionId);
};

const hideSliderSection = (message) => {
  sliderSection.classList.add("hidden");
  sessionFeedback.textContent = message;
  sessionFeedback.classList.remove("success");
  sessionFeedback.classList.add("error");
};

const detachSessionListener = () => {
  if (sessionUnsubscribe) {
    sessionUnsubscribe();
    sessionUnsubscribe = null;
  }
};

const handleSessionStream = (payload) => {
  if (!payload) {
    detachSessionListener();
    localStorage.removeItem(STORAGE_KEYS.sessionCode);
    activeSessionCode = null;
    hideSliderSection("De sessie is gestopt. Vraag je docent om een nieuwe code.");
    return;
  }

  const questionId = payload.question || DEFAULT_QUESTION_ID;
  currentQuestionId = questionId;
  updateQuestionCopy(questionId);

  const myValue = payload.values?.[studentId];
  if (typeof myValue === "number" && !Number.isNaN(myValue)) {
    slider.value = myValue;
    updateSliderVisuals(myValue);
  } else {
    slider.value = 50;
    updateSliderVisuals(50);
    sessionFeedback.textContent = "Nieuwe meting: beweeg de slider naar jouw antwoord.";
    sessionFeedback.classList.remove("error");
    sessionFeedback.classList.add("success");
  }
};

const handleSessionJoin = async (code) => {
  sessionFeedback.textContent = "Zoeken...";
  sessionFeedback.classList.remove("error", "success");
  const exists = await sessionExists(code);
  if (!exists) {
    sessionFeedback.textContent = "Onbekende code. Controleer het nummer bij je docent.";
    sessionFeedback.classList.add("error");
    localStorage.removeItem(STORAGE_KEYS.sessionCode);
    return;
  }
  detachSessionListener();
  activeSessionCode = code;
  localStorage.setItem(STORAGE_KEYS.sessionCode, code);
  showSliderSection();
  try {
    sessionUnsubscribe = subscribeToSession(code, handleSessionStream);
  } catch (error) {
    console.error(error);
    hideSliderSection("Verbinden mislukt. Probeer opnieuw.");
    return;
  }
  await pushValue(slider.value);
};

const pushValue = async (value) => {
  if (!activeSessionCode) return;
  try {
    await saveStudentValue(activeSessionCode, studentId, Number(value));
  } catch (error) {
    sessionFeedback.textContent = "Opslaan mislukt. Probeer opnieuw.";
    sessionFeedback.classList.add("error");
  }
};

sessionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = sanitize(sessionInput.value);
  if (code.length !== 4) {
    sessionFeedback.textContent = "De code bestaat uit vier cijfers.";
    sessionFeedback.classList.add("error");
    return;
  }
  handleSessionJoin(code);
});

slider.addEventListener("input", (event) => {
  const value = event.target.value;
  updateSliderVisuals(value);
  if (!activeSessionCode) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => pushValue(value), 120);
});

// Prefill + auto-join als er eerder een sessie actief was
const savedCode = sanitize(localStorage.getItem(STORAGE_KEYS.sessionCode));
if (savedCode && savedCode.length === 4) {
  sessionInput.value = savedCode;
  handleSessionJoin(savedCode);
} else {
  updateSliderVisuals(slider.value);
}

window.addEventListener("beforeunload", () => {
  detachSessionListener();
});
