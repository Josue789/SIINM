import { Workbook } from 'exceljs'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { z } from 'zod'
import { db } from '@/db'
import { supabase } from '@/services/supabase/client'
import { sha256PureJs } from '@/services/supabase/auth.service'
import { inventarioRepository } from '@/db/repositories/inventario.repository'
import type { InventarioItem } from '@/types/inventory.types'

export interface ExportInventoryItem {
  id?: string | number
  id_clinica?: number
  id_medicamento?: number | string
  clave_ssa: string
  medicamento: string
  presentacion: string
  lote: string
  fecha_caducidad: string
  stock: number
  codigo_barras?: string
  clinicaNombre?: string
  update_date?: string
}

export interface ExportOptions {
  clinicId?: number | null
  clinicName?: string
  userName?: string
  generatedAt?: Date
}

export interface SyncPackageItem {
  id?: string | number
  id_clinica: number
  id_medicamento?: number | string
  clave_ssa: string
  medicamento: string
  presentacion: string
  lote: string
  fecha_caducidad: string
  stock: number
  codigo_barras?: string
  update_date: string
}

export interface SyncPackageMetadata {
  magic: 'SIINM_SYNC_V1'
  version: 1
  exportedAt: string
  clinicId: number | null
  clinicName: string
  exportedBy: string
  recordCount: number
  totalStock: number
}

export interface SyncPackageEnvelope {
  metadata: SyncPackageMetadata
  items: SyncPackageItem[]
  integrityHash: string
}

export interface ImportSyncResult {
  inserted: number
  updated: number
  skipped: number
  totalProcessed: number
  errors: string[]
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
          id_medicamento: item.id_medicamento || catItem?.id || '',
          clave_ssa: item.clave_ssa || catItem?.clave_ssa || catItem?.codigo_barras || '',
          medicamento: item.medicamento || catItem?.medicamento || catItem?.name || 'Medicamento sin nombre',
          presentacion: item.presentacion || catItem?.presentacion || 'Pieza',
          lote: item.lote || '00000',
          fecha_caducidad: item.fecha_caducidad || 'N/A',
          stock: Number(item.stock) || 0,
          codigo_barras: item.codigo_barras || catItem?.codigo_barras || '',
          update_date: item.update_date || new Date().toISOString(),
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
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
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

// ============================================================================
// FORMATO SEGURO .sync.gz (COMPRESIÓN GZIP + FIRMA SHA-256 + VALIDACIÓN ZOD)
// ============================================================================

const SYNC_MAGIC = 'SIINM_SYNC_V1' as const
const SYNC_INTEGRITY_SALT = 'SIINM_SECURE_TRANSPORT_2026_V1_SALT'

const SyncPackageItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  id_clinica: z.number().int().nonnegative(),
  id_medicamento: z.union([z.string(), z.number()]).optional(),
  clave_ssa: z.string(),
  medicamento: z.string().min(1, 'El nombre del medicamento es obligatorio'),
  presentacion: z.string(),
  lote: z.string().min(1, 'El lote es obligatorio'),
  fecha_caducidad: z.string(),
  stock: z.number().nonnegative('El stock no puede ser negativo'),
  codigo_barras: z.string().optional(),
  update_date: z.string(),
})

const SyncPackageMetadataSchema = z.object({
  magic: z.literal(SYNC_MAGIC),
  version: z.literal(1),
  exportedAt: z.string(),
  clinicId: z.number().nullable(),
  clinicName: z.string().min(1),
  exportedBy: z.string().min(1),
  recordCount: z.number().int().nonnegative(),
  totalStock: z.number().nonnegative(),
})

const SyncPackageEnvelopeSchema = z.object({
  metadata: SyncPackageMetadataSchema,
  items: z.array(SyncPackageItemSchema),
  integrityHash: z.string().min(32),
})

/**
 * Calcula un hash de integridad SHA-256 determinístico sobre los metadatos y registros.
 */
