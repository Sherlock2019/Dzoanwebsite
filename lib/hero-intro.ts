// Content and timing of the home hero carousel. Edit freely.
//
// Slide 1 has several versions ("intro styles"), listed in INTRO_VARIANTS. Each version is one
// vertical scrolling sequence of sections: it scrolls down automatically, holding each section for
// `holdMs` once its text has faded in, and stops at its last section, the closing invitation.
// Visitors pick a version with the "Intro style" selector; slide 2 (the banner image) is shared.
//
// To add a version: append an entry to INTRO_VARIANTS with a new stable `id`, a `label` for the
// selector and its ordered `sections`, ending with a closing section.
//
// "\n" inside a string is an intentional line break (text still wraps naturally on small screens).

/** The invitation that ends every version; `link` is the part that links to the calendar. */
export interface Invitation {
  lead: string;
  before: string;
  link: string;
  after: string;
  /** Optional last words, shown in bold after `after`. */
  end?: string;
  postscript: string;
}

export type IntroSection =
  /** A question with its answer. */
  | { kind: "qa"; topic: string; question: string; answer: string }
  /**
   * A poem stanza: its first line is emphasized unless `plainLead`. Optional small title above it,
   * and an optional italic note under the title.
   */
  | { kind: "stanza"; title?: string; note?: string; text: string; plainLead?: boolean }
  /** The closing invitation (always last), with optional headline, skills and body above it. */
  | { kind: "closing"; headline?: string; skills?: string; body?: string[]; invitation: Invitation };

export interface IntroVariant {
  /** Stable id, saved in the visitor's browser: do not rename. */
  id: string;
  /** Name in the "Intro style" selector. */
  label: string;
  /** Full title of the version (accessible name of its sequence). */
  title: string;
  sections: IntroSection[];
}

export const INVITATION: Invitation = {
  lead: "Then we really need to talk.",
  before: "I’m here.\nJust ",
  link: "book a moment in my calendar",
  after: "—\nI’ll be listening.",
  postscript: "P.S. I’m not an AI chatbot. I’m a real human.",
};

/** Calendar button labels (the URL is the profile's booking URL). */
export const BOOKING = {
  label: "Book my calendar",
  /** Used when the profile has no booking URL: links go to the contact section instead. */
  fallbackLabel: "Let’s talk",
};

const QA_VARIANT: IntroVariant = {
  id: "qa",
  label: "Questions & Answers",
  title: "Questions & Answers",
  sections: [
    {
      kind: "qa",
      topic: "CEO",
      question: "As a CEO, do you need to turn\nbusiness pains into business wins?",
      answer: "Let’s talk about what holds you back—\nand what we can build next.",
    },
    {
      kind: "qa",
      topic: "CFO",
      question: "As a CFO, do you need more value from your services,\nwith a lower total cost of ownership?",
      answer: "Let’s make every investment count—\nin money saved and value gained.",
    },
    {
      kind: "qa",
      topic: "CTO",
      question: "As a CTO, do you need your team to move faster,\nwork smarter, and feel happier?",
      answer: "Let’s clear the friction from their day\nand give good ideas room to grow.",
    },
    {
      kind: "qa",
      topic: "AI workflows",
      question: "Do you need AI to improve your workflows?",
      answer: "I build tools that lighten the load\nand help your people do their best work.",
    },
    {
      kind: "qa",
      topic: "Data",
      question: "Do you need more value from your data?",
      answer: "I connect the scattered pieces\nso clearer answers can guide your next move.",
    },
    {
      kind: "qa",
      topic: "AI reliability · MLOps",
      question: "Do you need faster, more reliable, cost-effective AI?",
      answer: "I trace, evaluate, and tune—\nturning promising demos into dependable services.",
    },
    {
      kind: "qa",
      topic: "Cloud",
      question: "Do you need a cloud ready for what comes next?",
      answer: "I design, migrate, and optimize—\nwith performance, privacy, and sovereignty in mind.",
    },
    {
      kind: "qa",
      topic: "DevOps · SRE",
      question: "Do you need smoother delivery and reliable operations?",
      answer: "I bring DevOps to the release\nand SRE to the running.",
    },
    {
      kind: "qa",
      topic: "Modernization",
      question: "Do you need to modernize applications that hold you back?",
      answer: "I help them grow beyond the monolith—\neasier to maintain, ready to scale.",
    },
    {
      kind: "qa",
      topic: "Customer understanding",
      question: "Do you need someone who hears your customers’ pain\nand turns understanding into solutions?",
      answer: "I listen first. Build with purpose.\nAnd stay to see the outcome.",
    },
    {
      kind: "closing",
      headline: "And if you need all the above in one person?",
      skills: "AI & Data · Cloud Architecture · DevOps & SRE.",
      body: ["One hands-on engineer—\nsaving headcount, budget, and time.", "And more than that—\na servant to your team,\nyour company,\nand your customers."],
      invitation: INVITATION,
    },
  ],
};

