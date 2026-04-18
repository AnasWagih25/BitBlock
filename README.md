# BITBLOCK

Visual embedded IDE for makers, students, and hardware teams.  
Build firmware with drag-and-drop blocks, compile in the cloud, and flash directly from the browser.

## Why BITBLOCK

- Block-based programming with generated Arduino/C++ output
- Cloud firmware compilation via `arduino-cli` on Cloud Run
- Browser-based flashing flow (ESP WebSerial + UF2 guidance)
- Multi-board support with board-aware compiler settings
- Firebase auth, project persistence, and user profiles
- Built-in ML pipeline surface (data collection, training, testing views)

## Platform Capabilities

### Visual IDE

- Blockly workspace with custom theme and toolbox
- Real-time code generation and syntax-highlight preview
- Auto-save project blocks to Firestore
- Board selector with board-specific capabilities and metadata

### Hardware + Firmware

- Compile source to firmware artifacts in cloud (`.bin`, `.hex`, `.uf2`)
- ESP flashing through `esptool-js` and WebSerial
- AVR flashing path scaffold (STK500 flow)
- UF2 workflow helper for boards that use drag-and-drop flashing

### Blocks + Libraries

- Core blocks: events, GPIO, timing, serial, arrays, mapping
- Sensor blocks
- Display blocks
- Motor/actuator blocks
- Communication + IoT blocks (WiFi/HTTP/MQTT/BLE/classic serial)
- Camera/storage/time blocks
- Navigation and advanced control blocks
- Audio/media blocks

### Product Surface

- Landing page and onboarding
- Email/password + Google authentication
- Dashboard project management
- Marketplace page
- Profile page
- Guided IDE quick-help overlays

### ML Workspace

- Data collection view
- Training job view
- Inference testing view
- Board gating for ML-capable hardware

## Supported Boards

- ESP32 WROOM-32
- ESP32-S3
- ESP32-CAM
- ESP32-C3
- ESP8266 NodeMCU
- Arduino Uno R3
- Arduino Uno R4 WiFi
- Arduino Nano
- Arduino Nano ESP32
- Arduino Mega 2560

Board definitions live in `src/boards/registry.ts`.

## Tech Stack

- Frontend: React + TypeScript + Vite
- UI/Editor: Blockly
- Backend services: Firebase (Auth, Firestore, Storage)
- Cloud compile backend: Node + Express + `arduino-cli`
- Deployment: Netlify (frontend), Cloud Run (compiler service)

## Repo Structure

- `src/` - frontend app, IDE, blocks, libraries, flash protocols
- `compiler-service/` - cloud compile service (Dockerized)
- `netlify/functions/` - Netlify function proxy (`compile-firmware`)
- `public/` - static assets

## Local Development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Environment Variables

Create `.env` (or use Netlify env vars):

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_COMPILER_URL=https://<cloud-run-service>/compile
```

Reference template: `.env.example`.

## Cloud Compile + Flash Setup

### 1) Deploy compiler service (Cloud Run)

From `compiler-service/`:

```bash
gcloud builds submit --tag us-east4-docker.pkg.dev/<PROJECT>/<REPO>/bitblock-compiler:latest .
gcloud run deploy bitblock-compiler \
  --image us-east4-docker.pkg.dev/<PROJECT>/<REPO>/bitblock-compiler:latest \
  --region us-east4 \
  --allow-unauthenticated
```

### 2) Configure frontend

- Set `VITE_COMPILER_URL` to your Cloud Run endpoint + `/compile`
- Redeploy Netlify

### 3) Verify

- `GET /health` returns `{ "ok": true }`
- Compile in IDE returns firmware artifact and enables flash

## Notes

- For production reliability, keep Cloud Run compile concurrency conservative (`1`) and scale with more instances.
- For ESP flashing, always compile for the board that matches connected hardware.

## Roadmap

- Complete AVR flashing implementation
- Artifact metadata and compile logs UI panel
- Multi-artifact ESP flashing bundles by target board profile
- Queue-based compile pipeline for high-concurrency workloads

---

Built for builders who want fast iteration from idea to firmware.
