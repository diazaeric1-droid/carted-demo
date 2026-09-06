// Run: node --test mort-system.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createEngine,localNight,nextNight,CITY_CUISINES,POSTCARDS}=require('./mort-system.js');

function fixture(options={}) {
  let now=new Date(2026,8,6,21).getTime(), saves=0, failing=false;
  const stats={capsuleTokens:7,capsuleOwned:['cap'],fitsSeen:['shades'],fit:'cap',savedUsd:1234,ghostName:'Mimi',...options.stats};
  const cities=Object.keys(CITY_CUISINES).map(id=>({id,name:id}));
  const adapter={getStats:()=>stats,getCities:()=>cities,getHistory:()=>options.history||[],now:()=>now,save:()=>{saves++;return !failing;}};
  const engine=createEngine(adapter);
  return {engine,stats,adapter,cities,init:()=>engine.init(),setTime:date=>{now=date.getTime();},failSave:value=>{failing=value;},saves:()=>saves};
}

test('grandfathers recorded nights once without minting coins or discarding legacy ownership',()=>{
  const f=fixture({history:['2026-08-02','2026-08-02','bad','2026-99-88','2031-01-01','2026-08-04']});
  assert(f.init().ok);
  assert.equal(f.engine.progress().count,2);
  assert.equal(f.stats.capsuleTokens,7);
  assert.deepEqual(f.stats.capsuleOwned,['cap']);
  assert.deepEqual(f.stats.fitsSeen,['shades']);
  assert.equal(f.stats.fit,'cap');
  assert.equal(f.engine.fit(),null);
  assert.equal(f.stats.ghostName,'Mimi');
  f.init();
  assert.equal(f.engine.progress().count,2);
  assert.equal(f.stats.capsuleTokens,7);
});

test('three stable optional quests earn at most three claimed coins in a local night',()=>{
  const f=fixture(); f.init();
  const e=f.engine, initial=e.quests();
  assert.equal(initial.length,3);
  assert(initial.every(q=>!q.ready&&!q.claimed));
  assert.equal(e.claim('delivery').reason,'incomplete');
  assert.equal(e.recordCity('not-a-city').reason,'city');
  const day=e.day();
  assert(e.recordCity(day.cityId).ok);
  assert.equal(e.progress().count,1);
  assert.equal(e.recordCity(day.cityId).changed,false);
  assert(e.claim('city').ok);
  assert.equal(e.claim('city').reason,'claimed');
  const order={items:[{en:day.cuisine,_cityId:'nyc'},{en:'other cuisine',_cityId:'la'}],total:1000000000};
  assert(e.recordDelivery(order).ok);
  assert(e.claim('food').ok);
  assert(e.claim('delivery').ok);
  assert.equal(f.stats.capsuleTokens,10);
  for(let i=0;i<20;i++){
    e.recordDelivery(order);e.recordCity(day.cityId);
    e.claim('food');e.claim('delivery');e.claim('city');
  }
  assert.equal(f.stats.capsuleTokens,10);
  assert.equal(e.progress().count,1);
  assert.deepEqual(e.quests().map(x=>[x.title,x.cityId]),initial.map(x=>[x.title,x.cityId]));
  assert.equal(f.stats.savedUsd,1234);
});

test('a matching item anywhere in a multi-city completed order satisfies the food quest',()=>{
  const f=fixture();f.init(); const e=f.engine;
  e.recordDelivery({items:[{en:'unrelated',_cityId:'nyc'},{en:e.day().cuisine.replace(/ /g,'_'),_cityId:'la'}]});
  assert(e.quests().find(q=>q.id==='food').ready);
  assert(e.quests().find(q=>q.id==='delivery').ready);
  assert(!e.quests().find(q=>q.id==='city').ready,'delivery is not a substitute for a menu visit');
  assert.deepEqual(e.progress().cities,['nyc','la']);
});

