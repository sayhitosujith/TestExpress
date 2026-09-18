// Appointment history mirrored to the online database.
const { createCollectionRouter } = require('./collectionRoutes');
const { store } = require('../appointmentHistoryDb');

module.exports = createCollectionRouter(store, 'appointment history');
