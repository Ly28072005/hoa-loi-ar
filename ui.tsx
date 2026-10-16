import type {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react"
export function Button({
  variant = "secondary",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "link"
  loading?: boolean
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`button ${variant} ${className}`}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}
export function SearchField({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="search-label">
      {label}
      <span className="search-input">
        <Icon name="search" size={18} />
        <input {...props} type="search" />
      </span>
    </label>
  )
}
export function FileField({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
      {label}
      <input {...props} type="file" />
    </label>
  )
}
export function SelectField({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label>
      {label}
      <select {...props}>{children}</select>
    </label>
  )
}
export function TextAreaField({
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label>
      {label}
      <textarea {...props} />
    </label>
  )
}
export function Badge({
  children,
  tone = "info",
}: {
  children: ReactNode
  tone?: "info" | "success" | "warning" | "error"
}) {
  return (
    <span className={`badge tone-${tone}`}>
      <span className="dot" />
      {children}
    </span>
  )
}
export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
export function LinkList({ items }: { items: string[] }) {
  return (
    <ul className="link-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
export function Section({
  title,
  children,
  readonly = true,
}: {
  title: string
  children: ReactNode
  readonly?: boolean
}) {
  return (
    <section className="card section">
      <div className="section-title">
        <h2>{title}</h2>
        {readonly && <span className="caption">Chỉ xem</span>}
      </div>
      {children}
    </section>
  )
}
export function DataTable({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={label}>
      <table>{children}</table>
    </div>
  )
}
export function Alert({
  tone,
  title,
  children,
}: {
  tone: "success" | "warning" | "error" | "info"
  title: string
  children?: ReactNode
}) {
  return (
    <section
      className={`alert tone-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon
        name={
          tone === "success" ? "check" : tone === "error" ? "error" : "info"
        }
      />
      <div className="alert-content">
        <strong>{title}</strong>
        {children}
      </div>
    </section>
  )
}
export function StatCard({
  icon,
  label,
  value,
  unit,
}: {
  icon: string
  label: string
  value: ReactNode
  unit: string
}) {
  return (
    <div className="card stat">
      <div className="stat-icon">
        <Icon name={icon} size={24} />
      </div>
      <div>
        <span>{label}</span>
        <strong>
          {value} <small>{unit}</small>
        </strong>
      </div>
    </div>
  )
}
export function PageHeading({
  title,
  description,
  breadcrumb,
}: {
  title: string
  description: string
  breadcrumb: string
}) {
  return (
    <>
      <nav className="breadcrumb" aria-label="Đường dẫn">
        Công nợ phải thu <span>/</span>
        <strong>{breadcrumb}</strong>
      </nav>
      <div className="page-heading">
        <div className="eyebrow">QUẢN LÝ CÔNG NỢ PHẢI THU</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </>
  )
}
export function Steps({
  stage,
  incomplete = false,
}: {
  stage: 1 | 2 | 3
  incomplete?: boolean
}) {
  return (
    <nav className="steps" aria-label="Các bước ghi nhận">
      {[
        "Chọn chứng từ",
        incomplete ? "Ghi nhận chưa hoàn tất" : "Xem và ghi nhận",
        incomplete ? "Kết quả chưa hoàn tất" : "Kết quả ghi nhận",
      ].map((label, i) => (
        <div
          key={i}
          className={`step ${
            incomplete && i === 1
              ? "stalled"
              : i + 1 < stage
                ? "complete"
                : i + 1 === stage
                  ? "current"
                  : ""
          }`}
          aria-current={i + 1 === stage ? "step" : undefined}
        >
          <span>
            {i + 1 < stage && !(incomplete && i === 1) ? (
              <Icon name="check" size={16} />
            ) : (
              i + 1
            )}
          </span>
          {label}
        </div>
      ))}
    </nav>
  )
}
export function ActionBar({
  children,
  hint,
}: {
  children: ReactNode
  hint: string
}) {
  return (
    <div className="action-bar">
      <span>
        <Icon name="info" size={18} />
        {hint}
      </span>
      <div>{children}</div>
    </div>
  )
}
export function EmptyState({
  title,
  description,
  icon = "search",
  children,
}: {
  title: string
  description: string
  icon?: string
  children: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={28} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="actions">{children}</div>
    </div>
  )
}
export function Sidebar({
  onHome,
  onReconciliation,
  active = "record",
  disabled,
}: {
  onHome: () => void
  onReconciliation?: () => void
  active?: "record" | "reconciliation"
  disabled: boolean
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Icon name="leaf" size={28} />
        </div>
        <div>
          HOA LỢI<span>HỢP TÁC XÃ</span>
        </div>
      </div>
      <div className="nav-heading">QUẢN LÝ CÔNG NỢ</div>
      <Button
        className={active === "record" ? "nav-active" : "nav-item"}
        variant="link"
        onClick={onHome}
        disabled={disabled}
        aria-label="Ghi nhận công nợ"
      >
        <Icon name="file" />
        <span>Ghi nhận công nợ</span>
      </Button>
      <Button
        className={active === "reconciliation" ? "nav-active" : "nav-item"}
        variant="link"
        onClick={onReconciliation}
        disabled={disabled}
        aria-label="Đối chiếu công nợ"
      >
        <Icon name="reconcile" />
        <span>Đối chiếu công nợ</span>
      </Button>
      <div className="sidebar-note">
        <Icon name="shield" />
        <strong>Nghiệp vụ kế toán</strong>
        <p>Quản lý khoản phải thu và theo dõi công nợ khách hàng</p>
      </div>
      <div className="sidebar-bottom">
        <div className="avatar">KT</div>
        <div>
          <strong>Kế toán</strong>
          <span>HTX Hoa Lợi</span>
        </div>
      </div>
    </aside>
  )
}

type IconProps = {
  name: string
  size?: number
}
export function Icon({ name, size = 20 }: IconProps) {
  const paths: Record<string, string> = {
    error: "M8 3h8l5 5v8l-5 5H8l-5-5V8z M12 8v5 M12 16h.01",
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    file: "M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h6",
    users:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87",
    chart: "M4 3v18h17 M8 16v-4 M13 16V8 M18 16V5",
    search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    back: "M19 12H5 M11 6l-6 6 6 6",
    check: "M5 12l4 4L19 6",
    info: "M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    exit: "M9 5H4v14h5 M12 12h10 M18 8l4 4-4 4",
    reset: "M3 10a9 9 0 1 1 1 8 M3 4v6h6",
    chevron: "M6 9l6 6 6-6",
    leaf: "M20 3C8 1 2 8 6 15s15 3 14-12z M5 21l10-12",
    shield: "M12 2l9 4v6c0 6-9 10-9 10S3 18 3 12V6z M8 12l3 3 5-6",
    flask: "M9 3h6 M10 3v6L4 19q-1 2 2 2h12q3 0 2-2L14 9V3 M7 15h10",
    clock: "M12 7v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    reconcile: "M7 7h12 M15 3l4 4-4 4 M17 17H5 M9 13l-4 4 4 4",
    upload: "M12 16V4 M7 9l5-5 5 5 M4 20h16",
    lock: "M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3",
    message: "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z",
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.file} />
    </svg>
  )
}
