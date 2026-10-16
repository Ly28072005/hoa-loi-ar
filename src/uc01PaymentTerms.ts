/**
 * Read-only assessment of payment terms for UC01 (BR14–BR15, F16/F57/F58).
 * Does not invent a due date or mutate accounting data. UC04 owns notification rules.
 */
export type SourceRecord = Record<string, any>

export type PaymentTermView = {
  termText: string
  dueText: string
  basisText: string
  statusText: string
  requiresVerification: boolean
  dueDate: string | null
}

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const day = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value ? value : null
}

function displayDate(value: string): string {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function termDescription(term: unknown): string {
  if (typeof term === 'string') return term.trim()
  if (!term || typeof term !== 'object') return ''
  const value = term as SourceRecord
  return String(value.text ?? value.description ?? '').trim()
}

function calendarDayAfter(base: string, n: number): string | null {
  if (!isoDate(base) || !Number.isInteger(n) || n < 0 || n > 36500) return null
  const calculated = new Date(`${base}T00:00:00.000Z`)
  calculated.setUTCDate(calculated.getUTCDate() + n)
  return calculated.toISOString().slice(0, 10)
}

/**
 * Only approved structured source data can supply a computed due date.
 * An invoice date without a validated payment term is displayed with a warning.
 */
export function getUc01PaymentTerms(
  source: SourceRecord,
  invoice: SourceRecord | undefined,
  originalInvoice: SourceRecord | undefined,
  linkedDocuments: SourceRecord[],
): PaymentTermView {
  const isAdjustment = Boolean(source.originalInvoiceId)
  const effectiveInvoice = isAdjustment ? originalInvoice : invoice
  const linked = linkedDocuments.filter((doc) =>
    ['Đơn đặt hàng', 'Hợp đồng', 'Thỏa thuận thanh toán', 'Văn bản thỏa thuận'].includes(String(doc.type)),
  )
  const candidates = [
    ...linked.filter((doc) => doc.paymentTerms).map((doc) => ({ term: doc.paymentTerms, reference: `${doc.type} ${doc.id}` })),
    ...(source.paymentTerms ? [{ term: source.paymentTerms, reference: `Chứng từ ${source.id}` }] : []),
    ...(!isAdjustment && invoice?.paymentTerms
      ? [{ term: invoice.paymentTerms, reference: `Hóa đơn ${invoice.id}` }]
      : []),
  ]

  const explicitTerms = candidates.map((item) => termDescription(item.term)).filter(Boolean)
  const uniqueTerms = [...new Set(explicitTerms)]
  const fallbackTerm = uniqueTerms.length > 0 ? uniqueTerms.join(' | ') : 'Chưa thiết lập điều khoản'
  const invoiceDueAt = isoDate(effectiveInvoice?.dueAt)

  if (uniqueTerms.length > 1) {
    return {
      termText: fallbackTerm,
      dueText: 'Chưa xác định hạn thanh toán',
      basisText: candidates.map((item) => item.reference).join('; '),
      statusText: 'Các nguồn có điều khoản khác nhau; cần xác nhận nguồn ưu tiên tại chức năng nguồn',
      requiresVerification: true,
      dueDate: null,
    }
  }

  const candidate = candidates[0]
  if (candidate && typeof candidate.term === 'object') {
    const term = candidate.term as SourceRecord
    const approved = term.approved === true
    const isFixed = term.type === 'fixedDate'
    const isAfterDays = term.type === 'afterDays'
    const fixedDue = isFixed ? isoDate(term.dueDate) : null
    const calculatedDue =
      isAfterDays && term.dayBasis === 'calendar' && typeof term.baseDate === 'string' && typeof term.days === 'number'
        ? calendarDayAfter(term.baseDate, Number(term.days))
        : null
    const proposed = fixedDue ?? calculatedDue
    if (approved && proposed && (!invoiceDueAt || invoiceDueAt === proposed)) {
      return {
        termText: fallbackTerm,
        dueText: displayDate(proposed),
        basisText: `${candidate.reference}${isAfterDays ? `; mốc ${displayDate(term.baseDate)}; ${term.days} ngày lịch (đã xác nhận)` : '; ngày cụ thể (đã xác nhận)'}`,
        statusText: 'Đã xác định theo điều khoản nguồn có cấu hình được phê duyệt',
        requiresVerification: false,
        dueDate: proposed,
      }
    }
    if (approved && proposed && invoiceDueAt && invoiceDueAt !== proposed) {
      return {
        termText: fallbackTerm,
        dueText: 'Chưa xác định hạn thanh toán',
        basisText: `${candidate.reference}; hóa đơn ${effectiveInvoice?.id}`,
        statusText: 'Ngày theo điều khoản không khớp ngày trên hóa đơn; cần đối chiếu nguồn',
        requiresVerification: true,
        dueDate: null,
      }
    }
    // Event-based, unapproved, business-day without holiday rules, or incomplete metadata:
    // no implicit fallback to an unverified invoice date when an explicit term exists.
    return {
      termText: fallbackTerm,
      dueText: 'Chưa xác định hạn thanh toán',
      basisText: candidate.reference,
      statusText: 'Điều khoản chưa được phê duyệt hoặc thiếu mốc/quy ước tính hạn; chờ chức năng nguồn xác minh',
      requiresVerification: true,
      dueDate: null,
    }
  }
  if (candidate) {
    return {
      termText: fallbackTerm,
      dueText: invoiceDueAt ? displayDate(invoiceDueAt) : 'Chưa xác định hạn thanh toán',
      basisText: `${candidate.reference}${invoiceDueAt ? `; ngày ghi trên hóa đơn ${effectiveInvoice?.id}` : ''}`,
      statusText: 'Điều khoản dạng văn bản chưa có quy tắc xác định hạn được phê duyệt',
      requiresVerification: true,
      dueDate: null,
    }
  }
  if (invoiceDueAt) {
    return {
      termText: 'Chưa thiết lập điều khoản',
      dueText: displayDate(invoiceDueAt),
      basisText: isAdjustment
        ? `Ngày từ hóa đơn gốc ${effectiveInvoice?.id} (chưa có nguồn điều khoản)`
        : `Ngày đã lưu trên hóa đơn liên kết ${effectiveInvoice?.id} (chưa có nguồn điều khoản)`,
      statusText: 'Có ngày hạn trong dữ liệu mẫu; chưa xác minh được điều khoản và căn cứ tính hạn',
      requiresVerification: true,
      dueDate: null,
    }
  }
  return {
    termText: 'Chưa thiết lập điều khoản',
    dueText: 'Chưa xác định hạn thanh toán',
    basisText: 'Chưa có điều khoản, ngày mốc hoặc ngày hạn hợp lệ trong dữ liệu nguồn',
    statusText: 'Chưa xác định hạn thanh toán; không được mặc định nợ quá hạn',
    requiresVerification: true,
    dueDate: null,
  }
}
