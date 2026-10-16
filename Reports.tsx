import { useState } from "react"
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  FileBarChart,
  FileText,
  Package,
  Search,
  ShoppingBag,
  Users,
} from "lucide-react"
import {
  balance,
  customer,
  date,
  debtStatus,
  money,
  noticeRows,
  outstanding,
  overdue,
  report,
  seed,
  type RecordData,
} from "./store"
import {
  Alert,
  Back,
  Badge,
  Button,
  Card,
  Empty,
  ExportButtons,
  Field,
  NoticePaper,
  noticeColumns,
  SearchBox,
  Select,
  Table,
  Values,
} from "./ui"

export const reportGroups = [
  {
    name: "Khách hàng",
    icon: Users,
    description: "Tổng hợp, chi tiết và thông báo công nợ khách hàng",
    templates: [
      "Tổng hợp công nợ phải thu khách hàng",
      "Chi tiết công nợ phải thu khách hàng",
      "Thông báo công nợ",
      "Thông báo công nợ (Mẫu 2)",
      "Chi tiết công nợ phải thu theo hóa đơn",
    ],
  },
  {
    name: "Đơn hàng",
    icon: ShoppingBag,
    description: "Theo dõi khoản phải thu theo đơn đặt hàng",
    templates: [
      "Tổng hợp công nợ phải thu theo đơn đặt hàng",
      "Chi tiết công nợ phải thu theo đơn đặt hàng",
    ],
  },
  {
    name: "Hợp đồng",
    icon: FileText,
    description: "Theo dõi công nợ theo hợp đồng bán và đợt giao",
    templates: [
      "Tổng hợp công nợ phải thu theo hợp đồng bán",
      "Chi tiết công nợ phải thu theo hợp đồng bán",
    ],
  },
  {
    name: "Mặt hàng",
    icon: Package,
    description: "Chi tiết công nợ theo mặt hàng có căn cứ liên kết",
    templates: [
      "Chi tiết công nợ phải thu theo mặt hàng (tính)",
      "Chi tiết công nợ phải thu theo mặt hàng",
    ],
  },
  {
    name: "Tuổi nợ",
    icon: CalendarClock,
    description: "Phân tích hạn thanh toán và ngày quá hạn",
    templates: [
      "Phân tích công nợ phải thu theo tuổi nợ",
      "Chi tiết công nợ phải thu theo tuổi nợ",
    ],
  },
]
export default function Reports({ s, notify }: any) {
  const [search, setSearch] = useState("")
  const [group, setGroup] = useState("")
  const [template, setTemplate] = useState("")
  const [period, setPeriod] = useState("Tùy chỉnh")
  const [start, setStart] = useState(seed.meta.demoClock)
  const [end, setEnd] = useState(s.clock)
  const [client, setClient] = useState("")
  const [clientGroup, setClientGroup] = useState("")
  const [linked, setLinked] = useState("")
  const [item, setItem] = useState("")
  const [onlyNonzero, setOnlyNonzero] = useState(true)
  const [result, setResult] = useState<RecordData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const selectedGroup = reportGroups.find((g) => g.name === group)
  const getLinked = (i: RecordData, key: string) =>
    i[key] ||
    seed.uc01Sources.find((x: RecordData) => x.invoiceId === i.id)?.[key]
  const open = (name: string, value?: string) => {
    const g = reportGroups.find((g) => g.name === name)!
    setGroup(name)
    setTemplate(value || g.templates[0])
    setResult(null)
    setError("")
    setLinked("")
    setItem("")
  }
  const show = async () => {
    if (loading) return
    setLoading(true)
    setError("")
    await new Promise((resolve) => setTimeout(resolve, 350))
    try {
      if (!template || !period)
        throw new Error("Vui lòng chọn mẫu báo cáo và kỳ báo cáo")
      const summary = report(s, start, end, client || undefined).filter(
        (c: RecordData) =>
          (!clientGroup || customer(s, c.id).group === clientGroup) &&
          (!onlyNonzero || c.opening || c.increase || c.decrease || c.closing),
      )
      const context = `${date(start)} - ${date(end)} · TK 131 · ${
        client ? customer(s, client).name : "Tất cả khách hàng"
      }${linked ? ` · ${linked}` : ""}${item ? ` · ${item}` : ""}`
      let rows: RecordData[] = [],
        columns: RecordData[] = [],
        warning = ""
      const previous = new Date(Date.parse(start) - 86400000)
        .toISOString()
        .slice(0, 10)
      const invoices = s.invoices.filter(
        (i: RecordData) =>
          (!client || i.customerId === client) &&
          (!clientGroup || customer(s, i.customerId).group === clientGroup) &&
          (s.receivables.some((r: RecordData) => r.invoiceId === i.id) ||
            s.events.some(
              (e: RecordData) => e.invoiceId === i.id && e.date <= end,
            )),
      )
      const invoiceRow = (i: RecordData) => {
        const opening = outstanding(s, i.id, previous)
        const events = s.events.filter(
          (e: RecordData) =>
            e.invoiceId === i.id && e.date >= start && e.date <= end,
        )
        return {
          ...i,
          name: customer(s, i.customerId).name,
          opening,
          increase: events
            .filter((e: RecordData) => e.delta > 0)
            .reduce((n: number, e: RecordData) => n + e.delta, 0),
          decrease: -events
            .filter((e: RecordData) => e.delta < 0)
            .reduce((n: number, e: RecordData) => n + e.delta, 0),
          closing: outstanding(s, i.id, end),
        }
      }
      const financial = [
        { label: "Số dư đầu kỳ", key: "opening", numeric: true },
        { label: "Phát sinh tăng", key: "increase", numeric: true },
        { label: "Thanh toán / Giảm nợ", key: "decrease", numeric: true },
        { label: "Còn phải thu", key: "closing", numeric: true },
      ]
      if (template === "Thông báo công nợ (Mẫu 2)")
        throw new Error("Chưa có mẫu được cung cấp, không tự dựng bố cục Mẫu 2")
      if (group === "Khách hàng") {
        if (template === "Thông báo công nợ") {
          if (!client)
            throw new Error(
              "Vui lòng chọn một khách hàng để xem bản thông báo công nợ riêng",
            )
          rows = noticeRows(
            s,
            invoices.map(invoiceRow).filter((i: RecordData) => i.closing > 0),
            end,
          )
          columns = noticeColumns
        } else if (template === "Tổng hợp công nợ phải thu khách hàng") {
          rows = summary
          columns = [
            { label: "Mã khách hàng", key: "id" },
            { label: "Khách hàng", key: "name" },
            ...financial,
          ]
        } else {
          rows = invoices
            .map(invoiceRow)
            .filter(
              (i: RecordData) =>
                !onlyNonzero ||
                i.opening ||
                i.increase ||
                i.decrease ||
                i.closing,
            )
          columns = [
            { label: "Hóa đơn", key: "id" },
            { label: "Khách hàng", key: "name" },
            ...financial,
          ]
          warning =
            "Chi tiết theo hóa đơn không trừ tiền chưa phân bổ. Số dư khách hàng còn phải trừ khoản Có 131 chưa gắn hóa đơn"
        }
      } else if (group === "Đơn hàng" || group === "Hợp đồng") {
        const key = group === "Đơn hàng" ? "orderId" : "contractId"
        if (template.startsWith("Chi tiết") && !linked)
          throw new Error(
            `Vui lòng chọn ${group.toLowerCase()} cho mẫu chi tiết`,
          )
        const eligible = invoices.filter(
          (i: RecordData) =>
            getLinked(i, key) && (!linked || getLinked(i, key) === linked),
        )
        const mapped = eligible.map((i: RecordData) => ({
          ...invoiceRow(i),
          link: getLinked(i, key),
        }))
        if (template.startsWith("Chi tiết")) rows = mapped
        else
          for (const i of mapped) {
            let row = rows.find((r) => r.id === i.link)
            if (!row) {
              row = {
                id: i.link,
                link: i.link,
                name: i.name,
                opening: 0,
                increase: 0,
                decrease: 0,
                closing: 0,
              }
              rows.push(row)
            }
            for (const key of ["opening", "increase", "decrease", "closing"])
              row[key] += i[key]
          }
        columns = [
          { label: group, key: "link" },
          ...(template.startsWith("Chi tiết")
            ? [{ label: "Hóa đơn", key: "id" }]
            : []),
          { label: "Khách hàng", key: "name" },
          ...financial,
        ]
        warning =
          "Chỉ lấy hóa đơn có liên kết. Tiền chưa phân bổ không được tự gắn với đơn hàng hoặc hợp đồng"
      } else if (group === "Mặt hàng") {
        if (!item)
          throw new Error("Vui lòng chọn mặt hàng cho mẫu báo cáo chi tiết")
        const eligible = invoices.filter((i: RecordData) =>
          i.lines?.some((l: RecordData) => l.itemId === item),
        )
        if (
          eligible.some((i: RecordData) =>
            s.events.some(
              (e: RecordData) =>
                e.invoiceId === i.id && e.delta < 0 && e.date <= end,
            ),
          )
        )
          throw new Error(
            "Chưa đủ căn cứ phân bổ khoản thanh toán hoặc giảm nợ theo mặt hàng, không tự chia theo tỷ trọng",
          )
        rows = eligible.flatMap((i: RecordData) =>
          i.lines
            .filter((l: RecordData) => l.itemId === item)
            .map((l: RecordData) => ({
              id: `${i.id}-${l.itemId}`,
              item: l.itemId,
              name: seed.items.find((x: RecordData) => x.id === l.itemId).name,
              invoice: i.id,
              unit: "Chai",
              opening: l.gross,
              increase: 0,
              decrease: 0,
              closing: l.gross,
            })),
        )
        columns = [
          { label: "Mặt hàng", key: "name" },
          { label: "Hóa đơn", key: "invoice" },
          { label: "ĐVT", key: "unit" },
          ...financial,
        ]
        warning =
          "Chỉ hiển thị phạm vi có dòng hàng minh họa. Không đủ căn cứ để suy ra tổng công nợ toàn bộ HTX theo mặt hàng"
      } else {
        rows = invoices
          .map(invoiceRow)
          .filter((i: RecordData) => i.closing > 0)
          .map((i: RecordData) => {
            const days = overdue(s, i, end)
            const thresholds = s.configuration.agingBuckets
            let bucket = !i.dueAt
              ? "Chưa xác định hạn"
              : i.dueAt > end
                ? "Chưa đến hạn"
                : i.dueAt === end
                  ? "Đến hạn"
                  : "Chưa cấu hình ngưỡng"
            if (days && thresholds?.length) {
              const index = thresholds.findIndex((n: number) => days <= n)
              bucket =
                index < 0
                  ? `Trên ${thresholds.at(-1)} ngày`
                  : `${
                      index ? thresholds[index - 1] + 1 : 1
                    }-${thresholds[index]} ngày`
            }
            return {
              ...i,
              days: days == null ? "Chưa xác định hạn" : days,
              bucket,
            }
          })
        columns = [
          { label: "Khách hàng", key: "name" },
          { label: "Hóa đơn", key: "id" },
          {
            label: "Hạn thanh toán",
            key: "due",
            value: (i: RecordData) => date(i.dueAt),
          },
          { label: "Ngày quá hạn", key: "days" },
          { label: "Nhóm tuổi nợ", key: "bucket" },
          { label: "Còn phải thu", key: "closing", numeric: true },
        ]
        warning = !s.configuration.agingBuckets
          ? "Chưa cấu hình ngưỡng tuổi nợ, chỉ hiển thị ngày quá hạn từng khoản. Có thể nhập ngưỡng thử nghiệm trong Chế độ demo"
          : "Ngưỡng đang dùng do người dùng cấu hình trong Chế độ demo, không phải quy định chính thức của HTX"
      }
      if (!rows.length)
        throw new Error("Không có dữ liệu phù hợp với điều kiện lọc")
      setResult({
        title: template,
        group,
        rows,
        columns,
        context,
        warning,
        customerId: client,
        date: end,
        from: start,
        to: end,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <>
      {!!group && (
        <Back onClick={() => setGroup("")}>Quay lại danh mục báo cáo</Back>
      )}
      <div className="page-heading">
        <div>
          <h1>Báo cáo công nợ</h1>
          <p>
            {group
              ? `Báo cáo theo ${group.toLowerCase()} - chỉ xem, không thay đổi dữ liệu kế toán`
              : "Tra cứu và phân tích các khoản phải thu từ dữ liệu công nợ dùng chung"}
          </p>
        </div>
        {group && <Badge tone="blue">{group}</Badge>}
      </div>
      {!group ? (
        <>
          <Card className="catalog-search">
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Tìm kiếm theo tên báo cáo..."
            />
            <p className="small muted">
              Tìm tên báo cáo để chọn mẫu, không thay thế bộ lọc dữ liệu bên
              trong
            </p>
          </Card>
          <div className="report-catalog">
            {reportGroups
              .filter(
                (g) =>
                  !search ||
                  g.name.toLowerCase().includes(search.toLowerCase()) ||
                  g.templates.some((t) =>
                    t.toLowerCase().includes(search.toLowerCase()),
                  ),
              )
              .map((g) => (
                <Card key={g.name}>
                  <div className="catalog-title">
                    <span className="workflow-icon">
                      <g.icon size={23} />
                    </span>
                    <div>
                      <h2>{g.name}</h2>
                      <span className="muted small">
                        {g.templates.length} mẫu báo cáo
                      </span>
                    </div>
                  </div>
                  <p>{g.description}</p>
                  <div className="report-links">
                    {g.templates
                      .filter(
                        (t) =>
                          !search ||
                          g.name.toLowerCase().includes(search.toLowerCase()) ||
                          t.toLowerCase().includes(search.toLowerCase()),
                      )
                      .map((t) => (
                        <button key={t} onClick={() => open(g.name, t)}>
                          <FileBarChart size={16} />
                          <span>{t}</span>
                          <ArrowRight size={15} />
                        </button>
                      ))}
                  </div>
                </Card>
              ))}
          </div>
          {search &&
            !reportGroups.some((g) =>
              g.templates.some((t) =>
                t.toLowerCase().includes(search.toLowerCase()),
              ),
            ) && <Empty title="Không tìm thấy báo cáo theo từ khóa đã nhập" />}
        </>
      ) : (
        <>
          <Card title="Chọn mẫu và tham số báo cáo">
            <div className="form-grid">
              <Field label="Mẫu báo cáo *">
                <Select
                  value={template}
                  onChange={(e: any) => {
                    setTemplate(e.target.value)
                    setError("")
                  }}
                  options={selectedGroup!.templates}
                />
              </Field>
              <Field label="Kỳ báo cáo *">
                <Select
                  value={period}
                  onChange={(e: any) => {
                    setPeriod(e.target.value)
                    if (e.target.value === "Ngày demo") {
                      setStart(s.clock)
                      setEnd(s.clock)
                    }
                  }}
                  options={["Tùy chỉnh", "Ngày demo"]}
                />
              </Field>
              <Field
                label={
                  group === "Tuổi nợ"
                    ? "Phạm vi dữ liệu từ ngày *"
                    : "Từ ngày *"
                }
              >
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field
                label={group === "Tuổi nợ" ? "Ngày báo cáo *" : "Đến ngày *"}
              >
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </Field>
              <Field label="Tài khoản công nợ *">
                <input value="131 - Phải thu khách hàng" readOnly />
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
              <Field label="Nhóm khách hàng">
                <Select
                  value={clientGroup}
                  onChange={(e: any) => setClientGroup(e.target.value)}
                  options={[
                    { value: "", label: "Tất cả nhóm" },
                    ...[
                      ...new Set(s.customers.map((c: RecordData) => c.group)),
                    ].map((g) => ({ value: g, label: g })),
                  ]}
                />
              </Field>
              {["Đơn hàng", "Hợp đồng"].includes(group) && (
                <Field
                  label={`${group}${
                    template.startsWith("Chi tiết") ? " *" : ""
                  }`}
                >
                  <Select
                    value={linked}
                    onChange={(e: any) => setLinked(e.target.value)}
                    options={[
                      { value: "", label: `Tất cả ${group.toLowerCase()}` },
                      ...(group === "Đơn hàng"
                        ? seed.orders
                        : seed.contracts
                      ).map((l: RecordData) => ({ value: l.id, label: l.id })),
                    ]}
                  />
                </Field>
              )}
              {group === "Mặt hàng" && (
                <>
                  <Field label="Nhóm mặt hàng">
                    <input value="Tương ớt Mường Khương" readOnly />
                  </Field>
                  <Field label="Mặt hàng *">
                    <Select
                      value={item}
                      onChange={(e: any) => setItem(e.target.value)}
                      options={[
                        { value: "", label: "Chọn mặt hàng" },
                        ...seed.items.map((i: RecordData) => ({
                          value: i.id,
                          label: i.name,
                        })),
                      ]}
                    />
                  </Field>
                </>
              )}
            </div>
            <div className="card-actions">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={onlyNonzero}
                  onChange={(e) => setOnlyNonzero(e.target.checked)}
                />
                Chỉ lấy khách hàng có số dư hoặc phát sinh
              </label>
              <Button
                onClick={() => {
                  setClient("")
                  setClientGroup("")
                  setLinked("")
                  setItem("")
                  setStart(seed.meta.demoClock)
                  setEnd(s.clock)
                  setError("")
                }}
              >
                Xóa lọc
              </Button>
              <Button
                primary
                disabled={loading}
                icon={BarChart3}
                onClick={show}
              >
                {loading ? "Đang tổng hợp..." : "Xem báo cáo"}
              </Button>
            </div>
          </Card>
          {error && <Alert tone="red">{error}</Alert>}
          {result ? (
            <Card
              title="Kết quả báo cáo"
              aside={
                <ExportButtons
                  title={result.title}
                  context={result.context}
                  rows={result.rows}
                  columns={result.columns}
                  fail={s.faults.fileCreate}
                  notify={notify}
                />
              }
            >
              {result.title === "Thông báo công nợ" ? (
                <NoticePaper
                  s={s}
                  customerId={result.customerId}
                  rows={result.rows}
                  from={result.from}
                  to={result.to}
                  issuedAt={result.date}
                />
              ) : (
                <div className="report-result">
                  <h2>{result.title}</h2>
                  <p className="muted">{result.context}</p>
                  {result.warning && (
                    <Alert tone="amber">{result.warning}</Alert>
                  )}
                  <Table
                    rows={result.rows}
                    columns={result.columns.map((c: RecordData) => ({
                      ...c,
                      align: c.numeric ? "right" : undefined,
                      render: (r: RecordData) =>
                        c.value
                          ? c.value(r)
                          : c.numeric
                            ? money(r[c.key])
                            : r[c.key],
                    }))}
                  />
                  <div className="total-line">
                    <span>Tổng còn phải thu trong phạm vi đang xem</span>
                    <strong className="red-text">
                      {money(sumRows(result.rows, "closing"))}
                    </strong>
                  </div>
                  <p className="footnote">
                    Kết quả được giữ theo lần nhấn Xem báo cáo. Khi thay đổi
                    tham số hoặc dữ liệu, nhấn Xem báo cáo để tổng hợp lại
                  </p>
                </div>
              )}
            </Card>
          ) : (
            <div className="selection-hint">
              <FileBarChart size={32} />
              <h3>Chưa có kết quả báo cáo</h3>
              <p>
                Chọn mẫu, nhập tham số và nhấn Xem báo cáo để tổng hợp dữ liệu
              </p>
            </div>
          )}
        </>
      )}
    </>
  )
}
function sumRows(rows: RecordData[], key: string) {
  return rows.reduce((n, r) => n + Number(r[key] || 0), 0)
}
