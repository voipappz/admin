/**
 * Admin Portal & Account Management articles
 */

module.exports = [
  // --- Section: Portal Overview ---
  {
    section: 'Portal Overview',
    title: 'Admin Panel Walkthrough',
    body: `
<h2>Overview</h2>
<p>The Voipappz admin panel is your central command center for managing the entire communications platform. This article walks you through the main interface elements.</p>

<h2>Interface Layout</h2>

<h3>Sidebar Navigation</h3>
<p>The left sidebar contains all platform features organized into logical groups. You can collapse it by clicking the menu icon for more screen space.</p>

<h3>Top Bar</h3>
<p>The top bar provides quick access to:</p>
<ul>
  <li><strong>Environment Selector</strong> — A dropdown to switch between environments. All data in the portal is filtered by the selected environment.</li>
  <li><strong>Global Search</strong> — Search across all resources (DIDs, users, extensions, etc.)</li>
  <li><strong>User Menu</strong> — Access your profile, settings, and logout</li>
</ul>

<h3>Main Content Area</h3>
<p>Displays the active screen. Most screens follow a consistent pattern:</p>
<ul>
  <li><strong>Data Table</strong> — Lists resources with columns for key fields, sortable by clicking headers</li>
  <li><strong>Action Buttons</strong> — Create new resources, edit, delete, and perform special actions</li>
  <li><strong>Filter/Search Bar</strong> — Filter table data by name, status, type, or other fields</li>
  <li><strong>Pagination</strong> — Navigate through large datasets</li>
</ul>

<h2>Common Actions</h2>
<table>
  <tr><th>Action</th><th>How</th></tr>
  <tr><td>Create new resource</td><td>Click the <strong>+ Create</strong> button (top right of most screens)</td></tr>
  <tr><td>Edit a resource</td><td>Click on the row or the edit icon</td></tr>
  <tr><td>Delete a resource</td><td>Click the delete icon and confirm in the dialog</td></tr>
  <tr><td>Switch environment</td><td>Use the environment dropdown in the top bar</td></tr>
  <tr><td>Search</td><td>Type in the search/filter fields above the table</td></tr>
</table>

<h2>Tips</h2>
<ul>
  <li>Keyboard shortcut: Press <code>/</code> to focus the search bar</li>
  <li>The sidebar remembers your last visited screen</li>
  <li>Table columns can be sorted ascending/descending by clicking the header</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Switching Between Environments</a></li>
  <li><a href="#">Users & Permissions</a></li>
</ul>
`,
  },
  {
    section: 'Portal Overview',
    title: 'Switching Between Environments',
    body: `
<h2>Overview</h2>
<p>The environment selector allows you to switch context between different customers or departments. All data displayed in the admin panel is scoped to the currently selected environment.</p>

<h2>How to Switch</h2>
<ol>
  <li>Locate the <strong>Environment Selector</strong> dropdown in the top bar</li>
  <li>Click to open the dropdown — you'll see a list of all environments you have access to</li>
  <li>Select the desired environment</li>
  <li>All screens and data will refresh to show only resources belonging to that environment</li>
</ol>

<h2>Important Notes</h2>
<ul>
  <li>Your environment selection is <strong>persisted</strong> — it stays selected even after page refresh or re-login</li>
  <li>Some administrative screens (like Environments management itself) show data across all environments</li>
  <li>You can only see environments that your ACL (permissions) allow</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">What is an Environment?</a></li>
  <li><a href="#">Creating & Managing Environments</a></li>
</ul>
`,
  },

  // --- Section: Users & Permissions ---
  {
    section: 'Users & Permissions',
    title: 'Users Screen Overview',
    body: `
<h2>Overview</h2>
<p>The Users screen lets you manage all user accounts that have access to the Voipappz admin portal. From here you can create, edit, enable/disable, and delete users.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Users</strong>.</p>

<h2>Key Features</h2>
<ul>
  <li>View all users with their name, email, role, and status</li>
  <li>Create new user accounts</li>
  <li>Assign ACLs (permissions) to control access</li>
  <li>Enable or disable user accounts</li>
  <li>Filter users by name, email, status, or environment</li>
</ul>

<h2>Fields Reference</h2>
<table>
  <tr><th>Field</th><th>Description</th><th>Required</th></tr>
  <tr><td>Name</td><td>User's display name</td><td>Yes</td></tr>
  <tr><td>Email</td><td>Login email address (must be unique)</td><td>Yes</td></tr>
  <tr><td>Password</td><td>Account password</td><td>Yes (on create)</td></tr>
  <tr><td>ACL</td><td>Access Control List — determines permissions</td><td>Yes</td></tr>
  <tr><td>Environment</td><td>Which environment(s) the user can access</td><td>Yes</td></tr>
  <tr><td>Enabled</td><td>Whether the account is active</td><td>No (default: true)</td></tr>
</table>

<h2>Step-by-Step Guide</h2>

<h3>Creating a User</h3>
<ol>
  <li>Click <strong>+ Create</strong></li>
  <li>Enter the user's name and email</li>
  <li>Set a password</li>
  <li>Select an ACL to define their permissions</li>
  <li>Assign to an environment</li>
  <li>Click <strong>Save</strong></li>
</ol>

<h3>Editing a User</h3>
<ol>
  <li>Click on the user row to open the edit dialog</li>
  <li>Modify the desired fields</li>
  <li>Click <strong>Save</strong></li>
</ol>

<h3>Disabling a User</h3>
<p>Toggle the <strong>Enabled</strong> switch off to prevent the user from logging in without deleting their account.</p>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">ACLs — Defining Permissions</a></li>
  <li><a href="#">User Roles & Permission Levels</a></li>
</ul>
`,
  },
  {
    section: 'Users & Permissions',
    title: 'ACLs (Access Control Lists) — Defining Permissions',
    body: `
<h2>Overview</h2>
<p>ACLs (Access Control Lists) define what a user can see and do in the Voipappz admin portal. Each user is assigned an ACL that determines their access level.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>ACLs</strong> (under Settings).</p>

<h2>How ACLs Work</h2>
<ul>
  <li>An ACL is a named set of permissions (e.g., "Admin", "Operator", "Read-Only")</li>
  <li>Each permission controls access to a specific resource or action</li>
  <li>Users are assigned exactly one ACL</li>
  <li>ACLs can be customized to create any combination of permissions</li>
</ul>

<h2>Common ACL Patterns</h2>
<table>
  <tr><th>ACL Name</th><th>Typical Permissions</th><th>Use Case</th></tr>
  <tr><td>Admin</td><td>Full access to all resources</td><td>System administrators</td></tr>
  <tr><td>Operator</td><td>Manage calls, queues, extensions; no billing</td><td>Day-to-day operators</td></tr>
  <tr><td>Agent</td><td>View dashboard, handle calls; read-only config</td><td>Call center agents</td></tr>
  <tr><td>Read-Only</td><td>View all screens, no create/edit/delete</td><td>Supervisors, auditors</td></tr>
</table>

<h2>Step-by-Step Guide</h2>

<h3>Creating an ACL</h3>
<ol>
  <li>Navigate to <strong>ACLs</strong></li>
  <li>Click <strong>+ Create</strong></li>
  <li>Enter a descriptive name</li>
  <li>Configure permissions for each resource</li>
  <li>Click <strong>Save</strong></li>
</ol>

<h2>Tips</h2>
<ul>
  <li>Start with the most restrictive ACL and add permissions as needed</li>
  <li>Create role-based ACLs (Admin, Manager, Agent) rather than per-user ACLs</li>
  <li>Test new ACLs by creating a test user and verifying access</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Users Screen Overview</a></li>
  <li><a href="#">Creating & Managing Users</a></li>
</ul>
`,
  },

  // --- Section: Environments ---
  {
    section: 'Environments',
    title: 'What are Environments?',
    body: `
<h2>Overview</h2>
<p>Environments are the foundation of Voipappz's multi-tenant architecture. Each environment is an isolated container that holds its own set of DIDs, extensions, queues, IVRs, users, and all other resources.</p>

<h2>Why Environments?</h2>
<ul>
  <li><strong>Service Providers</strong> — Manage multiple customers from a single platform</li>
  <li><strong>Enterprises</strong> — Separate departments, offices, or business units</li>
  <li><strong>Testing</strong> — Create a sandbox environment for testing without affecting production</li>
</ul>

<h2>Key Points</h2>
<ul>
  <li>Every resource in Voipappz belongs to exactly one environment</li>
  <li>Users can be granted access to one or more environments</li>
  <li>Billing (subscriptions, tariffs, wallets) is per-environment</li>
  <li>The environment selector in the top bar filters all screens</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Creating & Managing Environments</a></li>
  <li><a href="#">Switching Between Environments</a></li>
  <li><a href="#">Environment-Scoped Resources</a></li>
</ul>
`,
  },
  {
    section: 'Environments',
    title: 'Creating & Managing Environments',
    body: `
<h2>Overview</h2>
<p>This guide covers how to create, edit, and manage environments in the admin portal.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Environments</strong>.</p>

<h2>Fields Reference</h2>
<table>
  <tr><th>Field</th><th>Description</th><th>Required</th></tr>
  <tr><td>Name</td><td>Environment display name (e.g., "Acme Corp")</td><td>Yes</td></tr>
  <tr><td>Enabled</td><td>Whether the environment is active</td><td>No (default: true)</td></tr>
  <tr><td>Description</td><td>Optional description for administrative reference</td><td>No</td></tr>
</table>

<h2>Step-by-Step Guide</h2>

<h3>Creating an Environment</h3>
<ol>
  <li>Click <strong>+ Create</strong></li>
  <li>Enter the environment name</li>
  <li>Optionally add a description</li>
  <li>Ensure <strong>Enabled</strong> is toggled on</li>
  <li>Click <strong>Save</strong></li>
</ol>

<h3>Editing an Environment</h3>
<ol>
  <li>Click on the environment row to open the edit dialog</li>
  <li>Modify the name, description, or enabled status</li>
  <li>Click <strong>Save</strong></li>
</ol>

<h3>Disabling an Environment</h3>
<p>Toggle <strong>Enabled</strong> off to temporarily disable an environment. This prevents calls from being processed for that environment's DIDs but preserves all configuration.</p>

<h2>Tips</h2>
<ul>
  <li>Use clear, consistent naming (company name or department)</li>
  <li>Create a test environment for configuration experiments</li>
  <li>Disabling is safer than deleting — you can re-enable later</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">What are Environments?</a></li>
  <li><a href="#">Setting Up a New Customer (End-to-End)</a></li>
</ul>
`,
  },

  // --- Section: Account Settings ---
  {
    section: 'Account Settings',
    title: 'Account & Profile Settings',
    body: `
<h2>Overview</h2>
<p>Manage your personal account settings, including profile information, notification preferences, and security settings.</p>

<h2>How to Access</h2>
<p>Click your <strong>user avatar/name</strong> in the top-right corner, then select <strong>Account</strong> or <strong>Profile</strong>.</p>

<h2>Available Settings</h2>

<h3>Profile</h3>
<ul>
  <li><strong>Name</strong> — Your display name in the system</li>
  <li><strong>Email</strong> — Your login email (may require admin to change)</li>
  <li><strong>Password</strong> — Change your password</li>
</ul>

<h3>Notifications</h3>
<ul>
  <li>Configure email notifications for system events</li>
  <li>Set up alerts for missed calls, queue thresholds, etc.</li>
</ul>

<h3>Security</h3>
<ul>
  <li>View recent login history</li>
  <li>Manage active sessions</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Logging In (2-Step OTP Authentication)</a></li>
  <li><a href="#">Users Screen Overview</a></li>
</ul>
`,
  },
];
