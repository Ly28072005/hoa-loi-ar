export type ToneStatus = "Đang xử lý" | "Khớp" | "Chờ xử lý" | "Chưa phản hồi"

export type Transaction = {
  date: string
  id: string
  note: string
  increase: number
  decrease: number
  balance: number
}

export type CustomerReconciliation = {
  id: string
  customerId: string
  customerName: string
  address: string
  taxCode: string
  period: string
  createdAt: string
  opening: number
  status: ToneStatus
  transactions: Transaction[]
  aging: { label: string; value: number | null }[]
  feedback: {
    status: string
    content: string
    date: string
    recorder: string
  }
  tableCreated: boolean
  verification?: { id: string; content: string; status: string }
}

export type ExternalRow = {
  row: number
  date: string
  id: string
  note: string
  amount: number | null
  balance: number | null
  expectedSystemId: string
}

export type FileResult = ExternalRow & {
  system?: { date: string; id: string; amount: number; balance: number }
  status: "Khớp" | "Chờ xử lý" | "Lỗi dữ liệu"
  reason: string
  requestId?: string
}

export type InternalScenario = "difference" | "match" | "ar-difference" | "missing" | "unconfigured"

export type CrossCheck = {
  status: "Nhất quán" | "Có chênh lệch" | "Chưa đủ dữ liệu"
  reports: {
    name: string
    total: number | null
    status: "Nhất quán" | "Có chênh lệch" | "Chưa đủ dữ liệu"
    difference: number | null
  }[]
  checkedAt: string
}

export type Difference = {
  id: string
  type: string
  documentId: string
  customer: string
  date: string
  sales: number
  ar: number
  reason: string
  notificationStatus: string
  processingStatus: string
}

export type InternalRun = {
  id: string
  period: string
  runAt: string
  crossStatus: CrossCheck["status"]
  salesIncrease: number
  arIncrease: number
  salesDecrease: number
  arDecrease: number
  differences: Difference[]
  note: string
}

export type ReconciliationState = {
  customers: CustomerReconciliation[]
  file: {
    period: string
    name: string
    type: string
    selectedAt: string
    rows: ExternalRow[]
    results: FileResult[]
  }
  internal: {
    period: string
    scenario: InternalScenario
    cross: CrossCheck | null
    runs: InternalRun[]
    selectedDifferenceIds: string[]
    requestContent: string
    requests: { id: string; runId: string; rows: string[]; content: string }[]
    verificationContent: string
    verificationStatus: string
  }
  closing: {
    period: string
    closed: boolean
    closedAt: string
  }
}

const agingLabels = [
  "Chưa có hạn thanh toán",
  "Chưa đến hạn",
  "Quá hạn 1-30 ngày",
  "Quá hạn 31-60 ngày",
  "Quá hạn 61-90 ngày",
  "Quá hạn 91-120 ngày",
  "Quá hạn trên 120 ngày",
]

const customerSeed = [
  [
    "001",
    "KH-001",
    "Khách hàng A",
    "10/2026",
    8000000,
    16000000,
    6000000,
    "Đang xử lý",
  ],
  [
    "002",
    "KH-002",
    "Khách hàng B",
    "09/2026",
    2000000,
    6000000,
    2000000,
    "Khớp",
  ],
  [
    "003",
    "KH-004",
    "Khách hàng D",
    "10/2026",
    5000000,
    8000000,
    2000000,
    "Chờ xử lý",
  ],
  ["004", "KH-003", "Khách hàng C", "10/2026", 0, 8000000, 0, "Khớp"],
  [
    "005",
    "KH-005",
    "Khách hàng E",
    "08/2026",
    12000000,
    3000000,
    5000000,
    "Đang xử lý",
  ],
  [
    "006",
    "KH-006",
    "Khách hàng F",
    "10/2026",
    3000000,
    5000000,
    1000000,
    "Chờ xử lý",
  ],

  [
    "007",
    "KH-007",
    "Khách hàng 7",
    "10/2026",
    5000000, // Số dư đầu kỳ
    10000000, // Phát sinh tăng
    4000000, // Phát sinh giảm
    "Chờ xử lý",
  ],
  [
    "008",
    "KH-009",
    "Khách hàng 9",
    "11/2026",
    3000000,
    8000000,
    3000000,
    "Đang xử lý",
  ],
] as const

