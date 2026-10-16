import { useEffect, useMemo, useState } from "react"
import { money } from "./money"
import {
  checkReports,
  closingBalance,
  externalRows,
  initialReconciliationState,
  reconcileFile,
  runInternal,
  totalDecrease,
  totalIncrease,
  type CustomerReconciliation,
  type FileResult,
  type InternalScenario,
  type ReconciliationState,
} from "./reconciliationModel"
import {
  ActionBar,
  Alert,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Field,
  FileField,
  Icon,
  PageHeading,
  Section,
  SelectField,
  StatCard,
  TextAreaField,
} from "./ui"

const STORAGE_KEY = "hoaloi-uc03-merged-v1"
type Screen = "overview" | "customer-list" | "customer-detail" | "file-upload" | "file-result" | "ar-check" | "internal-result" | "closing"
type Notice = {
  tone: "success" | "warning" | "error" | "info"
  title: string
  message: string
}

const tone = (status: string) =>
  status === "Khớp" ||
  status === "Nhất quán" ||
  status === "Đã cập nhật kết quả"
    ? "success"
    : status.includes("Chờ") ||
        status.includes("Đang") ||
        status === "Có chênh lệch"
      ? "warning"
      : status.includes("Lỗi") || status === "Không đủ điều kiện"
        ? "error"
        : "info"

function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")
    return value?.reconciliation
      ? value.reconciliation as ReconciliationState
      : initialReconciliationState()
  } catch {
    return initialReconciliationState()
  }
}

function Heading({ screen }: { screen: Screen }) {
  const content: Record<Screen, [string, string, string]> = {
    overview: [
      "Đối chiếu công nợ",
      "Hỗ trợ kế toán kiểm tra và xác minh số liệu công nợ",
      "Tổng quan",
    ],
    "customer-list": [
      "Đối chiếu công nợ với khách hàng",
      "Theo dõi các lần đối chiếu và phản hồi của khách hàng",
      "Khách hàng / Danh sách",
    ],
    "customer-detail": [
      "Chi tiết đối chiếu với khách hàng",
      "Kiểm tra giao dịch, tuổi nợ và ghi nhận phản hồi",
      "Khách hàng / Chi tiết",
    ],
    "file-upload": [
      "Tiếp nhận tệp đối chiếu bên ngoài",
      "Chọn tệp hoặc bộ dữ liệu mẫu và kiểm tra trước khi đối chiếu",
      "Tệp bên ngoài / Tiếp nhận",
    ],
    "file-result": [
      "Kết quả đối chiếu tệp bên ngoài",
      "So sánh ngày, số chứng từ, số tiền và số dư",
      "Tệp bên ngoài / Kết quả",
    ],
    "ar-check": [
      "Kiểm tra chéo báo cáo công nợ AR",
      "Xác minh bốn báo cáo cùng kỳ trước khi đối chiếu nội bộ",
      "Nội bộ / Kiểm tra chéo AR",
    ],
    "internal-result": [
      "Kết quả đối chiếu nội bộ Bán hàng - AR",
      "Theo dõi chênh lệch và yêu cầu xác minh",
      "Nội bộ / Kết quả",
    ],
    closing: [
      "Chốt sổ công nợ",
      "Kiểm tra điều kiện chốt sổ trong phạm vi prototype",
      "Đối chiếu / Chốt sổ",
    ],
  }
  return (
    <PageHeading
      title={content[screen][0]}
      description={content[screen][1]}
      breadcrumb={`Đối chiếu công nợ / ${content[screen][2]}`}
    />
  )
}

