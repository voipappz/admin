/**
 * Voice AI & Automation articles
 */

module.exports = [
  {
    section: 'Bots (Voice AI Agents)',
    title: 'What is a Bot?',
    body: `
<h2>Overview</h2>
<p>A Bot is an AI-powered voice agent that can handle phone conversations autonomously. Built using the visual Flow Builder, bots can greet callers, answer questions, collect information, and route calls — all without human intervention.</p>

<h2>Key Capabilities</h2>
<ul>
  <li><strong>Natural Language Understanding</strong> — Understands what callers say in natural speech</li>
  <li><strong>Text-to-Speech</strong> — Speaks responses in natural-sounding voices</li>
  <li><strong>Visual Flow Builder</strong> — Design conversation flows with drag-and-drop</li>
  <li><strong>Actions</strong> — Transfer calls, hang up, execute VML scripts, trigger webhooks</li>
  <li><strong>Context-Aware</strong> — Maintains conversation context throughout the call</li>
</ul>

<h2>Use Cases</h2>
<ul>
  <li>Automated receptionist / virtual assistant</li>
  <li>FAQ handling and information lookup</li>
  <li>Appointment scheduling</li>
  <li>Lead qualification</li>
  <li>After-hours support</li>
  <li>Survey collection</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Bots Screen Walkthrough</a></li>
  <li><a href="#">Flow Builder — Visual Editor Walkthrough</a></li>
  <li><a href="#">Bot Bridge — Route to AI Voice Agent</a></li>
</ul>
`,
  },
  {
    section: 'Bots (Voice AI Agents)',
    title: 'Bots Screen Walkthrough',
    body: `
<h2>Overview</h2>
<p>The Bots screen displays all AI voice agents in your environment. From here you can create new bots, open the Flow Builder to edit conversation flows, and manage bot settings.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>Bots</strong>.</p>

<h2>Screen Layout</h2>
<ul>
  <li><strong>Data Table</strong> — Lists bots with name, status, and creation date</li>
  <li><strong>+ Create Button</strong> — Create a new bot</li>
  <li><strong>Row Actions</strong> — Open Flow Builder, edit settings, duplicate, delete</li>
</ul>

<h2>Fields Reference</h2>
<table>
  <tr><th>Field</th><th>Description</th><th>Required</th></tr>
  <tr><td>Name</td><td>Bot display name</td><td>Yes</td></tr>
  <tr><td>Description</td><td>What the bot does</td><td>No</td></tr>
  <tr><td>Voice</td><td>TTS voice configuration</td><td>No</td></tr>
  <tr><td>Enabled</td><td>Whether the bot is active</td><td>No (default: true)</td></tr>
</table>

<h2>Step-by-Step Guide</h2>

<h3>Creating a Bot</h3>
<ol>
  <li>Click <strong>+ Create</strong></li>
  <li>Enter a <strong>Name</strong> (e.g., "Support Bot")</li>
  <li>Optionally set a description</li>
  <li>Click <strong>Save</strong></li>
  <li>Click the bot row to open the <strong>Flow Builder</strong></li>
  <li>Design the conversation flow using the visual editor</li>
  <li>Deploy the bot</li>
</ol>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">What is a Bot?</a></li>
  <li><a href="#">Flow Builder — Visual Editor Walkthrough</a></li>
</ul>
`,
  },
  {
    section: 'VML Scripts',
    title: 'What is VML?',
    body: `
<h2>Overview</h2>
<p>VML (Voice Markup Language) is a scripting language that lets you define custom voice application logic. VML scripts can handle incoming calls, perform API lookups, make routing decisions, and more.</p>

<h2>When to Use VML</h2>
<ul>
  <li>Complex routing logic that can't be achieved with standard bridge types</li>
  <li>Integration with external databases or APIs during a call</li>
  <li>Custom IVR behavior beyond standard menus</li>
  <li>Dynamic greetings based on caller data</li>
</ul>

<h2>Key Features</h2>
<ul>
  <li>Full scripting language for voice applications</li>
  <li>Built-in code editor with syntax highlighting</li>
  <li>AI assistant for help writing scripts</li>
  <li>Can be used as a DID bridge or within other routing</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">VML Screen Walkthrough</a></li>
  <li><a href="#">VML Bridge — Route via Script</a></li>
</ul>
`,
  },
  {
    section: 'VML Scripts',
    title: 'VML Screen Walkthrough',
    body: `
<h2>Overview</h2>
<p>The VML screen manages all Voice Markup Language scripts in your environment.</p>

<h2>How to Access</h2>
<p>From the sidebar, click <strong>VML</strong>.</p>

<h2>Screen Layout</h2>
<ul>
  <li><strong>Script List</strong> — Lists all VML scripts with name and description</li>
  <li><strong>+ Create Button</strong> — Create a new script</li>
  <li><strong>Code Editor</strong> — Full-featured editor with syntax highlighting</li>
  <li><strong>AI Assistant</strong> — Get help writing or debugging scripts</li>
</ul>

<h2>Step-by-Step Guide</h2>

<h3>Creating a VML Script</h3>
<ol>
  <li>Click <strong>+ Create</strong></li>
  <li>Enter a <strong>Name</strong></li>
  <li>Write your VML code in the editor</li>
  <li>Use the <strong>AI Assistant</strong> for help with syntax or logic</li>
  <li>Click <strong>Save</strong></li>
</ol>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">What is VML?</a></li>
  <li><a href="#">VML Bridge — Route via Script</a></li>
</ul>
`,
  },
  {
    section: 'Workflows',
    title: 'What is a Workflow?',
    body: `
<h2>Overview</h2>
<p>A Workflow is an automated process that executes a sequence of steps to perform tasks, transform data, or trigger actions. Workflows are built using a visual editor with drag-and-drop nodes.</p>

<h2>Use Cases</h2>
<ul>
  <li>Automate post-call processing (send follow-up emails, update CRM)</li>
  <li>Data transformation pipelines</li>
  <li>Scheduled tasks and reports</li>
  <li>Multi-step integrations</li>
</ul>

<h2>Key Features</h2>
<ul>
  <li>Visual workflow builder with node-based design</li>
  <li>Multiple node types (HTTP, Transform, Condition, etc.)</li>
  <li>Execution monitoring and logs</li>
  <li>Trigger-based or scheduled execution</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">Workflows Screen Walkthrough</a></li>
  <li><a href="#">Triggers & Webhooks</a></li>
</ul>
`,
  },
  {
    section: 'Triggers & Webhooks',
    title: 'Triggers Overview',
    body: `
<h2>Overview</h2>
<p>Triggers are event-driven automations that execute actions when specific events occur in the system. Combined with webhooks, they enable powerful integrations with external services.</p>

<h2>How Triggers Work</h2>
<ol>
  <li>An event occurs (e.g., call completed, voicemail received)</li>
  <li>The trigger evaluates its conditions</li>
  <li>If conditions match, the trigger fires its actions (send webhook, execute VML, etc.)</li>
</ol>

<h2>Common Trigger Events</h2>
<table>
  <tr><th>Event</th><th>Description</th></tr>
  <tr><td>Call Completed</td><td>Fires when a call ends</td></tr>
  <tr><td>Voicemail Received</td><td>Fires when a new voicemail is left</td></tr>
  <tr><td>Queue Timeout</td><td>Fires when a caller waits too long in queue</td></tr>
  <tr><td>Missed Call</td><td>Fires when a call goes unanswered</td></tr>
</table>

<h2>Webhook Configuration</h2>
<p>Triggers can send HTTP webhooks to external URLs with event data. Configure:</p>
<ul>
  <li><strong>URL</strong> — The endpoint to receive the webhook</li>
  <li><strong>Method</strong> — POST, GET, etc.</li>
  <li><strong>Headers</strong> — Custom headers (authentication, content-type)</li>
  <li><strong>Payload</strong> — Event data in JSON format</li>
</ul>

<h2>Related Articles</h2>
<ul>
  <li><a href="#">What is a Workflow?</a></li>
  <li><a href="#">Send Email Based on Triggers</a></li>
</ul>
`,
  },
];
