/**
 * Getting Started articles
 */

module.exports = [
  // --- Section: What is Voipappz? ---
  {
    section: 'What is Voipappz?',
    title: 'Platform Overview',
    body: `
<h2>Overview</h2>
<p>Voipappz is a cloud-based PBX and communications platform that enables businesses to manage voice, messaging, and automation from a single admin portal. Built for multi-tenant environments, Voipappz gives service providers and enterprises full control over phone numbers, call routing, IVR menus, queues, extensions, and AI-powered voice agents.</p>

<h2>Key Capabilities</h2>
<ul>
  <li><strong>Cloud PBX</strong> — Full-featured private branch exchange with no on-premise hardware required</li>
  <li><strong>Multi-Tenant Architecture</strong> — Manage multiple customers or departments from a single portal using Environments</li>
  <li><strong>Number Management (DIDs)</strong> — Provision, configure, and route phone numbers with flexible bridge types</li>
  <li><strong>Call Routing</strong> — IVR menus, call queues, time-based routing, caller ID matching, and more</li>
  <li><strong>Voice AI (Bots)</strong> — Build AI-powered voice agents with a visual Flow Builder</li>
  <li><strong>Automation</strong> — VML scripts, workflows, triggers, and webhooks</li>
  <li><strong>Real-Time Monitoring</strong> — Live call dashboard, spy/whisper/barge, call recordings</li>
  <li><strong>API-Driven</strong> — RESTful API for programmatic access to all platform features</li>
</ul>

<h2>Use Cases</h2>
<ul>
  <li><strong>Call Centers</strong> — Set up ACD queues, skills-based routing, and agent monitoring</li>
  <li><strong>Service Providers</strong> — White-label PBX platform for multiple customers</li>
  <li><strong>SMB Phone Systems</strong> — Simple yet powerful phone system with IVR and voicemail</li>
  <li><strong>AI Voice Agents</strong> — Automate customer interactions with intelligent voice bots</li>
  <li><strong>Click-to-Call</strong> — Embed calling into web applications and CRMs</li>
</ul>

<h2>System Requirements</h2>
<table>
  <tr><th>Requirement</th><th>Details</th></tr>
  <tr><td>Browser</td><td>Chrome 90+, Firefox 88+, Edge 90+, Safari 14+</td></tr>
  <tr><td>Internet</td><td>Stable broadband connection (minimum 1 Mbps per concurrent call)</td></tr>
  <tr><td>Audio</td><td>Headset recommended for WebRTC dialer</td></tr>
</table>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Logging in (2-step OTP authentication)</a></li>
  <li><a href="#">Navigating the Admin Panel</a></li>
  <li><a href="#">How a Call Flows Through the System</a></li>
</ul>
`,
  },
  {
    section: 'What is Voipappz?',
    title: 'System Architecture Overview',
    body: `
<h2>Overview</h2>
<p>Voipappz uses a layered architecture designed for reliability, scalability, and multi-tenancy. Understanding the high-level components helps administrators make better configuration decisions.</p>

<h2>Architecture Layers</h2>

<h3>1. Admin Portal (Frontend)</h3>
<p>The web-based admin panel where you manage all platform resources. Built with React and Material-UI, it communicates with the backend via RESTful APIs.</p>

<h3>2. API Layer (Backend)</h3>
<p>The Ruby/Sinatra API server handles authentication, resource management, and business logic. All operations — from creating a DID to configuring an IVR — go through this layer.</p>

<h3>3. Voice Engine</h3>
<p>The FreeSWITCH-based voice engine handles real-time call processing, media, and VoIP protocols. It executes the call routing logic defined in the admin portal.</p>

<h3>4. AI & Automation</h3>
<p>Pipecat-based voice AI pipeline for Bot agents, VML scripting engine for custom logic, and a workflow engine for process automation.</p>

<h3>5. Data Layer</h3>
<p>PostgreSQL for persistent storage, Redis for caching and real-time state, and InfluxDB for time-series metrics.</p>

<h2>How They Connect</h2>
<ol>
  <li>Administrator configures resources in the <strong>Admin Portal</strong></li>
  <li>Configuration is saved via the <strong>API Layer</strong> to the database</li>
  <li>When a call arrives, the <strong>Voice Engine</strong> reads the configuration and routes accordingly</li>
  <li>If the call hits a Bot bridge, the <strong>AI pipeline</strong> takes over</li>
  <li>All events are logged for <strong>monitoring and reporting</strong></li>
</ol>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Platform Overview</a></li>
  <li><a href="#">What is an Environment?</a></li>
</ul>
`,
  },

  // --- Section: Your Account ---
  {
    section: 'Your Account',
    title: 'Creating Your Account',
    body: `
<h2>Overview</h2>
<p>Your Voipappz account is created by your system administrator. Once your account exists, you'll receive credentials to log in to the admin portal.</p>

<h2>Account Setup</h2>
<ol>
  <li>Your administrator creates your user account in the <strong>Users</strong> screen</li>
  <li>You receive your login email address and temporary password</li>
  <li>Navigate to your Voipappz portal URL (e.g., <code>https://cloud.voipappz.io</code>)</li>
  <li>Log in using the 2-step OTP process</li>
  <li>Update your profile and password after first login</li>
</ol>

<h2>What You Need</h2>
<table>
  <tr><th>Item</th><th>Description</th></tr>
  <tr><td>Portal URL</td><td>Your organization's Voipappz URL</td></tr>
  <tr><td>Email</td><td>The email address associated with your account</td></tr>
  <tr><td>Password</td><td>Your account password</td></tr>
  <tr><td>Email Access</td><td>Access to your email inbox for OTP codes</td></tr>
</table>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Logging in (2-step OTP authentication)</a></li>
  <li><a href="#">Account & Profile Settings</a></li>
</ul>
`,
  },
  {
    section: 'Your Account',
    title: 'Logging In (2-Step OTP Authentication)',
    body: `
<h2>Overview</h2>
<p>Voipappz uses a 2-step OTP (One-Time Password) login process for enhanced security. After entering your email and password, you'll receive a verification code via email.</p>

<h2>Step-by-Step Login</h2>

<h3>Step 1: Enter Credentials</h3>
<ol>
  <li>Open your Voipappz portal URL in a supported browser</li>
  <li>Enter your <strong>Email</strong> address</li>
  <li>Enter your <strong>Password</strong></li>
  <li>Click <strong>Login</strong></li>
</ol>
<p>The system validates your credentials and sends a one-time verification code to your email.</p>

<h3>Step 2: Enter OTP Code</h3>
<ol>
  <li>Check your email inbox for the verification code</li>
  <li>Enter the <strong>6-digit OTP code</strong> in the verification field</li>
  <li>Click <strong>Verify</strong></li>
</ol>
<p>Upon successful verification, you're logged in and redirected to the dashboard.</p>

<h2>Troubleshooting</h2>
<table>
  <tr><th>Issue</th><th>Solution</th></tr>
  <tr><td>OTP code not received</td><td>Check your spam/junk folder. Wait 1-2 minutes for delivery.</td></tr>
  <tr><td>OTP code expired</td><td>Click "Resend Code" to get a new one.</td></tr>
  <tr><td>Account locked</td><td>After 5 failed attempts, your account is locked for 15 minutes. Wait and try again.</td></tr>
  <tr><td>Forgot password</td><td>Contact your system administrator to reset your password.</td></tr>
</table>

<h2>Security Notes</h2>
<ul>
  <li>OTP codes are valid for a limited time — enter them promptly</li>
  <li>Never share your OTP code with anyone</li>
  <li>5 consecutive failed login attempts trigger a 15-minute lockout</li>
  <li>Each OTP code can only be used once</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Creating Your Account</a></li>
  <li><a href="#">Navigating the Admin Panel</a></li>
</ul>
`,
  },
  {
    section: 'Your Account',
    title: 'Navigating the Admin Panel',
    body: `
<h2>Overview</h2>
<p>The Voipappz admin panel is organized into a sidebar navigation, top bar with environment selector, and a main content area. This guide walks you through the key areas.</p>

<h2>Main Navigation Areas</h2>

<h3>Sidebar</h3>
<p>The left sidebar provides access to all platform features, organized into logical groups:</p>
<ul>
  <li><strong>Dashboard</strong> — Overview with KPIs and metrics</li>
  <li><strong>DIDs</strong> — Phone number management</li>
  <li><strong>Extensions</strong> — Phone extensions and groups</li>
  <li><strong>IVR</strong> — Interactive voice menus</li>
  <li><strong>Queues</strong> — Call distribution queues</li>
  <li><strong>Call Conditions</strong> — Routing rules</li>
  <li><strong>Announcements</strong> — Audio messages and TTS</li>
  <li><strong>Bots</strong> — AI voice agents</li>
  <li><strong>VML</strong> — Voice Markup Language scripts</li>
  <li><strong>Workflows</strong> — Process automation</li>
  <li><strong>Live</strong> — Real-time call monitoring</li>
  <li><strong>Calls</strong> — Call logs and history</li>
  <li><strong>Reports</strong> — Analytics and exports</li>
  <li><strong>Users</strong> — User management</li>
  <li><strong>Settings</strong> — System configuration</li>
</ul>

<h3>Top Bar</h3>
<p>The top bar contains:</p>
<ul>
  <li><strong>Environment Selector</strong> — Switch between environments (multi-tenant)</li>
  <li><strong>Search</strong> — Global search across resources</li>
  <li><strong>Account Menu</strong> — Profile, settings, and logout</li>
</ul>

<h3>Content Area</h3>
<p>The main content area displays the active screen with tables, forms, and configuration panels. Most screens follow a consistent pattern:</p>
<ul>
  <li>A data table with sorting, filtering, and pagination</li>
  <li>Action buttons (Create, Edit, Delete)</li>
  <li>Dialog forms for creating or editing resources</li>
</ul>

<h2>Tips</h2>
<ul>
  <li>The sidebar can be collapsed for more screen space</li>
  <li>Use the environment selector to scope all data to a specific customer or department</li>
  <li>Most tables support column sorting by clicking the column header</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Understanding the Dashboard</a></li>
  <li><a href="#">Switching Between Environments</a></li>
</ul>
`,
  },
  {
    section: 'Your Account',
    title: 'Understanding the Dashboard',
    body: `
<h2>Overview</h2>
<p>The Dashboard is the first screen you see after logging in. It provides a real-time overview of your communications system with key performance indicators (KPIs) and activity widgets.</p>

<h2>How to Access</h2>
<p>Click <strong>Dashboard</strong> in the sidebar, or click the Voipappz logo to return to the dashboard from any screen.</p>

<h2>Dashboard Widgets</h2>
<ul>
  <li><strong>Active Calls</strong> — Current number of live calls in the system</li>
  <li><strong>Today's Calls</strong> — Total calls processed today</li>
  <li><strong>Call Duration</strong> — Average and total call duration metrics</li>
  <li><strong>System Status</strong> — Health indicators for platform services</li>
</ul>

<h2>Tips</h2>
<ul>
  <li>Dashboard data refreshes automatically — no need to reload</li>
  <li>Use the environment selector to view dashboard data for a specific environment</li>
  <li>Click on any widget to drill down into detailed reports</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Dashboard Overview (Monitoring)</a></li>
  <li><a href="#">Reports Screen Walkthrough</a></li>
</ul>
`,
  },

  // --- Section: Key Concepts ---
  {
    section: 'Key Concepts',
    title: 'What is a DID?',
    body: `
<h2>Overview</h2>
<p>A <strong>DID</strong> (Direct Inward Dialing) is a phone number that connects the outside world to your Voipappz system. When someone dials your DID, the call enters the platform and is routed according to the bridge configuration you've set up.</p>

<h2>Key Points</h2>
<ul>
  <li>A DID is the <strong>entry point</strong> for inbound calls</li>
  <li>Each DID has a <strong>bridge</strong> that determines where calls go</li>
  <li>DIDs can be SIP-based, PSTN, or toll-free numbers</li>
  <li>You can have multiple DIDs pointing to different destinations</li>
  <li>DIDs are scoped to an <strong>environment</strong> for multi-tenant isolation</li>
</ul>

<h2>Example</h2>
<p>Your business has the number <code>+1-555-0100</code>. This DID is configured with an IVR bridge, so callers hear "Press 1 for Sales, Press 2 for Support" and are routed accordingly.</p>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">What is a Bridge?</a></li>
  <li><a href="#">How a Call Flows Through the System</a></li>
  <li><a href="#">Phone Numbers Overview</a></li>
</ul>
`,
  },
  {
    section: 'Key Concepts',
    title: 'What is an Extension?',
    body: `
<h2>Overview</h2>
<p>An <strong>Extension</strong> is a numbered endpoint (e.g., 101, 102) that represents a phone, softphone, or device within your Voipappz system. Extensions are used for internal calling between team members and as destinations for inbound calls routed through DIDs.</p>

<h2>Key Points</h2>
<ul>
  <li>Extensions are <strong>internal identifiers</strong> for phones and devices</li>
  <li>Each extension registers with a SIP device (desk phone, softphone, or WebRTC)</li>
  <li>Extensions can be assigned to <strong>users</strong> for access control</li>
  <li>Extensions can be grouped into <strong>Extension Groups</strong></li>
  <li>DIDs can route calls to extensions via an <strong>Extension bridge</strong></li>
</ul>

<h2>Example</h2>
<p>Employee John has extension <code>101</code> registered to his desk phone. When a call is routed to extension 101, John's phone rings.</p>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Extensions Screen Walkthrough</a></li>
  <li><a href="#">Extension Bridge — Route to a Phone</a></li>
  <li><a href="#">Desk Phone Setup</a></li>
</ul>
`,
  },
  {
    section: 'Key Concepts',
    title: 'What is a Bridge?',
    body: `
<h2>Overview</h2>
<p>A <strong>Bridge</strong> is the routing mechanism that determines what happens when a call reaches a DID. Think of it as the "destination" — it bridges the incoming call to a specific target like a phone number, IVR menu, queue, or AI agent.</p>

<h2>Bridge Types</h2>
<table>
  <tr><th>Bridge Type</th><th>Description</th><th>Use Case</th></tr>
  <tr><td><strong>Number</strong></td><td>Forward to another phone number</td><td>Simple call forwarding</td></tr>
  <tr><td><strong>Extension</strong></td><td>Route to an internal extension</td><td>Direct-to-desk routing</td></tr>
  <tr><td><strong>Queue</strong></td><td>Route to a call queue</td><td>Call center / ACD</td></tr>
  <tr><td><strong>IVR</strong></td><td>Route to an interactive voice menu</td><td>"Press 1 for Sales..."</td></tr>
  <tr><td><strong>Announcement</strong></td><td>Play an audio message</td><td>After-hours message</td></tr>
  <tr><td><strong>Call Condition</strong></td><td>Route based on time/caller rules</td><td>Business hours routing</td></tr>
  <tr><td><strong>VML</strong></td><td>Route via a VML script</td><td>Custom logic</td></tr>
  <tr><td><strong>Bot</strong></td><td>Route to an AI voice agent</td><td>Automated customer service</td></tr>
</table>

<h2>How It Works</h2>
<ol>
  <li>A call arrives at a <strong>DID</strong></li>
  <li>The system checks the DID's <strong>bridge configuration</strong></li>
  <li>The call is routed to the bridge destination</li>
  <li>The destination handles the call (rings a phone, plays a menu, etc.)</li>
</ol>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Bridge Routing (detailed guide)</a></li>
  <li><a href="#">What is a DID?</a></li>
  <li><a href="#">How a Call Flows Through the System</a></li>
</ul>
`,
  },
  {
    section: 'Key Concepts',
    title: 'What is an Environment?',
    body: `
<h2>Overview</h2>
<p>An <strong>Environment</strong> is a logical container that isolates resources for a specific customer, department, or business unit. Environments enable multi-tenancy — multiple independent configurations running on the same Voipappz platform.</p>

<h2>Key Points</h2>
<ul>
  <li>All resources (DIDs, extensions, queues, etc.) belong to an environment</li>
  <li>Users can be scoped to one or more environments</li>
  <li>The <strong>environment selector</strong> in the top bar filters all data</li>
  <li>Environments provide complete <strong>data isolation</strong> between tenants</li>
  <li>Each environment has its own billing, subscriptions, and tariffs</li>
</ul>

<h2>Example</h2>
<p>A service provider manages three customers: Acme Corp, Beta LLC, and Gamma Inc. Each has its own environment with separate DIDs, extensions, and call routing — all managed from a single admin portal.</p>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Creating & Managing Environments</a></li>
  <li><a href="#">Switching Between Environments</a></li>
  <li><a href="#">Multi-Tenant Isolation</a></li>
</ul>
`,
  },
  {
    section: 'Key Concepts',
    title: 'How a Call Flows Through the System',
    body: `
<h2>Overview</h2>
<p>Understanding the call flow helps you design effective routing configurations. Here's how an inbound call travels through the Voipappz platform from start to finish.</p>

<h2>The Call Flow</h2>

<h3>1. Call Arrives at a DID</h3>
<p>An external caller dials your phone number (DID). The call enters the Voipappz voice engine via SIP from the PSTN provider.</p>

<h3>2. DID Lookup</h3>
<p>The system looks up the DID in the database and finds its bridge configuration.</p>

<h3>3. Bridge Routing</h3>
<p>Based on the bridge type, the call is routed:</p>
<ul>
  <li><strong>Number bridge</strong> → Forward to external number</li>
  <li><strong>Extension bridge</strong> → Ring the assigned phone</li>
  <li><strong>IVR bridge</strong> → Play voice menu, wait for keypad input</li>
  <li><strong>Queue bridge</strong> → Enter call queue, ring available agents</li>
  <li><strong>Call Condition bridge</strong> → Evaluate rules (time, caller ID), then route to matching destination</li>
  <li><strong>Announcement bridge</strong> → Play a message, then optionally route elsewhere</li>
  <li><strong>Bot bridge</strong> → Connect to AI voice agent</li>
</ul>

<h3>4. Destination Handling</h3>
<p>The destination (extension, agent, IVR) handles the call. This may involve further routing (e.g., IVR → Queue → Agent).</p>

<h3>5. Call Completion</h3>
<p>When the call ends, a CDR (Call Detail Record) is created with all metadata: duration, caller ID, destination, recording link, etc.</p>

<h2>Example Flow</h2>
<pre>
Caller → DID (+1-555-0100)
       → Call Condition (check business hours)
         → Business hours → IVR ("Press 1 Sales, 2 Support")
           → Press 1 → Sales Queue → Agent Extension 101
         → After hours → Announcement ("We're closed, please call back")
</pre>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">What is a DID?</a></li>
  <li><a href="#">What is a Bridge?</a></li>
  <li><a href="#">Call Conditions & Segments</a></li>
</ul>
`,
  },

  // --- Section: Glossary ---
  {
    section: 'Glossary',
    title: 'Voipappz Glossary (A-Z)',
    body: `
<h2>Overview</h2>
<p>A comprehensive reference of terms used throughout the Voipappz platform.</p>

<h2>A</h2>
<table>
  <tr><td><strong>ACD</strong></td><td><strong>Automatic Call Distribution</strong> — System that distributes incoming calls to available agents in a queue based on predefined strategies (round-robin, skills-based, etc.)</td></tr>
  <tr><td><strong>ACL</strong></td><td><strong>Access Control List</strong> — Defines what resources and actions a user is permitted to access in the admin portal</td></tr>
  <tr><td><strong>Announcement</strong></td><td>A pre-recorded audio message or TTS-generated message played to callers</td></tr>
</table>

<h2>B</h2>
<table>
  <tr><td><strong>Bot</strong></td><td>An AI-powered voice agent built with the Flow Builder that can handle conversations autonomously</td></tr>
  <tr><td><strong>Bridge</strong></td><td>The routing mechanism on a DID that determines where inbound calls are sent (e.g., to a number, extension, IVR, queue, etc.)</td></tr>
</table>

<h2>C</h2>
<table>
  <tr><td><strong>CDR</strong></td><td><strong>Call Detail Record</strong> — A log entry containing metadata about a completed call (duration, caller, destination, recording, etc.)</td></tr>
  <tr><td><strong>CLI</strong></td><td><strong>Caller Line Identification</strong> — The phone number displayed to the called party (Caller ID)</td></tr>
  <tr><td><strong>CNAM</strong></td><td><strong>Caller Name</strong> — The name associated with a phone number, displayed on supported devices</td></tr>
  <tr><td><strong>Call Condition</strong></td><td>A routing rule that evaluates criteria (time of day, caller ID, etc.) to determine call routing</td></tr>
</table>

<h2>D</h2>
<table>
  <tr><td><strong>DID</strong></td><td><strong>Direct Inward Dialing</strong> — A phone number that routes inbound calls into the Voipappz system</td></tr>
  <tr><td><strong>DTMF</strong></td><td><strong>Dual-Tone Multi-Frequency</strong> — The tones generated when pressing keys on a phone keypad (used for IVR navigation)</td></tr>
</table>

<h2>E</h2>
<table>
  <tr><td><strong>E.164</strong></td><td>International phone number format: <code>+[country code][number]</code> (e.g., +15550100)</td></tr>
  <tr><td><strong>Environment</strong></td><td>A logical container for multi-tenant resource isolation — each customer or department gets its own environment</td></tr>
  <tr><td><strong>Extension</strong></td><td>A numbered internal endpoint (e.g., 101) representing a phone, softphone, or device</td></tr>
</table>

<h2>F</h2>
<table>
  <tr><td><strong>FQDN</strong></td><td><strong>Fully Qualified Domain Name</strong> — Complete domain name for SIP registration (e.g., sip.voipappz.io)</td></tr>
</table>

<h2>I</h2>
<table>
  <tr><td><strong>IVR</strong></td><td><strong>Interactive Voice Response</strong> — A voice menu system that lets callers navigate options using their keypad</td></tr>
</table>

<h2>L</h2>
<table>
  <tr><td><strong>LCR</strong></td><td><strong>Least Cost Routing</strong> — Automatically selects the most cost-effective provider for outbound calls</td></tr>
</table>

<h2>M</h2>
<table>
  <tr><td><strong>MOH</strong></td><td><strong>Music on Hold</strong> — Audio played to callers while they wait in a queue or are on hold</td></tr>
</table>

<h2>O</h2>
<table>
  <tr><td><strong>OTP</strong></td><td><strong>One-Time Password</strong> — A temporary verification code sent via email during the 2-step login process</td></tr>
</table>

<h2>P</h2>
<table>
  <tr><td><strong>PBX</strong></td><td><strong>Private Branch Exchange</strong> — A telephone system that manages internal and external calls for an organization</td></tr>
  <tr><td><strong>PSTN</strong></td><td><strong>Public Switched Telephone Network</strong> — The traditional phone network</td></tr>
</table>

<h2>Q</h2>
<table>
  <tr><td><strong>Queue</strong></td><td>A call distribution system that holds incoming calls and routes them to available agents based on a strategy</td></tr>
</table>

<h2>S</h2>
<table>
  <tr><td><strong>Segment</strong></td><td>A reusable list of phone numbers used in Call Conditions for caller ID matching</td></tr>
  <tr><td><strong>SIP</strong></td><td><strong>Session Initiation Protocol</strong> — The signaling protocol used for VoIP calls</td></tr>
  <tr><td><strong>STIR/SHAKEN</strong></td><td>Caller ID authentication framework to combat robocalls and spoofing</td></tr>
</table>

<h2>T</h2>
<table>
  <tr><td><strong>TLS</strong></td><td><strong>Transport Layer Security</strong> — Encryption protocol for secure communications</td></tr>
  <tr><td><strong>TTS</strong></td><td><strong>Text-to-Speech</strong> — Technology that converts text into spoken audio</td></tr>
  <tr><td><strong>Tariff</strong></td><td>A pricing configuration that defines rates for calls</td></tr>
  <tr><td><strong>Trigger</strong></td><td>An event-driven automation that executes actions when specific conditions are met</td></tr>
</table>

<h2>V</h2>
<table>
  <tr><td><strong>VML</strong></td><td><strong>Voice Markup Language</strong> — A scripting language for defining custom voice application logic</td></tr>
</table>

<h2>W</h2>
<table>
  <tr><td><strong>WebRTC</strong></td><td><strong>Web Real-Time Communication</strong> — Browser-based technology for making voice calls without plugins</td></tr>
  <tr><td><strong>Webhook</strong></td><td>An HTTP callback that sends event data to an external URL when something happens</td></tr>
  <tr><td><strong>Workflow</strong></td><td>An automated sequence of steps that processes data or triggers actions</td></tr>
</table>
`,
  },
];
