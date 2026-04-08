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

function fitsInTruck(px, py, pz, bl, bw, bh, truck) {
  const eps = 0.001
  return (
    px >= -eps && py >= -eps && pz >= -eps &&
    px + bl <= truck.length + eps &&
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
    for (let i = 0; i < qty; i++) {
      units.push({ ...item, unitIndex: i })
    }
  }

  // Sort: floor-only items first (can_stack_on_others=false), then largest volume, then heaviest
  units.sort((a, b) => {
    const aFloorOnly = (a.can_stack_on_others === 0 || a.can_stack_on_others === false) ? 0 : 1
    const bFloorOnly = (b.can_stack_on_others === 0 || b.can_stack_on_others === false) ? 0 : 1
    if (aFloorOnly !== bFloorOnly) return aFloorOnly - bFloorOnly
    const volDiff = (b.length * b.width * b.height) - (a.length * a.width * a.height)
    if (Math.abs(volDiff) > 0.01) return volDiff
    return (b.weight || 0) - (a.weight || 0)
  })

  const truckVol = truck.length * truck.width * truck.height
  const maxTruckWeight = truck.max_weight || Infinity

  const packed = []
  const unpacked = []
  let totalWeight = 0
  let packedVol = 0
  let loadOrder = 0

  // Track cumulative weight resting on each placed item (by item's packed index)
  const stackedWeightMap = new Map() // placedIndex → lbs stacked on it

  for (const unit of units) {
    const canStackOnOthers = unit.can_stack_on_others !== 0 && unit.can_stack_on_others !== false
    const orientations = getOrientations(unit)
    const unitWeight = unit.weight || 0
    let placed = false

    const extremePoints = getExtremePoints(packed, truck)
    // Placement priority: back of truck first (x desc), floor first (z asc), left first (y asc)
    extremePoints.sort((a, b) => {
      if (Math.abs(b.x - a.x) > 0.1) return b.x - a.x
      if (Math.abs(a.z - b.z) > 0.1) return a.z - b.z
      return a.y - b.y
    })

    outer: for (const ep of extremePoints) {
      for (const ori of orientations) {
        const { l: bl, w: bw, h: bh, isRotated, isTipped } = ori

        // Apply gravity: find lowest valid resting z for this footprint
        const floorZ = projectToFloor(ep.x, ep.y, bl, bw, packed)
        // Try gravity-projected z first, then the extreme-point z as fallback
        const candidateZs = [...new Set([floorZ, ep.z])].sort((a, b) => a - b)

        for (const cz of candidateZs) {
          if (!fitsInTruck(ep.x, ep.y, cz, bl, bw, bh, truck)) continue
          if (overlaps(ep.x, ep.y, cz, bl, bw, bh, packed)) continue

          // --- Stacking constraints ---
          if (cz > 0.001) {
            // Item is being raised above the floor — must be allowed to stack
            if (!canStackOnOthers) continue

            // Must have solid support directly below (no floating)
            const below = getItemsDirectlyBelow(ep.x, ep.y, cz, bl, bw, packed)
            if (below.length === 0) continue

            // Each supporting item must permit stacking and not be over its weight limit
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
            placed = true
            break outer
          }

          // --- Place the item ---
          const packedIdx = packed.length
          const below = cz > 0.001 ? getItemsDirectlyBelow(ep.x, ep.y, cz, bl, bw, packed) : []
          let stackedOn = null

          // Update stacked weight map for supporting items
          for (const b of below) {
            stackedWeightMap.set(b._packedIdx, (stackedWeightMap.get(b._packedIdx) || 0) + unitWeight)
            if (stackedOn === null) stackedOn = b.id
          }

          packed.push({
            ...unit,
            _packedIdx: packedIdx,
            x: ep.x, y: ep.y, z: cz,
            l: bl, w: bw, h: bh,
            loadOrder: ++loadOrder,
            isRotated,
            isTipped,
            isFlipped: false,
            orientationChanged: bl !== unit.length || bw !== unit.width || bh !== unit.height,
            stackedOn,
          })

          totalWeight += unitWeight
          packedVol  += bl * bw * bh
          placed = true
          break outer
        }
      }
    }

    if (!placed) {
      unpacked.push({ ...unit, reason: 'no_space' })
    }
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