async function computeSyncIntegrityHash(
  metadata: SyncPackageMetadata,
  items: SyncPackageItem[]
): Promise<string> {
  const canonicalItems = items.map((it) => ({
    c: Number(it.id_clinica) || 0,
    m: String(it.id_medicamento ?? ''),
    s: String(it.clave_ssa || '').trim(),
    n: String(it.medicamento || '').trim(),
    p: String(it.presentacion || '').trim(),
    l: String(it.lote || '').trim(),
    f: String(it.fecha_caducidad || '').trim(),
    k: Number(it.stock) || 0,
    b: String(it.codigo_barras || '').trim(),
    u: String(it.update_date || ''),
  }))

  const canonicalPayload = JSON.stringify({
    salt: SYNC_INTEGRITY_SALT,
    magic: metadata.magic,
    version: metadata.version,
    exportedAt: metadata.exportedAt,
    clinicId: metadata.clinicId,
    clinicName: metadata.clinicName,
    exportedBy: metadata.exportedBy,
    recordCount: metadata.recordCount,
    totalStock: metadata.totalStock,
    items: canonicalItems,
  })

  return sha256PureJs(canonicalPayload)
}

/**
 * Comprime un string en formato GZIP nativo (.gz) usando CompressionStream
 */
async function compressGzip(text: string): Promise<Blob> {
  const encoder = new TextEncoder()
  const rawBytes = encoder.encode(text)

  if (typeof CompressionStream !== 'undefined') {
    const stream = new Blob([rawBytes]).stream().pipeThrough(new CompressionStream('gzip'))
    return await new Response(stream).blob()
  }

  throw new Error('Este navegador no soporta compresión GZIP nativa (CompressionStream).')
}

/**
 * Descomprime un archivo/Blob GZIP (.gz) usando DecompressionStream
 */
async function decompressGzip(file: File | Blob): Promise<string> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador no soporta descompresión GZIP nativa (DecompressionStream).')
  }

  try {
    const stream = file.stream().pipeThrough(new DecompressionStream('gzip'))
    const decompressedResponse = new Response(stream)
    return await decompressedResponse.text()
  } catch {
    throw new Error(
      'El archivo no es un paquete GZIP válido o su estructura binaria está dañada.'
    )
  }
}

/**
 * Exporta el inventario a un archivo seguro comprimido y firmado (.sync.gz)
 */
export async function exportToSyncGz(
  items: ExportInventoryItem[],
  options: ExportOptions = {}
): Promise<void> {
  const {
    clinicId = null,
    clinicName = 'Unidad Médica General',
    userName = 'Sistema SIINM',
    generatedAt = new Date(),
  } = options

  const isoNow = generatedAt.toISOString()

  const syncItems: SyncPackageItem[] = items.map((item) => ({
    id: item.id,
    id_clinica: Number(item.id_clinica || clinicId || 0),
    id_medicamento: item.id_medicamento ?? '',
    clave_ssa: String(item.clave_ssa || '').trim(),
    medicamento: String(item.medicamento || 'Medicamento').trim(),
    presentacion: String(item.presentacion || 'Pieza').trim(),
    lote: String(item.lote || '00000').trim(),
    fecha_caducidad: String(item.fecha_caducidad || 'N/A').trim(),
    stock: Math.max(0, Number(item.stock) || 0),
    codigo_barras: String(item.codigo_barras || '').trim(),
    update_date: item.update_date || isoNow,
  }))

  const totalStock = syncItems.reduce((acc, curr) => acc + curr.stock, 0)

  const metadata: SyncPackageMetadata = {
    magic: SYNC_MAGIC,
    version: 1,
    exportedAt: isoNow,
    clinicId: clinicId && clinicId > 0 ? Number(clinicId) : null,
    clinicName,
    exportedBy: userName,
    recordCount: syncItems.length,
    totalStock,
  }

  const integrityHash = await computeSyncIntegrityHash(metadata, syncItems)

  const envelope: SyncPackageEnvelope = {
    metadata,
    items: syncItems,
    integrityHash,
  }

  const jsonPayload = JSON.stringify(envelope)
  const gzipBlob = await compressGzip(jsonPayload)
  const finalBlob = new Blob([gzipBlob], { type: 'application/gzip' })

  const cleanClinic = clinicName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const filename = `Inventario_${cleanClinic}_${formatDateString(generatedAt)}.sync.gz`
  downloadBlob(finalBlob, filename)
}

