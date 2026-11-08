// Content of the animated intro (hero carousel, slide 1). Edit freely: pairs play in this order,
// one at a time: the question is typed, then its answer. The last pair is the final frame; after it
// has been fully shown and held, the carousel moves to slide 2 (the banner image).
//
// An answer is a list of parts: plain text ("\n" = new line) or a link { text, href }.

export type IntroPart = string | { text: string; href: string };

export interface IntroPair {
  question: string;
  answer: IntroPart[];
}

export const INTRO_PAIRS: IntroPair[] = [
  {
    question: "Do you need to improve your workflows and business performance using AI?",
    answer: ["I build AI solutions that help your people work better."],
  },
  {
    question: "Do you need to get more value from your data?",
    answer: ["I turn scattered data into reliable insights and actionable answers."],
  },
  {
    question: "Do you need your AI services to be faster, more reliable, and cost-effective?",
    answer: ["I evaluate, troubleshoot, and optimize your AI with MLOps."],
  },
  {
    question: "Do you need a cloud architect to deploy, migrate, or prepare your infrastructure for AI?",
    answer: ["I build with performance, privacy, and data sovereignty in mind."],
  },
  {
    question: "Do you need to improve your development workflow and production reliability?",
    answer: ["I automate delivery with DevOps and strengthen operations with SRE."],
  },
  {
    question: "Do you need to modernize your monolithic applications?",
    answer: ["I help turn them into scalable, maintainable, cloud-native apps."],
  },
  {
    question: "Do you need all the above?",
    answer: [
      "AI & Data · Cloud Architecture · DevOps & SRE.\nOne hands-on engineer. Fewer handoffs. Save budget and time.\n",
      { text: "Let’s talk. I’m here.", href: "#contact" },
    ],
  },
];

/** Default caption of slide 2 when the banner image has none. */
export const BANNER_CAPTION = "Bridging Business Goals, Human Workflows and Technology — Together.";

/** Timings (milliseconds). */
export const INTRO_TIMING = {
  questionCharMs: 38,
  answerCharMs: 24,
  /** Pause between the end of the question and the start of the answer. */
  answerDelayMs: 450,
  /** How long a completed pair stays before the next one: by length, within these bounds. */
  holdMinMs: 4000,
  holdMaxMs: 7000,
  holdPerWordMs: 220,
  /** Hold of the final frame before moving to slide 2. */
  finalHoldMs: 6000,
  /** Cross-fade between slides. */
  slideFadeMs: 700,
};

export const partText = (p: IntroPart) => (typeof p === "string" ? p : p.text);
export const answerText = (pair: IntroPair) => pair.answer.map(partText).join("");

export function holdMs(pair: IntroPair): number {
  const words = `${pair.question} ${answerText(pair)}`.split(/\s+/).length;
  const t = INTRO_TIMING;
  return Math.min(t.holdMaxMs, Math.max(t.holdMinMs, words * t.holdPerWordMs));
}

/** Playback position: slide, current pair, characters typed of its question (q) and answer (a). */
export interface IntroState {
  slide: 0 | 1;
  pair: number;
  q: number;
  a: number;
}

export const INTRO_START: IntroState = { slide: 0, pair: 0, q: 0, a: 0 };

/**
 * The next automatic step and how long to wait before it, or null when nothing plays (slide 2
 * stays until the visitor replays the intro). Question first, then answer, then a reading hold;
 * after the final pair's hold, slide 2.
 */
export function introStep(s: IntroState, pairs: IntroPair[] = INTRO_PAIRS): { delay: number; next: IntroState } | null {
  if (s.slide !== 0) return null;
  const pair = pairs[s.pair];
  const t = INTRO_TIMING;
  if (s.q < pair.question.length) return { delay: t.questionCharMs, next: { ...s, q: s.q + 1 } };
  if (s.a < answerText(pair).length) return { delay: s.a === 0 ? t.answerDelayMs : t.answerCharMs, next: { ...s, a: s.a + 1 } };
  if (s.pair < pairs.length - 1) return { delay: holdMs(pair), next: { slide: 0, pair: s.pair + 1, q: 0, a: 0 } };
  return { delay: t.finalHoldMs, next: { ...s, slide: 1 } };
}
