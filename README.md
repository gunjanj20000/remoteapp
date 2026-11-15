# Xiaomi TV Wi-Fi Remote App

A high-performance, responsive remote control application custom-built for **Xiaomi Smart TVs** (PatchWall, Android TV, and Google TV editions). It connects **immediately over Wi-Fi on launch** and features dedicated direct-shortcut buttons for **YouTube**, **Netflix**, **Sony LIV**, and **Prime Video**, alongside a complete suite of television control buttons.

---

## 🌟 Key Features

### 1. 🚀 Immediate Wi-Fi Connection on Launch
- **Instant Connect**: Automatically reconnects to your saved Xiaomi TV IP address milliseconds after opening.
- **Wi-Fi Subnet Auto-Discovery**: Automatically sweeps the local network (ports `5555`, `6095`, and `8008`) to find Xiaomi Smart TVs without manual configuration.
- **Live Connection Telemetry**: Real-time ping latency (ms), active protocol indicator, and heartbeat auto-reconnect.
- **Wake-on-LAN (WOL)**: Send UDP magic packets to wake your TV from standby sleep mode.

### 2. ⚡ Direct App Shortcut Buttons
Dedicated high-visibility launcher buttons styled to match authentic Xiaomi TV remotes:
- **YouTube** (`com.google.android.youtube.tv` / DIAL protocol)
- **Netflix** (`com.netflix.ninja` / DIAL protocol)
- **Sony LIV** (`com.sonyliv` / `com.graymatrix.did`)
- **Prime Video** (`com.amazon.amazonvideo.livingroom` / DIAL protocol)
- *Bonus Extras*: Expandable launcher for Disney+ Hotstar, Spotify, PatchWall Home, and a **Custom APK Package Launcher**!

### 3. 🎮 Comprehensive TV Control Suite
- **Power**: Power Toggle, Standby, and Wake-on-LAN.
- **Directional Navigation**:
  - **Circular D-Pad Dial**: Up, Down, Left, Right with tactile center **OK / Select** button.
  - **Gesture Touchpad Mode**: Swipe up/down/left/right and tap to click like a modern trackpad remote.
- **Xiaomi Signature Navigation Bar**:
  - **Back** (Arrow left)
  - **Home** (Mi PatchWall / Android TV Home)
  - **Menu** (Contextual settings / 3-bar menu)
- **Audio & Channel Controls**:
  - Dual ergonomic rocker pillars with **Volume +**, **Volume -**, and **Mute Toggle**.
  - Animated live volume gauge (0–100%).
  - **Channel +**, **Channel -**, and slide-out **10-Key Number Pad**.
- **Media Playback**:
  - Rewind 10s (`<<`), Play/Pause (`▶ ||`), Fast Forward 10s (`>>`), Stop (`■`).
- **Input Source Switcher**:
  - Quick-switch to HDMI 1, HDMI 2, HDMI 3, or AV inputs.
- **Smart Features**:
  - **Phone-to-TV Keyboard**: Type search terms, passwords, and URLs directly from your phone rather than typing letter-by-letter on the TV screen.
  - **Google Assistant / Voice Search** shortcut.
  - **Haptic Vibration Feedback**: Realistic tactile click vibration (`navigator.vibrate`) on mobile.
  - **Acoustic Feedback**: Web Audio API synthesized mechanical remote click sounds (toggleable).

---

## 🛠 Multi-Protocol Support

This remote automatically selects the optimal Wi-Fi protocol supported by your Xiaomi TV:

| Protocol | Port | Description |
|---|---|---|
| **Android ADB over Wi-Fi** | `5555` | Universal key injection (`KEYCODE_DPAD_UP`, `KEYCODE_ENTER`, etc.) and direct app intents |
| **Xiaomi MiTV HTTP REST** | `6095` | Xiaomi native PatchWall HTTP controller (`/controller?action=keyevent&...`) |
| **DIAL / Google Cast** | `8008` | Direct REST app launch for YouTube, Netflix, and Prime Video |
| **Wake-on-LAN (UDP)** | `9` | Broadcast magic packet to wake TV from powered-off standby |

---

## 🚀 Quick Start Guide

### Step 1: Start the Remote Server & Web App

In the project root (`/home/ubuntu/remoteapp`):

