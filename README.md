# ProPOR

**Production Point of Rental** — Concert Production warehouse management software, event booking calendar, address book, use barcode scanners, import inventory from excel, 3D visualizer and autoloader for most efficient truck loading of concert production gear, export truck pack call sheet and event info for crew.  This app is free to test during development.

*v2.1.23 — April 2026*

---

## Troubleshooting

### Remote Access / Tunnel Errors (Error 1033 / 530)
If you see a **Cloudflare Tunnel error** when accessing the app remotely, your **router or ISP may be blocking the tunnel connection**. This is a network-level block, not an app issue.

**Fix:** Switch to a different network — a phone hotspot works well. The tunnel will connect immediately on an unrestricted network.

---

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

## Build & Distribute

```bash
npm run build        # Build for your current OS
npm run build:mac    # → dist-electron/*.dmg (macOS)
npm run build:win    # → dist-electron/*.exe (Windows)
```

---

## Core Features

- ✅ **Truck Load Planning** — 3D bin packing engine with orbit camera
- ✅ **Events Management** — Schedule gear deployments with crew & venue tracking
- ✅ **Inventory Tracking** — Build & organize item library with departments & groups
- ✅ **Road Cases** — Create cases with fixed contents for consistent packing
- ✅ **Case Repacks** — Save & reuse case layouts (same items, same order)
- ✅ **Truck Load Repacks** — Save full truck loads & auto-apply to new events
- ✅ **3D Visualization** — View load from angles, clip planes, explode layers
- ✅ **Excel/CSV Import** — Bulk import items with auto column detection
- ✅ **Inventory Integration** — Watch a folder for inventory JSON updates
- ✅ **PDF Export** — Load manifest + crew call sheets
- ✅ **Hover Tips** — Step-by-step guidance toggleable on Dashboard
- ✅ **Dark Theme** — Professional dark UI

---

## How To: Complete Workflow

### **Step 1: Prepare Your Inventory**

#### Add Items Manually
First build your groups then subgroups then item then road case, then fill your case.  For example.  GROUP- Audio  SUBGROUP- Panther 80  ITEM- Panther Line Array 80 degree  CASE- Panther 80 Cart of 4
1. Go to **Items** (sidebar).
2. Click **"+ Add Item"** (blue button, top right).
3. Fill in:
   - **Item Name** (e.g., "Wireless Microphone")
   - **Department** (e.g., "Audio", "Lighting") — controls color in 3D view
   - **Dimensions** (L × W × H in inches)
   - **Weight** (lbs) — used for truck weight limits
   - **Quantity** — how many units exist
   - **Placement Restrictions** — rotation/flip/stack rules
4. Click **"Save Item"**.

#### Import from Excel / CSV (Items only, NOT Road Cases.  Cases Must be made manually)
1. Prepare a spreadsheet with columns: `name`, `sku`, `department`, `length`, `width`, `height`, `weight`, `quantity`.
2. In **Items**, click **"📤 Import Excel"**.
3. Match your spreadsheet columns to app fields (auto-detected if column headers match).
4. Click **"Import N Items"**.

#### Import from Inventory App
1. In **Items**, click **"📥 From Inventory"**.
2. Select a JSON file matching the [INVENTORY_INTEGRATION.md](./INVENTORY_INTEGRATION.md) schema.
3. Items are added to your library.

**💡 Tip:** Use **groups** to organize items (e.g., "Audio", "Lighting"). In **Items**, click **"+ Create Group"** and drag items into groups for easy browsing.

---

### **Step 2: Organize Items into Cases**

#### Create Road Cases
1. Go to **Items** → scroll to **Cases** section (bottom).
2. Click **"+ Create Case"**.
3. Fill in:
   - **Case Name** (e.g., "Small Cable Case")
   - **Dimensions** (external case size)
   - **Weight** (empty case weight)
   - **Color tag** (visual identifier in 3D)
4. Click **"Create Case"**.

#### Pack a Case with Items
1. In **Items**, expand a case (click the case row).
2. In the **Contents** section, search & click items to add them.
3. Adjust **quantity per item**.
4. *(Optional)* Click **"Save as Case Repack"** to save this layout for future use (e.g., "Standard Audio Case").

