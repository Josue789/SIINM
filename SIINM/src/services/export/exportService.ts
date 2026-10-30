import { Workbook } from 'exceljs'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { db } from '@/db'
import type { InventarioItem } from '@/types/inventory.types'

export interface ExportInventoryItem {
  id?: string | number
  id_clinica?: number
  clave_ssa: string
  medicamento: string
  presentacion: string
  lote: string
  fecha_caducidad: string
  stock: number
  codigo_barras?: string
  clinicaNombre?: string
}

export interface ExportOptions {
  clinicName?: string
  userName?: string
  generatedAt?: Date
}

export type ExpiryStatus = 'vigente' | 'por_caducar' | 'caducado'

export function getExpiryStatus(fechaCaducidad?: string): {
  status: ExpiryStatus
  label: string
} {
  if (!fechaCaducidad || fechaCaducidad === 'N/A') {
    return { status: 'vigente', label: 'Sin caducidad' }
  }

  let expTime = 0
  if (fechaCaducidad.includes('/')) {
    const parts = fechaCaducidad.split('/').map(Number)
    if (parts.length === 2) {
      const m = parts[0]
      const y = parts[1] < 100 ? parts[1] + 2000 : parts[1]
      expTime = new Date(y, m, 0).getTime()
    }
  } else {
    expTime = new Date(fechaCaducidad).getTime()
  }

  if (isNaN(expTime)) {
    return { status: 'vigente', label: 'Vigente' }
  }

  const now = Date.now()
  const diffDays = (expTime - now) / (1000 * 60 * 60 * 24)

  if (diffDays < 0) {
    return { status: 'caducado', label: 'Caducado' }
  }
  if (diffDays <= 30) {
    return { status: 'por_caducar', label: 'Por caducar' }
  }
  return { status: 'vigente', label: 'Vigente' }
}

function formatDateString(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  return `${y}${m}${d}_${h}${min}`
}