test('a replay may finish an unfinished cuisine quest but cannot duplicate rewards',()=>{
  const f=fixture();f.init();const e=f.engine;
  e.recordDelivery({id:'one',items:[{en:'unrelated'}]});
  assert(e.claim('delivery').ok);
  assert.equal(e.claim('food').reason,'incomplete');
  e.recordDelivery({id:'two',rerun:true,items:[{en:e.day().cuisine}]});
  assert(e.claim('food').ok);
  assert.equal(e.claim('delivery').reason,'claimed');
  assert.equal(f.stats.capsuleTokens,9);
});

test('local 4am rollover creates fresh quests but preserves all visits, outfits and coins',()=>{
  const f=fixture();f.init();const e=f.engine;
  e.recordCity(e.day().cityId);e.claim('city');e.buy('rain');
  f.setTime(new Date(2026,8,7,3,59));
  assert.equal(e.night(),'2026-09-06');
  assert(e.quests()[0].claimed);
  f.setTime(new Date(2026,8,7,4,0));
  assert.equal(e.night(),'2026-09-07');
  assert(e.quests().every(q=>!q.claimed&&!q.ready));
  assert.equal(e.progress().count,1);
  assert.equal(f.stats.capsuleTokens,4);
  assert.equal(e.fit().id,'rain');
  f.setTime(new Date(2026,8,14,20));
  e.recordCity(e.day().cityId);
  assert.equal(e.progress().count,2);
  assert.equal(e.fit().id,'rain');
  assert.equal(f.stats.capsuleTokens,4);
});

test('returning to an earlier night cannot reclaim its coins',()=>{
  const f=fixture();f.init();const e=f.engine;
  e.recordCity(e.day().cityId);e.claim('city');
  f.setTime(new Date(2026,8,7,20));
  e.recordCity(e.day().cityId);e.claim('city');
  f.setTime(new Date(2026,8,6,20));
  assert.equal(e.claim('city').reason,'claimed');
  assert.equal(f.stats.capsuleTokens,9);
  assert.equal(e.progress().count,2);
});

test('quiet cup, public posting, login and empty orders cannot earn progress',()=>{
  const f=fixture();f.init();const e=f.engine;
  for(const kind of ['cup','room','table','login','open','anything']) assert.equal(e.recordVisit(kind).changed,false);
  assert.equal(e.recordDelivery({items:[]}).reason,'order');
  assert.equal(e.recordDelivery(null).reason,'order');
  assert.equal(e.progress().count,0);
  assert.equal(f.stats.capsuleTokens,7);
});

test('outfits have exact fixed prices, no duplicate purchases and no negative balance',()=>{
  const f=fixture();f.init();const e=f.engine;
  assert(e.buy('rain').ok);
  assert.equal(f.stats.capsuleTokens,3);
  assert.equal(e.fit().id,'rain');
  assert.equal(e.buy('rain').reason,'owned');
  assert.equal(e.buy('stars').reason,'coins');
  assert.equal(e.buy('made-up-skin').reason,'outfit');
  assert.equal(f.stats.capsuleTokens,3);
  assert(e.equip('ribbon').ok);
  assert.equal(e.fit().id,'ribbon');
  assert.equal(f.stats.capsuleTokens,3);
  assert.equal(e.equip('cozy').reason,'owned');
  f.stats.fit='cap'; assert.equal(e.fit(),null);
  f.stats.fit='none'; assert.equal(e.fit().id,'classic');
  assert.deepEqual(f.stats.capsuleOwned,['cap']);
});

test('a failed save rolls back claimed coins, purchases and equip state',()=>{
  const f=fixture();f.init();const e=f.engine;
  e.recordCity(e.day().cityId);
  f.failSave(true);
  assert.equal(e.claim('city').reason,'storage');
  assert.equal(f.stats.capsuleTokens,7);
  assert(!e.quests()[0].claimed);
  assert.equal(e.buy('rain').reason,'storage');
  assert(!e.state().owned.includes('rain'));
  assert.equal(f.stats.capsuleTokens,7);
  assert.equal(f.stats.fit,'cap');
  assert.equal(e.equip('ribbon').reason,'storage');
  assert.equal(f.stats.fit,'cap');
  f.failSave(false);
  assert(e.claim('city').ok);
  assert.equal(f.stats.capsuleTokens,8);
});

