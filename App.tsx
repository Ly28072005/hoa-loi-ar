import { useEffect, useState } from "react"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  GitCompareArrows,
  Landmark,
  Leaf,
  Menu,
  PanelLeftClose,
  ShieldCheck,
  X,
} from "lucide-react"
import Increase from "./Increase"
import Reduction from "./Reduction"
import Reconcile from "./Reconcile"
import Notifications from "./Notifications"
import Reports from "./Reports"
import Demo from "./Demo"
import { date, useStore } from "./store"
import { Alert, Button, Modal } from "./ui"

const navigation = [
  {
    id: "increase",
    label: "Ghi nhận công nợ phát sinh",
    icon: ArrowUpFromLine,
  },
  { id: "reduction", label: "Ghi nhận giảm công nợ", icon: ArrowDownToLine },
  { id: "reconcile", label: "Đối chiếu công nợ", icon: GitCompareArrows },
  { id: "notifications", label: "Thông báo công nợ", icon: Bell },
  { id: "reports", label: "Báo cáo công nợ", icon: ChartNoAxesCombined },
]
export default function App() {
  const s = useStore()
  const [page, setPage] = useState("increase")
  const [demo, setDemo] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [help, setHelp] = useState(false)
  const [toast, setToast] = useState<{
    text: string
    tone: string
  } | null>(null)
  const notify = (text: string, tone = "blue") => setToast({ text, tone })
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6500)
    return () => clearTimeout(timer)
  }, [toast])
  const active = navigation.find((n) => n.id === page)!
  const go = (id: string) => {
    setPage(id)
    setMobileMenu(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  return (
    <div className="app-shell">
      {mobileMenu && (
        <div className="mobile-scrim" onClick={() => setMobileMenu(false)} />
      )}
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Leaf size={25} strokeWidth={1.7} />
          </div>
          <div>
            <strong>HOA LỢI</strong>
            <span>HỢP TÁC XÃ</span>
          </div>
        </div>
        <div className="workspace-label">
          <span className="workspace-icon">
            <Landmark size={18} />
          </span>
          <div>
            <strong>Kế toán doanh nghiệp</strong>
            <small>Không gian làm việc</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-section-label">CÔNG NỢ PHẢI THU</div>
        <nav aria-label="Nghiệp vụ công nợ">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => go(item.id)}
            >
              <item.icon size={20} strokeWidth={1.8} />
              <span>{item.label}</span>
              {page === item.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="safe-note">
            <span className="safe-note-icon">
              <ShieldCheck size={20} />
            </span>
            <strong>Không gian minh họa</strong>
            <p>Dữ liệu giả lập phục vụ học tập và rà soát nghiệp vụ</p>
            <button onClick={() => setHelp(true)}>
              Tìm hiểu thêm <ChevronRight size={14} />
            </button>
          </div>
          <button className="sidebar-help" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            Hướng dẫn sử dụng
            <ChevronRight size={14} />
          </button>
          <div className="sidebar-version">
            <span>Hoa Lợi · Công nợ phải thu</span>
            <span>v0.1</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-toggle"
              aria-label="Mở menu"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu size={20} />
            </button>
            <span>Công nợ phải thu</span>
            <ChevronRight size={14} />
            <strong>{active.label}</strong>
          </div>
          <div className="header-right">
            <span className="prototype-tag">
              <span />
              Prototype - Dữ liệu minh họa
            </span>
            <div className="header-divider" />
            <div className="user-avatar">KT</div>
            <div className="user-info">
              <strong>Kế toán công nợ</strong>
              <small>Tài khoản demo</small>
            </div>
          </div>
        </header>
        <div className="context-bar">
          <div>
            <span className="context-dot" />
            <span>Nghiệp vụ kế toán</span>
          </div>
          <button onClick={() => setDemo(true)}>
            <FlaskConical size={15} />
            Chế độ demo
            <ChevronRight size={13} />
          </button>
        </div>
        <main>
          <div key={`increase-${s.sessionId}`} hidden={page !== "increase"}>
            <Increase s={s} notify={notify} />
          </div>
          <div key={`reduction-${s.sessionId}`} hidden={page !== "reduction"}>
            <Reduction s={s} notify={notify} />
          </div>
          <div key={`reconcile-${s.sessionId}`} hidden={page !== "reconcile"}>
            <Reconcile s={s} notify={notify} />
          </div>
          <div
            key={`notifications-${s.sessionId}`}
            hidden={page !== "notifications"}
          >
            <Notifications s={s} notify={notify} />
          </div>
          <div key={`reports-${s.sessionId}`} hidden={page !== "reports"}>
            <Reports s={s} notify={notify} />
          </div>
        </main>
        <footer className="app-footer">
          <span>
            HTX Hoa Lợi <span className="footer-dot">·</span> Hệ thống công nợ
            phải thu
          </span>
          <span>
            <ShieldCheck size={13} />
            Dữ liệu minh họa, không kết nối hệ thống thực tế
          </span>
        </footer>
      </div>
      {demo && <Demo s={s} onClose={() => setDemo(false)} notify={notify} />}
      {toast && (
        <div className="toast-container">
          <Alert tone={toast.tone}>{toast.text}</Alert>
          <button aria-label="Đóng thông báo" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
      {help && (
        <Modal
          wide
          title="Hướng dẫn sử dụng prototype"
          onClose={() => setHelp(false)}
        >
          <Alert>
            Prototype - Dữ liệu minh họa. Không phải dữ liệu, quy trình thuế
            hoặc xác nhận thực tế của HTX Hoa Lợi
          </Alert>
          <div className="help-steps">
            {navigation.map((n, i) => (
              <div key={n.id}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{n.label}</h3>
                  <p>
                    {
                      [
                        "Chọn chứng từ nguồn, kiểm tra hồ sơ và xác nhận một lần. Có thể tiếp tục sau lỗi lưu dở với bút toán đã giữ",
                        "Chọn khoản thanh toán, trả hàng hoặc giảm giá. Ghi giảm trọn gói, phân bổ sau không tạo bút toán",
                        "Lập bảng và nhập phản hồi khách hàng, nạp fixture tệp, kiểm tra chéo báo cáo. Không tự sửa số dư",
                        "Chọn một khách và khoản nợ, xem trước và mô phỏng gửi. Quét nhắc nợ tại ngăn demo, duyệt trước gửi",
                        "Chọn nhóm và mẫu, nhập tham số và Xem báo cáo. Xuất Excel thật hoặc in và lưu PDF bằng trình duyệt",
                      ][i]
                    }
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p>
            Ngày demo hiện tại: {date(s.clock)}. Mọi thay đổi lưu tại trình
            duyệt bằng localStorage có phiên bản. Dùng Chế độ demo để khôi phục
            dữ liệu hoặc nạp ca thử cô lập
          </p>
        </Modal>
      )}
    </div>
  )
}
