#!/usr/bin/env node
/* bake-fictional.mjs — generate FICTIONAL restaurants + curated activities for all 50 cities.
   Replaces the old Google Places bake (bake-places.mjs / bake-activities.mjs) entirely:
   no Google content (names, photos, ratings, reviews, coords, editorial) may ship in the app.
   Inputs:  city-packs.json (hand-authored per-city ingredients: real neighborhoods, cuisine
            weights, name flavor words, real iconic attractions with original descriptions),
            menus.json (TheMealDB dishes; photos live in menus/), index.html (CITIES + CUISINE).
   Output:  places/<id>.json + activities/<id>.json, same schema the app already reads.
   Deterministic per city (seeded RNG) so re-runs don't churn the data. */

import fs from "fs";

const src = fs.readFileSync("index.html", "utf8");
const CITIES = eval("[" + src.match(/const CITIES = \[([\s\S]*?)\n\];/)[1] + "]");
const CUISINE = eval("({" + src.match(/const CUISINE = \{([\s\S]*?)\n\};/)[1] + "})");
const packs = JSON.parse(fs.readFileSync("city-packs.json", "utf8"));
const menus = JSON.parse(fs.readFileSync("menus.json", "utf8")).byCuisine;

/* seeded RNG — mulberry32 */
function seedOf(s){ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h||1; }
function rng(seed){ let a=seed; return ()=>{ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

const PER_CITY = 44;

/* name templates by cuisine family — {W}/{W2}=flavor word, {S}=surname, {N}=generic noun */
const NOUNS = ["Kitchen","Table","Counter","Spot","Room","Joint","Corner","Club","House","Pantry"];
const FAM = {
  italian: ["Trattoria {W}","Osteria {S}","Nonna {S}'s","Cucina {W}","{W} & Basilico"],
  pizza: ["Pizzeria {W}","Forno {W}","{W} Slice Co.","Pizza {S}"],
  japanese: ["{W}-ya","Izakaya {W}","{W} Shokudo","Kissa {W}"],
  sushi: ["Sushi {W}","{W} Omakase","Sushidokoro {S}"],
  ramen: ["Menya {W}","{W} Ramen","Ramen-ya {W}"],
  noodle: ["{W} Noodle Bar","House of {W} Noodles"],
  korean: ["{W} Sikdang","Mama {S}'s","{W} Pocha","{S} Gogi House"],
  chinese: ["{W} Garden","Golden {W}","House of {W}","{S} Wok"],
  dumpling: ["{W} Dumpling House","{S}'s Dumplings"],
  mexican: ["Taquería {W}","Casa {S}","La {W} Cantina","Antojitos {S}","El {W}"],
  burrito: ["{W} Burrito Co.","El {W} Burritos"],
  french: ["Chez {S}","Bistro {W}","Café {W}","Le Petit {W}"],
  spanish: ["Bar {S}","Casa {S}","Bodega {W}","{W} y Brasa"],
  tapas: ["Tapería {W}","Bar de {S}","Pintxos {W}"],
  indian: ["{W} Masala","{S}'s Dhaba","{W} Tandoor","Spice {W}"],
  thai: ["{W} Thai Kitchen","Baan {W}","{W} Street Wok"],
  vietnamese: ["Phở {W}","{W} Quán","Bánh & {W}"],
  turkish: ["{W} Ocakbaşı","{S} Kebap","{W} Grill House"],
  lebanese: ["{S}'s Mezze","Beit {W}","{W} & Za'atar"],
  middle_eastern: ["{W} Shawarma","{S}'s Falafel","{W} Mezze Bar"],
  greek: ["Taverna {S}","{W} Souvla","To {W}"],
  moroccan: ["Riad {W}","Dar {S}","{W} Tagine House"],
  pub: ["The {W} & {W2}","The {W} Arms","{W} Tavern"],
  fish_and_chips: ["The {W} Fryer","{S}'s Chippy","{W} & Chips"],
  german: ["Zum {W}","{S}'s Bierhaus","Wirtshaus {W}"],
  portuguese: ["Tasca {W}","Casa {S}","O {W}"],
  peruvian: ["Cevichería {W}","{S}'s Cocina","{W} Criollo"],
  ethiopian: ["{W} Injera House","Mama {S}'s"],
  indonesian: ["Warung {W}","{W} Sambal House"],
  seafood: ["{W} & Bone","The {W} Oyster Room","{S}'s Fish House"],
  steak_house: ["{S} & Sons Chophouse","The {W} Cut"],
  bbq: ["{S}'s Smokehouse","{W} Smoke & Ash"],
  burger: ["{W} Burger Co.","Stack'd {W}","{S} Patty Club"],
  american: ["Blue {W} Diner","The {W} Counter","{S}'s All-Night"],
  fast_food: ["{W} Express","Quick {W}"],
  breakfast: ["{S}'s Diner","The {W} Griddle","Sunny {W}"],
  brunch: ["{W} & Yolk","The {W} Brunch Room"],
  bakery: ["{W} & Crumb","The {W} Bakehouse","{S}'s Ovens"],
  dessert: ["Sweet {W}","{W} Sugar Bar"],
  ice_cream: ["{W} Scoops","Frozen {W}"],
  donut: ["{W} Donut Club","Hole in {W}"],
  vegan: ["{W} Greens","The {W} Root","{W} & Sprout"],
  vegetarian: ["{W} Garden Table","Green {W}"],
  salad: ["{W} Greens Bar","Crunch {W}"],
  mediterranean: ["{W} Mezze Bar","{S}'s Mediterranean"],
  asian: ["{W} Night Wok","{W} Hawker Room"],
};
const DEF_TPL = ["The {W} {N}","{S}'s Kitchen","{W} House","{W} & {W2}"];

/* famous real-brand tokens — never let a generated name collide with these */
const DENY = ["kitsune","nobu","ippudo","ichiran","katz","momofuku","dishoom","nando","chipotle","shake shack",
  "in-n-out","五右衛門","din tai fung","tim ho wan","jollibee","paul","ladurée","laduree","fauchon","hakkasan",
  "zuma","carbone","balthazar","gjelina","noma","alinea","osteria francescana","joe's pizza","grimaldi",
  "roberta","l'industrie","lombardi","peter luger","gaggan","narisawa","quintonil","pujol","central","maido",
  "asador etxebarri","mugaritz","arzak","disfrutar","tickets","el celler","septime","pierre herme","cedric grolet"];
function denied(name){ const n=name.toLowerCase(); return DENY.some(d=>n.includes(d)); }

const DESC = [
  "tiny {hood} counter where the {dish} sells out before midnight.",
  "neighborhood favorite — {dish} and loud regulars till late.",
  "the {hood} late-night classic. cash-only energy, worth it.",
  "family-run since forever; the {dish} is the whole point.",
  "steamy windows, short menu, {dish} that fixes bad days.",
  "half the {hood} is in here at 1am. order the {dish}.",
  "no sign, no fuss — just {dish} done properly.",
  "the line moves fast and the {dish} moves faster.",
  "locals argue about everything except the {dish} here.",
  "small room, big pans, {dish} you'll dream about.",
  "open way too late, in the best way. get the {dish}.",
  "a {hood} institution. the {dish} never changed and never should.",
  "third-generation recipe, first-rate {dish}.",
  "looks like nothing, tastes like everything. {dish} first.",
  "the kind of place you text people about. start with the {dish}.",
  "counter seats only — watch your {dish} happen.",
];

function fill(tpl, ctx){ return tpl.replace("{W2}", ctx.w2).replace("{W}", ctx.w).replace("{S}", ctx.s).replace("{N}", ctx.n); }

function genCity(city){
  const pack = packs.find(p=>p.id===city.id);
  if(!pack){ console.error("no pack for", city.id); return; }
  const r = rng(seedOf("carted-fic-" + city.id));
  const pickR = a => a[Math.floor(r()*a.length)];
  const pool = [];
  pack.cuisines.forEach(c=>{ if(menus[c.key] || CUISINE[c.key]) for(let i=0;i<c.w;i++) pool.push(c.key); });
  const used = new Set(), places = [];
  let guard = 0;
  while(places.length < PER_CITY && guard++ < PER_CITY*30){
    const key = pickR(pool);
    const meta = CUISINE[key] || { ic:"🍽️", base:15 };
    const tpls = FAM[key] || DEF_TPL;
    const ctx = { w:pickR(pack.flavor.words), w2:pickR(pack.flavor.words), s:pickR(pack.flavor.surnames), n:pickR(NOUNS) };
    if(ctx.w2===ctx.w) ctx.w2 = pickR(pack.flavor.words);
    const name = fill(pickR(r()<0.82 ? tpls : DEF_TPL), ctx);
    if(used.has(name.toLowerCase()) || denied(name)) continue;
    used.add(name.toLowerCase());
    const mains = (menus[key]||[]).filter(m=>m.photo);
    const sig = mains.length ? pickR(mains) : null;
    const lvl = Math.min(4, Math.max(1, Math.round((meta.base/9) + (r()*1.6-0.8)) ));
    const usd = meta.base * (0.75 + 0.28*lvl) * (0.9 + r()*0.35);
    const price = city.cur.dec===0 ? Math.round(usd*city.pf/10)*10 || Math.round(usd*city.pf) : Math.round(usd*city.pf*100)/100;
    const rate = Math.round((3.7 + Math.pow(r(),1.6)*1.2)*10)/10;
    const n = Math.round(Math.pow(10, 1.6 + r()*2.0));
    const hood = pickR(pack.hoods);
    places.push({
      _key: `f_${city.id}_${places.length}`,
      _cityId: city.id, _cityName: city.name, _flag: city.flag, _cur: city.cur,
      ic: meta.ic, name,
      hood,
      dish: sig ? sig.name : meta.dish,
      en: key.replace(/_/g," "),
      rate: Math.min(4.9, rate), n,
      price, lvl,
      lat: city.lat + (r()*2-1)*0.035,
      lng: city.lng + (r()*2-1)*0.045,
      desc: fill(pickR(DESC).replace("{hood}", hood).replace("{dish}", sig?sig.name:meta.dish), ctx),
      photo: sig ? sig.photo : null,
      fictional: true,
    });
  }
  fs.writeFileSync(`places/${city.id}.json`, JSON.stringify(places));

  const acts = pack.attractions.map((a,i)=>({
    _key: `fa_${city.id}_${i}`,
    _cityId: city.id, _cityName: city.name, _flag: city.flag,
    name: a.name, cat: a.cat, ic: a.ic,
    free: !!a.free, costUsd: a.costUsd||0,
    who: a.who && a.who.length ? a.who : ["friends"],
    pet: !!a.pet,
    rate: Math.round((4.4 + r()*0.5)*10)/10,
    n: Math.round(Math.pow(10, 2.4 + r()*1.6)),
    desc: a.desc, hood: city.name,
    lat: city.lat + (r()*2-1)*0.03, lng: city.lng + (r()*2-1)*0.04,
    photo: null,
  }));
  fs.writeFileSync(`activities/${city.id}.json`, JSON.stringify(acts));
  return { places: places.length, acts: acts.length };
}

let totP=0, totA=0;
for(const c of CITIES){ const out=genCity(c); if(out){ totP+=out.places; totA+=out.acts; } }
console.log(`baked ${totP} fictional restaurants + ${totA} curated activities across ${CITIES.length} cities`);
