/**
 * Billing & Pricing articles
 */

module.exports = [
  {
    section: 'Subscriptions',
    title: 'Subscriptions Overview',
    body: `
<h2>Overview</h2>
<p>Subscriptions define the billing plans for each environment. They control access to platform features, set usage limits, and determine billing cycles.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Subscriptions</strong>.</p>

<h2>Fields Reference</h2>
<table>
  <tr><th>Field</th><th>Description</th><th>Required</th></tr>
  <tr><td>Name</td><td>Subscription plan name</td><td>Yes</td></tr>
  <tr><td>Environment</td><td>Which environment this subscription applies to</td><td>Yes</td></tr>
  <tr><td>Tariff</td><td>Associated tariff for rate calculation</td><td>Yes</td></tr>
  <tr><td>Balance</td><td>Starting balance</td><td>Yes</td></tr>
  <tr><td>Recurring</td><td>Whether the subscription auto-renews</td><td>No</td></tr>
  <tr><td>Begins At</td><td>Subscription start date</td><td>No</td></tr>
  <tr><td>Ends At</td><td>Subscription end date</td><td>No</td></tr>
  <tr><td>Enabled</td><td>Whether the subscription is active</td><td>No (default: true)</td></tr>
</table>

<h2>Step-by-Step Guide</h2>

<h3>Creating a Subscription</h3>
<ol>
  <li>Click <strong>+ Create</strong></li>
  <li>Enter a <strong>Name</strong></li>
  <li>Select the <strong>Environment</strong></li>
  <li>Select a <strong>Tariff</strong></li>
  <li>Set the <strong>Balance</strong></li>
  <li>Configure billing dates and recurrence</li>
  <li>Click <strong>Save</strong></li>
</ol>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Tariff Configuration</a></li>
  <li><a href="#">Wallet Management</a></li>
</ul>
`,
  },
  {
    section: 'Tariffs & Rating',
    title: 'Tariff Configuration',
    body: `
<h2>Overview</h2>
<p>Tariffs define the pricing structure for calls. They contain rate sheets that determine the per-minute or per-call cost for different destinations.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Tariffs</strong>.</p>

<h2>Key Concepts</h2>
<ul>
  <li><strong>Tariff</strong> — A named pricing plan (e.g., "Standard", "Premium")</li>
  <li><strong>Rate Sheet</strong> — The actual rates within a tariff</li>
  <li><strong>Destination</strong> — Geographic or number-type rate grouping</li>
  <li><strong>LCR</strong> — Least Cost Routing for provider selection</li>
</ul>

<h2>Step-by-Step Guide</h2>
<ol>
  <li>Navigate to <strong>Tariffs</strong></li>
  <li>Click <strong>+ Create</strong></li>
  <li>Enter a <strong>Name</strong></li>
  <li>Configure rates for different destination prefixes</li>
  <li>Click <strong>Save</strong></li>
</ol>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Subscriptions Overview</a></li>
  <li><a href="#">Providers & Routes</a></li>
</ul>
`,
  },
  {
    section: 'Wallets',
    title: 'Wallet Management',
    body: `
<h2>Overview</h2>
<p>Wallets track the balance and usage for each environment. They deduct call costs based on tariff rates and can be topped up as needed.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Wallets</strong>.</p>

<h2>Key Features</h2>
<ul>
  <li>View current balance</li>
  <li>See transaction history</li>
  <li>Top up balance</li>
  <li>Set low-balance alerts</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Subscriptions Overview</a></li>
  <li><a href="#">Tariff Configuration</a></li>
</ul>
`,
  },
  {
    section: 'Providers & Routes',
    title: 'Provider Management',
    body: `
<h2>Overview</h2>
<p>Providers are the SIP trunk providers (carriers) that Voipappz uses to originate and terminate phone calls. Managing providers involves configuring SIP connections and routing strategies.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Providers</strong>.</p>

<h2>Fields Reference</h2>
<table>
  <tr><th>Field</th><th>Description</th><th>Required</th></tr>
  <tr><td>Name</td><td>Provider display name</td><td>Yes</td></tr>
  <tr><td>Type</td><td>SIP trunk type</td><td>Yes</td></tr>
  <tr><td>Host</td><td>Provider SIP server address</td><td>Yes</td></tr>
  <tr><td>Enabled</td><td>Whether the provider is active</td><td>No</td></tr>
</table>

<h2>Route Configuration</h2>
<p>Routes determine which provider handles outbound calls to specific destinations:</p>
<ul>
  <li><strong>Route</strong> — A mapping of destination prefixes to providers</li>
  <li><strong>Priority</strong> — When multiple routes match, the highest priority is used</li>
  <li><strong>LCR</strong> — Least Cost Routing automatically selects the cheapest provider</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Set Provider Strategy LCR</a></li>
  <li><a href="#">Tariff Configuration</a></li>
</ul>
`,
  },
];
