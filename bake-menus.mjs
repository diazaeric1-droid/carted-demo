#!/usr/bin/env node
// bake-menus.mjs — pull REAL dish names + photos per cuisine from TheMealDB (free, keyless)
// into menus.json + menus/<id>.jpg, so every restaurant's menu shows real, photographed dishes.
//
//   node bake-menus.mjs
//
// Why TheMealDB and not the restaurants' real menus: Google Places API has no menu endpoint,
// and scraping DoorDash/UberEats/Yelp violates their ToS + breaks constantly. TheMealDB is a
// free community recipe DB (dish name + food photo + cuisine) — license is fine for a demo with
// attribution. Menus are city-agnostic here; the client prices each dish per city at render.
// Accuracy is moot anyway — you can't order. This is the "dish or two with a photo" layer.

import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const API = "https://www.themealdb.com/api/json/v1/1";
const sleep = ms => new Promise(r => setTimeout(r, ms));

// app cuisine key -> { area?, cat? } TheMealDB source(s). Cuisines absent here fall back to
// the client's procedural menu (still believable, just no real photo).
const SRC = {
  italian:{area:"Italian"}, pizza:{area:"Italian"},
  american:{cat:"Beef"}, burger:{cat:"Beef"}, fast_food:{cat:"Chicken"}, // TheMealDB "American" area is empty on the free key
  bbq:{cat:"Beef"}, barbecue:{cat:"Beef"}, steak_house:{cat:"Beef"},
  mexican:{area:"Mexican"}, burrito:{area:"Mexican"},
  japanese:{area:"Japanese"}, sushi:{area:"Japanese"}, ramen:{area:"Japanese"},
  chinese:{area:"Chinese"}, noodle:{area:"Chinese"}, asian:{area:"Chinese"}, dumpling:{area:"Chinese"},
  thai:{area:"Thai"}, vietnamese:{area:"Vietnamese"},
  korean:{area:"Japanese"}, // TheMealDB Korean coverage is thin; Japanese reads as the closest E-Asian proxy
  indian:{cat:"Chicken"},   // "Indian" area empty on free key; Chicken category is curry-heavy
  seafood:{cat:"Seafood"}, fish_and_chips:{area:"British"}, pub:{area:"British"},
  french:{area:"French", cat:"Miscellaneous"}, greek:{area:"Greek"}, spanish:{area:"Spanish"}, tapas:{area:"Spanish"},
  turkish:{area:"Turkish"}, lebanese:{area:"Turkish"}, mediterranean:{area:"Greek"},
  middle_eastern:{area:"Egyptian"}, moroccan:{area:"Moroccan"},
  portuguese:{area:"Portuguese"}, german:{cat:"Pork"},
  vegan:{cat:"Vegetarian"}, vegetarian:{cat:"Vegetarian"}, salad:{cat:"Vegetarian"},
  breakfast:{cat:"Breakfast"}, brunch:{cat:"Breakfast"},
  dessert:{cat:"Dessert"}, ice_cream:{cat:"Dessert"}, bakery:{cat:"Dessert"}, donut:{cat:"Dessert"},
  indonesian:{area:"Malaysian"}, peruvian:{area:"Mexican"}, ethiopian:{area:"Moroccan"},
};
const PER = 8; // dishes per cuisine

async function fetchOne(url){ const res = await fetch(url); if(!res.ok) throw new Error(`${url} -> ${res.status}`); return (await res.json()).meals || []; }
async function fetchSource(src){
  // try area first, fall back to category if the area is empty (free key has gaps)
  let meals = [];
  if(src.area){ meals = await fetchOne(`${API}/filter.php?a=${encodeURIComponent(src.area)}`); }
  if(!meals.length && src.cat){ await sleep(120); meals = await fetchOne(`${API}/filter.php?c=${encodeURIComponent(src.cat)}`); }
  return meals;
}

async function download(url, dest){
  const res = await fetch(url); if(!res.ok) throw new Error("img "+res.status);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function main(){
  await mkdir("menus", { recursive: true });
  const cache = {};                          // source key -> meals[]
  const byCuisine = {};
  let imgs = 0;

  for(const [cuisine, src] of Object.entries(SRC)){
    const sk = src.area ? "a:"+src.area : "c:"+src.cat;
    if(!cache[sk]){
      try { cache[sk] = await fetchSource(src); await sleep(150); }
      catch(e){ console.warn(`[${cuisine}] source ${sk} failed: ${e.message}`); cache[sk]=[]; }
    }
    const meals = cache[sk].slice();
    // spread the picks across the list so cuisines sharing a source don't all get the same 8
    const seed = [...cuisine].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,0);
    const picks = [];
    for(let i=0; i<meals.length && picks.length<PER; i++){
      picks.push(meals[(i + seed) % meals.length]);
    }
    const dishes = [];
    for(const m of picks){
      if(dishes.some(d=>d.id===m.idMeal)) continue;
      const dest = path.join("menus", m.idMeal + ".jpg");
      let photo = null;
      if(existsSync(dest)) photo = "menus/" + m.idMeal + ".jpg";
      else if(m.strMealThumb){
        try { await download(m.strMealThumb + "/preview", dest); photo = "menus/" + m.idMeal + ".jpg"; imgs++; await sleep(80); }
        catch(e){ /* skip photo, keep name */ }
      }
      const kind = (src.cat === "Dessert") ? "dessert" : "main";
      dishes.push({ id:m.idMeal, name:m.strMeal, photo, kind });
    }
    byCuisine[cuisine] = dishes;
    console.log(`[${cuisine}] ${dishes.length} dishes (${dishes.filter(d=>d.photo).length} photos) from ${sk}`);
  }

  await writeFile("menus.json", JSON.stringify({ source:"TheMealDB (CC, themealdb.com)", byCuisine }));
  console.log(`\nDone. ${Object.keys(byCuisine).length} cuisines, ${imgs} new photos -> menus.json + menus/`);
  console.log("Commit menus.json + menus/, bump sw.js CACHE, push.");
}
main().catch(e=>{ console.error(e); process.exit(1); });