function customerRecord(seed: typeof customerSeed[number]) {
  const [
    suffix,
    customerId,
    customerName,
    period,
    opening,
    increase,
    decrease,
    status,
  ] = seed
  const firstIncrease = Math.round(increase * 0.6)
  const transactions: Transaction[] = [
    {
      date: `01/${period}`,
      id: `SDĐK-${suffix}`,
      note: "Số dư đầu kỳ",
      increase: 0,
      decrease: 0,
      balance: opening,
    },
    {
      date: `05/${period}`,
      id: `HD-${suffix}-01`,
      note: "Bán hàng trong kỳ",
      increase: firstIncrease,
      decrease: 0,
      balance: opening + firstIncrease,
    },
    {
      date: `10/${period}`,
      id: `PT-${suffix}`,
      note: "Khách hàng thanh toán cho nhiều hóa đơn",
      increase: 0,
      decrease,
      balance: opening + firstIncrease - decrease,
    },
    {
      date: `13/${period}`,
      id: `HD-${suffix}-02`,
      note: "Bán hàng trong kỳ",
      increase: increase - firstIncrease,
      decrease: 0,
      balance: opening + increase - decrease,
    },
  ]
  const closing = opening + increase - decrease
  const overdue = Math.min(closing, Math.round(closing / 3))
  return {
    id: `ĐC-KH-${suffix}`,
    customerId,
    customerName,
    address: `${Number(suffix)} Nguyễn Huệ, TP. Huế`,
    taxCode: `3300123${suffix}`,
    period,
    createdAt: "13/10/2026",
    opening,
    status: status as ToneStatus,
    transactions,
    aging: agingLabels.map((label, index) => ({
      label,
      value: index === 1 ? closing - overdue : index === 2 ? overdue : 0,
    })),
    feedback: {
      status: status === "Khớp" ? "Đồng ý số liệu" : "Chưa phản hồi",
      content: status === "Khớp" ? "Khách hàng xác nhận số liệu phù hợp" : "",
      date: status === "Khớp" ? "13/10/2026" : "",
      recorder: status === "Khớp" ? "Kế toán HTX Hoa Lợi" : "",
    },
    tableCreated: status !== "Đang xử lý",
  } satisfies CustomerReconciliation
}

export const externalRows: ExternalRow[] = [
  {
    row: 1,
    date: "05/10/2026",
    id: "HD-001",
    note: "Khớp hoàn toàn",
    amount: 10000000,
    balance: 10000000,
    expectedSystemId: "HD-001",
  },
  {
    row: 2,
    date: "06/10/2026",
    id: "HD-002",
    note: "Sai ngày",
    amount: 6000000,
    balance: 16000000,
    expectedSystemId: "HD-002",
  },
  {
    row: 3,
    date: "07/10/2026",
    id: "HD-003-SAI",
    note: "Sai số chứng từ",
    amount: 8000000,
    balance: 24000000,
    expectedSystemId: "HD-003",
  },
  {
    row: 4,
    date: "08/10/2026",
    id: "HD-004",
    note: "Sai số tiền",
    amount: 5500000,
    balance: 30000000,
    expectedSystemId: "HD-004",
  },
  {
    row: 5,
    date: "09/10/2026",
    id: "HD-005",
    note: "Sai số dư",
    amount: 10000000,
    balance: 39000000,
    expectedSystemId: "HD-005",
  },
  {
    row: 6,
    date: "10/10/2026",
    id: "PT-001",
    note: "Thanh toán nhiều hóa đơn",
    amount: -6000000,
    balance: 34000000,
    expectedSystemId: "PT-001",
  },
  {
    row: 7,
    date: "11/10/2026",
    id: "HD-KHONG-CO",
    note: "Không tìm thấy giao dịch",
    amount: 3000000,
    balance: 37000000,
    expectedSystemId: "HD-KHONG-CO",
  },
  {
    row: 8,
    date: "",
    id: "HD-006",
    note: "Thiếu ngày bắt buộc",
    amount: 5000000,
    balance: 42000000,
    expectedSystemId: "HD-006",
  },
]

const systemRows = [
  { date: "05/10/2026", id: "HD-001", amount: 10000000, balance: 10000000 },
  { date: "05/10/2026", id: "HD-002", amount: 6000000, balance: 16000000 },
  { date: "07/10/2026", id: "HD-003", amount: 8000000, balance: 24000000 },
  { date: "08/10/2026", id: "HD-004", amount: 6000000, balance: 30000000 },
  { date: "09/10/2026", id: "HD-005", amount: 10000000, balance: 40000000 },
  { date: "10/10/2026", id: "PT-001", amount: -6000000, balance: 34000000 },
  { date: "12/10/2026", id: "HD-006", amount: 5000000, balance: 39000000 },
]

export function closingBalance(record: CustomerReconciliation) {
  return record.transactions.at(-1)?.balance ?? record.opening
}

export function totalIncrease(record: CustomerReconciliation) {
  return record.transactions.reduce((sum, row) => sum + row.increase, 0)
}