function formatDisplayDate(date: Date = new Date()): string {
  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function sanitizeForWinAnsi(text: string): string {
  if (!text) return ''
  return text
    .replace(/[–—]/g, '-')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[•·]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
}

/**
 * Obtiene y desduplica los datos actuales del inventario local en Dexie,
 * vinculando catálogo y completando metadatos.
 */
export async function getInventoryExportData(idClinica?: number | null): Promise<ExportInventoryItem[]> {
  try {
    let localItems: InventarioItem[] = []
    if (idClinica && idClinica > 0) {
      localItems = await db.inventario.where('id_clinica').equals(Number(idClinica)).toArray()
    } else {
      localItems = await db.inventario.toArray()
    }

    const catalog = await db.catalogo_medicamentos.toArray()
    const catalogMap = new Map(catalog.map((c) => [String(c.id).trim().toLowerCase(), c]))

    if (localItems && localItems.length > 0) {
      const dedupMap = new Map<string, ExportInventoryItem>()

      for (const item of localItems) {
        if (idClinica && Number(item.id_clinica) !== Number(idClinica)) {
          continue
        }

        const medKey = String(item.id_medicamento || item.clave_ssa || '').trim().toLowerCase()
        const loteKey = String(item.lote || '').trim().toLowerCase()
        const dedupeKey = `${item.id_clinica}-${medKey}-${loteKey}`

        const catItem = catalogMap.get(medKey)

        const exportItem: ExportInventoryItem = {
          id: item.id || dedupeKey,
          id_clinica: item.id_clinica,
          clave_ssa: item.clave_ssa || catItem?.clave_ssa || catItem?.codigo_barras || '',
          medicamento: item.medicamento || catItem?.medicamento || catItem?.name || 'Medicamento sin nombre',
          presentacion: item.presentacion || catItem?.presentacion || 'Pieza',
          lote: item.lote || '00000',
          fecha_caducidad: item.fecha_caducidad || 'N/A',
          stock: Number(item.stock) || 0,
          codigo_barras: item.codigo_barras || catItem?.codigo_barras || '',
        }

        const existing = dedupMap.get(dedupeKey)
        if (!existing) {
          dedupMap.set(dedupeKey, exportItem)
        } else {
          // Si el ID es numérico (proveniente de base remota) tiene preferencia
          const isNumeric = typeof item.id === 'number' || (!isNaN(Number(item.id)) && !String(item.id).includes('-'))
          if (isNumeric) {
            dedupMap.set(dedupeKey, exportItem)
          }
        }
      }

      const results = Array.from(dedupMap.values())
      results.sort((a, b) => a.medicamento.localeCompare(b.medicamento, 'es', { sensitivity: 'base' }))
      return results
    }

    // Fallback si no hay registros en db.inventario, consultar db.medicines
    const legacy = await db.medicines.toArray()
    return legacy.map((m, idx) => ({
      id: m.id || idx,
      clave_ssa: m.clave_ssa || m.code || '',
      medicamento: m.medicamento || m.name || 'Medicamento',
      presentacion: m.presentacion || m.dosageForm || 'Pieza',
      lote: m.batchNumber || '00000',
      fecha_caducidad: m.expirationDate || 'N/A',
      stock: Number(m.stock) || 0,
      codigo_barras: m.codigo_barras || '',
    }))
  } catch (err) {
    console.error('Error fetching inventory for export:', err)
    return []
  }
}

/**
 * Exportación a formato Excel (.xlsx) estilizado usando ExcelJS
 */
export async function exportToExcel(
  items: ExportInventoryItem[],
  options: ExportOptions = {}
): Promise<void> {
  const {
    clinicName = 'Unidad Médica General',
    userName = 'Sistema SIINM',
    generatedAt = new Date(),
  } = options

  const workbook = new Workbook()
  workbook.creator = userName
  workbook.lastModifiedBy = userName
  workbook.created = generatedAt
  workbook.modified = generatedAt

  const worksheet = workbook.addWorksheet('Inventario', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9, // A4
    },
  })

  // 1. Encabezado institucional
  worksheet.mergeCells('A1:H1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = 'SIINM - SISTEMA INTEGRAL DE INVENTARIO DE MEDICAMENTOS'
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  worksheet.getRow(1).height = 24

  worksheet.mergeCells('A2:H2')
  const subtitleCell = worksheet.getCell('A2')
  subtitleCell.value = 'REPORTE OFICIAL DE INVENTARIO Y CONTROL DE EXISTENCIAS'
  subtitleCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } }
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  worksheet.getRow(2).height = 18

  // 2. Metadatos del reporte
  worksheet.mergeCells('A3:D3')
  const clinicCell = worksheet.getCell('A3')
  clinicCell.value = `Clínica / Unidad Médica: ${clinicName}`
  clinicCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF334155' } }
  clinicCell.alignment = { vertical: 'middle', horizontal: 'left' }

  worksheet.mergeCells('E3:H3')
  const dateCell = worksheet.getCell('E3')
  dateCell.value = `Emisión: ${formatDisplayDate(generatedAt)} | Generado por: ${userName}`
  dateCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } }
  dateCell.alignment = { vertical: 'middle', horizontal: 'right' }
  worksheet.getRow(3).height = 18

  // Fila 4 vacía separadora
  worksheet.getRow(4).height = 8

  // 3. Encabezados de tabla
  const headers = [
    { header: '#', key: 'index', width: 6 },
    { header: 'Clave SSA', key: 'clave_ssa', width: 16 },
    { header: 'Medicamento / Denominación', key: 'medicamento', width: 38 },
    { header: 'Presentación', key: 'presentacion', width: 22 },
    { header: 'Lote', key: 'lote', width: 14 },
    { header: 'Fecha Caducidad', key: 'fecha_caducidad', width: 16 },
    { header: 'Stock (Pzas)', key: 'stock', width: 14 },
    { header: 'Estatus', key: 'estatus', width: 15 },
  ]

  const headerRow = worksheet.getRow(5)
  headerRow.height = 24
  headers.forEach((h, idx) => {
    const colNumber = idx + 1
    worksheet.getColumn(colNumber).width = h.width
    const cell = headerRow.getCell(colNumber)
    cell.value = h.header
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate-800
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: h.key === 'medicamento' || h.key === 'presentacion' ? 'left' : 'center',
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    }
  })

  // Activar autofiltro en la fila de encabezados
  worksheet.autoFilter = { from: 'A5', to: 'H5' }

  // 4. Filas de datos
  let totalStock = 0
  let currentRowIndex = 6

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const row = worksheet.getRow(currentRowIndex)
    row.height = 20

    const { status, label: statusLabel } = getExpiryStatus(item.fecha_caducidad)
    const isEven = i % 2 === 0
    const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC'
    totalStock += item.stock

    // Configurar celdas individuales
    // 1: Indice
    const cellIdx = row.getCell(1)
    cellIdx.value = i + 1
    cellIdx.alignment = { vertical: 'middle', horizontal: 'center' }

    // 2: Clave SSA
    const cellClave = row.getCell(2)
    cellClave.value = item.clave_ssa || 'S/C'
    cellClave.alignment = { vertical: 'middle', horizontal: 'center' }

    // 3: Medicamento
    const cellMed = row.getCell(3)
    cellMed.value = item.medicamento
    cellMed.alignment = { vertical: 'middle', horizontal: 'left' }

    // 4: Presentación
    const cellPres = row.getCell(4)
    cellPres.value = item.presentacion || 'Pieza'
    cellPres.alignment = { vertical: 'middle', horizontal: 'left' }

    // 5: Lote
    const cellLote = row.getCell(5)
    cellLote.value = item.lote || '00000'
    cellLote.alignment = { vertical: 'middle', horizontal: 'center' }

    // 6: Fecha Caducidad
    const cellExp = row.getCell(6)
    cellExp.value = item.fecha_caducidad || 'N/A'
    cellExp.alignment = { vertical: 'middle', horizontal: 'center' }

    // 7: Stock
    const cellStock = row.getCell(7)
    cellStock.value = item.stock
    cellStock.numFmt = '#,##0'
    cellStock.alignment = { vertical: 'middle', horizontal: 'right' }

    // 8: Estatus
    const cellStatus = row.getCell(8)
    cellStatus.value = statusLabel
    cellStatus.alignment = { vertical: 'middle', horizontal: 'center' }

    // Estilos de status
    let statusFontColor = 'FF334155'
    let statusBgColor = rowBgColor
    if (status === 'caducado') {
      statusFontColor = 'FFB91C1C' // Red-700
      statusBgColor = 'FFFEE2E2' // Red-100
    } else if (status === 'por_caducar') {
      statusFontColor = 'FFB45309' // Amber-700
      statusBgColor = 'FFFEF3C7' // Amber-100
    } else {
      statusFontColor = 'FF15803D' // Green-700
      statusBgColor = 'FFDCFCE7' // Green-100
    }

    cellStatus.font = { name: 'Calibri', size: 9, bold: true, color: { argb: statusFontColor } }
    cellStatus.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: statusBgColor },
    }

    // Aplicar estilos comunes a las demás celdas de la fila
    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c)
      cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF1E293B' } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBgColor },
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    }

    cellStatus.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    }

    currentRowIndex++
  }

  // 5. Fila de totales
  const totalRow = worksheet.getRow(currentRowIndex)
  totalRow.height = 24
  worksheet.mergeCells(`A${currentRowIndex}:F${currentRowIndex}`)
  const totalLabelCell = totalRow.getCell(1)
  totalLabelCell.value = `TOTAL GENERAL (${items.length} MEDICAMENTOS REGISTRADOS)`
  totalLabelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } }
  totalLabelCell.alignment = { vertical: 'middle', horizontal: 'right' }

  const totalStockCell = totalRow.getCell(7)
  if (items.length > 0) {
    totalStockCell.value = { formula: `SUM(G6:G${currentRowIndex - 1})`, result: totalStock }
  } else {
    totalStockCell.value = 0
  }
  totalStockCell.numFmt = '#,##0'
  totalStockCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E3A8A' } }
  totalStockCell.alignment = { vertical: 'middle', horizontal: 'right' }

  const emptyStatusCell = totalRow.getCell(8)
  emptyStatusCell.value = ''

  for (let c = 1; c <= 8; c++) {
    const cell = totalRow.getCell(c)
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' }, // Slate-100
    }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF64748B' } },
      bottom: { style: 'double', color: { argb: 'FF64748B' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    }
  }

  // 6. Generar buffer y descargar
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const cleanClinic = clinicName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const filename = `Inventario_${cleanClinic}_${formatDateString(generatedAt)}.xlsx`
  downloadBlob(blob, filename)
}

