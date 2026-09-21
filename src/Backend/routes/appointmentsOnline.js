// Appointments mirrored to the online database. Mounted under /api/online to keep
// clear of /api/appointments, which serves the local SQLite copy.
const { createCollectionRouter } = require('./collectionRoutes');
const { store } = require('../appointmentsOnlineDb');

module.exports = createCollectionRouter(store, 'appointments');
