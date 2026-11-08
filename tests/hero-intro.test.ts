import { describe, expect, it } from "vitest";
import { answerText, INTRO_PAIRS, INTRO_START, INTRO_TIMING, introStep, type IntroState } from "@/lib/hero-intro";

/** Run the automatic sequence from the start and record what happens. */
function play() {
  let s: IntroState = INTRO_START;
  const events: string[] = [];
  let lastDelay = 0;
  for (let guard = 0; guard < 100000; guard++) {
    const step = introStep(s);
    if (!step) break;
    const { next, delay } = step;
    const pair = INTRO_PAIRS[s.pair];
    if (next.slide === 1) events.push(`slide2 after ${delay}`);
    else if (next.pair !== s.pair) events.push(`next pair ${next.pair}`);
    else if (next.q === pair.question.length && s.q < next.q) events.push(`question ${s.pair} done`);
    else if (next.a === answerText(pair).length && s.a < next.a) {
      expect(next.q).toBe(pair.question.length); // the answer only ever types after the full question
      events.push(`answer ${s.pair} done`);
    }
    lastDelay = delay;
    s = next;
  }
  return { events, end: s, lastDelay };
}

describe("hero intro sequence", () => {
  it("has the seven pairs in the required order", () => {
    expect(INTRO_PAIRS).toHaveLength(7);
    expect(INTRO_PAIRS[0].question).toMatch(/^Do you need to improve your workflows/);
    expect(INTRO_PAIRS[6].question).toBe("Do you need all the above?");
    expect(answerText(INTRO_PAIRS[6])).toMatch(/Let’s talk\. I’m here\.$/);
    expect(INTRO_PAIRS[6].answer.at(-1)).toEqual({ text: "Let’s talk. I’m here.", href: "#contact" });
  });

  it("plays every question then its answer, in order, and only then moves to slide 2", () => {
    const { events, end, lastDelay } = play();
    const expected: string[] = [];
    INTRO_PAIRS.forEach((_, i) => {
      expected.push(`question ${i} done`, `answer ${i} done`);
      if (i < INTRO_PAIRS.length - 1) expected.push(`next pair ${i + 1}`);
    });
    expected.push(`slide2 after ${INTRO_TIMING.finalHoldMs}`);
    expect(events).toEqual(expected);
    // The final frame is complete when slide 2 comes, after a 6-second hold.
    expect(end).toEqual({ slide: 1, pair: 6, q: INTRO_PAIRS[6].question.length, a: answerText(INTRO_PAIRS[6]).length });
    expect(lastDelay).toBe(6000);
  });

  it("stays on slide 2 (no timer) until the visitor replays", () => {
    expect(introStep({ slide: 1, pair: 6, q: 0, a: 0 })).toBeNull();
  });
});
