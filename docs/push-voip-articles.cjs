#!/usr/bin/env node
/**
 * Push VoIP Fundamentals articles to Zendesk
 * Section: "Key Concepts" (34576812484370)
 *
 * Also updates the Platform Overview article (34576848986386) with richer content.
 *
 * Usage:  node docs/push-voip-articles.cjs
 */

const {
  createArticle, updateArticle, listArticles, sleep,
} = require('./zendesk-api.cjs');

const KEY_CONCEPTS_SECTION = 34576812484370;
const PLATFORM_OVERVIEW_ID = 34576848986386;

// ── New Articles ──────────────────────────────────────────────────────────────

const newArticles = [
  {
    title: 'What is VoIP?',
    body: `
<h2>Voice over Internet Protocol (VoIP)</h2>
<p>VoIP is a technology that lets you make and receive phone calls over the internet instead of traditional copper phone lines. Instead of routing calls through the Public Switched Telephone Network (PSTN), VoIP converts your voice into digital data packets and sends them over an IP network.</p>

<h3>How Does VoIP Work?</h3>
<ol>
  <li><strong>Voice Capture</strong> &mdash; A microphone (in your phone, headset, or softphone app) captures your voice as an analog signal.</li>
  <li><strong>Digitization</strong> &mdash; A codec converts the analog signal into compressed digital packets.</li>
  <li><strong>Transmission</strong> &mdash; Packets travel over the internet (or a private IP network) to the destination.</li>
  <li><strong>Reassembly</strong> &mdash; The receiving device reassembles packets and converts them back to audio.</li>
</ol>

<h3>Why VoIP?</h3>
<table>
  <thead><tr><th>Benefit</th><th>Detail</th></tr></thead>
  <tbody>
    <tr><td><strong>Cost Savings</strong></td><td>Eliminates per-minute charges for long-distance and international calls.</td></tr>
    <tr><td><strong>Flexibility</strong></td><td>Make calls from any device with an internet connection &mdash; desk phone, laptop, or mobile.</td></tr>
    <tr><td><strong>Scalability</strong></td><td>Adding a new line is a configuration change, not a physical wire.</td></tr>
    <tr><td><strong>Rich Features</strong></td><td>IVR menus, call recording, real-time analytics, and AI voice agents come built in.</td></tr>
  </tbody>
</table>

<h3>VoIP in Voipappz</h3>
<p>Voipappz is a cloud-native VoIP platform. Every call that enters or leaves the system travels over SIP/RTP, gets routed by our call engine, and can be monitored in real time from the Admin Panel.</p>
`,
  },
  {
    title: 'What is SIP?',
    body: `
<h2>Session Initiation Protocol (SIP)</h2>
<p>SIP is the signalling protocol that sets up, manages, and tears down VoIP calls. Think of SIP as the "phone operator" that connects two parties &mdash; it does not carry the actual voice audio (that's handled by RTP).</p>

<h3>SIP in a Nutshell</h3>
<table>
  <thead><tr><th>SIP Message</th><th>Purpose</th></tr></thead>
  <tbody>
    <tr><td><code>INVITE</code></td><td>Initiates a call (ring the other party)</td></tr>
    <tr><td><code>100 Trying</code></td><td>Server received the INVITE</td></tr>
    <tr><td><code>180 Ringing</code></td><td>The destination phone is ringing</td></tr>
    <tr><td><code>200 OK</code></td><td>Call answered &mdash; media (RTP) can flow</td></tr>
    <tr><td><code>BYE</code></td><td>Either party hangs up</td></tr>
  </tbody>
</table>

<h3>SIP Components</h3>
<ul>
  <li><strong>User Agent (UA)</strong> &mdash; Your IP phone, softphone, or SIP trunk endpoint.</li>
  <li><strong>Registrar</strong> &mdash; Server that keeps track of where each extension is (IP address, port).</li>
  <li><strong>Proxy / B2BUA</strong> &mdash; Routes calls between agents. Voipappz uses a back-to-back user agent (B2BUA) for full call control.</li>
</ul>

<h3>SIP Registration in Voipappz</h3>
<p>When an extension registers, it sends a <code>REGISTER</code> request to the Voipappz SIP server. You can see all active registrations on the <strong>Live Monitor &rarr; SIP Registrations</strong> tab.</p>
`,
  },
  {
    title: 'VoIP vs Traditional Phone Systems',
    body: `
<h2>VoIP vs Traditional Phone Systems</h2>
<p>Choosing between VoIP and a legacy PBX? Here is a side-by-side comparison.</p>

<table>
  <thead><tr><th>Feature</th><th>Traditional PBX</th><th>VoIP (Voipappz)</th></tr></thead>
  <tbody>
    <tr><td><strong>Infrastructure</strong></td><td>Copper lines, on-site PBX hardware</td><td>Internet connection, cloud software</td></tr>
    <tr><td><strong>Setup Time</strong></td><td>Weeks (wiring + hardware)</td><td>Minutes (web-based configuration)</td></tr>
    <tr><td><strong>Scaling</strong></td><td>Buy more hardware / lines</td><td>Add users &amp; DIDs in the admin panel</td></tr>
    <tr><td><strong>Long-Distance Costs</strong></td><td>Per-minute charges</td><td>Flat-rate or very low per-minute</td></tr>
    <tr><td><strong>Mobility</strong></td><td>Tied to desk phones in the office</td><td>Call from any device, anywhere</td></tr>
    <tr><td><strong>Advanced Features</strong></td><td>Expensive add-ons</td><td>Included: IVR, queues, call recording, AI bots</td></tr>
    <tr><td><strong>Maintenance</strong></td><td>On-site technician required</td><td>Managed in the cloud, automatic updates</td></tr>
    <tr><td><strong>Disaster Recovery</strong></td><td>Office-dependent</td><td>Geo-redundant, automatic failover</td></tr>
    <tr><td><strong>Analytics</strong></td><td>Basic call logs</td><td>Real-time dashboards, CDR exports, AI insights</td></tr>
  </tbody>
</table>

<h3>When Traditional Still Makes Sense</h3>
<ul>
  <li>Locations with no reliable internet connectivity.</li>
  <li>Regulatory requirements mandating copper PSTN for emergency (E911) calls (though VoIP E911 solutions exist).</li>
</ul>

<h3>Bottom Line</h3>
<p>For most businesses, VoIP offers dramatically lower costs, greater flexibility, and richer features. Voipappz makes the transition simple with a fully managed platform and guided setup.</p>
`,
  },
  {
    title: 'Understanding Call Quality (MOS, Jitter, Latency)',
    body: `
<h2>Understanding Call Quality</h2>
<p>Crystal-clear voice is the baseline expectation. Here are the key metrics that affect VoIP call quality, and what you can do about them.</p>

<h3>Key Metrics</h3>
<table>
  <thead><tr><th>Metric</th><th>What It Is</th><th>Good</th><th>Bad</th></tr></thead>
  <tbody>
    <tr><td><strong>Latency</strong></td><td>Time for a packet to travel from sender to receiver</td><td>&lt; 150 ms</td><td>&gt; 300 ms (noticeable delay)</td></tr>
    <tr><td><strong>Jitter</strong></td><td>Variation in packet arrival times</td><td>&lt; 30 ms</td><td>&gt; 50 ms (choppy audio)</td></tr>
    <tr><td><strong>Packet Loss</strong></td><td>Percentage of packets that never arrive</td><td>&lt; 1 %</td><td>&gt; 3 % (gaps in speech)</td></tr>
    <tr><td><strong>MOS Score</strong></td><td>Mean Opinion Score (1&ndash;5 subjective quality rating)</td><td>4.0 &ndash; 4.5</td><td>&lt; 3.5 (poor quality)</td></tr>
  </tbody>
</table>

<h3>Common Causes of Poor Quality</h3>
<ul>
  <li><strong>Insufficient bandwidth</strong> &mdash; Each concurrent G.711 call needs ~85 kbps. Run a bandwidth test to ensure headroom.</li>
  <li><strong>Network congestion</strong> &mdash; VoIP shares the pipe with video streaming and downloads. Use QoS (Quality of Service) rules to prioritize voice traffic.</li>
  <li><strong>Wi-Fi interference</strong> &mdash; Prefer wired Ethernet for desk phones. If Wi-Fi is necessary, use 5 GHz band.</li>
  <li><strong>Codec mismatch</strong> &mdash; Ensure endpoints and the Voipappz platform agree on codecs (G.711 for quality, G.729/Opus for low bandwidth).</li>
</ul>

<h3>Monitoring Quality in Voipappz</h3>
<p>Use the <strong>Live Monitor</strong> screen to see active calls and their quality indicators. The <strong>Dashboard</strong> shows aggregate metrics, and <strong>Call Logs</strong> include per-call quality data you can export for analysis.</p>

<h3>Quick Fixes</h3>
<ol>
  <li>Enable QoS / DSCP tagging on your router (DSCP 46 = EF for voice).</li>
  <li>Use a wired connection for phones and softphones.</li>
  <li>Ensure your internet plan has sufficient <strong>upload</strong> bandwidth.</li>
  <li>Reduce jitter buffer size if latency is acceptable but audio is delayed.</li>
</ol>
`,
  },
];

