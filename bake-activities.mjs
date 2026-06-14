#!/usr/bin/env node
// bake-activities.mjs — pre-bake "things to do" per city from Google Places API (New).
//
//   node bake-activities.mjs            # all 50 cities (skips existing)
//   node bake-activities.mjs nyc tyo    # subset
//   node bake-activities.mjs --force    # re-bake everything
//
// Per city: 5 Text Search queries (attractions / museums / parks & gardens / nightlife /
// general) → merged, filtered to non-food, non-lodging, photographed, well-rated spots,
// then capped per category for variety → ~24 activities. Each carries: category (emoji +
// label), an estimated cost (USD base, 0 = free), who it's for (family/date/friends/solo),
// pet-friendly (Google allowsDogs ∪ outdoor types), rating, photo, editorial blurb, maps link.
//
// Output: activities/<cityId>.json + activities/photos/<placeId>.jpg
// Cost ≈ 250 text searches + ~1200 photos ≈ ~$17, inside the $200/mo free credit.

import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

async function loadKey() {
  if (process.env.GOOGLE_PLACES_KEY) return process.env.GOOGLE_PLACES_KEY.trim();
  try { const env = await readFile(new URL(".env", import.meta.url), "utf8"); const m = env.match(/^\s*GOOGLE_PLACES_KEY\s*=\s*["']?([^"'\n#]+)/m); if (m) return m[1].trim(); } catch {}
  return null;
}

const CITIES = [
  { id:"nyc", name:"New York",     flag:"🗽", cur:{sym:"$",dec:2},   pf:1,    lat:40.7280,  lng:-73.9990 },
  { id:"la",  name:"Los Angeles",  flag:"🌴", cur:{sym:"$",dec:2},   pf:1,    lat:34.0760,  lng:-118.3700 },
  { id:"ldn", name:"London",       flag:"🇬🇧", cur:{sym:"£",dec:2},   pf:0.82, lat:51.5145,  lng:-0.1357 },
  { id:"tyo", name:"Tokyo",        flag:"🗼", cur:{sym:"¥",dec:0},   pf:150,  lat:35.6620,  lng:139.7000 },
  { id:"sel", name:"Seoul",        flag:"🇰🇷", cur:{sym:"₩",dec:0},   pf:1350, lat:37.5512,  lng:126.9882 },
  { id:"mex", name:"Mexico City",  flag:"🇲🇽", cur:{sym:"MX$",dec:0}, pf:7,    lat:19.4150,  lng:-99.1700 },
  { id:"par", name:"Paris",        flag:"🇫🇷", cur:{sym:"€",dec:2},   pf:0.92, lat:48.8566,  lng:2.3522 },
  { id:"ber", name:"Berlin",       flag:"🇩🇪", cur:{sym:"€",dec:2},   pf:0.92, lat:52.5200,  lng:13.4050 },
  { id:"bkk", name:"Bangkok",      flag:"🇹🇭", cur:{sym:"฿",dec:0},   pf:35,   lat:13.7563,  lng:100.5018 },
  { id:"syd", name:"Sydney",       flag:"🇦🇺", cur:{sym:"A$",dec:2},  pf:1.5,  lat:-33.8688, lng:151.2093 },
  { id:"tor", name:"Toronto",      flag:"🇨🇦", cur:{sym:"C$",dec:2},  pf:1.35, lat:43.6532,  lng:-79.3832 },
  { id:"chi", name:"Chicago",      flag:"🌆", cur:{sym:"$",dec:2},   pf:1,    lat:41.8781,  lng:-87.6298 },
  { id:"sin", name:"Singapore",    flag:"🇸🇬", cur:{sym:"S$",dec:2},  pf:1.35, lat:1.3000,   lng:103.8400 },
  { id:"hou", name:"Houston",      flag:"🚀", cur:{sym:"$",dec:2},   pf:1,    lat:29.7426,  lng:-95.3905 },
  { id:"sfo", name:"San Francisco",flag:"🌁", cur:{sym:"$",dec:2},   pf:1.15, lat:37.7599,  lng:-122.4148 },
  { id:"nol", name:"New Orleans",  flag:"🎷", cur:{sym:"$",dec:2},   pf:0.95, lat:29.9584,  lng:-90.0644 },
  { id:"oax", name:"Oaxaca",       flag:"🌶️", cur:{sym:"MX$",dec:0}, pf:6,    lat:17.0606,  lng:-96.7253 },
  { id:"lim", name:"Lima",         flag:"🇵🇪", cur:{sym:"S/",dec:0},  pf:3,    lat:-12.1211, lng:-77.0297 },
  { id:"bue", name:"Buenos Aires", flag:"🇦🇷", cur:{sym:"AR$",dec:0}, pf:900,  lat:-34.5875, lng:-58.4260 },
  { id:"sao", name:"São Paulo",    flag:"🇧🇷", cur:{sym:"R$",dec:0},  pf:4,    lat:-23.5614, lng:-46.6823 },
  { id:"rom", name:"Rome",         flag:"🏛️", cur:{sym:"€",dec:2},   pf:0.92, lat:41.8950,  lng:12.4740 },
  { id:"nap", name:"Naples",       flag:"🍕", cur:{sym:"€",dec:2},   pf:0.92, lat:40.8484,  lng:14.2528 },
  { id:"bol", name:"Bologna",      flag:"🍝", cur:{sym:"€",dec:2},   pf:0.92, lat:44.4938,  lng:11.3426 },
  { id:"bcn", name:"Barcelona",    flag:"🇪🇸", cur:{sym:"€",dec:2},   pf:0.92, lat:41.3851,  lng:2.1734 },
  { id:"mad", name:"Madrid",       flag:"🐂", cur:{sym:"€",dec:2},   pf:0.92, lat:40.4200,  lng:-3.7038 },
  { id:"sse", name:"San Sebastián",flag:"🍢", cur:{sym:"€",dec:2},   pf:0.92, lat:43.3224,  lng:-1.9846 },
  { id:"lis", name:"Lisbon",       flag:"🇵🇹", cur:{sym:"€",dec:2},   pf:0.92, lat:38.7100,  lng:-9.1400 },
  { id:"cph", name:"Copenhagen",   flag:"🇩🇰", cur:{sym:"kr",dec:0},  pf:6.5,  lat:55.6800,  lng:12.5800 },
  { id:"ams", name:"Amsterdam",    flag:"🇳🇱", cur:{sym:"€",dec:2},   pf:0.92, lat:52.3650,  lng:4.8950 },
  { id:"vie", name:"Vienna",       flag:"🎻", cur:{sym:"€",dec:2},   pf:0.92, lat:48.2082,  lng:16.3738 },
  { id:"ath", name:"Athens",       flag:"🏺", cur:{sym:"€",dec:2},   pf:0.92, lat:37.9779,  lng:23.7250 },
  { id:"ist", name:"Istanbul",     flag:"🇹🇷", cur:{sym:"₺",dec:0},   pf:20,   lat:41.0322,  lng:28.9770 },
  { id:"tlv", name:"Tel Aviv",     flag:"🇮🇱", cur:{sym:"₪",dec:0},   pf:3.7,  lat:32.0680,  lng:34.7700 },
  { id:"bey", name:"Beirut",       flag:"🇱🇧", cur:{sym:"$",dec:2},   pf:1,    lat:33.8959,  lng:35.5180 },
  { id:"dxb", name:"Dubai",        flag:"🏜️", cur:{sym:"AED",dec:0}, pf:3.7,  lat:25.1972,  lng:55.2744 },
  { id:"cai", name:"Cairo",        flag:"🐫", cur:{sym:"E£",dec:0},  pf:20,   lat:30.0609,  lng:31.2197 },
  { id:"rak", name:"Marrakech",    flag:"🇲🇦", cur:{sym:"DH",dec:0},  pf:6,    lat:31.6258,  lng:-7.9891 },
  { id:"cpt", name:"Cape Town",    flag:"🇿🇦", cur:{sym:"R",dec:0},   pf:14,   lat:-33.9249, lng:18.4241 },
  { id:"osa", name:"Osaka",        flag:"🐙", cur:{sym:"¥",dec:0},   pf:150,  lat:34.6687,  lng:135.5013 },
  { id:"kyo", name:"Kyoto",        flag:"⛩️", cur:{sym:"¥",dec:0},   pf:150,  lat:35.0037,  lng:135.7681 },
  { id:"pus", name:"Busan",        flag:"🦀", cur:{sym:"₩",dec:0},   pf:1350, lat:35.1578,  lng:129.0604 },
  { id:"hkg", name:"Hong Kong",    flag:"🥟", cur:{sym:"HK$",dec:0}, pf:7.8,  lat:22.2819,  lng:114.1556 },
  { id:"tpe", name:"Taipei",       flag:"🧋", cur:{sym:"NT$",dec:0}, pf:31,   lat:25.0420,  lng:121.5070 },
  { id:"sgn", name:"Saigon",       flag:"🛵", cur:{sym:"₫",dec:0},   pf:6000, lat:10.7769,  lng:106.7009 },
  { id:"han", name:"Hanoi",        flag:"🍜", cur:{sym:"₫",dec:0},   pf:6000, lat:21.0338,  lng:105.8500 },
  { id:"pen", name:"Penang",       flag:"🦐", cur:{sym:"RM",dec:0},  pf:2,    lat:5.4164,   lng:100.3327 },
  { id:"kul", name:"Kuala Lumpur", flag:"🇲🇾", cur:{sym:"RM",dec:0},  pf:2,    lat:3.1466,   lng:101.7107 },
  { id:"bom", name:"Mumbai",       flag:"🇮🇳", cur:{sym:"₹",dec:0},   pf:30,   lat:19.0596,  lng:72.8295 },
  { id:"del", name:"Delhi",        flag:"🛺", cur:{sym:"₹",dec:0},   pf:30,   lat:28.6315,  lng:77.2167 },
  { id:"mel", name:"Melbourne",    flag:"☕", cur:{sym:"A$",dec:2},  pf:1.5,  lat:-37.8136, lng:144.9631 },
];

// primaryType -> { ic, label, cost(USD base, 0=free) }
const ACT_CAT = {
  museum:{ic:"🏛️",label:"museum",cost:20}, art_gallery:{ic:"🖼️",label:"gallery",cost:15},
  park:{ic:"🌳",label:"park",cost:0}, national_park:{ic:"🏞️",label:"nature",cost:0}, state_park:{ic:"🏞️",label:"nature",cost:0},
  garden:{ic:"🌷",label:"garden",cost:10}, botanical_garden:{ic:"🌷",label:"garden",cost:12},
  tourist_attraction:{ic:"📸",label:"attraction",cost:18}, point_of_interest:{ic:"📍",label:"spot",cost:12},
  historical_landmark:{ic:"🏰",label:"landmark",cost:12}, historical_place:{ic:"🏰",label:"landmark",cost:12},
  monument:{ic:"🗿",label:"monument",cost:0}, cultural_landmark:{ic:"🏯",label:"landmark",cost:10},
  amusement_park:{ic:"🎢",label:"theme park",cost:55}, water_park:{ic:"🏊",label:"water park",cost:40},
  aquarium:{ic:"🐠",label:"aquarium",cost:30}, zoo:{ic:"🦁",label:"zoo",cost:25},
  market:{ic:"🛍️",label:"market",cost:0}, plaza:{ic:"⛲",label:"plaza",cost:0},
  bar:{ic:"🍸",label:"bar",cost:25}, night_club:{ic:"🪩",label:"nightlife",cost:30}, pub:{ic:"🍺",label:"pub",cost:20},
  wine_bar:{ic:"🍷",label:"wine bar",cost:28}, observation_deck:{ic:"🌆",label:"viewpoint",cost:35},
  beach:{ic:"🏖️",label:"beach",cost:0}, hiking_area:{ic:"🥾",label:"hike",cost:0}, dog_park:{ic:"🐕",label:"dog park",cost:0},
  spa:{ic:"💆",label:"spa",cost:60}, stadium:{ic:"🏟️",label:"stadium",cost:40}, arena:{ic:"🏟️",label:"arena",cost:45},
  performing_arts_theater:{ic:"🎭",label:"theater",cost:50}, concert_hall:{ic:"🎶",label:"concert hall",cost:45}, opera_house:{ic:"🎼",label:"opera",cost:55},
  movie_theater:{ic:"🎬",label:"cinema",cost:15}, church:{ic:"⛪",label:"church",cost:0}, cathedral:{ic:"⛪",label:"cathedral",cost:0},
  hindu_temple:{ic:"🛕",label:"temple",cost:0}, mosque:{ic:"🕌",label:"mosque",cost:0}, synagogue:{ic:"🕍",label:"synagogue",cost:0},
  buddhist_temple:{ic:"☸️",label:"temple",cost:0}, place_of_worship:{ic:"🛐",label:"temple",cost:0},
  casino:{ic:"🎰",label:"casino",cost:0}, bowling_alley:{ic:"🎳",label:"bowling",cost:20}, amusement_center:{ic:"🕹️",label:"arcade",cost:20},
  cultural_center:{ic:"🎎",label:"culture",cost:10}, library:{ic:"📚",label:"library",cost:0}, planetarium:{ic:"🪐",label:"planetarium",cost:18},
  ferry_terminal:{ic:"⛴️",label:"ferry",cost:8}, marina:{ic:"⛵",label:"marina",cost:0}, scenic_lookout:{ic:"🌄",label:"lookout",cost:0},
};
const DEFAULT_CAT = {ic:"📍",label:"spot",cost:15};
const FREE_LABELS = new Set(["park","nature","monument","market","plaza","beach","hike","dog park","church","cathedral","temple","mosque","synagogue","library","marina","lookout","casino"]);

const CHAINS = ["hard rock","madame tussauds","hilton","marriott","holiday inn","ibis","novotel"];
const SKIP_TYPES = new Set(["restaurant","cafe","coffee_shop","bakery","meal_takeaway","fast_food_restaurant","lodging","hotel","motel","resort_hotel","store","clothing_store","supermarket","grocery_store","shopping_mall","gas_station","parking","atm","bank","car_rental","airport","subway_station","bus_station","train_station","transit_station","hospital","pharmacy","school","university","gym","real_estate_agency","travel_agency"]);

const PRICE_LVL = { PRICE_LEVEL_INEXPENSIVE:1, PRICE_LEVEL_MODERATE:2, PRICE_LEVEL_EXPENSIVE:3, PRICE_LEVEL_VERY_EXPENSIVE:4 };
function hash(str){ let h=0; for(let i=0;i<str.length;i++) h=(Math.imul(31,h)+str.charCodeAt(i))|0; return Math.abs(h); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PLACE_FIELDS = "places.id,places.displayName,places.shortFormattedAddress,places.primaryType,places.types,places.rating,places.userRatingCount,places.photos,places.priceLevel,places.editorialSummary,places.googleMapsUri,places.location,places.allowsDogs,places.goodForChildren,places.goodForGroups";
const TEXT_MASK = "nextPageToken," + PLACE_FIELDS;

async function textSearch(KEY, city, query, type) {
  const body = { textQuery: query, pageSize: 20, rankPreference: "RELEVANCE",
    locationBias: { circle: { center: { latitude: city.lat, longitude: city.lng }, radius: 30000 } } };
  if (type) body.includedType = type;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": TEXT_MASK },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TextSearch ${res.status}: ${(await res.text()).slice(0,200)}`);
  return (await res.json()).places || [];
}
async function downloadPhoto(KEY, photoName, dest) {
  const res = await fetch(`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&key=${KEY}`);
  if (!res.ok) throw new Error(`photo ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}
function isChain(name){ const n=name.toLowerCase(); return CHAINS.some(c=>n.includes(c)); }
function catOf(g){ return ACT_CAT[g.primaryType] || ACT_CAT[(g.types||[]).find(t=>ACT_CAT[t])] || DEFAULT_CAT; }
function keepActivity(g){
  const name=g.displayName?.text; if(!name) return false;
  if(SKIP_TYPES.has(g.primaryType||"")) return false;
  if((g.types||[]).some(t=>/_restaurant$|^restaurant$|lodging|hotel|^store$/.test(t))) return false;
  if(isChain(name)) return false;
  if(!(g.photos||[]).length) return false;
  if((g.userRatingCount||0) < 50) return false;
  if(g.rating!=null && g.rating < 4.0) return false;
  return true;
}
function pickPhoto(g){ const ph=(g.photos||[]).filter(p=>p.name); if(!ph.length) return null; return ph.find(p=>(p.widthPx||0)>=(p.heightPx||1))||ph[0]; }
function audienceOf(g, cat){
  const who=new Set(), t=g.primaryType||"", lab=cat.label;
  if(g.goodForChildren) who.add("family");
  if(g.goodForGroups) who.add("friends");
  if(/park|garden|zoo|aquarium|museum|amusement|water_park|market|beach|planetarium|library|nature/.test(t)||/park|zoo|aquarium|museum|garden|market|nature|theme/.test(lab)) who.add("family");
  if(/bar|night_club|wine|pub|observation|spa|garden|cathedral|opera/.test(t)||/bar|nightlife|wine|viewpoint|spa|garden|rooftop/.test(lab)) who.add("date");
  if(/bar|night_club|pub|market|stadium|arena|bowling|casino|amusement/.test(t)||/bar|nightlife|pub|market|stadium|bowling|arcade/.test(lab)) who.add("friends");
  if(/museum|gallery|park|library|temple|church|landmark|monument|lookout/.test(t)||FREE_LABELS.has(lab)||/museum|gallery|landmark/.test(lab)) who.add("solo");
  if(!who.size) who.add("everyone");
  return [...who].slice(0,3);
}
function petOf(g, cat){ if(g.allowsDogs===true) return true; return /park|nature|beach|garden|market|hike|plaza|lookout|marina/.test(cat.label); }

function buildActivity(g, city, photoPath){
  const cat=catOf(g), h=hash(g.displayName.text);
  const free = FREE_LABELS.has(cat.label) || cat.cost===0;
  let costUsd = free ? 0 : cat.cost;
  if(!free && PRICE_LVL[g.priceLevel]) costUsd = Math.round(cat.cost * ({1:0.6,2:1,3:1.5,4:2.2}[PRICE_LVL[g.priceLevel]]||1));
  if(!free) costUsd = Math.max(5, costUsd + ((h%7)-3));   // small per-place wobble
  const street = (g.shortFormattedAddress||"").split(",")[0].replace(/^\d+\s+/,"").trim();
  return {
    _key:`a${g.id}`, _cityId:city.id, _cityName:city.name, _flag:city.flag,
    name:g.displayName.text, cat:cat.label, ic:cat.ic,
    free, costUsd, who:audienceOf(g,cat), pet:petOf(g,cat),
    rate:g.rating!=null?Math.round(g.rating*10)/10:4.3, n:g.userRatingCount||300,
    desc:g.editorialSummary?.text||null, hood:street||city.name,
    maps:g.googleMapsUri||null, lat:g.location?.latitude??null, lng:g.location?.longitude??null,
    photo:photoPath,
  };
}

async function bakeCity(KEY, city, photosDir){
  console.log(`\n[${city.id}] ${city.name}`);
  const queries = [
    {q:`top attractions in ${city.name}`, type:"tourist_attraction"},
    {q:`best museums and galleries in ${city.name}`, type:"museum"},
    {q:`parks and gardens in ${city.name}`, type:"park"},
    {q:`bars and nightlife in ${city.name}`, type:"bar"},
    {q:`unique things to do in ${city.name}`, type:null},
  ];
  const raw=[];
  for(const {q,type} of queries){
    try{ raw.push(...await textSearch(KEY, city, q, type)); }
    catch(e){ console.warn(`  "${q}" failed: ${e.message}`); }
    await sleep(250);
  }
  // dedupe + filter
  const seen=new Set(), kept=[];
  for(const g of raw){ const nm=g.displayName?.text?.toLowerCase(); if(!nm||seen.has(nm)||seen.has(g.id)) continue; if(!keepActivity(g)) continue; seen.add(nm); seen.add(g.id); kept.push(g); }
  kept.sort((a,b)=>((b.rating||0)-(a.rating||0))||((b.userRatingCount||0)-(a.userRatingCount||0)));
  // cap per category for variety, fill to 24
  const perCat={}, chosen=[];
  for(const g of kept){ if(chosen.length>=24) break; const lab=catOf(g).label; perCat[lab]=(perCat[lab]||0); if(perCat[lab]>=6) continue; perCat[lab]++; chosen.push(g); }
  for(const g of kept){ if(chosen.length>=24) break; if(!chosen.includes(g)) chosen.push(g); }  // top up if categories were sparse

  const acts=[];
  for(const g of chosen){
    const ph=pickPhoto(g); if(!ph) continue;
    const safeId=g.id.replace(/[^a-zA-Z0-9_-]/g,""); const dest=path.join(photosDir, safeId+".jpg");
    let photoPath=null;
    if(existsSync(dest)) photoPath=`activities/photos/${safeId}.jpg`;
    else { try{ await downloadPhoto(KEY, ph.name, dest); photoPath=`activities/photos/${safeId}.jpg`; await sleep(110); }catch(e){ console.warn(`  [photo skip] ${g.displayName?.text}: ${e.message}`); } }
    if(!photoPath) continue;
    acts.push(buildActivity(g, city, photoPath));
  }
  const cats=[...new Set(acts.map(a=>a.cat))];
  console.log(`  → ${acts.length} activities · ${acts.filter(a=>a.free).length} free · cats: ${cats.join(", ")}`);
  return acts;
}

async function main(){
  const KEY=await loadKey();
  if(!KEY){ console.error("No key — set GOOGLE_PLACES_KEY or ~/dopamine-app/.env"); process.exit(1); }
  if(/^(paste|your)/i.test(KEY) || KEY.length<30){ console.error("That looks like a placeholder, not a real key."); process.exit(1); }
  const args=process.argv.slice(2), force=args.includes("--force"), ids=args.filter(x=>x!=="--force");
  const cities=ids.length?CITIES.filter(c=>ids.includes(c.id)):CITIES;
  await mkdir("activities/photos", { recursive:true });
  let baked=0, skipped=0, failed=0;
  for(const city of cities){
    const out=`activities/${city.id}.json`;
    if(!force && existsSync(out)){ console.log(`[${city.id}] skip — exists`); skipped++; continue; }
    try{ const acts=await bakeCity(KEY, city, "activities/photos"); await writeFile(out, JSON.stringify(acts)); baked++; }
    catch(e){ console.error(`[${city.id}] ERROR: ${e.message}`); failed++; }
    await sleep(250);
  }
  console.log(`\nDone. baked ${baked} · skipped ${skipped} · failed ${failed}`);
  console.log("Commit activities/, bump sw.js CACHE, push.");
}
main().catch(e=>{ console.error(e); process.exit(1); });