const POEM_VARIANT: IntroVariant = {
  id: "poem",
  label: "If you need...",
  title: "If — A Builder’s Promise",
  sections: [
    {
      kind: "stanza",
      title: "If — A Builder’s Promise",
      note: "Inspired by Rudyard Kipling’s poem “If—”",
      text: "If, as a CEO, you see what could be,\nYet daily troubles keep that goal from view,\nLet’s name the pains and find the possibility—\nThen build the next step, and see it through.",
    },
    {
      kind: "stanza",
      text: "If, as a CFO, you weigh each cost,\nAnd ask what lasting value it will bring,\nLet’s find where time and resources are lost,\nAnd make each investment earn its keep.",
    },
    {
      kind: "stanza",
      text: "If, as a CTO, you lead a team\nWhose days leave little room to think or grow,\nLet’s clear the friction, give good ideas a chance,\nAnd build a pace that lets your people thrive.",
    },
    {
      kind: "stanza",
      text: "If work repeats until it wears people down,\nAnd AI could help them carry less,\nI’ll build the tools that lighten daily burdens,\nAnd judge their worth by whom they help progress.",
    },
    {
      kind: "stanza",
      text: "If scattered data hides the answers that you seek,\nAnd every source presents a different view,\nI’ll bring the pieces into clearer order,\nSo evidence can guide what next you do.",
    },
    {
      kind: "stanza",
      text: "If AI shines in demos, yet falters in the day,\nOr costs too much for answers slow to come,\nI’ll trace, evaluate, and tune its workings,\nUntil its promise earns your trust through use.",
    },
    {
      kind: "stanza",
      text: "If your cloud must bear tomorrow’s weight,\nWhile keeping private what belongs to you,\nI’ll design, migrate, and strengthen its foundations,\nWith sovereignty and performance in view.",
    },
    {
      kind: "stanza",
      text: "If every release brings worry to your team,\nAnd every outage steals another night,\nI’ll automate the path from code to service,\nAnd help keep systems steady, day and night.",
    },
    {
      kind: "stanza",
      text: "If a monolith confines what you can change,\nAnd growth makes every small revision slow,\nI’ll help reshape it, one sound step at a time,\nInto services you can maintain and grow.",
    },
    {
      kind: "stanza",
      text: "If customers need someone who will listen,\nBefore a tool or answer is prescribed,\nI’ll hear their pain, build with them toward a purpose,\nAnd stay to see the outcome come alive.",
    },
    {
      kind: "stanza",
      text: "And if you seek all this in one person—\nAI & Data · Cloud Architecture · DevOps & SRE—\nOne hands-on engineer to save you\nHeadcount, budget, time, and needless handoffs;",
    },
    {
      kind: "stanza",
      text: "And more than that, someone prepared to be\nA servant to your team,\nYour company,\nyour customers—\nand you want to Build Together an Earth of Abundance and prosperity for Us and generations to come ...",
      plainLead: true,
    },
    { kind: "closing", invitation: { ...INVITATION, after: "—\n", end: "I’ll be listening." } },
  ],
};

/** Every version of slide 1, in selector order. The first is the default. */
export const INTRO_VARIANTS: IntroVariant[] = [QA_VARIANT, POEM_VARIANT];

export const DEFAULT_VARIANT_ID = INTRO_VARIANTS[0].id;

/** localStorage key of the visitor's chosen intro style. */
export const VARIANT_STORAGE_KEY = "hero-intro-style";

/** Line shown under the name at the top of slide 1. Empty = none. */
export const INTRO_ROLE = "AI Data Multi-Cloud Solutions Architect and Engineer";

/** The version with this id, or the default one for a missing or unknown id. */
export function resolveVariant(id: string | null | undefined): IntroVariant {
  return INTRO_VARIANTS.find((v) => v.id === id) || INTRO_VARIANTS[0];
}

/** Default caption of slide 2 when the banner image has none. */
export const BANNER_CAPTION = "Bridging Business Goals, Human Workflows and Technology — Together.";

/** Timings (milliseconds). */
export const INTRO_TIMING = {
  /** Fade-in of a section once the scroll reaches it. */
  fadeMs: 500,
  /** How long a section stays after its text is fully visible. */
  holdMs: 5000,
  /** After the visitor scrolls the text by hand, automatic scrolling resumes this long after. */
  resumeAfterMs: 6000,
  /** Cross-fade between slides. */
  slideFadeMs: 700,
};

/**
 * The next automatic step from section `index` of a sequence of `count` sections: wait `delay`,
 * then scroll to section `next`. Null at the last section (the invitation): scrolling stops.
 */
export function introStep(index: number, count: number): { delay: number; next: number } | null {
  if (index >= count - 1) return null;
  return { delay: INTRO_TIMING.fadeMs + INTRO_TIMING.holdMs, next: index + 1 };
}
