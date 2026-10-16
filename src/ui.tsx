import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useState,
  type ReactNode,
  type ReactElement,
} from "react"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Search,
  ArrowLeft,
  ChevronDown,
} from "lucide-react"
import { customer, date, money, sum, type RecordData } from "./store"

export function Button({
  children,
  primary,
  icon: Icon,
  className = "",
  ...props
}: any) {
  return (
    <button
      className={`button ${primary ? "primary" : ""} ${className}`}
      {...props}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  )
}
export function Badge({
  children,
  tone,
}: {
  children: ReactNode
  tone?: string
}) {
  const text = String(children)
  const inferred =
    /Đã hạch toán|Đã tiếp nhận|Khớp|Đã gửi|Đang kích hoạt|Đã thanh toán/.test(
      text,
    )
      ? "green"
      : /lỗi|Lỗi|hủy|Quá hạn/.test(text)
        ? "red"
        : /Chờ|Chưa hoàn tất|Đến hạn|một phần/.test(text)
          ? "amber"
          : "neutral"
  return (
    <span className={`badge ${tone || inferred}`}>
      <span className="badge-dot" />
      {children}
    </span>
  )
}
export function Alert({
  children,
  tone = "blue",
}: {
  children: ReactNode
  tone?: string
}) {
  const Icon =
    tone === "green"
      ? CheckCircle2
      : tone === "red"
        ? AlertCircle
        : tone === "amber"
          ? AlertTriangle
          : Info
  return (
    <div className={`alert ${tone}`} role={tone === "red" ? "alert" : "status"}>
      <Icon size={18} />
      <div>{children}</div>
    </div>
  )
}
export function Card({ title, aside, children, className = "" }: any) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-heading">
          <h2>{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}
