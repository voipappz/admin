// The extensions client moved to ./extensionsApi when the API services were
// split per resource. Nine modules still import it from this path, so the old
// module name stays as a re-export rather than breaking the build.
export { extensionsApi, default } from './extensionsApi';
