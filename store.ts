import mock from "./data/mock.json"
import { useSyncExternalStore } from "react"

export type RecordData = Record<string, any>
export const seed: RecordData = mock
export const SCHEMA = 3
export const STORAGE = "hoaloi-ar-prototype-v3"
const clone = <T>(value: T): T => structuredClone(value)
export function initialState(): RecordData {
  return {
    sessionId: globalThis.crypto.randomUUID(),
    schemaVersion: SCHEMA,
    revision: 1,
    clock: seed.meta.demoClock,
    customers: clone(seed.customers),
    invoices: clone(seed.invoices),
    increases: clone(seed.uc01Sources),
    reductions: clone(seed.uc02Sources),
    receivables: clone(seed.initialReceivables),
    journals: clone(seed.initialJournals),
    allocations: [],
    events: [],
    intakes: [],
    attempts: [],
    reconciliations: clone(seed.reconciliations),
    requests: [],
    rules: clone(seed.reminderRules),
    queue: [],
    history: [],
    configuration: clone(seed.configuration),
    faults: {},
  }
}
let state = initialState()
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE) || "null")
  if (saved?.schemaVersion === SCHEMA) state = saved
} catch {
  /* Unreadable demo storage starts with the supplied fixture. */
}
const listeners = new Set<() => void>()
export function getState() {
  return state
}
export function replaceState(next: RecordData) {
  const old = state
  state = next
  try {
    localStorage.setItem(STORAGE, JSON.stringify(state))
  } catch {
    state = old
    throw new Error(
      "Không thể lưu dữ liệu trên trình duyệt, dữ liệu chưa thay đổi",
    )
  }
  listeners.forEach((fn) => fn())
}
export function updateState(fn: (draft: RecordData) => void) {
  const next = clone(state)
  fn(next)
  next.revision++
  replaceState(next)
}
export function useStore() {
  return useSyncExternalStore((fn) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, getState)
}
export const sum = (xs: RecordData[], field: string) =>
  xs.reduce((a, x) => a + Number(x[field] || 0), 0)
export const money = (value: number) =>
  `${value < 0 ? "Dư Có " : ""}${Math.abs(value).toLocaleString("vi-VN")} VND`
export const date = (value?: string) =>
  value
    ? value.split("T")[0].split("-").reverse().join("/")
    : "Chưa xác định hạn"
export function noticeRows(s: RecordData, rows: RecordData[], at = s.clock) {
  return rows.map((i: RecordData) => {
    const increaseValid = s.events
      .filter(
        (e: RecordData) =>
          e.invoiceId === i.id &&
          e.kind === "increase" &&
          e.date <= at &&
          s.increases.some(
            (x: RecordData) =>
              x.id === e.sourceId && x.originalInvoiceId === i.id,
          ),
      )
      .reduce((n: number, e: RecordData) => n + e.delta, 0)
    const remaining = i.outstanding ?? i.closing
    return {
      ...i,
      outstanding: remaining,
      increaseValid,
      paid: Math.max(0, i.gross + increaseValid - remaining),
    }
  })
}
export const customer = (s: RecordData, id: string) =>
  s.customers.find((c: RecordData) => c.id === id)
