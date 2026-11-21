importScripts('../shared/sw-cache.js');

installFuelCache('combustible-cards-v18', [
  './',
  './index.html',
  './manifest.json',
  '../shared/stations.js',
  '../shared/fetchers.js',
  '../shared/icons/icon-192.png',
  '../shared/icons/icon-512.png',
  '../shared/icons/apple-touch-icon.png',
]);
