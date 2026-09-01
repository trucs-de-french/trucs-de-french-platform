// Офіційна сітка оцінювання DELF Production Écrite (реформа FEI з 2023 р.,
// єдина структура критеріїв для A1–C2). Джерело дескрипторів:
// /Users/tanya/Таня/Робота/Платформа DELF/DELF_descriptors_A1-B2.md.
//
// ВАЖЛИВО: дескриптори B2 у цьому файлі — НЕ дослівна копія офіційного PDF
// FEI (сайт блокував автоматичні запити під час підготовки джерела). Вони
// реконструйовані за підтвердженою структурою балів (0/1/3/5, 5×5=25) і
// офіційно оприлюдненим переліком очікуваних умінь, узгодженим з
// дескрипторами B1/C2 тієї ж реформованої сітки. Якщо з'явиться офіційний
// текст — замінити лише B2_DESCRIPTORS нижче, решта файлу не зміниться.

export type DelfLevel = "A1" | "A2" | "B1" | "B2";

export type CriterionKey =
  | "realisationTache"
  | "coherenceCohesion"
  | "adequationSociolinguistique"
  | "lexique"
  | "morphosyntaxe";

export const CRITERIA: CriterionKey[] = [
  "realisationTache",
  "coherenceCohesion",
  "adequationSociolinguistique",
  "lexique",
  "morphosyntaxe",
];

export const CRITERION_LABELS: Record<CriterionKey, string> = {
  realisationTache: "Réalisation de la tâche",
  coherenceCohesion: "Cohérence et cohésion",
  adequationSociolinguistique: "Adéquation sociolinguistique",
  lexique: "Lexique",
  morphosyntaxe: "Morphosyntaxe",
};

// Рівень продуктивності за критерієм, який визначає AI (семантична оцінка —
// не рахується в коді). "zero" — окремий випадок "не відповів по цьому
// критерію" (у DELF-сітці це той самий 0, що й для копії blanche/недостатньої
// довжини, але тут — коли текст є, та конкретний критерій не має що
// оцінювати).
export type CriterionLevel = "zero" | "below" | "atTarget" | "above";

export type DescriptorSet = { below: string; atTarget: string; above: string };

export type LevelGrid = {
  level: DelfLevel;
  exerciseNumber?: 1 | 2;
  /** [zero, below, atTarget, above] — бали за ОДИН критерій */
  pointScale: [number, number, number, number];
  /** 5 критеріїв × максимум за критерій (пункт pointScale[3]) */
  maxScore: number;
  minWords: number;
  /** обсяг <= цього порогу слів → 0 балів за все завдання */
  insufficientThreshold: number;
  descriptors: Record<CriterionKey, DescriptorSet>;
};

const A1_DESCRIPTORS: Record<CriterionKey, DescriptorSet> = {
  realisationTache: {
    below:
      "Пише окремі слова, іноді дуже прості фрази — недостатньо для ефективного виконання завдання.",
    atTarget: "Короткі й прості фрази, що відповідають завданню.",
    above:
      "Особисте повідомлення у вигляді простих виразів/фраз; додає деталі (напр. що подобається/не подобається).",
  },
  coherenceCohesion: {
    below:
      "З'єднує лише окремі слова в мінімальні фрази (підмет+присудок), без організації; часті розриви змісту.",
    atTarget:
      "Прості фрази, з'єднані «et», «mais»; загалом зв'язний текст, можливі незначні розриви.",
    above:
      "Фрази з'єднані елементарними конекторами («alors», «parce que») або хронологічно; розриви змісту рідкісні.",
  },
  adequationSociolinguistique: {
    below:
      "Встановлює контакт базовими формулами ввічливості, іноді пропускає їх або вживає невдало.",
    atTarget:
      "Найпростіші формули ввічливості, хоча можливі неточності відповідно ситуації/адресата.",
    above: "Елементарні формули ввічливості, доречно підлаштовані під ситуацію й адресата.",
  },
  lexique: {
    below:
      "Окремі слова й елементарні вирази, недостатні для завдання; переважно фонетичне написання.",
    atTarget: "Обмежений, але достатній для завдання словник; орфографія коректна для обмеженої кількості слів.",
    above:
      "Словник, що покриває всі комунікативні потреби завдання; коректна орфографія «свого» репертуару.",
  },
  morphosyntaxe: {
    below: "Обмежений контроль базового порядку слів у мінімальній фразі.",
    atTarget: "Прості синтаксичні структури з обмеженим контролем.",
    above: "Коректне вживання простих структур, спроби складніших.",
  },
};

