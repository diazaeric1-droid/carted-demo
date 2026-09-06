/* Mort's counter. Local, permanent progress; optional, fixed-price cosmetics.
 * Contract: call init after stats restore; recordCity only after opening a real
 * restaurant menu, recordDelivery only after the pretend delivery completes.
 * No network calls, login rewards, spending rewards, streak resets or IAP. */
(function (root) {
  'use strict';

  const VERSION = 2;
  const DECORATIONS = Object.freeze([
    {id:'cup',at:0,name:'The good mug',line:'A little cup. The handle is just for show.'},
    {id:'fern',at:3,name:'Window fern',line:'He waters it with an imaginary teaspoon.'},
    {id:'lantern',at:5,name:'Paper lantern',line:'A small light for a very small courier.'},
    {id:'letters',at:7,name:'Postcard string',line:'Good memories, held up by tiny pegs.'},
    {id:'moon',at:14,name:'Pocket moon',line:'Not the actual moon. He checked.'},
    {id:'boat',at:30,name:'Receipt boat',line:'Officially seaworthy. In imaginary water.'}
  ]);
  // Authored episodes, not AI-generated personal messages or a global poll.
  // Release dates are calendar weeks (local 4 a.m.); older cards never expire.
  const POSTCARDS = Object.freeze([
    {id:'seat',week:'2026-08-17',title:'The window seat',mark:'window',text:'I tried every chair before you got here. One wobbled. One squeaked. One was already occupied by my bag. I picked the window seat for you. I will hover.',after:'A place can feel like yours before you ever sit down.'},
    {id:'napkin',week:'2026-08-24',title:'The spare napkin',mark:'boat',text:'I packed one napkin for the soup and one for emergencies. Then I folded the emergency napkin into a boat. The soup is imaginary. The boat is extremely important.',after:'A small adventure does not need a very big reason.'},
    {id:'hello',week:'2026-08-31',title:'Practicing hello',mark:'star',text:'I practiced saying hello into an empty cup. It echoed back as boo. I tried it more politely. Still boo. If I say boo when you arrive, please know I worked very hard on it.',after:'Sometimes a funny little hello is the right one.'},
    {id:'map',week:'2026-09-07',title:'The smallest map',mark:'map',text:'I drew a map on the back of a receipt. The cities are dots. The oceans are mostly coffee rings. There is a star beside the place you picked. That part is accurate.',after:'Tomorrow can be one little place you are curious about.'},
    {id:'plant',week:'2026-09-14',title:'A leaf named Leaf',mark:'fern',text:'The fern grew a new leaf. I named it Leaf. This is also the name of its three siblings. They seem comfortable with the arrangement. I turned the pot so everyone can see the window.',after:'There are lots of good ways to grow slowly.'},
    {id:'rain',week:'2026-09-21',title:'Puddle inspection',mark:'rain',text:'The rain boots arrived. I wore them outside, hovered over a puddle, and waited. The puddle did not come up to meet me. Very disappointing boots. Excellent puddle.',after:'Not every adventure needs to go according to plan.'},
    {id:'star',week:'2026-09-28',title:'A spare star',mark:'star',text:'I found something shiny in my delivery bag. It might be a star. It might be a very confident crumb. I put it on the counter so we can have a proper look together.',after:'Tiny things are allowed to be interesting.'},
    {id:'scarf',week:'2026-10-05',title:'The scarf problem',mark:'cup',text:'Someone knitted me a scarf. I do not have a neck, exactly. We made it work. There is enough left over to keep the mug warm. The mug looks very pleased.',after:'Cozy is better when there is a little extra to share.'},
    {id:'letters',week:'2026-10-12',title:'Post for the postbox',mark:'letter',text:'I wrote a thank-you note to the postbox for looking after all my postcards. Then I put it inside the postbox. I hope someone explains that it is already at the right address.',after:'A thank-you can be small and still mean something.'},
    {id:'lantern',week:'2026-10-19',title:'The little light',mark:'lantern',text:'The lantern came with instructions. Step one: place somewhere nice. I considered several important locations. Then I put it next to your chair. The instructions were right.',after:'A familiar corner can make an ordinary evening softer.'},
    {id:'moon',week:'2026-10-26',title:'Moon delivery',mark:'moon',text:'For a moment I thought the moon was following my delivery route. Then I realized I was following its. We finished the shift together. I gave it five stars. It already had quite a few.',after:'You can take the scenic route, even in your imagination.'},
    {id:'home',week:'2026-11-02',title:'Nothing urgent',mark:'window',text:'Today I polished the good mug, straightened the postcards, and moved the fern half an inch to the left. Nothing urgent happened. I thought you might like a postcard about that, too.',after:'An ordinary evening is welcome here.'}
  ]);
  const OUTFITS = Object.freeze([
    { id: 'classic', name: 'Little courier', price: 0, frame: 0, line: 'One small ghost. An unnecessarily large satchel.' },
    { id: 'ribbon', name: 'A little bow', price: 0, frame: 0, line: 'Dressed up for absolutely no occasion.' },
    { id: 'rain', name: 'Rainy courier', price: 4, frame: 1, line: 'Rain boots. Still hovering above every puddle.' },
    { id: 'stars', name: 'Stargazer', price: 6, frame: 2, line: 'Keeping a spare star in the delivery bag.' },
    { id: 'cozy', name: 'Cozy night', price: 8, frame: 3, line: 'A scarf, a warm cup, and nowhere to rush.' }
  ]);
  const MILESTONES = Object.freeze([
    { at: 1, id: 'badge', name: 'A place of your own', icon: '✉', story: 'He wrote your name on a place card. Then checked the spelling three times.' },
    { at: 3, id: 'hat', name: 'The tiny hat incident', icon: '♧', story: 'He found a hat. It fell straight through him. The bow is staying on, though.' },
    { at: 5, id: 'lamp', name: 'The little lamp', icon: '☀', story: 'He brought a lamp for the counter. The switch is too small for his mittens.' },
    { at: 7, id: 'scrapbook', name: 'The first scrapbook page', icon: '▤', story: 'Seven little visits. He taped the receipts into a book, even the blank ones.' },
    { at: 14, id: 'window', name: 'A window for watching rain', icon: '☂', story: 'He picked the window seat. Now the imaginary rain has an audience.' },
    { at: 30, id: 'jacket', name: 'Official little courier', icon: '☆', story: 'The jacket says OFFICIAL COURIER. He keeps looking down to make sure it is real.' }
  ]);
  // Verified against the bundled places/*.json. Quests never depend on which
  // city happens to finish loading first. Any city's matching cuisine counts.
  const CITY_CUISINES = Object.freeze({
    ams:['indonesian','dessert','bakery'], ath:['greek','breakfast','turkish'], bcn:['dessert','mexican','tapas'],
    ber:['italian','turkish','middle eastern'], bey:['dessert','middle eastern','greek'], bkk:['japanese','thai','vietnamese'],
    bol:['italian','dessert','indian'], bom:['dessert','chinese','breakfast'], bue:['dessert','italian','spanish'],
    cai:['middle eastern','breakfast','dessert'], chi:['italian','mexican','bbq'], cph:['italian','dessert','breakfast'],
    cpt:['dessert','italian','vietnamese'], del:['dessert','indian','fast food'], dxb:['dessert','middle eastern','japanese'],
    han:['vietnamese','japanese','dessert'], hkg:['chinese','italian','bbq'], hou:['american','vietnamese','mexican'],
    ist:['dessert','turkish','middle eastern'], kul:['chinese','breakfast','japanese'], kyo:['japanese','dessert','vegan'],
    la:['mexican','japanese','vegan'], ldn:['dessert','middle eastern','breakfast'], lim:['japanese','chinese','dessert'],
    lis:['portuguese','italian','dessert'], mad:['dessert','italian','spanish'], mel:['breakfast','dessert','italian'],
    mex:['mexican','breakfast','italian'], nap:['italian','dessert','japanese'], nol:['vietnamese','dessert','breakfast'],
    nyc:['italian','american','chinese'], oax:['dessert','breakfast','ice cream'], osa:['japanese','dessert','sushi'],
    par:['italian','dessert','vietnamese'], pen:['chinese','thai','dessert'], pus:['japanese','dessert','bbq'],
    rak:['moroccan','breakfast','dessert'], rom:['italian','dessert','bakery'], sao:['japanese','dessert','middle eastern'],
    sel:['chinese','japanese','dessert'], sfo:['thai','japanese','bakery'], sgn:['dessert','vietnamese','chinese'],
    sin:['indonesian','dessert','seafood'], sse:['spanish','dessert','tapas'], syd:['chinese','dessert','breakfast'],
    tlv:['middle eastern','vegan','japanese'], tor:['middle eastern','italian','japanese'], tpe:['chinese','japanese','dessert'],
    tyo:['japanese','chinese','italian'], vie:['turkish','dessert','german']
  });
  const LINES = Object.freeze([
    'I knocked. Then remembered I can float through doors.',
    'The bag is empty. I packed it very carefully.',
    'I folded you a receipt boat. It is not seaworthy.',
    'Want the window seat? I can hover.',
    'I brought a spare napkin. For the imaginary soup.',
    'My rain boots have never touched a puddle.',
    'No rush. The moon is taking its time, too.',
    'I practiced my hello. It still came out as boo.',
    'A little adventure? I have the smallest map.',
    'The lamp and I are both pleased to see you.',
    'I found a star in my pocket. Probably a crumb.',
    'I saved you the chair that does not wobble.'
  ]);
  const safe = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const unique = xs => [...new Set(Array.isArray(xs) ? xs.filter(x => typeof x === 'string') : [])];
  const hash = value => { let h=0; for (const c of String(value)) h=(h*31+c.charCodeAt(0))>>>0; return h; };
  const coins = n => Number.isFinite(Number(n)) ? Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(Number(n)))) : 0;
  const normalizedCuisine = s => String(s || '').toLowerCase().trim().replace(/[_-]+/g,' ').replace(/\s+/g,' ').replace(/^barbecue$/,'bbq');
  function localNight(now) {
    const d=new Date(now == null ? Date.now() : now);
    if(d.getHours()<4) d.setDate(d.getDate()-1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function validNight(value) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y,m,d]=value.split('-').map(Number), date=new Date(y,m-1,d,12);
    return date.getFullYear()===y && date.getMonth()===m-1 && date.getDate()===d;
  }
  function nextNight(value) {
    const [y,m,d]=value.split('-').map(Number);
    return localNight(new Date(y,m-1,d+1,12));
  }

  function createEngine(adapter) {
    const now=()=>adapter.now ? adapter.now() : Date.now();
    const night=()=>localNight(now());
    const catalog=()=> (adapter.getCities ? adapter.getCities() : Object.keys(CITY_CUISINES).map(id=>({id,name:id}))).filter(c=>c && CITY_CUISINES[c.id]);
    function state() {
      const stats=adapter.getStats();
      if(!stats.mortV1 || typeof stats.mortV1!=='object' || Array.isArray(stats.mortV1)) {
        // Grandfather past visits already credited by the old ghost system.
        // From this version on, merely opening the app earns no progress.
        const history=unique(adapter.getHistory ? adapter.getHistory() : []).filter(n=>validNight(n) && n<=night());
        stats.mortV1={version:VERSION,visits:history,days:{},owned:['classic','ribbon'],equipped:null,cities:[],firstNight:night()};
      }
      const m=stats.mortV1;
      m.version=VERSION;
      m.visits=unique(m.visits).filter(validNight);
      m.cities=unique(m.cities);
      if(!m.scrapbook || typeof m.scrapbook!=='object' || Array.isArray(m.scrapbook)) m.scrapbook={};
      // Older city stamps have no trustworthy date. Preserve them as earlier
      // memories; never fabricate an actual visit or first-delivery timestamp.
      for(const id of m.cities.filter(id=>catalog().some(c=>c.id===id))) {
        if(!m.scrapbook[id] || typeof m.scrapbook[id]!=='object' || Array.isArray(m.scrapbook[id])) m.scrapbook[id]={earlier:true,cuisines:[]};
      }
      m.favorites=unique(m.favorites).filter(id=>m.cities.includes(id));
      m.readPostcards=unique(m.readPostcards).filter(id=>POSTCARDS.some(p=>p.id===id));
      m.decorations=unique(['cup',...(Array.isArray(m.decorations)?m.decorations:[]),...DECORATIONS.filter(d=>d.at<=m.visits.length).map(d=>d.id)]).filter(id=>DECORATIONS.some(d=>d.id===id));
      if(!m.decorations.includes(m.decoration)) m.decoration='cup';
      if(!m.itineraries || typeof m.itineraries!=='object' || Array.isArray(m.itineraries)) m.itineraries={};
      m.owned=unique(['classic','ribbon',...(Array.isArray(m.owned)?m.owned:[])]).filter(id=>OUTFITS.some(o=>o.id===id));
      if(!m.days || typeof m.days!=='object' || Array.isArray(m.days)) m.days={};
      if(m.equipped && !m.owned.includes(m.equipped)) m.equipped=null;
      stats.capsuleTokens=coins(stats.capsuleTokens);
      return m;
    }
    function persist() { return adapter.save()!==false; }
    function transaction(work) {
      state();
      const s=adapter.getStats();
      const before=JSON.stringify({mortV1:s.mortV1,capsuleTokens:s.capsuleTokens,fit:s.fit});
      try {
        const result=work();
        if(result && result.changed===false) return result;
        if(!persist()) throw new Error('storage unavailable');
        return result || {ok:true};
      } catch(error) {
        const saved=JSON.parse(before);
        s.mortV1=saved.mortV1; s.capsuleTokens=saved.capsuleTokens;
        if(saved.fit===undefined) delete s.fit; else s.fit=saved.fit;
        return {ok:false,reason:'storage'};
      }
    }
    function day() {
      const m=state(), n=night();
      if(!Object.prototype.hasOwnProperty.call(m.days,n) || !m.days[n] || typeof m.days[n]!=='object') {
        const cities=catalog(), chosen=m.itineraries[n];
        const planned=chosen && cities.find(c=>c.id===chosen.cityId) && CITY_CUISINES[chosen.cityId].includes(chosen.cuisine);
        const city=planned?cities.find(c=>c.id===chosen.cityId):cities[hash(n)%cities.length] || {id:'nyc'};
        const pool=CITY_CUISINES[city.id];
        m.days[n]={cityId:city.id,cuisine:planned?chosen.cuisine:pool[hash(n+'|food')%pool.length],planned:!!planned,menus:[],cuisines:[],delivered:false,claimed:[]};
      }
      const d=m.days[n];
      d.menus=unique(d.menus); d.cuisines=unique(d.cuisines).map(normalizedCuisine);
      d.claimed=unique(d.claimed).filter(id=>['city','food','delivery'].includes(id));
      return d;
    }
    function visit(kind) {
      // The quiet cup and the community never mint coins or visit rewards.
      if(!['menu','delivery'].includes(kind)) return false;
      const m=state(), n=night();
      if(m.visits.includes(n)) return false;
      m.visits.push(n); m.visits.sort(); return true;
    }
    function quests() {
      const d=day(), city=catalog().find(c=>c.id===d.cityId) || {id:d.cityId,name:d.cityId};
      return [
        {id:'city',title:`A little trip to ${city.name}`,detail:'Open one restaurant menu in this city.',ready:d.menus.includes(d.cityId),claimed:d.claimed.includes('city'),cityId:d.cityId,icon:city.flag||'↗'},
        {id:'food',title:`Tonight: ${d.cuisine}`,detail:'Include this cuisine in a completed pretend delivery. Any city counts.',ready:d.cuisines.includes(d.cuisine),claimed:d.claimed.includes('food'),cityId:d.cityId,cuisine:d.cuisine,icon:'♧'},
        {id:'delivery',title:'A delivery with your little ghost',detail:'Finish one pretend delivery. A rerun counts, too.',ready:!!d.delivered,claimed:d.claimed.includes('delivery'),icon:'✉'}
      ];
    }
    function claim(id) {
      return transaction(()=>{
        const q=quests().find(q=>q.id===id);
        if(!q || !q.ready || q.claimed) return {ok:false,reason:q&&q.claimed?'claimed':'incomplete',changed:false};
        day().claimed.push(id);
        const s=adapter.getStats(); s.capsuleTokens=Math.min(Number.MAX_SAFE_INTEGER,coins(s.capsuleTokens)+1);
        return {ok:true,amount:1,balance:s.capsuleTokens};
      });
    }
    function recordCity(city) {
      const id=typeof city==='string'?city:city && (city.id||city._cityId);
      if(!catalog().some(c=>c.id===id)) return {ok:false,reason:'city',changed:false};
      return transaction(()=>{
        const d=day(), m=state(); let changed=visit('menu');
        if(!d.menus.includes(id)){d.menus.push(id);changed=true;}
        if(remember(id,'menu')) changed=true;
        if(!m.cities.includes(id)){m.cities.push(id);changed=true;}
        return {ok:true,changed};
      });
    }
    function recordDelivery(order) {
      if(!order || !Array.isArray(order.items) || !order.items.length) return {ok:false,reason:'order',changed:false};
      return transaction(()=>{
        const d=day(); let changed=visit('delivery');
        if(!d.delivered){d.delivered=true;changed=true;}
        for(const item of order.items) {
          const cuisine=normalizedCuisine(item && (item.en || item.cuisine));
          if(cuisine && !d.cuisines.includes(cuisine)){d.cuisines.push(cuisine);changed=true;}
          const city=item && item._cityId;
          if(city && catalog().some(c=>c.id===city)) {
            if(remember(city,'delivery',cuisine))changed=true;
            if(!state().cities.includes(city)){state().cities.push(city);changed=true;}
          }
        }
        return {ok:true,changed};
      });
    }
    function remember(id,kind,cuisine) {
      const m=state(), old=JSON.stringify(m.scrapbook[id]||null);
      const entry=m.scrapbook[id]||(m.scrapbook[id]={cuisines:[]});
      const key=kind==='delivery'?'firstDelivery':'firstMenu';
      if(!validNight(entry[key]||''))entry[key]=night();
      entry.lastNight=night();entry.cuisines=unique(entry.cuisines);
      if(cuisine && !entry.cuisines.includes(cuisine))entry.cuisines.push(cuisine);
      return old!==JSON.stringify(entry);
    }
    function scrapbook() {
      const m=state();
      return m.cities.map(id=>catalog().find(c=>c.id===id)).filter(Boolean).map(city=>({
        ...city,...m.scrapbook[city.id],favorite:m.favorites.includes(city.id),cuisines:unique(m.scrapbook[city.id]?.cuisines)
      })).sort((a,b)=>Number(b.favorite)-Number(a.favorite)||String(b.lastNight||'').localeCompare(String(a.lastNight||''))||a.name.localeCompare(b.name));
    }
    function favorite(id) {
      return transaction(()=>{
        const m=state();
        if(!m.cities.includes(id)||!catalog().some(c=>c.id===id))return {ok:false,reason:'city',changed:false};
        const selected=!m.favorites.includes(id);
        m.favorites=selected?[...m.favorites,id]:m.favorites.filter(x=>x!==id);
        return {ok:true,favorite:selected};
      });
    }
    function postcards() {
      const m=state(), available=POSTCARDS.filter(p=>p.week<=night());
      return available.map(p=>({...p,read:m.readPostcards.includes(p.id),featured:p.id===available[available.length-1]?.id}));
    }
    function readPostcard(id) {
      return transaction(()=>{
        const p=postcards().find(p=>p.id===id);
        if(!p)return {ok:false,reason:'postcard',changed:false};
        if(p.read)return {ok:true,changed:false};
        state().readPostcards.push(id);return {ok:true};
      });
    }
    function decorations() {
      const m=state();return DECORATIONS.map(d=>({...d,owned:m.decorations.includes(d.id),equipped:m.decoration===d.id,remaining:Math.max(0,d.at-m.visits.length)}));
    }
    function decorate(id) {
      return transaction(()=>{
        const m=state();
        if(!m.decorations.includes(id))return {ok:false,reason:'decoration',changed:false};
        if(m.decoration===id)return {ok:true,changed:false};
        m.decoration=id;return {ok:true};
      });
    }
    function tomorrow() {
      const date=nextNight(night()), choice=state().itineraries[date];
      const valid=choice && catalog().some(c=>c.id===choice.cityId)&&CITY_CUISINES[choice.cityId].includes(choice.cuisine);
      return {date,choice:valid?{cityId:choice.cityId,cuisine:choice.cuisine}:null,locked:!!state().days[date]};
    }
    function planTomorrow(cityId,cuisine) {
      cuisine=normalizedCuisine(cuisine);
      return transaction(()=>{
        const t=tomorrow();
        if(t.locked)return {ok:false,reason:'started',changed:false};
        if(!catalog().some(c=>c.id===cityId)||!CITY_CUISINES[cityId].includes(cuisine))return {ok:false,reason:'itinerary',changed:false};
        state().itineraries[t.date]={cityId,cuisine};return {ok:true,date:t.date};
      });
    }
    function clearTomorrow() {
      return transaction(()=>{
        const t=tomorrow();if(t.locked)return {ok:false,reason:'started',changed:false};
        if(!t.choice)return {ok:true,changed:false};
        delete state().itineraries[t.date];return {ok:true};
      });
    }
    function buy(id) {
      return transaction(()=>{
        const item=OUTFITS.find(o=>o.id===id), m=state(), s=adapter.getStats();
        if(!item) return {ok:false,reason:'outfit',changed:false};
        if(m.owned.includes(id)) return {ok:false,reason:'owned',changed:false};
        if(coins(s.capsuleTokens)<item.price) return {ok:false,reason:'coins',changed:false};
        s.capsuleTokens=coins(s.capsuleTokens)-item.price; m.owned.push(id);
        m.equipped=id; s.fit='mort:'+id;
        return {ok:true,balance:s.capsuleTokens,item};
      });
    }
    function equip(id) {
      return transaction(()=>{
        if(!state().owned.includes(id)) return {ok:false,reason:'owned',changed:false};
        state().equipped=id; adapter.getStats().fit='mort:'+id;
        return {ok:true};
      });
    }
    function progress() {
      const m=state(), count=m.visits.length, next=MILESTONES.find(x=>x.at>count) || null;
      return {count,nights:count,next,remaining:next?next.at-count:0,unlocked:MILESTONES.filter(x=>x.at<=count),cities:m.cities.slice(),visitedTonight:m.visits.includes(night())};
    }
    function fit() {
      const s=adapter.getStats(), m=state();
      // An old wardrobe selection still wins if the legacy drawer changed it.
      if(s.fit && !String(s.fit).startsWith('mort:') && s.fit!=='none') return null;
      const id=s.fit==='none'?'classic':String(s.fit||'').startsWith('mort:')?String(s.fit).slice(5):m.equipped;
      return OUTFITS.find(o=>o.id===id && m.owned.includes(id)) || OUTFITS[0];
    }
    return {state,day,quests,claim,recordCity,recordDelivery,buy,equip,progress,fit,night,
      scrapbook,favorite,postcards,readPostcard,decorations,decorate,tomorrow,planTomorrow,clearTomorrow,
      balance:()=>coins(adapter.getStats().capsuleTokens),
      init:()=>transaction(()=>{day();return {ok:true};}),
      recordVisit:kind=>transaction(()=>({ok:true,changed:visit(kind)}))};
  }

  if(typeof module==='object' && module.exports) module.exports={createEngine,localNight,validNight,nextNight,OUTFITS,MILESTONES,CITY_CUISINES,DECORATIONS,POSTCARDS};
  if(!root.document) return;

  const doc=root.document;
  let engine=null, initialized=false, modal=null, previousFocus=null, previousOverflow='', preview='classic';
  let panel='counter', focusMap=[], pendingRoute=0, routeTimer=null, spriteRequested=false;
  let postcardId=null, decorationPreview='cup', planDraft=null;
  const getStats=()=>typeof stats!=='undefined'?stats:{};
  const getCities=()=>typeof CITIES!=='undefined'?CITIES:[];
  function ensure() {
    if(!engine) engine=createEngine({getStats,getCities,
      getHistory:()=>{try{return JSON.parse(root.localStorage.getItem('carted_nights')||'[]');}catch(e){return [];}},
      save:()=>{
        try {
          root.localStorage.setItem('carted_stats',JSON.stringify(getStats()));
          if(typeof saveStats==='function') saveStats();
          return true;
        } catch(e){return false;}
      }
    });
    return engine;
  }
  function getName(){ const s=getStats(); return String(s.ghostName||'Mort').slice(0,14); }
  function measure(event,props) { try { if(typeof track==='function') track(event,props||{}); } catch(e) {} }
  function legacyFit() {
    const s=getStats(), id=s.fit||'none';
    if(id.startsWith('city:')) {
      const c=getCities().find(c=>c.id===id.slice(5));
      return {id,hat:typeof CITY_HAT!=='undefined'?CITY_HAT[id.slice(5)]||'':'',name:(c?c.name:'City')+' souvenir'};
    }
    const item=typeof CAPSULE_BY_ID!=='undefined'?CAPSULE_BY_ID[id]:null;
    return item?{id,hat:item.hat,name:item.name}:{id:'none',hat:'',name:'Little courier'};
  }
  function fit() {
    const f=ensure().fit();
    return f?{...f,id:'mort:'+f.id,styleId:f.id,hat:''}:legacyFit();
  }
  const fallback='<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M24 68C24 36 37 20 59 20s37 15 37 47l5 32-16-5-12 9-13-7-14 7-12-9-15 5z" fill="#fff7e7" stroke="#423353" stroke-width="2.6" stroke-linejoin="round"/><ellipse cx="47" cy="53" rx="3.3" ry="5" fill="#322944"/><ellipse cx="70" cy="53" rx="3.3" ry="5" fill="#322944"/><path d="M54 65q5 5 10 0" fill="none" stroke="#322944" stroke-width="2.3" stroke-linecap="round"/><ellipse cx="36" cy="64" rx="7" ry="3" fill="#f3b4ab"/><ellipse cx="82" cy="64" rx="7" ry="3" fill="#f3b4ab"/><path d="m38 74 49 15m-15-27-22 29" fill="none" stroke="#aa94cd" stroke-width="6"/><rect x="59" y="75" width="34" height="24" rx="7" fill="#b9a1dc" stroke="#6b5488" stroke-width="2"/><path d="M62 81h28l-13 8z" fill="#d8c8ee"/></svg>';
  function avatar(size,opts) {
    opts=opts||{};
    const f=opts.outfit?OUTFITS.find(o=>o.id===opts.outfit):ensure().fit();
    const selected=f||OUTFITS[0], pixels=Math.max(20,Math.min(340,Number(size)||80));
    const hat=!f?legacyFit().hat:'';
    const label=opts.decorative?'':`${getName()}, ${selected.name}`;
    return `<span class="mort-avatar mort-avatar-${safe(selected.id)}${opts.animate?' mort-float':''}" style="--mort-size:${pixels}px"${label?` role="img" aria-label="${safe(label)}"`:' aria-hidden="true"'}><span class="mort-fallback">${fallback}</span><span class="mort-art" style="background-position:${selected.frame%2?'100%':'0%'} ${selected.frame>1?'100%':'0%'}"></span>${selected.id==='ribbon'?'<span class="mort-bow"></span>':''}${hat?`<span class="mort-legacy-hat">${safe(hat)}</span>`:''}</span>`;
  }
  function line() {
    const e=ensure(), p=e.progress(), all=e.state().visits, last=all[all.length-1];
    if(last && !p.visitedTonight) {
      const old=new Date(last+'T12:00:00'), current=new Date(e.night()+'T12:00:00');
      if(current-old>3*86400000) return 'Oh, hi. Want the window seat?';
    }
    return LINES[hash(e.night()+'|mort-line')%LINES.length];
  }
  function button(action,label,cls,extras) { return `<button type="button" class="mort-button ${cls||''}" data-mort-action="${action}"${extras||''}>${label}</button>`; }
  function renderHome() {
    const e=ensure(), p=e.progress(), ready=e.quests().filter(q=>q.ready&&!q.claimed).length;
    return `<section class="mort-home" data-mort-home aria-label="${safe(getName())}'s counter"><div class="mort-home-top"><div class="mort-home-copy"><span class="mort-eyebrow">YOUR LITTLE NIGHT COURIER</span><h2>${safe(getName())} kept you a seat.</h2><p>“${safe(line())}”</p></div><button type="button" class="mort-hello" data-mort-action="hello" aria-label="Say hello to ${safe(getName())}">${avatar(112,{animate:true,decorative:true})}</button></div><div class="mort-home-footer">${button('counter',ready?`Your counter <span class="mort-dot">${ready} ready</span>`:'Your counter <span aria-hidden="true">↗</span>','mort-primary')}<span class="mort-home-progress">${p.count===0?'A small adventure starts here.':`${p.count} visit${p.count===1?'':'s'} together`}</span></div></section>`;
  }
  function scene(decoration) {
    const p=ensure().progress(), ids=p.unlocked.map(x=>x.id), f=fit();
    const decor=DECORATIONS.find(d=>d.id===(decoration||ensure().state().decoration))||DECORATIONS[0];
    return `<div class="mort-counter-scene mort-room-${decor.id}${ids.includes('window')?' mort-has-window':''}"><div class="mort-scene-stars" aria-hidden="true">✦<span>·</span>✧</div>${ids.includes('window')?'<div class="mort-window" aria-hidden="true"><i></i><i></i></div>':''}${ids.includes('lamp')?'<div class="mort-lamp" aria-label="Your little lamp"><span></span></div>':''}<div class="mort-scene-ghost">${avatar(178,{animate:true})}${ids.includes('jacket')?'<span class="mort-courier-badge" aria-label="Official little courier badge">✦ COURIER</span>':''}</div><div class="mort-scene-decoration" role="img" aria-label="${safe(decor.name)}">${doodle(decor.id)}</div><div class="mort-counter-shelf">${ids.includes('badge')?`<span class="mort-nameplate">${safe(getName())}'s counter</span>`:''}${ids.includes('hat')?'<span class="mort-scene-hat" role="img" aria-label="The tiny hat from your third visit">♧</span>':''}${ids.includes('scrapbook')?'<span class="mort-scene-book" aria-label="Your scrapbook">▤</span>':''}</div><div class="mort-scene-fit">${safe(f.name)}</div></div>`;
  }
  function questHTML(q) {
    const label=q.claimed?'Claimed ✓':q.ready?'Claim 1 coin':q.id==='delivery'?'Browse kitchens':'Take a look';
    const action=q.ready&&!q.claimed?'claim':q.claimed?'noop':'quest';
    return `<li class="mort-quest${q.claimed?' mort-quest-claimed':''}"><span class="mort-quest-icon" aria-hidden="true">${safe(q.icon)}</span><div class="mort-quest-copy"><h4>${safe(q.title)}</h4><p>${safe(q.detail)}</p><span class="mort-reward">${q.claimed?'1 coin collected':'1 coin'}</span></div>${button(action,label,q.ready&&!q.claimed?'mort-primary':'mort-quiet',` data-mort-id="${q.id}"${q.claimed?' disabled':''}`)}</li>`;
  }
  function doodle(kind) {
    const art={
      cup:'<path d="M26 42h40v22q0 18-20 18T26 64z" fill="#f6dcb9"/><path d="M67 46h7q18 12-7 25M33 90h31M37 30q-7-8 1-15m15 15q-7-8 1-15"/>',
      fern:'<path d="M38 68h29l-6 25H44z" fill="#eab3a1"/><path d="M52 69V24m0 13Q22 36 29 17q23 0 23 20m0 12q28-2 25-22-25 0-25 22m0 15q-30-1-28-23 26 3 28 23" fill="#b5cda5"/>',
      lantern:'<path d="M50 5v15M37 21h26M37 84h26M50 87v14"/><rect x="22" y="27" width="57" height="54" rx="22" fill="#f4d99b"/><path d="M40 31q-12 22 0 47m20-47q12 22 0 47M24 47h54M24 63h54"/>',
      letters:'<path d="M8 24q45 27 85 0"/><path d="m16 34 24 5-6 32-25-5z" fill="#f3b8a5"/><path d="m47 41 25-1 1 32-25 1z" fill="#e5d2a1"/><path d="m78 37 22-7 10 30-22 7z" fill="#b5cda5"/><path d="m19 46 12 3m21 6h15m29-10 6-2"/>',
      moon:'<path d="M64 18A34 34 0 1 0 86 68 34 34 0 0 1 64 18z" fill="#f4d99b"/><path d="M45 59h1m14 0h1m-13 10q5 4 9 0M86 17v12m-6-6h12"/>',
      boat:'<path d="m15 67 72 0-17 22H32z" fill="#eeb5a8"/><path d="M51 17v49H24z" fill="#fff7e6"/><path d="m55 31 20 32H55z" fill="#c9b5e7"/><path d="M18 97q12-9 23 0 12-9 23 0 12-9 23 0"/>',
      star:'<path d="m51 16 11 24 27 4-20 19 5 27-23-13-24 13 5-27-20-19 27-4z" fill="#f4d99b"/><path d="M42 54h1m17 0h1m-15 12q5 5 10 0"/>',
      map:'<path d="m14 25 24-10 28 13 25-10v65L66 93 38 80 14 90z" fill="#f6e4c4"/><path d="M38 17v61m28-48v59M25 50q12-19 27 10t24-6" stroke-dasharray="4 6"/><circle cx="78" cy="48" r="5" fill="#dc9a8c"/>',
      window:'<path d="M22 90V44a29 29 0 0 1 58 0v46z" fill="#c9b5e7"/><path d="M51 17v72M24 56h54M16 95h72"/><path d="M67 30a10 10 0 0 0 4 17 10 10 0 1 1-4-17" fill="#fff4d3"/>',
      rain:'<path d="M18 51a34 34 0 0 1 68 0q-9-9-17 0-9-9-17 0-9-9-17 0-9-9-17 0z" fill="#b5cda5"/><path d="M52 19v61q-1 16-15 7m-12-24-4 9m58-9-4 9m-15 22-3 8"/>',
      letter:'<rect x="13" y="30" width="76" height="52" rx="5" fill="#f3ddba"/><path d="m15 34 36 28 35-28M17 77l23-20m45 20L62 57"/>'
    };
    return `<svg viewBox="0 0 112 112" aria-hidden="true" fill="none" stroke="#6b5278" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${art[kind]||art.map}</svg>`;
  }
  function humanDate(n) {
    if(!validNight(n||''))return '';
    const [y,m,d]=n.split('-').map(Number);
    return new Date(y,m-1,d,12).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  }
  function hubHTML() {
    const e=ensure(), cards=e.postcards(), newest=cards[cards.length-1], tomorrow=e.tomorrow();
    const planCity=tomorrow.choice&&getCities().find(c=>c.id===tomorrow.choice.cityId);
    return `<nav class="mort-hub" aria-label="Little things with ${safe(getName())}">${button('postcards',`<span class="mort-hub-icon" aria-hidden="true">✉</span><span><strong>Postcard drawer</strong><small>${newest?safe(newest.title):'Tiny stories, kept for you'}</small></span>`,'mort-hub-card')}${button('scrapbook',`<span class="mort-hub-icon" aria-hidden="true">▤</span><span><strong>City scrapbook</strong><small>${e.scrapbook().length?`${e.scrapbook().length} imaginary stops`:'Your first page is waiting'}</small></span>`,'mort-hub-card')}${button('decorate',`<span class="mort-hub-icon" aria-hidden="true">☀</span><span><strong>Make it cozy</strong><small>Decorate your counter</small></span>`,'mort-hub-card')}${button('adventure',`<span class="mort-hub-icon" aria-hidden="true">↗</span><span><strong>Tomorrow, together</strong><small>${planCity?safe(planCity.name)+' is on the map':'Pick a little adventure'}</small></span>`,'mort-hub-card')}</nav>`;
  }
  function postcardsHTML() {
    const cards=ensure().postcards(), selected=cards.find(p=>p.id===postcardId)||cards[cards.length-1];
    if(!selected)return `<p>The postcard drawer is ready. The first letter arrives soon.</p>${button('counter','Back to your counter','mort-text')}`;
    return `<p class="mort-muted">Tiny stories from your fictional little courier. A new card each Monday through November 2. Every released card stays here—even if you miss a week.</p><article class="mort-postcard"><div class="mort-postcard-top"><span class="mort-eyebrow">${selected.featured?'THIS WEEK’S LETTER':'FROM THE DRAWER'} · ${safe(humanDate(selected.week))}</span><span class="mort-postmark" aria-hidden="true">CARTED<br>IMAGINARY POST</span></div><div class="mort-postcard-art">${doodle(selected.mark)}</div><h3>${safe(selected.title)}</h3><p>${safe(selected.text)}</p><p class="mort-postcard-sign">Your little ghost,<br><strong>${safe(getName())}</strong></p><p class="mort-postcard-after">${safe(selected.after)}</p></article><p class="mort-fine">No quest, coins, or catch-up required. Just a moment with ${safe(getName())}.</p><h3 class="mort-drawer-heading">All your postcards</h3><div class="mort-postcard-list">${cards.slice().reverse().map(p=>button('read-postcard',`<span aria-hidden="true">${p.read?'✉':'✦'}</span><span><strong>${safe(p.title)}</strong><small>${safe(humanDate(p.week))}${p.read?' · read':''}</small></span>`,p.id===selected.id?'mort-card-link mort-card-selected':'mort-card-link',` data-mort-id="${p.id}" aria-pressed="${p.id===selected.id}"`)).join('')}</div>${button('counter','Back to your counter','mort-text')}`;
  }
  function scrapbookHTML() {
    const memories=ensure().scrapbook();
    return `<div class="mort-scrapbook-intro"><span class="mort-eyebrow">LITTLE PLACES, GOOD MEMORIES</span><h3>Your imaginary passport</h3><p>Menus explored and pretend deliveries completed—not real travel or a record of what you ate. Keep favorite cities close.</p></div>${memories.length?`<div class="mort-scrapbook-grid">${memories.map(c=>`<article class="mort-memory"><div class="mort-memory-art">${doodle(['map','cup','boat','star','window'][hash(c.id)%5])}<span aria-hidden="true">${safe(c.flag||'↗')}</span></div><div class="mort-memory-title"><h4>${safe(c.name)}</h4>${button('favorite',c.favorite?'♥':'♡','mort-favorite',` data-mort-id="${c.id}" aria-pressed="${c.favorite}" aria-label="${c.favorite?'Remove':'Save'} ${safe(c.name)} ${c.favorite?'from':'to'} favorites"`)}</div><p>${c.firstMenu?`First menu · ${safe(humanDate(c.firstMenu))}`:c.earlier?'A memory from your earlier collection':'A pretend-delivery stop'}</p>${c.firstDelivery?`<p>First pretend delivery · ${safe(humanDate(c.firstDelivery))}</p>`:''}<div class="mort-memory-cuisines">${c.cuisines.slice(0,3).map(s=>`<span>${safe(s)}</span>`).join('')}${c.cuisines.length>3?`<span>+${c.cuisines.length-3} more</span>`:''}</div>${button('revisit','Wander here again ↗','mort-quiet',` data-mort-id="${c.id}"`)}</article>`).join('')}</div>`:`<div class="mort-empty-page">${doodle('map')}<h4>A blank page. A very small map.</h4><p>Open any restaurant menu to keep your first city memory. No delivery required.</p>${button('browse','Find a kitchen','mort-primary')}</div>`}<p class="mort-fine">Memories and favorites stay on this device. Browsing, favoriting, and revisiting do not award extra coins.</p>${button('counter','Back to your counter','mort-text')}`;
  }
  function decorateHTML() {
    const list=ensure().decorations(), item=list.find(d=>d.id===decorationPreview)||list[0];
    return `<p class="mort-muted">A familiar corner, made a little more yours. All decorations are free or earned with permanent visits. Your other milestones stay on display.</p>${scene(item.id)}<div class="mort-decor-caption"><span class="mort-eyebrow">${item.equipped?'ON YOUR COUNTER':'PREVIEW ONLY'}</span><h3>${safe(item.name)}</h3><p>${safe(item.line)}</p></div><div class="mort-decoration-grid" role="group" aria-label="Preview counter decorations">${list.map(d=>`<button type="button" class="mort-decoration-choice${d.id===item.id?' mort-selected':''}" data-mort-action="preview-decoration" data-mort-id="${d.id}" aria-pressed="${d.id===item.id}">${doodle(d.id)}<strong>${safe(d.name)}</strong><span>${d.owned?d.at===0?'Free · yours':'Earned · yours':`${d.at} visits together`}</span></button>`).join('')}</div><div class="mort-outfit-action">${button(item.owned?'use-decoration':'noop',item.equipped?'Already at home ✓':item.owned?'Put it on the counter':`${item.remaining} more visit${item.remaining===1?'':'s'} together`,'mort-primary',` data-mort-id="${item.id}"${item.equipped||!item.owned?' disabled':''}`)}<p class="mort-fine">${item.owned?'No coins spent. Yours to keep and change whenever you like.':'One menu visit or pretend delivery per local day counts. Missed days never reset progress.'}</p></div>${button('counter','Back to your counter','mort-text')}`;
  }
  function adventureHTML() {
    const t=ensure().tomorrow(), cities=getCities().filter(c=>CITY_CUISINES[c.id]);
    if(!planDraft||planDraft.date!==t.date)planDraft={date:t.date,...(t.choice||{cityId:cities[0]?.id||'nyc',cuisine:CITY_CUISINES[cities[0]?.id||'nyc'][0]})};
    const chosen=t.choice&&cities.find(c=>c.id===t.choice.cityId);
    return `<div class="mort-adventure-intro">${doodle('map')}<span class="mort-eyebrow">JUST YOUR LITTLE PLAN</span><h3>Where shall we wander?</h3><p>${safe(getName())} has a map. You get the pencil.</p></div>${chosen?`<div class="mort-plan-saved"><strong>On tomorrow's map: ${safe(chosen.name)}</strong><span>${safe(t.choice.cuisine)} · ${safe(humanDate(t.date))}, from 4 a.m.</span></div>`:''}<form class="mort-plan-form" data-mort-plan><label for="mort-plan-city">An imaginary city stop</label><select id="mort-plan-city" name="city"${t.locked?' disabled':''}>${cities.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<option value="${c.id}"${planDraft.cityId===c.id?' selected':''}>${safe(c.flag||'')} ${safe(c.name)}</option>`).join('')}</select><label for="mort-plan-cuisine">A cuisine to explore</label><select id="mort-plan-cuisine" name="cuisine"${t.locked?' disabled':''}>${(CITY_CUISINES[planDraft.cityId]||[]).map(c=>`<option value="${safe(c)}"${planDraft.cuisine===c?' selected':''}>${safe(c)}</option>`).join('')}</select><p class="mort-fine">Choices are available in this city's bundled menus. Your city and cuisine quests will use this plan after the next local 4 a.m. Today's quests and claims do not change.</p>${t.locked?'<p class="mort-plan-saved">That day has already started on this device. Its quests are kept unchanged.</p>':button('save-plan',chosen?'Update our plan':'Put it on the map','mort-primary')}${chosen&&!t.locked?button('clear-plan','Let Mort pick instead','mort-text'):''}</form><p class="mort-fine">A personal itinerary, not a community vote or a booking. It adds no extra quests, coins, reminders, or pressure to return. Miss the date? Nothing is lost; your regular quests continue.</p>${button('counter','Back to your counter','mort-text')}`;
  }
  function counterHTML() {
    const e=ensure(), p=e.progress(), next=p.next;
    const milestones=MILESTONES.map(m=>`<li class="mort-milestone${p.count>=m.at?' mort-milestone-unlocked':''}"><span class="mort-milestone-icon" aria-hidden="true">${m.icon}</span><div><strong>${safe(m.name)}</strong><span>${p.count>=m.at?`Here to stay · visit ${m.at}`:`At ${m.at} visits`}</span></div>${p.count>=m.at?'<span class="mort-check" aria-label="Unlocked">✓</span>':''}</li>`).join('');
    const story=p.unlocked[p.unlocked.length-1];
    return `${scene()}<p class="mort-scene-caption">“${safe(line())}”</p><div class="mort-counter-tools">${button('wardrobe','A little wardrobe <span aria-hidden="true">↗</span>','mort-quiet')}${button('rename','Name your ghost','mort-text')}</div><section class="mort-progress-card"><div class="mort-section-heading"><div><span class="mort-eyebrow">MADE OF SMALL VISITS</span><h3>${p.count} visit${p.count===1?'':'s'} together</h3></div><span class="mort-progress-star" aria-hidden="true">✦</span></div><p>${next?`${next.name} in ${p.remaining} more visit${p.remaining===1?'':'s'}.`:'Every little milestone has found a home. More adventures are always welcome.'}</p>${next?`<progress class="mort-progress" max="${next.at}" value="${p.count}" aria-label="${safe(next.name)}: ${p.count} of ${next.at} visits"></progress>`:''}<p class="mort-fine">A menu visit or pretend delivery counts once per day, resetting at 4 a.m. Missed days never take anything away.</p></section><section class="mort-quests-section"><div class="mort-section-heading"><div><span class="mort-eyebrow">A LITTLE SOMETHING TO DO</span><h3>Tonight's optional quests</h3></div><span class="mort-balance" aria-label="${e.balance()} coins">◉ ${e.balance()}</span></div><p class="mort-muted">Three tiny adventures. Up to 3 coins. Pick what sounds fun.</p><ul class="mort-quest-list">${e.quests().map(questHTML).join('')}</ul><p class="mort-fine">New ideas at 4 a.m. Your coins stay. Coins unlock outfits here; they have no cash value.</p></section>${story?`<section class="mort-story"><span class="mort-eyebrow">FROM YOUR SCRAPBOOK</span><h3>${safe(story.name)}</h3><p>${safe(story.story)}</p></section>`:''}<details class="mort-details"><summary>Little things to look forward to</summary><ol class="mort-milestones">${milestones}</ol></details>${p.unlocked.length>1?`<details class="mort-details"><summary>All your little stories · ${p.unlocked.length}</summary>${p.unlocked.slice(0,-1).map(m=>`<article class="mort-story"><h3>${safe(m.name)}</h3><p>${safe(m.story)}</p></article>`).join('')}</details>`:''}${p.cities.length?`<div class="mort-passport"><span class="mort-eyebrow">PLACES YOU'VE WANDERED</span><div>${p.cities.map(id=>getCities().find(c=>c.id===id)).filter(Boolean).map(c=>`<span class="mort-city-stamp">${safe(c.flag||'↗')} ${safe(c.name)}</span>`).join('')}</div></div>`:''}`;
  }
  function wardrobeHTML() {
    const e=ensure(), m=e.state(), item=OUTFITS.find(o=>o.id===preview)||OUTFITS[0], owned=m.owned.includes(item.id);
    const current=e.fit(), equipped=!!current&&current.id===item.id, affordable=e.balance()>=item.price;
    return `<div class="mort-wardrobe-intro"><span class="mort-eyebrow">A FEW THINGS HE FOUND</span><p>Same little ghost. A different kind of cozy.</p><span class="mort-balance" aria-label="${e.balance()} coins">◉ ${e.balance()} coins</span></div><div class="mort-outfit-preview">${avatar(200,{outfit:item.id,animate:true})}<h3>${safe(item.name)}</h3><p>${safe(item.line)}</p></div><div class="mort-outfits" role="group" aria-label="Preview an outfit">${OUTFITS.map(o=>`<button type="button" class="mort-outfit-choice${o.id===item.id?' mort-selected':''}" aria-pressed="${o.id===item.id}" data-mort-action="preview" data-mort-id="${o.id}">${avatar(76,{outfit:o.id,decorative:true})}<strong>${safe(o.name)}</strong><span>${m.owned.includes(o.id)?'Yours':`${o.price} coins`}</span></button>`).join('')}</div><div class="mort-outfit-action">${owned?button(equipped?'noop':'equip',equipped?'Wearing this ✓':'Wear this','mort-primary',` data-mort-id="${item.id}"${equipped?' disabled':''}`):button('buy',affordable?`Make it yours · ${item.price} coins`:`${item.price-e.balance()} more coin${item.price-e.balance()===1?'':'s'} to go`,'mort-primary',` data-mort-id="${item.id}"${affordable?'':' disabled'}`)}<p class="mort-fine">${owned?'Yours to keep. Change outfits whenever you like.':`Exact price: ${item.price} earned coins. Balance after: ${Math.max(0,e.balance()-item.price)}. Yours permanently; no random draws.`}</p></div><p class="mort-wardrobe-note">Every outfit here uses coins from optional quests. No money purchases.</p>${renderLegacy()}${button('counter','Back to your counter','mort-text')}`;
  }
  function renderLegacy() {
    const s=getStats();
    const ids=unique([...(Array.isArray(s.capsuleOwned)?s.capsuleOwned:[]),...(Array.isArray(s.fitsSeen)?s.fitsSeen:[])]);
    const items=ids.map(id=>typeof CAPSULE_BY_ID!=='undefined'?CAPSULE_BY_ID[id]:null).filter(Boolean);
    const souvenirs=getCities().filter(c=>typeof cityVisited==='function'&&cityVisited(c.id)).map(c=>({id:'city:'+c.id,name:c.name+' souvenir',hat:typeof CITY_HAT!=='undefined'?CITY_HAT[c.id]:'↗'}));
    const all=[...items,...souvenirs];
    if(!all.length) return '';
    return `<details class="mort-details mort-legacy"><summary>Your earlier collection · ${all.length} pieces</summary><p class="mort-fine">Everything you already collected is still yours.</p><div class="mort-legacy-grid">${all.map(o=>`<button type="button" class="mort-legacy-choice" data-mort-action="legacy" data-mort-id="${safe(o.id)}" aria-pressed="${s.fit===o.id}"><span aria-hidden="true">${safe(o.hat)}</span><span>${safe(o.name)}</span></button>`).join('')}</div></details>`;
  }
  function renameHTML() {
    return `<div class="mort-rename">${avatar(140,{animate:true})}<p>Mort is a good name. Yours can have another.</p><label for="mort-name-input">Your ghost's name</label><input id="mort-name-input" maxlength="14" value="${safe(getName())}" autocomplete="off" enterkeyhint="done"><p class="mort-fine">Just on this device. Up to 14 characters.</p>${button('save-name','That is your name','mort-primary')}${button('counter','Keep this name','mort-text')}</div>`;
  }
  function renderPanel() {
    if(!modal) return;
    const scroll=modal.querySelector('.mort-dialog-body')?.scrollTop||0;
    const focused=doc.activeElement;
    const focusId=focused?.getAttribute('data-mort-id'), focusAction=focused?.getAttribute('data-mort-action');
    const titles={wardrobe:'A little wardrobe',rename:'A name that feels like yours',postcards:'The postcard drawer',scrapbook:'Your city scrapbook',decorate:'Make your counter cozy',adventure:'Tomorrow, together'};
    const title=titles[panel]||`${getName()}'s counter`;
    modal.querySelector('#mort-dialog-title').textContent=title;
    const body=modal.querySelector('.mort-dialog-body');
    const renderers={wardrobe:wardrobeHTML,rename:renameHTML,postcards:postcardsHTML,scrapbook:scrapbookHTML,decorate:decorateHTML,adventure:adventureHTML,counter:counterHTML};
    body.innerHTML=(renderers[panel]||counterHTML)();
    if(panel==='counter')body.querySelector('.mort-progress-card')?.insertAdjacentHTML('beforebegin',hubHTML());
    body.scrollTop=scroll;
    if(focusAction) {
      const next=[...body.querySelectorAll('[data-mort-action]')].find(el=>el.getAttribute('data-mort-action')===focusAction&&el.getAttribute('data-mort-id')===focusId&&!el.disabled);
      if(next) next.focus({preventScroll:true});
      else modal.querySelector('.mort-close').focus({preventScroll:true});
    }
  }
  function open(which) {
    init();
    ++pendingRoute;
    if(routeTimer){root.clearTimeout(routeTimer);routeTimer=null;}
    panel=which||'counter';
    if(panel==='wardrobe') preview=ensure().fit()?.id||'classic';
    if(panel==='decorate')decorationPreview=ensure().state().decoration;
    if(panel==='adventure')planDraft=null;
    if(panel==='postcards'){
      const cards=ensure().postcards();postcardId=cards[cards.length-1]?.id||null;
      if(postcardId)ensure().readPostcard(postcardId);
    }
    if(!modal) {
      previousFocus=doc.activeElement; previousOverflow=doc.body.style.overflow;
      modal=doc.createElement('div'); modal.className='mort-overlay';
      modal.innerHTML='<section class="mort-dialog" role="dialog" aria-modal="true" aria-labelledby="mort-dialog-title"><header class="mort-dialog-head"><h2 id="mort-dialog-title"></h2><button type="button" class="mort-close" data-mort-action="close" aria-label="Close Mort\'s counter">×</button></header><div class="mort-dialog-body"></div><div class="mort-status" role="status" aria-live="polite"></div></section>';
      doc.body.appendChild(modal); doc.body.style.overflow='hidden';
      focusMap=[];
      for(const el of [...doc.body.children]) if(el!==modal && !['SCRIPT','STYLE','LINK'].includes(el.tagName)) {
        focusMap.push({el,aria:el.getAttribute('aria-hidden'),inert:el.inert}); el.setAttribute('aria-hidden','true'); el.inert=true;
      }
    }
    renderPanel();
    modal.querySelector('.mort-dialog-body').scrollTop=0;
    const target=panel==='rename'?modal.querySelector('input'):modal.querySelector('.mort-close');
    if(target) target.focus({preventScroll:true});
    if(panel==='counter') measure('mort_counter_open');
    if(panel==='wardrobe') measure('mort_wardrobe_open');
  }
  function close() {
    if(!modal) return;
    modal.remove(); modal=null; doc.body.style.overflow=previousOverflow;
    for(const {el,aria,inert} of focusMap){if(aria===null)el.removeAttribute('aria-hidden');else el.setAttribute('aria-hidden',aria);el.inert=inert;}
    focusMap=[];
    if(previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
    previousFocus=null;
  }
  function announce(message) {
    const el=modal?.querySelector('.mort-status');
    if(el){el.textContent='';requestAnimationFrame(()=>{if(el.isConnected)el.textContent=message;});}
    else if(typeof toast==='function') toast(message);
  }
  function changed(result,success) {
    refresh();
    if(result.ok){if(success)announce(success);}
    else announce(result.reason==='storage'?'Your device could not save that. Please free up space and try again.':result.reason==='coins'?'A few more quest coins first.':result.reason==='owned'?'Already yours.':result.reason==='claimed'?'That coin is already in your pocket.':result.reason==='started'?'That day already has its quests. We will keep them unchanged.':result.reason==='decoration'?'A few more visits together will unlock that decoration.':result.reason==='itinerary'?'Choose a city and one of its available cuisines.':'That quest is not complete yet.');
    return result;
  }
  function refresh() {
    if(!engine) return;
    engine.day();
    for(const el of doc.querySelectorAll('[data-mort-home]')) el.outerHTML=renderHome();
    renderPanel();
    doc.dispatchEvent(new CustomEvent('mort:updated',{detail:{balance:engine.balance(),progress:engine.progress()}}));
  }
  function goQuest(id) {
    const q=ensure().quests().find(x=>x.id===id);
    if(!q) return;
    if(id==='delivery'){close();if(typeof clearFilters==='function')clearFilters();if(typeof go==='function')go('feed');return;}
    routeKitchen(q.cityId,q.cuisine,id);
  }
  function routeKitchen(cityId,cuisine,seed) {
    close();
    if(typeof clearFilters==='function')clearFilters();
    const cities=getCities(), index=cities.findIndex(c=>c.id===cityId);
    if(index<0) return;
    const request=++pendingRoute;
    if(routeTimer) root.clearTimeout(routeTimer);
    if(typeof selectCity==='function') selectCity(index);
    else if(typeof setCity==='function') setCity(index);
    if(typeof go==='function') go('feed');
    // Opening the suggested kitchen should feel like a direct invitation.
    // Use an already-loaded menu if possible; otherwise wait briefly for the
    // existing city loader. Never award completion just for this button.
    let tries=0;
    function showKitchen() {
      if(request!==pendingRoute) return;
      const city=cities[index];
      const active=typeof curCity==='function'?curCity():city;
      if(active.id!==city.id) return;
      const feed=doc.querySelector('#view-feed');
      if(feed&&!feed.classList.contains('active')) return;
      const list=(city._places||[]).filter(p=>!cuisine||normalizedCuisine(p.en)===cuisine).sort((a,b)=>String(a._key).localeCompare(String(b._key)));
      if(list.length) {if(typeof openDetail==='function')openDetail(list[hash(ensure().night()+'|'+seed)%list.length]._key);return;}
      if(city._state==='loading'&&++tries<30)routeTimer=root.setTimeout(showKitchen,200);
      else announce('Browse a kitchen when it is ready. Your quest will be waiting at the counter.');
    }
    showKitchen();
  }
  function click(event) {
    if(modal && event.target===modal){close();return;}
    const b=event.target.closest?.('[data-mort-action]');
    if(!b || b.disabled) return;
    const action=b.dataset.mortAction,id=b.dataset.mortId;
    switch(action) {
      case 'close':close();break;
      case 'counter':open('counter');break;
      case 'wardrobe':open('wardrobe');break;
      case 'rename':open('rename');break;
      case 'postcards':open('postcards');measure('mort_postcard_open');break;
      case 'scrapbook':open('scrapbook');measure('mort_scrapbook_open');break;
      case 'decorate':open('decorate');break;
      case 'adventure':open('adventure');break;
      case 'read-postcard':{const result=ensure().readPostcard(id);if(result.ok){postcardId=id;renderPanel();modal.querySelector('.mort-dialog-body').scrollTop=0;}else changed(result);break;}
      case 'preview-decoration':decorationPreview=id;renderPanel();break;
      case 'use-decoration':{const result=changed(ensure().decorate(id),'A little more like home.');if(result.ok)measure('mort_decoration_equip',{decoration:id});break;}
      case 'favorite':{const result=ensure().favorite(id);changed(result,result.favorite?'Saved among your favorite imaginary stops.':'Taken out of favorites. Your memory stays.');break;}
      case 'revisit':measure('mort_scrapbook_revisit',{city:id});routeKitchen(id,null,'memory');break;
      case 'browse':close();if(typeof go==='function')go('feed');break;
      case 'save-plan':{
        if(planDraft?.date!==ensure().tomorrow().date){planDraft=null;renderPanel();announce('A new day just began. Check the date and pick our next little adventure.');break;}
        const city=modal?.querySelector('#mort-plan-city')?.value, cuisine=modal?.querySelector('#mort-plan-cuisine')?.value;
        const result=changed(ensure().planTomorrow(city,cuisine),'On the map. Tomorrow, from 4 a.m.');
        if(result.ok)measure('mort_adventure_plan',{city,cuisine});break;
      }
      case 'clear-plan':planDraft=null;changed(ensure().clearTomorrow(),'Mort will pick tomorrow. No progress changed.');break;
      case 'hello':b.classList.remove('mort-wave');void b.offsetWidth;b.classList.add('mort-wave');announce('Boo. That means hello.');break;
      case 'preview':preview=id;renderPanel();break;
      case 'claim':{const result=changed(ensure().claim(id),'One coin, tucked away.');if(result.ok)measure('mort_quest_claim',{quest:id});break;}
      case 'buy':{const result=changed(ensure().buy(id),'Yours to keep. He is already wearing it.');if(result.ok){measure('mort_outfit_unlock',{outfit:id});measure('mort_outfit_equip',{outfit:id});}break;}
      case 'equip':{const result=changed(ensure().equip(id),'A good fit.');if(result.ok)measure('mort_outfit_equip',{outfit:id});break;}
      case 'quest':goQuest(id);break;
      case 'legacy':if(typeof equipFit==='function'){equipFit(id);refresh();announce('An old favorite.');}break;
      case 'save-name':{
        const input=modal?.querySelector('#mort-name-input'); if(!input)break;
        const s=getStats(), old=s.ghostName;
        s.ghostName=(input.value.trim()||'Mort').slice(0,14);
        try {root.localStorage.setItem('carted_stats',JSON.stringify(s));root.localStorage.setItem('carted_named','1');if(typeof saveStats==='function')saveStats();}
        catch(e){s.ghostName=old;announce('The name could not be saved. Please try again.');break;}
        open('counter');refresh();announce(`${getName()}. He likes it.`);break;
      }
    }
  }
  function change(event) {
    if(event.target.id==='mort-plan-city') {
      const cityId=event.target.value;if(!CITY_CUISINES[cityId])return;
      planDraft={date:ensure().tomorrow().date,cityId,cuisine:CITY_CUISINES[cityId][0]};
      const select=modal?.querySelector('#mort-plan-cuisine');
      if(select)select.innerHTML=CITY_CUISINES[cityId].map(c=>`<option value="${safe(c)}">${safe(c)}</option>`).join('');
    }else if(event.target.id==='mort-plan-cuisine'&&planDraft){planDraft.cuisine=event.target.value;}
  }
  function keydown(event) {
    if(!modal)return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key==='Enter'&&event.target.id==='mort-name-input'){event.preventDefault();modal.querySelector('[data-mort-action="save-name"]').click();return;}
    if(event.key==='Tab') {
      const focusable=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&(doc.activeElement===first||!modal.contains(doc.activeElement))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&(doc.activeElement===last||!modal.contains(doc.activeElement))){event.preventDefault();first?.focus();}
    }
  }
  function init() {
    const e=ensure();
    if(!initialized){initialized=true;e.init();doc.addEventListener('click',click);doc.addEventListener('keydown',keydown);doc.addEventListener('change',change);doc.addEventListener('submit',event=>{if(event.target.matches('[data-mort-plan]')){event.preventDefault();modal?.querySelector('[data-mort-action="save-plan"]')?.click();}});}
    if(!spriteRequested){spriteRequested=true;const img=new Image();img.onload=()=>doc.documentElement.classList.add('mort-art-ready');img.src='assets/mort-sprites.png';}
    return api;
  }
  const api={init,renderHome,openCounter:()=>open('counter'),openWardrobe:()=>open('wardrobe'),openPostcards:()=>open('postcards'),openScrapbook:()=>open('scrapbook'),openDecorate:()=>open('decorate'),openAdventure:()=>open('adventure'),close,avatar,getName,fit,
    progress:()=>ensure().progress(),quests:()=>ensure().quests(),refresh,onForeground:refresh,
    recordCity:city=>{const result=ensure().recordCity(city);if(result.changed!==false)refresh();return result;},
    recordDelivery:order=>{const result=ensure().recordDelivery(order);if(result.changed!==false)refresh();return result;},
    recordVisit:kind=>{const result=ensure().recordVisit(kind);if(result.changed!==false)refresh();return result;},
    line,claim:id=>{const result=changed(ensure().claim(id),'One coin, tucked away.');if(result.ok)measure('mort_quest_claim',{quest:id});return result;}};
  root.Mort=api;
})(typeof window!=='undefined'?window:globalThis);
