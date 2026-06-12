#!/usr/bin/env node
// bake-places.mjs — pre-bake city restaurant data from Google Places API (New)
// Usage: GOOGLE_PLACES_KEY=xxx node bake-places.mjs [cityId ...]
//   Run with no args to bake all 13 cities. Pass IDs to bake a subset:
//     node bake-places.mjs nyc chi la
// Outputs: places/<cityId>.json + places/photos/<placeId>.jpg
// Re-run is safe: existing files are skipped (delete to force refresh).

import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const KEY = process.env.GOOGLE_PLACES_KEY;
if (!KEY) { console.error("Error: GOOGLE_PLACES_KEY env var not set.\n  export GOOGLE_PLACES_KEY=your-key-here"); process.exit(1); }

const CITIES = [
  { id:"nyc", name:"New York",    flag:"🗽", cur:{sym:"$",dec:2},  pf:1,    lat:40.7280, lng:-73.9990, radius:2200 },
  { id:"la",  name:"Los Angeles", flag:"🌴", cur:{sym:"$",dec:2},  pf:1,    lat:34.0760, lng:-118.3700, radius:3000 },
  { id:"ldn", name:"London",      flag:"🇬🇧", cur:{sym:"£",dec:2},  pf:0.82, lat:51.5145, lng:-0.1357,  radius:2200 },
  { id:"tyo", name:"Tokyo",       flag:"🗼", cur:{sym:"¥",dec:0},  pf:150,  lat:35.6620, lng:139.7000,  radius:2200 },
  { id:"sel", name:"Seoul",       flag:"🇰🇷", cur:{sym:"₩",dec:0},  pf:1350, lat:37.5512, lng:126.9882, radius:2500 },
  { id:"mex", name:"Mexico City", flag:"🇲🇽", cur:{sym:"MX$",dec:0},pf:7,    lat:19.4150, lng:-99.1700, radius:2500 },
  { id:"par", name:"Paris",       flag:"🇫🇷", cur:{sym:"€",dec:2},  pf:0.92, lat:48.8566, lng:2.3522,   radius:2200 },
  { id:"ber", name:"Berlin",      flag:"🇩🇪", cur:{sym:"€",dec:2},  pf:0.92, lat:52.5200, lng:13.4050,  radius:2400 },
  { id:"bkk", name:"Bangkok",     flag:"🇹🇭", cur:{sym:"฿",dec:0},  pf:35,   lat:13.7563, lng:100.5018, radius:2600 },
  { id:"syd", name:"Sydney",      flag:"🇦🇺", cur:{sym:"A$",dec:2}, pf:1.5,  lat:-33.8688,lng:151.2093, radius:2600 },
  { id:"tor", name:"Toronto",     flag:"🇨🇦", cur:{sym:"C$",dec:2}, pf:1.35, lat:43.6532, lng:-79.3832, radius:2600 },
  { id:"chi", name:"Chicago",     flag:"🌆", cur:{sym:"$",dec:2},  pf:1,    lat:41.8781, lng:-87.6298, radius:2600 },
  { id:"sin", name:"Singapore",   flag:"🇸🇬", cur:{sym:"S$",dec:2}, pf:1.35, lat:1.3000,  lng:103.8400, radius:2600 },
];

const TYPE_MAP = {
  japanese_restaurant:"japanese", sushi_restaurant:"sushi", ramen_restaurant:"ramen",
  pizza_restaurant:"pizza", italian_restaurant:"italian", hamburger_restaurant:"burger",
  american_restaurant:"american", mexican_restaurant:"mexican", chinese_restaurant:"chinese",
  thai_restaurant:"thai", vietnamese_restaurant:"vietnamese", korean_restaurant:"korean",
  indian_restaurant:"indian", sandwich_shop:"sandwich", seafood_restaurant:"seafood",
  french_restaurant:"french", cafe:"cafe", coffee_shop:"coffee_shop",
  breakfast_restaurant:"breakfast", bakery:"bakery", ice_cream_shop:"ice_cream",
  barbecue_restaurant:"barbecue", steak_house:"steak_house", vegan_restaurant:"vegan",
  vegetarian_restaurant:"vegetarian", greek_restaurant:"greek", spanish_restaurant:"spanish",
  middle_eastern_restaurant:"middle_eastern", deli:"deli", fast_food_restaurant:"fast_food",
  pub:"pub", bar:"bar", wine_bar:"wine",
};