test('reloading the state preserves claimed quests and purchased outfits',()=>{
  const f=fixture();f.init();const e=f.engine;
  e.recordCity(e.day().cityId);e.claim('city');e.buy('rain');
  const persisted=JSON.parse(JSON.stringify(f.stats));
  const fresh=fixture({stats:persisted});fresh.init();
  assert.equal(fresh.engine.claim('city').reason,'claimed');
  assert.equal(fresh.engine.buy('rain').reason,'owned');
  assert.equal(fresh.engine.balance(),4);
  assert.equal(fresh.engine.fit().id,'rain');
  assert.equal(fresh.engine.progress().count,1);
});

test('all 150 seeded cuisine choices exist in the 50 shipped city catalogs',()=>{
  let count=0;
  for(const [id,cuisines] of Object.entries(CITY_CUISINES)){
    const places=JSON.parse(fs.readFileSync(path.join(__dirname,'places',id+'.json'),'utf8'));
    for(const cuisine of cuisines){assert(places.some(p=>p.en===cuisine),`${id}: ${cuisine} unavailable`);count++;}
  }
  assert.equal(Object.keys(CITY_CUISINES).length,50);
  assert.equal(count,150);
});

test('every earned milestone remains unlocked without a consecutive-day requirement',()=>{
  const f=fixture();f.init();const e=f.engine;
  for(let n=0;n<30;n++){f.setTime(new Date(2026,8,6+n*2,20));e.recordCity(e.day().cityId);}
  assert.equal(e.progress().count,30);
  assert.deepEqual(e.progress().unlocked.map(m=>m.at),[1,3,5,7,14,30]);
  assert.equal(e.progress().next,null);
  assert.equal(f.stats.capsuleTokens,7,'visits do not mint unclaimed coins');
});

test('night keys switch at local 4am without UTC-date assumptions',()=>{
  assert.equal(localNight(new Date(2026,8,7,3,59)),'2026-09-06');
  assert.equal(localNight(new Date(2026,8,7,4,0)),'2026-09-07');
  assert.equal(localNight(new Date(2026,0,1,0,5)),'2025-12-31');
});

test('round-two migration preserves existing progress and does not invent old memory dates',()=>{
  const f=fixture({stats:{mortV1:{version:1,visits:['2026-08-21'],cities:['nyc','tyo'],days:{},owned:['rain'],equipped:'rain'},fit:'mort:rain'}});
  f.init();const e=f.engine;
  assert.equal(e.balance(),7);assert.equal(e.fit().id,'rain');assert.equal(e.progress().count,1);
  assert.equal(e.state().version,2);
  assert.equal(e.scrapbook().length,2);
  for(const c of e.scrapbook()){assert.equal(c.earlier,true);assert.equal(c.firstMenu,undefined);assert.equal(c.firstDelivery,undefined);}
  assert.deepEqual(e.state().capsuleOwned,undefined);assert.deepEqual(f.stats.capsuleOwned,['cap']);
});

