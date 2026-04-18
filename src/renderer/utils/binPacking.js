/**
 * 3D Bin Packing — Extreme Point Algorithm with Placement Restrictions
 * Packs items into a truck respecting rotation constraints, stacking rules, and weight limits.
 *
 * Orientation flags per item:
 *   can_rotate_lr        — allow yaw 90° (swap length ↔ width)
 *   can_tip_side         — allow roll/tip (swap height with length or width)
 *   can_flip             — soft flag; tracked but doesn't filter orientations
 *   can_stack_on_others  — this item may be placed above z=0 (on top of other items)
 *   allow_stacking_on_top— other items may be placed on top of this item
 *   max_stack_weight     — max lbs resting on this item (0 = unlimited)
 *
 * Returns: { packed, unpacked, utilization, totalWeight, callSheet }
 */

/**
 * Each permutation of [L,W,H] and the rotation types required to reach it from base orientation.
 * Base: L along X (length), W along Y (width), H along Z (height/vertical).
 *
 * Rotation semantics:
 *   needLR  — requires a yaw (rotate left/right, swapping L and W)
 *   needTip — requires a roll/tip (swapping H with L or W, item on its side)
 */
const PERM_DEFS = [
  { fn: (L, W, H) => [L, W, H], needLR: false, needTip: false }, // base
  { fn: (L, W, H) => [W, L, H], needLR: true,  needTip: false }, // yaw 90°
  { fn: (L, W, H) => [L, H, W], needLR: false, needTip: true  }, // tip (roll around L-axis)
  { fn: (L, W, H) => [H, W, L], needLR: false, needTip: true  }, // tip (roll around W-axis)
  { fn: (L, W, H) => [W, H, L], needLR: true,  needTip: true  }, // yaw + tip
  { fn: (L, W, H) => [H, L, W], needLR: true,  needTip: true  }, // yaw + tip (alt)
]

/**
 * Two items are "similar" if they share the same SKU, the same name,
 * or identical sorted base dimensions (within 0.5" tolerance).
 * Used to prefer stacking like-cases together before mixing.
 */
function isSimilar(a, b) {
  if (!a || !b) return false
  if (a.sku && b.sku && a.sku === b.sku) return true
  if (a.name && b.name && a.name === b.name) return true
  const dims = (item) => [item.length, item.width, item.height].sort((x, y) => x - y)
  const da = dims(a), db = dims(b)
  return da.every((v, i) => Math.abs(v - db[i]) < 0.5)
}

