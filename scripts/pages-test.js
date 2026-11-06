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

test('Contact discloses the email flow and collects no name/email', () => {
  assert(!/id="f-(?:email|name)"/.test(html));
  assert.match(html, /opens your email app/);
  assert.match(html, /nothing is sent until you press send/i);
  assert.match(html, /officialgogocompany@gmail\.com/);
  assert(!/github\.com/.test(html), 'no GitHub links remain on the contact page');
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
  assert.equal(url.protocol,'mailto:');
  assert.equal(url.pathname,'officialgogocompany@gmail.com');
  assert.equal(url.searchParams.get('subject'),'[Arrow Out! Contact] '+subject.trim());
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
test('no-JavaScript fallback is a native required GET mailto form with only subject/body', () => {
  const form=html.match(/<form\b([^>]*)>([\s\S]*?)<\/form>/);
  assert.match(form[1],/method="get"/);assert.match(form[1],/action="mailto:officialgogocompany@gmail\.com"/);
  assert(!/target=|novalidate/.test(form[1]));
  assert.deepEqual([...form[2].matchAll(/\bname="([^"]+)"/g)].map(m=>m[1]),['subject','body']);
  for(const id of ['subject','message']) assert.match(html,new RegExp(`id="f-${id}"[^>]*required`));
  assert.match(html,/<noscript>[\s\S]*opens your email app directly/);
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
      if(/^(https?:|data:|mailto:)/.test(match[1])) continue;
      assert(fs.existsSync(path.join(root,match[1].split('?')[0])),`${file}: ${match[1]}`);
    }
  }
});
test('About catalogue/count claims agree with production and unsupported release claims are absent', () => {
  const about=read('about.html'),{GC}=harness();
  assert.equal(Object.keys(GC.COSMETICS.boards).length,9);
  assert.equal(Object.keys(GC.SKINS).length,17);
  assert.equal(new Set(Object.values(GC.SKINS).map(s=>s.style)).size,6);
  assert.match(about,/9 board themes and 17 arrow cosmetics/);
  assert(!/each release|every release|before they go live|4&ndash;5/.test(about));
  assert.match(about,/daily login rewards/);assert.match(about,/failure dialog/);
});
test('Privacy describes the email contact flow and keeps the local/daily-push distinction', () => {
  const privacy=read('privacy.html');
  assert.match(privacy,/nothing is sent until you press send in your email app/i);
  assert.match(privacy,/removes this device from the roster immediately/);
  assert.match(privacy,/Provider-side retention \(Supabase backups or GitHub logs\) is managed by those providers/);
  assert.match(privacy,/no automated access-request service/);
  assert.match(privacy,/one labelled display advertisement, served by Google AdSense/);
  assert(!/GDPR|DPDP|will ask for it first/.test(privacy));
});
test('no visitor-facing GitHub links remain on the public info pages', () => {
  for(const file of ['about.html','contact.html','privacy.html']) {
    const text=read(file);
    assert(!text.includes('github.com/parya5103'),`${file}: account/repository reference`);
    assert(!/href\s*=\s*["']https:\/\/github\.com\//.test(text),`${file}: github.com hyperlink`);
  }
  // Honest infrastructure disclosures stay as plain text.
  assert.match(read('privacy.html'),/GitHub Pages/);
});
test('public pages are precached with matching worker/display version and valid inline JS', () => {
  const sw=read('sw.js'),version=read('js/pwa.js').match(/var VERSION = '(v\d+)'/)[1];
  assert.equal(sw.match(/const CACHE = 'arrow-out-(v\d+)'/)[1],version);
  for(const file of ['contact.html','about.html','privacy.html']) assert(sw.includes(`'./${file}'`));
  for(const file of ['index.html','contact.html','about.html','privacy.html'])
    // Inline-JS check: skip <script> data blocks the browser would not run as JS (e.g. type="application/ld+json").
    for(const m of read(file).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
      const type=(m[1].match(/\btype\s*=\s*"([^"]*)"/)||[])[1];
      if(type&&!/^(module|(text|application)\/javascript)$/.test(type))continue;
      new vm.Script(m[2],{filename:file});
    }
});

