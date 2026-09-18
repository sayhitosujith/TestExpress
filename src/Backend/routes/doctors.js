// Dentists from the AddDoctor screen. All behaviour lives in the shared
// collection router; this file only names the store it serves.
const { createCollectionRouter } = require('./collectionRoutes');
const { store } = require('../doctorsDb');

module.exports = createCollectionRouter(store, 'doctors');