#### Empty a Case (End-of-Event Reset)
1. Expand the case, click **"Empty Case"** button.
2. All items move back to **loose inventory** for the next Event load.

**💡 Tip:** Use **"Apply Case Repack"** dropdown to instantly fill a case with a previously-saved layout — saves time for repetitive packs.

---

### **Step 3: Create an Event**

#### New Event
1. Go to **Events** (sidebar).
2. Click **"+ New Event"** (top right).
3. Enter:
   - **Event Name** (e.g., "Summer Music Festival 2027")
   - *(Optional)* **Start with a saved truck repack** — auto-adds cases/items to the event's gear list
   - **Date** (event date, if creating from calendar)
4. Click **"Create Event"**.

#### Add Event Details
1. Open the event, navigate to the **Info** tab:
   - Add **client name**, **event date**, **load-in/load-out dates**
   - Add **venue name** and **info**
   - Add **hotel name** and **info**
   - Add **special notes for crew**

#### Add Crew
Go to the **Crew** tab:
1. Click **"+ Add Crew"**.
2. Enter name, role, phone, email.
3. App prevents scheduling the same crew member and equipment on overlapping events (conflict detection).

#### Add Venue Details
Go to the **Venue** tab:
1. Enter venue name, address, phone, contact.
2. Add load-in/load-out times.
3. or import from address book.

---

### **Step 4: Build the Event Gear (Pack Sheet)**

1. Go to the **Gear** tab in the event.
2. Click **"+ Add Gear"** (blue button).
3. Choose items/cases:
   - **Loose Items** (individually listed in the left panel) — click to add, specify qty
   - **Cases** (expandable list, right panel) — click to add, show contained items
4. The **Pack Sheet** now displays all gear for this event.
5. Scroll down to see **availability conflicts** (items over-allocated to overlapping events).

**💡 Tip:** If you selected a truck repack when creating the event, the gear is already pre-filled—edit as needed.

---

### **Step 5: Plan the Truck Load**

1. Go to **Load Planner** (sidebar) or click the load plan button from the event.
2. If launched from an event, the event's gear is pre-loaded.
3. Otherwise:
   - Select a **truck profile** (53ft Van, 26ft Box, etc.)
   - Choose to load the **full item library** or a **saved truck repack**
4. Click **"▶ Run Packing"** — the 3D bin packing engine auto-arranges items.
5. **Inspect the 3D view:**
   - **Orbit** with mouse drag
   - **Clip planes** — slide to see behind boxes
   - **Department colors** — items organized by department
   - **"Explode" mode** — see layer-by-layer stacking

#### Save the Load Plan
1. Enter a **plan name** (e.g., "NFest 2026 — Load 1").
2. Click **"💾 Save Plan"** — saved in app for future reference.
3. Click **"📄 Export PDF"** — generates:
   - Load manifest (all items, case contents, weights)
   - Next Case Call Sheet (order in which to load cases)

#### Save as Truck Repack
1. Click **"📦 Save as RePack"**.
2. Give it a name (e.g., "Standard AV Load").
3. This repack can now be applied to future events — auto-adds all cases/items.

---

### **Step 6: Manage Cases & Corrections**

#### Bulk Edit Items
1. In **Items**, select multiple items (checkboxes).
2. Click **"✏️ Edit N Selected"**.
3. Update fields (department, restrictions, etc.) for all at once.

#### Use Bulk Edit Page
1. Go to **Bulk Edit** (sidebar).
2. Search for items by name or pattern.
3. Make repeated corrections (e.g., fix misspelled item names, standardize dimensions).
4. Click **"Apply"** to save all changes.

#### End-of-Load Reset
1. Go to **Items**.
2. For each case used in the load, click **"Empty"** to return contents to loose inventory.
3. Go to **Items** → **Bulk Edit** to fix recurring errors (typos, dimension inconsistencies).
4. Ready for the next load.

---

### **Step 7: Export & Report**

1. Go to **Reports** (sidebar) — view:
   - Upcoming events
   - Total items in library
   - Recent load plans
   - Truck utilization charts
