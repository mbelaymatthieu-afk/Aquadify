import type { Lang } from "@/src/i18n/translations";

// Large pool of varied hydration reminder messages so users almost never
// see the same one twice. Mixed tones: motivation, health, sport, heat,
// humour, tips. Localized fr/en/es.
const MESSAGES: Record<Lang, string[]> = {
  fr: [
    "💧 Petite pause hydratation ? Un verre d'eau te fera du bien !",
    "Ton corps te dit merci à chaque gorgée 💙",
    "Reste au top : bois un peu d'eau maintenant.",
    "Un verre d'eau = un boost d'énergie gratuit ⚡",
    "Objectif du jour : garde le rythme, hydrate-toi !",
    "Ta peau adore l'eau. Offre-lui un verre 💧",
    "Concentration en baisse ? Souvent c'est la soif. Bois !",
    "Champion·ne de l'hydratation, c'est l'heure d'un verre 🏆",
    "Après l'effort, le réconfort… d'un bon verre d'eau 💦",
    "Il fait chaud ? Double la mise sur l'eau aujourd'hui ☀️",
    "Hydrate-toi avant d'avoir soif, ton corps anticipe déjà.",
    "Un petit verre maintenant, un grand bien après 😊",
    "L'eau, c'est ton super-pouvoir du quotidien 🦸",
    "Pause écran, pause eau. Les deux font du bien 👀",
    "Buvez, respirez, souriez. On commence par l'eau 💧",
    "Ni thé ni café : juste de l'eau, la vraie star.",
    "Ton cerveau carbure à l'eau. Fais le plein 🧠",
    "Encore quelques gorgées pour atteindre ton objectif !",
    "L'hydratation, c'est 90% de motivation et 10% de gorgées 😉",
    "Un verre d'eau maintenant t'évite le coup de barre de 16h.",
    "Sportif·ve dans l'âme ? L'eau, c'est ta meilleure alliée 🏃",
    "Rappel doux : ta bouteille t'attend, va la vider un peu 💧",
    "Chaque gorgée compte. Tu es sur la bonne voie !",
    "Hydrate-toi, ton cœur travaille mieux avec de l'eau ❤️",
    "Le secret d'une journée réussie ? Rester hydraté·e.",
    "Plus d'eau, moins de fatigue. Simple et efficace 💪",
  ],
  en: [
    "💧 Hydration break? A glass of water would feel great!",
    "Your body thanks you with every sip 💙",
    "Stay sharp: drink a little water now.",
    "A glass of water = a free energy boost ⚡",
    "Today's goal: keep the rhythm, hydrate!",
    "Your skin loves water. Give it a glass 💧",
    "Losing focus? It's often thirst. Drink up!",
    "Hydration champion, it's time for a glass 🏆",
    "After the effort, the reward… a nice glass of water 💦",
    "Hot day? Go double on water today ☀️",
    "Drink before you're thirsty — your body's ahead of you.",
    "A small glass now, a big win later 😊",
    "Water is your everyday superpower 🦸",
    "Screen break, water break. Both feel good 👀",
    "Drink, breathe, smile. Start with water 💧",
    "No tea, no coffee: just water, the real star.",
    "Your brain runs on water. Fill it up 🧠",
    "Just a few more sips to reach your goal!",
    "Hydration is 90% motivation, 10% sips 😉",
    "A glass now saves you the afternoon slump.",
    "Sporty soul? Water is your best ally 🏃",
    "Gentle reminder: your bottle is waiting 💧",
    "Every sip counts. You're on the right track!",
    "Hydrate — your heart works better with water ❤️",
    "The secret to a great day? Staying hydrated.",
    "More water, less fatigue. Simple and effective 💪",
  ],
  es: [
    "💧 ¿Pausa de hidratación? ¡Un vaso de agua te vendría genial!",
    "Tu cuerpo te lo agradece con cada sorbo 💙",
    "Mantente al 100%: bebe un poco de agua ahora.",
    "Un vaso de agua = un chute de energía gratis ⚡",
    "Objetivo de hoy: ¡mantén el ritmo, hidrátate!",
    "Tu piel ama el agua. Dale un vaso 💧",
    "¿Pierdes concentración? Suele ser sed. ¡Bebe!",
    "Campeón/a de la hidratación, hora de un vaso 🏆",
    "Tras el esfuerzo, la recompensa… un buen vaso de agua 💦",
    "¿Hace calor? Dobla el agua hoy ☀️",
    "Bebe antes de tener sed, tu cuerpo se adelanta.",
    "Un vasito ahora, un gran bienestar después 😊",
    "El agua es tu superpoder diario 🦸",
    "Pausa de pantalla, pausa de agua. Ambas sientan bien 👀",
    "Bebe, respira, sonríe. Empieza por el agua 💧",
    "Ni té ni café: solo agua, la verdadera estrella.",
    "Tu cerebro funciona con agua. Rellénalo 🧠",
    "¡Unos sorbos más para alcanzar tu objetivo!",
    "La hidratación es 90% motivación y 10% sorbos 😉",
    "Un vaso ahora te evita el bajón de la tarde.",
    "¿Alma deportista? El agua es tu mejor aliada 🏃",
    "Recordatorio suave: tu botella te espera 💧",
    "Cada sorbo cuenta. ¡Vas por buen camino!",
    "Hidrátate: tu corazón trabaja mejor con agua ❤️",
    "¿El secreto de un buen día? Mantenerte hidratado/a.",
    "Más agua, menos fatiga. Simple y eficaz 💪",
  ],
};

// Shuffle a copy of the array (Fisher–Yates).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Returns `count` reminder messages with as little repetition as possible.
// If more slots than unique messages, it reshuffles and continues.
export function pickReminderMessages(lang: Lang, count: number): string[] {
  const pool = MESSAGES[lang] || MESSAGES.fr;
  const out: string[] = [];
  let bag = shuffle(pool);
  for (let i = 0; i < count; i++) {
    if (bag.length === 0) bag = shuffle(pool);
    out.push(bag.pop() as string);
  }
  return out;
}
