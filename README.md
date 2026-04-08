# Truck Pack App

**3D Truck Load Planner** — Electron desktop app for PC and Mac.

## Quick Start

1. **Install Node.js** (v18+): https://nodejs.org/en/download
2. Open Terminal in this folder and run:
   ```bash
   bash setup.sh
   ```
3. Launch in dev mode:
   ```bash
   npm run dev
   ```

## Build Distributables

```bash
npm run build:mac    # → dist-electron/*.dmg (macOS)
npm run build:win    # → dist-electron/*.exe (Windows)
```

## Features

- ✅ 3D angled view (Three.js) with orbit camera controls
- ✅ Color-coded boxes by **department**
- ✅ Front/side/height clip sliders to see behind boxes
- ✅ Explode-layers mode
- ✅ Excel/CSV import with auto column detection
- ✅ Inventory app integration (JSON file import + folder watcher)
- ✅ Multiple configurable truck/container profiles
- ✅ Rotation axis constraints per item
- ✅ Weight limit enforcement
- ✅ PDF export: Load Manifest + **Next Case Call Sheet**
- ✅ Dark theme

## Inventory App Integration

See [INVENTORY_INTEGRATION.md](./INVENTORY_INTEGRATION.md) for the JSON export schema
your inventory app needs to produce.

## Placeholder Installer Assets

Replace these before distributing:
- `assets/installer/splash.png` — DMG background (540×380px)
- `assets/installer/splash.bmp` — Windows installer sidebar (164×314px)  
- `assets/installer/icon.ico` — Windows app icon
- `assets/installer/icon.icns` — macOS app icon (use `iconutil` to create from PNG set)
- `assets/installer/icon.png` — General PNG icon (512×512px recommended)
