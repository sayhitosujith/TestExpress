// Users from the NewRegistration screen. All behaviour lives in the shared
// collection router; this file only names the store it serves.
const { createCollectionRouter } = require('./collectionRoutes');
const { store } = require('../registrationsDb');

module.exports = createCollectionRouter(store, 'registrations');