const CUISINE = {
  pizza:{ic:"🍕",dish:"Margherita Pizza",base:17}, italian:{ic:"🍝",dish:"Cacio e Pepe",base:22},
  burger:{ic:"🍔",dish:"Cheeseburger",base:14}, american:{ic:"🍔",dish:"Bacon Cheeseburger",base:16},
  mexican:{ic:"🌮",dish:"Tacos al Pastor",base:13}, japanese:{ic:"🍱",dish:"Bento Set",base:22},
  sushi:{ic:"🍣",dish:"Omakase Set",base:32}, ramen:{ic:"🍜",dish:"Tonkotsu Ramen",base:15},
  chinese:{ic:"🥡",dish:"General Tso's Chicken",base:18}, thai:{ic:"🍜",dish:"Pad Thai",base:15},
  vietnamese:{ic:"🍜",dish:"Pho",base:14}, korean:{ic:"🍲",dish:"Bibimbap",base:18},
  indian:{ic:"🍛",dish:"Butter Chicken",base:17}, sandwich:{ic:"🥪",dish:"Club Sandwich",base:11},
  seafood:{ic:"🦐",dish:"Seafood Platter",base:28}, french:{ic:"🥐",dish:"Steak Frites",base:26},
  cafe:{ic:"☕",dish:"Latte + Pastry",base:8}, coffee_shop:{ic:"☕",dish:"Latte + Pastry",base:8},
  breakfast:{ic:"🍳",dish:"Big Breakfast",base:13}, bakery:{ic:"🥐",dish:"Fresh Croissant",base:6},
  ice_cream:{ic:"🍦",dish:"Two Scoops",base:7}, barbecue:{ic:"🍖",dish:"BBQ Platter",base:24},
  steak_house:{ic:"🥩",dish:"Ribeye",base:30}, vegan:{ic:"🥗",dish:"Buddha Bowl",base:15},
  vegetarian:{ic:"🥗",dish:"Garden Bowl",base:14}, greek:{ic:"🥙",dish:"Gyro Plate",base:14},
  spanish:{ic:"🥘",dish:"Paella",base:22}, middle_eastern:{ic:"🧆",dish:"Falafel Plate",base:14},
  deli:{ic:"🥪",dish:"Deli Sandwich",base:13}, fast_food:{ic:"🍔",dish:"Combo Meal",base:11},
  pub:{ic:"🍺",dish:"Pub Burger",base:16}, bar:{ic:"🍸",dish:"Bar Bites",base:14},
  wine:{ic:"🍷",dish:"Cheese & Wine",base:24}, _default:{ic:"🍽️",dish:"House Special",base:15},
};
const DEFAULT_POOL = [
  {ic:"🍝",dish:"Chef's Pasta",base:16}, {ic:"🍛",dish:"House Curry",base:15},
  {ic:"🍲",dish:"Daily Special",base:14}, {ic:"🥘",dish:"Chef's Plate",base:16},
  {ic:"🍳",dish:"Comfort Plate",base:13}, {ic:"🥪",dish:"House Sandwich",base:12},
];

