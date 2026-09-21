// The test runner's online collections, mounted under /api/online/testrunner.
//
// One router carrying four sub-routers rather than four mounts in index.js, so
// the whole feature moves as a unit and the URL prefix is stated once. Each
// sub-router is the same generated REST surface every other online collection
// gets — see collectionRoutes.js.
//
// Nested under /testrunner rather than sitting alongside /patients because
// "tests" and "projects" are far too generic to own a top-level segment in an
// app that also has dental appointments and patient records.
const express = require('express');
const { createCollectionRouter } = require('./collectionRoutes');
const { tests, projects, schedules, dataSets } = require('../testRunnerOnlineDb');

const router = express.Router();

router.use('/tests', createCollectionRouter(tests, 'test runner tests'));
router.use('/projects', createCollectionRouter(projects, 'test runner projects'));
router.use('/schedules', createCollectionRouter(schedules, 'test runner schedules'));
router.use('/data-sets', createCollectionRouter(dataSets, 'test runner data sets'));

module.exports = router;