2. From **Load Planner**, click **"📄 Export PDF"** to download manifest + call sheet.
3. From **Events**, access all crew/venue/gear data on respective tabs.

---

## RePacks System

### **What are Case Repacks?**

Case Repacks save the **item layout of a frequently-packed case**. Instead of manually adding items every time, you load the repack in one click.

**Example:** "Standard 12-Channel Mixer Case" always contains:
- 1× Mixer
- 4× XLR Cables
- 2× Power Cords
- 1× Footswitch

**To create:** In Items, pack a case, then click **"Save as Case Repack"**.

**To use:** In Items, edit a case, open the **"Apply Case Repack"** dropdown, select the repack.

### **What are Truck Load Repacks?**

Truck Load Repacks save the **complete truck load configuration** (all cases + loose items positioned in the truck). Use when you repeatedly pack the same truck the same way.

**Example:** "Standard Audio Truck Load" contains:
- 5 audio cases
- 3 cable boxes
- 2 power racks
- etc.

**To create:** In Load Planner, complete a pack, click **"Save as RePack"**.

**To use:** When creating a new event, select the repack in the **"Start with saved truck repack"** dropdown—cases & items auto-populate.

**To view/manage:** Go to **RePacks** (sidebar) — both sections list saved repacks with descriptions.

---

## Hover Tips & Guidance

**Hover Tips** are optional step-by-step guidance tips throughout the app.

1. Go to **Dashboard** (sidebar).
2. Click **"Hover Tips: On/Off"** toggle.
3. Hover over buttons & fields to see contextual help.
4. Tips guide you through:
   - Step 1: Create an event
   - Step 2: Add inventory & cases
   - Step 3: Build load plan
   - Step 4: Export reports
   - End-of-load reset & corrections

**Recommended Workflow** shown on Dashboard:
1. **Events** — create/open event
2. **Items** — add/organize inventory
3. **Load Planner** — build truck load
4. **Reports** — export & finalize

---

## Tips & Best Practices

### **Inventory Management**
- **Use departments** to color-code items in the 3D view (Audio = blue, Lighting = orange, etc.).
- **Group items** logically (e.g., "Audio → Microphones", "Audio → Cables") for easy browsing.
- **Mark restricted items** (fragile, do-not-stack, weight limits) in **Placement Restrictions**. The packer respects these.
- **Serial numbers** — enable for high-value items; uniquely track each unit.

### **Event Planning**
- **Conflict detection** alerts you if items or crew are over-allocated to overlapping events.
- **Attach files** (contracts, site plans, maps) to events. Click "Files" tab → **"+ Attach"**.
- **Template events** — duplicate repeating events to get crew/venue/gear templates, then modify.

### **Load Planning**
- **Test multiple truck profiles** to find the best fit and cost.
- **View from multiple angles** — use the clip planes to ensure nothing is crushed.
- **Export PDF early** so crew has load order & manifest before the job.
- **Save important loads as Repacks** for future jobs.

### **Corrections & Maintenance**
- **End-of-load:** Empty all used cases in Items to reset for the next job.
- **Bulk Edit page:** Fix recurring naming/dimension issues in one pass (saves hours later).
- **Excel import:** Prepare source data carefully — bad data leads to packing issues.
- **PDF export:** Always double-check dimensions & weights match reality.

### **Performance**
- **Large libraries (500+ items):** Filter by group to keep 3D view responsive.
- **Multiple events:** Archive old events to keep the database lean.
- **Auto-updater:** Keeps app current; check Settings for update status.

---

## Inventory App Integration

For automated inventory imports, see [INVENTORY_INTEGRATION.md](./INVENTORY_INTEGRATION.md) for the JSON schema your inventory app must produce.

---

## Placeholder Installer Assets

Before distributing, replace placeholder assets:
- `assets/installer/splash.png` — DMG background (540×380px)
- `assets/installer/splash.bmp` — Windows installer sidebar (164×314px)  
- `assets/installer/icon.ico` — Windows app icon (256×256px)
- `assets/installer/icon.icns` — macOS app icon (use `iconutil` to create from PNG set)
- `assets/installer/icon.png` — General PNG icon (512×512px)

---


---

## License

All rights reserved. For licensing inquiries, contact the developer.
