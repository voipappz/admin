/**
 * How-To Guides & Scenarios articles
 */

module.exports = [
  // --- Section: Setup Scenarios ---
  {
    section: 'Setup Scenarios',
    title: 'Setting Up a New Customer (End-to-End)',
    body: `
<h2>Overview</h2>
<p>This guide walks you through the complete process of setting up a new customer on Voipappz — from creating their environment to configuring their first DID and call routing.</p>

<h2>Prerequisites</h2>
<ul>
  <li>Admin access to the Voipappz portal</li>
  <li>Customer information (company name, users, phone numbers)</li>
  <li>Available DID numbers</li>
</ul>

<h2>Step-by-Step Guide</h2>

<h3>Step 1: Create the Environment</h3>
<ol>
  <li>Navigate to <strong>Environments</strong></li>
  <li>Click <strong>+ Create</strong></li>
  <li>Enter the customer name</li>
  <li>Enable the environment</li>
  <li>Click <strong>Save</strong></li>
</ol>

<h3>Step 2: Create User Accounts</h3>
<ol>
  <li>Switch to the new environment using the top-bar selector</li>
  <li>Navigate to <strong>Users</strong></li>
  <li>Create user accounts for the customer's team</li>
  <li>Assign appropriate ACLs</li>
</ol>

<h3>Step 3: Create Extensions</h3>
<ol>
  <li>Navigate to <strong>Extensions</strong></li>
  <li>Create extensions for each user/phone</li>
  <li>Share SIP credentials with users for phone registration</li>
</ol>

<h3>Step 4: Set Up a Subscription</h3>
<ol>
  <li>Navigate to <strong>Subscriptions</strong></li>
  <li>Create a subscription for the environment</li>
  <li>Associate a tariff and set the balance</li>
</ol>

<h3>Step 5: Configure DIDs</h3>
<ol>
  <li>Navigate to <strong>DIDs</strong></li>
  <li>Create a DID with the customer's phone number</li>
  <li>Configure the bridge (e.g., IVR for multi-department routing)</li>
</ol>

<h3>Step 6: Set Up Call Routing</h3>
<p>Depending on the customer's needs:</p>
<ul>
  <li><strong>Simple:</strong> DID → Extension (direct routing)</li>
  <li><strong>Standard:</strong> DID → IVR → Queues/Extensions</li>
  <li><strong>Advanced:</strong> DID → Call Condition (business hours) → IVR → Queues</li>
</ul>

<h3>Step 7: Test</h3>
<ol>
  <li>Register a phone on one of the extensions</li>
  <li>Call the DID from an external number</li>
  <li>Verify the call routes correctly through the configuration</li>
</ol>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Creating & Managing Environments</a></li>
  <li><a href="#">Creating a New DID</a></li>
  <li><a href="#">Creating an IVR Menu</a></li>
</ul>
`,
  },
  {
    section: 'Setup Scenarios',
    title: 'Configure Business Hours Routing',
    body: `
<h2>Overview</h2>
<p>Set up routing so calls go to your IVR during business hours and an after-hours announcement at other times.</p>

<h2>Step-by-Step Guide</h2>

<h3>Step 1: Create the After-Hours Announcement</h3>
<ol>
  <li>Navigate to <strong>Announcements</strong></li>
  <li>Create an announcement: "Thank you for calling. Our office is currently closed. Please call back Monday through Friday, 9 AM to 5 PM."</li>
</ol>

<h3>Step 2: Create Your IVR (Business Hours Menu)</h3>
<ol>
  <li>Navigate to <strong>IVR</strong></li>
  <li>Create an IVR with your business hours menu options</li>
</ol>

<h3>Step 3: Create the Call Condition</h3>
<ol>
  <li>Navigate to <strong>Call Conditions</strong></li>
  <li>Click <strong>+ Create</strong></li>
  <li>Name it "Business Hours"</li>
  <li>Add a routing resource:
    <ul>
      <li>Condition: Time — Mon-Fri 09:00-17:00</li>
      <li>Destination: Your IVR</li>
    </ul>
  </li>
  <li>Set fallback: After-Hours Announcement</li>
  <li>Save</li>
</ol>

<h3>Step 4: Assign to DID</h3>
<ol>
  <li>Navigate to <strong>DIDs</strong></li>
  <li>Edit your DID</li>
  <li>Set bridge type to <strong>Call Condition</strong></li>
  <li>Select "Business Hours"</li>
  <li>Save</li>
</ol>

<h2>Result</h2>
<ul>
  <li><strong>Mon-Fri 9am-5pm:</strong> Callers hear the IVR menu</li>
  <li><strong>All other times:</strong> Callers hear the after-hours message</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">What is a Call Condition?</a></li>
  <li><a href="#">Time-Based Routing</a></li>
  <li><a href="#">Creating an IVR Menu</a></li>
</ul>
`,
  },
  {
    section: 'Setup Scenarios',
    title: 'Set Up Automatic Call Distribution (ACD)',
    body: `
<h2>Overview</h2>
<p>Set up ACD to distribute incoming calls evenly across your support or sales team using queues.</p>

<h2>Step-by-Step Guide</h2>

<h3>Step 1: Create Extensions for Agents</h3>
<ol>
  <li>Navigate to <strong>Extensions</strong></li>
  <li>Create extensions for each agent (e.g., 201, 202, 203)</li>
  <li>Have agents register their phones</li>
</ol>

<h3>Step 2: Create the Queue</h3>
<ol>
  <li>Navigate to <strong>Queues</strong></li>
  <li>Click <strong>+ Create</strong></li>
  <li>Name: "Support Queue"</li>
  <li>Strategy: Round Robin (or your preferred strategy)</li>
  <li>Set Music on Hold</li>
  <li>Set timeout and fallback (e.g., voicemail after 2 minutes)</li>
  <li>Save</li>
</ol>

<h3>Step 3: Add Agents</h3>
<ol>
  <li>Open the queue</li>
  <li>Add agent extensions (201, 202, 203)</li>
  <li>Set agent priority if using skills-based routing</li>
</ol>

<h3>Step 4: Route DID to Queue</h3>
<ol>
  <li>Navigate to <strong>DIDs</strong></li>
  <li>Edit your support DID</li>
  <li>Set bridge type to <strong>Queue</strong></li>
  <li>Select "Support Queue"</li>
  <li>Save</li>
</ol>

<h2>Result</h2>
<p>Calls to the support number enter the queue, hear music on hold, and are connected to the next available agent in round-robin order.</p>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">What is a Queue?</a></li>
  <li><a href="#">Queue Strategy (Round-Robin, Ring-All, etc.)</a></li>
  <li><a href="#">Creating a Queue</a></li>
</ul>
`,
  },

  // --- Section: Integrations ---
  {
    section: 'Integrations',
    title: 'Click2Call Installation Guide',
    body: `
<h2>Overview</h2>
<p>Click2Call places an outbound call from one of your SIP extensions to any destination number, using a single authenticated HTTP request. The system rings your extension first; when you answer, it bridges you to the destination.</p>
<p>It is available as a button on every row of the <strong>Extensions</strong> screen in the admin portal, and — because it is just a URL — it can also be triggered from a CRM, a help-desk macro, or any script that can make an HTTP request.</p>

<h2>Before you start: something must be registered to the extension</h2>
<p>This is the single most common reason Click2Call appears not to work.</p>
<p>An extension is a <strong>SIP account</strong>, not a phone. Click2Call rings the account — so a device has to be <em>registered</em> to it for the call to land anywhere. That device can be a desk phone, a softphone such as ZoiPer or MicroSIP, or the WebRTC dialer in the portal.</p>
<p><strong>If nothing is registered to the extension, the call is still created but has nowhere to ring.</strong> You will see a call record and no phone will ring. Confirm the extension shows as registered before troubleshooting anything else.</p>

<h2>How it works</h2>
<ol>
  <li>You trigger Click2Call for an extension and enter a destination number.</li>
  <li>The portal sends an authenticated <code>GET</code> request to the platform.</li>
  <li>The platform validates the domain, the extension and the Click2Call token.</li>
  <li>It creates a call: <strong>leg A</strong> is your extension, <strong>leg B</strong> is the destination number.</li>
  <li>Your registered device rings. When you answer, the two legs are bridged.</li>
</ol>

<h2>Using it from the Extensions screen</h2>
<ol>
  <li>Open <strong>Extensions</strong> and find the extension you want to call from.</li>
  <li>Click the <strong>Click to Call</strong> button on that row.</li>
  <li>Enter the destination number and submit.</li>
  <li>Answer on the device registered to that extension.</li>
</ol>
<p>The dialog also shows the full request URL in a copyable field, which is the easiest way to get a working URL for use elsewhere.</p>

<h2>Calling it from your own system</h2>
<p>The request is a single <code>GET</code>. There is no JavaScript snippet or SDK to install.</p>
<pre><code>GET https://&lt;your-portal-host&gt;/custom/click2call
      ?token=&lt;click2call_token&gt;
      &amp;domain=&lt;sip-domain&gt;
      &amp;username=&lt;extension&gt;
      &amp;number=&lt;destination&gt;
      &amp;caller_id_number=&lt;optional-caller-id&gt;</code></pre>

<table>
  <thead><tr><th>Parameter</th><th>Required</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td><code>token</code></td><td>Yes</td><td>The environment's Click2Call token. See Authentication below.</td></tr>
    <tr><td><code>domain</code></td><td>Yes</td><td>The SIP domain — the part <em>after</em> the <code>@</code> in the extension's username. Must be a domain registered to your organization.</td></tr>
    <tr><td><code>username</code></td><td>Yes</td><td>The extension — the part <em>before</em> the <code>@</code>.</td></tr>
    <tr><td><code>number</code></td><td>Yes</td><td>The destination to dial.</td></tr>
    <tr><td><code>caller_id_number</code></td><td>No</td><td>Caller ID presented to the destination. Omit to use the environment default.</td></tr>
  </tbody>
</table>
<p>For an extension of <code>1010@pbx.example.com</code>, that is <code>username=1010</code> and <code>domain=pbx.example.com</code>.</p>

<h2>Authentication</h2>
<p>Click2Call is authorized by a <strong>per-environment Click2Call token</strong> — not by your admin login. This is what allows the URL to be used from an external system that has no portal session.</p>
<p>The token lives in the environment's profile and applies to every extension in that environment. If the environment has no token configured, Click2Call cannot work for its extensions.</p>
<p>Treat the token as a credential: anyone holding it can originate calls from your extensions. Do not embed it in a public web page. Every accepted and every rejected request is recorded in the audit log.</p>

<h2>Troubleshooting</h2>
<table>
  <thead><tr><th>What you see</th><th>What it usually means</th></tr></thead>
  <tbody>
    <tr><td>Call is created, no phone rings</td><td>No device is registered to the extension. Open the WebRTC dialer or register a softphone, then retry.</td></tr>
    <tr><td><code>Invalid click2call token</code></td><td>The token is missing, or does not match the one on the extension's environment.</td></tr>
    <tr><td><code>Invalid Domain</code></td><td>The <code>domain</code> value is not one of your organization's SIP domains, or was taken from the wrong side of the <code>@</code>.</td></tr>
    <tr><td><code>Invalid extension</code></td><td>No extension matches that username and domain pair.</td></tr>
    <tr><td><code>Invalid Number</code></td><td>The <code>number</code> parameter is empty.</td></tr>
    <tr><td>Rings, but the destination never connects</td><td>Leg B could not be routed. Check your outbound routes and the dialled prefix.</td></tr>
  </tbody>
</table>

<h2>Related Articles</h2>
<ul>
  <li><a href="https://voipappz.zendesk.com/hc/en-us/articles/34576853826450-Extensions-Screen-Walkthrough">Extensions Screen Walkthrough</a></li>
  <li><a href="https://voipappz.zendesk.com/hc/en-us/articles/34576853914514-WebRTC-Portal-Dialer">WebRTC Portal Dialer</a></li>
  <li><a href="https://voipappz.zendesk.com/hc/en-us/articles/34576853369106-What-are-Environments">What are Environments?</a></li>
  <li><a href="https://voipappz.zendesk.com/hc/en-us/articles/34576854255890-Why-Can-t-I-Make-or-Receive-Calls">Why Can't I Make or Receive Calls?</a></li>
</ul>
`,
  },

  // --- Section: Troubleshooting ---
  {
    section: 'Troubleshooting',
    title: "Why Can't I Make or Receive Calls?",
    body: `
<h2>Overview</h2>
<p>If you're unable to make or receive calls, follow this troubleshooting checklist to identify and resolve the issue.</p>

<h2>Common Causes & Solutions</h2>

<h3>1. Extension Not Registered</h3>
<p><strong>Symptom:</strong> Phone shows "Unregistered" or "No Service"</p>
<p><strong>Solution:</strong></p>
<ul>
  <li>Verify the SIP server address in your phone settings</li>
  <li>Check username (extension number) and password</li>
  <li>Ensure network connectivity (try pinging the SIP server)</li>
  <li>Check if the extension is enabled in the admin portal</li>
</ul>

<h3>2. DID Not Configured</h3>
<p><strong>Symptom:</strong> External callers get "number not in service"</p>
<p><strong>Solution:</strong></p>
<ul>
  <li>Verify the DID exists and is enabled</li>
  <li>Check that the bridge is properly configured</li>
  <li>Ensure the environment is enabled</li>
</ul>

<h3>3. Subscription/Balance Issue</h3>
<p><strong>Symptom:</strong> Outbound calls fail immediately</p>
<p><strong>Solution:</strong></p>
<ul>
  <li>Check the wallet balance — it may be empty</li>
  <li>Verify the subscription is active</li>
  <li>Ensure the tariff covers the destination being called</li>
</ul>

<h3>4. Network/Firewall Issue</h3>
<p><strong>Symptom:</strong> One-way audio, choppy audio, or registration drops</p>
<p><strong>Solution:</strong></p>
<ul>
  <li>Ensure SIP ports are open (typically 5060 UDP/TCP, 5061 TLS)</li>
  <li>Ensure RTP ports are open (typically 10000-20000 UDP)</li>
  <li>Check for SIP ALG on your router (disable if enabled)</li>
  <li>Test from a different network to isolate the issue</li>
</ul>

<h3>5. ACL Permissions</h3>
<p><strong>Symptom:</strong> User can see the portal but can't make calls</p>
<p><strong>Solution:</strong></p>
<ul>
  <li>Verify the user's ACL includes call permissions</li>
  <li>Check that the user is assigned to the correct environment</li>
</ul>

<h2>Still Having Issues?</h2>
<p>If none of the above resolves your problem, check the <strong>System Health</strong> screen for service issues, or contact support with your call logs.</p>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">System Health Monitor</a></li>
  <li><a href="#">Extensions Screen Walkthrough</a></li>
  <li><a href="#">Call Logs Screen</a></li>
</ul>
`,
  },
  {
    section: 'Troubleshooting',
    title: 'Call Quality Issues (Jitter, Latency)',
    body: `
<h2>Overview</h2>
<p>Audio quality problems during calls — including choppy audio, echo, delay, or one-way audio — are often caused by network issues.</p>

<h2>Common Audio Issues</h2>
<table>
  <tr><th>Symptom</th><th>Likely Cause</th><th>Solution</th></tr>
  <tr><td>Choppy/robotic audio</td><td>High jitter or packet loss</td><td>Use wired connection, enable QoS</td></tr>
  <tr><td>Long delay (latency)</td><td>High network latency</td><td>Check internet speed, reduce hops</td></tr>
  <tr><td>Echo</td><td>Acoustic feedback</td><td>Use headset, reduce speaker volume</td></tr>
  <tr><td>One-way audio</td><td>NAT/firewall blocking RTP</td><td>Open RTP ports, disable SIP ALG</td></tr>
  <tr><td>No audio</td><td>Firewall blocking all media</td><td>Open required ports</td></tr>
</table>

<h2>Recommended Network Settings</h2>
<ul>
  <li><strong>Bandwidth:</strong> Minimum 100 kbps per concurrent call</li>
  <li><strong>Latency:</strong> Under 150ms round-trip</li>
  <li><strong>Jitter:</strong> Under 30ms</li>
  <li><strong>Packet Loss:</strong> Under 1%</li>
  <li><strong>QoS:</strong> Prioritize SIP/RTP traffic on your network</li>
</ul>

<h2>Quick Diagnostics</h2>
<ol>
  <li>Run a speed test to check bandwidth</li>
  <li>Run a ping test to the SIP server to measure latency</li>
  <li>Try a wired Ethernet connection instead of Wi-Fi</li>
  <li>Test with a different codec if available</li>
</ol>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Why Can't I Make or Receive Calls?</a></li>
  <li><a href="#">System Health Monitor</a></li>
</ul>
`,
  },
];
