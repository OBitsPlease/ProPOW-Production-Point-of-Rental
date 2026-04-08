import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const C = {
  white:      [255, 255, 255],
  navy:       [26,  54,  93],
  blue:       [37,  99,  235],
  blueLight:  [219, 234, 254],
  gray50:     [249, 250, 251],
  gray100:    [243, 244, 246],
  gray200:    [229, 231, 235],
  gray400:    [156, 163, 175],
  gray600:    [75,  85,  99],
  gray800:    [31,  41,  55],
  red:        [220, 38,  38],
  redLight:   [254, 226, 226],
  green:      [22,  163, 74],
  greenLight: [220, 252, 231],
}

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return C.gray400
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
}

function hdr(doc, title, subtitle, PW) {
  doc.setFillColor(...C.navy)
  doc.rect(0, 0, PW, 22, 'F')
  doc.setTextColor(...C.white)
  doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text('TRUCK PACK', 14, 10)
  doc.setFontSize(7); doc.setFont('helvetica', 'normal')
  doc.text('3D Load Planner', 14, 16)
  doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text(title, PW / 2, 13, { align: 'center' })
  if (subtitle) {
    doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    doc.text(subtitle, PW - 14, 16, { align: 'right' })
  }
  doc.setFillColor(...C.blue)
  doc.rect(0, 22, PW, 1.2, 'F')
}

function statBox(doc, x, y, w, h, label, value, bg, fg) {
  doc.setFillColor(...(bg || C.gray100)); doc.setDrawColor(...C.gray200)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')
  doc.setTextColor(...C.gray600); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal')
  doc.text(label, x + w / 2, y + 5.5, { align: 'center' })
  doc.setTextColor(...(fg || C.gray800)); doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text(String(value), x + w / 2, y + 14, { align: 'center' })
}

function dim(b) {
  return (b.l || b.length || 0) + 'in x ' + (b.w || b.width || 0) + 'in x ' + (b.h || b.height || 0) + 'in'
}

