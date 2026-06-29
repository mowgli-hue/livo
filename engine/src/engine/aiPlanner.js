// The AI planning engine.
//
// generatePlan() gathers candidates from the providers, then either:
//   (a) asks an LLM to assemble + explain a coherent itinerary (when ANTHROPIC_API_KEY is set), or
//   (b) falls back to a deterministic rule-based assembler (always available).
//
// Either way it returns the SAME shape, so the API and frontend are stable.

import { maps, stays, events } from '../providers/index.js';

const BUDGET_CAP = { low: 75, med: 250, high: 600 };
const priceToCost = { 0: 0, 1: 12, 2: 30, 3: 60 };

export async function generatePlan(req) {
  const { near = 'Surrey, BC', mood = 'any', who = 'couple', budget = 'low', overnight = false } = req;
  const cap = BUDGET_CAP[budget] ?? 75;

  // 1) Gather candidates in parallel from providers
  const [trails, foods, recs, easy, stayOpts] = await Promise.all([
    maps.searchPlaces({ type: 'trail', vibe: mood }),
    maps.searchPlaces({ type: 'food', vibe: mood }),
    maps.searchPlaces({ type: 'rec', vibe: mood }),
    maps.searchPlaces({ type: 'easy', vibe: mood }),
    overnight ? stays.search({ guests: 2, maxNightly: cap * 2 }) : Promise.resolve([]),
  ]);

  const candidates = { trails, foods, recs, easy, stays: stayOpts };

  // 2) Assemble
  if (process.env.ANTHROPIC_API_KEY) {
    try { return await assembleWithLLM(req, candidates, cap); }
    catch (e) { console.warn('[aiPlanner] LLM failed, falling back:', e.message); }
  }
  return assembleRuleBased(req, candidates, cap);
}

function slot(time, place) {
  if (!place) return null;
  return { time, name: place.name, area: place.area, why: place.category, cost: priceToCost[place.priceLevel] ?? 0 };
}

function assembleRuleBased({ mood = 'any', overnight }, c, cap) {
  const slots = [];
  if (mood === 'easy') {
    slots.push(slot('Morning', c.easy[0]), slot('Lunch', c.foods[0]), slot('Afternoon', c.easy[1] || c.trails[0]));
  } else if (mood === 'cozy') {
    slots.push(slot('Late morning', c.foods[0]), slot('Afternoon', c.trails[0] || c.easy[0]));
  } else if (overnight && c.stays[0]) {
    slots.push(slot('Check in', { name: c.stays[0].name, area: c.stays[0].area, category: 'stay', priceLevel: 0 }),
      slot('Afternoon', c.trails[0]), slot('Dinner', c.foods[0]));
  } else {
    slots.push(slot('Morning', c.trails[0]), slot('Lunch', c.foods[0]), slot('Afternoon', c.trails[1] || c.recs[0]));
  }
  const clean = slots.filter(Boolean);
  const base = clean.reduce((s, x) => s + (x.cost || 0), 0);
  const est = base + (overnight ? (c.stays[0]?.nightly || 0) + 25 : 15);
  return {
    engine: 'rule-based',
    title: `${mood} ${overnight ? 'overnight' : 'day'} plan`,
    slots: clean,
    estPerPerson: est,
    withinBudget: est <= cap,
    note: overnight ? 'Book the stay 3–4 weeks ahead to avoid last-minute scarcity.' : null,
  };
}

async function assembleWithLLM(req, candidates, cap) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: process.env.AI_MODEL || 'claude-opus-4-8',
    max_tokens: 900,
    system: 'You are LocalEscape, a local-getaway planner. Choose ONLY from the provided candidates. ' +
      'Return STRICT JSON: {title, slots:[{time,name,area,why,cost}], estPerPerson, withinBudget, note}. ' +
      `Keep estPerPerson within the budget cap of $${cap}/person.`,
    messages: [{ role: 'user', content: JSON.stringify({ request: req, candidates }) }],
  });
  const text = msg.content.map(b => b.text || '').join('');
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  return { engine: 'llm', ...json };
}

// Trip budgeting (international/domestic) — pure math over a destination record.
export function budgetTrip(dest, nights, tier = 'budget') {
  const hotel = (tier === 'budget' ? dest.hb : dest.hm) * nights;
  const flight = dest.flight;
  const daily = dest.daily * nights;
  return { ...dest, nights, tier, flight, hotel, daily, totalPerPerson: flight + hotel + daily };
}
