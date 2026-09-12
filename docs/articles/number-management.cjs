/**
 * Number Management (DIDs) articles
 */

module.exports = [
  // --- Section: Phone Numbers Overview ---
  {
    section: 'Phone Numbers Overview',
    title: 'DIDs Screen Walkthrough',
    body: `
<h2>Overview</h2>
<p>The DIDs screen is where you manage all your phone numbers. Each DID represents an inbound number that routes calls into your Voipappz system through a configured bridge.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>DIDs</strong>.</p>

<h2>Screen Layout</h2>
<ul>
  <li><strong>Data Table</strong> — Lists all DIDs with columns: Name, Number, Bridge Type, Environment, Enabled, Created</li>
  <li><strong>Search/Filter</strong> — Filter by name, number, bridge type, or environment</li>
  <li><strong>+ Create Button</strong> — Opens the new DID dialog</li>
  <li><strong>Row Actions</strong> — Edit, duplicate, enable/disable, delete</li>
</ul>

<h2>Table Columns</h2>
<table>
  <tr><th>Column</th><th>Description</th></tr>
  <tr><td>Name</td><td>Display name for the DID</td></tr>
  <tr><td>Number</td><td>The phone number (E.164 format)</td></tr>
  <tr><td>Bridge Type</td><td>How calls are routed (number, extension, IVR, queue, etc.)</td></tr>
  <tr><td>Bridge</td><td>The specific destination resource</td></tr>
  <tr><td>Environment</td><td>Which environment this DID belongs to</td></tr>
  <tr><td>Enabled</td><td>Whether the DID is active</td></tr>
</table>

<h2>Filtering & Search</h2>
<ul>
  <li><strong>Name/Number</strong> — Text search across name and number fields</li>
  <li><strong>Bridge Type</strong> — Dropdown filter for specific bridge types</li>
  <li><strong>Environment</strong> — Filtered by the top-bar environment selector</li>
  <li><strong>Enabled</strong> — Filter active or inactive DIDs</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Creating a New DID</a></li>
  <li><a href="#">Bridge Types Overview</a></li>
  <li><a href="#">What is a DID?</a></li>
</ul>
`,
  },

  // --- Section: Ordering & Setup ---
  {
    section: 'Ordering & Setup',
    title: 'Creating a New DID',
    body: `
<h2>Overview</h2>
<p>Create a new DID to add a phone number to your system. Each DID requires a number, name, and bridge configuration to define how calls are routed.</p>

<h2>Step-by-Step Guide</h2>
<ol>
  <li>Navigate to <strong>DIDs</strong> in the sidebar</li>
  <li>Click <strong>+ Create</strong></li>
  <li>Enter the <strong>Name</strong> (display label)</li>
  <li>Enter the <strong>Number</strong> (phone number in E.164 format, e.g., +15550100)</li>
  <li>Select the <strong>Bridge Type</strong> (how calls will be routed)</li>
  <li>Configure the bridge destination based on the selected type</li>
  <li>Click <strong>Save</strong></li>
</ol>

<h2>Fields Reference</h2>
<table>
  <tr><th>Field</th><th>Description</th><th>Required</th></tr>
  <tr><td>Name</td><td>Display name for identification</td><td>Yes</td></tr>
  <tr><td>Number</td><td>Phone number (E.164 format)</td><td>Yes</td></tr>
  <tr><td>Bridge Type</td><td>Routing type (number, extension, IVR, queue, etc.)</td><td>Yes</td></tr>
  <tr><td>Bridge</td><td>Specific destination (varies by bridge type)</td><td>Depends on type</td></tr>
  <tr><td>Enabled</td><td>Whether the DID is active</td><td>No (default: true)</td></tr>
  <tr><td>Meta</td><td>Additional metadata</td><td>No</td></tr>
</table>

<h2>Tips</h2>
<ul>
  <li>Use a descriptive name like "Main Office Line" or "Support Hotline"</li>
  <li>The number must be unique within your environment</li>
  <li>You can change the bridge type and destination after creation</li>
  <li>Create the DID first, then configure advanced bridge settings</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Bridge Types Overview</a></li>
  <li><a href="#">Editing DID Settings</a></li>
</ul>
`,
  },
  {
    section: 'Ordering & Setup',
    title: 'Editing DID Settings',
    body: `
<h2>Overview</h2>
<p>Edit an existing DID to change its name, number, bridge configuration, or other settings.</p>

<h2>How to Edit</h2>
<ol>
  <li>Navigate to <strong>DIDs</strong></li>
  <li>Click on the DID row you want to edit</li>
  <li>The edit dialog opens with current values pre-filled</li>
  <li>Modify the desired fields</li>
  <li>Click <strong>Save</strong></li>
</ol>

<h2>What You Can Change</h2>
<ul>
  <li><strong>Name</strong> — Update the display name</li>
  <li><strong>Number</strong> — Change the phone number</li>
  <li><strong>Bridge Type & Destination</strong> — Reroute calls to a different destination</li>
  <li><strong>Enabled/Disabled</strong> — Activate or deactivate the DID</li>
</ul>

<h2>Tips</h2>
<ul>
  <li>Changing the bridge type on an active DID takes effect immediately</li>
  <li>Use the <strong>Duplicate</strong> feature to create a similar DID without starting from scratch</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Creating a New DID</a></li>
  <li><a href="#">Bridge Types Overview</a></li>
</ul>
`,
  },
  {
    section: 'Ordering & Setup',
    title: 'Enabling, Disabling, and Deleting DIDs',
    body: `
<h2>Overview</h2>
<p>Manage the lifecycle of your DIDs — enable them for active use, disable them temporarily, or delete them permanently.</p>

<h2>Enabling / Disabling</h2>
<p>Toggle the <strong>Enabled</strong> switch on the DID to control whether it accepts calls:</p>
<ul>
  <li><strong>Enabled</strong> — DID is active and will route incoming calls</li>
  <li><strong>Disabled</strong> — DID exists but incoming calls are not processed</li>
</ul>
<p>Disabling a DID is useful for maintenance or temporary suspension without losing configuration.</p>

<h2>Deleting a DID</h2>
<ol>
  <li>Click the <strong>delete icon</strong> on the DID row</li>
  <li>Confirm the deletion in the dialog</li>
</ol>
<p><strong>Warning:</strong> Deleting a DID is permanent. All call routing to that number will stop immediately. Consider disabling instead if you might need the number again.</p>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">DIDs Screen Walkthrough</a></li>
  <li><a href="#">Creating a New DID</a></li>
</ul>
`,
  },

  // --- Section: Bridge Routing ---
  {
    section: 'Bridge Routing',
    title: 'Bridge Types Overview',
    body: `
<h2>Overview</h2>
<p>Bridges define how incoming calls on a DID are routed. Voipappz supports 8 bridge types, each designed for a different routing scenario.</p>

<h2>Bridge Types at a Glance</h2>
<table>
  <tr><th>Type</th><th>Description</th><th>Best For</th></tr>
  <tr><td><strong>Number</strong></td><td>Forward to an external phone number</td><td>Simple call forwarding</td></tr>
  <tr><td><strong>Extension</strong></td><td>Route to an internal extension/phone</td><td>Direct desk routing</td></tr>
  <tr><td><strong>Queue</strong></td><td>Route to a call distribution queue</td><td>Call centers, support teams</td></tr>
  <tr><td><strong>IVR</strong></td><td>Route to an interactive voice menu</td><td>"Press 1 for Sales" menus</td></tr>
  <tr><td><strong>Announcement</strong></td><td>Play an audio message</td><td>After-hours, closures</td></tr>
  <tr><td><strong>Call Condition</strong></td><td>Route based on time/caller rules</td><td>Business hours, VIP routing</td></tr>
  <tr><td><strong>VML</strong></td><td>Route via a VML script</td><td>Custom routing logic</td></tr>
  <tr><td><strong>Bot</strong></td><td>Route to an AI voice agent</td><td>Automated conversations</td></tr>
</table>

<h2>Choosing a Bridge Type</h2>
<ul>
  <li><strong>Simple forwarding?</strong> → Number bridge</li>
  <li><strong>Ring a specific phone?</strong> → Extension bridge</li>
  <li><strong>Distribute calls across a team?</strong> → Queue bridge</li>
  <li><strong>Let callers choose a department?</strong> → IVR bridge</li>
  <li><strong>Route differently by time of day?</strong> → Call Condition bridge</li>
  <li><strong>Play a message?</strong> → Announcement bridge</li>
  <li><strong>Custom logic?</strong> → VML bridge</li>
  <li><strong>AI-powered?</strong> → Bot bridge</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Number Bridge — Forward to Another Number</a></li>
  <li><a href="#">Extension Bridge — Route to a Phone</a></li>
  <li><a href="#">Queue Bridge — Route to Call Queue</a></li>
  <li><a href="#">IVR Bridge — Route to Voice Menu</a></li>
</ul>
`,
  },
  {
    section: 'Bridge Routing',
    title: 'Number Bridge — Forward to Another Number',
    body: `
<h2>Overview</h2>
<p>The Number bridge forwards incoming calls to an external phone number. This is the simplest bridge type — the call is simply redirected to the specified destination number.</p>

<h2>When to Use</h2>
<ul>
  <li>Forward calls to a mobile phone</li>
  <li>Redirect to another office or location</li>
  <li>Simple call forwarding without IVR or queues</li>
</ul>

<h2>Configuration</h2>
<table>
  <tr><th>Field</th><th>Description</th></tr>
  <tr><td>Destination Number</td><td>The phone number to forward calls to (E.164 format)</td></tr>
</table>
<p>The Number bridge is auto-configured — simply enter the destination number when creating or editing the DID.</p>

<h2>Example</h2>
<p>DID <code>+1-555-0100</code> → Number bridge → <code>+1-555-9999</code> (owner's mobile)</p>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Bridge Types Overview</a></li>
  <li><a href="#">Creating a New DID</a></li>
</ul>
`,
  },
  {
    section: 'Bridge Routing',
    title: 'Extension Bridge — Route to a Phone',
    body: `
<h2>Overview</h2>
<p>The Extension bridge routes incoming calls to a specific internal extension. When the call arrives, the phone registered to that extension rings.</p>

<h2>When to Use</h2>
<ul>
  <li>Direct-to-desk routing for specific employees</li>
  <li>Personal DID numbers that ring one phone</li>
</ul>

<h2>Configuration</h2>
<table>
  <tr><th>Field</th><th>Description</th></tr>
  <tr><td>Extension</td><td>Select the extension to route calls to</td></tr>
</table>

<h2>Example</h2>
<p>DID <code>+1-555-0101</code> → Extension bridge → Extension 101 (John's desk phone)</p>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Bridge Types Overview</a></li>
  <li><a href="#">What is an Extension?</a></li>
  <li><a href="#">Extensions Screen Walkthrough</a></li>
</ul>
`,
  },
  {
    section: 'Bridge Routing',
    title: 'Queue Bridge — Route to Call Queue',
    body: `
<h2>Overview</h2>
<p>The Queue bridge routes incoming calls to a call distribution queue. Callers wait in line and are connected to available agents based on the queue's distribution strategy.</p>

<h2>When to Use</h2>
<ul>
  <li>Call centers and support teams</li>
  <li>Any scenario where calls need to be distributed across multiple agents</li>
</ul>

<h2>Configuration</h2>
<table>
  <tr><th>Field</th><th>Description</th></tr>
  <tr><td>Queue</td><td>Select an existing queue from the dropdown</td></tr>
</table>
<p><strong>Note:</strong> The queue must already exist. Create it in the <strong>Queues</strong> screen first.</p>

<h2>Example</h2>
<p>DID <code>+1-555-0200</code> → Queue bridge → "Sales Queue" (agents 101, 102, 103)</p>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Bridge Types Overview</a></li>
  <li><a href="#">What is a Queue?</a></li>
  <li><a href="#">Creating a Queue</a></li>
</ul>
`,
  },
  {
    section: 'Bridge Routing',
    title: 'IVR Bridge — Route to Voice Menu',
    body: `
<h2>Overview</h2>
<p>The IVR bridge routes incoming calls to an Interactive Voice Response menu. Callers hear a greeting and can navigate options using their phone keypad (DTMF tones).</p>

<h2>When to Use</h2>
<ul>
  <li>"Press 1 for Sales, Press 2 for Support" menus</li>
  <li>Multi-department routing with caller self-service</li>
  <li>Automated information systems</li>
</ul>

<h2>Configuration</h2>
<table>
  <tr><th>Field</th><th>Description</th></tr>
  <tr><td>IVR</td><td>Select an existing IVR menu from the dropdown</td></tr>
</table>
<p><strong>Note:</strong> The IVR must already exist. Create it in the <strong>IVR</strong> screen first.</p>

<h2>Example</h2>
<p>DID <code>+1-555-0300</code> → IVR bridge → "Main Menu" (1=Sales, 2=Support, 3=Billing)</p>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Bridge Types Overview</a></li>
  <li><a href="#">What is an IVR?</a></li>
  <li><a href="#">Creating an IVR Menu</a></li>
</ul>
`,
  },
  {
    section: 'Bridge Routing',
    title: 'Announcement Bridge — Play a Message',
    body: `
<h2>Overview</h2>
<p>The Announcement bridge plays a pre-recorded audio message or TTS-generated message to the caller. After the message plays, the call typically ends or can be routed elsewhere.</p>

<h2>When to Use</h2>
<ul>
  <li>After-hours greetings ("We're closed, please call back during business hours")</li>
  <li>Holiday closures</li>
  <li>Information hotlines</li>
  <li>Temporary messages</li>
</ul>

<h2>Configuration</h2>
<table>
  <tr><th>Field</th><th>Description</th></tr>
  <tr><td>Announcement</td><td>Select an existing announcement or create a new one inline</td></tr>
</table>
<p>You can create a new announcement directly from the DID creation dialog by clicking <strong>Create New Announcement</strong>.</p>

<h2>Example</h2>
<p>DID <code>+1-555-0400</code> → Announcement bridge → "Thank you for calling. Our office is currently closed."</p>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Bridge Types Overview</a></li>
  <li><a href="#">What is an Announcement?</a></li>
  <li><a href="#">Uploading Audio Files</a></li>
</ul>
`,
  },
  {
    section: 'Bridge Routing',
    title: 'Call Condition Bridge — Time/Caller-Based Routing',
    body: `
<h2>Overview</h2>
<p>The Call Condition bridge evaluates routing rules (time of day, caller ID, destination) and routes the call to different destinations based on matching criteria. This is how you implement business hours routing.</p>

<h2>When to Use</h2>
<ul>
  <li>Business hours vs. after-hours routing</li>
  <li>VIP caller routing (specific callers go to priority queue)</li>
  <li>Geographic routing based on caller's number</li>
  <li>Any conditional routing logic</li>
</ul>

<h2>Configuration</h2>
<table>
  <tr><th>Field</th><th>Description</th></tr>
  <tr><td>Call Condition</td><td>Select an existing call condition or create a new one inline</td></tr>
</table>

<h2>Example</h2>
<p>DID <code>+1-555-0500</code> → Call Condition bridge → "Business Hours"</p>
<ul>
  <li>Mon-Fri 9am-5pm → IVR Main Menu</li>
  <li>All other times → Announcement "We're closed"</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Bridge Types Overview</a></li>
  <li><a href="#">What is a Call Condition?</a></li>
  <li><a href="#">Time-Based Routing</a></li>
  <li><a href="#">Caller ID Matching</a></li>
</ul>
`,
  },
  {
    section: 'Bridge Routing',
    title: 'VML Bridge — Route via Script',
    body: `
<h2>Overview</h2>
<p>The VML (Voice Markup Language) bridge routes calls through a custom script that can perform complex routing logic, API calls, database lookups, and more.</p>

<h2>When to Use</h2>
<ul>
  <li>Complex routing that can't be achieved with standard bridge types</li>
  <li>Integration with external systems via API calls</li>
  <li>Custom business logic</li>
</ul>

<h2>Configuration</h2>
<table>
  <tr><th>Field</th><th>Description</th></tr>
  <tr><td>VML Script</td><td>Select an existing VML script or create a new one inline</td></tr>
</table>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Bridge Types Overview</a></li>
  <li><a href="#">What is VML?</a></li>
  <li><a href="#">VML Screen Walkthrough</a></li>
</ul>
`,
  },
  {
    section: 'Bridge Routing',
    title: 'Bot Bridge — Route to AI Voice Agent',
    body: `
<h2>Overview</h2>
<p>The Bot bridge routes incoming calls to an AI-powered voice agent. The bot handles the conversation autonomously using the flow you've designed in the Flow Builder.</p>

<h2>When to Use</h2>
<ul>
  <li>Automated customer service (FAQs, account inquiries)</li>
  <li>Appointment scheduling</li>
  <li>Lead qualification</li>
  <li>After-hours support with AI</li>
</ul>

<h2>Configuration</h2>
<table>
  <tr><th>Field</th><th>Description</th></tr>
  <tr><td>Bot</td><td>Select an existing bot from the dropdown</td></tr>
</table>
<p><strong>Note:</strong> The bot must already exist and be configured in the <strong>Bots</strong> screen.</p>

<h2>Example</h2>
<p>DID <code>+1-555-0700</code> → Bot bridge → "Support Bot" (handles common questions, escalates to agent when needed)</p>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Bridge Types Overview</a></li>
  <li><a href="#">What is a Bot?</a></li>
  <li><a href="#">Bots Screen Walkthrough</a></li>
</ul>
`,
  },

  // --- Section: Number Features ---
  {
    section: 'Number Features',
    title: 'Caller ID Configuration',
    body: `
<h2>Overview</h2>
<p>Configure the Caller ID (CLI) displayed when making outbound calls from your Voipappz system. Proper Caller ID configuration ensures your calls are identified correctly.</p>

<h2>Key Concepts</h2>
<ul>
  <li><strong>Caller ID Number (CLI)</strong> — The phone number displayed to the called party</li>
  <li><strong>Caller Name (CNAM)</strong> — The name displayed (if supported by the carrier)</li>
  <li><strong>STIR/SHAKEN</strong> — Authentication framework that validates Caller ID to prevent spoofing</li>
</ul>

<h2>Configuration</h2>
<p>Caller ID settings can be configured at multiple levels:</p>
<ul>
  <li><strong>DID level</strong> — Set the outbound Caller ID for calls from a specific DID</li>
  <li><strong>Extension level</strong> — Set per-extension Caller ID</li>
  <li><strong>Environment level</strong> — Default Caller ID for all outbound calls in an environment</li>
</ul>

<h2>Tips</h2>
<ul>
  <li>Use a valid, registered DID as your Caller ID to ensure deliverability</li>
  <li>Mismatched Caller IDs may be flagged as spam by carriers</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">DIDs Screen Walkthrough</a></li>
  <li><a href="#">Extensions Screen Walkthrough</a></li>
</ul>
`,
  },
];