export default function Reconciliation() {
  const [data, setData] = useState(loadState)
  const [screen, setScreen] = useState<Screen>("overview")
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [customerFilter, setCustomerFilter] = useState("all")
  const [periodFilter, setPeriodFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [appliedFilters, setAppliedFilters] = useState(["all", "all", "all"])
  const [creating, setCreating] = useState(false)
  const [newCustomer, setNewCustomer] = useState("KH-008")
  const [newPeriod, setNewPeriod] = useState("10/2026")
  const [feedbackStatus, setFeedbackStatus] = useState("Chưa phản hồi")
  const [feedbackContent, setFeedbackContent] = useState("")
  const [verificationContent, setVerificationContent] = useState("")
  const [fileFilter, setFileFilter] = useState("all")
  const [selectedFileRow, setSelectedFileRow] = useState<number | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      const root = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          docs: Array.isArray(root) ? root : root?.docs,
          reconciliation: data,
        }),
      )
    } catch {
      /* Keep the in-memory prototype usable when storage is unavailable */
    }
  }, [data])

  const update = (
    recipe: (current: ReconciliationState) => ReconciliationState,
  ) => setData((current) => recipe(structuredClone(current)))
  const go = (next: Screen) => {
    setScreen(next)
    setNotice(null)
    window.scrollTo(0, 0)
  }
  const wait = async (action: () => void) => {
    if (busy) return
    setBusy(true)
    await new Promise((resolve) => setTimeout(resolve, 450))
    action()
    setBusy(false)
  }
  const selectedCustomer = data.customers.find(
    (record) => record.id === selectedCustomerId,
  )
  const visibleCustomers = useMemo(() => {
    const [customer, period, status] = appliedFilters
    return data.customers.filter(
      (record) =>
        (customer === "all" || record.customerId === customer) &&
        (period === "all" || record.period === period) &&
        (status === "all" || record.status === status),
    )
  }, [appliedFilters, data.customers])
  const latestRun = data.internal.runs.at(-1)
  const selectedResult = data.file.results.find(
    (row) => row.row === selectedFileRow,
  )
  const filteredResults = data.file.results.filter(
    (row) => fileFilter === "all" || row.status === fileFilter,
  )

  function openCustomer(record: CustomerReconciliation) {
    setSelectedCustomerId(record.id)
    setFeedbackStatus(record.feedback.status)
    setFeedbackContent(record.feedback.content)
    setVerificationContent(record.verification?.content || "")
    go("customer-detail")
  }

  function createCustomer() {
    if (
      data.customers.some(
        (record) =>
          record.customerId === newCustomer && record.period === newPeriod,
      )
    ) {
      setNotice({
        tone: "error",
        title: "Không thể tạo bản ghi trùng",
        message: "Khách hàng đã có bảng đối chiếu trong kỳ được chọn",
      })
      return
    }
    const id = `ĐC-KH-${String(data.customers.length + 1).padStart(3, "0")}`
    
    // Khai báo sẵn các số liệu mẫu cho giao dịch (có thể thay đổi số liệu tùy ý)
    const opening = 5000000;
    const increase = 10000000;
    const decrease = 4000000;
    const firstIncrease = Math.round(increase * 0.6);
    const closing = opening + increase - decrease;
    const overdue = Math.min(closing, Math.round(closing / 3));

    // Khởi tạo danh sách giao dịch đầy đủ thay vì chỉ có mỗi số dư đầu kỳ
    const transactions = [
      {
        date: `01/${newPeriod}`,
        id: `SDĐK-${id}`,
        note: "Số dư đầu kỳ",
        increase: 0,
        decrease: 0,
        balance: opening,
      },
      {
        date: `05/${newPeriod}`,
        id: `HD-${id}-01`,
        note: "Bán hàng trong kỳ",
        increase: firstIncrease,
        decrease: 0,
        balance: opening + firstIncrease,
      },
      {
        date: `10/${newPeriod}`,
        id: `PT-${id}`,
        note: "Khách hàng thanh toán",
        increase: 0,
        decrease,
        balance: opening + firstIncrease - decrease,
      },
      {
        date: `13/${newPeriod}`,
        id: `HD-${id}-02`,
        note: "Bán hàng trong kỳ",
        increase: increase - firstIncrease,
        decrease: 0,
        balance: closing,
      },
    ];

    const record: CustomerReconciliation = {
      id,
      customerId: newCustomer,
      customerName: `Khách hàng ${newCustomer.slice(-1)}`,
      address: `${Number(newCustomer.slice(-1))} Nguyễn Huệ, TP. Huế`,
      taxCode: `3300123${newCustomer.slice(-1)}`,
      period: newPeriod,
      createdAt: "13/10/2026",
      opening, // Gán số dư đầu kỳ mẫu
      status: "Đang xử lý",
      transactions, // Gắn danh sách giao dịch vừa tạo ở trên
      aging: [
        "Chưa có hạn thanh toán",
        "Chưa đến hạn",
        "Quá hạn 1-30 ngày",
        "Quá hạn 31-60 ngày",
        "Quá hạn 61-90 ngày",
        "Quá hạn 91-120 ngày",
        "Quá hạn trên 120 ngày",
      ].map((label, index) => ({
        label,
        // Phân bổ tuổi nợ mẫu để không bị giá trị null/0
        value: index === 1 ? closing - overdue : index === 2 ? overdue : 0,
      })),
      feedback: {
        status: "Chưa phản hồi",
        content: "",
        date: "",
        recorder: "",
      },
      tableCreated: true,
    }
    update((current) => ({
      ...current,
      customers: [record, ...current.customers],
    }))
    setCreating(false)
    openCustomer(record)
    setNotice({
      tone: "success",
      title: "Đã tạo đối chiếu",
      message: `${id} đã được tạo kèm dữ liệu giao dịch mẫu`,
    })
  }

  function saveFeedback() {
    if (feedbackStatus === "Chưa phản hồi" || !feedbackContent.trim()) {
      setNotice({
        tone: "error",
        title: "Thiếu thông tin phản hồi",
        message: "Chọn trạng thái phản hồi và nhập nội dung trước khi lưu",
      })
      return
    }
    update((current) => ({
      ...current,
      customers: current.customers.map((record) =>
        record.id === selectedCustomerId
          ? {
              ...record,
              status:
                feedbackStatus === "Đồng ý số liệu" ? "Khớp" : "Chờ xử lý",
              feedback: {
                status: feedbackStatus,
                content: feedbackContent.trim(),
                date: "13/10/2026",
                recorder: "Kế toán HTX Hoa Lợi",
              },
            }
          : record,
      ),
    }))
    setNotice({
      tone: "success",
      title: "Đã ghi nhận phản hồi",
      message:
        feedbackStatus === "Đồng ý số liệu"
          ? "Bản đối chiếu đã chuyển sang trạng thái Khớp"
          : "Bản đối chiếu đã chuyển sang Chờ xử lý",
    })
  }

  function transferCustomer() {
    if (!selectedCustomer || selectedCustomer.verification) {
      setNotice({
        tone: "info",
        title: "Yêu cầu đã tồn tại",
        message: selectedCustomer?.verification?.id || "Không tìm thấy bản ghi",
      })
      return
    }
    if (!verificationContent.trim()) {
      setNotice({
        tone: "error",
        title: "Thiếu nội dung xác minh",
        message: "Nhập nội dung cần xác minh trước khi chuyển xử lý",
      })
      return
    }
    update((current) => ({
      ...current,
      customers: current.customers.map((record) =>
        record.id === selectedCustomerId
          ? {
              ...record,
              status: "Chờ xử lý",
              verification: {
                id: `YCXM-${record.id}`,
                content: verificationContent.trim(),
                status: "Đang xác minh",
              },
            }
          : record,
      ),
    }))
    setNotice({
      tone: "success",
      title: "Đã tạo yêu cầu xác minh",
      message: `YCXM-${selectedCustomerId} đã được lưu, chứng từ nguồn không bị thay đổi`,
    })
  }

  function selectDemoFile() {
    if (!data.file.period) {
      setNotice({
        tone: "error",
        title: "Chưa chọn kỳ đối chiếu",
        message: "Chọn kỳ trước khi tiếp nhận tệp",
      })
      return
    }
    update((current) => ({
      ...current,
      file: {
        period: current.file.period,
        name: "doi-chieu-thang-10-demo.csv",
        type: "CSV - Dữ liệu mẫu",
        selectedAt: new Date().toLocaleString("vi-VN"),
        rows: externalRows,
        results: [],
      },
    }))
    setNotice({
      tone: "info",
      title: "Đang sử dụng dữ liệu mẫu",
      message:
        "Prototype không đọc nội dung tệp thật. Tám dòng mock đã được nạp để xem trước",
    })
  }

  function selectLocalFile(file?: File) {
    if (!data.file.period) {
      setNotice({
        tone: "error",
        title: "Chưa chọn kỳ đối chiếu",
        message: "Chọn kỳ trước khi tiếp nhận tệp",
      })
      return
    }
    if (!file) return
    const extension = file.name.split(".").pop()?.toLocaleLowerCase()
    if (!extension || !["csv", "xlsx", "xls", "pdf"].includes(extension)) {
      setNotice({
        tone: "error",
        title: "Loại tệp không được hỗ trợ",
        message: "Chọn tệp CSV, XLSX, XLS hoặc PDF",
      })
      return
    }
    update((current) => ({
      ...current,
      file: {
        period: current.file.period,
        name: file.name,
        type: `${extension.toLocaleUpperCase()} - Nội dung mô phỏng`,
        selectedAt: new Date().toLocaleString("vi-VN"),
        rows: externalRows,
        results: [],
      },
    }))
    setNotice({
      tone: "info",
      title: "Đã nhận thông tin tệp",
      message:
        "Prototype không đọc nội dung tệp thật. Dữ liệu xem trước dùng tám dòng mock tương ứng",
    })
  }

  async function confirmFile() {
    if (!data.file.period || !data.file.rows.length) {
      setNotice({
        tone: "error",
        title: "Chưa đủ dữ liệu",
        message: "Chọn kỳ và tệp demo trước khi xác nhận",
      })
      return
    }
    await wait(() => {
      const results = reconcileFile(data.file.rows)
      update((current) => ({ ...current, file: { ...current.file, results } }))
      go("file-result")
      setNotice({
        tone: "success",
        title: "Đối chiếu tệp hoàn tất",
        message: `${results.filter((row) => row.status === "Khớp").length}/${results.length} dòng khớp hoàn toàn`,
      })
    })
  }

  function transferFileRow(row: FileResult) {
    if (row.status === "Khớp") {
      setNotice({
        tone: "info",
        title: "Dòng đã khớp",
        message: "Không cần tạo yêu cầu xác minh cho dòng này",
      })
      return
    }
    if (row.requestId) {
      setNotice({
        tone: "info",
        title: "Yêu cầu đã tồn tại",
        message: row.requestId,
      })
      return
    }
    const requestId = `YC-TỆP-${String(row.row).padStart(3, "0")}`
    update((current) => ({
      ...current,
      file: {
        ...current.file,
        results: current.file.results.map((item) =>
          item.row === row.row ? { ...item, requestId } : item,
        ),
      },
    }))
    setNotice({
      tone: "success",
      title: "Đã tạo yêu cầu xác minh",
      message: `${requestId} đã lưu lý do: ${row.reason}`,
    })
  }

  async function crossCheck(runAfter = false) {
    if (!data.internal.period) {
      setNotice({
        tone: "error",
        title: "Chưa chọn kỳ",
        message: "Chọn kỳ đối chiếu trước khi kiểm tra bốn báo cáo",
      })
      return
    }
    await wait(() => {
      const cross = checkReports(data.internal.scenario)
      update((current) => {
        let next = { ...current, internal: { ...current.internal, cross } }
        if (runAfter && cross.status === "Nhất quán") {
          const run = runInternal(next.internal, cross)
          if (run)
            next = {
              ...next,
              internal: {
                ...next.internal,
                runs: [...next.internal.runs, run],
                selectedDifferenceIds: [],
              },
            }
        }
        return next
      })
      setNotice({
        tone:
          cross.status === "Nhất quán"
            ? "success"
            : cross.status === "Có chênh lệch"
              ? "warning"
              : "error",
        title:
          cross.status === "Nhất quán"
            ? "Bốn báo cáo AR nhất quán"
            : cross.status,
        message:
          cross.status === "Nhất quán"
            ? runAfter
              ? "Đối chiếu lại hoàn tất và đã lưu lịch sử"
              : "Có thể tiếp tục đối chiếu Bán hàng - AR"
            : "Kiểm tra chi tiết từng báo cáo và chạy lại sau khi dữ liệu được cập nhật",
      })
      if (runAfter && cross.status === "Nhất quán") {
        go("internal-result")
        setNotice({
          tone: "success",
          title: "Đối chiếu lại hoàn tất",
          message:
            "Đã kiểm tra lại bốn báo cáo AR và lưu một kết quả nội bộ mới",
        })
      }
    })
  }

  function startInternal() {
    const cross = data.internal.cross
    if (!cross || cross.status !== "Nhất quán") {
      setNotice({
        tone: "error",
        title: "Chưa đủ điều kiện tiếp tục",
        message: "Chạy kiểm tra và bảo đảm bốn báo cáo AR nhất quán",
      })
      return
    }
    const run = runInternal(data.internal, cross)
    if (!run) return
    update((current) => ({
      ...current,
      internal: {
        ...current.internal,
        runs: [...current.internal.runs, run],
        selectedDifferenceIds: [],
      },
    }))
    go("internal-result")
  }

  function toggleDifference(id: string) {
    update((current) => {
      const selected = current.internal.selectedDifferenceIds
      return {
        ...current,
        internal: {
          ...current.internal,
          selectedDifferenceIds: selected.includes(id)
            ? selected.filter((item) => item !== id)
            : [...selected, id],
        },
      }
    })
  }

  function notifySales() {
    const internal = data.internal
    if (
      !latestRun ||
      !internal.selectedDifferenceIds.length ||
      !internal.requestContent.trim()
    ) {
      setNotice({
        tone: "error",
        title: "Thiếu dữ liệu yêu cầu",
        message: "Chọn ít nhất một dòng và nhập nội dung yêu cầu xác minh",
      })
      return
    }
    const existingRows = new Set(
      internal.requests.flatMap((request) => request.rows),
    )
    const newRows = internal.selectedDifferenceIds.filter(
      (id) => !existingRows.has(id),
    )
    if (!newRows.length) {
      setNotice({
        tone: "info",
        title: "Các dòng đã được thông báo",
        message: "Không tạo thêm yêu cầu trùng",
      })
      return
    }
    const request = {
      id: `YC-BH-${String(internal.requests.length + 1).padStart(3, "0")}`,
      runId: latestRun.id,
      rows: newRows,
      content: internal.requestContent.trim(),
    }
    update((current) => ({
      ...current,
      internal: {
        ...current.internal,
        requests: [...current.internal.requests, request],
        runs: current.internal.runs.map((run) =>
          run.id === latestRun.id
            ? {
                ...run,
                differences: run.differences.map((row) =>
                  newRows.includes(row.id)
                    ? {
                        ...row,
                        notificationStatus: "Đã thông báo",
                        processingStatus: "Đang xác minh",
                      }
                    : row,
                ),
              }
            : run,
        ),
      },
    }))
    setNotice({
      tone: "success",
      title: "Đã tạo yêu cầu xác minh",
      message: `${request.id} chứa ${newRows.length} dòng chênh lệch. Các dòng chưa được đánh dấu đã xử lý`,
    })
  }

  function saveInternalVerification() {
    if (!data.internal.verificationContent.trim()) {
      setNotice({
        tone: "error",
        title: "Thiếu kết quả xác minh",
        message: "Nhập nội dung phản hồi từ Bán hàng trước khi lưu",
      })
      return
    }
    update((current) => ({
      ...current,
      internal: {
        ...current.internal,
        runs: current.internal.runs.map((run, index) =>
          index === current.internal.runs.length - 1
            ? {
                ...run,
                differences: run.differences.map((row) => ({
                  ...row,
                  processingStatus: current.internal.verificationStatus,
                })),
              }
            : run,
        ),
      },
    }))
    setNotice({
      tone: "success",
      title: "Đã cập nhật kết quả xác minh",
      message:
        "Kết quả đã lưu. Hãy chạy lại để tính một kết quả mới từ dữ liệu mock hiện tại",
    })
  }

  function closePeriod() {
    const rulesConfigured = data.internal.scenario !== "unconfigured"
    const eligible =
      rulesConfigured &&
      latestRun?.crossStatus === "Nhất quán" &&
      latestRun.differences.length === 0
    if (!eligible) {
      setNotice({
        tone: "error",
        title: "Không thể chốt sổ",
        message: !rulesConfigured
          ? "Prototype chưa cấu hình đầy đủ quy tắc chốt sổ"
          : "Dữ liệu chưa nhất quán hoặc còn chênh lệch chờ xử lý",
      })
      return
    }
    update((current) => ({
      ...current,
      closing: {
        period: latestRun.period,
        closed: true,
        closedAt: new Date().toLocaleString("vi-VN"),
      },
    }))
    setNotice({
      tone: "success",
      title: "Chốt sổ thành công trong chế độ demo",
      message:
        "Trạng thái chỉ được lưu trong prototype, không khóa dữ liệu kế toán thật",
    })
  }

  return (
    <>
      <Heading screen={screen} />
      {notice && (
        <Alert tone={notice.tone} title={notice.title}>
          {notice.message}
        </Alert>
      )}

      {screen === "overview" && (
        <div className="operation-grid">
          {[
            [
              "users",
              "Đối chiếu công nợ với khách hàng",
              "Lập bảng đối chiếu, gửi khách hàng, ghi nhận phản hồi và xử lý chênh lệch.",
              "customer-list",
            ],
            [
              "upload",
              "Đối chiếu từ tệp bên ngoài",
              "Tiếp nhận tệp, so sánh dữ liệu với hệ thống và xác định các dòng chênh lệch.",
              "file-upload",
            ],
            [
              "reconcile",
              "Đối chiếu nội bộ Bán hàng - AR",
              "Kiểm tra bốn báo cáo AR và so sánh dữ liệu giữa hai phân hệ.",
              "ar-check",
            ],
          ].map(([icon, title, description, target]) => (
            <section className="card operation-card" key={title}>
              <div className="operation-icon">
                <Icon name={icon} size={24} />
              </div>
              <div>
                <strong className="card-title">{title}</strong>
                <p>{description}</p>
              </div>
              <Button variant="primary" onClick={() => go(target as Screen)}>
                Mở nghiệp vụ <Icon name="arrow" size={16} />
              </Button>
            </section>
          ))}
        </div>
      )}

      {screen === "customer-list" && (
        <section className="card list-card">
          <div className="card-heading">
            <strong className="card-title">Danh sách đối chiếu</strong>
            <span className="count">{visibleCustomers.length}</span>
            <Button
              className="heading-action"
              variant="primary"
              onClick={() => setCreating(!creating)}
            >
              Tạo đối chiếu
            </Button>
          </div>
          {creating && (
            <div className="inline-form">
              <SelectField
                label="Khách hàng"
                value={newCustomer}
                onChange={(event) => setNewCustomer(event.target.value)}
              >
                <option>KH-007</option>
                <option>KH-008</option>
                <option>KH-009</option>
              </SelectField>
              <SelectField
                label="Kỳ đối chiếu"
                value={newPeriod}
                onChange={(event) => setNewPeriod(event.target.value)}
              >
                <option>10/2026</option>
                <option>11/2026</option>
              </SelectField>
              <Button onClick={() => setCreating(false)}>Hủy</Button>
              <Button variant="primary" onClick={createCustomer}>
                Tạo và mở chi tiết
              </Button>
            </div>
          )}
          <form
            className="filters"
            onSubmit={(event) => {
              event.preventDefault()
              setAppliedFilters([customerFilter, periodFilter, statusFilter])
            }}
          >
            <SelectField
              label="Khách hàng"
              value={customerFilter}
              onChange={(event) => setCustomerFilter(event.target.value)}
            >
              <option value="all">Tất cả khách hàng</option>
              {data.customers.map((record) => (
                <option value={record.customerId} key={record.customerId}>
                  {record.customerId} - {record.customerName}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Kỳ đối chiếu"
              value={periodFilter}
              onChange={(event) => setPeriodFilter(event.target.value)}
            >
              <option value="all">Tất cả các kỳ</option>
              <option>10/2026</option>
              <option>09/2026</option>
              <option>08/2026</option>
            </SelectField>
            <SelectField
              label="Trạng thái"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option>Đang xử lý</option>
              <option>Khớp</option>
              <option>Chờ xử lý</option>
            </SelectField>
            <Button type="submit" variant="primary">
              <Icon name="search" size={16} />
              Tìm kiếm
            </Button>
            <Button
              variant="link"
              onClick={() => {
                setCustomerFilter("all")
                setPeriodFilter("all")
                setStatusFilter("all")
                setAppliedFilters(["all", "all", "all"])
              }}
            >
              Xóa bộ lọc
            </Button>
          </form>
          {visibleCustomers.length ? (
            <DataTable label="Danh sách đối chiếu khách hàng">
              <thead>
                <tr>
                  <th>Mã đối chiếu</th>
                  <th>Khách hàng</th>
                  <th>Kỳ</th>
                  <th className="number">Đầu kỳ</th>
                  <th className="number">Tăng</th>
                  <th className="number">Giảm</th>
                  <th className="number">Cuối kỳ</th>
                  <th>Ngày lập</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visibleCustomers.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.id}</strong>
                    </td>
                    <td>
                      {record.customerId}
                      <span className="cell-sub">{record.customerName}</span>
                    </td>
                    <td>{record.period}</td>
                    <td className="number">{money(record.opening)}</td>
                    <td className="number">{money(totalIncrease(record))}</td>
                    <td className="number">{money(totalDecrease(record))}</td>
                    <td className="number amount">
                      {money(closingBalance(record))} VND
                    </td>
                    <td>{record.createdAt}</td>
                    <td>
                      <Badge tone={tone(record.status)}>{record.status}</Badge>
                    </td>
                    <td>
                      <Button
                        variant="link"
                        onClick={() => openCustomer(record)}
                      >
                        Xem chi tiết
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyState
              title="Không có dữ liệu phù hợp"
              description="Xóa bộ lọc hoặc thay đổi tiêu chí để tìm lại"
            >
              <Button
                onClick={() => {
                  setAppliedFilters(["all", "all", "all"])
                  setCustomerFilter("all")
                  setPeriodFilter("all")
                  setStatusFilter("all")
                }}
              >
                Xóa bộ lọc
              </Button>
            </EmptyState>
          )}
          <div className="table-bottom">
            <span>Hiển thị {visibleCustomers.length} bản ghi</span>
            <Button variant="link" onClick={() => go("overview")}>
              <Icon name="back" size={16} />
              Quay lại tổng quan
            </Button>
          </div>
        </section>
      )}

      {screen === "customer-detail" && selectedCustomer && (
        <>
          <Button
            className="back-link"
            variant="link"
            onClick={() => go("customer-list")}
          >
            <Icon name="back" size={16} />
            Quay lại danh sách
          </Button>
          <Section title="Thông tin chung">
            <dl className="fields fields-four">
              <Field label="Mã đối chiếu">{selectedCustomer.id}</Field>
              <Field label="Khách hàng">
                {selectedCustomer.customerId} - {selectedCustomer.customerName}
              </Field>
              <Field label="Địa chỉ">{selectedCustomer.address}</Field>
              <Field label="Mã số thuế">
                {selectedCustomer.taxCode || "Chưa có dữ liệu"}
              </Field>
              <Field label="Kỳ đối chiếu">{selectedCustomer.period}</Field>
              <Field label="Ngày lập">{selectedCustomer.createdAt}</Field>
              <Field label="Số dư đầu kỳ">
                {money(selectedCustomer.opening)} VND
              </Field>
              <Field label="Số dư cuối kỳ">
                {money(closingBalance(selectedCustomer))} VND
              </Field>
            </dl>
          </Section>
          <Section title="Chi tiết giao dịch">
            <DataTable label="Chi tiết giao dịch">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Số chứng từ</th>
                  <th>Diễn giải</th>
                  <th className="number">Phát sinh tăng</th>
                  <th className="number">Phát sinh giảm</th>
                  <th className="number">Số dư</th>
                </tr>
              </thead>
              <tbody>
                {selectedCustomer.transactions.map((row) => (
                  <tr key={row.id}>
                    <td>{row.date}</td>
                    <td>{row.id}</td>
                    <td>{row.note}</td>
                    <td className="number">
                      {row.increase ? `${money(row.increase)} VND` : "—"}
                    </td>
                    <td className="number">
                      {row.decrease ? `${money(row.decrease)} VND` : "—"}
                    </td>
                    <td className="number amount">{money(row.balance)} VND</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </Section>
          <Section title="Phân tích tuổi nợ">
            {selectedCustomer.aging.some((item) => item.value === null) ? (
              <Alert tone="warning" title="Chưa đủ dữ liệu phân loại tuổi nợ">
                Bản ghi mới chưa có hạn thanh toán và giao dịch chi tiết
              </Alert>
            ) : (
              <div className="aging-grid">
                {[
                  ...selectedCustomer.aging,
                  {
                    label: "Tổng cộng",
                    value: selectedCustomer.aging.reduce(
                      (sum, item) => sum + (item.value || 0),
                      0,
                    ),
                  },
                ].map((item) => (
                  <div className="aging-item" key={item.label}>
                    <span>{item.label}</span>
                    <strong>
                      {item.value === null
                        ? "Chưa đủ dữ liệu"
                        : `${money(item.value)} VND`}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </Section>
          <Section title="Phản hồi và xác minh" readonly={false}>
            <div className="form-grid">
              <SelectField
                label="Trạng thái phản hồi"
                value={feedbackStatus}
                onChange={(event) => setFeedbackStatus(event.target.value)}
              >
                <option>Chưa phản hồi</option>
                <option>Đồng ý số liệu</option>
                <option>Có chênh lệch</option>
                <option>Không đồng ý</option>
              </SelectField>
              <Field label="Ngày ghi nhận">
                {selectedCustomer.feedback.date || "Chưa ghi nhận"}
              </Field>
              <TextAreaField
                label="Nội dung phản hồi"
                value={feedbackContent}
                onChange={(event) => setFeedbackContent(event.target.value)}
                placeholder="Nhập nội dung khách hàng phản hồi"
              />
              <TextAreaField
                label="Nội dung yêu cầu xác minh"
                value={verificationContent}
                onChange={(event) => setVerificationContent(event.target.value)}
                placeholder="Nêu rõ đối tượng và nội dung cần xác minh"
              />
              <Field label="Người ghi nhận">
                {selectedCustomer.feedback.recorder || "Chưa ghi nhận"}
              </Field>
              <Field label="Yêu cầu xác minh">
                {selectedCustomer.verification
                  ? `${selectedCustomer.verification.id} - ${selectedCustomer.verification.status}`
                  : "Chưa tạo"}
              </Field>
            </div>
          </Section>
          <ActionBar hint="Các thao tác không sửa chứng từ nguồn hoặc tự điều chỉnh công nợ">
            <Button onClick={() => go("customer-list")}>
              Quay lại danh sách
            </Button>
            <Button
              onClick={() => {
                update((current) => ({
                  ...current,
                  customers: current.customers.map((record) =>
                    record.id === selectedCustomer.id
                      ? { ...record, tableCreated: true }
                      : record,
                  ),
                }))
                setNotice({
                  tone: "success",
                  title: "Đã lập bảng đối chiếu",
                  message: `Số dư cuối kỳ được tính từ ${selectedCustomer.transactions.length} giao dịch`,
                })
              }}
            >
              Lập bảng đối chiếu
            </Button>
            <Button
              disabled={!selectedCustomer.tableCreated}
              onClick={() => {
                const lines = [
                  "Ngày,Số chứng từ,Diễn giải,Phát sinh tăng,Phát sinh giảm,Số dư",
                  ...selectedCustomer.transactions.map((row) =>
                    [
                      row.date,
                      row.id,
                      row.note,
                      row.increase,
                      row.decrease,
                      row.balance,
                    ].join(","),
                  ),
                ]
                const url = URL.createObjectURL(
                  new Blob(["\ufeff" + lines.join("\n")], {
                    type: "text/csv;charset=utf-8",
                  }),
                )
                const link = document.createElement("a")
                link.href = url
                link.download = `${selectedCustomer.id}.csv`
                link.click()
                URL.revokeObjectURL(url)
                setNotice({
                  tone: "success",
                  title: "Đã tạo tệp tải xuống",
                  message: `${selectedCustomer.id}.csv chứa dữ liệu giao dịch hiện tại`,
                })
              }}
            >
              Tải xuống
            </Button>
            <Button onClick={saveFeedback}>Ghi nhận phản hồi</Button>
            <Button variant="primary" onClick={transferCustomer}>
              Chuyển xử lý
            </Button>
          </ActionBar>
        </>
      )}

      {screen === "file-upload" && (
        <>
          <Section title="Thông tin tệp đối chiếu" readonly={false}>
            <div className="upload-layout">
              <SelectField
                label="Kỳ đối chiếu"
                value={data.file.period}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    file: {
                      ...current.file,
                      period: event.target.value,
                      rows: [],
                      results: [],
                      name: "",
                      type: "",
                      selectedAt: "",
                    },
                  }))
                }
              >
                <option value="">Chọn kỳ đối chiếu</option>
                <option value="10/2026">Tháng 10/2026</option>
                <option value="09/2026">Tháng 09/2026</option>
              </SelectField>
              <div className="upload-zone">
                <Icon name="upload" size={28} />
                <strong>{data.file.name || "Chưa chọn tệp"}</strong>
                <span>
                  {data.file.name
                    ? "Dữ liệu xem trước là bộ mock tương ứng, không đọc nội dung tệp thật"
                    : "Chọn bộ CSV demo có tám tình huống đối chiếu"}
                </span>
                <FileField
                  label="Chọn tệp từ máy"
                  accept=".csv,.xlsx,.xls,.pdf"
                  disabled={!data.file.period}
                  onChange={(event) => selectLocalFile(event.target.files?.[0])}
                />
                <Button disabled={!data.file.period} onClick={selectDemoFile}>
                  {data.file.name ? "Nạp lại tệp demo" : "Chọn tệp demo"}
                </Button>
              </div>
            </div>
            {data.file.name && (
              <dl className="fields file-meta">
                <Field label="Tên tệp">{data.file.name}</Field>
                <Field label="Loại tệp">{data.file.type}</Field>
                <Field label="Thời điểm chọn">{data.file.selectedAt}</Field>
              </dl>
            )}
          </Section>
          <Section title="Xem trước dữ liệu">
            {data.file.rows.length ? (
              <DataTable label="Dữ liệu tệp xem trước">
                <thead>
                  <tr>
                    <th>Dòng</th>
                    <th>Ngày giao dịch</th>
                    <th>Số chứng từ</th>
                    <th>Diễn giải</th>
                    <th className="number">Số tiền</th>
                    <th className="number">Số dư</th>
                    <th>Kiểm tra</th>
                  </tr>
                </thead>
                <tbody>
                  {data.file.rows.map((row) => {
                    const valid =
                      !!row.date &&
                      !!row.id &&
                      row.amount !== null &&
                      row.balance !== null
                    return (
                      <tr key={row.row} className={!valid ? "invalid-row" : ""}>
                        <td>{row.row}</td>
                        <td>{row.date || "Thiếu dữ liệu"}</td>
                        <td>{row.id || "Thiếu dữ liệu"}</td>
                        <td>{row.note}</td>
                        <td className="number">
                          {row.amount === null
                            ? "Thiếu dữ liệu"
                            : `${money(row.amount)} VND`}
                        </td>
                        <td className="number">
                          {row.balance === null
                            ? "Thiếu dữ liệu"
                            : `${money(row.balance)} VND`}
                        </td>
                        <td>
                          <Badge tone={valid ? "success" : "error"}>
                            {valid ? "Đủ trường bắt buộc" : "Lỗi dữ liệu"}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </DataTable>
            ) : (
              <EmptyState
                title="Chưa có dữ liệu xem trước"
                description="Chọn kỳ và tệp demo để nạp dữ liệu mẫu"
              >
                <Button disabled={!data.file.period} onClick={selectDemoFile}>
                  Chọn tệp demo
                </Button>
              </EmptyState>
            )}
          </Section>
          <ActionBar hint="Dòng thiếu trường bắt buộc vẫn được báo lỗi, không được coi là Khớp">
            <Button onClick={() => go("overview")}>Quay lại</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!data.file.period || !data.file.rows.length}
              onClick={confirmFile}
            >
              {busy ? "Đang đối chiếu" : "Xác nhận dữ liệu"}
            </Button>
          </ActionBar>
        </>
      )}

      {screen === "file-result" && (
        <>
          <div className="stats reconciliation-stats">
            <StatCard
              icon="file"
              label="Tổng số dòng"
              value={data.file.results.length}
              unit="dòng"
            />
            <StatCard
              icon="check"
              label="Dòng khớp"
              value={
                data.file.results.filter((row) => row.status === "Khớp").length
              }
              unit="dòng"
            />
            <StatCard
              icon="clock"
              label="Chờ xử lý hoặc lỗi"
              value={
                data.file.results.filter((row) => row.status !== "Khớp").length
              }
              unit="dòng"
            />
          </div>
          <Section title="Thông tin xử lý">
            <dl className="fields fields-four">
              <Field label="Tên tệp">{data.file.name}</Field>
              <Field label="Kỳ đối chiếu">{data.file.period}</Field>
              <Field label="Thời điểm xử lý">{data.file.selectedAt}</Field>
              <Field label="Quy tắc">Chỉ khớp khi bốn trường phù hợp</Field>
            </dl>
          </Section>
          <section className="card list-card">
            <div className="filters compact-filter">
              <SelectField
                label="Trạng thái"
                value={fileFilter}
                onChange={(event) => setFileFilter(event.target.value)}
              >
                <option value="all">Tất cả</option>
                <option>Khớp</option>
                <option>Chờ xử lý</option>
                <option>Lỗi dữ liệu</option>
              </SelectField>
            </div>
            {filteredResults.length ? (
              <DataTable label="Kết quả đối chiếu tệp">
                <thead>
                  <tr>
                    <th>Dòng</th>
                    <th>Ngày tệp / hệ thống</th>
                    <th>Chứng từ tệp / hệ thống</th>
                    <th className="number">Số tiền tệp / hệ thống</th>
                    <th className="number">Số dư tệp / hệ thống</th>
                    <th>Trạng thái</th>
                    <th>Lý do</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((row) => (
                    <tr key={row.row}>
                      <td>{row.row}</td>
                      <td>
                        {row.date || "Thiếu"}
                        <span className="cell-sub">
                          {row.system?.date || "Không có"}
                        </span>
                      </td>
                      <td>
                        {row.id || "Thiếu"}
                        <span className="cell-sub">
                          {row.system?.id || "Không có"}
                        </span>
                      </td>
                      <td className="number">
                        {row.amount === null ? "Thiếu" : money(row.amount)}
                        <span className="cell-sub">
                          {row.system
                            ? `${money(row.system.amount)} VND`
                            : "Không có"}
                        </span>
                      </td>
                      <td className="number">
                        {row.balance === null ? "Thiếu" : money(row.balance)}
                        <span className="cell-sub">
                          {row.system
                            ? `${money(row.system.balance)} VND`
                            : "Không có"}
                        </span>
                      </td>
                      <td>
                        <Badge tone={tone(row.status)}>{row.status}</Badge>
                      </td>
                      <td>{row.reason || "Khớp đủ bốn trường"}</td>
                      <td>
                        <Button
                          variant="link"
                          onClick={() => setSelectedFileRow(row.row)}
                        >
                          Xem chi tiết
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <EmptyState
                title="Không có kết quả phù hợp"
                description="Đổi bộ lọc trạng thái để xem các dòng khác"
              >
                <Button onClick={() => setFileFilter("all")}>Xóa bộ lọc</Button>
              </EmptyState>
            )}
          </section>
          {selectedResult && (
            <Section title={`Chi tiết dòng ${selectedResult.row}`}>
              <dl className="fields fields-four">
                <Field label="Giá trị từ tệp">
                  {selectedResult.date || "Thiếu ngày"} -{" "}
                  {selectedResult.id || "Thiếu số chứng từ"} -{" "}
                  {selectedResult.amount === null
                    ? "Thiếu số tiền"
                    : `${money(selectedResult.amount)} VND`}
                </Field>
                <Field label="Giá trị hệ thống">
                  {selectedResult.system
                    ? `${selectedResult.system.date} - ${selectedResult.system.id} - ${money(selectedResult.system.amount)} VND`
                    : "Không tìm thấy"}
                </Field>
                <Field label="Nguyên nhân">
                  {selectedResult.reason || "Không có chênh lệch"}
                </Field>
                <Field label="Yêu cầu xác minh">
                  {selectedResult.requestId || "Chưa tạo"}
                </Field>
              </dl>
              <div className="section-actions">
                <Button onClick={() => setSelectedFileRow(null)}>
                  Đóng chi tiết
                </Button>
                <Button
                  variant="primary"
                  disabled={selectedResult.status === "Khớp"}
                  onClick={() => transferFileRow(selectedResult)}
                >
                  Chuyển xử lý
                </Button>
              </div>
            </Section>
          )}
          <ActionBar hint="Kết quả không tự ghi nhận thanh toán hoặc điều chỉnh công nợ">
            <Button onClick={() => go("file-upload")}>Quay lại tệp</Button>
            <Button onClick={() => go("overview")}>Về tổng quan</Button>
          </ActionBar>
        </>
      )}

      {screen === "ar-check" && (
        <>
          <Section title="Phạm vi và tình huống kiểm tra" readonly={false}>
            <div className="check-toolbar">
              <SelectField
                label="Kỳ đối chiếu"
                value={data.internal.period}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    internal: {
                      ...current.internal,
                      period: event.target.value,
                      cross: null,
                    },
                  }))
                }
              >
                <option value="">Chọn kỳ</option>
                <option value="10/2026">Tháng 10/2026</option>
                <option value="09/2026">Tháng 09/2026</option>
              </SelectField>
              <SelectField
                label="Tình huống demo"
                value={data.internal.scenario}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    internal: {
                      ...current.internal,
                      scenario: event.target.value as InternalScenario,
                      cross: null,
                    },
                  }))
                }
              >
                <option value="difference">
                  AR nhất quán - Bán hàng có chênh lệch
                </option>
                <option value="match">Khớp hoàn toàn</option>
                <option value="ar-difference">
                  Bốn báo cáo AR có chênh lệch
                </option>
                <option value="missing">Thiếu dữ liệu báo cáo AR</option>
                <option value="unconfigured">
                  Khớp - Chưa cấu hình quy tắc chốt
                </option>
              </SelectField>
              <Button
                variant="primary"
                loading={busy}
                disabled={!data.internal.period}
                onClick={() => crossCheck(false)}
              >
                {busy ? "Đang kiểm tra" : "Kiểm tra đối chiếu"}
              </Button>
            </div>
          </Section>
          <div className="report-grid">
            {(
              data.internal.cross?.reports ||
              [
                "Công nợ theo khách hàng",
                "Công nợ theo hóa đơn",
                "Công nợ theo mặt hàng",
                "Công nợ theo tuổi nợ",
              ].map((name) => ({
                name,
                total: null,
                status: "Chưa đủ dữ liệu" as const,
                difference: null,
              }))
            ).map((report, index) => (
              <section className="card report-card" key={report.name}>
                <span>BÁO CÁO {index + 1}</span>
                <strong className="card-title">{report.name}</strong>
                <div>
                  <small>Tổng số dư cuối kỳ</small>
                  <strong>
                    {report.total === null
                      ? "Chưa có dữ liệu"
                      : `${money(report.total)} VND`}
                  </strong>
                </div>
                <Badge tone={tone(report.status)}>{report.status}</Badge>
                {report.difference !== null && report.difference !== 0 && (
                  <p className="section-note">
                    Chênh lệch {money(Math.abs(report.difference))} VND so với
                    báo cáo khách hàng
                  </p>
                )}
              </section>
            ))}
          </div>
          {data.internal.cross ? (
            <Alert
              tone={
                data.internal.cross.status === "Nhất quán"
                  ? "success"
                  : data.internal.cross.status === "Có chênh lệch"
                    ? "warning"
                    : "error"
              }
              title={data.internal.cross.status}
            >
              {data.internal.cross.status === "Nhất quán"
                ? "Cùng kỳ, cùng phạm vi và tổng số dư phù hợp"
                : "Không thể tiếp tục. Cập nhật tình huống dữ liệu và chạy kiểm tra lại"}
            </Alert>
          ) : (
            <Alert tone="info" title="Chưa đủ dữ liệu để kết luận">
              Chọn kỳ và chạy kiểm tra bốn báo cáo
            </Alert>
          )}
          <ActionBar hint="Thay đổi kỳ hoặc tình huống sẽ yêu cầu kiểm tra lại">
            <Button onClick={() => go("overview")}>Quay lại</Button>
            <Button
              variant="primary"
              disabled={data.internal.cross?.status !== "Nhất quán"}
              onClick={startInternal}
            >
              Tiếp tục đối chiếu nội bộ
            </Button>
          </ActionBar>
        </>
      )}

      {screen === "internal-result" && latestRun && (
        <>
          <Section title="Tổng quan lần đối chiếu">
            <dl className="fields fields-four">
              <Field label="Mã lần chạy">{latestRun.id}</Field>
              <Field label="Kỳ đối chiếu">{latestRun.period}</Field>
              <Field label="Thời điểm chạy">{latestRun.runAt}</Field>
              <Field label="Kiểm tra chéo AR">
                <Badge tone={tone(latestRun.crossStatus)}>
                  {latestRun.crossStatus}
                </Badge>
              </Field>
            </dl>
          </Section>
          <div className="comparison-grid">
            <section className="card comparison-card">
              <span>PHÉP SO SÁNH 1</span>
              <strong className="card-title">
                Hóa đơn/giao hàng với phát sinh tăng AR
              </strong>
              <dl>
                <Field label="Bán hàng">
                  {money(latestRun.salesIncrease)} VND
                </Field>
                <Field label="AR">{money(latestRun.arIncrease)} VND</Field>
              </dl>
              <Badge
                tone={
                  latestRun.salesIncrease === latestRun.arIncrease
                    ? "success"
                    : "warning"
                }
              >
                {latestRun.salesIncrease === latestRun.arIncrease
                  ? "Khớp"
                  : `Chênh lệch ${money(Math.abs(latestRun.salesIncrease - latestRun.arIncrease))} VND`}
              </Badge>
            </section>
            <section className="card comparison-card">
              <span>PHÉP SO SÁNH 2</span>
              <strong className="card-title">
                Giấy báo Có với phát sinh giảm AR
              </strong>
              <dl>
                <Field label="Bán hàng">
                  {money(latestRun.salesDecrease)} VND
                </Field>
                <Field label="AR">{money(latestRun.arDecrease)} VND</Field>
              </dl>
              <Badge
                tone={
                  latestRun.salesDecrease === latestRun.arDecrease
                    ? "success"
                    : "warning"
                }
              >
                {latestRun.salesDecrease === latestRun.arDecrease
                  ? "Khớp"
                  : `Chênh lệch ${money(Math.abs(latestRun.salesDecrease - latestRun.arDecrease))} VND`}
              </Badge>
            </section>
          </div>
          <Section title="Danh sách chênh lệch">
            {latestRun.differences.length ? (
              <DataTable label="Chênh lệch Bán hàng và AR">
                <thead>
                  <tr>
                    <th>Chọn</th>
                    <th>Loại</th>
                    <th>Mã chứng từ</th>
                    <th>Khách hàng</th>
                    <th>Ngày</th>
                    <th className="number">Bán hàng</th>
                    <th className="number">AR</th>
                    <th className="number">Chênh lệch</th>
                    <th>Lý do</th>
                    <th>Thông báo</th>
                    <th>Xử lý</th>
                  </tr>
                </thead>
                <tbody>
                  {latestRun.differences.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Button
                          variant={
                            data.internal.selectedDifferenceIds.includes(row.id)
                              ? "primary"
                              : "secondary"
                          }
                          onClick={() => toggleDifference(row.id)}
                        >
                          {data.internal.selectedDifferenceIds.includes(row.id)
                            ? "Đã chọn"
                            : "Chọn"}
                        </Button>
                      </td>
                      <td>{row.type}</td>
                      <td>{row.documentId}</td>
                      <td>{row.customer}</td>
                      <td>{row.date}</td>
                      <td className="number">{money(row.sales)}</td>
                      <td className="number">{money(row.ar)}</td>
                      <td className="number amount">
                        {money(Math.abs(row.sales - row.ar))} VND
                      </td>
                      <td>{row.reason}</td>
                      <td>
                        <Badge tone={tone(row.notificationStatus)}>
                          {row.notificationStatus}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={tone(row.processingStatus)}>
                          {row.processingStatus}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <Alert tone="success" title="Không có chênh lệch">
                Hai phép so sánh đều khớp theo dữ liệu mock hiện tại
              </Alert>
            )}
          </Section>
          {latestRun.differences.length > 0 && (
            <Section title="Thông báo và kết quả xác minh" readonly={false}>
              <div className="form-grid">
                <TextAreaField
                  label="Nội dung yêu cầu Bán hàng"
                  value={data.internal.requestContent}
                  onChange={(event) =>
                    update((current) => ({
                      ...current,
                      internal: {
                        ...current.internal,
                        requestContent: event.target.value,
                      },
                    }))
                  }
                  placeholder="Nêu nội dung cần Bán hàng xác minh"
                />
                <SelectField
                  label="Trạng thái kết quả xác minh"
                  value={data.internal.verificationStatus}
                  onChange={(event) =>
                    update((current) => ({
                      ...current,
                      internal: {
                        ...current.internal,
                        verificationStatus: event.target.value,
                      },
                    }))
                  }
                >
                  <option>Đang xác minh</option>
                  <option>Đã cập nhật kết quả</option>
                </SelectField>
                <TextAreaField
                  label="Phản hồi hoặc kết quả từ Bán hàng"
                  value={data.internal.verificationContent}
                  onChange={(event) =>
                    update((current) => ({
                      ...current,
                      internal: {
                        ...current.internal,
                        verificationContent: event.target.value,
                      },
                    }))
                  }
                  placeholder="Nhập kết quả xác minh"
                />
              </div>
              <div className="section-actions">
                <Button variant="primary" onClick={notifySales}>
                  Thông báo Bán hàng
                </Button>
                <Button onClick={saveInternalVerification}>
                  Lưu kết quả xác minh
                </Button>
              </div>
            </Section>
          )}
          <Section title="Lịch sử đối chiếu">
            <DataTable label="Lịch sử chạy đối chiếu">
              <thead>
                <tr>
                  <th>Lần chạy</th>
                  <th>Thời điểm</th>
                  <th>Kết quả AR</th>
                  <th>Chênh lệch</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {data.internal.runs.map((run) => (
                  <tr key={run.id}>
                    <td>{run.id}</td>
                    <td>{run.runAt}</td>
                    <td>{run.crossStatus}</td>
                    <td>{run.differences.length} dòng</td>
                    <td>{run.note}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </Section>
          <ActionBar hint="Chạy lại luôn kiểm tra bốn báo cáo AR trước khi so sánh Bán hàng - AR">
            <Button onClick={() => go("ar-check")}>Quay lại kiểm tra AR</Button>
            <Button loading={busy} onClick={() => crossCheck(true)}>
              {busy ? "Đang chạy lại" : "Chạy lại đối chiếu"}
            </Button>
            {latestRun.differences.length === 0 && (
              <Button variant="primary" onClick={() => go("closing")}>
                Chốt sổ công nợ
              </Button>
            )}
          </ActionBar>
        </>
      )}

      {screen === "closing" &&
        latestRun &&
        (() => {
          const configured = data.internal.scenario !== "unconfigured"
          const eligible =
            configured &&
            latestRun.crossStatus === "Nhất quán" &&
            latestRun.differences.length === 0
          return (
            <>
              <Section title="Điều kiện chốt sổ">
                <dl className="fields fields-four">
                  <Field label="Kỳ đối chiếu">{latestRun.period}</Field>
                  <Field label="Kết quả gần nhất">
                    {latestRun.id} -{" "}
                    {latestRun.differences.length
                      ? `${latestRun.differences.length} chênh lệch`
                      : "Khớp"}
                  </Field>
                  <Field label="Quy tắc demo">
                    {configured
                      ? "Đã cấu hình kiểm tra nhất quán và chênh lệch"
                      : "Chưa cấu hình đầy đủ"}
                  </Field>
                  <Field label="Trạng thái kỳ">
                    <Badge
                      tone={
                        data.closing.closed
                          ? "success"
                          : eligible
                            ? "info"
                            : "error"
                      }
                    >
                      {data.closing.closed
                        ? "Đã chốt demo"
                        : eligible
                          ? "Đủ điều kiện demo"
                          : "Không đủ điều kiện"}
                    </Badge>
                  </Field>
                </dl>
              </Section>
              {data.closing.closed ? (
                <Alert tone="success" title="Kỳ đã được chốt trong chế độ demo">
                  Thời điểm {data.closing.closedAt}. Không có dữ liệu kế toán
                  thật bị khóa
                </Alert>
              ) : eligible ? (
                <Alert tone="info" title="Đủ điều kiện chốt sổ demo">
                  Kết quả gần nhất nhất quán và không còn chênh lệch chờ xử lý.
                  Prototype không xác nhận điều kiện pháp lý hoặc kế toán
                </Alert>
              ) : (
                <Alert tone="warning" title="Không thể chốt sổ">
                  {configured
                    ? "Còn chênh lệch hoặc dữ liệu chưa nhất quán"
                    : "Chưa có quy tắc nghiệp vụ chính thức được cấu hình đầy đủ"}
                </Alert>
              )}
              <ActionBar hint="Chốt sổ chỉ thay đổi trạng thái mock trong trình duyệt">
                <Button onClick={() => go("internal-result")}>
                  Quay lại kết quả
                </Button>
                {!data.closing.closed && eligible && (
                  <Button variant="primary" onClick={closePeriod}>
                    <Icon name="lock" size={16} />
                    Chốt sổ
                  </Button>
                )}
              </ActionBar>
            </>
          )
        })()}
    </>
  )
}
