/**
 * Excel/CSV import with column auto-detection and manual mapping support.
 * Returns { rows, detectedMapping } where rows are raw objects and
 * detectedMapping maps standard fields to detected column names.
 */

const FIELD_ALIASES = {
  name:       ['name', 'item', 'case', 'description', 'product', 'title', 'item name', 'case name'],
  sku:        ['sku', 'code', 'item #', 'item number', 'part', 'part number', 'ref'],
  barcode:    ['barcode', 'bar code', 'upc', 'ean', 'scan code', 'scancode', 'qr code', 'qr'],
  serial:     ['serial', 'serial number', 'sn', 'serial #'],
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

const CASE_FIELD_ALIASES = {
  name:                ['name', 'case', 'case name', 'description', 'title'],
  sku:                 ['sku', 'code', 'part', 'part number', 'ref', 'item #'],
  barcode:             ['barcode', 'bar code', 'upc', 'ean', 'scan code', 'scancode', 'qr code', 'qr'],
  serial:              ['serial', 'serial number', 'sn', 'serial #'],
  group:               ['group', 'case group', 'category', 'section'],
  color:               ['color', 'colour', 'tag color', 'color tag'],
  length:              ['length', 'l', 'len', 'depth', 'd', 'long', 'x'],
  width:               ['width', 'w', 'wid', 'wide', 'y'],
  height:              ['height', 'h', 'hgt', 'tall', 'z'],
  weight:              ['weight', 'wt', 'lbs', 'kg', 'mass'],
  can_rotate_lr:       ['can_rotate_lr', 'rotate lr', 'rotate left right', 'rotate x'],
  can_tip_side:        ['can_tip_side', 'tip side', 'tip', 'rotate y'],
  can_flip:            ['can_flip', 'flip', 'rotate z'],
  can_stack_on_others: ['can_stack_on_others', 'stack on others', 'stackable'],
  allow_stacking_on_top: ['allow_stacking_on_top', 'allow stacking', 'stack on top'],
  max_stack_weight:    ['max_stack_weight', 'max stack weight', 'stack weight limit', 'max weight'],
  max_stack_qty:       ['max_stack_qty', 'max stack qty', 'max stack', 'stack qty limit', 'stack quantity'],
  notes:               ['notes', 'note', 'comments', 'comment', 'description'],
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

export function detectCaseMapping(columns) {
  const mapping = {}
  const lowerCols = columns.map(c => ({ original: c, lower: String(c).toLowerCase().trim() }))

  for (const [field, aliases] of Object.entries(CASE_FIELD_ALIASES)) {
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
      name:       String(item.name || 'Unknown').trim(),
      sku:        String(item.sku || '').trim(),
      barcode:    String(item.barcode || '').trim(),
      serial:     String(item.serial || '').trim(),
      department: String(item.department || '').trim(),
      length:     num(item.length, 12),
      width:      num(item.width, 12),
      height:     num(item.height, 12),
      weight:     num(item.weight, 0),
      quantity:   Math.max(1, Math.round(num(item.quantity, 1))),
      rotate_x:   bool(item.rotate_x),
      rotate_y:   bool(item.rotate_y),
      rotate_z:   bool(item.rotate_z),
      max_stack_qty:    Math.round(num(item.max_stack_qty, 0)),
      max_stack_weight: num(item.max_stack_weight, 0),
    }
  }).filter(i => i.name && i.name !== 'Unknown')
}

export function applyCaseMapping(rows, mapping) {
  return rows.map(row => {
    const c = {}
    for (const [field, col] of Object.entries(mapping)) {
      if (col && row[col] !== undefined && row[col] !== '') {
        c[field] = row[col]
      }
    }

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
      name:                 String(c.name || 'Unknown').trim(),
      sku:                  String(c.sku || '').trim(),
      barcode:              String(c.barcode || '').trim(),
      serial:               String(c.serial || '').trim(),
      group:                String(c.group || '').trim(),
      color:                String(c.color || '#f59e0b').trim(),
      length:               num(c.length, 24),
      width:                num(c.width, 24),
      height:               num(c.height, 24),
      weight:               num(c.weight, 0),
      can_rotate_lr:        bool(c.can_rotate_lr),
      can_tip_side:         bool(c.can_tip_side),
      can_flip:             bool(c.can_flip),
      can_stack_on_others:  bool(c.can_stack_on_others),
      allow_stacking_on_top:bool(c.allow_stacking_on_top),
      max_stack_weight:     num(c.max_stack_weight, 0),
      max_stack_qty:        Math.round(num(c.max_stack_qty, 0)),
      notes:                String(c.notes || '').trim(),
      items: [],
    }
  }).filter(c => c.name && c.name !== 'Unknown')
}
