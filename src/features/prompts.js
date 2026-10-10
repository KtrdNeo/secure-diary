export const WRITING_PROMPTS = [
  'What is one thing that made you smile today?',
  'Describe a moment today you want to remember in ten years.',
  'What are you worrying about, and what is within your control?',
  'Who are you grateful for right now, and why?',
  'What did you learn today that surprised you?',
  'Write a letter to yourself one year from now.',
  'What is a small habit you would like to build?',
  'Describe your perfect ordinary day.',
  'What would you do if you were not afraid?',
  'What is something you forgave recently - or need to?',
  'Which moment today did you feel most like yourself?',
  'What do you need more of in your life? Less of?',
  'Describe a place where you feel completely at peace.',
  'What is a lesson a difficult time taught you?',
  'Write about a person who shaped who you are.',
  'What are three things going well right now?',
  'What did you avoid today, and why?',
  'What is a goal you are proud of working toward?',
  'Describe how your body feels right now, head to toe.',
  'What would you tell your younger self?',
  'What is something you are looking forward to?',
  'Write about a meal you will never forget.',
  'What is draining your energy, and what restores it?',
  'What does success mean to you today?',
  'Describe a kindness you gave or received this week.',
  'What are you curious about lately?',
  'Which of your values did you live out today?',
  'What would make tomorrow a good day?',
  'Write down something you are letting go of.',
  'If today were a chapter title, what would it be?',
];

const DAY_MS = 86400000;

export function promptForDate(date = new Date()) {
  const idx = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
  return WRITING_PROMPTS[((idx % WRITING_PROMPTS.length) + WRITING_PROMPTS.length) % WRITING_PROMPTS.length];
}

export function randomPrompt(exclude, rand = Math.random) {
  const pool = WRITING_PROMPTS.filter((x) => x !== exclude);
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}
