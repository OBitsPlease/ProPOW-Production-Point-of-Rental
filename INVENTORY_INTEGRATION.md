# Inventory App Integration Guide

## Overview

The Truck Pack app imports equipment from your inventory app via a **JSON file export**.

Your inventory app needs to add one "Export to Truck Packer" button on the event page
that writes a JSON file in the agreed format below.

---

## Export File Format

When the user clicks "Export to Truck Packer" in your inventory app, write a `.json` file
with this structure:

```json
[
  {
    "name": "Audio Console Case",
    "sku": "AUD-001",
    "department": "Audio",
    "length": 48,
    "width": 24,
    "height": 30,
    "weight": 85,
    "quantity": 1,
    "rotate_x": 0,
    "rotate_y": 1,
    "rotate_z": 0
  },
  {
    "name": "Speaker Array Case",
    "sku": "AUD-010",
    "department": "Audio",
    "length": 60,
    "width": 30,
    "height": 36,
    "weight": 120,
    "quantity": 4,
    "rotate_x": 1,
    "rotate_y": 1,
    "rotate_z": 0
  }
]
```

## Field Descriptions

| Field       | Type    | Description                                           |
|-------------|---------|-------------------------------------------------------|
| name        | string  | Case/item display name                                |
| sku         | string  | Case number or SKU (optional but recommended)         |
| department  | string  | Must match a department name in Truck Pack            |
| length      | number  | Length in inches                                      |
| width       | number  | Width in inches                                       |
| height      | number  | Height in inches                                      |
| weight      | number  | Weight in lbs (use 0 if unknown)                      |
| quantity    | integer | How many of this case are on the event                |
| rotate_x    | 0 or 1  | 1 = can be rotated on X axis, 0 = fixed               |
| rotate_y    | 0 or 1  | 1 = can be rotated on Y axis, 0 = fixed               |
| rotate_z    | 0 or 1  | 1 = can be rotated on Z axis, 0 = fixed               |

## Two Ways to Import

### Option A — Auto-Watch (recommended)
1. In Truck Pack, go to **Items → From Inventory** and set a watch folder
2. Your inventory app saves the JSON file to that folder
3. Truck Pack detects the new file automatically and imports it

### Option B — Manual Import
1. Your inventory app saves the JSON file anywhere
2. In Truck Pack, click **Items → From Inventory** → browse to the file

## Suggested Button in Your Inventory App

Add a button labeled **"📦 Export to Truck Packer"** on the event page that:
1. Queries all equipment assigned to that event
2. Formats the data per the schema above
3. Saves the file as: `<EventName>-truck-export.json`
4. Ideally saves it to the configured watch folder

---

## Department Name Matching

Truck Pack will auto-match the `department` field to departments by name (case-insensitive).
Make sure the department names in your inventory app match those in Truck Pack,
or the importer will leave the department blank (items still import fine).
