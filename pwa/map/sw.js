importScripts('../shared/sw-cache.js');

installFuelCache('combustible-map-v13', [
  './',
  './index.html',
  './manifest.json',
  '../shared/stations.js',
  '../shared/fetchers.js?v=ped-56',
  './icons/icon-map-192.png',
  './icons/icon-map-512.png',
  './icons/apple-touch-icon.png',
]);
