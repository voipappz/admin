/**
 * Zendesk Guide URLs Registry
 *
 * Maps screen names to real Zendesk article URLs from docs/articles-manifest.json.
 */

export const GUIDE_URLS = {
  // Main Screens
  USERS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576853338130-Users-Screen-Overview',
  ENVIRONMENTS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576853369106-What-are-Environments',
  DIDS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576853404818-DIDs-Screen-Walkthrough',
  SUBSCRIPTIONS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576854133522-Subscriptions-Overview',
  PROVIDERS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576850031890-Provider-Management',
  CALLS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576854082834-Call-Logs-Screen',
  REPORTS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576849957906-Reports-Screen-Walkthrough',
  LIVE: 'https://voipappz.zendesk.com/hc/en-us/articles/34576849928210-Live-Calls-Screen',
  DASHBOARD: 'https://voipappz.zendesk.com/hc/en-us/articles/34576849917714-Dashboard-Overview',
  EXTENSIONS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576853826450-Extensions-Screen-Walkthrough',
  BOTS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576849827730-Bots-Screen-Walkthrough',
  WORKFLOWS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576849876498-What-is-a-Workflow',
  CAMPAIGNS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576849928210-Live-Calls-Screen',
  MESSAGES: 'https://voipappz.zendesk.com/hc/en-us/articles/34576849189394-Admin-Panel-Walkthrough',
  ACCOUNTS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576849262226-Account-Profile-Settings',
  SCHEMA: 'https://voipappz.zendesk.com/hc/en-us/articles/34576849189394-Admin-Panel-Walkthrough',
  TEMPLATES: 'https://voipappz.zendesk.com/hc/en-us/articles/34576849189394-Admin-Panel-Walkthrough',

  // Feature-specific guides
  BRIDGE_TYPES: 'https://voipappz.zendesk.com/hc/en-us/articles/34576849339154-Bridge-Types-Overview',
  ACL: 'https://voipappz.zendesk.com/hc/en-us/articles/34576853357842-ACLs-Access-Control-Lists-Defining-Permissions',
  TTS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576853801362-What-is-an-Announcement',
  CALL_CONDITIONS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576853737106-What-is-a-Call-Condition',
  VML: 'https://voipappz.zendesk.com/hc/en-us/articles/34576849840018-What-is-VML',
  QUEUES: 'https://voipappz.zendesk.com/hc/en-us/articles/34576849581842-What-is-a-Queue',
  IVRS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576849513234-What-is-an-IVR',
  ANNOUNCEMENTS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576853801362-What-is-an-Announcement',
  TARIFFS: 'https://voipappz.zendesk.com/hc/en-us/articles/34576850006290-Tariff-Configuration',

  // General
  GETTING_STARTED: 'https://voipappz.zendesk.com/hc/en-us/articles/34576848986386-Platform-Overview',
  FAQ: 'https://voipappz.zendesk.com/hc/en-us/articles/34576849168786-Voipappz-Glossary-A-Z',
  SUPPORT: 'https://voipappz.zendesk.com/hc/en-us/requests/new',
};

/**
 * Open a guide URL in a new browser tab
 * @param {string} guideUrl - The guide URL to open
 */
export const openGuide = (guideUrl) => {
  if (guideUrl) {
    window.open(guideUrl, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Get guide URL for a screen
 * @param {string} screenName - The screen name (e.g., 'USERS', 'DIDS')
 * @returns {string|null} The guide URL or null if not found
 */
export const getGuideUrl = (screenName) => {
  return GUIDE_URLS[screenName.toUpperCase()] || null;
};

export default GUIDE_URLS;