// A2 — Réalisation de la tâche відрізняється по вправах, решта 4 критеріїв
// спільні для Ex.1 і Ex.2.
const A2_REALISATION_EX1: DescriptorSet = {
  below: "Прості короткі фрази, недостатні для ефективного виконання завдання.",
  atTarget: "Описує подію чи досвід простими фразами, висловлює прості враження.",
  above:
    "Розповідає про подію/досвід з деталями, прикладами, описує свої почуття й реакції.",
};
const A2_REALISATION_EX2: DescriptorSet = {
  below: "Прості короткі фрази; пропущені деякі мовленнєві акти, потрібні за консигною.",
  atTarget: "Виконує основні мовленнєві акти завдання (запросити, подякувати тощо).",
  above: "Повністю виконує вимоги завдання, додає деталі для збагачення тексту.",
};
const A2_SHARED_DESCRIPTORS: Omit<Record<CriterionKey, DescriptorSet>, "realisationTache"> = {
  coherenceCohesion: {
    below:
      "З'єднує групи слів у прості фрази й перелічує їх; текст загалом зв'язний, можливі розриви змісту.",
    atTarget:
      "Прості фрази з елементарними конекторами або хронологічною/тематичною логікою; розриви рідкісні.",
    above: "Короткий, загалом зв'язний текст завдяки найпоширенішим сполучникам.",
  },
  adequationSociolinguistique: {
    below: "Найпростіші формули ввічливості, деякі слова можуть не відповідати ситуації/адресату.",
    atTarget: "Базові формули ввічливості, регістр загалом доречний.",
    above: "Найпоширеніші формули ввічливості, регістр адаптований до ситуації й адресата.",
  },
  lexique: {
    below:
      "Елементарний словник, недостатній для повного виконання завдання; переважно фонетична орфографія.",
    atTarget: "Словник, достатній для основних потреб завдання; коректна орфографія елементарних слів.",
    above: "Різноманітний словник для звичних тем; лексична орфографія переважно коректна.",
  },
  morphosyntaxe: {
    below: "Прості структури з обмеженим контролем.",
    atTarget: "Прості структури, можливі елементарні помилки при спробах складніших конструкцій.",
    above: "Коректне вживання більшості простих структур і деяких поширених складних.",
  },
};

const B1_DESCRIPTORS: Record<CriterionKey, DescriptorSet> = {
  realisationTache: {
    below:
      "Пише низку простих фраз за темою, але недостатніх для ефективного виконання завдання; висловлює думку, але брак ясності й прикладів ускладнює розуміння.",
    atTarget:
      "Суцільний нескладний текст, що загалом відповідає вимогам завдання; висловлює й обґрунтовує думку кількома прикладами.",
    above:
      "Чіткий текст, який повністю відповідає завданню; обґрунтовує думку конкретними прикладами, будує просту аргументацію.",
  },
  coherenceCohesion: {
    below:
      "Прості фрази, з'єднані елементарними конекторами або тематичною/хронологічною логікою; оформлення й пунктуація подекуди заважають розумінню.",
    atTarget: "Суцільний текст з доречними конекторами; оформлення й пунктуація здебільшого доречні.",
    above:
      "Чіткий, добре організований текст з різноманітними конекторами; оформлення й пунктуація полегшують розуміння.",
  },
  adequationSociolinguistique: {
    below:
      "Загалом підлаштовує текст під ситуацію й адресата, але часті плутанини у вираженні чи регістрі.",
    atTarget:
      "Найпоширеніші вирази й мовленнєві акти, регістр загалом доречний, можливі окремі плутанини.",
    above:
      "Текст підлаштований під адресата й тип завдання; плутанини регістру рідкісні й не заважають читачеві.",
  },
  lexique: {
    below:
      "Словника достатньо для елементарних комунікативних потреб, але замало для тем поза звичним колом інтересів; орфографія коректна лише для елементарних слів, решта — фонетично.",
    atTarget:
      "Коректно використовує широкий побутовий словник на знайомі теми; вдається до перифраз для складніших ідей; трапляються огріхи в орфографії складніших слів.",
    above:
      "Досить широкий словник для спілкування без значних обмежень на теми свого інтересу; орфографія достатньо правильна, щоб текст легко читався.",
  },
  morphosyntaxe: {
    below:
      "Коректно вживає прості синтаксичні структури, але припускається елементарних помилок при спробах складніших конструкцій.",
    atTarget: "Володіє простими структурами, відносно коректно вживає поширені складні конструкції.",
    above:
      "Добрий граматичний контроль поширених складних структур, хоча вони не дуже різноманітні.",
  },
};