test('scrapbook records first evidence, cuisines, favorites and real revisits without extra coins',()=>{
  const f=fixture();f.init();const e=f.engine;
  e.recordCity('nyc');e.recordDelivery({items:[{_cityId:'nyc',en:'italian'},{_cityId:'tyo',en:'japanese'}]});
  assert.equal(e.scrapbook().find(c=>c.id==='nyc').firstMenu,'2026-09-06');
  assert.equal(e.scrapbook().find(c=>c.id==='tyo').firstMenu,undefined);
  assert.equal(e.favorite('tyo').favorite,true);assert.equal(e.scrapbook()[0].id,'tyo');
  assert.equal(e.favorite('made-up').reason,'city');
  f.setTime(new Date(2026,8,9,20));e.recordCity('nyc');e.recordDelivery({items:[{_cityId:'nyc',en:'chinese'},{_cityId:'nyc',en:'italian'}]});
  const memory=e.scrapbook().find(c=>c.id==='nyc');
  assert.equal(memory.firstMenu,'2026-09-06');assert.equal(memory.firstDelivery,'2026-09-06');assert.equal(memory.lastNight,'2026-09-09');
  assert.deepEqual(memory.cuisines,['italian','chinese']);assert.equal(e.balance(),7);
  assert.equal(e.favorite('tyo').favorite,false);assert.equal(e.scrapbook().length,2);
});

test('scrapbook, favorite and decoration saves roll back if device storage fails',()=>{
  const f=fixture({history:['2026-08-01','2026-08-02','2026-08-03']});f.init();const e=f.engine;
  e.recordCity('nyc');f.failSave(true);
  assert.equal(e.favorite('nyc').reason,'storage');assert(!e.scrapbook()[0].favorite);
  assert.equal(e.recordCity('tyo').reason,'storage');assert(!e.progress().cities.includes('tyo'));
  assert.equal(e.decorate('fern').reason,'storage');assert.equal(e.state().decoration,'cup');assert.equal(e.balance(),7);
});

test('decorations are exact free permanent visit rewards independent of wallet balance',()=>{
  const f=fixture({stats:{capsuleTokens:0}});f.init();const e=f.engine;
  assert.equal(e.decorations().filter(d=>d.owned).length,1);
  assert.equal(e.decorate('fern').reason,'decoration');
  for(let i=0;i<3;i++){f.setTime(new Date(2026,8,6+i*3,20));e.recordCity('nyc');}
  assert(e.decorate('fern').ok);assert.equal(e.state().decoration,'fern');assert.equal(e.balance(),0);
  assert.equal(e.decorations().find(d=>d.id==='fern').owned,true);
  assert.equal(e.decorations().find(d=>d.id==='lantern').remaining,2);
  const restored=fixture({stats:JSON.parse(JSON.stringify(f.stats))});restored.init();
  assert.equal(restored.engine.state().decoration,'fern');assert(restored.engine.decorations().find(d=>d.id==='fern').owned);
  assert.equal(restored.engine.progress().unlocked.length,2);
});

test('postcard calendar releases Monday at 4am and never removes older stories',()=>{
  const f=fixture();f.init();const e=f.engine;
  assert.equal(e.postcards().length,3);assert.equal(e.postcards().find(p=>p.featured).id,'hello');
  assert.equal(e.readPostcard('map').reason,'postcard');
  assert(e.readPostcard('seat').ok);assert(e.postcards().find(p=>p.id==='seat').read);
  f.setTime(new Date(2026,8,7,3,59));assert.equal(e.postcards().length,3);
  f.setTime(new Date(2026,8,7,4,0));assert.equal(e.postcards().length,4);
  assert.equal(e.postcards().find(p=>p.featured).id,'map');assert(e.postcards().find(p=>p.id==='seat').read);
  f.setTime(new Date(2028,0,1,20));assert.equal(e.postcards().length,POSTCARDS.length);
  assert.equal(e.balance(),7);assert.equal(e.progress().count,0);
});

test('weekly stories are unique authored episodes with consecutive Monday dates',()=>{
  assert.equal(new Set(POSTCARDS.map(p=>p.id)).size,POSTCARDS.length);
  for(let i=0;i<POSTCARDS.length;i++){
    const p=POSTCARDS[i];assert(p.title&&p.text.length>100&&p.after);
    const date=new Date(p.week+'T12:00:00');assert.equal(date.getDay(),1);
    if(i)assert.equal((Date.parse(p.week+'T00:00:00Z')-Date.parse(POSTCARDS[i-1].week+'T00:00:00Z'))/86400000,7);
  }
});

