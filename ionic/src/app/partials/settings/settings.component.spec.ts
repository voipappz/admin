import { SettingsComponent } from './settings.component';

// Thin smoke test — verifies the class loads. Creating the component pulls in
// the real phone provider (which opens a WSS connection and retries), so full
// rendering is covered by the e2e suite instead.
describe('SettingsComponent', () => {
  it('should be defined', () => {
    expect(SettingsComponent).toBeDefined();
  });
});