// Реконструйовані дескриптори — див. застереження на початку файлу.
const B2_DESCRIPTORS: Record<CriterionKey, DescriptorSet> = {
  realisationTache: {
    below:
      "Викладає позицію за темою, але наводить мало або переважно другорядні аргументи/приклади; загальна теза не завжди чітка.",
    atTarget:
      "Чітко викладає особисту позицію, наводить релевантні аргументи з прикладами відповідно до типу тексту (лист/стаття/дебати).",
    above:
      "Аргументація глибша й розгорнутіша, враховує і зважує протилежну точку зору, переконливо нюансує висновок.",
  },
  coherenceCohesion: {
    below:
      "Загалом структурований текст (вступ/розвиток/висновок), але частині переходів бракує плавності чи логічних зв'язків.",
    atTarget: "Логічна структура з різноманітними конекторами, ясний поділ на абзаци.",
    above:
      "Вільна, складна організація тексту з розмаїтими засобами зв'язності, що не заважають читанню.",
  },
  adequationSociolinguistique: {
    below:
      "Здебільшого доречний регістр для типу тексту, але подекуди плутанина тону чи формул звертання.",
    atTarget: "Витримує формальний/публіцистичний регістр, доречний для листа, статті чи дебатів.",
    above:
      "Стилістично гнучкий, точно підлаштований під адресата й жанр, використовує засоби переконання доречно.",
  },
  lexique: {
    below:
      "Достатньо широкий словник для теми, але трапляються неточності у виборі слів чи повтори, що не заважають розумінню.",
    atTarget:
      "Точний і достатньо широкий словник для абстрактних і суспільних тем, рідкісні лексичні помилки.",
    above: "Багатий, нюансований, подекуди ідіоматичний словник; орфографія стабільно коректна.",
  },
  morphosyntaxe: {
    below:
      "Загалом добрий граматичний контроль, але трапляються повторювані, легко помітні помилки у складних структурах.",
    atTarget:
      "Добрий контроль складних структур (умовний спосіб, підрядні речення тощо), помилки рідкісні й не заважають розумінню.",
    above:
      "Високий рівень граматичної точності навіть у розгорнутих і складних конструкціях, помилки поодинокі.",
  },
};

/**
 * Повертає повну сітку оцінювання для рівня (і, для A2, конкретної вправи —
 * Réalisation de la tâche відрізняється між Ex.1 і Ex.2). Для A1
 * повертає сітку ЛИШЕ Exercice 2 (особисте повідомлення) — Exercice 1
 * (формуляр) не є есе й не має дескрипторів, див. A1_FORMULAIRE нижче.
 */
