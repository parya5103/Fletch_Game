'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const vm = require('node:vm');
const {harness, source} = require('./qa-harness');
const MINUTE=60000, KEY='arrowOut.reminders.v1', CLAIMS='arrowOut.reminderClaims.v1';
const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function locks() {
  let queue=Promise.resolve();
  return {request(_name,_options,fn){const p=queue.then(()=>fn({}));queue=p.catch(()=>{});return p;}};
}
function fixture(options={}) {
  const clock=options.clock||{now:1792314000000}, data=options.data||{};
  const h=harness({'arrowOut.v2':JSON.stringify({v:2,unlocked:900,coins:4321,skin:'royal',owned:{royal:true},boardSkin:'galaxy',ownedBoards:{galaxy:true},
    settings:{notifications:true,systemNotifications:true,reminderMinutes:options.minutes||90,...options.settings}})});
  const before=JSON.stringify(h.ST.getSave()), elements={}, events={}, intervals=[], shown=[], closed=[];
  for(const id of ['chk-notifs','chk-system-notifs','reminder-minutes','reminder-banner','st-notif','reminder-status','btn-notif-permission','reminder-permission','btn-notif-test','reminder-legacy','btn-reminder-cleanup'])
    elements[id]={checked:false,hidden:true,disabled:false,value:'',textContent:'',addEventListener(){}};
  const notification={permission:options.permission||'granted',requestPermission(){requested++;notification.permission=options.answer||'granted';return Promise.resolve(notification.permission);}};
  let requested=0, retired=0;
  const reg={scope:'https://game.example/Fletch_Game/',active:{},showNotification:async(title,opts)=>{shown.push({title,opts});if(options.rejectShow)throw Error('OS unavailable');},
    getNotifications:async({tag})=>[{close(){closed.push(tag);}}],
    pushManager:{getSubscription:async()=>options.legacy?{unsubscribe:async()=>{retired++;return !options.cleanupFails;}}:null,subscribe(){throw Error('must never subscribe');}}};
  const add=(name,fn)=>{(events[name]||=[]).push(fn);};
  const document={hidden:!!options.hidden,getElementById:id=>elements[id]||null,addEventListener:add};
  const box=vm.createContext({console,URL,JSON,Number,Promise,Storage:h.ST,Date:class extends Date{static now(){return clock.now;}},
    localStorage:{getItem:key=>{if(options.blocked)throw Error('blocked');return options.staleClaims && key===CLAIMS ? null : data[key]||null;},setItem(key,value){if(options.blocked)throw Error('blocked');data[key]=value;},removeItem:key=>{delete data[key];}},
    location:{href:'https://game.example/Fletch_Game/index.html'},Notification:options.unsupported?undefined:notification,
    navigator:{locks:options.noLocks?undefined:options.locks||locks(),serviceWorker:options.noSW?undefined:{getRegistration:options.getRegistration||(async()=>reg),addEventListener:add}},
    window:{isSecureContext:!options.insecure,addEventListener:add},document,setInterval:fn=>intervals.push(fn),
    fetch(){throw Error('no remote API calls allowed');}});
  vm.runInContext(source('js/reminders.js')+';globalThis.R=Reminders;',box);
  box.R.init();
  return {R:box.R,h,before,clock,data,elements,events,intervals,shown,closed,reg,notification,document,options,
    requests:()=>requested,retired:()=>retired,advance:ms=>{clock.now+=ms;}};
}

