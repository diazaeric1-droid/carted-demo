#!/usr/bin/env node
// bake-places.mjs v2 — pre-bake the world's 50 best food cities from Google Places API (New)
//
// Usage:
//   GOOGLE_PLACES_KEY=xxx node bake-places.mjs            # bake all 50 cities
//   GOOGLE_PLACES_KEY=xxx node bake-places.mjs nyc hou    # bake a subset
//   node bake-places.mjs --force nyc                      # re-bake even if JSON exists
//   (key can also live in ./.env as GOOGLE_PLACES_KEY=xxx — .env is gitignored)
//
// Per city: 2 Nearby Search calls (restaurants + cafés/bars/bakeries), merged,
// top 20 by popularity. Per place: rating, rating count, price level, price range,
// editorial summary, 3 review snippets, 1 photo (downloaded, 400px) + attribution.
//
// Cost at full run (50 cities): ~100 searches ≈ $4 + ~1000 photos ≈ $7 → ~$11,
// well inside Google's $200/mo free credit.
//
// Output: places/<cityId>.json + places/photos/<placeId>.jpg + places/index.json
// NOTE: Google ToS caps caching of Places content at 30 days — re-run monthly
// while this is a public demo, or swap photos for an owned pack before scale.

import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

/* ---- key: env var or .env file ---- */
async function loadKey() {
  if (process.env.GOOGLE_PLACES_KEY) return process.env.GOOGLE_PLACES_KEY.trim();
  try {
    const env = await readFile(new URL(".env", import.meta.url), "utf8");
    const m = env.match(/^\s*GOOGLE_PLACES_KEY\s*=\s*["']?([^"'\n#]+)/m);
    if (m) return m[1].trim();
  } catch {}
  return null;
}

/* ---- the 50 food capitals (kept in sync with index.html CITIES) ---- */
const CITIES = [
  { id:"nyc", name:"New York",     flag:"🗽", cur:{sym:"$",dec:2},   pf:1,    lat:40.7280,  lng:-73.9990,  radius:2200 },
  { id:"la",  name:"Los Angeles",  flag:"🌴", cur:{sym:"$",dec:2},   pf:1,    lat:34.0760,  lng:-118.3700, radius:3000 },
  { id:"ldn", name:"London",       flag:"🇬🇧", cur:{sym:"£",dec:2},   pf:0.82, lat:51.5145,  lng:-0.1357,   radius:2200 },
  { id:"tyo", name:"Tokyo",        flag:"🗼", cur:{sym:"¥",dec:0},   pf:150,  lat:35.6620,  lng:139.7000,  radius:2200 },
  { id:"sel", name:"Seoul",        flag:"🇰🇷", cur:{sym:"₩",dec:0},   pf:1350, lat:37.5512,  lng:126.9882,  radius:2500 },
  { id:"mex", name:"Mexico City",  flag:"🇲🇽", cur:{sym:"MX$",dec:0}, pf:7,    lat:19.4150,  lng:-99.1700,  radius:2500 },
  { id:"par", name:"Paris",        flag:"🇫🇷", cur:{sym:"€",dec:2},   pf:0.92, lat:48.8566,  lng:2.3522,    radius:2200 },
  { id:"ber", name:"Berlin",       flag:"🇩🇪", cur:{sym:"€",dec:2},   pf:0.92, lat:52.5200,  lng:13.4050,   radius:2400 },
  { id:"bkk", name:"Bangkok",      flag:"🇹🇭", cur:{sym:"฿",dec:0},   pf:35,   lat:13.7563,  lng:100.5018,  radius:2600 },
  { id:"syd", name:"Sydney",       flag:"🇦🇺", cur:{sym:"A$",dec:2},  pf:1.5,  lat:-33.8688, lng:151.2093,  radius:2600 },
  { id:"tor", name:"Toronto",      flag:"🇨🇦", cur:{sym:"C$",dec:2},  pf:1.35, lat:43.6532,  lng:-79.3832,  radius:2600 },
  { id:"chi", name:"Chicago",      flag:"🌆", cur:{sym:"$",dec:2},   pf:1,    lat:41.8781,  lng:-87.6298,  radius:2600 },
  { id:"sin", name:"Singapore",    flag:"🇸🇬", cur:{sym:"S$",dec:2},  pf:1.35, lat:1.3000,   lng:103.8400,  radius:2600 },
  { id:"hou", name:"Houston",      flag:"🚀", cur:{sym:"$",dec:2},   pf:1,    lat:29.7426,  lng:-95.3905,  radius:3000 },
  { id:"sfo", name:"San Francisco",flag:"🌁", cur:{sym:"$",dec:2},   pf:1.15, lat:37.7599,  lng:-122.4148, radius:2400 },
  { id:"nol", name:"New Orleans",  flag:"🎷", cur:{sym:"$",dec:2},   pf:0.95, lat:29.9584,  lng:-90.0644,  radius:2200 },
  { id:"oax", name:"Oaxaca",       flag:"🌶️", cur:{sym:"MX$",dec:0}, pf:6,    lat:17.0606,  lng:-96.7253,  radius:2000 },
  { id:"lim", name:"Lima",         flag:"🇵🇪", cur:{sym:"S/",dec:0},  pf:3,    lat:-12.1211, lng:-77.0297,  radius:2400 },
  { id:"bue", name:"Buenos Aires", flag:"🇦🇷", cur:{sym:"AR$",dec:0}, pf:900,  lat:-34.5875, lng:-58.4260,  radius:2600 },
  { id:"sao", name:"São Paulo",    flag:"🇧🇷", cur:{sym:"R$",dec:0},  pf:4,    lat:-23.5614, lng:-46.6823,  radius:2600 },
  { id:"rom", name:"Rome",         flag:"🏛️", cur:{sym:"€",dec:2},   pf:0.92, lat:41.8950,  lng:12.4740,   radius:2200 },
  { id:"nap", name:"Naples",       flag:"🍕", cur:{sym:"€",dec:2},   pf:0.92, lat:40.8484,  lng:14.2528,   radius:2000 },
  { id:"bol", name:"Bologna",      flag:"🍝", cur:{sym:"€",dec:2},   pf:0.92, lat:44.4938,  lng:11.3426,   radius:2000 },
  { id:"bcn", name:"Barcelona",    flag:"🇪🇸", cur:{sym:"€",dec:2},   pf:0.92, lat:41.3851,  lng:2.1734,    radius:2200 },
  { id:"mad", name:"Madrid",       flag:"🐂", cur:{sym:"€",dec:2},   pf:0.92, lat:40.4200,  lng:-3.7038,   radius:2200 },
  { id:"sse", name:"San Sebastián",flag:"🍢", cur:{sym:"€",dec:2},   pf:0.92, lat:43.3224,  lng:-1.9846,   radius:1800 },
  { id:"lis", name:"Lisbon",       flag:"🇵🇹", cur:{sym:"€",dec:2},   pf:0.92, lat:38.7100,  lng:-9.1400,   radius:2200 },
  { id:"cph", name:"Copenhagen",   flag:"🇩🇰", cur:{sym:"kr",dec:0},  pf:6.5,  lat:55.6800,  lng:12.5800,   radius:2200 },
  { id:"ams", name:"Amsterdam",    flag:"🇳🇱", cur:{sym:"€",dec:2},   pf:0.92, lat:52.3650,  lng:4.8950,    radius:2200 },
  { id:"vie", name:"Vienna",       flag:"🎻", cur:{sym:"€",dec:2},   pf:0.92, lat:48.2082,  lng:16.3738,   radius:2200 },
  { id:"ath", name:"Athens",       flag:"🏺", cur:{sym:"€",dec:2},   pf:0.92, lat:37.9779,  lng:23.7250,   radius:2200 },
  { id:"ist", name:"Istanbul",     flag:"🇹🇷", cur:{sym:"₺",dec:0},   pf:20,   lat:41.0322,  lng:28.9770,   radius:2400 },
  { id:"tlv", name:"Tel Aviv",     flag:"🇮🇱", cur:{sym:"₪",dec:0},   pf:3.7,  lat:32.0680,  lng:34.7700,   radius:2200 },
  { id:"bey", name:"Beirut",       flag:"🇱🇧", cur:{sym:"$",dec:2},   pf:1,    lat:33.8959,  lng:35.5180,   radius:2000 },
  { id:"dxb", name:"Dubai",        flag:"🏜️", cur:{sym:"AED",dec:0}, pf:3.7,  lat:25.1972,  lng:55.2744,   radius:3000 },
  { id:"cai", name:"Cairo",        flag:"🐫", cur:{sym:"E£",dec:0},  pf:20,   lat:30.0609,  lng:31.2197,   radius:2400 },
  { id:"rak", name:"Marrakech",    flag:"🇲🇦", cur:{sym:"DH",dec:0},  pf:6,    lat:31.6258,  lng:-7.9891,   radius:2200 },
  { id:"cpt", name:"Cape Town",    flag:"🇿🇦", cur:{sym:"R",dec:0},   pf:14,   lat:-33.9249, lng:18.4241,   radius:2600 },
  { id:"osa", name:"Osaka",        flag:"🐙", cur:{sym:"¥",dec:0},   pf:150,  lat:34.6687,  lng:135.5013,  radius:2200 },
  { id:"kyo", name:"Kyoto",        flag:"⛩️", cur:{sym:"¥",dec:0},   pf:150,  lat:35.0037,  lng:135.7681,  radius:2200 },
  { id:"pus", name:"Busan",        flag:"🦀", cur:{sym:"₩",dec:0},   pf:1350, lat:35.1578,  lng:129.0604,  radius:2400 },
  { id:"hkg", name:"Hong Kong",    flag:"🥟", cur:{sym:"HK$",dec:0}, pf:7.8,  lat:22.2819,  lng:114.1556,  radius:2200 },
  { id:"tpe", name:"Taipei",       flag:"🧋", cur:{sym:"NT$",dec:0}, pf:31,   lat:25.0420,  lng:121.5070,  radius:2200 },
  { id:"sgn", name:"Saigon",       flag:"🛵", cur:{sym:"₫",dec:0},   pf:6000, lat:10.7769,  lng:106.7009,  radius:2400 },
  { id:"han", name:"Hanoi",        flag:"🍜", cur:{sym:"₫",dec:0},   pf:6000, lat:21.0338,  lng:105.8500,  radius:2200 },
  { id:"pen", name:"Penang",       flag:"🦐", cur:{sym:"RM",dec:0},  pf:2,    lat:5.4164,   lng:100.3327,  radius:2200 },
  { id:"kul", name:"Kuala Lumpur", flag:"🇲🇾", cur:{sym:"RM",dec:0},  pf:2,    lat:3.1466,   lng:101.7107,  radius:2400 },
  { id:"bom", name:"Mumbai",       flag:"🇮🇳", cur:{sym:"₹",dec:0},   pf:30,   lat:19.0596,  lng:72.8295,   radius:2400 },
  { id:"del", name:"Delhi",        flag:"🛺", cur:{sym:"₹",dec:0},   pf:30,   lat:28.6315,  lng:77.2167,   radius:2400 },
  { id:"mel", name:"Melbourne",    flag:"☕", cur:{sym:"A$",dec:2},  pf:1.5,  lat:-37.8136, lng:144.9631,  radius:2400 },
];

/* ---- Google primaryType -> app cuisine key ---- */
const TYPE_MAP = {
  japanese_restaurant:"japanese", sushi_restaurant:"sushi", ramen_restaurant:"ramen",
  pizza_restaurant:"pizza", italian_restaurant:"italian", hamburger_restaurant:"burger",
  american_restaurant:"american", mexican_restaurant:"mexican", chinese_restaurant:"chinese",
  thai_restaurant:"thai", vietnamese_restaurant:"vietnamese", korean_restaurant:"korean",
  indian_restaurant:"indian", sandwich_shop:"sandwich", seafood_restaurant:"seafood",
  french_restaurant:"french", cafe:"cafe", coffee_shop:"coffee_shop",
  breakfast_restaurant:"breakfast", brunch_restaurant:"brunch", bakery:"bakery",
  ice_cream_shop:"ice_cream", dessert_shop:"dessert", barbecue_restaurant:"barbecue",
  steak_house:"steak_house", vegan_restaurant:"vegan", vegetarian_restaurant:"vegetarian",
  greek_restaurant:"greek", spanish_restaurant:"spanish", turkish_restaurant:"turkish",
  lebanese_restaurant:"lebanese", mediterranean_restaurant:"mediterranean",
  middle_eastern_restaurant:"middle_eastern", deli:"deli", fast_food_restaurant:"fast_food",
  pub:"pub", bar:"bar", wine_bar:"wine", tapas_restaurant:"tapas", tapas_bar:"tapas",
  indonesian_restaurant:"asian", asian_restaurant:"asian", brazilian_restaurant:"barbecue",
  peruvian_restaurant:"peruvian", african_restaurant:"ethiopian", german_restaurant:"german",
  portuguese_restaurant:"portuguese", dumpling_restaurant:"dumpling", noodle_shop:"noodle",
  bagel_shop:"bagel", donut_shop:"donut", fish_and_chips_restaurant:"fish_and_chips",
};

const CUISINE = {
  pizza:{ic:"🍕",dish:"Margherita Pizza",base:17}, italian:{ic:"🍝",dish:"Cacio e Pepe",base:22},
  burger:{ic:"🍔",dish:"Cheeseburger",base:14}, american:{ic:"🍔",dish:"Bacon Cheeseburger",base:16},
  mexican:{ic:"🌮",dish:"Tacos al Pastor",base:13}, japanese:{ic:"🍱",dish:"Bento Set",base:22},
  sushi:{ic:"🍣",dish:"Omakase Set",base:32}, ramen:{ic:"🍜",dish:"Tonkotsu Ramen",base:15},
  noodle:{ic:"🍜",dish:"House Noodles",base:13}, chinese:{ic:"🥡",dish:"General Tso's Chicken",base:18},
  thai:{ic:"🍜",dish:"Pad Thai",base:15}, vietnamese:{ic:"🍜",dish:"Pho",base:14},
  korean:{ic:"🍲",dish:"Bibimbap",base:18}, indian:{ic:"🍛",dish:"Butter Chicken",base:17},
  sandwich:{ic:"🥪",dish:"Club Sandwich",base:11}, seafood:{ic:"🦐",dish:"Seafood Platter",base:28},
  french:{ic:"🥐",dish:"Steak Frites",base:26}, cafe:{ic:"☕",dish:"Latte + Pastry",base:8},
  coffee_shop:{ic:"☕",dish:"Latte + Pastry",base:8}, breakfast:{ic:"🍳",dish:"Big Breakfast",base:13},
  brunch:{ic:"🍳",dish:"Brunch Plate",base:16}, bakery:{ic:"🥐",dish:"Fresh Croissant",base:6},
  dessert:{ic:"🍰",dish:"Slice of Cake",base:8}, ice_cream:{ic:"🍦",dish:"Two Scoops",base:7},
  barbecue:{ic:"🍖",dish:"BBQ Platter",base:24}, steak_house:{ic:"🥩",dish:"Ribeye",base:30},
  vegan:{ic:"🥗",dish:"Buddha Bowl",base:15}, vegetarian:{ic:"🥗",dish:"Garden Bowl",base:14},
  greek:{ic:"🥙",dish:"Gyro Plate",base:14}, spanish:{ic:"🥘",dish:"Paella",base:22},
  turkish:{ic:"🥙",dish:"Mixed Grill",base:16}, lebanese:{ic:"🧆",dish:"Mezze Platter",base:16},
  mediterranean:{ic:"🥙",dish:"Mezze Platter",base:16}, middle_eastern:{ic:"🧆",dish:"Falafel Plate",base:14},
  deli:{ic:"🥪",dish:"Deli Sandwich",base:13}, fast_food:{ic:"🍔",dish:"Combo Meal",base:11},
  pub:{ic:"🍺",dish:"Pub Burger",base:16}, bar:{ic:"🍸",dish:"Bar Bites",base:14},
  wine:{ic:"🍷",dish:"Cheese & Wine",base:24}, tapas:{ic:"🥘",dish:"Tapas Spread",base:20},
  asian:{ic:"🥡",dish:"Wok Special",base:16}, peruvian:{ic:"🐟",dish:"Ceviche",base:20},
  ethiopian:{ic:"🍛",dish:"Injera Platter",base:18}, german:{ic:"🥨",dish:"Schnitzel",base:18},
  portuguese:{ic:"🥘",dish:"Piri-Piri Chicken",base:18}, dumpling:{ic:"🥟",dish:"Dumplings",base:13},
  bagel:{ic:"🥯",dish:"Bagel & Lox",base:9}, donut:{ic:"🍩",dish:"Half Dozen",base:8},
  fish_and_chips:{ic:"🍟",dish:"Fish & Chips",base:15},
};
const DEFAULT_POOL = [
  {ic:"🍝",dish:"Chef's Pasta",base:16}, {ic:"🍛",dish:"House Curry",base:15},
  {ic:"🍲",dish:"Daily Special",base:14}, {ic:"🥘",dish:"Chef's Plate",base:16},
  {ic:"🍳",dish:"Comfort Plate",base:13}, {ic:"🥪",dish:"House Sandwich",base:12},
];

const PRICE_LVL = { PRICE_LEVEL_INEXPENSIVE:1, PRICE_LEVEL_MODERATE:2, PRICE_LEVEL_EXPENSIVE:3, PRICE_LEVEL_VERY_EXPENSIVE:4 };

function hash(str){ let h=0; for(let i=0;i<str.length;i++) h=(Math.imul(31,h)+str.charCodeAt(i))|0; return Math.abs(h); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---- field masks, richest first; fall back if the API rejects a field ---- */
const MASKS = [
  "places.id,places.displayName,places.shortFormattedAddress,places.primaryType,places.types,places.rating,places.userRatingCount,places.photos,places.priceLevel,places.priceRange,places.editorialSummary,places.reviews,places.googleMapsUri",
  "places.id,places.displayName,places.shortFormattedAddress,places.primaryType,places.types,places.rating,places.userRatingCount,places.photos,places.priceLevel,places.editorialSummary,places.reviews,places.googleMapsUri",
  "places.id,places.displayName,places.shortFormattedAddress,places.primaryType,places.types,places.rating,places.userRatingCount,places.photos,places.priceLevel",
];
let maskIdx = 0;

async function nearby(KEY, city, includedTypes) {
  const body = {
    includedTypes,
    maxResultCount: 20,
    rankPreference: "POPULARITY",
    locationRestriction: { circle: { center: { latitude: city.lat, longitude: city.lng }, radius: city.radius } },
  };
  while (maskIdx < MASKS.length) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": MASKS[maskIdx] },
      body: JSON.stringify(body),
    });
    if (res.ok) return (await res.json()).places || [];
    const txt = await res.text();
    if (res.status === 400 && /field|mask/i.test(txt) && maskIdx < MASKS.length - 1) {
      console.warn(`  field mask rejected, falling back (tier ${maskIdx + 1} → ${maskIdx + 2})`);
      maskIdx++;
      continue;
    }
    throw new Error(`Nearby ${res.status}: ${txt.slice(0, 300)}`);
  }
  throw new Error("all field masks rejected");
}

