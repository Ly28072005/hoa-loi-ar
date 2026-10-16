import { useState } from "react"
import { FlaskConical, Play, RotateCcw, X } from "lucide-react"
import {
  date,
  initialState,
  replaceState,
  scan,
  seed,
  updateState,
  type RecordData,
} from "./store"
import { runScenario } from "./scenarios"
import { Alert, Badge, Button, Card, Field, Modal, Table } from "./ui"

const faultGroups = [
  {
    name: "Kiểm tra nguồn - Ghi tăng / Ghi giảm",
    items: [
      ["locked", "Kỳ kế toán đã khóa"],
      ["cancelled", "Nguồn hoặc hóa đơn đã hủy"],
      ["duplicate", "Nguồn bị ghi nhận trùng"],
      ["wrongCustomer", "Khách hàng không khớp"],
      ["missing", "Thiếu hồ sơ căn cứ"],
      ["changed", "Dữ liệu đổi sau khi hiển thị"],
    ],
  },
  {
    name: "Ghi nhận công nợ phát sinh",
    items: [
      ["posting", "Hạch toán lỗi trước khi tạo bút toán"],
      ["partialSave", "Lưu dở sau khi đã tạo bút toán"],
    ],
  },
  {
    name: "Ghi nhận giảm công nợ",
    items: [["reduction", "Ghi sổ lỗi - hoàn tác trọn gói"]],
  },
  {
    name: "Đối chiếu công nợ",
    items: [
      ["reconcileRead", "Không truy xuất được dữ liệu đối chiếu"],
      ["fileRead", "Lỗi đọc tệp mô phỏng"],
      ["reconcileSave", "Lỗi lưu kết quả đối chiếu"],
    ],
  },
  {
    name: "Thông báo và báo cáo",
    items: [
      ["fileCreate", "Lỗi tạo tệp hoặc bản in"],
      ["ruleSave", "Lỗi lưu / sửa / xóa quy tắc"],
      ["sendPartial", "Gửi tin lỗi một phần"],
      ["reportRead", "Lỗi truy xuất báo cáo"],
      ["reportProcess", "Lỗi tổng hợp báo cáo"],
    ],
  },
]
export default function Demo({ s, onClose, notify }: any) {
  const [resetConfirm, setResetConfirm] = useState(false)
  const [clock, setClock] = useState(s.clock)
  const [buckets, setBuckets] = useState(
    s.configuration.agingBuckets?.join(", ") || "",
  )
  const [warningDays, setWarningDays] = useState(
    s.configuration.earlyWarningDays ?? "",
  )
  const [severityDays, setSeverityDays] = useState(
    s.configuration.severityThresholds?.join(", ") || "",
  )
  const [results, setResults] = useState<RecordData[]>([])
  const [error, setError] = useState("")
  const [scenario, setScenario] = useState("")
  const runAll = () => {
    const results = seed.testScenarios.map((t: RecordData) => {
      try {
        const r = runScenario(t.id)
        return { id: t.id, ...r, state: undefined }
      } catch (e) {
        return { id: t.id, status: "Lỗi", explanation: (e as Error).message }
      }
    })
    setResults(results)
  }
  const apply = () => {
    try {
      if (!clock || clock < seed.meta.demoClock)
        throw new Error("Ngày demo không được trước 15/10/2026")
      const parsed: number[] | null = buckets.trim()
        ? buckets.split(",").map((x: string) => Number(x.trim()))
        : null
      if (
        parsed &&
        parsed.some(
          (n, i) =>
            !Number.isInteger(n) || n <= 0 || (i > 0 && n <= parsed[i - 1]),
        )
      )
        throw new Error(
          "Ngưỡng tuổi nợ phải là các số nguyên dương tăng dần, phân cách bằng dấu phẩy",
        )
      if (
        warningDays !== "" &&
        (!Number.isInteger(Number(warningDays)) || Number(warningDays) < 0)
      )
        throw new Error("Ngưỡng cảnh báo phải là số nguyên không âm")
      const severityValues: number[] | null = severityDays.trim()
        ? severityDays.split(",").map((n: string) => Number(n.trim()))
        : null
      if (
        severityValues &&
        (severityValues.length !== 2 ||
          severityValues.some(
            (n, i) =>
              !Number.isInteger(n) ||
              n < 0 ||
              (i > 0 && n <= severityValues[i - 1]),
          ))
      )
        throw new Error(
          "Nhập hai ngưỡng Cảnh báo và Nghiêm trọng tăng dần, là số nguyên không âm",
        )
      updateState((d) => {
        d.clock = clock
        d.configuration.agingBuckets = parsed
        d.configuration.earlyWarningDays =
          warningDays === "" ? null : Number(warningDays)
        d.configuration.severityThresholds = severityValues
      })
      setError("")
      notify(
        "Đã lưu cấu hình thử nghiệm, không phải quy định chính thức của HTX",
        "green",
      )
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const loadScenario = (id: string) => {
    setScenario(id)
    replaceState(initialState())
    notify(
      `Đã reset về dữ liệu nền cho ca ${id}. Thực hiện các bước trong hướng dẫn, chưa nạp kết quả kỳ vọng`,
      "blue",
    )
  }
  return (
    <>
      <div
        className="drawer-backdrop"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <aside className="demo-drawer" aria-label="Chế độ demo">
          <div className="drawer-heading">
            <div>
              <span className="eyebrow">MÔI TRƯỜNG THỬ NGHIỆM</span>
              <h2>
                <FlaskConical size={21} />
                Chế độ demo
              </h2>
            </div>
            <button aria-label="Đóng chế độ demo" onClick={onClose}>
              <X size={21} />
            </button>
          </div>
          <div className="drawer-content">
            <Alert tone="amber">
              Tất cả dữ liệu là mock. Gửi tin, lịch quét và tích hợp chỉ mô
              phỏng, không sử dụng thông tin thực tế của HTX
            </Alert>
            <Card title="Dữ liệu thử nghiệm">
              <p className="small muted">
                Store dùng chung · localStorage có phiên bản · Schema{" "}
                {s.schemaVersion}
              </p>
              <ValuesSummary s={s} />
              <Button icon={RotateCcw} onClick={() => setResetConfirm(true)}>
                Reset toàn bộ dữ liệu
              </Button>
            </Card>
            <Card title="Ngày demo và cấu hình thử">
              <Field label="Ngày demo">
                <input
                  type="date"
                  value={clock}
                  onChange={(e) => setClock(e.target.value)}
                />
              </Field>
              <Field
                label="Ngưỡng nhóm tuổi nợ (ngày)"
                hint="Để trống khi chưa cấu hình, các số tăng dần cách nhau bằng dấu phẩy"
              >
                <input
                  value={buckets}
                  onChange={(e) => setBuckets(e.target.value)}
                  placeholder="Nhập các ngưỡng để thử nghiệm"
                />
              </Field>
              <Field label="Cảnh báo trước hạn (ngày)">
                <input
                  type="number"
                  min="0"
                  value={warningDays}
                  onChange={(e) => setWarningDays(e.target.value)}
                  placeholder="Chưa cấu hình"
                />
              </Field>
              <Field
                label="Ngưỡng mức độ quá hạn (ngày)"
                hint="Hai số Cảnh báo, Nghiêm trọng. Để trống khi chưa cấu hình"
              >
                <input
                  value={severityDays}
                  onChange={(e) => setSeverityDays(e.target.value)}
                  placeholder="Nhập hai ngưỡng để thử nghiệm"
                />
              </Field>
              {error && <Alert tone="red">{error}</Alert>}
              <Button primary onClick={apply}>
                Áp dụng cấu hình demo
              </Button>
            </Card>
            <Card title="Quét nhắc nợ mô phỏng">
              <p className="small muted">
                Ngày quét: {date(s.clock)}. Chỉ tạo bản Chờ duyệt theo quy tắc
                đang kích hoạt, không gửi ra ngoài
              </p>
              <Button
                icon={Play}
                onClick={() => {
                  const next = scan(s)
                  const count = next.queue.length - s.queue.length
                  replaceState(next)
                  notify(
                    `Quét mô phỏng hoàn tất: ${count} thông báo mới đang chờ duyệt`,
                    "green",
                  )
                }}
              >
                Chạy quét mẫu
              </Button>
            </Card>
            <Card title="Nạp ca thử cô lập">
              <p className="small muted">
                Mỗi ca khôi phục đúng dữ liệu ban đầu, không nạp số dư kết quả
                kỳ vọng
              </p>
              <div className="scenario-list">
                {seed.testScenarios.map((t: RecordData) => (
                  <button
                    key={t.id}
                    onClick={() => loadScenario(t.id)}
                    className={scenario === t.id ? "active" : ""}
                  >
                    <strong>{t.id}</strong>
                    <span>{t.steps[0]}</span>
                  </button>
                ))}
              </div>
              {scenario && (
                <Alert>
                  <strong>{scenario}</strong>
                  <ol>
                    {seed.testScenarios
                      .find((t: RecordData) => t.id === scenario)
                      .steps.map((step: string) => (
                        <li key={step}>{step}</li>
                      ))}
                  </ol>
                </Alert>
              )}
            </Card>
            <Card title="Công tắc thử lỗi">
              {faultGroups.map((g) => (
                <div className="fault-group" key={g.name}>
                  <h3>{g.name}</h3>
                  {g.items.map(([key, label]) => (
                    <label key={key} className="toggle-label">
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={!!s.faults[key]}
                        onChange={(e) =>
                          updateState((d) => {
                            d.faults[key] = e.target.checked
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              ))}
            </Card>
            <Card title="Kiểm tra logic từ JSON">
              <p className="small muted">
                Chạy trên bản sao cô lập, không đổi dữ liệu đang dùng. Không
                thay thế kiểm thử tương tác trên trình duyệt
              </p>
              <Button icon={Play} primary onClick={runAll}>
                Chạy các kiểm tra logic
              </Button>
              {results.map((r) => (
                <div className="test-result" key={r.id}>
                  <strong>{r.id}</strong>
                  <Badge
                    tone={
                      r.status.startsWith("Đạt")
                        ? "green"
                        : r.status === "Lỗi"
                          ? "red"
                          : "amber"
                    }
                  >
                    {r.status}
                  </Badge>
                  <p>{r.explanation}</p>
                </div>
              ))}
            </Card>
          </div>
          <div className="drawer-footer">
            <Button onClick={onClose}>Đóng chế độ demo</Button>
          </div>
        </aside>
      </div>
      {resetConfirm && (
        <Modal
          title="Khôi phục toàn bộ dữ liệu ban đầu?"
          onClose={() => setResetConfirm(false)}
          footer={
            <>
              <Button onClick={() => setResetConfirm(false)}>Hủy</Button>
              <Button
                primary
                onClick={() => {
                  replaceState(initialState())
                  setResetConfirm(false)
                  setClock(seed.meta.demoClock)
                  setResults([])
                  setScenario("")
                  notify(
                    "Đã khôi phục bộ mock gốc, xóa mọi thao tác thử nghiệm",
                    "green",
                  )
                }}
              >
                Xác nhận reset
              </Button>
            </>
          }
        >
          <Alert tone="amber">
            Toàn bộ ghi nhận, phân bổ, đối chiếu, thông báo và cấu hình thử
            nghiệm sẽ trở về trạng thái ban đầu
          </Alert>
        </Modal>
      )}
    </>
  )
}
function ValuesSummary({ s }: any) {
  return (
    <div className="demo-counts">
      <span>{s.journals.length} bút toán</span>
      <span>{s.intakes.length} lần tiếp nhận</span>
      <span>{s.allocations.length} phân bổ mới</span>
    </div>
  )
}