const RV = [
  "been staring at this for 20 min. craving cured.",
  "looked, didn't buy, slept great.",
  "added to cart, closed the app, $0 spent.",
  "the photos alone fed me 🙏",
  "ordered this in my heart.",
  "my bank account said thank you.",
  "window-shopped it and felt better.",
  "2am craving, held strong 💪",
  "calorie-free because it's a photo ^^",
  "payday's friday — this is dinner (visually).",
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickReviews(h) {
  const i = h % RV.length;
  let j = (h >> 4) % RV.length;
  if (j === i) j = (j + 1) % RV.length;
  return [[RV[i], "★★★★★"], [RV[j], "★★★★☆"]];
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function nearbySearch(city, pageToken) {
  const body = {
    includedTypes: ["restaurant", "cafe", "fast_food_restaurant"],
    maxResultCount: 20,
    locationRestriction: { circle: { center: { latitude: city.lat, longitude: city.lng }, radius: city.radius } },
  };
  if (pageToken) body.pageToken = pageToken;

  const fieldMask = "places.id,places.displayName,places.shortFormattedAddress,places.primaryType,places.types,places.rating,places.userRatingCount,places.photos,places.location";

  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": fieldMask },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Nearby Search ${res.status}: ${t}`); }
  return res.json();
}

async function downloadPhoto(photoName, destPath) {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&skipHttpRedirect=true&key=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Photo ${res.status}`);
  const json = await res.json();
  const imgUrl = json.photoUri;
  if (!imgUrl) throw new Error("No photoUri in response");
  const imgRes = await fetch(imgUrl);
  if (!imgRes.ok) throw new Error(`Photo fetch ${imgRes.status}`);
  const buf = await imgRes.arrayBuffer();
  await writeFile(destPath, Buffer.from(buf));
}

async function bakeCity(city, photosDir) {
  console.log(`\n[${city.id}] ${city.name}`);
  const rawPlaces = [];

  // Fetch up to 2 pages (40 results max) to get a good variety
  let token;
  for (let page = 0; page < 2; page++) {
    const data = await nearbySearch(city, token);
    rawPlaces.push(...(data.places || []));
    console.log(`  page ${page + 1}: ${(data.places || []).length} results`);
    token = data.nextPageToken;
    if (!token) break;
    await sleep(300);
  }

  const seen = new Set();
  const places = [];

  for (const p of rawPlaces) {
    const name = p.displayName?.text;
    if (!name) continue;
    const dk = name.toLowerCase();
    if (seen.has(dk)) continue;
    seen.add(dk);

    const h = hash(name);
    const primaryType = p.primaryType || "";
    const fallbackType = (p.types || []).find(t => TYPE_MAP[t]);
    const czKey = TYPE_MAP[primaryType] || (fallbackType ? TYPE_MAP[fallbackType] : null);
    const c = (czKey && CUISINE[czKey]) || DEFAULT_POOL[h % DEFAULT_POOL.length];
    const cuisineLabel = czKey ? czKey.replace(/_/g, " ") : "restaurant";

    const rate = p.rating != null ? Math.round(p.rating * 10) / 10 : (40 + h % 10) / 10;
    const n = p.userRatingCount || 200 + (h % 9000);

    let price = c.base * city.pf * (0.85 + ((h >> 3) % 30) / 100);
    price = city.cur.dec === 0 ? Math.round(price) : Math.round(price * 100) / 100;

    const addr = p.shortFormattedAddress || "";
    const parts = addr.split(",");
    const hood = (parts.length >= 2 ? parts[parts.length - 2] : parts[0] || city.name).trim();

    let photoPath = null;
    const photoRef = (p.photos || [])[0];
    if (photoRef) {
      const safeId = p.id.replace(/[^a-zA-Z0-9_-]/g, "");
      const dest = path.join(photosDir, `${safeId}.jpg`);
      if (existsSync(dest)) {
        photoPath = `places/photos/${safeId}.jpg`;
      } else {
        try {
          await downloadPhoto(photoRef.name, dest);
          photoPath = `places/photos/${safeId}.jpg`;
          await sleep(150);
        } catch (e) {
          console.warn(`  [photo skip] ${name}: ${e.message}`);
        }
      }
    }

    places.push({
      _key: `g${p.id}`,
      _cityId: city.id,
      _cityName: city.name,
      _flag: city.flag,
      _cur: city.cur,
      ic: c.ic,
      name,
      hood,
      dish: c.dish,
      en: cuisineLabel,
      rate,
      n,
      price,
      reviews: pickReviews(h),
      photo: photoPath,
    });

    if (places.length >= 42) break;
  }

  places.sort((a, b) => b.rate - a.rate || b.n - a.n);
  console.log(`  → ${places.length} places, ${places.filter(p => p.photo).length} with photos`);
  return places;
}

async function main() {
  const targetIds = process.argv.slice(2);
  const cities = targetIds.length ? CITIES.filter(c => targetIds.includes(c.id)) : CITIES;

  if (!cities.length) {
    console.error(`No matching cities. Available: ${CITIES.map(c => c.id).join(", ")}`);
    process.exit(1);
  }

  await mkdir("places/photos", { recursive: true });

  let baked = 0, skipped = 0;
  for (const city of cities) {
    const outFile = `places/${city.id}.json`;
    if (existsSync(outFile)) {
      console.log(`[${city.id}] skip — ${outFile} exists (delete to re-bake)`);
      skipped++;
      continue;
    }
    try {
      const places = await bakeCity(city, "places/photos");
      await writeFile(outFile, JSON.stringify(places, null, 2));
      baked++;
    } catch (e) {
      console.error(`[${city.id}] ERROR: ${e.message}`);
    }
    await sleep(400);
  }

  console.log(`\nDone. Baked: ${baked}, skipped: ${skipped}`);
  if (baked > 0) console.log("Commit the places/ dir, bump sw.js CACHE version, then push.");
}

main().catch(e => { console.error(e); process.exit(1); });