test('initialization is idempotent, prompt-free, and preserves all game data', async()=>{
  const f=fixture();f.R.init();await settle();assert.equal(f.intervals.length,1);assert.equal(f.requests(),0);
  assert.equal(JSON.stringify(f.h.ST.getSave()),f.before);assert.equal(f.shown.length,0);
});
test('60/90/120-minute boundaries use elapsed time, then show one non-modal banner per episode',async()=>{
  for(const minutes of [60,90,120]){
    const f=fixture({minutes});f.advance(minutes*MINUTE-1);assert.equal(await f.R.check(),false);
    f.advance(1);assert.equal(await f.R.check(),true);assert.equal(f.elements['reminder-banner'].hidden,false);
    f.advance(180*MINUTE);assert.equal(await f.R.check(),false);assert.equal(f.shown.length,0);
    f.R.activity(true);assert.equal(f.elements['reminder-banner'].hidden,true);
    f.advance(minutes*MINUTE);assert.equal(await f.R.check(),true);
  }
});
test('Off blocks timing, permission requests and test delivery and closes local notifications',async()=>{
  const f=fixture();f.R.setEnabled(false);f.advance(120*MINUTE);await f.R.check();await f.R.allowSystem();
  assert.equal(await f.R.testSystem(),false);assert.equal(f.requests(),0);assert.equal(f.shown.length,0);
  assert.equal(f.R.status(),'Off');await settle();assert(f.closed.includes('arrow-out-local'));
});
test('permission default is requested only by an explicit action, once; granted enables system preference',async()=>{
  const f=fixture({permission:'default',settings:{systemNotifications:false}});assert.equal(f.requests(),0);
  await f.R.check();assert.equal(f.requests(),0);await f.R.allowSystem();await f.R.allowSystem();
  assert.equal(f.requests(),1);assert.equal(f.h.ST.getSave().settings.systemNotifications,true);
});
test('denied and dismissed permission never cause repeated prompts or suppress in-game fallback',async()=>{
  for(const options of [{permission:'denied'},{permission:'default',answer:'default'}]){
    const f=fixture(options);await f.R.allowSystem();await f.R.allowSystem();assert.equal(f.requests(),options.permission==='denied'?0:1);
    f.advance(90*MINUTE);await f.R.check();assert.equal(f.elements['reminder-banner'].hidden,false);assert.equal(f.shown.length,0);
  }
});
test('unsupported APIs, insecure context and missing locks retain in-game reminders without system delivery',async()=>{
  for(const options of [{unsupported:true},{insecure:true},{noLocks:true},{noSW:true}]){
    const f=fixture(options);await f.R.allowSystem();assert.equal(f.requests(),0);
    f.document.hidden=true;f.advance(90*MINUTE);await f.R.check();assert.equal(f.shown.length,0);
    f.document.hidden=false;await f.R.check();assert.equal(f.elements['reminder-banner'].hidden,false);
  }
});
test('live hidden page may hand one local notification to its in-scope worker; revoked permission stops delivery',async()=>{
  const f=fixture({hidden:true});f.advance(90*MINUTE);await f.R.check();await f.R.check();
  assert.equal(f.shown.length,1);assert.equal(f.shown[0].opts.tag,'arrow-out-local');assert.equal(f.shown[0].opts.data.url,'./');
  f.R.activity(true);f.advance(90*MINUTE);f.notification.permission='denied';await f.R.check();assert.equal(f.shown.length,1);
});
test('failed system display retains a visible in-game fallback, without repeated system attempts',async()=>{
  const f=fixture({hidden:true,rejectShow:true});f.advance(90*MINUTE);await f.R.check();await f.R.check();assert.equal(f.shown.length,1);
  f.document.hidden=false;await f.R.check();assert.equal(f.elements['reminder-banner'].hidden,false);assert.equal(f.shown.length,1);
});
test('shared storage plus Web Locks deduplicates simultaneous tabs and carries activity to the other tab',async()=>{
  const data={},lock=locks(),clock={now:1792314000000};
  const a=fixture({data,locks:lock,clock,hidden:true}),b=fixture({data,locks:lock,clock,hidden:true});
  clock.now+=90*MINUTE;await Promise.all([a.R.check(),b.R.check()]);assert.equal(a.shown.length+b.shown.length,1);
  clock.now++;b.R.activity(true);clock.now+=89*MINUTE;await a.R.check();assert.equal(a.shown.length+b.shown.length,1);
  clock.now+=MINUTE;await a.R.check();assert.equal(a.shown.length+b.shown.length,2);
});
test('turning Off during an asynchronous registration lookup cancels a due notification',async()=>{
  let resolve;const pending=new Promise(r=>resolve=r);
  const f=fixture({hidden:true,getRegistration:()=>pending});f.advance(90*MINUTE);const checking=f.R.check();await settle();
  f.R.setEnabled(false);resolve(f.reg);await checking;assert.equal(f.shown.length,0);
});
test('blocked storage and corrupt reminder metadata do not affect game saves or core fallback',async()=>{
  for(const options of [{blocked:true},{data:{[KEY]:'{broken'}}]){
    const f=fixture(options);f.advance(90*MINUTE);await f.R.check();assert.equal(f.elements['reminder-banner'].hidden,false);
    assert.equal(JSON.stringify(f.h.ST.getSave()),f.before);assert.equal(f.shown.length,0);
  }
});
test('manual system tests are serialized and rate-limited across reloads and tabs',async()=>{
  const data={},lock=locks(),clock={now:1792314000000};
  const a=fixture({data,locks:lock,clock}),b=fixture({data,locks:lock,clock});
  const sent=await Promise.all([a.R.testSystem(),b.R.testSystem()]);assert.equal(sent.filter(Boolean).length,1);
  clock.now+=MINUTE;assert.equal(await b.R.testSystem(),true);
  b.reg.scope='https://game.example/other/';clock.now+=MINUTE;assert.equal(await b.R.testSystem(),false);
});
test('legacy push is only unsubscribed, with failed cleanup reported and retryable',async()=>{
  const f=fixture({legacy:true,cleanupFails:true});await settle();assert.equal(f.retired(),1);
  assert.match(f.elements['reminder-legacy'].textContent,/could not be confirmed/);
  f.options.cleanupFails=false;await f.R.retireLegacyPush();assert.equal(f.retired(),2);assert.equal(f.elements['reminder-legacy'].hidden,true);
});
test('new settings sanitize safely while all previous preferences, progress and purchases remain',()=>{
  const f=fixture({settings:{reminderMinutes:1,systemNotifications:'junk',notificationPrompted:'junk',reducedMotion:true,seenOnboarding:true}});
  const s=f.h.ST.getSave();assert.equal(s.settings.reminderMinutes,90);assert.equal(s.settings.systemNotifications,false);
  assert.equal(s.settings.notificationPrompted,false);assert.equal(s.settings.notifications,true);assert.equal(s.settings.reducedMotion,true);
  assert.equal(s.unlocked,900);assert.equal(s.coins,4321);assert.equal(s.owned.royal,true);assert.equal(s.ownedBoards.galaxy,true);
});

