// Mirrors the test runner's data to the online database.
//
// Four collections, each a plain sync-contract client — see createCollectionApi.
// Nothing here is called from a screen: TestRunner.jsx keeps writing to
// localStorage exactly as it did, and dbSync carries those keys to the database
// on its own loop. That is deliberate, and is the same reasoning dbSync.js opens
// with: the recorder writes these keys from a dozen places, every one of them
// would need a save call, and the next one added would forget it.
import { createCollectionApi } from "./onlineCollections";

export const testRunnerTests = createCollectionApi("testrunner/tests");
export const testRunnerProjects = createCollectionApi("testrunner/projects");
export const testRunnerSchedules = createCollectionApi("testrunner/schedules");
export const testRunnerDataSets = createCollectionApi("testrunner/data-sets");
