import { useState } from "react"
import { Check, FileText, LockKeyhole, ShieldCheck } from "lucide-react"
import {
  autoAllocation,
  available,
  balance,
  customer,
  date,
  debtRows,
  getState,
  money,
  outstanding,
  postReduction,
  replaceState,
  seed,
  type RecordData,
} from "./store"
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Modal,
  Select,
  Table,
  Tabs,
} from "./ui"

const emptyFilters = {
  type: "",
  client: "",
  docNo: "",
  from: "",
  to: "",
  reason: "",
}
const MODES = ["Tự động phân bổ", "Chỉ định hóa đơn", "Chỉ ghi giảm"]
const ACCOUNTS = ["111", "112", "511", "521", "138", "711", "811"]

const accountName = (code: string, kind: string) => {
  if (code === "521" && kind === "Giảm giá hàng bán")
    return "Giảm trừ doanh thu – giảm giá hàng bán"
  if (code === "521") return "Giảm trừ doanh thu – hàng bán bị trả lại"
  const names: Record<string, string> = {
    "111": "Tiền mặt",
    "112": "Tiền gửi ngân hàng",
    "511": "Doanh thu bán hàng và cung cấp dịch vụ",
    "3331": "Thuế GTGT phải nộp",
    "131": "Phải thu khách hàng",
    "138": "Phải thu khác",
    "711": "Thu nhập khác",
    "811": "Chi phí khác",
  }
  return names[code] || "Tài khoản khác"
}
const payStatus = (gross: number, due: number) => {
  if (due <= 0) return "Đã thanh toán"
  if (gross > due) return "Thanh toán một phần"
  return "Chưa thanh toán"
}
const statusTone = (status: string) =>
  status === "Đã thanh toán"
    ? "green"
    : status === "Thanh toán một phần"
      ? "amber"
      : "neutral"
const shown = (value: unknown) =>
  value == null || value === "" ? "" : String(value)

