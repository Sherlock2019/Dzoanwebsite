// Content of the home hero carousel (version 4). Edit freely.
//
// Two slides, navigated by hand (arrows, dots, ← →); nothing moves by itself.
//   Slide 1, in the version the visitor picks with the selector at its top:
//     - "Questions & Answers": every question with its answer in a grid, then the closing;
//     - "If you need...": the whole poem in columns.
//     Both end with "Then we really need to talk. →", which leads to slide 2.
//   Slide 2: the handshake banner, with "I'm here. Just book a moment in my calendar— I'll be
//   listening." and the postscript in the bar under it.
//
// "\n" is an intentional line break. The poem keeps its line breaks; Q&A text flows naturally in
// its grid cells.

export interface IntroQA {
  /** Short topic, shown as a small label above the question. */
  topic: string;
  question: string;
  answer: string;
}

/** The invitation in the bar under slide 2; `link` is the part that links to the calendar. */
export interface Invitation {
  before: string;
  link: string;
  after: string;
  /** Optional last words, shown in bold after `after`. */
  end?: string;
  postscript: string;
}

export interface Stanza {
  text: string;
  /** Don't emphasize the first line (it continues the previous stanza). */
  plainLead?: boolean;
}

/** Versions of slide 1, in selector order; the first is the default. Ids are saved: don't rename. */
export const INTRO_VARIANTS = [
  { id: "qa", label: "Questions & Answers" },
  { id: "poem", label: "If you need..." },
] as const;
export type VariantId = (typeof INTRO_VARIANTS)[number]["id"];

/** localStorage key of the visitor's chosen version. */
export const VARIANT_STORAGE_KEY = "hero-intro-style";

/** The version with this id, or the default for a missing or unknown id. */
export function resolveVariant(id: string | null | undefined): VariantId {
  return INTRO_VARIANTS.find((v) => v.id === id)?.id ?? INTRO_VARIANTS[0].id;
}

/** Names of the two slides (accessible labels). */
export const SLIDE_NAMES = ["Introduction", "Business & Technology"] as const;

/** Line shown under the name at the top of slide 1. Empty = none. */
export const INTRO_ROLE = "AI Data Multi-Cloud Solutions Architect and Engineer";

/** Last line of slide 1 (both versions); it leads to slide 2. */
export const TALK = "Then we really need to talk.";