export function outstanding(
  s: RecordData,
  invoiceId: string,
  at?: string,
): number {
  const base =
    s.receivables.find((r: RecordData) => r.invoiceId === invoiceId)
      ?.openingOutstanding || 0
  const events = s.events.filter(
    (e: RecordData) => e.invoiceId === invoiceId && (!at || e.date <= at),
  )
  return base + events.reduce((n: number, e: RecordData) => n + e.delta, 0)
}
export function available(s: RecordData, id: string, at?: string): number {
  const r = s.reductions.find((x: RecordData) => x.id === id)
  if (
    !r?.postedAt ||
    (at && r.postedAt > at) ||
    !["Phiếu thu", "Giấy báo Có"].includes(r.type)
  )
    return 0
  return (
    r.amount -
    s.allocations
      .filter((a: RecordData) => a.sourceId === id && (!at || a.date <= at))
      .reduce((n: number, a: RecordData) => n + a.amount, 0)
  )
}
export function balance(s: RecordData, id: string, at?: string): number {
  return (
    s.invoices
      .filter((i: RecordData) => i.customerId === id)
      .reduce((n: number, i: RecordData) => n + outstanding(s, i.id, at), 0) -
    s.reductions
      .filter((r: RecordData) => r.customerId === id)
      .reduce((n: number, r: RecordData) => n + available(s, r.id, at), 0)
  )
}
export function debtRows(s: RecordData, id?: string) {
  return s.invoices
    .filter(
      (i: RecordData) =>
        (!id || i.customerId === id) && outstanding(s, i.id) > 0,
    )
    .map((i: RecordData) => ({ ...i, outstanding: outstanding(s, i.id) }))
}
export function overdue(s: RecordData, i: RecordData, at = s.clock) {
  return i.dueAt
    ? Math.max(0, Math.round((Date.parse(at) - Date.parse(i.dueAt)) / 86400000))
    : null
}
export function severity(s: RecordData, days: number | null) {
  const thresholds = s.configuration.severityThresholds
  if (!thresholds?.length) return "Chưa cấu hình"
  if (days == null) return "Chưa xác định hạn"
  if (days >= thresholds[1]) return "Nghiêm trọng"
  if (days >= thresholds[0]) return "Cảnh báo"
  return "Chưa tới ngưỡng cảnh báo"
}
export function debtStatus(s: RecordData, i: RecordData, at = s.clock) {
  if (!i.dueAt) return "Chưa xác định hạn"
  if (at > i.dueAt) return "Quá hạn"
  if (at === i.dueAt) return "Đến hạn"
  const days = (Date.parse(i.dueAt) - Date.parse(at)) / 86400000
  return s.configuration.earlyWarningDays != null &&
    days <= s.configuration.earlyWarningDays
    ? "Sắp đến hạn"
    : "Chưa đến hạn"
}
export function validateDate(s: RecordData, value: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Vui lòng chọn ngày ghi nhận hợp lệ")
  if (s.faults.locked) throw new Error("Kỳ kế toán đã khóa, không thể ghi nhận")
  if (value < seed.meta.demoClock)
    throw new Error(
      "Ngày ghi nhận trước thời điểm bắt đầu dữ liệu demo, chưa đủ lịch sử để xử lý",
    )
  if (value > s.clock)
    throw new Error("Ngày ghi nhận không được sau ngày demo hiện tại")
}
function validateSource(s: RecordData, source: RecordData, expected: number) {
  if (s.revision !== expected || s.faults.changed)
    throw new Error("Dữ liệu đã thay đổi, vui lòng tải lại và xác nhận lại")
  if (s.faults.cancelled || source.valid === false)
    throw new Error("Chứng từ nguồn hoặc hóa đơn liên kết đã bị hủy")
  if (s.faults.duplicate)
    throw new Error(
      "Chứng từ nguồn, hóa đơn hoặc khoản phải thu đã được ghi nhận",
    )
  if (s.faults.wrongCustomer)
    throw new Error("Khách hàng trên chứng từ không khớp hóa đơn liên kết")
  if (s.faults.missing)
    throw new Error(
      "Thiếu hồ sơ căn cứ bắt buộc, cần bổ sung tại chức năng nguồn",
    )
}
export function postIncrease(
  s: RecordData,
  id: string,
  expected = s.revision,
): {
  state: RecordData
  warning?: string
} {
  const next = clone(s)
  const x = next.increases.find((r: RecordData) => r.id === id)
  if (!x) throw new Error("Không tìm thấy chứng từ nguồn")
  validateSource(s, x, expected)
  validateDate(s, s.clock)
  if (
    s.intakes.some(
      (r: RecordData) =>
        r.sourceId === id ||
        r.invoiceId === x.invoiceId ||
        (x.receivableId && r.receivableId === x.receivableId),
    )
  )
    throw new Error("Chứng từ đã được tiếp nhận, không thể ghi tăng lần nữa")
  const i = s.invoices.find((r: RecordData) => r.id === x.invoiceId)
  if (
    !i ||
    i.customerId !== x.customerId ||
    i.gross !== x.grossIncrease ||
    x.grossIncrease <= 0
  )
    throw new Error("Hóa đơn và chứng từ không khớp khách hàng hoặc số tiền")
  const docs = seed.sourceDocuments.filter((d: RecordData) => d.sourceId === id)
  if (x.originalInvoiceId) {
    if (
      !s.receivables.some(
        (r: RecordData) =>
          r.id === x.receivableId &&
          r.customerId === x.customerId &&
          r.invoiceId === x.originalInvoiceId,
      ) ||
      !docs.some((d: RecordData) => d.id === x.agreementId)
    )
      throw new Error("Thiếu khoản nợ gốc hoặc văn bản thỏa thuận điều chỉnh")
  } else if (
    !docs.some((d: RecordData) => d.id === x.deliveryDocumentId) ||
    !docs.some((d: RecordData) => d.id === (x.orderId || x.contractId))
  ) {
    throw new Error("Thiếu hồ sơ đơn hàng, hợp đồng hoặc phiếu giao hàng")
  }
  let journal = next.journals.find((j: RecordData) => j.sourceId === id)
  if (
    journal &&
    (journal.customerId !== x.customerId || journal.gross !== x.grossIncrease)
  )
    throw new Error("Bút toán đã có không phù hợp chứng từ")
  if (s.faults.posting && !journal) {
    x.intakeStatus = "Chưa hoàn tất"
    const existing = next.attempts.find((a: RecordData) => a.sourceId === id)
    if (!existing)
      next.attempts.push({
        id: `XL-${id}`,
        sourceId: id,
        journalId: null,
        stage: "Hạch toán chưa hoàn tất, xác định chưa tạo bút toán",
      })
    next.revision++
    return {
      state: next,
      warning: `Chưa hoàn tất hạch toán - Mã xử lý XL-${id}. Xác định chưa tạo bút toán, công nợ không thay đổi`,
    }
  }
  if (!journal) {
    journal = {
      id: `BT-${id}`,
      sourceId: id,
      customerId: x.customerId,
      gross: x.grossIncrease,
      lines: x.journalProposal,
      date: s.clock,
    }
    next.journals.push(journal)
  }
  x.journalStatus = "Đã hạch toán"
  x.existingJournalId = journal.id
  if (s.faults.partialSave) {
    x.intakeStatus = "Chưa hoàn tất"
    if (!next.attempts.some((a: RecordData) => a.sourceId === id))
      next.attempts.push({
        id: `XL-${id}`,
        sourceId: id,
        journalId: journal.id,
        stage: "Lưu phát sinh và cập nhật công nợ chưa hoàn tất",
      })
    next.revision++
    return {
      state: next,
      warning: `Chưa hoàn tất ghi nhận công nợ - Mã xử lý XL-${id}. Bút toán ${journal.id} được giữ lại, chưa cập nhật số dư`,
    }
  }
  if (!x.alreadyInBalance)
    next.events.push({
      id: `PS-${id}`,
      sourceId: id,
      customerId: x.customerId,
      invoiceId: x.originalInvoiceId || x.invoiceId,
      delta: x.balanceIncrement,
      date: s.clock,
      kind: "increase",
    })
  x.intakeStatus = "Đã tiếp nhận"
  next.intakes.push({
    sourceId: id,
    invoiceId: x.invoiceId,
    receivableId: x.receivableId,
    date: s.clock,
    journalId: journal.id,
  })
  next.attempts = next.attempts.filter((a: RecordData) => a.sourceId !== id)
  next.invoices.find((r: RecordData) => r.id === x.invoiceId).arStatus =
    "recognized"
  next.revision++
  return { state: next }
}
export function autoAllocation(
  s: RecordData,
  r: RecordData,
  amount = r.amount,
) {
  const rows = debtRows(s, r.customerId)
  if (rows.some((i: RecordData) => !i.dueAt))
    throw new Error(
      "Có hóa đơn chưa xác định hạn, vui lòng chọn Chỉ định hóa đơn",
    )
  rows.sort((a: RecordData, b: RecordData) => a.dueAt.localeCompare(b.dueAt))
  const amounts: Record<string, number> = {}
  for (const i of rows) {
    const n = Math.min(amount, i.outstanding)
    if (n > 0) amounts[i.id] = n
    amount -= n
  }
  return amounts
}
export function postReduction(
  s: RecordData,
  id: string,
  amounts: Record<string, number>,
  options: RecordData = {},
): RecordData {
  const r = s.reductions.find((r: RecordData) => r.id === id)
  if (!r) throw new Error("Không tìm thấy chứng từ")
  validateSource(s, r, options.revision ?? s.revision)
  validateDate(s, options.date || s.clock)
  const allocationOnly = !!options.allocationOnly
  if (!allocationOnly && "debit" in options && !/^\d+$/.test(options.debit))
    throw new Error("Vui lòng nhập tài khoản Nợ hợp lệ, không được để trống")
  const payment = ["Phiếu thu", "Giấy báo Có"].includes(r.type)
  if (!allocationOnly && r.postedAt)
    throw new Error("Chứng từ đã ghi sổ, không ghi sổ lần nữa")
  if (allocationOnly && (!r.postedAt || !payment || available(s, id) <= 0))
    throw new Error("Không còn tiền để phân bổ")
  if (
    options.debit &&
    options.debit !== r.defaultDebitAccount &&
    !options.accountReason?.trim()
  )
    throw new Error("Diễn giải lý do sửa tài khoản Nợ là bắt buộc")
  if (!payment) amounts = { [r.invoiceId]: r.amount }
  const limit = allocationOnly ? available(s, id) : r.amount
  const entries = Object.entries(amounts).filter(([, n]) => n > 0)
  let total = 0
  for (const [invoiceId, amount] of entries) {
    const i = s.invoices.find((i: RecordData) => i.id === invoiceId)
    if (
      !i ||
      i.customerId !== r.customerId ||
      outstanding(s, invoiceId) <= 0 ||
      !Number.isInteger(amount) ||
      amount > outstanding(s, invoiceId)
    )
      throw new Error(
        "Số phân bổ vượt nợ hóa đơn hoặc hóa đơn chưa đủ điều kiện ghi nhận",
      )
    total += amount
  }
  if (Object.values(amounts).some((n) => !Number.isFinite(n) || n < 0))
    throw new Error("Số phân bổ phải là số nguyên không âm")
  if (total > limit) throw new Error("Tổng phân bổ vượt số tiền chứng từ")
  if (allocationOnly && !entries.length) throw new Error("Chưa chọn hóa đơn")
  if (!allocationOnly && payment && total === 0 && !options.note?.trim())
    throw new Error("Vui lòng nhập lý do chưa phân bổ")
  if (s.faults.reduction)
    throw new Error(
      "Ghi sổ không thành công, đã hoàn lại toàn bộ bút toán, phân bổ và số dư của lượt này",
    )
  const next = clone(s)
  const nr = next.reductions.find((x: RecordData) => x.id === id)
  if (!allocationOnly) {
    nr.postedAt = options.date || s.clock
    nr.debit = options.debit || r.defaultDebitAccount
    nr.note = options.note
    next.journals.push({
      id: `BT-${id}`,
      sourceId: id,
      customerId: r.customerId,
      gross: r.amount,
      date: nr.postedAt,
      lines: [
        { side: "Nợ", account: nr.debit, amount: r.net ?? r.amount },
        ...(r.tax
          ? [{ side: "Nợ", account: r.taxAccount, amount: r.tax }]
          : []),
        { side: "Có", account: "131", amount: r.amount },
      ],
    })
  }
  for (const [invoiceId, amount] of entries) {
    next.events.push({
      id: `PS-${id}-${next.events.length}`,
      sourceId: id,
      invoiceId,
      customerId: r.customerId,
      date: options.date || s.clock,
      delta: -amount,
      kind: allocationOnly ? "allocation" : "reduction",
    })
    if (payment)
      next.allocations.push({
        id: `PB-${next.allocations.length + 1}`,
        sourceId: id,
        invoiceId,
        amount,
        date: options.date || s.clock,
      })
  }
  nr.postingStatus =
    payment && available(next, id) > 0
      ? "Đã ghi giảm một phần"
      : "Đã ghi giảm hết"
  next.queue = next.queue.filter(
    (q: RecordData) =>
      balance(next, q.customerId) > 0 &&
      q.invoiceIds.some((i: string) => outstanding(next, i) > 0),
  )
  next.revision++
  return next
}
export function report(
  s: RecordData,
  start: string,
  end: string,
  customerId?: string,
) {
  if (!start || !end || start > end)
    throw new Error(
      "Từ ngày không được sau đến ngày, vui lòng kiểm tra các trường bắt buộc",
    )
  if (start < seed.meta.demoClock || end < seed.meta.demoClock)
    throw new Error(
      "Chưa đủ dữ liệu cho kỳ đã chọn, bộ nền bắt đầu ngày 15/10/2026 và không có lịch sử đầy đủ trước đó",
    )
  if (s.faults.reportRead) throw new Error("Chưa thể truy xuất dữ liệu báo cáo")
  if (s.faults.reportProcess)
    throw new Error("Không thể hoàn tất việc hiển thị báo cáo")
  return s.customers
    .filter((c: RecordData) => !customerId || c.id === customerId)
    .map((c: RecordData) => {
      const previous = new Date(Date.parse(start) - 86400000)
        .toISOString()
        .slice(0, 10)
      const opening = balance(s, c.id, previous)
      const increase = s.events
        .filter(
          (e: RecordData) =>
            e.customerId === c.id &&
            e.kind === "increase" &&
            e.date >= start &&
            e.date <= end,
        )
        .reduce((n: number, e: RecordData) => n + e.delta, 0)
      const decrease = s.reductions
        .filter(
          (r: RecordData) =>
            r.customerId === c.id && r.postedAt >= start && r.postedAt <= end,
        )
        .reduce((n: number, r: RecordData) => n + r.amount, 0)
      return {
        id: c.id,
        name: c.name,
        opening,
        increase,
        decrease,
        closing: opening + increase - decrease,
      }
    })
}
export function renderMessage(
  s: RecordData,
  rule: RecordData,
  id: string,
  amount: number,
  days: number | null,
) {
  const values: RecordData = {
    Ten_KH: customer(s, id)?.name,
    So_Tien_No: money(amount),
    So_Ngay_Qua_Han: days == null ? "Chưa xác định hạn" : days,
    Link_Thanh_Toan: s.configuration.paymentUrl || "Chưa cấu hình",
  }
  return String(rule.template || "").replace(
    /\{(\w+)\}/g,
    (_, key) => values[key] ?? `{${key}}`,
  )
}
export function scan(s: RecordData): RecordData {
  const next = clone(s)
  for (const rule of s.rules.filter(
    (r: RecordData) =>
      !r.deleted &&
      r.status === "Đang kích hoạt" &&
      r.validFrom <= s.clock &&
      r.validTo >= s.clock,
  )) {
    for (const c of s.customers) {
      if (rule.daysWithoutNewOrder > 0) {
        const lastOrder = seed.orders
          .filter((o: RecordData) => o.customerId === c.id && o.issuedAt)
          .sort((a: RecordData, b: RecordData) =>
            b.issuedAt.localeCompare(a.issuedAt),
          )[0]
        if (
          !lastOrder ||
          (Date.parse(s.clock) - Date.parse(lastOrder.issuedAt)) / 86400000 <
            rule.daysWithoutNewOrder
        )
          continue
      }
      const rows = debtRows(s, c.id).filter(
        (i: RecordData) =>
          i.dueAt &&
          (rule.timing === "Trước hạn"
            ? i.dueAt >= s.clock &&
              (Date.parse(i.dueAt) - Date.parse(s.clock)) / 86400000 <=
                rule.daysPastDue
            : (overdue(s, i) || 0) >= rule.daysPastDue && i.dueAt <= s.clock),
      )
      const amount = Math.min(
        sum(rows, "outstanding"),
        Math.max(0, balance(s, c.id)),
      )
      const key = `${rule.id}-${c.id}-${s.clock}`
      if (
        !rows.length ||
        amount < rule.minDebt ||
        amount <= 0 ||
        [...next.queue, ...next.history].some(
          (q: RecordData) => q.cycleKey === key,
        )
      )
        continue
      const days = Math.max(...rows.map((i: RecordData) => overdue(s, i) || 0))
      if (rule.severity && rule.severity !== severity(s, days)) continue
      next.queue.push({
        id: `TB-${key}`,
        cycleKey: key,
        ruleId: rule.id,
        customerId: c.id,
        invoiceIds: rows.map((i: RecordData) => i.id),
        amount,
        days,
        channel: rule.channel,
        template: rule.template,
        minDebt: rule.minDebt,
        content: renderMessage(s, rule, c.id, amount, days),
        status: "Chờ duyệt",
        date: s.clock,
      })
    }
  }
  next.revision++
  return next
}
export function send(s: RecordData, ids: string[]): {
  state: RecordData
  changed: boolean
  sent: number
  failed: number
} {
  const next = clone(s)
  let changed = false,
    sent = 0,
    failed = 0
  for (const q of next.queue.filter((q: RecordData) => ids.includes(q.id))) {
    const amount = Math.min(
      q.invoiceIds.reduce((n: number, i: string) => n + outstanding(s, i), 0),
      Math.max(0, balance(s, q.customerId)),
    )
    if (amount <= 0 || amount < (q.minDebt || 1)) {
      q.status = "Đã bỏ - khoản nợ tất toán"
      changed = true
      continue
    }
    if (q.amount !== amount) {
      q.amount = amount
      q.content = renderMessage(s, q, q.customerId, amount, q.days)
      q.status = "Chờ duyệt"
      changed = true
    }
  }
  if (!changed) {
    for (const q of next.queue.filter((q: RecordData) => ids.includes(q.id))) {
      const unresolved = q.content.includes("Chưa cấu hình") || /\{[^}]+\}/.test(q.content)
      const fail = unresolved || (!!s.faults.sendPartial && failed === 0)
      q.status = fail ? "Gửi lỗi" : "Đã gửi"
      q.error = unresolved ? "Mẫu còn biến chưa giải được hoặc Link thanh toán chưa cấu hình, không thể gửi" : fail ? "Lỗi kết nối kênh gửi mô phỏng" : null
      next.history.push({
        ...clone(q),
        historyId: `${q.id}-${next.history.length}`,
        date: s.clock,
        actor: "Kế toán công nợ",
        simulated: true,
      })
      if (fail) failed++
      else sent++
    }
  }
  next.queue = next.queue.filter((q: RecordData) =>
    ["Chờ duyệt", "Gửi lỗi"].includes(q.status),
  )
  next.revision++
  return { state: next, changed, sent, failed }
}