export default function Reduction({ s }: { s: RecordData; notify?: unknown }) {
  const [kind, setKind] = useState("Khoản thanh toán")
  const [tab, setTab] = useState("Chờ ghi giảm")
  const [draft, setDraft] = useState(emptyFilters)
  const [applied, setApplied] = useState(emptyFilters)
  const [filterError, setFilterError] = useState("")
  const [id, setId] = useState("")
  const [mode, setMode] = useState("Tự động phân bổ")
  const [manual, setManual] = useState<Record<string, number>>({})
  const [order, setOrder] = useState<string[]>([])
  const [note, setNote] = useState("")
  const [debit, setDebit] = useState("")
  const [reason, setReason] = useState("")
  const [postedDate, setPostedDate] = useState(s.clock)
  const [version, setVersion] = useState(s.revision)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [viewer, setViewer] = useState(false)
  const [docTab, setDocTab] = useState("")
  const [onlyEligible, setOnlyEligible] = useState(false)
  const [result, setResult] = useState<{ title: string; detail: string } | null>(
    null,
  )
  const payment = kind === "Khoản thanh toán"
  const allocationOnly = payment && tab === "Cần phân bổ"
  const inKind = (row: RecordData) =>
    payment
      ? ["Phiếu thu", "Giấy báo Có"].includes(row.type)
      : kind === "Trả lại hàng bán"
        ? row.type === "Phiếu trả hàng"
        : ["Biên bản giảm giá", "Biên bản điều chỉnh sai sót"].includes(row.type)
  const waitingAll = s.reductions.filter(
    (row: RecordData) => inKind(row) && !row.postedAt,
  )
  const allocateAll = s.reductions.filter(
    (row: RecordData) =>
      ["Phiếu thu", "Giấy báo Có"].includes(row.type) && available(s, row.id) > 0,
  )
  const sourceRows = allocationOnly ? allocateAll : waitingAll
  const customerLabel = (customerId?: string) => {
    if (!customerId) return ""
    const row = customer(s, customerId)
    return row?.name ? `${row.id} – ${row.name}` : customerId
  }
  const matchesReason = (row: RecordData) => {
    if (!applied.reason || payment) return true
    const text = `${row.reason || ""} ${row.transferContent || ""}`.toLocaleLowerCase(
      "vi",
    )
    if (text.includes(applied.reason.toLocaleLowerCase("vi"))) return true
    if (applied.reason === "Trả hàng theo chính sách")
      return row.type === "Phiếu trả hàng"
    if (applied.reason === "Sai số lượng")
      return row.type === "Biên bản điều chỉnh sai sót"
    if (applied.reason === "Giảm giá theo thỏa thuận")
      return row.type === "Biên bản giảm giá"
    if (applied.reason === "Sai số tiền / đơn giá")
      return row.type === "Biên bản điều chỉnh sai sót"
    return false
  }
  const rows = sourceRows.filter((row: RecordData) => {
    const docNo = applied.docNo.trim().toLocaleLowerCase("vi")
    return (
      (!docNo || row.id.toLocaleLowerCase("vi").includes(docNo)) &&
      (!applied.client || row.customerId === applied.client) &&
      (!applied.type || row.type === applied.type) &&
      (!applied.from || row.issuedAt >= applied.from) &&
      (!applied.to || row.issuedAt <= applied.to) &&
      matchesReason(row) &&
      (!allocationOnly ||
        !onlyEligible ||
        debtRows(s, row.customerId).length > 0)
    )
  })
  const r = s.reductions.find((row: RecordData) => row.id === id)
  const invoices = r
    ? debtRows(s, r.customerId).filter(
        (row: RecordData) => payment || row.id === r.invoiceId,
      )
    : []
  const amount = r ? (allocationOnly ? available(s, id) : r.amount) : 0
  let amounts: Record<string, number> = {}
  let autoError = ""
  if (r) {
    if (!payment) amounts = { [r.invoiceId]: r.amount }
    else if (allocationOnly) {
      let left = amount
      for (const invoiceId of order) {
        amounts[invoiceId] = Math.min(left, outstanding(s, invoiceId))
        left -= amounts[invoiceId]
      }
    } else if (mode === "Tự động phân bổ") {
      try {
        amounts = autoAllocation(s, r)
      } catch (e) {
        autoError = (e as Error).message
      }
    } else if (mode === "Chỉ định hóa đơn") amounts = manual
  }
  const total = Object.values(amounts).reduce((n, v) => n + (v || 0), 0)
  const invoiceDebt = invoices.reduce(
    (n: number, row: RecordData) => n + row.outstanding,
    0,
  )
  const caseLabel = !invoices.length
    ? "Trả trước, chưa có hóa đơn"
    : amount > invoiceDebt
      ? "Trả thừa"
      : "Đủ hóa đơn để trừ"
  const resetSelection = () => {
    setId("")
    setError("")
    setFieldErrors({})
    setManual({})
    setOrder([])
    setReason("")
    setNote("")
  }
  const choose = (row: RecordData) => {
    const open = debtRows(s, row.customerId)
    const isPayment = ["Phiếu thu", "Giấy báo Có"].includes(row.type)
    setId(row.id)
    setVersion(s.revision)
    setMode(
      isPayment && !open.length
        ? "Chỉ ghi giảm"
        : row.suggestedMode || "Tự động phân bổ",
    )
    setManual({})
    setOrder([])
    setDebit(row.defaultDebitAccount || "")
    setReason("")
    setNote("")
    setPostedDate(s.clock)
    setError("")
    setFieldErrors({})
    setResult(null)
  }
  const confirm = async () => {
    if (busy || !r) return
    const nextErrors: Record<string, string> = {}
    if (!postedDate) nextErrors.date = "Vui lòng chọn ngày"
    if (
      !allocationOnly &&
      debit !== r.defaultDebitAccount &&
      !reason.trim()
    )
      nextErrors.account = "Lý do sửa định khoản là bắt buộc"
    if (payment && !allocationOnly && mode === "Chỉ ghi giảm" && !note.trim())
      nextErrors.note = "Ghi chú là bắt buộc khi chọn Chỉ ghi giảm"
    if (note.length > 255) nextErrors.note = "Ghi chú tối đa 255 ký tự"
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setBusy(true)
    await new Promise((resolve) => setTimeout(resolve, 400))
    try {
      if (autoError) throw new Error(autoError)
      const next = postReduction(getState(), id, amounts, {
        date: postedDate,
        debit,
        accountReason: reason,
        note,
        allocationOnly,
        revision: version,
      })
      replaceState(next)
      const posted = next.reductions.find((row: RecordData) => row.id === id)
      const left = payment ? available(next, id) : 0
      const journal = allocationOnly ? "" : `BT-${id}`
      const title = allocationOnly
        ? "Đã phân bổ thành công. Không tạo bút toán mới và không giảm lại số dư khách hàng."
        : payment && left > 0
          ? `Ghi nhận giảm công nợ thành công. Còn ${money(left)} chưa phân bổ, chứng từ chuyển sang tab Cần phân bổ`
          : `Ghi nhận giảm công nợ thành công. Chứng từ ${id}, bút toán ${journal}`
      setResult({
        title,
        detail: [
          journal ? `Bút toán ${journal}` : "",
          posted?.postingStatus ? `Trạng thái ${posted.postingStatus}` : "",
          `Dư nợ sau ${money(balance(next, r.customerId))}`,
        ]
          .filter(Boolean)
          .join(" · "),
      })
      setVersion(next.revision)
      setError("")
      setFieldErrors({})
      if (!allocationOnly && payment && left > 0) {
        setTab("Cần phân bổ")
        setOrder([])
        setManual({})
        setNote("")
        setReason("")
      } else if (allocationOnly && left > 0) {
        setOrder([])
        setManual({})
        setNote("")
      } else resetSelection()
    } catch (e) {
      const message = (e as Error).message
      if (/ngày/i.test(message)) setFieldErrors({ date: message })
      else if (/tài khoản|định khoản|lý do sửa/i.test(message))
        setFieldErrors({ account: message })
      else if (/chưa phân bổ|ghi chú/i.test(message))
        setFieldErrors({ note: message })
      else setError(message)
    } finally {
      setBusy(false)
    }
  }
  const applyFilters = () => {
    if (draft.from && draft.to && draft.from > draft.to) {
      setFilterError("Từ ngày không được sau đến ngày")
      return
    }
    setFilterError("")
    setApplied(draft)
  }
  const clearFilters = () => {
    setDraft(emptyFilters)
    setApplied(emptyFilters)
    setFilterError("")
    setOnlyEligible(false)
  }
  const switchKind = (value: string) => {
    setKind(value)
    setTab("Chờ ghi giảm")
    clearFilters()
    setResult(null)
    resetSelection()
  }
  const typeOptions = payment
    ? [
        { value: "", label: "Tất cả" },
        { value: "Phiếu thu", label: "Phiếu thu" },
        { value: "Giấy báo Có", label: "Giấy báo Có" },
      ]
    : kind === "Trả lại hàng bán"
      ? [
          { value: "", label: "Tất cả" },
          { value: "Phiếu trả hàng", label: "Phiếu trả hàng" },
          {
            value: "Biên bản điều chỉnh sai sót",
            label: "Biên bản điều chỉnh sai sót (sai số lượng)",
          },
        ]
      : [
          { value: "", label: "Tất cả" },
          { value: "Biên bản giảm giá", label: "Biên bản giảm giá" },
          {
            value: "Biên bản điều chỉnh sai sót",
            label: "Biên bản điều chỉnh sai sót (sai số tiền, đơn giá)",
          },
        ]
  const reasonOptions =
    kind === "Trả lại hàng bán"
      ? [
          { value: "", label: "Tất cả" },
          { value: "Trả hàng theo chính sách", label: "Trả hàng theo chính sách" },
          { value: "Sai số lượng", label: "Sai số lượng" },
        ]
      : [
          { value: "", label: "Tất cả" },
          {
            value: "Giảm giá theo thỏa thuận",
            label: "Giảm giá theo thỏa thuận",
          },
          { value: "Sai số tiền / đơn giá", label: "Sai số tiền / đơn giá" },
        ]
  const docs = r
    ? [
        { ...r, group: "Căn cứ" },
        ...seed.sourceDocuments
          .filter(
            (row: RecordData) =>
              row.sourceId === r.id || row.id === r.adjustmentInvoiceId,
          )
          .map((row: RecordData) => ({ ...row, group: "Nguồn" })),
        ...s.invoices
          .filter((row: RecordData) => row.id === r.invoiceId)
          .map((row: RecordData) => ({
            ...row,
            group: "Tham chiếu",
            type: "Hóa đơn gốc",
          })),
      ].filter(
        (row: RecordData, index: number, list: RecordData[]) =>
          list.findIndex((item) => item.id === row.id) === index,
      )
    : []
  const viewed = docs.find((row: RecordData) => row.id === docTab) || r
  const noteRequired = payment && !allocationOnly && mode === "Chỉ ghi giảm"
  const previous = r
    ? s.allocations.filter((row: RecordData) => row.sourceId === r.id)
    : []
  const accounts = r
    ? [...new Set([...ACCOUNTS, r.defaultDebitAccount, debit].filter(Boolean))]
    : ACCOUNTS
  const invoiceText = (invoiceId?: string) => {
    const row = s.invoices.find((item: RecordData) => item.id === invoiceId)
    if (!row) return invoiceId || ""
    const symbol = [row.series, row.number].filter(Boolean).join(" ")
    const head = symbol ? `${symbol} – ${row.id}` : row.id
    return row.issuedAt ? `${head} · ${date(row.issuedAt)}` : head
  }
  const taxBlocks = (row: RecordData) => (
    <div key="tax-split" className="uc02-tax-split">
      {(
        [
          ["Tiền hàng", row.net ? money(row.net) : ""],
          [
            "Thuế suất",
            row.taxRate != null
              ? `${Math.round(Number(row.taxRate) * 100)}%`
              : "",
          ],
          ["Tiền thuế GTGT", row.tax ? money(row.tax) : ""],
        ] as [string, string][]
      ).map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            <div className="uc02-readonly">{shown(value) || "\u00a0"}</div>
          </dd>
        </div>
      ))}
    </div>
  )
  const read = (
    label: string,
    value: unknown,
    options: { lock?: boolean; strong?: boolean } = {},
  ) => (
    <div key={label}>
      <dt>
        {options.lock ? (
          <span className="uc02-lock">
            <LockKeyhole size={12} />
            {label}
          </span>
        ) : (
          label
        )}
      </dt>
      <dd>
        <div className={`uc02-readonly ${options.strong ? "uc02-money" : ""}`}>
          {shown(value) || "\u00a0"}
        </div>
      </dd>
    </div>
  )
  const basis = r
    ? [
        read("Số chứng từ", r.id),
        read("Ngày chứng từ", date(r.issuedAt)),
        read("Khách hàng", customerLabel(r.customerId)),
        payment
          ? read("Số tiền", money(r.amount), { strong: true })
          : read("Hóa đơn gốc", invoiceText(r.invoiceId)),
        ...(!payment ? [taxBlocks(r)] : []),
        ...(!payment ? [read("Tổng tiền giảm", money(r.amount), { strong: true })] : []),
        ...(r.bank
          ? [
              read("Ngân hàng · TK nhận", `${r.bank} · ${r.bankAccount || ""}`),
              read("Mã tham chiếu ngân hàng", r.bankReference),
              read("Nội dung chuyển khoản", r.transferContent),
            ]
          : []),
        ...(r.payer
          ? [
              read("Người nộp tiền", r.payer),
              read("Thủ quỹ", r.cashier),
              read("Lý do nộp (ghi trên phiếu)", r.reason),
            ]
          : []),
        ...(!payment
          ? [
              ...(r.type === "Phiếu trả hàng"
                ? [
                    read(
                      "Chính sách hoàn trả · tỷ lệ hoàn",
                      [r.returnPolicy, r.refundRate].filter(Boolean).join(" · "),
                    ),
                  ]
                : []),
              ...(r.type === "Biên bản điều chỉnh sai sót" &&
              kind === "Trả lại hàng bán"
                ? [
                    read(
                      "Số lượng ghi trên hóa đơn · số lượng đúng",
                      [r.invoiceQuantity, r.correctQuantity]
                        .filter((value) => value != null && value !== "")
                        .join(" · "),
                    ),
                  ]
                : []),
              ...(r.type === "Biên bản điều chỉnh sai sót" &&
              kind === "Giảm giá hàng bán"
                ? [
                    read(
                      "Đơn giá ghi trên hóa đơn · đơn giá đúng",
                      [r.invoicePrice, r.correctPrice]
                        .filter((value) => value != null && value !== "")
                        .map((value) =>
                          typeof value === "number" ? money(value) : String(value),
                        )
                        .join(" · "),
                    ),
                  ]
                : []),
            ]
          : []),
        ...(allocationOnly
          ? [
              read("Trạng thái chứng từ", r.postingStatus, { lock: true }),
              read("Ngày ghi sổ (lượt 1)", date(r.postedAt), { lock: true }),
              read(
                "Đã phân bổ các lượt trước",
                money(r.amount - amount),
                { lock: true },
              ),
              read("Còn được phân bổ", money(amount), { lock: true }),
            ]
          : []),
      ]
    : []
  const creditRows = [
    ...Object.entries(amounts)
      .filter(([, value]) => value > 0)
      .map(([invoiceId, value]) => ({
        id: invoiceId,
        type: "Trừ nợ",
        link: invoiceId,
        value,
      })),
    ...(amount - total > 0
      ? [
          {
            id: "unallocated",
            type: "Chưa phân bổ",
            link: "",
            value: amount - total,
          },
        ]
      : []),
  ]
  const itemName = (itemId?: string) =>
    seed.items?.find((item: RecordData) => item.id === itemId)?.name ||
    itemId ||
    ""
  const viewLines = viewed
    ? [
        ...(viewed.lines || []).map((line: RecordData, index: number) => ({
          ...line,
          id: line.itemId || index,
        })),
        ...(viewed.net
          ? [{ id: "net", item: "Tiền hàng", amount: viewed.net, summary: true }]
          : []),
        ...(viewed.tax
          ? [{ id: "tax", item: "Thuế GTGT", amount: viewed.tax, summary: true }]
          : []),
        ...(viewed.gross || viewed.amount
          ? [
              {
                id: "sum",
                item: "Tổng",
                amount: viewed.gross || viewed.amount,
                summary: true,
              },
            ]
          : []),
      ]
    : []
  const fileName = viewed?.file || viewed?.fileName || viewed?.attachment
  return (
    <div className="uc02">
      <div className="page-heading">
        <div>
          <h1>Ghi nhận giảm công nợ</h1>
          <p>
            Tiếp nhận chứng từ đã duyệt tại nguồn, ghi giảm và phân bổ vào hóa
            đơn
          </p>
        </div>
      </div>
      <Tabs
        value={kind}
        items={["Khoản thanh toán", "Trả lại hàng bán", "Giảm giá hàng bán"]}
        onChange={switchKind}
      />
      <div className="uc02-layout">
        <Card className="list-card uc02-side" title="">
          <div className="list-title">
            <h2>Chọn chứng từ căn cứ</h2>
          </div>
          {payment && (
            <Tabs
              value={tab}
              items={[
                {
                  value: "Chờ ghi giảm",
                  label: "Chờ ghi giảm",
                  count: waitingAll.length,
                },
                {
                  value: "Cần phân bổ",
                  label: "Cần phân bổ",
                  count: allocateAll.length,
                },
              ]}
              onChange={(value: string) => {
                setTab(value)
                resetSelection()
                setResult(null)
              }}
            />
          )}
          <div className="filter-row wrap">
            <Field label="Loại chứng từ">
              <Select
                value={draft.type}
                onChange={(e: { target: { value: string } }) =>
                  setDraft({ ...draft, type: e.target.value })
                }
                options={typeOptions}
              />
            </Field>
            {!payment && (
              <Field label="Lý do">
                <Select
                  value={draft.reason}
                  onChange={(e: { target: { value: string } }) =>
                    setDraft({ ...draft, reason: e.target.value })
                  }
                  options={reasonOptions}
                />
              </Field>
            )}
            <Field label="Khách hàng">
              <Select
                value={draft.client}
                onChange={(e: { target: { value: string } }) =>
                  setDraft({ ...draft, client: e.target.value })
                }
                options={[
                  { value: "", label: "Tất cả khách hàng" },
                  ...s.customers.map((row: RecordData) => ({
                    value: row.id,
                    label: `${row.id} – ${row.name}`,
                  })),
                ]}
              />
            </Field>
            <Field label="Số chứng từ">
              <input
                value={draft.docNo}
                placeholder={
                  payment
                    ? "VD: DEMO-GBC-A2"
                    : kind === "Trả lại hàng bán"
                      ? "VD: DEMO-PTH-B1"
                      : "VD: DEMO-BBGG-B1"
                }
                onChange={(e) => setDraft({ ...draft, docNo: e.target.value })}
              />
            </Field>
            <Field label="Từ ngày" error={filterError}>
              <input
                type="date"
                value={draft.from}
                onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              />
            </Field>
            <Field label="Đến ngày">
              <input
                type="date"
                value={draft.to}
                onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              />
            </Field>
            <Button onClick={clearFilters}>Xóa lọc</Button>
            <Button primary onClick={applyFilters}>
              Lọc
            </Button>
          </div>
          {allocationOnly && (
            <label className="check-label uc02-check">
              <input
                type="checkbox"
                checked={onlyEligible}
                onChange={(e) => setOnlyEligible(e.target.checked)}
              />
              Chỉ hiện chứng từ khách đã có hóa đơn để trừ
            </label>
          )}
          <p className="uc02-found">Tìm thấy {rows.length} chứng từ</p>
          <Table
            rows={rows}
            selected={id}
            onRow={choose}
            columns={[
              { label: "Loại chứng từ", key: "type" },
              {
                label: "Số chứng từ",
                render: (row: RecordData) => (
                  <strong className="link-text">{row.id}</strong>
                ),
              },
              {
                label: allocationOnly ? "Ngày ghi giảm" : "Ngày chứng từ",
                render: (row: RecordData) =>
                  date(allocationOnly ? row.postedAt : row.issuedAt),
              },
              {
                label: "Khách hàng",
                render: (row: RecordData) => customerLabel(row.customerId),
              },
              ...(!payment
                ? [{ label: "Hóa đơn gốc", key: "invoiceId" }]
                : []),
              ...(allocationOnly
                ? []
                : [
                    {
                      label: "Lý do",
                      render: (row: RecordData) =>
                        row.reason || row.transferContent || "",
                    },
                  ]),
              {
                label: "Số tiền",
                align: "right",
                render: (row: RecordData) => money(row.amount),
              },
              ...(allocationOnly
                ? [
                    {
                      label: "Đã phân bổ",
                      align: "right",
                      render: (row: RecordData) =>
                        money(row.amount - available(s, row.id)),
                    },
                    {
                      label: "Còn chưa phân bổ",
                      align: "right",
                      render: (row: RecordData) => money(available(s, row.id)),
                    },
                    {
                      label: "Hóa đơn có thể trừ",
                      render: (row: RecordData) => {
                        const count = debtRows(s, row.customerId).length
                        return count ? `${count} hóa đơn` : "Chưa có hóa đơn"
                      },
                    },
                  ]
                : []),
            ]}
          />
        </Card>
        <div className="stack uc02-main">
          {result && (
            <Alert tone="green">
              <strong>{result.title}</strong>
              <p>{result.detail}</p>
              <Button onClick={() => setResult(null)}>Đóng</Button>
            </Alert>
          )}
          {r ? (
            <>
              <Card
                title="Chứng từ căn cứ"
                aside={
                  <Button
                    icon={FileText}
                    onClick={() => {
                      setDocTab(r.id)
                      setViewer(true)
                    }}
                  >
                    Xem chứng từ
                  </Button>
                }
              >
                {payment && !allocationOnly && (
                  <div className="uc02-case">
                    <Badge
                      tone={caseLabel === "Đủ hóa đơn để trừ" ? "green" : "amber"}
                    >
                      {caseLabel}
                    </Badge>
                  </div>
                )}
                <dl className="values">{basis}</dl>
                <div className="mt">
                  <span className="muted small">Lý do ghi giảm</span>
                  <div className="uc02-readonly">{r.reason || "\u00a0"}</div>
                </div>
                <div className="mt">
                  <span className="muted small">Chứng từ nguồn / đính kèm</span>
                  {docs.filter(
                    (row: RecordData) => row.id !== r.id && row.group === "Nguồn",
                  ).length ? (
                    <div className="attachment-chips">
                      {docs
                        .filter(
                          (row: RecordData) =>
                            row.id !== r.id && row.group === "Nguồn",
                        )
                        .map((row: RecordData) => (
                          <span key={row.id} className="uc02-readonly">
                            {[
                              row.type,
                              row.type === "Sao kê ngân hàng"
                                ? r.bankReference || row.id
                                : row.id,
                              row.gross || row.amount
                                ? money(row.gross || row.amount)
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ))}
                    </div>
                  ) : (
                    <div className="uc02-readonly">Không có chứng từ đính kèm</div>
                  )}
                </div>
              </Card>
              <Card title="Phân bổ hóa đơn">
                {payment && !allocationOnly && (
                  <div className="field">
                    <span>Phương thức phân bổ</span>
                    <div className="uc02-choice" role="radiogroup">
                      {MODES.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={mode === item ? "active" : ""}
                          disabled={!invoices.length && item !== "Chỉ ghi giảm"}
                          onClick={() => {
                            setMode(item)
                            setManual({})
                            setOrder([])
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {allocationOnly && (
                  <div className="inset">
                    <span className="uc02-lock">
                      <LockKeyhole size={14} /> Đã phân bổ ở lượt trước
                    </span>
                    {previous.length ? (
                      previous.map((row: RecordData) => (
                        <div key={row.id} className="uc02-readonly mt">
                          {date(row.date)} · {row.invoiceId} · {money(row.amount)}
                        </div>
                      ))
                    ) : (
                      <div className="uc02-readonly mt">&nbsp;</div>
                    )}
                  </div>
                )}
                {autoError && <Alert tone="amber">{autoError}</Alert>}
                {!invoices.length ? (
                  <p>
                    Khách hàng chưa có hóa đơn đã ghi nhận công nợ còn nợ
                  </p>
                ) : (
                  <>
                    <Table
                      rows={invoices}
                      columns={[
                        {
                          label: "Chọn",
                          render: (row: RecordData) => (
                            <input
                              aria-label={`Phân bổ ${row.id}`}
                              type="checkbox"
                              disabled={
                                !payment ||
                                (!allocationOnly && mode !== "Chỉ định hóa đơn") ||
                                (allocationOnly &&
                                  !order.includes(row.id) &&
                                  total >= amount)
                              }
                              checked={
                                !payment ||
                                (allocationOnly
                                  ? order.includes(row.id)
                                  : !!amounts[row.id])
                              }
                              onChange={(e) => {
                                if (allocationOnly)
                                  setOrder(
                                    e.target.checked
                                      ? [...order, row.id]
                                      : order.filter((key) => key !== row.id),
                                  )
                                else
                                  setManual({
                                    ...manual,
                                    [row.id]: e.target.checked
                                      ? Math.min(
                                          row.outstanding,
                                          Math.max(0, amount - total),
                                        )
                                      : 0,
                                  })
                              }}
                            />
                          ),
                        },
                        {
                          label: "Hóa đơn",
                          render: (row: RecordData) => <strong>{row.id}</strong>,
                        },
                        {
                          label: "Ngày HĐ",
                          render: (row: RecordData) => date(row.issuedAt),
                        },
                        {
                          label: "Hạn TT",
                          render: (row: RecordData) => date(row.dueAt),
                        },
                        {
                          label: "Tổng thanh toán",
                          align: "right",
                          render: (row: RecordData) => money(row.gross || 0),
                        },
                        {
                          label: "Số còn nợ",
                          align: "right",
                          render: (row: RecordData) => money(row.outstanding),
                        },
                        {
                          label: "Số phân bổ",
                          align: "right",
                          render: (row: RecordData) =>
                            payment &&
                            !allocationOnly &&
                            mode === "Chỉ định hóa đơn" ? (
                              <input
                                aria-label={`Số tiền ${row.id}`}
                                className="amount-input"
                                type="number"
                                min="0"
                                max={row.outstanding}
                                value={manual[row.id] || ""}
                                onChange={(e) =>
                                  setManual({
                                    ...manual,
                                    [row.id]: Number(e.target.value),
                                  })
                                }
                              />
                            ) : (
                              <span className="uc02-lock">
                                <LockKeyhole size={12} />
                                {money(amounts[row.id] || 0)}
                              </span>
                            ),
                        },
                        {
                          label: "Trạng thái hiện tại",
                          render: (row: RecordData) => {
                            const status = payStatus(
                              row.gross || row.outstanding,
                              row.outstanding,
                            )
                            return <Badge tone={statusTone(status)}>{status}</Badge>
                          },
                        },
                        {
                          label: "Sau ghi sổ",
                          render: (row: RecordData) => {
                            const status = payStatus(
                              row.gross || row.outstanding,
                              row.outstanding - (amounts[row.id] || 0),
                            )
                            return <Badge tone={statusTone(status)}>{status}</Badge>
                          },
                        },
                      ]}
                    />
                    <div className="total-line">
                      <span>Tổng số còn nợ · Tổng phân bổ</span>
                      <strong>
                        {money(invoiceDebt)} · {money(total)}
                      </strong>
                    </div>
                  </>
                )}
                <div className="allocation-totals">
                  <div>
                    <small>
                      {allocationOnly ? "Còn được phân bổ" : "Số tiền chứng từ"}
                    </small>
                    <strong>{money(amount)}</strong>
                  </div>
                  <div>
                    <small>Phân bổ</small>
                    <strong>{money(total)}</strong>
                  </div>
                  <div>
                    <small>Chưa phân bổ</small>
                    <strong>{money(Math.max(0, amount - total))}</strong>
                  </div>
                </div>
                {payment && !allocationOnly && amount - total > 0 && (
                  <Alert tone="amber">
                    Còn {money(amount - total)} chưa phân bổ, sẽ ghi thành số dư
                    Có của khách và chuyển sang tab Cần phân bổ
                  </Alert>
                )}
              </Card>
              <Card
                title={allocationOnly ? "Thông tin phân bổ" : "Thông tin ghi giảm"}
              >
                <div className="form-grid">
                  <Field
                    label={
                      <>
                        {allocationOnly ? "Ngày phân bổ" : "Ngày ghi giảm"}{" "}
                        <span className="uc02-req">*</span>
                      </>
                    }
                    error={fieldErrors.date}
                  >
                    <input
                      type="date"
                      value={postedDate}
                      onChange={(e) => setPostedDate(e.target.value)}
                    />
                  </Field>
                  <Field
                    label={
                      <>
                        Ghi chú{" "}
                        {noteRequired && <span className="uc02-req">*</span>}
                      </>
                    }
                    error={fieldErrors.note}
                  >
                    <textarea
                      maxLength={255}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </Field>
                </div>
                <h3 className="uc02-lock">
                  Định khoản
                  {allocationOnly && (
                    <>
                      <LockKeyhole size={14} /> Chỉ xem
                    </>
                  )}
                </h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Nợ/Có</th>
                        <th>TK</th>
                        <th>Nội dung</th>
                        <th className="num">Số tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Nợ</td>
                        <td>
                          {allocationOnly ? (
                            <span className="uc02-lock">
                              <LockKeyhole size={12} />
                              {r.debit || r.defaultDebitAccount}
                            </span>
                          ) : (
                            <Select
                              aria-label="Tài khoản Nợ"
                              className="uc02-account"
                              value={debit}
                              onChange={(e: { target: { value: string } }) =>
                                setDebit(e.target.value)
                              }
                              options={accounts}
                            />
                          )}
                        </td>
                        <td>
                          {accountName(
                            allocationOnly
                              ? r.debit || r.defaultDebitAccount
                              : debit,
                            kind,
                          )}
                        </td>
                        <td className="num">
                          <span className="uc02-lock">
                            <LockKeyhole size={12} />
                            {money(r.net ?? r.amount)}
                          </span>
                        </td>
                      </tr>
                      {!!r.tax && (
                        <tr>
                          <td>Nợ</td>
                          <td>
                            <span className="uc02-lock">
                              <LockKeyhole size={12} /> 3331
                            </span>
                          </td>
                          <td>{accountName("3331", kind)}</td>
                          <td className="num">
                            <span className="uc02-lock">
                              <LockKeyhole size={12} />
                              {money(r.tax)}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td>Có</td>
                        <td>
                          <span className="uc02-lock">
                            <LockKeyhole size={12} /> 131
                          </span>
                        </td>
                        <td>{accountName("131", kind)}</td>
                        <td className="num">
                          <span className="uc02-lock">
                            <LockKeyhole size={12} />
                            {money(r.amount)}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {debit !== r.defaultDebitAccount && !allocationOnly && (
                  <div className="mt">
                    <Field
                      label={
                        <>
                          Lý do sửa định khoản <span className="uc02-req">*</span>
                        </>
                      }
                      error={fieldErrors.account}
                    >
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </Field>
                    <Button
                      onClick={() => {
                        setDebit(r.defaultDebitAccount)
                        setReason("")
                      }}
                    >
                      Khôi phục đề xuất
                    </Button>
                  </div>
                )}
                <h3 className="mt">Chi tiết Có TK 131</h3>
                <Table
                  rows={creditRows}
                  columns={[
                    { label: "Có 131", key: "type" },
                    { label: "Gắn với", key: "link" },
                    {
                      label: "Số tiền",
                      align: "right",
                      render: (row: RecordData) => money(row.value),
                    },
                  ]}
                />
                <div className="total-line">
                  <strong>Tổng</strong>
                  <strong>{money(amount)}</strong>
                </div>
                <h3 className="mt">Dư nợ khách hàng</h3>
                <div className="uc02-balance">
                  <div>
                    <span>
                      {allocationOnly ? "Trước phân bổ" : "Trước ghi giảm"}
                    </span>
                    <strong>{money(balance(s, r.customerId))}</strong>
                  </div>
                  <div>
                    <span>{allocationOnly ? "Sau phân bổ" : "Sau ghi giảm"}</span>
                    <strong className="red-text">
                      {money(
                        balance(s, r.customerId) -
                          (allocationOnly ? 0 : r.amount),
                      )}
                    </strong>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <div className="selection-hint">
              <FileText size={28} />
              <h3>Chọn chứng từ để bắt đầu</h3>
              <p>
                Thông tin căn cứ, phân bổ hóa đơn và định khoản sẽ hiển thị tại
                đây
              </p>
            </div>
          )}
        </div>
      </div>
      {error && (
        <Alert tone="red">
          {error}
          {/tải lại/i.test(error) && (
            <div className="mt">
              <Button
                onClick={() => {
                  setVersion(s.revision)
                  setError("")
                }}
              >
                Tải lại để kiểm tra
              </Button>
            </div>
          )}
        </Alert>
      )}
      {r && (
        <div className="action-bar">
          <span>
            <ShieldCheck size={17} />
            {allocationOnly
              ? "Chỉ phân bổ, không tạo bút toán mới"
              : "Ghi sổ trọn gói, không lưu nháp, không phê duyệt"}
          </span>
          <div className="button-group">
            <Button onClick={resetSelection} disabled={busy}>
              Hủy
            </Button>
            <Button
              primary
              icon={Check}
              disabled={busy || (allocationOnly && !invoices.length)}
              onClick={confirm}
            >
              {busy
                ? "Đang xử lý..."
                : allocationOnly
                  ? "Xác nhận phân bổ"
                  : "Xác nhận ghi giảm nợ"}
            </Button>
          </div>
        </div>
      )}
      {viewer && r && viewed && (
        <Modal
          wide
          title={
            <span className="uc02-viewer-title">
              <small>Xem chứng từ · chỉ đọc</small>
              <span>
                {r.type} {r.id} và chứng từ liên quan
              </span>
            </span>
          }
          onClose={() => setViewer(false)}
        >
          <div className="uc02-doc-strip">
            {docs.map((row: RecordData) => (
              <button
                key={row.id}
                type="button"
                className={viewed.id === row.id ? "active" : ""}
                onClick={() => setDocTab(row.id)}
              >
                <small>{row.group}</small>
                <span>
                  {row.group} · {row.type || "Chứng từ"} {row.id}
                </span>
              </button>
            ))}
          </div>
          <h3>Thông tin chung</h3>
          <dl className="uc02-view">
            {[
              ["Số chứng từ", viewed.id],
              ["Loại chứng từ", viewed.type],
              ["Ngày chứng từ", viewed.issuedAt ? date(viewed.issuedAt) : ""],
              ["Khách hàng", customerLabel(viewed.customerId)],
              [
                "Số tiền",
                viewed.amount || viewed.gross
                  ? money(viewed.amount || viewed.gross)
                  : "",
              ],
              ["Nội dung", viewed.content || viewed.transferContent],
              ["Ngân hàng", viewed.bank],
              ["Tài khoản", viewed.bankAccount],
              ["Mã tham chiếu", viewed.bankReference],
              ["Người nộp tiền", viewed.payer],
              ["Thủ quỹ", viewed.cashier],
              ["Hóa đơn gốc", viewed.invoiceId || viewed.originalInvoiceId],
            ]
              .filter(([, value]) => value != null)
              .map(([label, value]) => (
                <div key={String(label)}>
                  <dt>{label}</dt>
                  <dd>
                    <div className="uc02-readonly">{shown(value) || "\u00a0"}</div>
                  </dd>
                </div>
              ))}
            {viewed.group === "Tham chiếu" && (
              <div>
                <dt>Số còn nợ · trạng thái thanh toán</dt>
                <dd>
                  <div className="uc02-readonly">
                    {money(outstanding(s, viewed.id))} ·{" "}
                    {payStatus(
                      viewed.gross || outstanding(s, viewed.id),
                      outstanding(s, viewed.id),
                    )}
                  </div>
                </dd>
              </div>
            )}
          </dl>
          {!!viewLines.length && (
            <div className="mt">
              <h3>Hàng hóa</h3>
              <Table
                rows={viewLines}
                columns={[
                  {
                    label: "Mặt hàng",
                    render: (line: RecordData) =>
                      line.item || itemName(line.itemId),
                  },
                  {
                    label: "Số lượng",
                    render: (line: RecordData) =>
                      line.summary || line.quantity == null ? "" : line.quantity,
                  },
                  {
                    label: "Đơn giá",
                    align: "right",
                    render: (line: RecordData) =>
                      line.summary || !line.unitPrice ? "" : money(line.unitPrice),
                  },
                  {
                    label: "Thành tiền",
                    align: "right",
                    render: (line: RecordData) =>
                      line.amount || line.gross
                        ? money(line.amount || line.gross)
                        : "",
                  },
                ]}
              />
            </div>
          )}
          <h3 className="mt">Người lập · người duyệt</h3>
          <dl className="uc02-view">
            {[
              ["Người lập", viewed.creator],
              ["Người duyệt", viewed.approvalBy],
              ["Ngày duyệt", viewed.approvedAt ? date(viewed.approvedAt) : ""],
              [
                "Trạng thái",
                viewed.sourceApproval ||
                  viewed.postingStatus ||
                  ({
                    recognized: "Đã ghi nhận",
                    pending: "Chưa ghi nhận",
                    pending_adjustment: "Điều chỉnh chưa ghi nhận",
                  } as Record<string, string>)[viewed.arStatus] ||
                  viewed.arStatus,
              ],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt>{label}</dt>
                <dd>
                  <div className="uc02-readonly">{shown(value) || "\u00a0"}</div>
                </dd>
              </div>
            ))}
          </dl>
          {fileName && (
            <div className="mt">
              <h3>Tệp đính kèm</h3>
              <div className="uc02-readonly">{fileName}</div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
