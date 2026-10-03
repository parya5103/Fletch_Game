var CACHE = "fletch-v2";
var ASSETS = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png"];
self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }));
  self.skipWaiting();
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }));
  self.clients.claim();
});
self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET" || req.url.indexOf(self.location.origin) !== 0) return;
  e.respondWith(
    fetch(req).then(function(res){
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(req, copy); });
      return res;
    }).catch(function(){
      return caches.match(req).then(function(m){ return m || caches.match("index.html"); });
    })
  );
});
