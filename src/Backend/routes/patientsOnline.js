// Patient profiles mirrored to the online database. Mounted under /api/online to
// keep clear of /api/patients, which serves the local SQLite copy.
const { createCollectionRouter } = require('./collectionRoutes');
const { store } = require('../patientsOnlineDb');

module.exports = createCollectionRouter(store, 'patients');
