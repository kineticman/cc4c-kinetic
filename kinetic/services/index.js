// kinetic/services/index.js
// Service registry for custom stream handlers

const appleTVSports = require('./appletv-sports');
const peacockEnhanced = require('./peacock-enhanced');
const espnPlus = require('./espn-plus');
const weatherscan = require('./weatherscan');
const testHls = require('./test-hls');

const services = {
  'appletv-sports': appleTVSports,
  'peacock-enhanced': peacockEnhanced,
  'espn-plus': espnPlus,
  'weatherscan': weatherscan,
  'test-hls': testHls,
};

module.exports = {
  // Get all registered services
  getAll() {
    return services;
  },

  // Get service by name
  get(name) {
    return services[name];
  },

  // Find service handler for a given URL
  getServiceForUrl(url) {
    for (const [name, service] of Object.entries(services)) {
      if (service.canHandle && service.canHandle(url)) {
        console.log(`Found service handler: ${name} for ${url}`);
        return service;
      }
    }
    return null;
  },

  // Register a new service dynamically
  register(name, service) {
    services[name] = service;
    console.log(`Registered service: ${name}`);
  },
};
