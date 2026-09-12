/**
 * Extensions & Devices articles
 */

module.exports = [
  {
    section: 'Extensions',
    title: 'Extensions Screen Walkthrough',
    body: `
<h2>Overview</h2>
<p>The Extensions screen manages all phone extensions in your environment. Extensions are internal endpoints that represent phones, softphones, or WebRTC devices.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Extensions</strong>.</p>

<h2>Screen Layout</h2>
<ul>
  <li><strong>Data Table</strong> — Lists extensions with number, name, user assignment, and status</li>
  <li><strong>+ Create Button</strong> — Create a new extension</li>
  <li><strong>Row Actions</strong> — Edit, delete</li>
</ul>

<h2>Fields Reference</h2>
<table>
  <tr><th>Field</th><th>Description</th><th>Required</th></tr>
  <tr><td>Number</td><td>Extension number (e.g., 101, 102)</td><td>Yes</td></tr>
  <tr><td>Name</td><td>Display name (e.g., "John's Desk")</td><td>Yes</td></tr>
  <tr><td>Password</td><td>SIP registration password</td><td>Yes</td></tr>
  <tr><td>User</td><td>Assigned user account</td><td>No</td></tr>
  <tr><td>Voicemail</td><td>Enable voicemail for this extension</td><td>No</td></tr>
  <tr><td>Enabled</td><td>Whether the extension is active</td><td>No (default: true)</td></tr>
</table>

<h2>Step-by-Step Guide</h2>

<h3>Creating an Extension</h3>
<ol>
  <li>Click <strong>+ Create</strong></li>
  <li>Enter the extension <strong>Number</strong> (e.g., 101)</li>
  <li>Enter a <strong>Name</strong></li>
  <li>Set a <strong>Password</strong> (used for SIP registration)</li>
  <li>Optionally assign to a <strong>User</strong></li>
  <li>Click <strong>Save</strong></li>
</ol>

<h3>Registering a Phone</h3>
<p>After creating the extension, configure your phone (desk phone, softphone, or WebRTC) with:</p>
<ul>
  <li><strong>SIP Server</strong>: Your Voipappz SIP domain</li>
  <li><strong>Username</strong>: Extension number</li>
  <li><strong>Password</strong>: The password you set</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Extension Bridge — Route to a Phone</a></li>
  <li><a href="#">Extension Groups</a></li>
  <li><a href="#">Desk Phone Setup</a></li>
  <li><a href="#">Softphone Setup</a></li>
</ul>
`,
  },
  {
    section: 'Extensions',
    title: 'Extension Groups',
    body: `
<h2>Overview</h2>
<p>Extension Groups allow you to organize extensions into logical groups. Groups can be used for ring groups (ring all extensions in a group simultaneously) and organizational purposes.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Extension Groups</strong> (under Extensions).</p>

<h2>Use Cases</h2>
<ul>
  <li><strong>Ring Group</strong> — Ring all phones in a department simultaneously</li>
  <li><strong>Department Organization</strong> — Group extensions by team (Sales, Support, etc.)</li>
</ul>

<h2>Step-by-Step Guide</h2>
<ol>
  <li>Navigate to <strong>Extension Groups</strong></li>
  <li>Click <strong>+ Create</strong></li>
  <li>Enter a group <strong>Name</strong></li>
  <li>Add extensions to the group</li>
  <li>Click <strong>Save</strong></li>
</ol>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Extensions Screen Walkthrough</a></li>
  <li><a href="#">What is an Extension?</a></li>
</ul>
`,
  },
  {
    section: 'Desk Phones',
    title: 'Yealink Phone Setup',
    body: `
<h2>Overview</h2>
<p>This guide covers how to manually configure a Yealink desk phone to register with your Voipappz system.</p>

<h2>Prerequisites</h2>
<ul>
  <li>A Yealink phone (T2x, T3x, T4x, T5x series)</li>
  <li>Network connection (Ethernet)</li>
  <li>Extension credentials from Voipappz (number, password, SIP server)</li>
</ul>

<h2>Step-by-Step Setup</h2>
<ol>
  <li>Connect the phone to your network via Ethernet</li>
  <li>Find the phone's IP address (displayed on screen after boot)</li>
  <li>Open a browser and navigate to the phone's IP: <code>http://[phone-ip]</code></li>
  <li>Log in to the phone's web interface (default: admin/admin)</li>
  <li>Navigate to <strong>Account → Register</strong></li>
  <li>Configure:
    <ul>
      <li><strong>Line Active</strong>: Enabled</li>
      <li><strong>Label</strong>: Your name or extension number</li>
      <li><strong>Display Name</strong>: Your name</li>
      <li><strong>Register Name</strong>: Extension number (e.g., 101)</li>
      <li><strong>User Name</strong>: Extension number</li>
      <li><strong>Password</strong>: Extension password</li>
      <li><strong>SIP Server</strong>: Your Voipappz SIP server address</li>
      <li><strong>Transport</strong>: UDP (or TLS for encryption)</li>
    </ul>
  </li>
  <li>Click <strong>Confirm</strong></li>
  <li>Wait for the phone to register — the status should show "Registered"</li>
</ol>

<h2>Troubleshooting</h2>
<table>
  <tr><th>Issue</th><th>Solution</th></tr>
  <tr><td>Registration failed</td><td>Verify extension number and password match Voipappz</td></tr>
  <tr><td>No audio</td><td>Check network connectivity and firewall/NAT settings</td></tr>
  <tr><td>One-way audio</td><td>Enable STUN or configure NAT settings on the phone</td></tr>
</table>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Extensions Screen Walkthrough</a></li>
  <li><a href="#">Softphone Setup</a></li>
</ul>
`,
  },
  {
    section: 'Softphones',
    title: 'ZoiPer Setup Guide',
    body: `
<h2>Overview</h2>
<p>ZoiPer is a popular softphone application available for Windows, Mac, Linux, iOS, and Android. This guide covers setup with Voipappz.</p>

<h2>Prerequisites</h2>
<ul>
  <li>ZoiPer installed (<a href="https://www.zoiper.com/en/voip-softphone/download/current">Download ZoiPer</a>)</li>
  <li>Extension credentials from Voipappz</li>
</ul>

<h2>Step-by-Step Setup</h2>
<ol>
  <li>Open ZoiPer</li>
  <li>Click <strong>Settings → Create Account</strong></li>
  <li>Select <strong>SIP</strong> as the protocol</li>
  <li>Enter your credentials:
    <ul>
      <li><strong>Username</strong>: Extension number</li>
      <li><strong>Password</strong>: Extension password</li>
      <li><strong>Domain/Server</strong>: Your Voipappz SIP server</li>
    </ul>
  </li>
  <li>Click <strong>Register</strong></li>
  <li>Wait for "Ready" status</li>
</ol>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">MicroSIP Setup Guide</a></li>
  <li><a href="#">WebRTC Portal Dialer</a></li>
</ul>
`,
  },
  {
    section: 'Softphones',
    title: 'MicroSIP Setup Guide',
    body: `
<h2>Overview</h2>
<p>MicroSIP is a lightweight, free SIP softphone for Windows. It's simple to configure and uses minimal system resources.</p>

<h2>Prerequisites</h2>
<ul>
  <li>MicroSIP installed (<a href="https://www.microsip.org/downloads">Download MicroSIP</a>)</li>
  <li>Extension credentials from Voipappz</li>
</ul>

<h2>Step-by-Step Setup</h2>
<ol>
  <li>Open MicroSIP</li>
  <li>Right-click the system tray icon → <strong>Account</strong></li>
  <li>Configure:
    <ul>
      <li><strong>Account Name</strong>: Voipappz</li>
      <li><strong>SIP Server</strong>: Your Voipappz SIP server</li>
      <li><strong>SIP Proxy</strong>: (same as SIP server)</li>
      <li><strong>Username</strong>: Extension number</li>
      <li><strong>Domain</strong>: Your Voipappz SIP domain</li>
      <li><strong>Password</strong>: Extension password</li>
    </ul>
  </li>
  <li>Click <strong>Save</strong></li>
</ol>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">ZoiPer Setup Guide</a></li>
  <li><a href="#">Extensions Screen Walkthrough</a></li>
</ul>
`,
  },
  {
    section: 'Softphones',
    title: 'WebRTC Portal Dialer',
    body: `
<h2>Overview</h2>
<p>The WebRTC Portal Dialer is a built-in softphone available directly in the Voipappz portal. No additional software installation required — just use your browser.</p>

<h2>Requirements</h2>
<ul>
  <li>Supported browser (Chrome, Firefox, Edge)</li>
  <li>Microphone access (browser will prompt for permission)</li>
  <li>Headset recommended for best audio quality</li>
</ul>

<h2>How to Use</h2>
<ol>
  <li>Log in to the Voipappz portal</li>
  <li>Click the <strong>Dialer</strong> icon in the top bar or sidebar</li>
  <li>Allow microphone access when prompted</li>
  <li>The dialer will register automatically using your assigned extension</li>
  <li>Dial a number or extension and click <strong>Call</strong></li>
</ol>

<h2>Features</h2>
<ul>
  <li>Make and receive calls directly in the browser</li>
  <li>Hold, transfer, and mute controls</li>
  <li>DTMF keypad for IVR navigation</li>
  <li>Call history</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">ZoiPer Setup Guide</a></li>
  <li><a href="#">Extensions Screen Walkthrough</a></li>
</ul>
`,
  },
];