export function getLevelGrid(level: DelfLevel, exerciseNumber?: 1 | 2): LevelGrid {
  switch (level) {
    case "A1":
      return {
        level: "A1",
        exerciseNumber: 2,
        pointScale: [0, 0.5, 2, 3],
        maxScore: 15,
        minWords: 40,
        insufficientThreshold: 19,
        descriptors: A1_DESCRIPTORS,
      };
    case "A2":
      return {
        level: "A2",
        exerciseNumber,
        pointScale: [0, 0.5, 1.5, 2.5],
        maxScore: 12.5,
        minWords: 60,
        insufficientThreshold: 29,
        descriptors: {
          realisationTache: exerciseNumber === 1 ? A2_REALISATION_EX1 : A2_REALISATION_EX2,
          ...A2_SHARED_DESCRIPTORS,
        },
      };
    case "B1":
      return {
        level: "B1",
        pointScale: [0, 1, 3, 5],
        maxScore: 25,
        minWords: 160,
        insufficientThreshold: 79,
        descriptors: B1_DESCRIPTORS,
      };
    case "B2":
      return {
        level: "B2",
        pointScale: [0, 1, 3, 5],
        maxScore: 25,
        minWords: 250,
        insufficientThreshold: 124,
        descriptors: B2_DESCRIPTORS,
      };
  }
}

/**
 * Стисле резюме критеріїв для адмін-форми (поле "Критерії перевірки") —
 * лише рівень "на цільовому рівні" (atTarget) по кожному з 5 критеріїв,
 * дослівно з дескрипторів вище (жодного окремого "стислого" тексту, що
 * міг би розійтись з тим, що йде в промпт checkEssayAnswer).
 */
export function summarizeCriteriaForTeacher(level: DelfLevel, exerciseNumber?: 1 | 2): string {
  const grid = getLevelGrid(level, exerciseNumber);
  return CRITERIA.map(
    (key) => `- ${CRITERION_LABELS[key]}: ${grid.descriptors[key].atTarget}`
  ).join("\n");
}

// A1 Exercice 1 (формуляр) — не есе: фактологічна перевірка полів консигни,
// 1 бал за кожен коректно заповнений пункт, без дескрипторів продуктивності.
export const A1_FORMULAIRE = {
  level: "A1" as const,
  exerciseNumber: 1 as const,
  pointsPerField: 1,
};

// --- Аномалії -----------------------------------------------------------
//
// Довжину тексту рахує код (детерміновано). Тематичну/дискурсивну
// відповідність консигні може оцінити лише AI (семантика) — код лише
// ЗАСТОСОВУЄ стелі балів, які накладає кожен hors-sujet-прапорець, а не
// довіряє AI самостійно порахувати фінальні бали для цих критеріїв.

export type LengthAnomaly = "empty" | "insufficientLength";

export function detectLengthAnomaly(wordCount: number, grid: LevelGrid): LengthAnomaly | null {
  if (wordCount === 0) return "empty";
  if (wordCount <= grid.insufficientThreshold) return "insufficientLength";
  return null;
}

export type TopicAnomaly = "horsSujetThematique" | "horsSujetDiscursif" | "horsSujetComplet";

/**
 * Максимальний дозволений CriterionLevel для критерію під заданим набором
 * тематичних аномалій (за правилами документа). Повертає null, якщо
 * аномалії не обмежують цей критерій.
 */
export function maxLevelForCriterion(
  criterion: CriterionKey,
  anomalies: TopicAnomaly[]
): CriterionLevel | null {
  if (anomalies.includes("horsSujetComplet")) {
    if (criterion === "realisationTache" || criterion === "coherenceCohesion" || criterion === "adequationSociolinguistique") {
      return "zero";
    }
    // lexique / morphosyntaxe — не вище базового рівня ("below")
    return "below";
  }

  let cap: CriterionLevel | null = null;
  if (anomalies.includes("horsSujetDiscursif")) {
    if (criterion === "realisationTache" || criterion === "coherenceCohesion") {
      cap = "below";
    }
  }
  if (anomalies.includes("horsSujetThematique")) {
    if (criterion === "realisationTache" || criterion === "lexique") {
      const capAtTarget: CriterionLevel = "atTarget";
      cap = cap === "below" ? cap : capAtTarget;
    }
  }
  return cap;
}

const LEVEL_ORDER: CriterionLevel[] = ["zero", "below", "atTarget", "above"];

export function capLevel(level: CriterionLevel, cap: CriterionLevel | null): CriterionLevel {
  if (!cap) return level;
  return LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(cap) ? cap : level;
}

export function levelToPoints(level: CriterionLevel, grid: LevelGrid): number {
  const index = LEVEL_ORDER.indexOf(level);
  return grid.pointScale[index];
}
