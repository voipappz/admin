/**
 * Monitoring & Reporting articles
 */

module.exports = [
  {
    section: 'Dashboard',
    title: 'Dashboard Overview',
    body: `
<h2>Overview</h2>
<p>The Dashboard provides a real-time overview of your communications system. It displays key performance indicators (KPIs), call metrics, and system health at a glance.</p>

<h2>How to Access</h2>
<p>Click <strong>Dashboard</strong> in the sidebar. The dashboard is also the default screen after login.</p>

<h2>Available Widgets</h2>
<ul>
  <li><strong>Active Calls</strong> — Current number of live calls</li>
  <li><strong>Calls Today</strong> — Total calls processed today</li>
  <li><strong>Average Duration</strong> — Average call duration</li>
  <li><strong>Answered vs. Missed</strong> — Call answer rate</li>
  <li><strong>Queue Status</strong> — Active callers in queues</li>
  <li><strong>Agent Status</strong> — Available, busy, and offline agents</li>
</ul>

<h2>Tips</h2>
<ul>
  <li>Data auto-refreshes — no need to reload the page</li>
  <li>Use the environment selector to view metrics for a specific environment</li>
  <li>Click on widgets to drill down to detailed reports</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Reports Screen Walkthrough</a></li>
  <li><a href="#">Live Monitoring</a></li>
</ul>
`,
  },
  {
    section: 'Live Monitoring',
    title: 'Live Calls Screen',
    body: `
<h2>Overview</h2>
<p>The Live screen shows all active calls in real-time. Supervisors can monitor, listen in, whisper to agents, or barge into calls.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Live</strong>.</p>

<h2>What You See</h2>
<ul>
  <li><strong>Active Calls List</strong> — All current calls with caller, destination, duration, and status</li>
  <li><strong>Call Actions</strong> — Buttons for spy, whisper, and barge</li>
  <li><strong>Real-Time Updates</strong> — List updates automatically as calls start and end</li>
</ul>

<h2>Call Actions</h2>
<table>
  <tr><th>Action</th><th>Description</th></tr>
  <tr><td><strong>Spy (Listen)</strong></td><td>Listen to the call silently — neither party hears you</td></tr>
  <tr><td><strong>Whisper</strong></td><td>Speak to the agent only — the caller doesn't hear you</td></tr>
  <tr><td><strong>Barge</strong></td><td>Join the call as a third party — both sides hear you</td></tr>
</table>

<h2>Tips</h2>
<ul>
  <li>Spy and barge require a registered extension or WebRTC dialer</li>
  <li>Use whisper for real-time coaching during difficult calls</li>
  <li>The live screen refreshes every few seconds automatically</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Spy & Barge Setup</a></li>
  <li><a href="#">Dashboard Overview</a></li>
</ul>
`,
  },
  {
    section: 'Call Logs & CDR',
    title: 'Call Logs Screen',
    body: `
<h2>Overview</h2>
<p>The Calls screen displays a complete history of all calls processed by the system. Each entry is a CDR (Call Detail Record) containing metadata about the call.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Calls</strong>.</p>

<h2>CDR Fields</h2>
<table>
  <tr><th>Field</th><th>Description</th></tr>
  <tr><td>Date/Time</td><td>When the call occurred</td></tr>
  <tr><td>Caller</td><td>The calling number</td></tr>
  <tr><td>Destination</td><td>The called number or extension</td></tr>
  <tr><td>Duration</td><td>Call length in seconds</td></tr>
  <tr><td>Status</td><td>Answered, missed, busy, failed</td></tr>
  <tr><td>Recording</td><td>Link to call recording (if enabled)</td></tr>
  <tr><td>Direction</td><td>Inbound or outbound</td></tr>
</table>

<h2>Search & Filters</h2>
<ul>
  <li><strong>Date Range</strong> — Filter calls by date period</li>
  <li><strong>Caller/Destination</strong> — Search by phone number</li>
  <li><strong>Status</strong> — Filter by answered, missed, etc.</li>
  <li><strong>Duration</strong> — Filter by call length</li>
  <li><strong>Direction</strong> — Inbound or outbound calls</li>
</ul>

<h2>Recordings</h2>
<p>If call recording is enabled, click the play icon to listen to the recording directly in the browser.</p>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Reports Screen Walkthrough</a></li>
  <li><a href="#">Dashboard Overview</a></li>
</ul>
`,
  },
  {
    section: 'Reports',
    title: 'Reports Screen Walkthrough',
    body: `
<h2>Overview</h2>
<p>The Reports screen provides analytics and exportable reports on call activity, agent performance, queue metrics, and more.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Reports</strong>.</p>

<h2>Available Report Types</h2>
<ul>
  <li><strong>Call Summary</strong> — Overview of call volume, duration, and answer rate</li>
  <li><strong>Agent Performance</strong> — Individual agent metrics (calls handled, average handle time)</li>
  <li><strong>Queue Performance</strong> — Queue statistics (wait time, abandon rate, SLA)</li>
  <li><strong>DID Usage</strong> — Call volume per DID</li>
  <li><strong>Hourly Distribution</strong> — Call patterns by time of day</li>
</ul>

<h2>Generating Reports</h2>
<ol>
  <li>Select the <strong>Report Type</strong></li>
  <li>Choose the <strong>Date Range</strong></li>
  <li>Apply any <strong>Filters</strong> (environment, queue, agent)</li>
  <li>Click <strong>Generate</strong></li>
  <li>Export as CSV or PDF if needed</li>
</ol>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Call Logs Screen</a></li>
  <li><a href="#">Dashboard Overview</a></li>
</ul>
`,
  },
  {
    section: 'System Health',
    title: 'System Health Monitor',
    body: `
<h2>Overview</h2>
<p>The Health Monitor screen provides visibility into the operational status of Voipappz platform components.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Health</strong> (under Settings or System).</p>

<h2>What's Monitored</h2>
<ul>
  <li><strong>Voice Engine</strong> — FreeSWITCH status and capacity</li>
  <li><strong>API Server</strong> — Backend service health</li>
  <li><strong>Database</strong> — Connection status and response time</li>
  <li><strong>SIP Trunks</strong> — Provider connection status</li>
  <li><strong>Redis</strong> — Cache and session storage status</li>
</ul>

<h2>System Logs</h2>
<p>View system logs for troubleshooting:</p>
<ul>
  <li>Error logs — System errors and failures</li>
  <li>Audit logs — User actions and configuration changes</li>
  <li>Call processing logs — Detailed call routing decisions</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Dashboard Overview</a></li>
  <li><a href="#">Why Can't I Make/Receive Calls?</a></li>
</ul>
`,
  },
];