/**
 * Descomprime y valida criptográfica y estructuralmente un archivo .sync.gz
 */
export async function validateSyncGzFile(file: File): Promise<SyncPackageEnvelope> {
  if (!file) {
    throw new Error('No se seleccionó ningún archivo.')
  }

  const fileNameLower = file.name.toLowerCase()
  if (!fileNameLower.endsWith('.sync.gz') && !fileNameLower.endsWith('.gz')) {
    throw new Error('Formato de archivo inválido. Debe seleccionar un archivo con extensión .sync.gz')
  }

  if (file.size === 0) {
    throw new Error('El archivo seleccionado está vacío.')
  }

  if (file.size > 25 * 1024 * 1024) {
    throw new Error('El archivo excede el tamaño máximo permitido (25 MB).')
  }

  // 1. Descomprimir GZIP
  const decompressedText = await decompressGzip(file)

  // 2. Parsear JSON
  let rawParsed: unknown
  try {
    rawParsed = JSON.parse(decompressedText)
  } catch {
    throw new Error('El contenido del archivo .sync.gz no tiene una estructura de datos válida.')
  }

  // 3. Validar esquema con Zod
  const parsedResult = SyncPackageEnvelopeSchema.safeParse(rawParsed)
  if (!parsedResult.success) {
    const firstIssue = parsedResult.error.issues[0]
    throw new Error(
      `Estructura de paquete inválida (${firstIssue?.path.join('.') || 'formato'}): ${
        firstIssue?.message || 'El archivo no cumple el esquema SIINM.'
      }`
    )
  }

  const envelope = parsedResult.data

  // 4. Validar consistencia de conteos en metadatos
  if (envelope.metadata.recordCount !== envelope.items.length) {
    throw new Error(
      `Inconsistencia detectada: la cabecera declara ${envelope.metadata.recordCount} registros pero el paquete contiene ${envelope.items.length}.`
    )
  }

  const calculatedTotalStock = envelope.items.reduce((acc, it) => acc + (Number(it.stock) || 0), 0)
  if (envelope.metadata.totalStock !== calculatedTotalStock) {
    throw new Error(
      `Inconsistencia detectada en el total de existencias (${envelope.metadata.totalStock} vs ${calculatedTotalStock}).`
    )
  }

  // 5. Verificar firma criptográfica SHA-256 contra manipulaciones
  const expectedHash = await computeSyncIntegrityHash(envelope.metadata, envelope.items)
  if (expectedHash !== envelope.integrityHash) {
    throw new Error(
      'Firma de seguridad SHA-256 inválida: los datos del archivo fueron modificados externamente o están corruptos.'
    )
  }

  return envelope
}

/**
 * Sincroniza e importa los datos de un paquete .sync.gz previamente validado hacia Supabase y Dexie.
 * Requiere conexión activa a Internet.
 */