```bash
# Start both backend server and development client concurrently:
npm run dev

# Or start the unified production server (serves both API & Frontend on port 3001):
npm run server
```

The application is now live:
- Local browser: `http://localhost:5173` (or `http://localhost:3001`)
- Mobile device on the same Wi-Fi: `http://<YOUR_COMPUTER_LOCAL_IP>:3001`

### Step 2: Install as a Mobile App (PWA)

1. Open `http://<YOUR_COMPUTER_LOCAL_IP>:3001` in Chrome (Android) or Safari (iOS) on your phone.
2. Tap **Menu (⋮ or Share icon)** ➔ **Add to Home Screen**.
3. The remote launches in full-screen standalone mode with haptics enabled, zero address bar clutter, and an authentic Xiaomi Mi icon.

---

## 📺 Xiaomi TV Wi-Fi Setup Tips

To enable maximum remote control capabilities over Wi-Fi:

1. **Connect both devices to the same Wi-Fi network** (e.g. your home 2.4 GHz or 5 GHz Wi-Fi).
2. **Find TV IP Address**:
   - On Xiaomi TV: Go to **Settings (⚙) ➔ Network & Internet ➔ Connected Wi-Fi Network ➔ IP Address** (e.g., `192.168.1.100`).
3. **Enable ADB Network Debugging (Recommended for Android/PatchWall TVs)**:
   - Go to **Settings ➔ Device Preferences ➔ About**.
   - Tap **Build** 7 times until you see *"You are now a developer!"*.
   - Go back to **Device Preferences ➔ Developer Options**.
   - Enable **USB Debugging** and **Network Debugging**.
   - When connecting for the first time, check *"Always allow from this computer"* on the TV screen.

---

## 📁 Project Architecture

```
remoteapp/
├── server/
│   ├── server.cjs           # Express backend: ADB Wi-Fi bridge, MiTV HTTP, DIAL, WOL & subnet scanner
│   └── tv-config.json       # Persistent TV settings (IP, MAC, protocol, recent devices)
├── src/
│   ├── App.tsx              # Main remote chassis, immediate auto-connect & state
│   ├── index.css            # Tailwind CSS v4 custom styles, haptics & remote gradients
│   ├── components/
│   │   ├── Header.tsx            # Mi branding, Wi-Fi status, Power, Sound/Haptic toggles
│   │   ├── ShortcutGrid.tsx      # YouTube, Netflix, Sony LIV, Prime Video badges
│   │   ├── DPadController.tsx    # Circular D-pad dial & gesture Touchpad swipe area
│   │   ├── SystemNavigation.tsx  # Back, Home (PatchWall), Menu triad
│   │   ├── VolumeAndChannel.tsx  # Dual volume/channel rockers, mute & level meter
│   │   ├── MediaControls.tsx     # Rewind, Play/Pause, Fast-Forward, Stop, HDMI inputs
│   │   ├── KeyboardModal.tsx     # Direct text typing from phone to TV
│   │   ├── NumberPadModal.tsx    # 10-key numeric channel keypad
│   │   └── SettingsModal.tsx     # Wi-Fi IP configuration, subnet scan, WOL & live logs
│   ├── services/
│   │   └── tvApi.ts         # REST client communicating with TV backend
│   └── utils/
│       └── feedback.ts      # Web Audio API mechanical clicks & vibration generator
├── android/                 # Standalone native Android Kotlin/Compose project
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml   # All permissions granted: INTERNET, WIFI, VIBRATE, WAKE_LOCK
│   │   └── kotlin/.../MainScreen.kt # Native Jetpack Compose Xiaomi Remote UI
│   └── build.gradle.kts     # Gradle build script configured for Android SDK
├── public/
│   ├── favicon.svg          # Xiaomi Mi Remote squircle icon
│   └── manifest.json        # PWA configuration for mobile installation
└── package.json             # Scripts & dependencies
```

---

## 🛡 Permissions

All permissions requested and handled seamlessly:
- `INTERNET` & `ACCESS_NETWORK_STATE`: For immediate Wi-Fi network connectivity.
- `ACCESS_WIFI_STATE` & `CHANGE_WIFI_MULTICAST_STATE`: For SSDP and mDNS device auto-discovery.
- `VIBRATE`: For authentic tactile button clicks.
- `WAKE_LOCK`: To maintain connection while the remote is in use.
