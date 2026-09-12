/**
 * Call Routing & IVR articles
 */

module.exports = [
  // --- Section: IVR ---
  {
    section: 'IVR (Interactive Voice Response)',
    title: 'What is an IVR?',
    body: `
<h2>Overview</h2>
<p>An IVR (Interactive Voice Response) is an automated voice menu that greets callers and lets them navigate options using their phone keypad. IVRs are one of the most common call routing tools, enabling self-service and efficient call distribution.</p>

<h2>How It Works</h2>
<ol>
  <li>Caller reaches the IVR (via a DID with an IVR bridge)</li>
  <li>A greeting message plays: "Press 1 for Sales, Press 2 for Support..."</li>
  <li>Caller presses a key on their phone (DTMF input)</li>
  <li>The system routes the call to the destination assigned to that key</li>
</ol>

<h2>Key Features</h2>
<ul>
  <li>Up to 10 keypad options (0-9)</li>
  <li>Each key routes to any destination: extension, queue, another IVR, announcement, etc.</li>
  <li>Timeout handling — what happens if the caller doesn't press anything</li>
  <li>Invalid input handling — what happens on an unassigned key press</li>
  <li>Nested IVRs — chain multiple menus together</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">IVR Screen Walkthrough</a></li>
  <li><a href="#">Creating an IVR Menu</a></li>
  <li><a href="#">IVR Bridge — Route to Voice Menu</a></li>
</ul>
`,
  },
  {
    section: 'IVR (Interactive Voice Response)',
    title: 'IVR Screen Walkthrough',
    body: `
<h2>Overview</h2>
<p>The IVR screen displays all IVR menus in your environment. From here you can create new IVRs, edit existing ones, and manage keypad routing configurations.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>IVR</strong>.</p>

<h2>Screen Layout</h2>
<ul>
  <li><strong>Data Table</strong> — Lists IVRs with name, description, and status</li>
  <li><strong>+ Create Button</strong> — Create a new IVR menu</li>
  <li><strong>Row Actions</strong> — Edit, delete</li>
</ul>

<h2>Fields Reference</h2>
<table>
  <tr><th>Field</th><th>Description</th><th>Required</th></tr>
  <tr><td>Name</td><td>IVR display name</td><td>Yes</td></tr>
  <tr><td>Greet Long</td><td>Full greeting (played on first entry)</td><td>No</td></tr>
  <tr><td>Greet Short</td><td>Short greeting (played on repeat)</td><td>No</td></tr>
  <tr><td>Timeout</td><td>Seconds to wait for input</td><td>No</td></tr>
  <tr><td>Max Failures</td><td>Max invalid inputs before fallback</td><td>No</td></tr>
</table>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Creating an IVR Menu</a></li>
  <li><a href="#">Configuring Keypad Options</a></li>
</ul>
`,
  },
  {
    section: 'IVR (Interactive Voice Response)',
    title: 'Creating an IVR Menu',
    body: `
<h2>Overview</h2>
<p>Create a new IVR menu to provide callers with a self-service voice menu.</p>

<h2>Step-by-Step Guide</h2>
<ol>
  <li>Navigate to <strong>IVR</strong> in the sidebar</li>
  <li>Click <strong>+ Create</strong></li>
  <li>Enter a <strong>Name</strong> (e.g., "Main Menu")</li>
  <li>Configure the <strong>Greeting</strong> — select an announcement or TTS message</li>
  <li>Set up <strong>Keypad Options</strong>:
    <ul>
      <li>Key 1 → Sales Queue</li>
      <li>Key 2 → Support Queue</li>
      <li>Key 3 → Billing Extension</li>
      <li>Key 0 → Operator</li>
    </ul>
  </li>
  <li>Configure <strong>Timeout</strong> — what happens if no key is pressed</li>
  <li>Configure <strong>Invalid Input</strong> — what happens on wrong key press</li>
  <li>Click <strong>Save</strong></li>
</ol>

<h2>Tips</h2>
<ul>
  <li>Keep menus short — 3-4 options maximum for best caller experience</li>
  <li>Always include a "Press 0 for Operator" option as fallback</li>
  <li>Use a short greeting on repeat to avoid frustrating callers who called back</li>
  <li>Test your IVR by calling the DID after setup</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Configuring Keypad Options (DTMF Routing)</a></li>
  <li><a href="#">IVR Bridge — Route to Voice Menu</a></li>
</ul>
`,
  },
  {
    section: 'IVR (Interactive Voice Response)',
    title: 'Configuring Keypad Options (DTMF Routing)',
    body: `
<h2>Overview</h2>
<p>Each IVR menu can have up to 10 keypad options (digits 0-9). When a caller presses a key, the call is routed to the assigned destination.</p>

<h2>Keypad Configuration</h2>
<p>For each key, you can route to:</p>
<table>
  <tr><th>Destination Type</th><th>Description</th></tr>
  <tr><td>Extension</td><td>Ring a specific phone</td></tr>
  <tr><td>Queue</td><td>Enter a call distribution queue</td></tr>
  <tr><td>IVR</td><td>Go to another IVR menu (nested)</td></tr>
  <tr><td>Announcement</td><td>Play a message</td></tr>
  <tr><td>Voicemail</td><td>Go to voicemail</td></tr>
  <tr><td>External Number</td><td>Transfer to external number</td></tr>
</table>

<h2>Timeout & Invalid Input</h2>
<ul>
  <li><strong>Timeout</strong> — If the caller doesn't press any key within the timeout period, the system can replay the menu, route to a default destination, or hang up</li>
  <li><strong>Invalid Input</strong> — If the caller presses an unassigned key, the system can replay the menu or route to a fallback destination</li>
  <li><strong>Max Failures</strong> — After this many invalid attempts, route to fallback (typically operator)</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Creating an IVR Menu</a></li>
  <li><a href="#">Nested IVR Menus</a></li>
</ul>
`,
  },

  // --- Section: Queues ---
  {
    section: 'Queues & Call Distribution',
    title: 'What is a Queue?',
    body: `
<h2>Overview</h2>
<p>A Queue is a call distribution system that holds incoming calls in a line and routes them to available agents based on a predefined strategy. Queues are the backbone of call center operations.</p>

<h2>How It Works</h2>
<ol>
  <li>A call enters the queue (via a DID bridge, IVR option, etc.)</li>
  <li>The caller hears music on hold (MOH) while waiting</li>
  <li>The queue system checks for available agents</li>
  <li>When an agent becomes available, the call is connected based on the distribution strategy</li>
  <li>If no agent is available within the timeout, a fallback action is taken</li>
</ol>

<h2>Key Features</h2>
<ul>
  <li>Multiple distribution strategies (round-robin, ring-all, longest-idle, etc.)</li>
  <li>Skills-based routing</li>
  <li>Music on hold</li>
  <li>Queue position announcements</li>
  <li>Timeout and fallback routing</li>
  <li>Agent monitoring (spy, whisper, barge)</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Queue Screen Walkthrough</a></li>
  <li><a href="#">Creating a Queue</a></li>
  <li><a href="#">Queue Strategy</a></li>
</ul>
`,
  },
  {
    section: 'Queues & Call Distribution',
    title: 'Queue Screen Walkthrough',
    body: `
<h2>Overview</h2>
<p>The Queues screen displays all call distribution queues in your environment.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Queues</strong>.</p>

<h2>Screen Layout</h2>
<ul>
  <li><strong>Data Table</strong> — Lists queues with name, strategy, agent count, and status</li>
  <li><strong>+ Create Button</strong> — Create a new queue</li>
  <li><strong>Row Actions</strong> — Edit, manage agents, delete</li>
</ul>

<h2>Fields Reference</h2>
<table>
  <tr><th>Field</th><th>Description</th><th>Required</th></tr>
  <tr><td>Name</td><td>Queue display name</td><td>Yes</td></tr>
  <tr><td>Strategy</td><td>Call distribution method</td><td>Yes</td></tr>
  <tr><td>MOH Sound</td><td>Music on hold audio</td><td>No</td></tr>
  <tr><td>Max Wait Time</td><td>Maximum seconds in queue</td><td>No</td></tr>
  <tr><td>Timeout Action</td><td>What happens when max wait exceeded</td><td>No</td></tr>
</table>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Creating a Queue</a></li>
  <li><a href="#">Agents & Member Management</a></li>
</ul>
`,
  },
  {
    section: 'Queues & Call Distribution',
    title: 'Creating a Queue',
    body: `
<h2>Overview</h2>
<p>Create a queue to distribute incoming calls to your team.</p>

<h2>Step-by-Step Guide</h2>
<ol>
  <li>Navigate to <strong>Queues</strong> in the sidebar</li>
  <li>Click <strong>+ Create</strong></li>
  <li>Enter a <strong>Name</strong> (e.g., "Sales Queue")</li>
  <li>Select a <strong>Strategy</strong> (round-robin, ring-all, etc.)</li>
  <li>Configure <strong>Music on Hold</strong></li>
  <li>Set <strong>Timeout</strong> and fallback routing</li>
  <li>Click <strong>Save</strong></li>
  <li>Add <strong>Agents</strong> to the queue (extensions that will receive calls)</li>
</ol>

<h2>Distribution Strategies</h2>
<table>
  <tr><th>Strategy</th><th>Description</th></tr>
  <tr><td>Ring All</td><td>Ring all available agents simultaneously</td></tr>
  <tr><td>Round Robin</td><td>Distribute calls evenly in rotation</td></tr>
  <tr><td>Longest Idle</td><td>Route to the agent who's been idle the longest</td></tr>
  <tr><td>Top Down</td><td>Always try agents in a fixed order</td></tr>
  <tr><td>Random</td><td>Route to a random available agent</td></tr>
</table>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Agents & Member Management</a></li>
  <li><a href="#">Queue Bridge — Route to Call Queue</a></li>
</ul>
`,
  },

  // --- Section: Call Conditions ---
  {
    section: 'Call Conditions & Segments',
    title: 'What is a Call Condition?',
    body: `
<h2>Overview</h2>
<p>A Call Condition is a routing rule that evaluates criteria to determine where a call should go. It's how you implement logic like "route to the IVR during business hours, but play the after-hours announcement at night."</p>

<h2>Condition Types</h2>
<table>
  <tr><th>Type</th><th>What It Checks</th><th>Example</th></tr>
  <tr><td><strong>Time</strong></td><td>Current time and day</td><td>Mon-Fri 9am-5pm → Sales Queue</td></tr>
  <tr><td><strong>Caller ID</strong></td><td>Caller's phone number</td><td>VIP numbers → Priority Queue</td></tr>
  <tr><td><strong>Destination</strong></td><td>Which DID was called</td><td>+1-555-0100 → English IVR</td></tr>
</table>

<h2>How It Works</h2>
<ol>
  <li>Call enters the Call Condition</li>
  <li>The system evaluates each routing resource in priority order</li>
  <li>The first matching condition routes the call to its destination</li>
  <li>If no conditions match, the <strong>fallback</strong> destination is used</li>
</ol>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Call Conditions Screen Walkthrough</a></li>
  <li><a href="#">Time-Based Routing</a></li>
  <li><a href="#">What are Segments?</a></li>
</ul>
`,
  },
  {
    section: 'Call Conditions & Segments',
    title: 'Call Conditions Screen Walkthrough',
    body: `
<h2>Overview</h2>
<p>The Call Conditions screen lets you create and manage conditional routing rules.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Call Conditions</strong>.</p>

<h2>Screen Layout</h2>
<ul>
  <li><strong>Data Table</strong> — Lists call conditions with name and description</li>
  <li><strong>+ Create Button</strong> — Create a new call condition</li>
  <li><strong>Row Actions</strong> — Edit routing resources, delete</li>
</ul>

<h2>Fields Reference</h2>
<table>
  <tr><th>Field</th><th>Description</th><th>Required</th></tr>
  <tr><td>Name</td><td>Call condition display name</td><td>Yes</td></tr>
  <tr><td>Routing Resources</td><td>Ordered list of condition+destination pairs</td><td>Yes (at least 1)</td></tr>
  <tr><td>Fallback</td><td>Destination when no conditions match</td><td>Recommended</td></tr>
</table>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Time-Based Routing</a></li>
  <li><a href="#">Caller ID Matching</a></li>
  <li><a href="#">What are Segments?</a></li>
</ul>
`,
  },
  {
    section: 'Call Conditions & Segments',
    title: 'Time-Based Routing (Business Hours)',
    body: `
<h2>Overview</h2>
<p>Time-based routing lets you send calls to different destinations depending on the time of day and day of week. This is the most common use of Call Conditions.</p>

<h2>Step-by-Step Guide</h2>
<ol>
  <li>Create a <strong>Call Condition</strong></li>
  <li>Add a routing resource with a <strong>Time</strong> condition:
    <ul>
      <li>Days: Monday - Friday</li>
      <li>Start: 09:00</li>
      <li>End: 17:00</li>
      <li>Destination: Main IVR</li>
    </ul>
  </li>
  <li>Set the <strong>Fallback</strong> to an after-hours announcement</li>
  <li>Assign this Call Condition as the bridge on your DID</li>
</ol>

<h2>Example Configuration</h2>
<table>
  <tr><th>Priority</th><th>Condition</th><th>Destination</th></tr>
  <tr><td>1</td><td>Mon-Fri 09:00-17:00</td><td>Main IVR</td></tr>
  <tr><td>2</td><td>Sat 10:00-14:00</td><td>Weekend Queue</td></tr>
  <tr><td>Fallback</td><td>(no match)</td><td>After-Hours Announcement</td></tr>
</table>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">What is a Call Condition?</a></li>
  <li><a href="#">Caller ID Matching</a></li>
  <li><a href="#">Configure Business Hours Routing (How-To)</a></li>
</ul>
`,
  },
  {
    section: 'Call Conditions & Segments',
    title: 'What are Segments?',
    body: `
<h2>Overview</h2>
<p>A Segment is a reusable list of phone numbers that can be used in Call Conditions for caller ID matching. Instead of adding individual numbers to each condition, you create a segment once and reference it in multiple conditions.</p>

<h2>Use Cases</h2>
<ul>
  <li><strong>VIP List</strong> — A segment of high-priority callers routed to a premium queue</li>
  <li><strong>Block List</strong> — Numbers to route to an announcement or reject</li>
  <li><strong>Internal Numbers</strong> — Company numbers that bypass the IVR</li>
</ul>

<h2>How to Create</h2>
<ol>
  <li>Navigate to <strong>Call Conditions</strong></li>
  <li>Look for the Segments management option</li>
  <li>Click <strong>+ Create Segment</strong></li>
  <li>Enter a name and add phone numbers</li>
  <li>Save the segment</li>
</ol>

<h2>Using Segments in Call Conditions</h2>
<p>When creating a Call Condition routing resource, choose <strong>Caller ID</strong> as the condition type and select a segment from the dropdown. The condition will match any caller whose number is in that segment.</p>

<h2>Matching Options</h2>
<table>
  <tr><th>Operator</th><th>Description</th></tr>
  <tr><td>IS</td><td>Caller ID exactly matches a number in the segment</td></tr>
  <tr><td>IN</td><td>Caller ID is in the segment list</td></tr>
  <tr><td>NOT_IN</td><td>Caller ID is NOT in the segment list</td></tr>
  <tr><td>PREFIX</td><td>Caller ID starts with a number in the segment</td></tr>
</table>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">What is a Call Condition?</a></li>
  <li><a href="#">Caller ID Matching</a></li>
</ul>
`,
  },

  // --- Section: Announcements ---
  {
    section: 'Announcements',
    title: 'What is an Announcement?',
    body: `
<h2>Overview</h2>
<p>An Announcement is a recorded audio message or TTS (Text-to-Speech) generated message that can be played to callers. Announcements are used in bridges, IVR greetings, queue hold music, and more.</p>

<h2>Types of Announcements</h2>
<ul>
  <li><strong>Audio File</strong> — Upload a pre-recorded WAV or MP3 file</li>
  <li><strong>TTS (Text-to-Speech)</strong> — Enter text and the system generates audio</li>
</ul>

<h2>Where Announcements Are Used</h2>
<ul>
  <li>DID Announcement Bridge — play a message on inbound calls</li>
  <li>IVR Greetings — the "Press 1 for Sales..." message</li>
  <li>Queue Music on Hold</li>
  <li>Queue position announcements</li>
  <li>Voicemail greetings</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Announcements Screen Walkthrough</a></li>
  <li><a href="#">Uploading Audio Files</a></li>
  <li><a href="#">Text-to-Speech (TTS) Generation</a></li>
</ul>
`,
  },
  {
    section: 'Announcements',
    title: 'Announcements Screen Walkthrough',
    body: `
<h2>Overview</h2>
<p>The Announcements screen manages all audio messages available in your environment.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Announcements</strong>.</p>

<h2>Screen Layout</h2>
<ul>
  <li><strong>Data Table</strong> — Lists announcements with name, type (audio/TTS), and duration</li>
  <li><strong>+ Create Button</strong> — Create a new announcement</li>
  <li><strong>Row Actions</strong> — Play, edit, delete</li>
</ul>

<h2>Step-by-Step Guide</h2>

<h3>Creating from Audio File</h3>
<ol>
  <li>Click <strong>+ Create</strong></li>
  <li>Enter a <strong>Name</strong></li>
  <li>Select <strong>Audio File</strong> type</li>
  <li>Upload your WAV or MP3 file</li>
  <li>Click <strong>Save</strong></li>
</ol>

<h3>Creating from TTS</h3>
<ol>
  <li>Click <strong>+ Create</strong></li>
  <li>Enter a <strong>Name</strong></li>
  <li>Select <strong>TTS</strong> type</li>
  <li>Enter the text to be spoken</li>
  <li>Select voice and language</li>
  <li>Preview the audio</li>
  <li>Click <strong>Save</strong></li>
</ol>

<h2>Audio File Requirements</h2>
<table>
  <tr><th>Property</th><th>Recommended</th></tr>
  <tr><td>Format</td><td>WAV (PCM) or MP3</td></tr>
  <tr><td>Sample Rate</td><td>8kHz or 16kHz</td></tr>
  <tr><td>Channels</td><td>Mono</td></tr>
  <tr><td>Max Size</td><td>10 MB</td></tr>
</table>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Announcement Bridge — Play a Message</a></li>
  <li><a href="#">Creating an IVR Menu</a></li>
</ul>
`,
  },
];
