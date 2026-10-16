import { useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleCheck,
  FileText,
  FolderOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Wallet,
  X,
} from "lucide-react"
import {
  balance,
  customer,
  date,
  getState,
  money,
  outstanding,
  postIncrease,
  replaceState,
  seed,
  sum,
  type RecordData,
} from "./store"
import {
  Alert,
  Back,
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Modal,
  SearchBox,
  Select,
  Table,
  Tabs,
  Values,
} from "./ui"

export default function Increase({ s, notify }: any) {
  const [search, setSearch] = useState("")
  const [type, setType] = useState("Tất cả loại chứng từ")
  const [status, setStatus] = useState("Chờ tiếp nhận")
  const [selected, setSelected] = useState<string | null>(null)
  const [version, setVersion] = useState(s.revision)
  const [doc, setDoc] = useState<RecordData | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [advanced, setAdvanced] = useState(false)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const pending = s.increases.filter(
    (x: RecordData) => x.intakeStatus !== "Đã tiếp nhận",
  )
  const recognized = s.increases.filter(
    (x: RecordData) => x.intakeStatus === "Đã tiếp nhận",
  )
  const incomplete = pending.filter(
    (x: RecordData) => x.intakeStatus === "Chưa hoàn tất",
  )
  const filtered = s.increases.filter((r: RecordData) => {
    const haystack =
      `${r.id} ${r.invoiceId} ${r.customerId} ${customer(s, r.customerId)?.name}`.toLocaleLowerCase(
        "vi",
      )
    return (
      haystack.includes(search.trim().toLocaleLowerCase("vi")) &&
      (type === "Tất cả loại chứng từ" || r.type === type) &&
      (status === "Tất cả" ||
        (status === "Đã tiếp nhận"
          ? r.intakeStatus === status
          : status === "Chưa hoàn tất"
            ? r.intakeStatus === status
            : r.intakeStatus !== "Đã tiếp nhận")) &&
      (!from || r.issuedAt >= from) &&
      (!to || r.issuedAt <= to)
    )
  })
  const open = (r: RecordData) => {
    setSelected(r.id)
    setVersion(s.revision)
    setResult(null)
  }
  const x = s.increases.find((r: RecordData) => r.id === selected)
  const confirm = async () => {
    if (busy) return
    setBusy(true)
    await new Promise((resolve) => setTimeout(resolve, 450))
    try {
      const response = postIncrease(getState(), x.id, version)
      replaceState(response.state)
      setVersion(response.state.revision)
      setResult({
        tone: response.warning ? "amber" : "green",
        text:
          response.warning ||
          `Ghi nhận công nợ thành công - ${x.id}. Dư nợ khách hàng sau cập nhật: ${money(balance(response.state, x.customerId))}`,
      })
    } catch (e) {
      setResult({ tone: "red", text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  if (x) {
    const c = customer(s, x.customerId)
    const current = balance(s, x.customerId)
    const accepted = x.intakeStatus === "Đã tiếp nhận"
    const docs = seed.sourceDocuments.filter(
      (d: RecordData) => d.sourceId === x.id,
    )
    const invoice = s.invoices.find((i: RecordData) => i.id === x.invoiceId)
    const remaining = x.originalInvoiceId
      ? outstanding(s, x.originalInvoiceId) +
        (accepted ? 0 : x.balanceIncrement)
      : accepted
        ? outstanding(s, x.invoiceId)
        : x.outstandingAfter
    return (
      <>
        <Back onClick={() => setSelected(null)} />
        <div className="page-heading">
          <div>
            <div className="eyebrow">CHI TIẾT CHỨNG TỪ</div>
            <h1>{x.id}</h1>
            <p>
              Kiểm tra chứng từ nguồn và các căn cứ trước khi ghi nhận công nợ
            </p>
          </div>
          <Badge>{x.intakeStatus.replace(" UC01", "")}</Badge>
        </div>
        {result && <Alert tone={result.tone}>{result.text}</Alert>}
        <div className="detail-grid">
          <div className="stack">
            <Card
              title="Thông tin chứng từ"
              aside={
                <Badge tone="neutral">{x.type.replace("Chứng từ ", "")}</Badge>
              }
            >
              <Values
                values={[
                  ["Số chứng từ", x.id],
                  ["Ngày chứng từ", date(x.issuedAt)],
                  ["Khách hàng", c.name],
                  ["Mã khách hàng", c.id],
                  [
                    "Nội dung",
                    x.reason ||
                      (x.id.startsWith("CTDV")
                        ? "Dịch vụ vận chuyển thu riêng theo hồ sơ minh họa"
                        : "Bán hàng theo chứng từ nguồn minh họa"),
                  ],
                  [
                    "Đơn hàng / Hợp đồng",
                    x.orderId || x.contractId || "Không có liên kết",
                  ],
                  ["Đợt giao", x.deliveryBatch || "Không áp dụng"],
                  ["Ngày ghi nhận", date(s.clock)],
                ]}
              />
            </Card>
            <Card
              title="Hóa đơn và hồ sơ liên kết"
              aside={<span className="muted small">Chỉ xem</span>}
            >
              <div className="document-list">
                <button onClick={() => setDoc(invoice)}>
                  <span className="file-icon">
                    <FileText size={20} />
                  </span>
                  <span>
                    <strong>{invoice.id}</strong>
                    <small>Hóa đơn liên kết · {date(invoice.issuedAt)}</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
                {docs.map((d: RecordData) => (
                  <button key={d.id} onClick={() => setDoc(d)}>
                    <span className="file-icon">
                      <FolderOpen size={20} />
                    </span>
                    <span>
                      <strong>{d.id}</strong>
                      <small>
                        {d.type}
                        {d.issuedAt ? ` · ${date(d.issuedAt)}` : ""}
                      </small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
              {x.originalInvoiceId && (
                <div className="inset">
                  <Values
                    values={[
                      ["Chứng từ bán hàng gốc", x.originalSourceId],
                      ["Hóa đơn gốc", x.originalInvoiceId],
                      ["Khoản nợ gốc", x.receivableId],
                      ["Lý do điều chỉnh", x.reason],
                    ]}
                  />
                </div>
              )}
            </Card>
            <Card title="Chi tiết khoản phải thu">
              <Values
                values={[
                  [
                    "Tiền trước thuế",
                    x.netIncrease == null
                      ? "Chưa cung cấp"
                      : money(x.netIncrease),
                  ],
                  [
                    "Thuế GTGT theo nguồn demo",
                    x.taxIncrease == null
                      ? "Chưa cung cấp"
                      : money(x.taxIncrease),
                  ],
                  ["Giá trị phát sinh tăng", money(x.grossIncrease)],
                  [
                    "Tiền giảm đã phân bổ trước tiếp nhận",
                    money(x.allocatedBeforeIntake),
                  ],
                  ["Số còn phải thu sau ghi nhận", money(remaining)],
                  ["Hạn thanh toán", date(invoice.dueAt)],
                ]}
              />
              <Alert>
                Hóa đơn và hồ sơ chỉ là căn cứ liên kết, không ghi tăng thêm lần
                nữa
              </Alert>
            </Card>
          </div>
          <div className="stack">
            <Card
              title="Định khoản"
              aside={<ShieldCheck size={18} className="muted" />}
            >
              <Badge>{x.journalStatus}</Badge>
              {x.existingJournalId && (
                <p className="small">
                  Bút toán liên kết <strong>{x.existingJournalId}</strong>
                </p>
              )}
              {x.journalProposal ? (
                <Table
                  rows={x.journalProposal}
                  columns={[
                    { label: "Bên", key: "side" },
                    { label: "Tài khoản", key: "account" },
                    {
                      label: "Số tiền",
                      align: "right",
                      render: (r: RecordData) => money(r.amount),
                    },
                  ]}
                />
              ) : (
                <Alert>
                  BT-006 đã phản ánh số dư, nguồn chưa cung cấp dòng định khoản
                  lịch sử
                </Alert>
              )}
              <p className="footnote">
                Tài khoản và thuế là cấu hình minh họa theo JSON, không phải quy
                định thuế thực tế của HTX
              </p>
            </Card>
            <Card title="Dư nợ khách hàng">
              <div className="balance-summary">
                <span>Hiện tại</span>
                <strong>{money(current)}</strong>
                <div className="balance-arrow">
                  <ArrowDownLeft size={18} />
                  <span>
                    {accepted || x.alreadyInBalance
                      ? "Không cộng tăng lại"
                      : `Tăng ${money(x.balanceIncrement)}`}
                  </span>
                </div>
                <span>{accepted ? "Đã cập nhật" : "Dự kiến sau ghi nhận"}</span>
                <strong className="red-text">
                  {money(current + (accepted ? 0 : x.balanceIncrement))}
                </strong>
              </div>
              <div className="divider" />
              <Values
                values={[
                  [
                    "Hạn mức công nợ",
                    c.creditLimit == null
                      ? "Chưa thiết lập hạn mức"
                      : money(c.creditLimit),
                  ],
                  [
                    "Phản ánh vào số dư",
                    accepted || x.alreadyInBalance
                      ? "Đã phản ánh"
                      : "Chưa phản ánh",
                  ],
                ]}
              />
              {c.creditLimit != null &&
                current + (accepted ? 0 : x.balanceIncrement) >
                  c.creditLimit && (
                  <Alert tone="amber">
                    Dư nợ dự kiến vượt hạn mức, vẫn có thể ghi nhận theo quy tắc
                    prototype
                  </Alert>
                )}
            </Card>
            {!!s.attempts.find((a: RecordData) => a.sourceId === x.id) && (
              <Alert tone="amber">
                Mã xử lý XL-{x.id}
                <br />
                {s.attempts.find((a: RecordData) => a.sourceId === x.id)
                  ?.journalId
                  ? "Bút toán đã tạo được giữ lại, lần tiếp theo kiểm tra và sử dụng bút toán cũ"
                  : "Xác định chưa tạo bút toán, chưa cập nhật công nợ, cần kiểm tra trước lần xử lý tiếp theo"}
              </Alert>
            )}
          </div>
        </div>
        <div className="action-bar">
          <span>
            <ShieldCheck size={17} /> Ghi nhận một lần, đồng bộ toàn bộ nghiệp
            vụ
          </span>
          <div className="button-group">
            <Button disabled={busy} onClick={() => setSelected(null)}>
              Quay lại
            </Button>
            {result?.tone === "red" && (
              <Button
                onClick={() => {
                  setVersion(s.revision)
                  setResult(null)
                }}
              >
                Tải lại dữ liệu
              </Button>
            )}
            <Button
              primary
              icon={Check}
              disabled={accepted || busy}
              onClick={confirm}
            >
              {busy
                ? "Đang xử lý..."
                : accepted
                  ? "Đã ghi nhận"
                  : x.intakeStatus === "Chưa hoàn tất"
                    ? "Kiểm tra và tiếp tục"
                    : "Ghi nhận công nợ"}
            </Button>
          </div>
        </div>
        {doc && (
          <Modal wide title={`Hồ sơ ${doc.id}`} onClose={() => setDoc(null)}>
            <Alert>
              Hồ sơ minh họa, chỉ xem, không có chữ ký hoặc con dấu thực tế
            </Alert>
            <Values
              values={[
                ["Mã hồ sơ", doc.id],
                ["Loại", doc.type || "Hóa đơn"],
                ["Khách hàng", customer(s, doc.customerId)?.name],
                ["Ngày", date(doc.issuedAt)],
                [
                  "Giá trị",
                  doc.gross != null ? money(doc.gross) : "Chưa cung cấp",
                ],
                [
                  "Nội dung",
                  doc.content || "Thông tin liên kết theo bộ mock dùng chung",
                ],
                ["Nguồn dữ liệu", doc.origin],
              ]}
            />
          </Modal>
        )}
      </>
    )
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Ghi nhận công nợ phát sinh</h1>
          <p>Tiếp nhận chứng từ nguồn và ghi nhận khoản phải thu khách hàng</p>
        </div>
        <Button
          icon={RefreshCw}
          onClick={() => {
            setSearch("")
            setType("Tất cả loại chứng từ")
            setFrom("")
            setTo("")
            setPage(1)
            notify("Đã tải lại danh sách từ store dùng chung", "blue")
          }}
        >
          Làm mới
        </Button>
      </div>
      <div className="stats-grid">
        {[
          {
            label: "Chứng từ chờ tiếp nhận",
            value: pending.length.toString().padStart(2, "0"),
            icon: FileText,
            sub: "Cần kiểm tra và ghi nhận",
            tone: "red",
          },
          {
            label: "Giá trị phát sinh chờ ghi nhận",
            value: money(sum(pending, "grossIncrease")),
            icon: ArrowUpRight,
            sub: "Theo chứng từ nguồn",
            tone: "blue",
          },
          {
            label: "Chứng từ đã tiếp nhận",
            value: recognized.length.toString().padStart(2, "0"),
            icon: CircleCheck,
            sub: "Đã đồng bộ vào công nợ",
            tone: "green",
          },
          {
            label: "Cần kiểm tra xử lý",
            value: incomplete.length.toString().padStart(2, "0"),
            icon: Wallet,
            sub: "Chứng từ chưa hoàn tất",
            tone: "amber",
          },
        ].map((k) => (
          <div className="stat-card" key={k.label}>
            <div className="stat-top">
              <span>{k.label}</span>
              <span className={`stat-icon ${k.tone}`}>
                <k.icon size={19} />
              </span>
            </div>
            <strong className={k.value.includes("VND") ? "money-stat" : ""}>
              {k.value}
            </strong>
            <small>{k.sub}</small>
          </div>
        ))}
      </div>
      <Card className="list-card">
        <div className="list-title">
          <div>
            <h2>
              Danh sách chứng từ{" "}
              <span className="count-pill">{filtered.length}</span>
            </h2>
            <p>Chứng từ được cung cấp từ các chức năng nguồn</p>
          </div>
          <span className="subtle-label">
            <span className="live-dot" /> Dữ liệu dùng chung
          </span>
        </div>
        <Tabs
          value={status}
          onChange={(v: string) => {
            setStatus(v)
            setPage(1)
          }}
          items={[
            {
              value: "Chờ tiếp nhận",
              label: "Chờ tiếp nhận",
              count: pending.length,
            },
            {
              value: "Đã tiếp nhận",
              label: "Đã tiếp nhận",
              count: recognized.length,
            },
            {
              value: "Chưa hoàn tất",
              label: "Chưa hoàn tất",
              count: incomplete.length,
            },
            "Tất cả",
          ]}
        />
        <div className="filter-row">
          <div className="filter-type">
            <Select
              value={type}
              onChange={(e: any) => {
                setType(e.target.value)
                setPage(1)
              }}
              options={[
                "Tất cả loại chứng từ",
                ...new Set(s.increases.map((r: RecordData) => r.type)),
              ]}
            />
          </div>
          <SearchBox
            value={search}
            onChange={(v: string) => {
              setSearch(v)
              setPage(1)
            }}
            placeholder="Tìm số chứng từ, hóa đơn hoặc khách hàng..."
          />
          <Button
            icon={SlidersHorizontal}
            onClick={() => setAdvanced(!advanced)}
            className={advanced ? "filter-active" : ""}
          >
            Bộ lọc
          </Button>
        </div>
        {advanced && (
          <div className="filter-row advanced">
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
                setFrom("")
                setTo("")
                setType("Tất cả loại chứng từ")
                setSearch("")
              }}
            >
              Xóa bộ lọc
            </Button>
          </div>
        )}
        {from && to && from > to ? (
          <Alert tone="red">Từ ngày không được sau đến ngày</Alert>
        ) : (
          <Table
            rows={filtered.slice((page - 1) * 8, page * 8)}
            onRow={open}
            columns={[
              {
                label: "Số chứng từ",
                render: (r: RecordData) => (
                  <div className="doc-number">
                    <span className="table-file">
                      <FileText size={17} />
                    </span>
                    <div>
                      <strong>{r.id}</strong>
                      <small>{date(r.issuedAt)}</small>
                    </div>
                  </div>
                ),
              },
              {
                label: "Loại chứng từ",
                render: (r: RecordData) => (
                  <span className="type-cell">
                    {r.type === "Chứng từ bán hàng"
                      ? "Bán hàng"
                      : r.type === "Chứng từ bán hàng dịch vụ"
                        ? "Dịch vụ vận chuyển"
                        : "Điều chỉnh tăng"}
                  </span>
                ),
              },
              {
                label: "Khách hàng",
                render: (r: RecordData) => (
                  <div className="customer-cell">
                    <strong>{customer(s, r.customerId)?.name}</strong>
                    <small>{r.customerId}</small>
                  </div>
                ),
              },
              {
                label: "Giá trị tăng",
                align: "right",
                render: (r: RecordData) => (
                  <strong className="table-money">
                    {money(r.grossIncrease)}
                  </strong>
                ),
              },
              {
                label: "Hóa đơn liên kết",
                render: (r: RecordData) => (
                  <span className="invoice-link">{r.invoiceId}</span>
                ),
              },
              {
                label: "Hạch toán",
                render: (r: RecordData) => <Badge>{r.journalStatus}</Badge>,
              },
              {
                label: "Tiếp nhận",
                render: (r: RecordData) => (
                  <Badge>{r.intakeStatus.replace(" UC01", "")}</Badge>
                ),
              },
              {
                label: "",
                render: () => <ChevronRight size={17} className="muted" />,
              },
            ]}
          />
        )}
        <div className="table-footer">
          <span>
            Hiển thị {filtered.length ? (page - 1) * 8 + 1 : 0}-
            {Math.min(page * 8, filtered.length)} trong {filtered.length} chứng
            từ
          </span>
          <div className="pagination">
            <span>8 dòng / trang</span>
            <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              ‹
            </Button>
            <button className="page-number">{page}</button>
            <Button
              disabled={page * 8 >= filtered.length}
              onClick={() => setPage(page + 1)}
            >
              ›
            </Button>
          </div>
        </div>
      </Card>
      <div className="info-strip">
        <ShieldCheck size={19} />
        <div>
          <strong>Kiểm tra trước khi ghi nhận</strong>
          <p>
            Chỉ tiếp nhận chứng từ đã hoàn tất tại chức năng nguồn. Hóa đơn và
            hồ sơ liên kết không tạo thêm khoản phải thu
          </p>
        </div>
      </div>
      <div className="page-bottom">
        <span>Chọn một chứng từ để xem chi tiết và ghi nhận công nợ</span>
        <span>Ngày demo: {date(s.clock)}</span>
      </div>
    </>
  )
}