/**
 * Exportación a formato PDF estilizado en horizontal (Landscape) usando pdf-lib
 */
export async function exportToPdf(
  items: ExportInventoryItem[],
  options: ExportOptions = {}
): Promise<void> {
  const {
    clinicName = 'Unidad Médica General',
    userName = 'Sistema SIINM',
    generatedAt = new Date(),
  } = options

  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Dimensiones carta horizontal (Landscape Letter): 792 pt x 612 pt
  const pageWidth = 792
  const pageHeight = 612
  const marginLeft = 36
  const marginRight = 36
  const usableWidth = pageWidth - marginLeft - marginRight // 720 pt

  // Definición de columnas que suman exactamente 720 pt
  const columns = [
    { label: '#', width: 25, align: 'center' as const },
    { label: 'Clave SSA', width: 85, align: 'center' as const },
    { label: 'Medicamento / Insumo', width: 220, align: 'left' as const },
    { label: 'Presentación', width: 130, align: 'left' as const },
    { label: 'Lote', width: 75, align: 'center' as const },
    { label: 'Caducidad', width: 75, align: 'center' as const },
    { label: 'Stock', width: 50, align: 'right' as const },
    { label: 'Estatus', width: 60, align: 'center' as const },
  ]

  const rowHeight = 18
  const headerHeightFirstPage = 96
  const headerHeightOtherPages = 55
  const footerHeight = 35

  const availableHeightFirstPage = pageHeight - headerHeightFirstPage - footerHeight
  const rowsFirstPage = Math.floor(availableHeightFirstPage / rowHeight)
  const availableHeightOtherPages = pageHeight - headerHeightOtherPages - footerHeight
  const rowsOtherPages = Math.floor(availableHeightOtherPages / rowHeight)

  // Calcular número total de páginas
  let totalPages = 1
  if (items.length > rowsFirstPage) {
    totalPages = 1 + Math.ceil((items.length - rowsFirstPage) / rowsOtherPages)
  }

  const fitText = (text: string, maxWidth: number, font: typeof fontRegular, size: number) => {
    const clean = sanitizeForWinAnsi(text)
    if (font.widthOfTextAtSize(clean, size) <= maxWidth) {
      return clean
    }
    let truncated = clean
    while (truncated.length > 0 && font.widthOfTextAtSize(truncated + '...', size) > maxWidth) {
      truncated = truncated.slice(0, -1)
    }
    return truncated.length > 0 ? `${truncated}...` : ''
  }

  let itemIndex = 0

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = pdfDoc.addPage([pageWidth, pageHeight])
    let currentY = pageHeight - 32

    // 1. Encabezado de página
    if (pageNum === 1) {
      // Título principal
      page.drawText(sanitizeForWinAnsi('SIINM - SISTEMA INTEGRAL DE INVENTARIO DE MEDICAMENTOS'), {
        x: marginLeft,
        y: currentY,
        size: 13,
        font: fontBold,
        color: rgb(0.12, 0.23, 0.54), // Dark Navy
      })

      currentY -= 15
      page.drawText(sanitizeForWinAnsi('REPORTE OFICIAL DE INVENTARIO Y DISPONIBILIDAD'), {
        x: marginLeft,
        y: currentY,
        size: 9,
        font: fontBold,
        color: rgb(0.3, 0.35, 0.45),
      })

      // Datos adicionales: Clínica, Fecha, Usuario
      currentY -= 16
      const clinicText = `Unidad Médica: ${clinicName}`
      const metaText = `Fecha: ${formatDisplayDate(generatedAt)}   |   Generado por: ${userName}`

      page.drawText(sanitizeForWinAnsi(clinicText), {
        x: marginLeft,
        y: currentY,
        size: 8,
        font: fontBold,
        color: rgb(0.2, 0.25, 0.35),
      })

      page.drawText(sanitizeForWinAnsi(metaText), {
        x: pageWidth - marginRight - fontRegular.widthOfTextAtSize(sanitizeForWinAnsi(metaText), 8),
        y: currentY,
        size: 8,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.55),
      })

      currentY -= 18
    } else {
      // Encabezado compacto en páginas subsiguientes
      page.drawText(
        sanitizeForWinAnsi(`SIINM | Reporte de Inventario - ${clinicName}`),
        {
          x: marginLeft,
          y: currentY,
          size: 9,
          font: fontBold,
          color: rgb(0.12, 0.23, 0.54),
        }
      )
      const pageInfo = `Página ${pageNum} de ${totalPages}`
      page.drawText(pageInfo, {
        x: pageWidth - marginRight - fontRegular.widthOfTextAtSize(pageInfo, 8),
        y: currentY,
        size: 8,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.55),
      })
      currentY -= 16
    }

    // 2. Encabezado de la tabla (Fondo oscuro con texto blanco)
    page.drawRectangle({
      x: marginLeft,
      y: currentY - rowHeight + 4,
      width: usableWidth,
      height: rowHeight,
      color: rgb(0.12, 0.16, 0.24), // Slate-800
    })

    let colX = marginLeft
    for (const col of columns) {
      const text = col.label
      const textSize = 8
      let textX = colX + 4
      if (col.align === 'center') {
        const textWidth = fontBold.widthOfTextAtSize(text, textSize)
        textX = colX + (col.width - textWidth) / 2
      } else if (col.align === 'right') {
        const textWidth = fontBold.widthOfTextAtSize(text, textSize)
        textX = colX + col.width - textWidth - 4
      }

      page.drawText(text, {
        x: textX,
        y: currentY - 9,
        size: textSize,
        font: fontBold,
        color: rgb(1, 1, 1),
      })

      colX += col.width
    }

    currentY -= rowHeight

    // 3. Filas de datos
    const maxRowsThisPage = pageNum === 1 ? rowsFirstPage : rowsOtherPages
    let rowsCount = 0

    while (itemIndex < items.length && rowsCount < maxRowsThisPage) {
      const item = items[itemIndex]
      const isEven = itemIndex % 2 === 0
      const rowY = currentY - rowHeight + 4

      // Fondo alternado suave
      if (isEven) {
        page.drawRectangle({
          x: marginLeft,
          y: rowY,
          width: usableWidth,
          height: rowHeight,
          color: rgb(0.97, 0.98, 0.99),
        })
      }

      // Línea divisoria inferior tenue
      page.drawLine({
        start: { x: marginLeft, y: rowY },
        end: { x: marginLeft + usableWidth, y: rowY },
        thickness: 0.5,
        color: rgb(0.9, 0.92, 0.94),
      })

      const { status, label: statusLabel } = getExpiryStatus(item.fecha_caducidad)

      let cellX = marginLeft
      for (let c = 0; c < columns.length; c++) {
        const col = columns[c]
        let rawVal = ''

        switch (c) {
          case 0:
            rawVal = String(itemIndex + 1)
            break
          case 1:
            rawVal = item.clave_ssa || 'S/C'
            break
          case 2:
            rawVal = item.medicamento
            break
          case 3:
            rawVal = item.presentacion || 'Pieza'
            break
          case 4:
            rawVal = item.lote || '00000'
            break
          case 5:
            rawVal = item.fecha_caducidad || 'N/A'
            break
          case 6:
            rawVal = item.stock.toLocaleString('en-US')
            break
          case 7:
            rawVal = statusLabel
            break
        }

        const fontSize = 7.5
        const maxContentWidth = col.width - 8
        const fitted = fitText(rawVal, maxContentWidth, fontRegular, fontSize)

        let posX = cellX + 4
        if (col.align === 'center') {
          const w = fontRegular.widthOfTextAtSize(fitted, fontSize)
          posX = cellX + (col.width - w) / 2
        } else if (col.align === 'right') {
          const w = fontRegular.widthOfTextAtSize(fitted, fontSize)
          posX = cellX + col.width - w - 4
        }

        let textColor = rgb(0.12, 0.16, 0.24)
        if (c === 7) {
          if (status === 'caducado') {
            textColor = rgb(0.8, 0.15, 0.15)
          } else if (status === 'por_caducar') {
            textColor = rgb(0.75, 0.4, 0.05)
          } else {
            textColor = rgb(0.1, 0.55, 0.25)
          }
        }

        page.drawText(fitted, {
          x: posX,
          y: currentY - 9,
          size: fontSize,
          font: c === 7 || c === 0 ? fontBold : fontRegular,
          color: textColor,
        })

        cellX += col.width
      }

      currentY -= rowHeight
      rowsCount++
      itemIndex++
    }

    // 4. Pie de página
    const footerY = 22
    page.drawLine({
      start: { x: marginLeft, y: footerY + 12 },
      end: { x: marginLeft + usableWidth, y: footerY + 12 },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.9),
    })

    const footerLeft = sanitizeForWinAnsi(`SIINM - Sistema de Control Farmacéutico y Hospitalario`)
    page.drawText(footerLeft, {
      x: marginLeft,
      y: footerY,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6),
    })

    const pageNotice = `Página ${pageNum} de ${totalPages}   |   ${items.length} Registros`
    page.drawText(pageNotice, {
      x: pageWidth - marginRight - fontRegular.widthOfTextAtSize(pageNotice, 7.5),
      y: footerY,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6),
    })
  }

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const cleanClinic = clinicName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const filename = `Inventario_${cleanClinic}_${formatDateString(generatedAt)}.pdf`
  downloadBlob(blob, filename)
}

