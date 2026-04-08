/**
 * Excel/CSV import with column auto-detection and manual mapping support.
 * Returns { rows, detectedMapping } where rows are raw objects and
 * detectedMapping maps standard fields to detected column names.
 */

const FIELD_ALIASES = {
  name:       ['name', 'item', 'case', 'description', 'product', 'title', 'item name', 'case name'],
  sku:        ['sku', 'code', 'item #', 'item number', 'part', 'part number', 'barcode', 'ref'],
  department: ['department', 'dept', 'category', 'type', 'group', 'section'],
  length:     ['length', 'l', 'len', 'depth', 'd', 'long', 'x'],
  width:      ['width', 'w', 'wid', 'wide', 'y'],
  height:     ['height', 'h', 'hgt', 'tall', 'z'],
  weight:     ['weight', 'wt', 'lbs', 'kg', 'mass', 'gross weight'],
  quantity:   ['quantity', 'qty', 'count', 'units', 'pcs', 'pieces', 'num', 'amount'],
  rotate_x:   ['rotate x', 'rot x', 'flip x', 'rotation x', 'allow rotate x'],
  rotate_y:   ['rotate y', 'rot y', 'flip y', 'rotation y', 'allow rotate y'],
  rotate_z:   ['rotate z', 'rot z', 'flip z', 'rotation z', 'allow rotate z'],
}

export function detectMapping(columns) {
  const mapping = {}
  const lowerCols = columns.map(c => ({ original: c, lower: String(c).toLowerCase().trim() }))

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const found = lowerCols.find(c => c.lower === alias || c.lower.includes(alias))
      if (found) {
        mapping[field] = found.original
        break
      }
    }
  }

  return mapping
}

export function applyMapping(rows, mapping) {
  return rows.map(row => {
    const item = {}
    for (const [field, col] of Object.entries(mapping)) {
      if (col && row[col] !== undefined && row[col] !== '') {
        item[field] = row[col]
      }
    }

    // Coerce types
    const num = (v, def = 0) => {
      const n = parseFloat(v)
      return isNaN(n) ? def : n
    }
    const bool = (v, def = 1) => {
      if (v === undefined || v === '') return def
      const s = String(v).toLowerCase().trim()
      if (['0', 'no', 'false', 'n', 'x'].includes(s)) return 0
      return 1
    }

    return {
      name: String(item.name || 'Unknown').trim(),
      sku: String(item.sku || '').trim(),
      department: String(item.department || '').trim(),
      length: num(item.length, 12),
      width: num(item.width, 12),
      height: num(item.height, 12),
      weight: num(item.weight, 0),
      quantity: Math.max(1, Math.round(num(item.quantity, 1))),
      rotate_x: bool(item.rotate_x),
      rotate_y: bool(item.rotate_y),
      rotate_z: bool(item.rotate_z),
    }
  }).filter(i => i.name && i.name !== 'Unknown')
}
