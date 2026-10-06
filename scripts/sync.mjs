// Dagelijkse sync: Scryfall (kaartdata) + Cardmarket price guide (prijzen) -> data/cards.json
// Gebruik: node scripts/sync.mjs   (Node 20+)
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import { writeFile, mkdir } from 'node:fs/promises';

const UA = { 'User-Agent': 'MTGPriceApp/0.1', Accept: 'application/json' };
const PRICE_GUIDE = 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_1.json';

const j = async (url) => { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(`${url} -> ${r.status}`); return r.json(); };

const bulk = await j('https://api.scryfall.com/bulk-data/default-cards');
console.log('Scryfall bulk:', bulk.updated_at);

// 1. Prijzen van Cardmarket
const pg = await j(PRICE_GUIDE);
const prices = new Map(pg.priceGuides.map((p) => [p.idProduct, p]));
console.log('Cardmarket prijzen:', prices.size, '| peildatum', pg.createdAt);

// 2. Kaarten van Scryfall (streaming jsonl.gz, alleen Engelse, niet-digitale kaarten met Cardmarket-id)
const res = await fetch(bulk.jsonl_download_uri, { headers: UA });
if (!res.ok) throw new Error('Scryfall download mislukt: ' + res.status);
const rl = createInterface({ input: Readable.fromWeb(res.body).pipe(createGunzip()), crlfDelay: Infinity });

const imgOf = (c) => (c.image_uris || c.card_faces?.[0]?.image_uris || {});
const cards = [];
for await (const line of rl) {
  if (!line.trim()) continue;
  const c = JSON.parse(line);
  if (c.digital || !c.cardmarket_id || c.lang !== 'en') continue;
  // geen verzamelobjecten die je niet bedoelt met "elke versie": gouden rand (WC-decks), memorabilia (30A), funny, tokens
  if (c.border_color === 'gold' || ['memorabilia', 'funny', 'token', 'minigame', 'vanguard'].includes(c.set_type)) continue;
  const p = prices.get(c.cardmarket_id);
  const img = imgOf(c);
  const o = {
    id: c.cardmarket_id,
    n: c.name,
    s: c.set.toUpperCase(),
    sn: c.set_name,
    cn: c.collector_number,
    d: c.released_at,
    r: c.rarity[0],                       // c/u/r/m/s/b
    f: c.finishes?.includes('nonfoil') ? 0 : 1, // 1 = alleen foil
    i: (img.small || '').replace('https://cards.scryfall.io/', ''),
    t: p?.trend ?? null,                  // Price Trend (EUR)
    a7: p?.avg7 ?? null,
    a30: p?.avg30 ?? null,
    tf: p?.['trend-foil'] || null,
  };
  for (const k of Object.keys(o)) if (o[k] === null || o[k] === '') delete o[k];
  cards.push(o);
}
console.log('Kaarten in app:', cards.length);

await mkdir('data', { recursive: true });
await writeFile('data/cards.json', JSON.stringify({ updated: pg.createdAt, synced: new Date().toISOString(), cards }));

console.log('Klaar.');
