import { useState } from "react"
import { Bell, Check, Eye, Plus, Send, Settings2, Trash2 } from "lucide-react"
import {
  balance,
  customer,
  date,
  debtRows,
  debtStatus,
  getState,
  money,
  noticeRows,
  outstanding,
  overdue,
  renderMessage,
  replaceState,
  seed,
  send,
  severity,
  sum,
  updateState,
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
  Modal,
  NoticePaper,
  noticeColumns,
  SearchBox,
  Select,
  Table,
  Tabs,
  Values,
} from "./ui"

const blankRule = () => ({
  id: "",
  name: "",
  daysPastDue: "",
  minDebt: "",
  daysWithoutNewOrder: "",
  timing: "",
  severity: "",
  template: "",
  channel: "",
  scanTime: "",
  frequency: "",
  validFrom: "",
  validTo: "",
  status: "",
})
export default function Notifications({ s, notify }: any) {
  const [tab, setTab] = useState("Lập thông báo")
  const [client, setClient] = useState("")
  const [group, setGroup] = useState("")
  const [account, setAccount] = useState("131")
  const [from, setFrom] = useState("2026-09-01")
  const [to, setTo] = useState(s.clock)
  const [status, setStatus] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [preview, setPreview] = useState<RecordData | null>(null)
  const [rule, setRule] = useState<RecordData | null>(null)
  const [errors, setErrors] = useState<RecordData>({})
  const [error, setError] = useState("")
  const [confirm, setConfirm] = useState<RecordData | null>(null)
  const [queueSelected, setQueueSelected] = useState<string[]>([])
  const [queueFilter, setQueueFilter] = useState("")
  const [channelFilter, setChannelFilter] = useState("")
  const [severityFilter, setSeverityFilter] = useState("")
  const [view, setView] = useState<RecordData | null>(null)
  const [busy, setBusy] = useState(false)
  const guard = (fn: () => void) => {
    try {
      setError("")
      fn()
    } catch (e) {
      setError((e as Error).message)
      notify((e as Error).message, "red")
    }
  }
  const rules = s.rules.filter((r: RecordData) => !r.deleted)
  const rows = debtRows(s, client || undefined).filter(
    (i: RecordData) =>
      (!group || customer(s, i.customerId).group === group) &&
      i.issuedAt >= from &&
      i.issuedAt <= to &&
      (!status || debtStatus(s, i) === status),
  )
  const queue = s.queue.filter(
    (q: RecordData) =>
      balance(s, q.customerId) > 0 &&
      q.invoiceIds.some((i: string) => outstanding(s, i) > 0) &&
      (!queueFilter || q.ruleId === queueFilter) &&
      (!channelFilter || q.channel === channelFilter) &&
      (!severityFilter || severity(s, q.days) === severityFilter),
  )
  const openPreview = () =>
    guard(() => {
      if (!client || !group || !account || !from || !to)
        throw new Error(
          "Vui lòng chọn khách hàng, nhóm khách hàng, kỳ thông báo và tài khoản",
        )
      if (from > to) throw new Error("Từ ngày không được sau đến ngày")
      const picked = rows.filter((i: RecordData) => selected.includes(i.id))
      if (!picked.length)
        throw new Error("Vui lòng chọn ít nhất một khoản nợ còn phải thu")
      setPreview({
        customerId: client,
        rows: noticeRows(s, structuredClone(picked)),
        revision: s.revision,
        from,
        to,
        date: s.clock,
      })
    })
  const previewValid = () => {
    if (!preview) throw new Error("Chưa có bản xem trước")
    if (
      preview.revision !== s.revision ||
      s.faults.changed ||
      preview.rows.some(
        (i: RecordData) => outstanding(s, i.id) !== i.outstanding,
      )
    )
      throw new Error(
        "Dữ liệu công nợ của khách hàng vừa thay đổi, vui lòng quay lại và xem thông báo với số dư mới nhất",
      )
    if (s.faults.fileCreate)
      throw new Error(
        "Không thể tạo tệp hoặc bản in thông báo, dữ liệu được giữ lại để thử lại",
      )
  }
  const savePreview = (channel: string) =>
    guard(() => {
      previewValid()
      const total = sum(preview!.rows, "outstanding")
      if (channel !== "Lưu báo cáo" && !confirm) {
        setConfirm({
          kind: "manual",
          channel,
          title: `Mô phỏng gửi qua ${channel}?`,
        })
        return
      }
      const failed = channel !== "Lưu báo cáo" && s.faults.sendPartial
      const content = `Thông báo công nợ - ${customer(s, preview!.customerId).name}\n${preview!.rows.map((i: RecordData) => `${i.id}: ${money(i.outstanding)}, hạn ${date(i.dueAt)}`).join("\n")}\nTổng còn phải trả: ${money(total)}`
      updateState((d) =>
        d.history.push({
          id: `TB-TAY-${Date.now()}`,
          customerId: preview!.customerId,
          invoiceIds: preview!.rows.map((i: RecordData) => i.id),
          rows: preview!.rows,
          amount: total,
          content,
          channel,
          status:
            channel === "Lưu báo cáo"
              ? "Đã lưu"
              : failed
                ? "Gửi lỗi"
                : "Đã gửi",
          error: failed ? "Kênh gửi mô phỏng bị lỗi kết nối" : null,
          date: s.clock,
          simulated: true,
          actor: "Kế toán công nợ",
        }),
      )
      setPreview({ ...preview, revision: s.revision + 1 })
      setConfirm(null)
      notify(
        channel === "Lưu báo cáo"
          ? "Đã lưu bản thông báo để xem lại trong lịch sử"
          : failed
            ? "Mô phỏng gửi lỗi, xem nguyên nhân trong lịch sử"
            : `Đã mô phỏng gửi ${channel}, không có tin nhắn được gửi ra ngoài`,
        failed ? "red" : "green",
      )
    })
  const validateRule = () => {
    if (!rule) return false
    const e: RecordData = {}
    if (!rule.name.trim()) e.name = "Tên quy tắc là bắt buộc"
    else if (
      rules.some(
        (r: RecordData) =>
          r.id !== rule.id &&
          r.name.trim().toLocaleLowerCase() ===
            rule.name.trim().toLocaleLowerCase(),
      )
    )
      e.name = "Tên kịch bản đã tồn tại, vui lòng nhập tên khác"
    for (const key of ["daysPastDue", "daysWithoutNewOrder", "minDebt"])
      if (
        rule[key] === "" ||
        !Number.isInteger(Number(rule[key])) ||
        Number(rule[key]) < (key === "minDebt" ? 1 : 0)
      )
        e[key] =
          key === "minDebt"
            ? "Phải là số nguyên dương"
            : "Phải là số nguyên không âm"
    for (const key of [
      "timing",
      "channel",
      "scanTime",
      "frequency",
      "validFrom",
      "validTo",
      "status",
    ])
      if (!rule[key]) e[key] = "Vui lòng nhập hoặc chọn giá trị"
    if (!rule.template.trim()) e.template = "Nội dung mẫu là bắt buộc"
    const tokens = [...rule.template.matchAll(/\{([^}]*)\}/g)].map(
      (m: string[]) => m[1],
    )
    if (
      tokens.some(
        (t: string) =>
          !seed.configuration.supportedReminderVariables.includes(t),
      ) ||
      /[{}]/.test(rule.template.replace(/\{(\w+)\}/g, ""))
    )
      e.template = "Chỉ dùng biến chuẩn và đúng cú pháp {Ten_KH}"
    if (rule.validFrom > rule.validTo)
      e.validTo = "Ngày kết thúc không được trước ngày bắt đầu"
    setErrors(e)
    return !Object.keys(e).length
  }
  const saveRule = (sync?: boolean) =>
    guard(() => {
      if (!validateRule()) return
      if (s.faults.ruleSave)
        throw new Error(
          "Không thể lưu quy tắc do lỗi hệ thống, nội dung vừa nhập được giữ lại",
        )
      if (
        sync === undefined &&
        rule!.id &&
        s.queue.some((q: RecordData) => q.ruleId === rule!.id)
      ) {
        setConfirm({
          kind: "sync",
          title: "Cập nhật thông báo đang chờ duyệt?",
          count: s.queue.filter((q: RecordData) => q.ruleId === rule!.id)
            .length,
        })
        return
      }
      const saved: RecordData = {
        ...rule,
        id: rule!.id || `QT-${Date.now()}`,
        name: rule!.name.trim(),
        daysPastDue: Number(rule!.daysPastDue),
        minDebt: Number(rule!.minDebt),
        daysWithoutNewOrder: Number(rule!.daysWithoutNewOrder),
        origin: "Cấu hình do người dùng nhập trong prototype",
        updatedAt: s.clock,
      }
      updateState((d) => {
        d.rules = d.rules.filter((r: RecordData) => r.id !== saved.id)
        d.rules.push(saved)
        if (sync) {
          d.queue = d.queue.filter((q: RecordData) => {
            if (q.ruleId !== saved.id) return true
            const debt = Math.min(
              sum(
                debtRows(d, q.customerId).filter((i: RecordData) =>
                  q.invoiceIds.includes(i.id),
                ),
                "outstanding",
              ),
              Math.max(0, balance(d, q.customerId)),
            )
            if (
              debt <= 0 ||
              debt < saved.minDebt ||
              saved.status !== "Đang kích hoạt" ||
              saved.validFrom > d.clock ||
              saved.validTo < d.clock
            )
              return false
            const eligible = debtRows(d, q.customerId).filter(
              (i: RecordData) =>
                q.invoiceIds.includes(i.id) &&
                i.dueAt &&
                (saved.timing === "Trước hạn"
                  ? i.dueAt >= d.clock &&
                    (Date.parse(i.dueAt) - Date.parse(d.clock)) / 86400000 <=
                      saved.daysPastDue
                  : i.dueAt <= d.clock &&
                    (overdue(d, i) || 0) >= saved.daysPastDue),
            )
            if (!eligible.length || saved.daysWithoutNewOrder > 0) return false
            q.invoiceIds = eligible.map((i: RecordData) => i.id)
            q.amount = Math.min(
              sum(eligible, "outstanding"),
              Math.max(0, balance(d, q.customerId)),
            )
            q.template = saved.template
            q.channel = saved.channel
            q.content = renderMessage(d, saved, q.customerId, q.amount, q.days)
            return q.amount >= saved.minDebt
          })
        }
      })
      setRule(null)
      setConfirm(null)
      notify(
        "Đã lưu quy tắc và cập nhật lịch quét mô phỏng, lịch sử đã gửi được bảo toàn",
        "green",
      )
    })
  const executeConfirm = async () => {
    if (busy || !confirm) return
    if (confirm.kind === "manual") return savePreview(confirm.channel)
    setBusy(true)
    await new Promise((resolve) => setTimeout(resolve, 350))
    guard(() => {
      if (confirm.kind === "send") {
        const result = send(getState(), confirm.ids)
        replaceState(result.state)
        notify(
          result.changed
            ? "Nợ đã thay đổi, khoản tất toán được bỏ, số tiền còn lại đã cập nhật. Vui lòng xem và xác nhận lại"
            : `Mô phỏng gửi: ${result.sent} thành công, ${result.failed} lỗi. Không gửi tin ra ngoài`,
          result.changed || result.failed ? "amber" : "green",
        )
        setQueueSelected([])
      } else if (confirm.kind === "delete") {
        if (s.faults.ruleSave)
          throw new Error(
            "Không thể xóa quy tắc tại thời điểm này, dữ liệu giữ nguyên",
          )
        updateState((d) => {
          const r = d.rules.find((r: RecordData) => r.id === confirm.id)
          r.deleted = true
          r.status = "Ngừng kích hoạt"
          d.queue = d.queue.filter((q: RecordData) => q.ruleId !== confirm.id)
        })
        notify(
          "Đã xóa quy tắc và gỡ dự thảo liên quan, bảo toàn lịch sử",
          "green",
        )
      } else if (confirm.kind === "toggle") {
        if (s.faults.ruleSave)
          throw new Error(
            "Không cập nhật được trạng thái quy tắc, dữ liệu giữ nguyên",
          )
        updateState((d) => {
          const r = d.rules.find((r: RecordData) => r.id === confirm.id)
          r.status =
            r.status === "Đang kích hoạt" ? "Ngừng kích hoạt" : "Đang kích hoạt"
        })
        notify("Đã cập nhật trạng thái và lịch quét mô phỏng", "green")
      }
      setConfirm(null)
    })
    setBusy(false)
  }
  const toggle = (ids: string[], id: string, checked: boolean) =>
    checked ? [...new Set([...ids, id])] : ids.filter((x) => x !== id)
  const cancelQueue = (q: RecordData) => {
    setView({ ...q, cancelling: true, cancelNote: "" })
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Thông báo công nợ</h1>
          <p>
            Lập thông báo và quản lý nhắc nợ từ các khoản phải thu đã ghi nhận
          </p>
        </div>
        <Badge tone="blue">Mọi kênh gửi đều mô phỏng</Badge>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          "Lập thông báo",
          "Quy tắc nhắc nợ",
          {
            value: "Danh sách chờ",
            label: "Danh sách chờ",
            count: queue.length,
          },
          { value: "Lịch sử", label: "Lịch sử", count: s.history.length },
        ]}
      />
      {error && <Alert tone="red">{error}</Alert>}
      {tab === "Lập thông báo" && !preview && (
        <>
          <Card title="Tra cứu khoản nợ">
            <div className="form-grid three">
              <Field label="Khách hàng *">
                <Select
                  value={client}
                  onChange={(e: any) => {
                    setClient(e.target.value)
                    setSelected([])
                    setGroup(customer(s, e.target.value)?.group || "")
                  }}
                  options={[
                    { value: "", label: "Chọn khách hàng" },
                    ...s.customers.map((c: RecordData) => ({
                      value: c.id,
                      label: `${c.id} - ${c.name}`,
                    })),
                  ]}
                />
              </Field>
              <Field label="Nhóm khách hàng *">
                <Select
                  value={group}
                  onChange={(e: any) => {
                    setGroup(e.target.value)
                    setSelected([])
                  }}
                  options={[
                    { value: "", label: "Chọn nhóm khách hàng" },
                    ...[
                      ...new Set(s.customers.map((c: RecordData) => c.group)),
                    ].map((g) => ({ value: g, label: g })),
                  ]}
                />
              </Field>
              <Field label="Tài khoản *">
                <Select
                  value={account}
                  onChange={(e: any) => setAccount(e.target.value)}
                  options={[
                    { value: "", label: "Chọn tài khoản" },
                    { value: "131", label: "131 - Phải thu khách hàng" },
                  ]}
                />
              </Field>
              <Field label="Từ ngày *">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value)
                    setSelected([])
                  }}
                />
              </Field>
              <Field label="Đến ngày *">
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value)
                    setSelected([])
                  }}
                />
              </Field>
              <Field label="Tình trạng nợ">
                <Select
                  value={status}
                  onChange={(e: any) => {
                    setStatus(e.target.value)
                    setSelected([])
                  }}
                  options={[
                    { value: "", label: "Tất cả tình trạng" },
                    "Chưa đến hạn",
                    "Sắp đến hạn",
                    "Đến hạn",
                    "Quá hạn",
                    "Chưa xác định hạn",
                  ]}
                />
              </Field>
            </div>
          </Card>
          <Card
            title="Các khoản còn phải thu"
            aside={
              <Button
                primary
                icon={Eye}
                onClick={openPreview}
                disabled={!selected.length}
              >
                Xem thông báo ({selected.length})
              </Button>
            }
          >
            <Table
              rows={client ? rows : []}
              columns={[
                {
                  label: (
                    <input
                      aria-label="Chọn tất cả khoản nợ"
                      type="checkbox"
                      checked={
                        !!rows.length &&
                        rows.every((i: RecordData) => selected.includes(i.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? rows.map((i: RecordData) => i.id)
                            : [],
                        )
                      }
                    />
                  ),
                  render: (i: RecordData) => (
                    <input
                      aria-label={`Chọn ${i.id}`}
                      type="checkbox"
                      checked={selected.includes(i.id)}
                      onChange={(e) =>
                        setSelected(toggle(selected, i.id, e.target.checked))
                      }
                    />
                  ),
                },
                {
                  label: "Hóa đơn / Khoản nợ",
                  render: (i: RecordData) => (
                    <div>
                      <strong>{i.id}</strong>
                      <small>{date(i.issuedAt)}</small>
                    </div>
                  ),
                },
                {
                  label: "Hạn thanh toán",
                  render: (i: RecordData) => date(i.dueAt),
                },
                {
                  label: "Ngày quá hạn",
                  render: (i: RecordData) =>
                    overdue(s, i) ?? "Chưa xác định hạn",
                },
                {
                  label: "Tình trạng",
                  render: (i: RecordData) => <Badge>{debtStatus(s, i)}</Badge>,
                },
                {
                  label: "Mức độ",
                  render: (i: RecordData) => severity(s, overdue(s, i)),
                },
                {
                  label: "Còn phải trả",
                  align: "right",
                  render: (i: RecordData) => (
                    <strong>{money(i.outstanding)}</strong>
                  ),
                },
              ]}
            />
            {!client && (
              <Alert>
                Chọn một khách hàng để tra cứu và lập thông báo riêng
              </Alert>
            )}
          </Card>
        </>
      )}
      {tab === "Lập thông báo" && preview && (
        <>
          <Back onClick={() => setPreview(null)}>Quay lại chọn khoản nợ</Back>
          <Card
            title="Xem trước thông báo công nợ"
            aside={<Badge tone="neutral">Mỗi khách một thông báo</Badge>}
          >
            <NoticePaper
              s={s}
              customerId={preview.customerId}
              rows={preview.rows}
              from={preview.from}
              to={preview.to}
              issuedAt={preview.date}
            />
            <div className="card-actions">
              <ExportButtons
                validate={previewValid}
                title={`Thông báo công nợ - ${customer(s, preview.customerId).name}`}
                rows={preview.rows}
                columns={noticeColumns}
                context={`${date(preview.from)} - ${date(preview.to)} · ${customer(s, preview.customerId).name}`}
                fail={
                  s.faults.fileCreate ||
                  preview.revision !== s.revision ||
                  s.faults.changed
                }
                notify={notify}
                onOutput={(action: string) => {
                  updateState((d) =>
                    d.history.push({
                      id: `TB-OUT-${Date.now()}`,
                      customerId: preview.customerId,
                      rows: preview.rows,
                      invoiceIds: preview.rows.map((i: RecordData) => i.id),
                      amount: sum(preview.rows, "outstanding"),
                      channel: action,
                      status: action,
                      content: preview.rows
                        .map(
                          (i: RecordData) =>
                            `${i.id}: ${money(i.outstanding)}, hạn ${date(i.dueAt)}`,
                        )
                        .join("\n"),
                      date: s.clock,
                      actor: "Kế toán công nợ",
                      simulated: true,
                    }),
                  )
                  setPreview({ ...preview, revision: s.revision + 1 })
                }}
              />
              <Button onClick={() => savePreview("Lưu báo cáo")}>
                Lưu báo cáo
              </Button>
              <Button onClick={() => savePreview("Email")}>Gửi Email</Button>
              <Button primary icon={Send} onClick={() => savePreview("Zalo")}>
                Gửi Zalo
              </Button>
            </div>
            <p className="footnote">
              PDF được lưu bằng chức năng Lưu dưới dạng PDF của hộp thoại in
              trên trình duyệt
            </p>
          </Card>
        </>
      )}
      {tab === "Quy tắc nhắc nợ" && (
        <Card
          title="Quy tắc nhắc nợ"
          aside={
            <Button
              primary
              icon={Plus}
              onClick={() => {
                setRule(blankRule())
                setErrors({})
              }}
            >
              Tạo quy tắc
            </Button>
          }
        >
          <Alert>
            Lịch quét được mô phỏng trong ứng dụng. Quét chỉ tạo Chờ duyệt,
            không tự gửi. Chạy quét trong Chế độ demo
          </Alert>
          <Table
            rows={rules}
            columns={[
              {
                label: "Tên quy tắc",
                render: (r: RecordData) => (
                  <div>
                    <strong>{r.name}</strong>
                    <small>
                      {r.timing || "Quá hạn"} từ {r.daysPastDue} ngày · Nợ từ{" "}
                      {money(r.minDebt)}
                    </small>
                  </div>
                ),
              },
              { label: "Kênh", key: "channel" },
              {
                label: "Lịch quét mô phỏng",
                render: (r: RecordData) => (
                  <div>
                    {r.scanTime} · {r.frequency || "Hàng ngày"}
                    <small>
                      {date(r.validFrom)} - {date(r.validTo)}
                    </small>
                  </div>
                ),
              },
              {
                label: "Trạng thái",
                render: (r: RecordData) => (
                  <button
                    className="badge-button"
                    onClick={() =>
                      setConfirm({
                        kind: "toggle",
                        id: r.id,
                        title: `${
                          r.status === "Đang kích hoạt"
                            ? "Tạm dừng"
                            : "Kích hoạt"
                        } quy tắc?`,
                      })
                    }
                  >
                    <Badge>{r.status}</Badge>
                  </button>
                ),
              },
              {
                label: "Thao tác",
                render: (r: RecordData) => (
                  <div className="button-group">
                    <Button
                      onClick={() => {
                        setRule({
                          ...r,
                          timing: r.timing || "Quá hạn",
                          frequency: r.frequency || "Hàng ngày",
                        })
                        setErrors({})
                      }}
                    >
                      Sửa
                    </Button>
                    <Button
                      aria-label={`Xóa ${r.name}`}
                      icon={Trash2}
                      onClick={() =>
                        setConfirm({
                          kind: "delete",
                          id: r.id,
                          title: `Xóa quy tắc “${r.name}”?`,
                          count: s.queue.filter(
                            (q: RecordData) => q.ruleId === r.id,
                          ).length,
                        })
                      }
                    />
                  </div>
                ),
              },
            ]}
          />
        </Card>
      )}
      {tab === "Danh sách chờ" && (
        <Card
          title="Danh sách chờ nhắc nợ"
          aside={
            <Button
              primary
              icon={Send}
              disabled={
                !queueSelected.some((id) =>
                  queue.some((q: RecordData) => q.id === id),
                )
              }
              onClick={() =>
                setConfirm({
                  kind: "send",
                  title: "Xác nhận duyệt và gửi mô phỏng",
                  ids: queueSelected.filter((id) =>
                    queue.some((q: RecordData) => q.id === id),
                  ),
                })
              }
            >
              Duyệt và gửi (
              {
                queueSelected.filter((id) =>
                  queue.some((q: RecordData) => q.id === id),
                ).length
              }
              )
            </Button>
          }
        >
          <div className="filter-row">
            <Select
              value={queueFilter}
              onChange={(e: any) => setQueueFilter(e.target.value)}
              options={[
                { value: "", label: "Tất cả quy tắc" },
                ...rules.map((r: RecordData) => ({
                  value: r.id,
                  label: r.name,
                })),
              ]}
            />
            <Select
              value={channelFilter}
              onChange={(e: any) => setChannelFilter(e.target.value)}
              options={[{ value: "", label: "Tất cả kênh" }, "Zalo", "SMS"]}
            />
            <Select
              aria-label="Mức độ nhắc nợ"
              value={severityFilter}
              onChange={(e: any) => setSeverityFilter(e.target.value)}
              options={[
                { value: "", label: "Tất cả mức độ" },
                ...(s.configuration.severityThresholds
                  ? ["Cảnh báo", "Nghiêm trọng", "Chưa tới ngưỡng cảnh báo"]
                  : ["Chưa cấu hình"]),
              ]}
            />
          </div>
          <Table
            rows={queue}
            columns={[
              {
                label: (
                  <input
                    aria-label="Chọn tất cả thông báo"
                    type="checkbox"
                    checked={
                      !!queue.length &&
                      queue.every((q: RecordData) =>
                        queueSelected.includes(q.id),
                      )
                    }
                    onChange={(e) =>
                      setQueueSelected(
                        e.target.checked
                          ? queue.map((q: RecordData) => q.id)
                          : [],
                      )
                    }
                  />
                ),
                render: (q: RecordData) => (
                  <input
                    aria-label={`Chọn ${q.customerId}`}
                    type="checkbox"
                    checked={queueSelected.includes(q.id)}
                    onChange={(e) =>
                      setQueueSelected(
                        toggle(queueSelected, q.id, e.target.checked),
                      )
                    }
                  />
                ),
              },
              {
                label: "Khách hàng",
                render: (q: RecordData) => (
                  <button className="text-button" onClick={() => setView(q)}>
                    {customer(s, q.customerId).name}
                    <small>{q.customerId}</small>
                  </button>
                ),
              },
              {
                label: "Nợ hiện tại",
                align: "right",
                render: (q: RecordData) =>
                  money(
                    Math.min(
                      q.invoiceIds.reduce(
                        (n: number, id: string) => n + outstanding(s, id),
                        0,
                      ),
                      Math.max(0, balance(s, q.customerId)),
                    ),
                  ),
              },
              {
                label: "Quy tắc / Kênh",
                render: (q: RecordData) => (
                  <div>
                    {s.rules.find((r: RecordData) => r.id === q.ruleId)?.name}
                    <small>{q.channel}</small>
                  </div>
                ),
              },
              {
                label: "Trạng thái",
                render: (q: RecordData) => (
                  <div>
                    <Badge>{q.status}</Badge>
                    {q.error && <small className="red-text">{q.error}</small>}
                  </div>
                ),
              },
              {
                label: "Thao tác",
                render: (q: RecordData) => (
                  <div className="button-group">
                    <Button onClick={() => setView(q)}>Xem</Button>
                    <Button onClick={() => cancelQueue(q)}>Hủy nhắc</Button>
                    {q.status === "Gửi lỗi" && (
                      <Button
                        onClick={() =>
                          setConfirm({
                            kind: "send",
                            title: "Xác nhận thử gửi lại - mô phỏng",
                            ids: [q.id],
                          })
                        }
                      >
                        Thử gửi lại
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          {!queue.length && (
            <Alert>
              Hiện không có khoản công nợ nào trong danh sách chờ nhắc nợ
            </Alert>
          )}
        </Card>
      )}
      {tab === "Lịch sử" && (
        <Card title="Lịch sử thông báo">
          <Alert>
            Đã gửi chỉ là kết quả gửi mô phỏng, không đồng nghĩa khách hàng đã
            thanh toán
          </Alert>
          <Table
            rows={[...s.history].reverse()}
            onRow={setView}
            columns={[
              { label: "Ngày", render: (h: RecordData) => date(h.date) },
              {
                label: "Khách hàng",
                render: (h: RecordData) => customer(s, h.customerId)?.name,
              },
              {
                label: "Số tiền thông báo",
                align: "right",
                render: (h: RecordData) => money(h.amount),
              },
              { label: "Kênh", key: "channel" },
              {
                label: "Kết quả mô phỏng",
                render: (h: RecordData) => <Badge>{h.status}</Badge>,
              },
              { label: "Người thực hiện", render: () => "Kế toán công nợ" },
            ]}
          />
        </Card>
      )}
      {rule && (
        <Modal
          wide
          title={rule.id ? "Chỉnh sửa quy tắc nhắc nợ" : "Tạo quy tắc nhắc nợ"}
          onClose={() =>
            setConfirm({ kind: "discard", title: "Hủy dữ liệu đang nhập?" })
          }
          footer={
            <>
              <Button
                onClick={() =>
                  setConfirm({
                    kind: "discard",
                    title: "Hủy dữ liệu đang nhập?",
                  })
                }
              >
                Hủy bỏ
              </Button>
              <Button primary onClick={() => saveRule()}>
                Lưu quy tắc
              </Button>
            </>
          }
        >
          <div className="form-grid three">
            {[
              ["name", "Tên quy tắc *", "text"],
              ["daysPastDue", "Số ngày trước hạn / quá hạn *", "number"],
              ["minDebt", "Mức nợ tối thiểu (VND) *", "number"],
              ["daysWithoutNewOrder", "Số ngày không có đơn mới *", "number"],
              ["scanTime", "Giờ quét *", "time"],
              ["validFrom", "Hiệu lực từ ngày *", "date"],
              ["validTo", "Hiệu lực đến ngày *", "date"],
            ].map(([key, label, type]) => (
              <Field key={key} label={label} error={errors[key]}>
                <input
                  type={type}
                  value={rule[key]}
                  onChange={(e) => setRule({ ...rule, [key]: e.target.value })}
                />
              </Field>
            ))}
            {[
              ["timing", "Loại thời hạn *", ["Quá hạn", "Trước hạn"]],
              ["channel", "Kênh gửi *", ["Zalo", "SMS"]],
              ["frequency", "Tần suất *", ["Hàng ngày"]],
              [
                "status",
                "Trạng thái khi lưu *",
                ["Đang kích hoạt", "Ngừng kích hoạt"],
              ],
            ].map(([key, label, options]: any) => (
              <Field key={key} label={label} error={errors[key]}>
                <Select
                  value={rule[key]}
                  options={[{ value: "", label: "Chọn giá trị" }, ...options]}
                  onChange={(e: any) =>
                    setRule({ ...rule, [key]: e.target.value })
                  }
                />
              </Field>
            ))}
          </div>
          <Field label="Điều kiện mức độ">
            {s.configuration.severityThresholds ? (
              <Select
                value={rule.severity || ""}
                options={[
                  { value: "", label: "Không xét mức độ" },
                  "Cảnh báo",
                  "Nghiêm trọng",
                ]}
                onChange={(e: any) =>
                  setRule({ ...rule, severity: e.target.value })
                }
              />
            ) : (
              <input
                readOnly
                value="Chưa cấu hình, không tự phân loại mức độ"
              />
            )}
          </Field>
          <Field label="Nội dung tin nhắn mẫu *" error={errors.template}>
            <textarea
              rows={4}
              value={rule.template}
              onChange={(e) => setRule({ ...rule, template: e.target.value })}
            />
          </Field>
          <div className="attachment-chips">
            {seed.configuration.supportedReminderVariables.map(
              (key: string) => (
                <Button
                  key={key}
                  onClick={() =>
                    setRule({ ...rule, template: rule.template + `{${key}}` })
                  }
                >{`{${key}}`}</Button>
              ),
            )}
          </div>
          <div className="message-preview">
            <small>Bản xem trước - Dữ liệu minh họa</small>
            <p>
              {renderMessage(
                s,
                rule,
                "DEMO-KH-A",
                balance(s, "DEMO-KH-A"),
                14,
              ) || "Nhập nội dung mẫu để xem trước"}
            </p>
          </div>
          <Alert>
            Link_Thanh_Toan hiển thị Chưa cấu hình khi chưa có URL, không được
            gửi mẫu còn biến chưa giải được. Điều kiện ngày không có đơn mới cần
            dữ liệu ngày đơn hàng, hiện bộ mock chưa có
          </Alert>
        </Modal>
      )}
      {view && (
        <Modal
          wide
          title={
            view.cancelling
              ? "Hủy nhắc lần này"
              : "Chi tiết thông báo - mô phỏng"
          }
          onClose={() => setView(null)}
        >
          <Values
            values={[
              ["Khách hàng", customer(s, view.customerId)?.name],
              ["Số tiền thông báo", money(view.amount)],
              ["Kênh", view.channel],
              ["Trạng thái", view.status],
              ["Khoản nợ liên quan", view.invoiceIds?.join(", ")],
              ["Ngày", date(view.date)],
            ]}
          />
          <div className="message-preview">
            <small>Nội dung thông báo</small>
            <p className="preserve-lines">{view.content}</p>
          </div>
          {view.error && <Alert tone="red">{view.error}</Alert>}
          {view.cancelling && (
            <>
              <Field label="Lý do hủy nhắc *">
                <textarea
                  value={view.cancelNote}
                  onChange={(e) =>
                    setView({ ...view, cancelNote: e.target.value })
                  }
                />
              </Field>
              <Button
                primary
                onClick={() =>
                  guard(() => {
                    if (!view.cancelNote?.trim())
                      throw new Error("Vui lòng nhập lý do hủy nhắc")
                    updateState((d) => {
                      d.queue = d.queue.filter(
                        (q: RecordData) => q.id !== view.id,
                      )
                      d.history.push({
                        ...view,
                        status: "Đã hủy bởi Kế toán",
                        reason: view.cancelNote,
                        date: s.clock,
                      })
                    })
                    setView(null)
                    notify("Đã hủy nhắc lần này và lưu lịch sử", "green")
                  })
                }
              >
                Xác nhận hủy nhắc
              </Button>
            </>
          )}
        </Modal>
      )}
      {confirm && (
        <Modal
          title={confirm.title}
          onClose={() => setConfirm(null)}
          footer={
            confirm.kind === "sync" ? (
              <>
                <Button onClick={() => saveRule(false)}>
                  Chỉ áp dụng lần quét sau
                </Button>
                <Button primary onClick={() => saveRule(true)}>
                  Đồng bộ ngay
                </Button>
              </>
            ) : (
              <>
                <Button disabled={busy} onClick={() => setConfirm(null)}>
                  Quay lại
                </Button>
                <Button
                  primary
                  disabled={busy}
                  onClick={() => {
                    if (confirm.kind === "discard") {
                      setRule(null)
                      setConfirm(null)
                    } else executeConfirm()
                  }}
                >
                  {busy ? "Đang xử lý..." : "Xác nhận"}
                </Button>
              </>
            )
          }
        >
          {confirm.kind === "send" ? (
            <>
              <p>
                Sẽ mô phỏng gửi <strong>{confirm.ids.length} thông báo</strong>{" "}
                qua{" "}
                {Array.from(
                  new Set(
                    s.queue
                      .filter((q: RecordData) => confirm.ids.includes(q.id))
                      .map((q: RecordData) => q.channel),
                  ),
                ).join(", ")}
              </p>
              <Alert>
                Kiểm tra lại nợ hiện tại trước gửi, bỏ khoản tất toán và yêu cầu
                xác nhận lại khi số tiền thay đổi. Không gọi API thật
              </Alert>
            </>
          ) : confirm.kind === "delete" ? (
            <Alert tone="amber">
              {confirm.count} dự thảo liên quan sẽ bị gỡ và lịch quét bị hủy.
              Lịch sử đã gửi được bảo toàn
            </Alert>
          ) : confirm.kind === "sync" ? (
            <p>
              Có {confirm.count} thông báo đang Chờ duyệt. Đồng bộ nội dung và
              điều kiện ngay hoặc chỉ dùng quy tắc mới cho lần quét sau
            </p>
          ) : (
            <p>
              {confirm.kind === "manual"
                ? "Chỉ mô phỏng gửi trong ứng dụng, không liên hệ khách hàng và không gửi tin thật"
                : "Thao tác chỉ thay đổi cấu hình prototype, không tác động đến dữ liệu thực tế"}
            </p>
          )}
        </Modal>
      )}
    </>
  )
}
