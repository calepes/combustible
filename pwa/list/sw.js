importScripts('../shared/sw-cache.js');

installFuelCache('combustible-list-v7', [
  './',
  './index.html',
  '../shared/stations.js',
  '../shared/fetchers.js?v=ped-56',
]);
