// "Цитата дня" на Home — один і той самий вислів для всіх студентів
// протягом календарного дня Europe/Kyiv (індекс рахується від дати, не
// від моменту запиту), змінюється о київській півночі. source: ключ
// MessageKey ("home.quote.source.proverb"/".saying"), не текст напряму.
import { kyivDateString } from "@/lib/cabinet/kyiv-date";

export type Quote = {
  fr: string;
  uk: string;
  en: string;
  source: "proverb" | "saying";
};

export const QUOTES: Quote[] = [
  {
    fr: "C’est en forgeant qu’on devient forgeron.",
    uk: "Практика робить майстра.",
    en: "Practice makes perfect.",
    source: "proverb",
  },
  {
    fr: "Petit à petit, l’oiseau fait son nid.",
    uk: "Потроху пташка гніздо будує.",
    en: "Little by little, the bird builds its nest.",
    source: "proverb",
  },
  {
    fr: "Rome ne s’est pas faite en un jour.",
    uk: "Рим не за день збудували.",
    en: "Rome wasn’t built in a day.",
    source: "proverb",
  },
  {
    fr: "Qui ne tente rien n’a rien.",
    uk: "Хто не ризикує, той нічого не має.",
    en: "Nothing ventured, nothing gained.",
    source: "proverb",
  },
  {
    fr: "Mieux vaut tard que jamais.",
    uk: "Краще пізно, ніж ніколи.",
    en: "Better late than never.",
    source: "saying",
  },
  {
    fr: "L’appétit vient en mangeant.",
    uk: "Апетит приходить під час їжі.",
    en: "Appetite comes with eating.",
    source: "saying",
  },
  {
    fr: "Après la pluie, le beau temps.",
    uk: "Після дощу — ясна погода.",
    en: "After the rain comes the sunshine.",
    source: "proverb",
  },
  {
    fr: "Tout vient à point à qui sait attendre.",
    uk: "Все приходить вчасно до того, хто вміє чекати.",
    en: "Everything comes to those who wait.",
    source: "proverb",
  },
  {
    fr: "On apprend à tout âge.",
    uk: "Вчитись ніколи не пізно.",
    en: "You are never too old to learn.",
    source: "saying",
  },
  {
    fr: "La nuit porte conseil.",
    uk: "Ранок мудріший за вечір.",
    en: "Sleep on it.",
    source: "proverb",
  },
  {
    fr: "Aide-toi, le ciel t’aidera.",
    uk: "Допоможи собі сам, і небо допоможе.",
    en: "Help yourself and heaven will help you.",
    source: "proverb",
  },
  {
    fr: "Impossible n’est pas français.",
    uk: "Слова «неможливо» французька не знає.",
    en: "“Impossible” is not a French word.",
    source: "saying",
  },
];

// Фіксований епоху-якір — довільна дата, лише щоб індекс був стабільним і
// невід'ємним для будь-якого "сьогодні" в проєкті.
const EPOCH = "2024-01-01";

export function getDailyQuote(now: Date = new Date()): Quote {
  const todayStr = kyivDateString(now);
  const daysSinceEpoch = Math.round(
    (new Date(`${todayStr}T00:00:00Z`).getTime() - new Date(`${EPOCH}T00:00:00Z`).getTime()) / 86_400_000
  );
  const index = ((daysSinceEpoch % QUOTES.length) + QUOTES.length) % QUOTES.length;
  return QUOTES[index];
}
