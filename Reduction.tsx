import { useState } from "react"
import {
  Check,
  FileText,
  LockKeyhole,
  ArrowRight,
  Search,
  ShieldCheck,
} from "lucide-react"
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
  SearchBox,
  Select,
  Table,
  Tabs,
  Values,
} from "./ui"

export default function Reduction({ s, notify }: any) {
  const [kind, setKind] = useState("Khoản thanh toán")
  const [tab, setTab] = useState("Ghi giảm")
  const [search, setSearch] = useState("")
  const [client, setClient] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [type, setType] = useState("")
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
  const [viewer, setViewer] = useState(false)
  const [docTab, setDocTab] = useState("")
  const [onlyEligible, setOnlyEligible] = useState(false)
  const payment = kind === "Khoản thanh toán"
  const allocationOnly = payment && tab === "Cần phân bổ"
  const inKind = (r: RecordData) =>
    payment
      ? ["Phiếu thu", "Giấy báo Có"].includes(r.type)
      : kind === "Trả lại hàng bán"
        ? r.type === "Phiếu trả hàng"
        : ["Biên bản giảm giá", "Biên bản điều chỉnh sai sót"].includes(r.type)
  const sourceRows = s.reductions
    .filter(inKind)
    .filter((r: RecordData) =>
      allocationOnly ? available(s, r.id) > 0 : !r.postedAt,
    )
  const rows = sourceRows.filter(
    (r: RecordData) =>
      `${r.id} ${r.reason || ""} ${customer(s, r.customerId).name}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()) &&
      (!client || r.customerId === client) &&
      (!type || r.type === type) &&
      (!from || r.issuedAt >= from) &&
      (!to || r.issuedAt <= to) &&
      (!onlyEligible || !allocationOnly || debtRows(s, r.customerId).length),
  )
  const r = s.reductions.find((x: RecordData) => x.id === id)
  const invoices = r
    ? debtRows(s, r.customerId).filter(
        (i: RecordData) => payment || i.id === r.invoiceId,
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
  const choose = (x: RecordData) => {
    setId(x.id)
    setVersion(s.revision)
    setMode(x.suggestedMode || "Tự động phân bổ")
    setManual({})
    setOrder([])
    setDebit(x.defaultDebitAccount)
    setReason("")
    setNote(x.reason || "")
    setPostedDate(s.clock)
    setError("")
  }
  const resetSelection = () => {
    setId("")
    setError("")
  }
  const confirm = async () => {
    if (busy || !r) return
    setBusy(true)
    await new Promise((resolve) => setTimeout(resolve, 400))
    try {
      if (autoError) throw new Error(autoError)
      if (from && to && from > to)
        throw new Error("Từ ngày không được sau đến ngày")
      const next = postReduction(getState(), id, amounts, {
        date: postedDate,
        debit,
        accountReason: reason,
        note,
        allocationOnly,
        revision: version,
      })
      replaceState(next)
      resetSelection()
      notify(
        allocationOnly
          ? "Đã lưu phân bổ, không tạo bút toán mới và không giảm lại số dư khách hàng"
          : `Đã ghi giảm ${money(r.amount)} - Dư nợ khách hàng: ${money(balance(next, r.customerId))}`,
        "green",
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const docs = r
    ? [
        r,
        ...seed.sourceDocuments.filter(
          (d: RecordData) =>
            d.sourceId === r.id || d.id === r.adjustmentInvoiceId,
        ),
        ...s.invoices.filter(
          (i: RecordData) => i.id === r.invoiceId || amounts[i.id] > 0,
        ),
      ]
    : []
  const viewed = docs.find((d: RecordData) => d.id === docTab) || r
  return (
    <>
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
        onChange={(v: string) => {
          setKind(v)
          setTab("Ghi giảm")
          setType("")
          resetSelection()
        }}
      />
      <Card className="list-card">
        <div className="list-title">
          <h2>
            Chọn chứng từ căn cứ{" "}
            <span className="count-pill">{rows.length}</span>
          </h2>
          <Badge tone="blue">Xác nhận là ghi sổ</Badge>
        </div>
        {payment && (
          <Tabs
            value={tab}
            items={[
              {
                value: "Ghi giảm",
                label: "Ghi giảm",
                count: s.reductions
                  .filter(inKind)
                  .filter((r: RecordData) => !r.postedAt).length,
              },
              {
                value: "Cần phân bổ",
                label: "Cần phân bổ",
                count: s.reductions.filter(
                  (r: RecordData) => available(s, r.id) > 0,
                ).length,
              },
            ]}
            onChange={(v: string) => {
              setTab(v)
              resetSelection()
            }}
          />
        )}
        <div className="filter-row wrap">
          <Field label="Loại chứng từ">
            <Select
              value={type}
              onChange={(e: any) => setType(e.target.value)}
              options={[
                { value: "", label: "Tất cả loại" },
                ...[...new Set(sourceRows.map((r: RecordData) => r.type))].map(
                  (x) => ({ value: x, label: x }),
                ),
              ]}
            />
          </Field>
          <Field label="Khách hàng">
            <Select
              value={client}
              onChange={(e: any) => setClient(e.target.value)}
              options={[
                { value: "", label: "Tất cả khách hàng" },
                ...s.customers.map((c: RecordData) => ({
                  value: c.id,
                  label: c.name,
                })),
              ]}
            />
          </Field>
          <Field label={payment ? "Số chứng từ" : "Số chứng từ / Lý do"}>
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Tìm chứng từ..."
            />
          </Field>
          <Field label="Từ ngày">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="Đến ngày">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Button
            onClick={() => {
              setType("")
              setClient("")
              setSearch("")
              setFrom("")
              setTo("")
            }}
          >
            Xóa lọc
          </Button>
        </div>
        {allocationOnly && (
          <label className="check-label inset">
            <input
              type="checkbox"
              checked={onlyEligible}
              onChange={(e) => setOnlyEligible(e.target.checked)}
            />
            Chỉ hiện chứng từ khách đã có hóa đơn để trừ
          </label>
        )}
        <Table
          rows={rows}
          selected={id}
          onRow={choose}
          columns={[
            {
              label: "Số chứng từ",
              render: (x: RecordData) => (
                <strong className="link-text">{x.id}</strong>
              ),
            },
            { label: "Loại chứng từ", key: "type" },
            {
              label: "Ngày",
              render: (x: RecordData) => date(x.postedAt || x.issuedAt),
            },
            {
              label: "Khách hàng",
              render: (x: RecordData) => customer(s, x.customerId).name,
            },
            ...(!payment ? [{ label: "Hóa đơn gốc", key: "invoiceId" }] : []),
            {
              label: "Số tiền",
              align: "right",
              render: (x: RecordData) => money(x.amount),
            },
            ...(allocationOnly
              ? [
                  {
                    label: "Còn chưa phân bổ",
                    align: "right",
                    render: (x: RecordData) => money(available(s, x.id)),
                  },
                  {
                    label: "Hóa đơn có thể trừ",
                    render: (x: RecordData) =>
                      `${debtRows(s, x.customerId).length} hóa đơn`,
                  },
                ]
              : [
                  {
                    label: "Trạng thái nguồn",
                    render: () => (
                      <Badge tone="green">Đã duyệt tại nguồn</Badge>
                    ),
                  },
                ]),
          ]}
        />
      </Card>
      {r ? (
        <>
          <div className="detail-grid">
            <div className="stack">
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
                <Values
                  values={
                    [
                      ["Số chứng từ", r.id],
                      ["Loại chứng từ", r.type],
                      ["Ngày lập", date(r.issuedAt)],
                      ["Khách hàng", customer(s, r.customerId).name],
                      ["Số tiền", money(r.amount)],
                      ...(r.bank
                        ? [
                            [
                              "Ngân hàng - TK nhận",
                              `${r.bank} - ${r.bankAccount}`,
                            ],
                            ["Tham chiếu ngân hàng", r.bankReference],
                            ["Nội dung chuyển khoản", r.transferContent],
                          ]
                        : []),
                      ...(r.payer
                        ? [
                            ["Người nộp tiền", r.payer],
                            ["Thủ quỹ", r.cashier],
                          ]
                        : []),
                      ...(!payment
                        ? [
                            ["Hóa đơn gốc", r.invoiceId],
                            ["Tiền trước thuế", money(r.net)],
                            ["Thuế GTGT theo nguồn mock", money(r.tax)],
                          ]
                        : []),
                      ...(allocationOnly
                        ? [
                            ["Ngày ghi sổ", date(r.postedAt)],
                            ["Đã phân bổ", money(r.amount - amount)],
                          ]
                        : []),
                    ] as any
                  }
                />
                <div className="inset">
                  <span className="muted small">Lý do ghi giảm</span>
                  <p>
                    {r.reason ||
                      r.transferContent ||
                      "Thanh toán công nợ theo chứng từ nguồn"}
                  </p>
                </div>
                <div className="attachment-chips">
                  {docs
                    .filter((d: RecordData) => d.id !== r.id)
                    .map((d: RecordData) => (
                      <Button
                        key={d.id}
                        icon={FileText}
                        onClick={() => {
                          setDocTab(d.id)
                          setViewer(true)
                        }}
                      >
                        {d.id}
                      </Button>
                    ))}
                </div>
              </Card>
              <Card
                title="Phân bổ hóa đơn"
                aside={
                  payment &&
                  !allocationOnly && (
                    <Select
                      value={mode}
                      onChange={(e: any) => {
                        setMode(e.target.value)
                        setManual({})
                      }}
                      options={[
                        "Tự động phân bổ",
                        "Chỉ định hóa đơn",
                        "Chỉ ghi giảm",
                      ]}
                    />
                  )
                }
              >
                {autoError && <Alert tone="amber">{autoError}</Alert>}
                {!invoices.length && (
                  <Alert tone="amber">
                    Khách hàng chưa có hóa đơn đã ghi nhận công nợ còn nợ
                    {allocationOnly
                      ? ", chờ hóa đơn mới để phân bổ"
                      : ", vẫn có thể ghi nhận khoản trả trước bằng Chỉ ghi giảm"}
                  </Alert>
                )}
                <Table
                  rows={invoices}
                  columns={[
                    {
                      label: "Chọn",
                      render: (i: RecordData) => (
                        <input
                          aria-label={`Phân bổ ${i.id}`}
                          type="checkbox"
                          disabled={
                            !payment ||
                            (!allocationOnly && mode !== "Chỉ định hóa đơn") ||
                            (allocationOnly &&
                              !order.includes(i.id) &&
                              total >= amount)
                          }
                          checked={
                            allocationOnly
                              ? order.includes(i.id)
                              : !!amounts[i.id]
                          }
                          onChange={(e) => {
                            if (allocationOnly)
                              setOrder(
                                e.target.checked
                                  ? [...order, i.id]
                                  : order.filter((k) => k !== i.id),
                              )
                            else
                              setManual({
                                ...manual,
                                [i.id]: e.target.checked
                                  ? Math.min(
                                      i.outstanding,
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
                      render: (i: RecordData) => (
                        <div>
                          <strong>{i.id}</strong>
                          <small>{date(i.issuedAt)}</small>
                        </div>
                      ),
                    },
                    {
                      label: "Hạn TT",
                      render: (i: RecordData) => date(i.dueAt),
                    },
                    {
                      label: "Còn nợ",
                      align: "right",
                      render: (i: RecordData) => money(i.outstanding),
                    },
                    {
                      label: "Số phân bổ",
                      align: "right",
                      render: (i: RecordData) =>
                        payment &&
                        !allocationOnly &&
                        mode === "Chỉ định hóa đơn" ? (
                          <input
                            aria-label={`Số tiền ${i.id}`}
                            className="amount-input"
                            type="number"
                            min="0"
                            max={i.outstanding}
                            value={manual[i.id] || ""}
                            onChange={(e) =>
                              setManual({
                                ...manual,
                                [i.id]: Number(e.target.value),
                              })
                            }
                          />
                        ) : (
                          money(amounts[i.id] || 0)
                        ),
                    },
                    {
                      label: "Sau ghi sổ",
                      align: "right",
                      render: (i: RecordData) =>
                        money(i.outstanding - (amounts[i.id] || 0)),
                    },
                  ]}
                />
                <div className="allocation-totals">
                  <div>
                    <small>
                      {allocationOnly ? "Còn được phân bổ" : "Số tiền chứng từ"}
                    </small>
                    <strong>{money(amount)}</strong>
                  </div>
                  <div>
                    <small>Phân bổ</small>
                    <strong className="green-text">{money(total)}</strong>
                  </div>
                  <div>
                    <small>Chưa phân bổ</small>
                    <strong className="amber-text">
                      {money(amount - total)}
                    </strong>
                  </div>
                </div>
                {payment && mode === "Chỉ ghi giảm" && !allocationOnly && (
                  <Field label="Lý do chưa phân bổ *">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Nhập lý do..."
                    />
                  </Field>
                )}
                {allocationOnly &&
                  s.allocations.some((a: RecordData) => a.sourceId === id) && (
                    <>
                      <h3>Đã phân bổ ở lượt trước</h3>
                      <Table
                        rows={s.allocations.filter(
                          (a: RecordData) => a.sourceId === id,
                        )}
                        columns={[
                          { label: "Hóa đơn", key: "invoiceId" },
                          {
                            label: "Ngày",
                            render: (a: RecordData) => date(a.date),
                          },
                          {
                            label: "Số tiền",
                            align: "right",
                            render: (a: RecordData) => money(a.amount),
                          },
                        ]}
                      />
                    </>
                  )}
              </Card>
              <Card title="Thông tin ghi nhận">
                <div className="form-grid">
                  <Field
                    label={
                      allocationOnly ? "Ngày phân bổ *" : "Ngày ghi nhận *"
                    }
                  >
                    <input
                      type="date"
                      value={postedDate}
                      onChange={(e) => setPostedDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Ghi chú">
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Nhập ghi chú (nếu có)"
                    />
                  </Field>
                </div>
              </Card>
            </div>
            <div className="stack">
              <Card
                title="Định khoản"
                aside={<LockKeyhole size={17} className="muted" />}
              >
                {allocationOnly && (
                  <Alert>
                    Bút toán đã ghi sổ ngày {date(r.postedAt)}. Lượt này chỉ
                    phân bổ, không phát sinh bút toán mới
                  </Alert>
                )}
                <div className="journal-line">
                  <span>Nợ</span>
                  {allocationOnly ? (
                    <strong>{r.debit}</strong>
                  ) : (
                    <input
                      aria-label="Tài khoản Nợ"
                      value={debit}
                      onChange={(e) => setDebit(e.target.value)}
                    />
                  )}
                  <strong>{money(r.net ?? r.amount)}</strong>
                </div>
                {r.tax != null && (
                  <div className="journal-line">
                    <span>Nợ</span>
                    <strong>3331</strong>
                    <strong>{money(r.tax)}</strong>
                  </div>
                )}
                <div className="journal-line">
                  <span>Có</span>
                  <strong>
                    131 <LockKeyhole size={12} />
                  </strong>
                  <strong>{money(r.amount)}</strong>
                </div>
                {debit !== r.defaultDebitAccount && !allocationOnly && (
                  <>
                    <Field label="Diễn giải lý do sửa *">
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
                  </>
                )}
                <p className="footnote">
                  Cấu hình tài khoản và thuế chỉ để minh họa
                </p>
              </Card>
              <Card title="Chi tiết Có TK 131">
                <Table
                  rows={[
                    ...Object.entries(amounts)
                      .filter(([, v]) => v > 0)
                      .map(([invoiceId, value]) => ({
                        id: invoiceId,
                        type: "Trừ nợ",
                        value,
                      })),
                    ...(amount - total > 0
                      ? [
                          {
                            id: "-",
                            type: "Chưa phân bổ",
                            value: amount - total,
                          },
                        ]
                      : []),
                  ]}
                  columns={[
                    { label: "Có 131", key: "type" },
                    { label: "Gắn với", key: "id" },
                    {
                      label: "Số tiền",
                      align: "right",
                      render: (a: RecordData) => money(a.value),
                    },
                  ]}
                />
                <div className="total-line">
                  <strong>Tổng</strong>
                  <strong>{money(amount)}</strong>
                </div>
              </Card>
              <Card title="Dư nợ khách hàng">
                <div className="balance-summary">
                  <span>Trước ghi nhận</span>
                  <strong>{money(balance(s, r.customerId))}</strong>
                  <ArrowRight size={20} className="muted" />
                  <span>Sau {allocationOnly ? "phân bổ" : "ghi nhận"}</span>
                  <strong className="red-text">
                    {money(
                      balance(s, r.customerId) -
                        (allocationOnly ? 0 : r.amount),
                    )}
                  </strong>
                </div>
              </Card>
            </div>
          </div>
          {error && (
            <Alert tone="red">
              {error}
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
            </Alert>
          )}
          <div className="action-bar">
            <span>
              <ShieldCheck size={17} />
              {allocationOnly
                ? "Chỉ phân bổ, không tạo bút toán mới"
                : "Ghi sổ trọn gói, không nháp, không phê duyệt"}
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
                    : "Xác nhận ghi nhận giảm nợ"}
              </Button>
            </div>
          </div>
          {viewer && (
            <Modal
              wide
              title={`${r.type} ${r.id} và chứng từ liên quan`}
              onClose={() => setViewer(false)}
            >
              <Tabs
                items={docs.map((d: RecordData) => ({
                  value: d.id,
                  label: d.id,
                }))}
                value={viewed.id}
                onChange={setDocTab}
              />
              <Alert>
                Dữ liệu hồ sơ giả lập theo JSON, không phải chứng từ thực tế
              </Alert>
              <Values
                values={Object.entries(viewed)
                  .filter(
                    ([k, v]) =>
                      !["lines", "origin", "version"].includes(k) &&
                      ["string", "number"].includes(typeof v),
                  )
                  .map(([k, v]) => [
                    ({
                      id: "Số chứng từ",
                      type: "Loại chứng từ",
                      customerId: "Mã khách hàng",
                      issuedAt: "Ngày lập",
                      amount: "Số tiền",
                      invoiceId: "Hóa đơn gốc",
                      net: "Trước thuế",
                      tax: "Thuế",
                      reason: "Lý do",
                      bank: "Ngân hàng",
                      bankAccount: "Tài khoản",
                      sourceApproval: "Trạng thái tại nguồn",
                      creator: "Người lập",
                      approvalBy: "Người duyệt tại nguồn",
                      content: "Nội dung",
                      gross: "Tổng tiền",
                      payer: "Người nộp",
                      cashier: "Thủ quỹ",
                      origin: "Nguồn",
                      defaultDebitAccount: "Tài khoản Nợ đề xuất",
                      taxAccount: "Tài khoản thuế",
                      taxRate: "Thuế suất cấu hình minh họa",
                      postingStatus: "Trạng thái ghi sổ",
                      suggestedMode: "Cách phân bổ đề xuất",
                      bankReference: "Mã tham chiếu ngân hàng",
                      transferContent: "Nội dung chuyển khoản",
                      adjustmentInvoiceId: "Hóa đơn điều chỉnh",
                      originalInvoiceId: "Hóa đơn gốc",
                      scenarioRequirement: "Điều kiện ca thử",
                      postedAt: "Ngày ghi sổ",
                      debit: "Tài khoản Nợ đã ghi",
                      note: "Ghi chú",
                      dueAt: "Hạn thanh toán",
                      arStatus: "Trạng thái công nợ nguồn",
                      currency: "Đơn vị tiền tệ",
                      sourceId: "Chứng từ nguồn",
                      orderId: "Đơn đặt hàng",
                      contractId: "Hợp đồng",
                      deliveryBatch: "Đợt giao",
                      number: "Số hóa đơn",
                      series: "Ký hiệu hóa đơn",
                      form: "Mẫu số hóa đơn",
                    } as RecordData)[k] || k,
                    typeof v === "number" &&
                    ["amount", "gross", "net", "tax"].includes(k)
                      ? money(v)
                      : ["issuedAt", "postedAt", "dueAt"].includes(k)
                        ? date(String(v))
                        : k === "arStatus"
                          ? ({
                              recognized: "Đã ghi nhận",
                              pending: "Chưa ghi nhận",
                              pending_adjustment: "Điều chỉnh chưa ghi nhận",
                            } as RecordData)[String(v)] || String(v)
                          : String(v),
                  ])}
              />
              {!!viewed.lines?.length && (
                <Table
                  rows={viewed.lines}
                  columns={[
                    { label: "Mặt hàng", key: "itemId" },
                    { label: "Số lượng", key: "quantity" },
                    {
                      label: "Đơn giá",
                      render: (l: RecordData) => money(l.unitPrice),
                    },
                    {
                      label: "Tổng tiền",
                      render: (l: RecordData) => money(l.gross),
                    },
                  ]}
                />
              )}
              <p className="footnote">{viewed.origin}</p>
            </Modal>
          )}
        </>
      ) : (
        <div className="selection-hint">
          <FileText size={28} />
          <h3>Chọn chứng từ để bắt đầu</h3>
          <p>
            Thông tin căn cứ, phân bổ hóa đơn và định khoản sẽ hiển thị tại đây
          </p>
        </div>
      )}
    </>
  )
}