export function Field({ label, children, hint, error }: any) {
  const id = useId()
  return (
    <label htmlFor={id} className={`field ${error ? "field-error" : ""}`}>
      <span>{label}</span>
      {Children.map(children, (child) =>
        isValidElement(child)
          ? cloneElement(child as ReactElement<any>, {
              id,
              "aria-label": typeof label === "string" ? label : undefined,
              "aria-invalid": !!error,
            })
          : child,
      )}
      {hint && <small>{hint}</small>}
      {error && <small className="error-text">{error}</small>}
    </label>
  )
}
export function Select({ options, ...props }: any) {
  return (
    <div className="select-wrap">
      <select {...props}>
        {options.map((o: any) => (
          <option
            key={typeof o === "string" ? o : o.value}
            value={typeof o === "string" ? o : o.value}
          >
            {typeof o === "string" ? o : o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} />
    </div>
  )
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Tìm kiếm",
  ...props
}: any) {
  return (
    <div className="search-box">
      <Search size={18} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        {...props}
      />
      {value && (
        <button onClick={() => onChange("")} aria-label="Xóa tìm kiếm">
          <X size={14} />
        </button>
      )}
    </div>
  )
}
export function Tabs({ items, value, onChange }: any) {
  return (
    <div className="tabs">
      {items.map((item: any) => {
        const x = typeof item === "string" ? { value: item, label: item } : item
        return (
          <button
            key={x.value}
            className={value === x.value ? "active" : ""}
            onClick={() => onChange(x.value)}
          >
            {x.label}
            {x.count != null && <span className="tab-count">{x.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
export function Empty({
  title = "Không có dữ liệu phù hợp",
  text = "Thử thay đổi bộ lọc hoặc tiêu chí tìm kiếm",
}: any) {
  return (
    <div className="empty">
      <Search size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}
export function Table({ columns, rows, onRow, selected, rowKey = "id" }: any) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c: any, n: number) => (
              <th key={n} className={c.align === "right" ? "num" : ""}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, n: number) => (
            <tr
              key={r[rowKey] || n}
              className={`${onRow ? "clickable" : ""} ${
                selected === r[rowKey] ? "selected" : ""
              }`}
              onClick={onRow ? () => onRow(r) : undefined}
            >
              {columns.map((c: any, k: number) => (
                <td key={k} className={c.align === "right" ? "num" : ""}>
                  {c.render ? c.render(r, n) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty />}
    </div>
  )
}
export function Back({ children = "Quay lại danh sách", onClick }: any) {
  return (
    <button className="back" onClick={onClick}>
      <ArrowLeft size={16} />
      {children}
    </button>
  )
}
export function Values({ values }: { values: [string, ReactNode][] }) {
  return (
    <dl className="values">
      {values.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? "Chưa cung cấp"}</dd>
        </div>
      ))}
    </dl>
  )
}
export const noticeColumns: RecordData[] = [
  { label: "Hóa đơn", key: "id" },
  { label: "Giá trị gốc", key: "gross", numeric: true },
  { label: "Tăng hợp lệ", key: "increaseValid", numeric: true },
  { label: "Đã trả / Giảm trừ", key: "paid", numeric: true },
  { label: "Hạn thanh toán", value: (i: RecordData) => date(i.dueAt) },
  { label: "Còn phải trả", key: "outstanding", numeric: true },
]
export function NoticePaper({ s, customerId, rows, from, to, issuedAt }: any) {
  return (
    <div className="paper">
      <div className="paper-brand">
        HTX HOA LỢI<span>Prototype - Dữ liệu minh họa</span>
      </div>
      <h2>THÔNG BÁO CÔNG NỢ</h2>
      <p>Ngày lập: {date(issuedAt)}</p>
      <Values
        values={[
          ["Khách hàng", customer(s, customerId)?.name],
          ["Mã khách hàng", customerId],
          ["Kỳ thông báo", `${date(from)} - ${date(to)}`],
          ["Tài khoản", "131 - Phải thu khách hàng"],
        ]}
      />
      <Table
        rows={rows}
        columns={noticeColumns.map((c) => ({
          ...c,
          align: c.numeric ? "right" : undefined,
          render: (r: RecordData) =>
            c.value ? c.value(r) : c.numeric ? money(r[c.key!]) : r[c.key!],
        }))}
      />
      <div className="paper-total">
        <span>Tổng số tiền còn phải trả</span>
        <strong>{money(sum(rows, "outstanding"))}</strong>
      </div>
      <p className="footnote">
        Dữ liệu giả lập phục vụ rà soát prototype, không phải thông tin thực tế
        của HTX
      </p>
    </div>
  )
}
export function Modal({ title, children, onClose, footer, wide = false }: any) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", fn)
    const old = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", fn)
      document.body.style.overflow = old
    }
  }, [onClose])
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          {footer || <Button onClick={onClose}>Đóng</Button>}
        </div>
      </section>
    </div>
  )
}
export function ExportButtons({
  title,
  rows,
  columns,
  context,
  fail,
  notify,
  onOutput,
  validate,
}: any) {
  const [exporting, setExporting] = useState(false)
  const exportExcel = async () => {
    if (exporting) return
    setExporting(true)
    try {
      validate?.()
      const XLSX = await import("xlsx")
      validate?.()
      if (fail)
        throw new Error(
          "Không tạo được tệp Excel, dữ liệu đang xem được giữ lại để thử lại",
        )
      const data = rows.map((r: RecordData) =>
        Object.fromEntries(
          columns.map((c: RecordData) => [
            c.label,
            c.value ? c.value(r) : r[c.key],
          ]),
        ),
      )
      const sheet = XLSX.utils.aoa_to_sheet([
        [title],
        ["Prototype - Dữ liệu minh họa"],
        [context || ""],
        [],
        columns.map((c: RecordData) => c.label),
        ...data.map((r: RecordData) => Object.values(r)),
      ])
      sheet["!cols"] = columns.map(() => ({ wch: 28 }))
      rows.forEach((_: RecordData, row: number) =>
        columns.forEach((c: RecordData, col: number) => {
          const cell = sheet[XLSX.utils.encode_cell({ r: row + 5, c: col })]
          if (c.numeric && cell?.t === "n")
            cell.z = '#,##0" VND";"Dư Có "#,##0" VND"'
        }),
      )
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, "Cong no")
      XLSX.writeFile(workbook, "Hoa-Loi-du-lieu-minh-hoa.xlsx")
      onOutput?.("Xuất Excel")
      notify?.("Đã tạo tệp Excel đúng dữ liệu đang xem", "green")
    } catch (e) {
      notify?.((e as Error).message, "red")
    } finally {
      setExporting(false)
    }
  }
  const print = () => {
    try {
      validate?.()
    } catch (e) {
      return notify?.((e as Error).message, "red")
    }
    if (fail) return notify?.("Không tạo được bản in, vui lòng thử lại", "red")
    const w = window.open("", "_blank")
    if (!w)
      return notify?.(
        "Trình duyệt đã chặn cửa sổ in, vui lòng cho phép mở cửa sổ",
        "red",
      )
    const esc = (v: any) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c]!,
      )
    w.document.write(
      `<html lang="vi"><head><title>${esc(title)}</title><style>body{font:14px Arial;padding:32px;color:#1e293b}h1{font-size:24px}table{border-collapse:collapse;width:100%;margin-top:24px}td,th{padding:12px;border:1px solid #ddd;text-align:left}small{color:#666}@media print{button{display:none}}</style></head><body><small>HTX HOA LỢI · Prototype - Dữ liệu minh họa</small><h1>${esc(title)}</h1><p>${esc(context)}</p><table><thead><tr>${columns.map((c: any) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((r: any) => `<tr>${columns.map((c: any) => `<td>${esc(c.value ? c.value(r) : r[c.key])}</td>`).join("")}</tr>`).join("")}</tbody></table><p>Dữ liệu giả lập, không phải thông tin thực tế của HTX</p><script>window.onload=function(){window.print()}</script></body></html>`,
    )
    w.document.close()
    onOutput?.("Mở bản in / PDF")
  }
  return (
    <div className="button-group">
      <Button onClick={print}>In / Lưu PDF</Button>
      <Button disabled={exporting} onClick={exportExcel}>
        {exporting ? "Đang tạo tệp..." : "Xuất Excel"}
      </Button>
    </div>
  )
}
export const invoiceColumns = (s: RecordData) => [
  {
    label: "Hóa đơn",
    render: (r: RecordData) => <strong className="link-text">{r.id}</strong>,
  },
  { label: "Ngày hóa đơn", render: (r: RecordData) => date(r.issuedAt) },
  { label: "Hạn thanh toán", render: (r: RecordData) => date(r.dueAt) },
  {
    label: "Giá trị gốc",
    align: "right",
    render: (r: RecordData) => money(r.gross),
  },
  {
    label: "Còn phải thu",
    align: "right",
    render: (r: RecordData) => <strong>{money(r.outstanding)}</strong>,
  },
]
