'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { source, root, harness } = require('./qa-harness');
// Optional baseline makes failures reproducible against the original PR.
const read = file => process.env.PR8_SOURCE_REF
  ? execFileSync('git', ['show', `${process.env.PR8_SOURCE_REF}:${file}`], { cwd: root, encoding: 'utf8' }) : source(file);
const html = read('contact.html');
function contact() {
  const elements = {}, calls = [];
  for (const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const attrs = Object.fromEntries([...match[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    elements[match[3]] = { attrs, value: '', textContent: '', hidden: /\bhidden\b/.test(match[2]),
      maxLength: Number(attrs.maxlength), href: attrs.href, action: attrs.action, events: {},
      addEventListener(name, fn) { this.events[name] = fn; },
      setAttribute(k,v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
      focus() { calls.push(['focus', this.attrs.id]); } };
  }
  const code = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
  vm.runInNewContext(code, { URL, document: { getElementById: id => elements[id] },
    window: { open(...args) { calls.push(['open',...args]);return {}; } },
    fetch() { throw Error('preparing a draft must not make requests'); } });
  const form = elements['contact-form'];
  return { elements, calls, form,
    submit(subject = 'Feedback', message = 'Details') {
      elements['f-subject'].value = subject; elements['f-message'].value = message;
      form.events.submit({ preventDefault() {} });
    } };
}

test('Contact discloses public URL transmission and collects no name/email', () => {
  assert(!/id="f-(?:email|name)"/.test(html));
  assert.match(html, /before you submit an issue/);
  assert.match(html, /browser history and GitHub logs/);
  assert.match(html, /no private channel/);
  assert(!/Nothing leaves your device until|message is on its way/i.test(html));
});
test('empty and whitespace fields expose associated errors and focus the first invalid field', () => {
  const h = contact(); h.submit('   ', '\n ');
  for(const id of ['subject','message']) {
    assert.equal(h.elements[`f-${id}`].attrs['aria-invalid'], 'true');
    assert.equal(h.elements[`ferr-${id}`].hidden, false);
    assert.equal(h.elements[`f-${id}`].attrs['aria-describedby'], `ferr-${id}`);
  }
  assert.deepEqual(h.calls, [['focus','f-subject']]);
  assert.equal(h.elements.fallback.hidden,true);
  h.submit();assert.equal(h.elements['f-subject'].attrs['aria-invalid'],undefined);
  assert.equal(h.elements['ferr-subject'].hidden,true);
});
test('preparing a Unicode/delimiter draft is local and exactly URL encoded', () => {
  const h=contact(), subject='  A & B? #100% + 🏹  ',message='  <script>alert("x")</script>\n日本語 & body=other #  ';
  h.submit(subject,message);
  assert.deepEqual(h.calls,[],'no popup, navigation or automatic transmission');
  const url=new URL(h.elements['fallback-link'].href);
  assert.equal(url.origin,'https://github.com');assert.equal(url.pathname,'/parya5103/Fletch_Game/issues/new');
  assert.equal(url.searchParams.get('title'),'[Contact] '+subject.trim());
  assert.equal(url.searchParams.get('body'),message.trim());
  assert.equal([...url.searchParams].length,2);assert.equal(url.hash,'');
  assert.equal(h.elements.fallback.hidden,false);assert.match(h.elements['form-status'].textContent,/Nothing has been sent/);
});
test('editing or invalid resubmission hides any stale prepared link', () => {
  const h=contact();h.submit();
  h.form.events.input();assert.equal(h.elements.fallback.hidden,true);
  assert.equal(h.elements['fallback-link'].href,h.form.action);
  h.submit();h.submit('','');assert.equal(h.elements.fallback.hidden,true);
});
test('length limits reject oversized fields and encoded URLs; lone surrogates do not crash', () => {
  const h=contact();
  for(const [title,body] of [['x'.repeat(101),'ok'],['ok','x'.repeat(5001)],['ok','🏹'.repeat(650)]]) {
    h.submit(title,body);assert.equal(h.elements.fallback.hidden,true);
    assert(h.calls.some(c=>c[0]==='focus'));
  }
  assert.doesNotThrow(()=>h.submit('Unicode','bad UTF16: \ud800'));
  assert.equal(h.elements.fallback.hidden,false);
  assert.equal(new URL(h.elements['fallback-link'].href).searchParams.get('body'),'bad UTF16: \ufffd');
});
test('no-JavaScript fallback is a native required GET form with only title/body', () => {
  const form=html.match(/<form\b([^>]*)>([\s\S]*?)<\/form>/);
  assert.match(form[1],/method="get"/);assert.match(form[1],/action="https:\/\/github.com\/parya5103\/Fletch_Game\/issues\/new"/);
  assert(!/target=|novalidate/.test(form[1]));
  assert.deepEqual([...form[2].matchAll(/\bname="([^"]+)"/g)].map(m=>m[1]),['title','body']);
  for(const id of ['subject','message']) assert.match(html,new RegExp(`id="f-${id}"[^>]*required`));
  assert.match(html,/<noscript>[\s\S]*sends the subject and message in the URL immediately/);
  assert.match(html,/name="referrer" content="no-referrer"/);
  assert(!/window\.open\(/.test(html),'explicit same-tab link avoids popup blocking and opener access');
});
test('all local page links exist and home/Settings expose About, Contact, Privacy', () => {
  const index=read('index.html');
  const home=index.match(/<nav class="site-links"[\s\S]*?<\/nav>/)[0];
  const settings=index.slice(index.indexOf('id="dlg-settings"'),index.indexOf('id="dlg-settings"')+13000);
  for(const section of [home,settings]) for(const file of ['about.html','contact.html','privacy.html'])
    assert(section.includes(`href="${file}"`),file);
  for(const file of ['index.html','about.html','contact.html','privacy.html']) {
    const text=read(file),ids=[...text.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(new Set(ids).size,ids.length,`duplicate IDs in ${file}`);
    for(const match of text.matchAll(/\bhref="([^"#]+)(?:#[^"]*)?"/g)) {
      if(/^(https?:|data:)/.test(match[1])) continue;
      assert(fs.existsSync(path.join(root,match[1].split('?')[0])),`${file}: ${match[1]}`);
    }
  }
});
test('About catalogue/count claims agree with production and unsupported release claims are absent', () => {
  const about=read('about.html'),{GC}=harness();
  assert.equal(Object.keys(GC.COSMETICS.boards).length,5);
  assert.equal(Object.keys(GC.SKINS).length,17);
  assert.equal(new Set(Object.values(GC.SKINS).map(s=>s.style)).size,6);
  assert.match(about,/5 board themes and 17 arrow cosmetics/);
  assert(!/each release|every release|before they go live|4&ndash;5/.test(about));
  assert.match(about,/daily login rewards/);assert.match(about,/failure dialog/);
});
test('Privacy distinguishes local reminders, historical subscriptions and public drafts from planned ads', () => {
  const privacy=read('privacy.html');
  assert.match(privacy,/before an issue is submitted/);assert.match(privacy,/attempts to unsubscribe an existing browser subscription/);
  assert.match(privacy,/site operator must delete the old roster separately/);
  assert.match(privacy,/no automated access-request service or private contact form/);
  assert.match(privacy,/no advertising SDK, AdSense code, ad cookies or consent-management system/);
  assert(!/GDPR|DPDP|will ask for it first/.test(privacy));
});
test('public pages are precached with matching worker/display version and valid inline JS', () => {
  const sw=read('sw.js'),version=read('js/pwa.js').match(/var VERSION = '(v\d+)'/)[1];
  assert.equal(sw.match(/const CACHE = 'arrow-out-(v\d+)'/)[1],version);
  for(const file of ['contact.html','about.html','privacy.html']) assert(sw.includes(`'./${file}'`));
  for(const file of ['index.html','contact.html','about.html','privacy.html'])
    for(const m of read(file).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1],{filename:file});
});