// ── Updated Platform Overview ─────────────────────────────────────────────────

const platformOverviewBody = `
<h2>What is Voipappz?</h2>
<p>Voipappz is a <strong>cloud-native voice platform</strong> that gives service providers, call centers, and SMBs everything they need to run professional phone operations &mdash; from provisioning DIDs and configuring IVR menus to deploying AI voice agents and monitoring calls in real time.</p>

<h3>The Problem We Solve</h3>
<p>Traditional PBX systems are expensive, rigid, and hard to scale. Managing phone numbers across carriers, configuring call routing, and adding new agents requires on-site hardware and specialized technicians. Voipappz eliminates all of that with a single web-based platform that connects to any SIP provider.</p>

<h3>Who Is Voipappz For?</h3>
<table>
  <thead><tr><th>Audience</th><th>Use Case</th></tr></thead>
  <tbody>
    <tr><td><strong>Service Providers / ITSPs</strong></td><td>Multi-tenant customer management, white-label portals, provider routing</td></tr>
    <tr><td><strong>Call Centers</strong></td><td>Queue-based distribution, real-time agent monitoring, campaign dialing, AI bots</td></tr>
    <tr><td><strong>SMBs</strong></td><td>Professional IVR, business-hours routing, softphone access from anywhere</td></tr>
  </tbody>
</table>

<h3>Key Differentiators</h3>
<ul>
  <li><strong>Multi-Tenant by Design</strong> &mdash; Customers, environments, and permissions are first-class concepts. One platform serves many tenants.</li>
  <li><strong>AI-Native</strong> &mdash; Voice AI agents (Bots) and PocketFlow workflow automation are built in, not bolted on.</li>
  <li><strong>Carrier Agnostic</strong> &mdash; Connect any SIP trunk. Route calls across multiple providers with automatic failover.</li>
  <li><strong>Real-Time Visibility</strong> &mdash; Live call monitoring, agent dashboards, and system health checks &mdash; all in one place.</li>
  <li><strong>Open API</strong> &mdash; Every feature is exposed via REST API. Build integrations, automate provisioning, or embed telephony into your app.</li>
</ul>

<h3>End-to-End Flow Example</h3>
<ol>
  <li><strong>Provision</strong> &mdash; Create a Customer and Environment in the admin panel.</li>
  <li><strong>Acquire a DID</strong> &mdash; Purchase or port a phone number and assign it to the environment.</li>
  <li><strong>Configure Routing</strong> &mdash; Set the DID's bridge type: forward to a number, play an IVR, route to a queue, or connect to an AI bot.</li>
  <li><strong>Register Endpoints</strong> &mdash; Extensions register via SIP from desk phones, softphones, or WebRTC.</li>
  <li><strong>Go Live</strong> &mdash; Calls flow through the platform. Monitor them on the Live dashboard, review CDR in Call Logs, and adjust routing on the fly.</li>
</ol>

<h3>Next Steps</h3>
<ul>
  <li><a href="/hc/en-us/articles/34576849047826">Navigating the Admin Panel</a></li>
  <li><a href="/hc/en-us/articles/34576849073810">What is a DID?</a></li>
  <li><a href="/hc/en-us/articles/34576850042642">Setting Up a New Customer (End-to-End)</a></li>
</ul>
`;

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Pushing VoIP Fundamentals Articles ===\n');

  // 1. Create new articles in Key Concepts section
  for (const art of newArticles) {
    try {
      const created = await createArticle(KEY_CONCEPTS_SECTION, art.title, art.body, false);
      console.log(`  OK: "${art.title}" → ${created.html_url}\n`);
    } catch (err) {
      console.error(`  FAIL: "${art.title}" → ${err.message}\n`);
    }
  }

  // 2. Update Platform Overview
  console.log('\n=== Updating Platform Overview ===\n');
  try {
    await updateArticle(PLATFORM_OVERVIEW_ID, { body: platformOverviewBody });
    console.log('  OK: Platform Overview updated.\n');
  } catch (err) {
    console.error(`  FAIL: Platform Overview → ${err.message}\n`);
  }

  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
