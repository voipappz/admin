import { TabsPage } from './tabs-page';

// Thin smoke test — verifies the class loads. Full tab-navigation coverage
// lives in the e2e suite (actions-tabs.mobile.spec.ts).
describe('TabsPage', () => {
  it('should be defined', () => {
    expect(TabsPage).toBeDefined();
  });
});