test('planning tomorrow cannot change completed or claimed quests today',()=>{
  const f=fixture();f.init();const e=f.engine;
  e.recordCity(e.day().cityId);e.claim('city');
  const today=JSON.stringify(e.day());
  assert(e.planTomorrow('tyo','japanese').ok);assert.equal(e.tomorrow().date,'2026-09-07');
  assert.deepEqual(e.tomorrow().choice,{cityId:'tyo',cuisine:'japanese'});
  assert.equal(JSON.stringify(e.day()),today);assert.equal(e.balance(),8);
  assert(e.planTomorrow('nyc','chinese').ok);assert.equal(JSON.stringify(e.day()),today);
  f.setTime(new Date(2026,8,7,3,59));assert.equal(e.day().cityId,JSON.parse(today).cityId);
  f.setTime(new Date(2026,8,7,4,0));assert.equal(e.day().cityId,'nyc');assert.equal(e.day().cuisine,'chinese');assert(e.day().planned);
  assert(e.quests().every(q=>!q.ready&&!q.claimed));assert.equal(e.quests().length,3);assert.equal(e.balance(),8);
});

test('tomorrow plans use available city cuisine pairs and are reversible until that day starts',()=>{
  const f=fixture();f.init();const e=f.engine;
  assert.equal(e.planTomorrow('nyc','not-a-food').reason,'itinerary');assert.equal(e.planTomorrow('imaginary-city','japanese').reason,'itinerary');
  assert.equal(e.tomorrow().choice,null);
  assert(e.planTomorrow('tyo','JAPANESE').ok);assert(e.clearTomorrow().ok);assert.equal(e.tomorrow().choice,null);
  assert.equal(e.balance(),7);assert.equal(e.progress().count,0);
});

test('saved tomorrow plan survives reload and skipping it does not change the following day',()=>{
  const f=fixture();f.init();const e=f.engine;e.planTomorrow('tyo','japanese');
  const restored=fixture({stats:JSON.parse(JSON.stringify(f.stats))});restored.init();
  assert.deepEqual(restored.engine.tomorrow().choice,{cityId:'tyo',cuisine:'japanese'});
  restored.setTime(new Date(2026,8,8,20));
  assert.equal(restored.engine.day().planned,false);assert.equal(restored.engine.balance(),7);assert.equal(restored.engine.progress().count,0);
  assert.deepEqual(restored.engine.state().itineraries['2026-09-07'],{cityId:'tyo',cuisine:'japanese'});
});

test('clock rollback cannot replace or erase a previously started day itinerary',()=>{
  const f=fixture();f.init();const e=f.engine;
  e.planTomorrow('tyo','japanese');f.setTime(new Date(2026,8,7,20));e.recordCity('tyo');e.claim('city');
  const started=JSON.stringify(e.day());f.setTime(new Date(2026,8,6,20));
  assert(e.tomorrow().locked);assert.equal(e.planTomorrow('nyc','italian').reason,'started');assert.equal(e.clearTomorrow().reason,'started');
  f.setTime(new Date(2026,8,7,20));assert.equal(JSON.stringify(e.day()),started);assert.equal(e.claim('city').reason,'claimed');
});

test('failed itinerary and read-state writes roll back without changing coins',()=>{
  const f=fixture();f.init();const e=f.engine;f.failSave(true);
  assert.equal(e.planTomorrow('tyo','japanese').reason,'storage');assert.equal(e.tomorrow().choice,null);
  assert.equal(e.readPostcard('seat').reason,'storage');assert.equal(e.postcards().find(p=>p.id==='seat').read,false);
  assert.equal(e.balance(),7);
});

test('next-night itinerary keys use calendar dates across year and DST boundaries',()=>{
  assert.equal(nextNight('2026-12-31'),'2027-01-01');
  assert.equal(nextNight('2026-03-07'),'2026-03-08');assert.equal(nextNight('2026-11-01'),'2026-11-02');
});