export const INVITATION: Invitation = {
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

// ---------------------------------------------------------------------------------------------
// Slide 1, "Questions & Answers" version

export const QA_ITEMS: IntroQA[] = [
  {
    topic: "CEO",
    question: "As a CEO, do you need to turn\nbusiness pains into business wins?",
    answer: "Let’s talk about what holds you back—\nand what we can build next.",
  },
  {
    topic: "CFO",
    question: "As a CFO, do you need more value from your services,\nwith a lower total cost of ownership?",
    answer: "Let’s make every investment count—\nin money saved and value gained.",
  },
  {
    topic: "CTO",
    question: "As a CTO, do you need your team to move faster,\nwork smarter, and feel happier?",
    answer: "Let’s clear the friction from their day\nand give good ideas room to grow.",
  },
  {
    topic: "AI workflows",
    question: "Do you need AI to improve your workflows?",
    answer: "I build tools that lighten the load\nand help your people do their best work.",
  },
  {
    topic: "Data",
    question: "Do you need more value from your data?",
    answer: "I connect the scattered pieces\nso clearer answers can guide your next move.",
  },
  {
    topic: "AI reliability · MLOps",
    question: "Do you need faster, more reliable, cost-effective AI?",
    answer: "I trace, evaluate, and tune—\nturning promising demos into dependable services.",
  },
  {
    topic: "Cloud",
    question: "Do you need a cloud ready for what comes next?",
    answer: "I design, migrate, and optimize—\nwith performance, privacy, and sovereignty in mind.",
  },
  {
    topic: "DevOps · SRE",
    question: "Do you need smoother delivery and reliable operations?",
    answer: "I bring DevOps to the release\nand SRE to the running.",
  },
  {
    topic: "Modernization",
    question: "Do you need to modernize applications that hold you back?",
    answer: "I help them grow beyond the monolith—\neasier to maintain, ready to scale.",
  },
  {
    topic: "Customer understanding",
    question: "Do you need someone who hears your customers’ pain\nand turns understanding into solutions?",
    answer: "I listen first. Build with purpose.\nAnd stay to see the outcome.",
  },
];

/** The closing of the Q&A version, under the grid. */
export const QA_CLOSING = {
  headline: "And if you need all the above in one person?",
  subhead: "And more than that— a servant to your team, your company, and your customers.",
  skills: "AI & Data · Cloud Architecture · DevOps & SRE.",
  body: "One hands-on engineer— saving headcount, budget, and time.",
};

// ---------------------------------------------------------------------------------------------
// Slide 1, "If you need..." version (the poem)

export const POEM = {
  title: "If — A Builder’s Promise",
  note: "Inspired by Rudyard Kipling’s poem “If—”",
  stanzas: [
    {
      text: "If, as a CEO, you see what could be,\nYet daily troubles keep that goal from view,\nLet’s name the pains and find the possibility—\nThen build the next step, and see it through.",
    },
    {
      text: "If, as a CFO, you weigh each cost,\nAnd ask what lasting value it will bring,\nLet’s find where time and resources are lost,\nAnd make each investment earn its keep.",
    },
    {
      text: "If, as a CTO, you lead a team\nWhose days leave little room to think or grow,\nLet’s clear the friction, give good ideas a chance,\nAnd build a pace that lets your people thrive.",
    },
    {
      text: "If work repeats until it wears people down,\nAnd AI could help them carry less,\nI’ll build the tools that lighten daily burdens,\nAnd judge their worth by whom they help progress.",
    },
    {
      text: "If scattered data hides the answers that you seek,\nAnd every source presents a different view,\nI’ll bring the pieces into clearer order,\nSo evidence can guide what next you do.",
    },
    {
      text: "If AI shines in demos, yet falters in the day,\nOr costs too much for answers slow to come,\nI’ll trace, evaluate, and tune its workings,\nUntil its promise earns your trust through use.",
    },
    {
      text: "If your cloud must bear tomorrow’s weight,\nWhile keeping private what belongs to you,\nI’ll design, migrate, and strengthen its foundations,\nWith sovereignty and performance in view.",
    },
    {
      text: "If every release brings worry to your team,\nAnd every outage steals another night,\nI’ll automate the path from code to service,\nAnd help keep systems steady, day and night.",
    },
    {
      text: "If a monolith confines what you can change,\nAnd growth makes every small revision slow,\nI’ll help reshape it, one sound step at a time,\nInto services you can maintain and grow.",
    },
    {
      text: "If customers need someone who will listen,\nBefore a tool or answer is prescribed,\nI’ll hear their pain, build with them toward a purpose,\nAnd stay to see the outcome come alive.",
    },
    {
      text: "And if you seek all this in one person—\nAI & Data · Cloud Architecture · DevOps & SRE—\nOne hands-on engineer to save you\nHeadcount, budget, time, and needless handoffs;",
    },
    {
      text: "And more than that, someone prepared to be\nA servant to your team,\nYour company,\nAnd your customers—\nWorking toward an Earth of abundance\nAnd prosperity for all of us.",
      plainLead: true,
    },
  ] as Stanza[],
  invitation: { ...INVITATION, after: "—\n", end: "I’ll be listening." } as Invitation,
};

// ---------------------------------------------------------------------------------------------
// Slide 2 — Business & Technology

/** Default caption of slide 2 when the banner image has none. */
export const BANNER_CAPTION = "Bridging Business Goals, Human Workflows and Technology — Together.";
