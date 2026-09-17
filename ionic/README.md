# VoipAppz - VoIP Communication App

A modern Ionic Angular application for VoIP communication, featuring WebRTC phone, video conferencing, call management, and business telephony features.

## Tech Stack

- **Framework:** Ionic 8 + Angular 21 (LTS)
- **WebRTC Phone:** SIP.js 0.21.x
- **Video Conferencing:** Janus Gateway
- **Real-time:** ActionCable (WebSocket)
- **Mobile:** Capacitor 6.x (iOS/Android)
- **Testing:** Playwright (E2E)

## Features

- WebRTC-based phone with SIP.js
- Video conferencing via Janus Gateway
- Call history with transcript view (WhatsApp-style chat UI)
- IVR (Interactive Voice Response) management
- Queue management with agent assignment
- Time-based call routing (Call Conditions)
- Extension and external number management
- Multi-language support (English, Hebrew)
- iOS and Android support via Capacitor

## Getting Started

### Prerequisites

- Node.js LTS (v18+)
- npm or yarn
- Ionic CLI: `npm install -g @ionic/cli`

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd voipappz-app

# Install dependencies
npm install

# Start development server
npm start
# or
ionic serve
```

The app will be available at `http://localhost:8100`

### Running with Docker

Two services in `docker-compose.yml` cover the full dev workflow:

| Service | Purpose |
|---------|---------|
| `angular-app` | Runs `ng serve` inside a container and exposes the app on port 8100. |
| `claude` | Dev/debug shell — installs deps and stays alive so you can `exec` into it for terminal work. |

```bash
# Start the Ionic Angular dev server (foreground, logs in terminal)
docker compose up angular-app

# Start it in the background
docker compose up -d angular-app

# Open the dev/debug shell (installs deps, then idles)
docker compose up -d claude
docker compose exec claude bash

# Run both at once
docker compose up -d angular-app claude

# Tail logs
docker compose logs -f angular-app

# Restart after changing dependencies
docker compose restart angular-app

# Stop everything (keeps volumes / node_modules cache)
docker compose down

# Stop and wipe the cached volumes (forces a clean reinstall next run)
docker compose down -v
```

App URL: `http://localhost:8100`

### Build

```bash
# Development build
npm run build

# Production build
npm run build --prod
```

### Testing

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with browser visible
npm run test:e2e:headed

# Run specific test file
npx playwright test e2e-playwright/phone.spec.ts
```

### Mobile Development

```bash
# Add platforms
npx cap add ios
npx cap add android

# Sync web assets to native projects
npx cap sync

# Open in Xcode/Android Studio
npx cap open ios
npx cap open android
```

## Project Structure

```
src/
├── app/
│   ├── core/
│   │   ├── _base/layout/
│   │   │   ├── services/     # Business services (IVR, Queue, Extension, etc.)
│   │   │   ├── models/       # TypeScript interfaces
│   │   │   └── pipes/        # Data transformation
│   │   └── providers/
│   │       ├── phone/        # WebRTC phone implementation
│   │       ├── user-data.ts  # User state management
│   │       └── events.ts     # Event bus
│   ├── pages/                # Feature pages
│   │   ├── actions-page/     # Default identity & bridge display
│   │   ├── calls/            # Call history list
│   │   ├── conversation-page/# Call transcript (chat UI)
│   │   ├── ivr-page/         # IVR management
│   │   ├── queue-page/       # Queue management
│   │   ├── extension-page/   # Extension management
│   │   ├── number-page/      # External number management
│   │   └── ...
│   └── partials/             # Shared components
├── assets/
│   ├── config/               # Runtime configuration
│   └── data/i18n/            # Translations (en.json, he.json)
└── e2e-playwright/           # E2E test files
```

## Configuration

Runtime configuration is in `src/assets/config/main.js`:

```javascript
var CONFIG = {
  API_ENDPOINT: "https://your-api.domain.com/",
  WEBSOCKETS_URL: "wss://your-ws.domain.com:8443/",
  PAGE_TITLE: "VoipAppz",
  ENV: 'dev'
};
```

## Key Components

### Bridge Types (Call Routing)

The app supports multiple bridge types for call routing:

| Type | Description |
|------|-------------|
| IVR | Interactive Voice Response menu |
| Queue | Call queue with agent assignment |
| Extension | Internal extension |
| Number | External phone number |
| Call Condition | Time-based routing |
| Announcement | Audio announcement |

### Services

| Service | Purpose |
|---------|---------|
| `CallService` | Call history list + blocking |
| `ConversationService` | Call transcript/messages |
| `IvrService` | IVR CRUD operations |
| `QueueService` | Queue management + agents |
| `ExtensionService` | Extension configuration |
| `NumberService` | External number management |
| `TimeConditionService` | Time-based routing |

## Documentation

- See `CLAUDE.md` for detailed development guide
- See `docs/MIGRATION_PLAN.md` for migration details
- See `docs/WEBRTC_PHONE_TEST_PLAN.md` for phone testing

## Contributing

1. Follow Angular/Ionic conventions
2. Use TypeScript strict mode
3. Write tests for new features
4. Update documentation
5. Test on iOS/Android if changing mobile features

## License

Proprietary - All rights reserved
