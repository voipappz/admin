// The environments client moved to ./environmentsApi when the API services
// were split per resource. Seven modules still import it from this path, so
// the old module name stays as a re-export rather than breaking the build.
export { environmentsApi, default } from './environmentsApi';