export async function importSyncPackageToSupabase(
  envelope: SyncPackageEnvelope,
  options: {
    fallbackClinicId?: number | null
    mode?: 'replace' | 'accumulate'
    onProgress?: (processed: number, total: number) => void
  } = {}
): Promise<ImportSyncResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(
      'Se requiere conexión a Internet activa para importar y actualizar los datos en Supabase.'
    )
  }

  const { fallbackClinicId = null, mode = 'replace', onProgress } = options

  // Revalidar firma antes de ejecutar escritura remota
  const expectedHash = await computeSyncIntegrityHash(envelope.metadata, envelope.items)
  if (expectedHash !== envelope.integrityHash) {
    throw new Error('La verificación de firma de integridad falló antes de sincronizar.')
  }

  // 1. Obtener catálogo de medicamentos desde Supabase para resolver id_medicamento de forma confiable
  const { data: remoteCatalog, error: catError } = await supabase
    .from('catalogo_medicamentos')
    .select('id, clave_ssa, codigo_barras, medicamento, presentacion')

  if (catError) {
    throw new Error(`No se pudo conectar con Supabase para validar el catálogo: ${catError.message}`)
  }

  const catalogById = new Map<string, Record<string, unknown>>()
  const catalogByClave = new Map<string, Record<string, unknown>>()
  const catalogByBarcode = new Map<string, Record<string, unknown>>()

  for (const c of remoteCatalog || []) {
    if (c.id !== undefined && c.id !== null) {
      catalogById.set(String(c.id).trim().toLowerCase(), c)
    }
    if (c.clave_ssa) {
      catalogByClave.set(String(c.clave_ssa).trim().toLowerCase(), c)
    }
    if (c.codigo_barras) {
      catalogByBarcode.set(String(c.codigo_barras).trim().toLowerCase(), c)
    }
  }

  // 2. Identificar las clínicas involucradas en el paquete
  const targetClinicsSet = new Set<number>()
  for (const item of envelope.items) {
    const cid = Number(item.id_clinica || envelope.metadata.clinicId || fallbackClinicId || 0)
    if (cid > 0) targetClinicsSet.add(cid)
  }

  if (targetClinicsSet.size === 0) {
    throw new Error(
      'El paquete no especifica una clínica destino válida. Selecciona una Unidad Médica antes de importar.'
    )
  }

  // 3. Consultar registros actuales en Supabase para las clínicas involucradas
  const clinicIds = Array.from(targetClinicsSet)
  const { data: existingRemoteItems, error: invFetchErr } = await supabase
    .from('Inventario')
    .select('id, id_clinica, id_medicamento, lote, stock, fecha_caducidad')
    .in('id_clinica', clinicIds)

  if (invFetchErr) {
    throw new Error(`Error al consultar inventario actual en Supabase: ${invFetchErr.message}`)
  }

  // Mapa rápido por clave compuesta: `${id_clinica}-${id_medicamento}-${lote_lower}`
  const existingRemoteMap = new Map<
    string,
    { id: number | string; stock: number; fecha_caducidad: string }
  >()
  for (const rem of existingRemoteItems || []) {
    const key = `${Number(rem.id_clinica)}-${String(rem.id_medicamento).trim().toLowerCase()}-${String(
      rem.lote || ''
    )
      .trim()
      .toLowerCase()}`
    existingRemoteMap.set(key, {
      id: rem.id,
      stock: Number(rem.stock) || 0,
      fecha_caducidad: String(rem.fecha_caducidad || 'N/A'),
    })
  }

  let inserted = 0
  let updated = 0
  let skipped = 0
  const errors: string[] = []
  const nowIso = new Date().toISOString()

  for (let i = 0; i < envelope.items.length; i++) {
    const item = envelope.items[i]
    const resolvedClinicId = Number(
      item.id_clinica || envelope.metadata.clinicId || fallbackClinicId || 0
    )

    if (!resolvedClinicId || resolvedClinicId <= 0) {
      skipped++
      errors.push(`Fila ${i + 1} (${item.medicamento}): Sin clínica asignada.`)
      onProgress?.(i + 1, envelope.items.length)
      continue
    }

    // Resolver id_medicamento contra el catálogo de Supabase
    const rawMedId = String(item.id_medicamento ?? '').trim().toLowerCase()
    const rawClave = String(item.clave_ssa || '').trim().toLowerCase()
    const rawBarcode = String(item.codigo_barras || '').trim().toLowerCase()

    const matchedCat =
      (rawMedId ? catalogById.get(rawMedId) : undefined) ||
      (rawClave ? catalogByClave.get(rawClave) : undefined) ||
      (rawBarcode ? catalogByBarcode.get(rawBarcode) : undefined)

    const resolvedMedId = matchedCat?.id ?? item.id_medicamento
    if (
      resolvedMedId === undefined ||
      resolvedMedId === null ||
      String(resolvedMedId).trim() === ''
    ) {
      skipped++
      errors.push(
        `Fila ${i + 1} (${item.medicamento} - Clave ${item.clave_ssa || 'S/C'}): No se encontró equivalencia en el catálogo de Supabase.`
      )
      onProgress?.(i + 1, envelope.items.length)
      continue
    }

    const medIdParsed: number | string = !isNaN(Number(resolvedMedId))
      ? Number(resolvedMedId)
      : String(resolvedMedId)
    const loteClean = String(item.lote || '00000').trim()
    const lookupKey = `${resolvedClinicId}-${String(medIdParsed).trim().toLowerCase()}-${loteClean.toLowerCase()}`

    const existingRemote = existingRemoteMap.get(lookupKey)

    try {
      if (existingRemote) {
        const finalStock =
          mode === 'accumulate'
            ? Math.max(0, Number(existingRemote.stock) + Number(item.stock))
            : Math.max(0, Number(item.stock))

        const updatePayload = {
          stock: finalStock,
          fecha_caducidad: item.fecha_caducidad || existingRemote.fecha_caducidad || 'N/A',
          update_date: nowIso,
        }

        const { error: updErr } = await supabase
          .from('Inventario')
          .update(updatePayload)
          .eq('id', existingRemote.id)

        if (updErr) {
          skipped++
          errors.push(`Error actualizando lote ${loteClean} (${item.medicamento}): ${updErr.message}`)
        } else {
          updated++
          existingRemoteMap.set(lookupKey, {
            id: existingRemote.id,
            stock: finalStock,
            fecha_caducidad: updatePayload.fecha_caducidad,
          })

          await db.inventario.put({
            id: existingRemote.id,
            id_clinica: resolvedClinicId,
            id_medicamento: medIdParsed,
            lote: loteClean,
            stock: finalStock,
            fecha_caducidad: updatePayload.fecha_caducidad,
            update_date: nowIso,
            medicamento: (matchedCat?.medicamento as string) || item.medicamento,
            clave_ssa: (matchedCat?.clave_ssa as string) || item.clave_ssa,
            presentacion: (matchedCat?.presentacion as string) || item.presentacion,
            codigo_barras: (matchedCat?.codigo_barras as string) || item.codigo_barras,
          })
        }
      } else {
        const insertPayload = {
          id_clinica: resolvedClinicId,
          id_medicamento: medIdParsed,
          lote: loteClean,
          stock: Math.max(0, Number(item.stock)),
          fecha_caducidad: item.fecha_caducidad || 'N/A',
          update_date: nowIso,
        }

        const { data: insertedRows, error: insErr } = await supabase
          .from('Inventario')
          .insert(insertPayload)
          .select()

        if (insErr) {
          skipped++
          errors.push(`Error insertando lote ${loteClean} (${item.medicamento}): ${insErr.message}`)
        } else {
          inserted++
          const newRemoteId = insertedRows?.[0]?.id
          if (newRemoteId !== undefined) {
            existingRemoteMap.set(lookupKey, {
              id: newRemoteId,
              stock: insertPayload.stock,
              fecha_caducidad: insertPayload.fecha_caducidad,
            })

            await db.inventario.put({
              id: newRemoteId,
              id_clinica: resolvedClinicId,
              id_medicamento: medIdParsed,
              lote: loteClean,
              stock: insertPayload.stock,
              fecha_caducidad: insertPayload.fecha_caducidad,
              update_date: nowIso,
              medicamento: (matchedCat?.medicamento as string) || item.medicamento,
              clave_ssa: (matchedCat?.clave_ssa as string) || item.clave_ssa,
              presentacion: (matchedCat?.presentacion as string) || item.presentacion,
              codigo_barras: (matchedCat?.codigo_barras as string) || item.codigo_barras,
            })
          }
        }
      }
    } catch (err) {
      skipped++
      const msg = err instanceof Error ? err.message : 'Error de red'
      errors.push(`Excepción en lote ${loteClean}: ${msg}`)
    }

    onProgress?.(i + 1, envelope.items.length)
  }

  await inventarioRepository.deduplicateLocal()

  return {
    inserted,
    updated,
    skipped,
    totalProcessed: envelope.items.length,
    errors,
  }
}
