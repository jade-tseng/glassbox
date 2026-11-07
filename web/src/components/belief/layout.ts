// Stable layout for the belief graph, computed once from the full run so nodes never jump as they arrive.
// The biggest topic sits in the middle lane as a grid; other topics stack in left/right lanes.

import type { GraphState, Hypothesis } from "@/lib/belief/engine";

export const CARD_W = 150;
export const CARD_H = 56;
export const GAP = 8;
export const HULL_PAD = 12;
export const HULL_HEAD = 26;
export const LANE_GAP = 18;

export const TOPIC_COLORS = ["#3A4BFF", "#22B8CF", "#8B7CF6", "#A9C7FF", "#7C8B98"];
export const TOPIC_TEXT = ["#A9B4FF", "#7FD6E4", "#C2B9FB", "#A9C7FF", "#A7B3BD"];

export const STATUS = {
  supports: "#7FE0C2",
  refutes: "#FF6B5A",
  weak: "#8E969B",
  invalid: "#FF6B5A",
  amber: "#FFB224",
  live: "#B8F23A",
};

export type Hull = { topic: string; x: number; y: number; w: number; h: number; color: string; text: string; index: number };
export type Layout = {
  width: number;
  height: number;
  hulls: Hull[];
  cards: Record<string, { x: number; y: number }>;
};

function hullSize(n: number, cols: number) {
  const rows = Math.ceil(n / cols);
  return {
    w: cols * CARD_W + (cols - 1) * GAP + HULL_PAD * 2,
    h: HULL_HEAD + rows * CARD_H + (rows - 1) * GAP + HULL_PAD,
  };
}

export function topicColor(topics: string[], topic: string) {
  const i = Math.max(0, topics.indexOf(topic));
  return { color: TOPIC_COLORS[i % TOPIC_COLORS.length], text: TOPIC_TEXT[i % TOPIC_TEXT.length], dashed: i >= TOPIC_COLORS.length };
}

export function computeLayout(final: GraphState): Layout {
  const byTopic = new Map<string, Hypothesis[]>();
  for (const id of final.order) {
    const h = final.hypotheses[id];
    byTopic.set(h.topic, [...(byTopic.get(h.topic) ?? []), h]);
  }
  const topics = final.topics;
  const big = [...topics].sort((a, b) => (byTopic.get(b)!.length - byTopic.get(a)!.length))[0];
  const bigN = byTopic.get(big)!.length;
  const bigCols = Math.min(3, Math.ceil(bigN / 5));
  const bigSize = hullSize(bigN, bigCols);

  const sideW = hullSize(1, 1).w;
  const lanes = { left: 0, right: 0 };
  const hulls: Hull[] = [];
  const cards: Layout["cards"] = {};

  const place = (topic: string, x: number, y: number, cols: number) => {
    const hs = byTopic.get(topic)!;
    const size = hullSize(hs.length, cols);
    const { color, text } = topicColor(topics, topic);
    hulls.push({ topic, x, y, w: size.w, h: size.h, color, text, index: topics.indexOf(topic) });
    hs.forEach((h, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      cards[h.id] = { x: x + HULL_PAD + c * (CARD_W + GAP), y: y + HULL_HEAD + r * (CARD_H + GAP) };
    });
    return size.h;
  };

  const midX = sideW + LANE_GAP;
  const rightX = midX + bigSize.w + LANE_GAP;
  place(big, midX, 0, bigCols);
  for (const topic of topics) {
    if (topic === big) continue;
    const lane = lanes.left <= lanes.right ? "left" : "right";
    const x = lane === "left" ? 0 : rightX;
    const h = place(topic, x, lanes[lane], 1);
    lanes[lane] += h + LANE_GAP;
  }
  return {
    width: rightX + sideW,
    height: Math.max(bigSize.h, lanes.left - LANE_GAP, lanes.right - LANE_GAP),
    hulls,
    cards,
  };
}

/** Short label for a card: the code region the hypothesis touches. */
export function shortLabel(h: Hypothesis) {
  const s = (h.symbol || h.claim).replace(/^SETTINGS\s+/, "SETTINGS ").trim();
  return s.length > 20 ? `${s.slice(0, 19)}…` : s;
}
