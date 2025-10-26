export const QUESTION_BANK = [
  {
    id: "understanding",
    title: "Ik begrijp je uitleg",
    description: "Laat studenten aangeven hoe goed ze de uitleg volgen.",
    leftLabel: "Niet",
    rightLabel: "Wel"
  },
  {
    id: "tempo",
    title: "Het tempo van de les",
    description: "Peil of je tempo moet vertragen of versnellen.",
    leftLabel: "Te langzaam",
    rightLabel: "Te snel"
  }
];

export const DEFAULT_QUESTION_ID = QUESTION_BANK[0].id;

const QUESTION_LOOKUP = QUESTION_BANK.reduce((map, question) => {
  map[question.id] = question;
  return map;
}, {});

export const getQuestion = (id) => QUESTION_LOOKUP[id] || QUESTION_LOOKUP[DEFAULT_QUESTION_ID];

export const valueToColor = (value) => {
  const numeric = Number(value) || 0;
  if (numeric < 34) return "#f43f5e";
  if (numeric < 67) return "#f97316";
  return "#22c55e";
};
