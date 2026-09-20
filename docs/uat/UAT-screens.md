# Nimbus screen usability review

This is the short, screen-by-screen release review. Each row answers one
question: can a person open the screen, understand it, and complete its main
job without developer help?

## Release details

| Field | Value |
|---|---|
| Release / tag | |
| Environment URL | |
| Admin build | |
| API build | |
| Node build | |
| Reviewed by | |
| Date | |
| Final decision | |

## Before starting

- An administrator account with full access and working OTP email.
- A portal user, an application, two extensions and two softphones.
- A test phone number and provider for outside calls.
- Some recent calls, messages and events so lists are not empty.
- Optional integrations only where a row says they are needed.

## Usability checks

| ID | Screen | What the person needs | What to do | Pass when | Result | Notes | Route |
|---|---|---|---|---|---|---|---|
| S-01 | Admin sign in | Reach the administration screens securely | Sign in with email and password, then enter the OTP from email. | Calls opens, the account name is visible, and the menu is usable. | Not Run | | `/admin` |
| S-02 | User portal | Sign in as a phone user | Open the portal in a separate browser, sign in and complete OTP. | The user's home screen opens and shows only that user's information. | Not Run | | `/` |
| S-03 | Dashboard | Understand today's activity | Compare the totals and recent calls with calls made during this review. | The figures are understandable and agree with the calls made. | Not Run | | `/` |
| S-04 | Live | See what is happening now | Start and end a call while watching Live. | The call and counts update without reloading and return to normal after hangup. | Not Run | | `/live` |
| S-05 | My Calls | Find a user's own call | Open My Calls and find the call just made. | The correct call is easy to find and no other user's calls appear. | Not Run | | `/my-calls` |
| S-06 | Phone | Place a call from Nimbus | Open Phone, confirm it is connected, enter another extension and call it. | The other phone rings, audio works both ways, and hangup ends the call. | Not Run | | `/phone` |
| S-07 | Calls | Follow a live call | Make a call, find it while it is active, open its details, then hang up. | The parties, state and duration are clear and the call disappears when it ends. | Not Run | | `/calls` |
| S-08 | Call Log | Find a completed call | Find the call from S-07 and open it. | Direction, parties, start time, duration and recording status are clear. | Not Run | | `/calls-log` |
| S-09 | Reports | Understand activity for a period | Choose a recent period, run a report and export it. | The screen and downloaded file show the same understandable figures. | Not Run | | `/reports` |
| S-10 | Notifications | Read and clear an alert | Open a notification and mark it read. | It stays read after reloading and the unread count updates. | Not Run | | `/notifications` |
| S-11 | Users | Create a person who can use the portal | Create a user with name, email and extension, then sign in as that user. | The user appears, receives OTP and reaches their own portal. | Not Run | | `/users` |
| S-12 | Devices | Add and register a phone | Add or open an extension, set its SIP password, register a softphone and refresh. | The extension changes visibly from Offline to Registered or Online. | Not Run | | `/extensions` |
| S-13 | My Account | Update personal details | Change the signed-in administrator's display name and reload. | The saved name remains and is shown consistently in the header. | Not Run | | `/account` |
| S-14 | Customer | Update company details | Change one company contact field, save and reload. | The value remains in the correct field and is easy to read. | Not Run | | `/account/customer` |
| S-15 | Accounts | Control another administrator's access | Create or edit an account, limit its access, then sign in as it. | Only permitted screens are visible and blocked screens cannot be opened directly. | Not Run | | `/accounts` |
| S-16 | Applications | Select the correct application | Create or select an application, then move between Users, Devices and Calls. | The selected application stays clear and every screen shows its data only. | Not Run | | `/environments` |
| S-17 | DIDs and Routing | Send an outside number to a phone | Add a number, open its visual routing, point it to a registered extension and call it. | The intended phone rings and the route is understandable when reopened. | Not Run | | `/routing` |
| S-18 | Providers | Connect outside calling | Open a provider, confirm its important settings, then place an outside call. | The call connects and the provider configuration remains readable after reload. | Not Run | | `/providers` |
| S-19 | Messages | Read and reply to a conversation | Open an incoming conversation and send a reply. | The thread is in the correct order and the reply reaches the recipient. | Not Run | | `/messages` |
| S-20 | Services | Deliver a webhook | Create or open a webhook, send a test event and check the receiving URL. | Delivery reaches the URL and the sent count updates after the stated wait. | Not Run | | `/services` |
| S-21 | Subscriptions | See what a customer is subscribed to | Open an application subscription and review its plan, dates, status and balance. | The important billing information is visible and understandable. | Not Run | | `/subscriptions` |
| S-22 | Billing | Understand the selected subscription | Select a subscription and review its billing chain and expiration. | The selected subscription is obvious and its billing relationships are readable. | Not Run | | `/billing` |
| S-23 | Transactions | Match a charge to a call | Find the charge for a call made during this review. | The amount and related call can be identified without guessing. | Not Run | | `/transactions` |
| S-24 | Tariffs | Find the price for a number | Open a tariff and check a number that matches both a short and a longer prefix. | The more specific price is shown clearly. | Not Run | | `/tariffs` |
| S-25 | Campaigns | Start and stop a calling campaign | Create a small campaign, start it, observe one attempt, then stop it. | Attempts are visible and no new calls start after stopping. | Not Run | | `/campaigns` |
| S-26 | Monitoring | Understand platform condition | Open Monitoring, choose a useful period and review the charts and node summary. | Loading, healthy, empty and problem states are clearly different. | Not Run | | `/monitoring` |
| S-27 | Health | Find a platform problem | Review the health checks; if safe, inspect a known failing or stopped service. | The affected service and reason are clear without reading raw data. | Not Run | | `/health-monitor` |
| S-28 | Nodes | See which phone systems are connected | Review the node list and open one node's health or logs. | Connected state is current and the opened details belong to the selected node. | Not Run | | `/nodes` |
| S-29 | Logs | Find why something failed | Search for a recent call or action and narrow the results. | Relevant lines are easy to find, ordered sensibly and scoped to the customer. | Not Run | | `/logs` |
| S-30 | Events | Follow what happened to a call | Find a completed call and open its event history. | Ringing, answer and hangup appear in understandable order. | Not Run | | `/events` |
| S-31 | Activity Log | Switch between call and message activity | Open Calls, then Messages, and inspect a recent item in each view. | Switching is clear and each view shows the expected kind of activity. | Not Run | | `/activity-log` |
| S-32 | Workflows | Save and reopen a simple flow | Create a small workflow, save it and reopen it. | The same steps and connections return exactly as saved. | Not Run | | `/workflow` |
| S-33 | Bots | Create and try a voice bot | With an AI provider configured, create a bot and call its number. | It answers, responds and leaves an understandable call record. | Not Run | | `/bots` |
| S-34 | Templates | Reuse saved setup | Create a template and apply it where offered. | The template is easy to recognize and applies the expected setup. | Not Run | | `/templates` |
| S-35 | Provisioning Wizard | Complete a guided setup | Open the wizard, choose a supported setup and move through its steps. | Each step explains what is needed and the completed setup is visible elsewhere. | Not Run | | `/schema` |
| S-36 | Settings | Find an operational setting | Open each Settings section and inspect one item without changing production data. | Sections load, labels are understandable and errors do not expose a blank screen. | Not Run | | `/settings` |
| S-37 | MCP | Connect an approved tool client | Open MCP, follow one displayed connection recipe and list the available tools. | The endpoint and authentication instructions are clear and the tool list loads. | Not Run | | `/mcp` |

Allowed results are `Pass`, `Fail`, `Blocked`, and `Not Run`. For a failure,
write what was confusing or unusable—not only the underlying error—and include
the approximate time.

## Routes that do not need separate usability rows

- `/login` redirects old bookmarks to Admin sign in.
- `/dashboard` redirects old bookmarks to the portal home.
- `/api-docs` redirects old bookmarks to API DevZone.
- `/dids` is an alternate entry to the DIDs list.
- `/dids/:id` opens the same visual routing screen as DIDs and Routing.
- `/devzone` is intentionally outside this release usability review.