export function totalDecrease(record: CustomerReconciliation) {
  return record.transactions.reduce((sum, row) => sum + row.decrease, 0)
}

export function reconcileFile(rows: ExternalRow[]): FileResult[] {
  return rows.map((row) => {
    const missing =
      !row.date || !row.id || row.amount === null || row.balance === null
    if (missing)
      return {
        ...row,
        status: "Lỗi dữ liệu",
        reason: "Thiếu trường bắt buộc: ngày, số chứng từ, số tiền hoặc số dư",
      }
    const system = systemRows.find((item) => item.id === row.expectedSystemId)
    if (!system)
      return {
        ...row,
        status: "Chờ xử lý",
        reason: "Không tìm thấy giao dịch tương ứng trong hệ thống",
      }
    const reasons: string[] = []
    if (row.date !== system.date) reasons.push("Ngày chứng từ không khớp")
    if (row.id !== system.id) reasons.push("Số chứng từ không khớp")
    if (row.amount !== system.amount) reasons.push("Số tiền không khớp")
    if (row.balance !== system.balance) reasons.push("Số dư không khớp")
    return {
      ...row,
      system,
      status: reasons.length ? "Chờ xử lý" : "Khớp",
      reason: reasons.join(". "),
    }
  })
}

export function checkReports(scenario: InternalScenario): CrossCheck {
  const base = 40000000
  const totals: (number | null)[] =
    scenario === "missing"
      ? [base, base, null, base]
      : scenario === "ar-difference"
        ? [base, base, 39000000, base]
        : [base, base, base, base]
  const complete = totals.every((value) => value !== null)
  const consistent = complete && totals.every((value) => value === totals[0])
  return {
    status: !complete
      ? "Chưa đủ dữ liệu"
      : consistent
        ? "Nhất quán"
        : "Có chênh lệch",
    checkedAt: new Date().toLocaleString("vi-VN"),
    reports: [
      "Công nợ theo khách hàng",
      "Công nợ theo hóa đơn",
      "Công nợ theo mặt hàng",
      "Công nợ theo tuổi nợ",
    ].map((name, index) => ({
      name,
      total: totals[index],
      status:
        totals[index] === null
          ? "Chưa đủ dữ liệu"
          : totals[index] === totals[0]
            ? "Nhất quán"
            : "Có chênh lệch",
      difference:
        totals[index] === null || totals[0] === null
          ? null
          : totals[index]! - totals[0]!,
    })),
  }
}

export function runInternal(
  state: ReconciliationState["internal"],
  cross: CrossCheck,
): InternalRun | null {
  if (cross.status !== "Nhất quán") return null
  const hasDifference = state.scenario === "difference"
  const differences: Difference[] = hasDifference
    ? [
        {
          id: "CL-001",
          type: "Hóa đơn/giao hàng",
          documentId: "HD-004",
          customer: "KH-004",
          date: "13/10/2026",
          sales: 6000000,
          ar: 5000000,
          reason: "AR thiếu phát sinh tăng 1.000.000 VND",
          notificationStatus: "Chưa thông báo",
          processingStatus: "Chờ xử lý",
        },
        {
          id: "CL-002",
          type: "Giấy báo Có",
          documentId: "GBC-002",
          customer: "KH-001",
          date: "12/10/2026",
          sales: 6000000,
          ar: 5000000,
          reason:
            "Khoản thu liên quan HD-001 và HD-003 chưa được phản ánh đủ tại AR",
          notificationStatus: "Chưa thông báo",
          processingStatus: "Chờ xử lý",
        },
      ]
    : []
  return {
    id: `LĐC-${String(state.runs.length + 1).padStart(3, "0")}`,
    period: state.period,
    runAt: new Date().toLocaleString("vi-VN"),
    crossStatus: cross.status,
    salesIncrease: hasDifference ? 46000000 : 45000000,
    arIncrease: 45000000,
    salesDecrease: hasDifference ? 6000000 : 5000000,
    arDecrease: 5000000,
    differences,
    note: state.runs.length
      ? "Đối chiếu lại sau xác minh"
      : "Lần chạy đầu tiên",
  }
}

export function initialReconciliationState(): ReconciliationState {
  return {
    customers: customerSeed.map(customerRecord),
    file: {
      period: "",
      name: "",
      type: "",
      selectedAt: "",
      rows: [],
      results: [],
    },
    internal: {
      period: "",
      scenario: "difference",
      cross: null,
      runs: [],
      selectedDifferenceIds: [],
      requestContent: "",
      requests: [],
      verificationContent: "",
      verificationStatus: "Đang xác minh",
    },
    closing: { period: "10/2026", closed: false, closedAt: "" },
  }
}