test('reset clears local reminder timing while preserving game data outside an explicit progress reset',()=>{
  const f=fixture();assert(f.data[KEY]);f.R.setEnabled(false);f.R.reset();
  assert.equal(f.data[KEY],undefined);assert.equal(f.elements['reminder-banner'].hidden,true);
  assert.equal(f.h.ST.getSave().coins,4321);assert.equal(f.h.ST.getSave().owned.royal,true);
});

test('Off while a permission prompt is pending cannot silently re-enable system notifications',async()=>{
  const f=fixture({permission:'default',settings:{systemNotifications:false}});let resolve;
  f.notification.requestPermission=()=>new Promise(r=>{resolve=r;});
  const allowing=f.R.allowSystem();f.R.setEnabled(false);f.notification.permission='granted';resolve('granted');await allowing;
  assert.equal(f.h.ST.getSave().settings.notifications,false);assert.equal(f.h.ST.getSave().settings.systemNotifications,false);
});
test('Off during reminder or test display closes notifications created after the first close attempt',async()=>{
  for(const manual of [false,true])for(const mode of ['all','system','permission']){
    const f=fixture({hidden:true});let resolve,visible=false;
    f.reg.showNotification=()=>new Promise(r=>{resolve=()=>{visible=true;r();};});
    f.reg.getNotifications=async()=>visible?[{close(){visible=false;}}]:[];
    f.advance(90*MINUTE);const checking=manual?f.R.testSystem():f.R.check();await settle();
    if(mode==='all')f.R.setEnabled(false);
    else if(mode==='system')f.h.ST.getSave().settings.systemNotifications=false;
    else f.notification.permission='denied';
    await settle();resolve();await checking;await settle();
    assert.equal(visible,false,`late display must close: manual=${manual}, mode=${mode}`);
    assert.equal(f.elements['reminder-banner'].hidden,true);
  }
});

test('stale activity flushes cannot overwrite another tab’s delivery or test claim',async()=>{
  const data={},lock=locks(),clock={now:1792314000000};
  const a=fixture({data,locks:lock,clock,hidden:true}),b=fixture({data,locks:lock,clock,hidden:true});
  clock.now+=90*MINUTE;await a.R.check();assert.equal(a.shown.length,1);
  const claim=data[CLAIMS];b.options.staleClaims=true;
  for(const flush of b.events.pagehide)flush();
  assert.equal(data[CLAIMS],claim,'pagehide with stale reads must not write claims');
  b.options.staleClaims=false;await b.R.check();assert.equal(b.shown.length,0);
  clock.now++;await a.R.testSystem();const tested=data[CLAIMS];b.options.staleClaims=true;
  for(const flush of b.events.pagehide)flush();assert.equal(data[CLAIMS],tested);
  b.options.staleClaims=false;assert.equal(await b.R.testSystem(),false);
});