function getOrientations(item) {
  const L = item.length, W = item.width, H = item.height
  const canLR  = item.can_rotate_lr  !== 0 && item.can_rotate_lr  !== false
  const canTip = item.can_tip_side   !== 0 && item.can_tip_side   !== false
  // can_flip is a soft constraint — it doesn't block orientations, just tags the placed item

  const seen = new Set()
  const result = []

  for (const { fn, needLR, needTip } of PERM_DEFS) {
    if (needLR  && !canLR)  continue
    if (needTip && !canTip) continue
    const [l, w, h] = fn(L, W, H)
    const key = `${l}|${w}|${h}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ l, w, h, isRotated: needLR, isTipped: needTip })
  }

  return result
}

// Last DOOR_CLEARANCE_IN inches at the loading door are kept clear.
const DOOR_CLEARANCE_IN = 12

function fitsInTruck(px, py, pz, bl, bw, bh, truck) {
  const eps = 0.001
  return (
    px >= -eps && py >= -eps && pz >= -eps &&
    px + bl <= truck.length - DOOR_CLEARANCE_IN + eps &&
    py + bw <= truck.width  + eps &&
    pz + bh <= truck.height + eps
  )
}

function overlaps(px, py, pz, bl, bw, bh, placed) {
  const eps = 0.001
  for (const b of placed) {
    if (
      px     < b.x + b.l - eps && px + bl > b.x + eps &&
      py     < b.y + b.w - eps && py + bw > b.y + eps &&
      pz     < b.z + b.h - eps && pz + bh > b.z + eps
    ) return true
  }
  return false
}

// Find the lowest z the item can rest at given gravity (highest top-face of any overlapping box).
function projectToFloor(px, py, bl, bw, placed) {
  const eps = 0.001
  let supportZ = 0
  for (const b of placed) {
    if (
      px     < b.x + b.l - eps && px + bl > b.x + eps &&
      py     < b.y + b.w - eps && py + bw > b.y + eps
    ) {
      supportZ = Math.max(supportZ, b.z + b.h)
    }
  }
  return supportZ
}

// Items whose top face is exactly at pz and whose footprint overlaps the candidate placement.
function getItemsDirectlyBelow(px, py, pz, bl, bw, placed) {
  const eps = 0.001
  return placed.filter(b =>
    Math.abs((b.z + b.h) - pz) < eps &&
    px     < b.x + b.l - eps && px + bl > b.x + eps &&
    py     < b.y + b.w - eps && py + bw > b.y + eps
  )
}

function getExtremePoints(placed, truck) {
  const points = [{ x: 0, y: 0, z: 0 }]
  for (const b of placed) {
    points.push({ x: b.x + b.l, y: b.y,       z: b.z       })
    points.push({ x: b.x,       y: b.y + b.w,  z: b.z       })
    points.push({ x: b.x,       y: b.y,         z: b.z + b.h })
  }
  const seen = new Set()
  return points.filter(p => {
    const k = `${p.x},${p.y},${p.z}`
    if (seen.has(k)) return false
    seen.add(k)
    // Discard points already outside the truck
    if (p.x >= truck.length - 0.001 || p.y >= truck.width - 0.001 || p.z >= truck.height - 0.001) return false
    if (p.x < 0 || p.y < 0 || p.z < 0) return false
    return true
  })
}

export function runBinPacking(items, truck) {
  // Expand items by quantity into individual unit entries
  const units = []
  for (const item of items) {
    const qty = item.quantity || 1
    for (let i = 0; i < qty; i++) units.push({ ...item, unitIndex: i })
  }

  // Count how many units exist per similarity group.
  // Groups with more duplicates sort first — they are the best stacking candidates.
  const simKey = (u) => u.sku || `${u.name}|${Math.round(u.length)}|${Math.round(u.width)}|${Math.round(u.height)}`
  const groupSize = new Map()
  for (const u of units) {
    const k = simKey(u)
    groupSize.set(k, (groupSize.get(k) || 0) + 1)
  }

  units.sort((a, b) => {
    // 0. "first_off" (Near Door) cases pack last — they end up closest to the door
    const aZone = a.load_zone === 'first_off' ? 1 : 0
    const bZone = b.load_zone === 'first_off' ? 1 : 0
    if (aZone !== bZone) return aZone - bZone

    // 1. Tallest first — tall cases go deepest into the cab end
    const aH = Math.max(a.length, a.width, a.height)
    const bH = Math.max(b.length, b.width, b.height)
    if (Math.abs(bH - aH) > 0.5) return bH - aH
    // 2. Heaviest first within same height tier
    if (Math.abs((b.weight || 0) - (a.weight || 0)) > 0.5) return (b.weight || 0) - (a.weight || 0)
    // 3. Larger duplicate groups first — more stacking opportunity
    const aSz = groupSize.get(simKey(a)) || 1
    const bSz = groupSize.get(simKey(b)) || 1
    if (bSz !== aSz) return bSz - aSz
    // 4. Keep like-cases consecutive so they naturally stack together
    const ak = simKey(a), bk = simKey(b)
    if (ak !== bk) return ak.localeCompare(bk)
    return 0
  })

  const truckVol = truck.length * truck.width * truck.height
  const maxTruckWeight = truck.max_weight || Infinity
  const packed = []
  const unpacked = []
  let totalWeight = 0
  let packedVol = 0
  let loadOrder = 0
  const stackedWeightMap = new Map()

  // ── Placement helper ─────────────────────────────────────────────────────────
  function placeUnit(unit) {
    const canStackOnOthers = unit.can_stack_on_others !== 0 && unit.can_stack_on_others !== false
    const noStackOnTop     = unit.allow_stacking_on_top === 0 || unit.allow_stacking_on_top === false
    const floorOnly        = unit.load_zone === 'floor_only'
    const orientations = getOrientations(unit)
    const unitWeight = unit.weight || 0

    // Find the topmost placed item in the column that contains extreme point ep
    const topAt = (ep) => {
      const col = packed.filter(b =>
        ep.x >= b.x - 0.001 && ep.x < b.x + b.l - 0.001 &&
        ep.y >= b.y - 0.001 && ep.y < b.y + b.w - 0.001
      )
      return col.length > 0 ? col.reduce((best, c) => (c.z + c.h > best.z + best.h ? c : best)) : null
    }

    const eps = getExtremePoints(packed, truck)
    eps.sort((a, b) => {
      const aStacked = a.z > 0.001
      const bStacked = b.z > 0.001

      // Highest priority: stacking on a matching similar case already placed.
      // This proactively pairs like-cases before grabbing new floor space.
      const aSim = aStacked && isSimilar(unit, topAt(a))
      const bSim = bStacked && isSimilar(unit, topAt(b))
      if (aSim && !bSim) return -1
      if (!aSim && bSim) return 1

      // Floor positions beat non-similar stacking — fill cab→door with no gaps.
      // ALL items (including no-stack-on-top) fill from x=0 forward so free
      // space always accumulates at the DOOR end, never in the middle.
      if (aStacked !== bStacked) return aStacked ? 1 : -1

      // Front-to-back (cab first, x asc), then left-to-right
      if (Math.abs(a.x - b.x) > 0.1) return a.x - b.x
      return a.y - b.y
    })

    // floor_only: try floor EPs first; only use stacked EPs if no floor position works
    const floorEps   = floorOnly ? eps.filter(ep => ep.z <= 0.001) : null
    const epsToTry   = floorOnly && floorEps.length > 0 ? floorEps : eps
    const epsAllowStack = !floorOnly || floorEps.length === 0

    for (const ep of epsToTry) {
      for (const ori of orientations) {
        const { l: bl, w: bw, h: bh, isRotated, isTipped } = ori

        if (!canStackOnOthers && ep.z > 0.001) continue
        // floor_only: skip elevated EPs when floor space exists
        if (!epsAllowStack && ep.z > 0.001) continue

        const floorZ = projectToFloor(ep.x, ep.y, bl, bw, packed)
        const candidateZs = [...new Set([floorZ, ep.z])].sort((a, b) => a - b)

        for (const cz of candidateZs) {
          if (!canStackOnOthers && cz > 0.001) continue
          // floor_only: skip stacking when floor space exists
          if (!epsAllowStack && cz > 0.001) continue
          if (!fitsInTruck(ep.x, ep.y, cz, bl, bw, bh, truck)) continue
          if (overlaps(ep.x, ep.y, cz, bl, bw, bh, packed)) continue

          // --- Stacking constraints ---
          if (cz > 0.001) {
            if (!canStackOnOthers) continue
            const below = getItemsDirectlyBelow(ep.x, ep.y, cz, bl, bw, packed)
            if (below.length === 0) continue

            // Stack count limit: max 3 high; max 2 high if 3rd case exceeds 7 ft (84")
            const maxBelowCount = Math.max(...below.map(b => b.stackCount || 1))
            if (maxBelowCount >= 3) continue
            if (maxBelowCount >= 2 && (cz + bh) > 84) continue

            let stackOk = true
            for (const b of below) {
              if (b.allow_stacking_on_top === 0 || b.allow_stacking_on_top === false) {
                stackOk = false; break
              }
              if (b.max_stack_weight > 0) {
                const alreadyStacked = stackedWeightMap.get(b._packedIdx) || 0
                if (alreadyStacked + unitWeight > b.max_stack_weight) {
                  stackOk = false; break
                }
              }
            }
            if (!stackOk) continue
          }

          // --- Truck weight limit ---
          if (totalWeight + unitWeight > maxTruckWeight) {
            unpacked.push({ ...unit, reason: 'weight_limit' })
            return true
          }

          // --- Place the item ---
          const packedIdx = packed.length
          const below = cz > 0.001 ? getItemsDirectlyBelow(ep.x, ep.y, cz, bl, bw, packed) : []
          let stackedOn = null
          const stackCount = below.length > 0
            ? Math.max(...below.map(b => b.stackCount || 1)) + 1
            : 1

          for (const b of below) {
            stackedWeightMap.set(b._packedIdx, (stackedWeightMap.get(b._packedIdx) || 0) + unitWeight)
            if (stackedOn === null) stackedOn = b.id
          }

          packed.push({
            ...unit, _packedIdx: packedIdx,
            x: ep.x, y: ep.y, z: cz,
            l: bl, w: bw, h: bh,
            loadOrder: ++loadOrder,
            isRotated, isTipped, isFlipped: false,
            orientationChanged: bl !== unit.length || bw !== unit.width || bh !== unit.height,
            stackedOn, stackCount,
          })

          totalWeight += unitWeight
          packedVol  += bl * bw * bh
          return true
        }
      }
    }
    return false
  }

  // ── Single pass ──────────────────────────────────────────────────────────────
  for (const unit of units) {
    const placed = placeUnit(unit)
    if (!placed) unpacked.push({ ...unit, reason: 'no_space' })
  }

  const callSheet = generateCallSheet(packed, truck)
  const utilization = truckVol > 0 ? Math.round((packedVol / truckVol) * 100 * 10) / 10 : 0
  return { packed, unpacked, utilization, totalWeight, callSheet }
}

export function generateCallSheet(placed, _truck) {
  return [...placed].sort((a, b) => a.loadOrder - b.loadOrder).map((b, i) => ({
    callPosition: i + 1,
    loadOrder:    b.loadOrder,
    name:         b.name,
    sku:          b.sku || '',
    department:   b.department_name || '',
    dimensions:   `${b.l}" × ${b.w}" × ${b.h}"`,
    weight:       b.weight || 0,
    x: b.x, y: b.y, z: b.z,
    isRotated:  b.isRotated  || false,
    isTipped:   b.isTipped   || false,
    isFlipped:  b.isFlipped  || false,
    stackedOn:  b.stackedOn  || null,
  }))
}

// Alias matching the function signature described in the task spec
export const packItems = (truck, items) => runBinPacking(items, truck)