export function generateLoadPlanPDF(plan, packed, unpacked, callSheet, truck, departments) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const planName = plan.name || 'Load Plan'
  const truckName = (truck && truck.name) ? truck.name : 'Truck'

  // Page 1 white background + header
  doc.setFillColor(...C.white); doc.rect(0, 0, PW, PH, 'F')
  hdr(doc, planName, truckName + ' - ' + date, PW)

  const sY = 28, sH = 18, sg = 3
  const sW = (PW - 28 - sg * 3) / 4
  statBox(doc, 14,            sY, sW, sH, 'UTILIZATION',  Math.round(plan.utilization || 0) + '%', C.blueLight, C.blue)
  statBox(doc, 14+sW+sg,      sY, sW, sH, 'TOTAL WEIGHT', (plan.totalWeight || 0).toLocaleString() + ' lbs', C.gray100, C.gray800)
  statBox(doc, 14+(sW+sg)*2,  sY, sW, sH, 'ITEMS LOADED', String(packed.length), C.greenLight, C.green)
  statBox(doc, 14+(sW+sg)*3,  sY, sW, sH, 'DID NOT FIT',  String(unpacked.length),
    unpacked.length > 0 ? C.redLight : C.gray100, unpacked.length > 0 ? C.red : C.gray400)

  let y = sY + sH + 6

  if (truck) {
    doc.setFillColor(...C.gray100); doc.setDrawColor(...C.gray200)
    doc.roundedRect(14, y, PW - 28, 9, 1.5, 1.5, 'FD')
    doc.setTextColor(...C.gray600); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    doc.text(
      truckName + '  -  ' + (truck.length||0) + 'in L x ' + (truck.width||0) + 'in W x ' + (truck.height||0) + 'in H  -  Max: ' + (truck.max_weight || 0).toLocaleString() + ' lbs',
      PW / 2, y + 5.5, { align: 'center' }
    )
    y += 13
  }

  if (departments && departments.length > 0) {
    doc.setTextColor(...C.gray400); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold')
    doc.text('DEPARTMENTS:', 14, y + 3.5)
    let lx = 46
    for (const dept of departments) {
      doc.setFillColor(...hexToRgb(dept.color || '#6b7280'))
      doc.roundedRect(lx, y + 1, 3, 3, 0.5, 0.5, 'F')
      doc.setTextColor(...C.gray800); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal')
      doc.text(dept.name, lx + 4.5, y + 3.8)
      lx += doc.getTextWidth(dept.name) + 11
      if (lx > PW - 20) { lx = 46; y += 5 }
    }
    y += 8
  }

  doc.setTextColor(...C.navy); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
  doc.text('LOAD MANIFEST', 14, y + 4)
  doc.setFillColor(...C.blue); doc.rect(14, y + 5.5, 28, 0.5, 'F')
  y += 9

  // willDrawPage fires BEFORE table content on each page (including page 1).
  // We use a flag to skip page 1 since we already drew the header and stat boxes above.
  let manifestFirstPage = true
  autoTable(doc, {
    startY: y,
    head: [['#', 'ITEM NAME', 'SKU', 'DEPT', 'DIMENSIONS', 'WEIGHT', 'POSITION']],
    body: packed.map(function(b, i) {
      return [
        String(b.loadOrder || (i + 1)),
        b.name || '',
        b.sku || '-',
        b.department_name || '-',
        dim(b),
        (b.weight || 0) + ' lbs',
        '(' + Math.round(b.x||0) + ', ' + Math.round(b.y||0) + ', ' + Math.round(b.z||0) + ')'
      ]
    }),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.2, textColor: C.gray800, lineColor: C.gray200, lineWidth: 0.2 },
    headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 6.5, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.gray50 },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 45 },
      2: { cellWidth: 22 },
      3: { cellWidth: 20 },
      4: { cellWidth: 28 },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 26 },
    },
    margin: { left: 14, right: 14 },
    willDrawPage: function(data) {
      if (manifestFirstPage) { manifestFirstPage = false; return }
      doc.setFillColor(...C.white); doc.rect(0, 0, PW, PH, 'F')
      hdr(doc, planName + ' - Manifest (cont.)', date, PW)
      data.settings.startY = 28
    },
  })

  if (unpacked.length > 0) {
    const uy = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y) + 8
    doc.setTextColor(...C.red); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
    doc.text('ITEMS THAT DID NOT FIT', 14, uy)
    autoTable(doc, {
      startY: uy + 5,
      head: [['ITEM NAME', 'SKU', 'DEPT', 'DIMENSIONS', 'WEIGHT', 'REASON']],
      body: unpacked.map(function(b) {
        return [
          b.name || '',
          b.sku || '-',
          b.department_name || '-',
          (b.length||0) + 'in x ' + (b.width||0) + 'in x ' + (b.height||0) + 'in',
          (b.weight||0) + ' lbs',
          b.reason === 'weight_limit' ? 'Weight Limit' : 'No Space'
        ]
      }),
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, textColor: C.gray800, lineColor: C.gray200, lineWidth: 0.2 },
      headStyles: { fillColor: C.red, textColor: C.white, fontSize: 6.5, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.redLight },
      margin: { left: 14, right: 14 },
    })
  }

  // Call Sheet page
  doc.addPage()
  doc.setFillColor(...C.white); doc.rect(0, 0, PW, PH, 'F')
  hdr(doc, 'NEXT CASE CALL SHEET', planName + ' - ' + truckName + ' - ' + date, PW)

  doc.setFillColor(...C.blueLight); doc.setDrawColor(...C.blue)
  doc.roundedRect(14, 28, PW - 28, 14, 2, 2, 'FD')
  doc.setTextColor(...C.navy); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
  doc.text('PACKER INSTRUCTIONS', PW / 2, 34, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text('Call each case in order. Load from BACK to FRONT. Cross off each row as the case enters the truck.', PW / 2, 39, { align: 'center' })

  let callFirstPage = true
  autoTable(doc, {
    startY: 47,
    head: [['CALL #', 'CASE NAME', 'SKU / CASE #', 'DEPARTMENT', 'DIMENSIONS', 'WEIGHT', 'CHECK']],
    body: (callSheet || []).map(function(row, i) {
      return [
        String(row.callPosition || (i + 1)),
        row.name || '',
        row.sku || '-',
        row.department || row.department_name || '-',
        row.dimensions || ((row.l||row.length||'') + 'in x ' + (row.w||row.width||'') + 'in x ' + (row.h||row.height||'') + 'in'),
        row.weight ? (row.weight + ' lbs') : '-',
        ''
      ]
    }),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3, textColor: C.gray800, lineColor: C.gray200, lineWidth: 0.25, minCellHeight: 10 },
    headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 7, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.gray50 },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', fontStyle: 'bold', textColor: C.blue },
      1: { cellWidth: 48 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 28 },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 9,  halign: 'center' },
    },
    margin: { left: 14, right: 14 },
    willDrawPage: function(data) {
      if (callFirstPage) { callFirstPage = false; return }
      doc.setFillColor(...C.white); doc.rect(0, 0, PW, PH, 'F')
      hdr(doc, 'CALL SHEET (cont.)', planName, PW)
      data.settings.startY = 28
    },
  })

  const lastY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 200) + 8
  if (lastY < PH - 20) {
    doc.setTextColor(...C.gray400); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal')
    doc.text('Total Cases: ' + packed.length + '  -  Truck Pack 3D Load Planner  -  ' + date, PW / 2, lastY, { align: 'center' })
  }

  return doc
}