async function downloadPhoto(KEY, photoName, dest) {
  // /media follows a redirect straight to the image bytes
  const res = await fetch(`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&key=${KEY}`);
  if (!res.ok) throw new Error(`photo ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

function buildPlace(g, city, photoPath, photoBy) {
  const name = g.displayName?.text; if (!name) return null;
  const h = hash(name);
  const czKey = TYPE_MAP[g.primaryType] || TYPE_MAP[(g.types || []).find(t => TYPE_MAP[t])] || null;
  const c = (czKey && CUISINE[czKey]) || DEFAULT_POOL[h % DEFAULT_POOL.length];
  const en = czKey ? czKey.replace(/_/g, " ")
    : (g.primaryType || "restaurant").replace(/_restaurant$/, "").replace(/_/g, " ");

  const lvl = PRICE_LVL[g.priceLevel] || 0;
  let price = null;
  const pr = g.priceRange;
  if (pr?.startPrice?.units != null) {
    const a = Number(pr.startPrice.units), b = Number(pr.endPrice?.units ?? a);
    if (b > 0) price = (a + b) / 2 * 0.9;             // mid of meal range, solo-ish portion
  }
  if (price == null || !isFinite(price)) {
    const mult = lvl ? { 1: 0.75, 2: 1, 3: 1.6, 4: 2.4 }[lvl] : 1;
    price = c.base * city.pf * mult * (0.85 + ((h >> 3) % 30) / 100);
  }
  price = Math.max(3 * city.pf, Math.min(90 * city.pf, price));
  price = city.cur.dec === 0 ? Math.round(price) : Math.round(price * 100) / 100;

  const street = (g.shortFormattedAddress || "").split(",")[0].replace(/^[\d–\-/ ]+\s*/, "").trim();
  const rv = (g.reviews || [])
    .filter(r => r.text?.text)
    .slice(0, 3)
    .map(r => ({
      t: r.text.text.replace(/\s+/g, " ").trim().slice(0, 200),
      r: r.rating || 5,
      a: (r.authorAttribution?.displayName || "a local").split(" ")[0],
    }));

  return {
    _key: `g${g.id}`, _cityId: city.id, _cityName: city.name, _flag: city.flag, _cur: city.cur,
    ic: c.ic, name, hood: street || city.name, dish: c.dish, en,
    rate: g.rating != null ? Math.round(g.rating * 10) / 10 : (40 + h % 10) / 10,
    n: g.userRatingCount || 200 + (h % 9000),
    price, lvl: lvl || null,
    desc: g.editorialSummary?.text || null,
    maps: g.googleMapsUri || null,
    photo: photoPath, photoBy: photoBy || null,
    rv,
  };
}

async function bakeCity(KEY, city, photosDir) {
  console.log(`\n[${city.id}] ${city.name}`);
  const a = await nearby(KEY, city, ["restaurant"]);
  await sleep(200);
  let b = [];
  try { b = await nearby(KEY, city, ["cafe", "bakery", "fast_food_restaurant", "bar"]); }
  catch (e) { console.warn(`  second sweep failed (${e.message}) — continuing with ${a.length}`); }

  const seen = new Set(), merged = [];
  for (const g of [...a, ...b]) {
    const nm = g.displayName?.text?.toLowerCase();
    if (!nm || seen.has(nm) || seen.has(g.id)) continue;
    seen.add(nm); seen.add(g.id);
    merged.push(g);
  }
  // most-reviewed first, photo-havers first — recognizable places make the demo land
  merged.sort((x, y) => ((y.photos?.length ? 1 : 0) - (x.photos?.length ? 1 : 0)) || (y.userRatingCount || 0) - (x.userRatingCount || 0));

  const places = [];
  for (const g of merged) {
    if (places.length >= 20) break;
    let photoPath = null, photoBy = null;
    const ph = (g.photos || [])[0];
    if (ph) {
      const safeId = g.id.replace(/[^a-zA-Z0-9_-]/g, "");
      const dest = path.join(photosDir, `${safeId}.jpg`);
      photoBy = ph.authorAttributions?.[0]?.displayName || null;
      if (existsSync(dest)) photoPath = `places/photos/${safeId}.jpg`;
      else {
        try { await downloadPhoto(KEY, ph.name, dest); photoPath = `places/photos/${safeId}.jpg`; await sleep(120); }
        catch (e) { console.warn(`  [photo skip] ${g.displayName?.text}: ${e.message}`); }
      }
    }
    const p = buildPlace(g, city, photoPath, photoBy);
    if (p) places.push(p);
  }
  places.sort((x, y) => y.rate - x.rate || y.n - x.n);
  console.log(`  → ${places.length} places · ${places.filter(p => p.photo).length} photos · ${places.filter(p => p.rv.length).length} with real reviews`);
  return places;
}

async function main() {
  const KEY = await loadKey();
  if (!KEY) {
    console.error("No key. Either:\n  export GOOGLE_PLACES_KEY=your-key\nor create ~/dopamine-app/.env containing:\n  GOOGLE_PLACES_KEY=your-key");
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const ids = args.filter(x => x !== "--force");
  const cities = ids.length ? CITIES.filter(c => ids.includes(c.id)) : CITIES;
  if (!cities.length) { console.error(`No matching cities. Available: ${CITIES.map(c => c.id).join(", ")}`); process.exit(1); }

  await mkdir("places/photos", { recursive: true });
  let baked = 0, skipped = 0, failed = 0;
  for (const city of cities) {
    const out = `places/${city.id}.json`;
    if (!force && existsSync(out)) { console.log(`[${city.id}] skip — exists (use --force to re-bake)`); skipped++; continue; }
    try {
      const places = await bakeCity(KEY, city, "places/photos");
      await writeFile(out, JSON.stringify(places));
      baked++;
    } catch (e) { console.error(`[${city.id}] ERROR: ${e.message}`); failed++; }
    await sleep(250);
  }
  await writeFile("places/index.json", JSON.stringify({
    bakedAt: new Date().toISOString(),
    cities: CITIES.map(c => ({ id: c.id, name: c.name, baked: existsSync(`places/${c.id}.json`) })),
  }, null, 2));
  console.log(`\nDone. baked ${baked} · skipped ${skipped} · failed ${failed}`);
  console.log("Next: bump CACHE in sw.js, then:\n  git -C ~/dopamine-app add -A && git -C ~/dopamine-app commit -m 'bake 50 cities' && git -C ~/dopamine-app push");
}

main().catch(e => { console.error(e); process.exit(1); });
