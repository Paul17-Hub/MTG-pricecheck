// Decks uit Archidekt (openbare en "unlisted" decks) + combo's via Commander Spellbook.
// Draait alleen op aanvraag (GitHub > Actions > "Decks ophalen uit Archidekt" > Run workflow).
// Configuratie: decks.config.json  ->  { "username": "jouwnaam", "deckIds": [123456, 234567] }
// Uitvoer: decks-data.json in de hoofdmap (wordt in de repository bewaard en bij elke publicatie meegenomen).
import { readFile, writeFile } from 'node:fs/promises';

const OUT = process.env.DECKS_OUT || 'decks-data.json';

const UA = { 'User-Agent': 'MTGPriceApp/0.1 (personal deck tool)', Accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FORMATS = { 1: 'Standard', 2: 'Modern', 3: 'Commander', 4: 'Legacy', 5: 'Vintage', 6: 'Pauper', 7: 'Custom', 8: 'Frontier', 9: 'Future Standard', 10: 'Penny Dreadful', 11: '1v1 Commander', 12: 'Dual Commander', 13: 'Brawl' };
const CI = { White: 'W', Blue: 'U', Black: 'B', Red: 'R', Green: 'G' };
const TYPE_L = { Creature: 'C', Land: 'L', Artifact: 'A', Enchantment: 'E', Instant: 'I', Sorcery: 'S', Planeswalker: 'P', Battle: 'B', Kindred: 'K', Tribal: 'K' };

async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.status === 429 || r.status >= 500) { await sleep(1500 * (i + 1)); continue; }
    if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
    return r.json();
  }
  throw new Error(`${url}: te veel pogingen`);
}
const plain = (desc) => {
  try { const ops = JSON.parse(desc).ops || []; return ops.map((o) => (typeof o.insert === 'string' ? o.insert : '')).join('').trim().slice(0, 600); } catch { return String(desc || '').slice(0, 600); }
};

function compact(d) {
  const off = new Set((d.categories || []).filter((c) => c.includedInDeck === false).map((c) => c.name));
  const cards = [];
  for (const c of d.cards || []) {
    if (c.deletedAt) continue;
    const o = c.card.oracleCard, cats = c.categories || [];
    const isCmd = cats.includes('Commander');
    const maybe = cats.some((x) => off.has(x)), side = cats.includes('Sideboard');
    const e = {
      n: o.name, q: c.quantity,
      c: cats.filter((x) => x !== 'Commander' && !off.has(x) && x !== 'Sideboard'),
      mv: Math.round(o.cmc || 0),
      ci: (o.colorIdentity || []).map((x) => CI[x] || '').join(''),
      ty: [...new Set([...(o.types || []).map((t) => TYPE_L[t] || ''), ...((o.superTypes || []).includes('Legendary') ? ['G'] : [])])].join(''),
      s: String(c.card.edition?.editioncode || '').toUpperCase(), cn: String(c.card.collectorNumber || ''),
    };
    if (!e.c.length) delete e.c; if (!e.ci) delete e.ci; if (!e.ty) delete e.ty;
    if (o.gameChanger) e.gc = 1; if (o.extraTurns) e.et = 1; if (o.tutor) e.tu = 1; if (o.massLandDenial) e.ml = 1;
    if (isCmd) e.cmd = 1;
    if (maybe) e.bd = 'M'; else if (side) e.bd = 'S';
    cards.push(e);
  }
  return {
    id: d.id, name: d.name, fmt: FORMATS[d.deckFormat] || `Formaat ${d.deckFormat}`, bracket: d.edhBracket ?? null,
    updated: d.updatedAt, owner: d.owner?.username || null, url: `https://archidekt.com/decks/${d.id}`, desc: plain(d.description), cards,
  };
}

async function combosFor(deck) {
  const main = deck.cards.filter((c) => !c.bd), cmd = main.filter((c) => c.cmd);
  const front = (n) => n.split(' // ')[0];
  const body = { main: main.filter((c) => !c.cmd).map((c) => ({ card: front(c.n), quantity: 1 })), commanders: cmd.map((c) => ({ card: front(c.n), quantity: 1 })) };
  const r = await fetch('https://backend.commanderspellbook.com/find-my-combos', { method: 'POST', headers: { ...UA, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('Spellbook HTTP ' + r.status);
  const res = (await r.json()).results || {};
  const mv = new Map(main.map((c) => [front(c.n), c.mv]));
  return (res.included || []).map((c) => {
    const cards = c.uses.map((u) => u.card.name);
    return { cards, makes: (c.produces || []).slice(0, 3).map((p) => p.feature.name), mana: cards.reduce((s, n) => s + (mv.get(n) || 0), 0), tag: c.bracketTag || null };
  }).sort((a, b) => a.cards.length - b.cards.length || a.mana - b.mana);
}

export async function syncDecks(log = console.log) {
  let cfg; try { cfg = JSON.parse(await readFile('decks.config.json', 'utf8')); } catch { log('Geen decks.config.json: decks worden overgeslagen.'); return; }
  const ids = new Set((cfg.deckIds || []).map(Number).filter(Boolean));
  if (cfg.username) {
    let url = `https://archidekt.com/api/decks/v3/?ownerUsername=${encodeURIComponent(cfg.username)}&pageSize=50&orderBy=-updatedAt`;
    for (let page = 0; url && page < 5; page++) { const d = await getJson(url); for (const r of d.results || []) ids.add(r.id); url = d.next; await sleep(400); }
  }
  log('Decks om op te halen:', ids.size);
  const decks = [];
  for (const id of ids) {
    try {
      const deck = compact(await getJson(`https://archidekt.com/api/decks/${id}/`));
      if (deck.cards.length) { try { deck.combos = await combosFor(deck); } catch (e) { log(`  combo's voor "${deck.name}" niet beschikbaar: ${e.message}`); } decks.push(deck); }
    } catch (e) { log(`  deck ${id} overgeslagen: ${e.message}`); }
    await sleep(500);
  }
  decks.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  await writeFile(OUT, JSON.stringify({ synced: new Date().toISOString(), decks }));
  log('Decks klaar:', decks.length);
}