/**
 * Exportación a formato CSV con BOM UTF-8 para compatibilidad universal con Excel
 */
export async function exportToCsv(
  items: ExportInventoryItem[],
  options: ExportOptions = {}
): Promise<void> {
  const { clinicName = 'Unidad Médica General', generatedAt = new Date() } = options

  const escapeCsv = (val: string | number = '') => {
    const str = String(val).replace(/"/g, '""')
    return `"${str}"`
  }

  const csvRows: string[] = []

  // Encabezados descriptivos
  csvRows.push([
    escapeCsv('#'),
    escapeCsv('Clave SSA'),
    escapeCsv('Medicamento'),
    escapeCsv('Presentación'),
    escapeCsv('Lote'),
    escapeCsv('Fecha Caducidad'),
    escapeCsv('Stock'),
    escapeCsv('Estatus'),
  ].join(','))

  // Filas
  items.forEach((item, idx) => {
    const { label: statusLabel } = getExpiryStatus(item.fecha_caducidad)
    csvRows.push([
      escapeCsv(idx + 1),
      escapeCsv(item.clave_ssa || 'S/C'),
      escapeCsv(item.medicamento),
      escapeCsv(item.presentacion || 'Pieza'),
      escapeCsv(item.lote || '00000'),
      escapeCsv(item.fecha_caducidad || 'N/A'),
      escapeCsv(item.stock),
      escapeCsv(statusLabel),
    ].join(','))
  })

  // Prefijo \uFEFF para asegurar que Excel reconozca codificación UTF-8 con acentos y caracteres especiales
  const csvContent = '\uFEFF' + csvRows.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const cleanClinic = clinicName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const filename = `Inventario_${cleanClinic}_${formatDateString(generatedAt)}.csv`
  downloadBlob(blob, filename)
}
