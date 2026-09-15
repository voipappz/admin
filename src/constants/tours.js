/**
 * Tour Definitions
 *
 * Defines onboarding tours for the application.
 * Each tour has a unique ID, name, and array of steps.
 *
 * Step Properties:
 * - id: Unique step identifier
 * - selector: CSS selector for the target element (use data-tour="..." attributes)
 * - title: Step title
 * - description: Step description
 * - position: Tooltip position (top, bottom, left, right)
 * - optional: If true, step can be skipped if element not found
 */

export const TOURS = {
  'first-login': {
    id: 'first-login',
    name: 'Welcome to VoIP Admin',
    autoStart: true, // Auto-trigger on first login
    steps: [
      {
        id: 'welcome',
        selector: '[data-tour="welcome"]',
        title: 'Welcome to VoIP Admin!',
        description: 'This quick tour will help you get started with the main features of the admin panel.',
        position: 'center',
        optional: true,
      },
      {
        id: 'env-selector',
        selector: '[data-tour="env-selector"]',
        title: 'Select Your Environment',
        description: 'Choose which customer and environment you want to manage. All data is scoped to your selection.',
        position: 'bottom',
        optional: false,
      },
      {
        id: 'users-menu',
        selector: '[data-tour="users-menu"]',
        title: 'Manage Users',
        description: 'Create user accounts, set permissions with ACLs, and manage devices for phone calls.',
        position: 'right',
        optional: true,
      },
      {
        id: 'dids-menu',
        selector: '[data-tour="dids-menu"]',
        title: 'Manage DIDs',
        description: 'Configure phone numbers (DIDs) and set up call routing to IVRs, queues, or devices.',
        position: 'right',
        optional: true,
      },
      {
        id: 'subscriptions-menu',
        selector: '[data-tour="subscriptions-menu"]',
        title: 'Subscriptions & Billing',
        description: 'Manage billing subscriptions, assign tariffs, and track subscription balances.',
        position: 'right',
        optional: true,
      },
      {
        id: 'tour-complete',
        selector: '[data-tour="welcome"]',
        title: 'You\'re Ready!',
        description: 'You can restart this tour anytime from the Help menu. Enjoy using VoIP Admin!',
        position: 'center',
        optional: true,
      },
    ],
  },

  'dids-guide': {
    id: 'dids-guide',
    name: 'DID Management Guide',
    autoStart: false,
    steps: [
      {
        id: 'did-list',
        selector: '[data-tour="did-list"]',
        title: 'DID List',
        description: 'This table shows all your DIDs. Use the filters on the left to narrow down the list.',
        position: 'left',
        optional: true,
      },
      {
        id: 'did-create',
        selector: '[data-tour="did-create"]',
        title: 'Create New DID',
        description: 'Click here to add a new phone number to your system.',
        position: 'bottom',
        optional: true,
      },
      {
        id: 'did-bridge',
        selector: '[data-tour="did-bridge"]',
        title: 'Bridge Types',
        description: 'Bridge type determines where calls go: IVR for menus, Queue for call centers, Device for direct lines.',
        position: 'right',
        optional: true,
      },
    ],
  },

  'devzone-guide': {
    id: 'devzone-guide',
    name: 'Developer Zone Guide',
    autoStart: false,
    steps: [
      {
        id: 'devzone-overview',
        selector: '[data-tour="devzone-hero"]',
        title: 'One live Developer Zone',
        description: 'Search the current OpenAPI contract, connect an AI agent, or follow the human quickstart without leaving Nimbus.',
        position: 'bottom',
        optional: false,
      },
      {
        id: 'devzone-connect-mcp',
        selector: '[data-tour="devzone-mcp"]',
        title: 'Connect through MCP',
        description: 'Copy this endpoint into an MCP-capable agent, with a token of its own. Its tools see only that account\'s customer.',
        position: 'bottom',
        optional: false,
      },
      {
        id: 'devzone-navigation',
        selector: '[data-tour="devzone-tabs"]',
        title: 'Explore by task',
        description: 'Use the quickstart for a first request, API Reference for endpoints grouped in the left rail, and Automation readiness for agent safety guidance.',
        position: 'bottom',
        optional: false,
      },
    ],
  },

  'quick-actions': {
    id: 'quick-actions',
    name: 'Quick Actions Guide',
    autoStart: false,
    steps: [
      {
        id: 'help-button',
        selector: '[data-tour="help-button"]',
        title: 'Need Help?',
        description: 'Click the help icon on any screen to open the documentation for that feature.',
        position: 'bottom',
        optional: true,
      },
      {
        id: 'refresh-button',
        selector: '[data-tour="refresh-button"]',
        title: 'Refresh Data',
        description: 'Click to reload the latest data from the server.',
        position: 'bottom',
        optional: true,
      },
    ],
  },
};

/**
 * Get a tour by ID
 * @param {string} tourId - The tour ID
 * @returns {object|null} The tour definition or null if not found
 */
export const getTour = (tourId) => {
  return TOURS[tourId] || null;
};

/**
 * Get all tours that should auto-start
 * @returns {string[]} Array of tour IDs that should auto-start
 */
export const getAutoStartTours = () => {
  return Object.values(TOURS)
    .filter((tour) => tour.autoStart)
    .map((tour) => tour.id);
};

export default TOURS;
