import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"
import assert from "node:assert/strict"

// Compile only the pure demo logic to a temporary directory, without a browser.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hoa-loi-logic-"))
try {
  const fixture = fs.readFileSync("src/data/mock.json", "utf8")
  const source = fs
    .readFileSync("src/store.ts", "utf8")
    .replace(
      /import mock from ["']\.\/data\/mock\.json["']/,
      `const mock = ${fixture}`,
    )
    .replace(
      /import \{ useSyncExternalStore \} from ["']react["']/,
      "const useSyncExternalStore = () => {}",
    )
  const compile = (text) =>
    ts.transpileModule(text, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText
  fs.writeFileSync(path.join(directory, "store.mjs"), compile(source))
  fs.writeFileSync(
    path.join(directory, "scenarios.mjs"),
    compile(
      fs
        .readFileSync("src/scenarios.ts", "utf8")
        .replace(/from ["']\.\/store["']/, 'from "./store.mjs"'),
    ),
  )
  const engine = await import(
    pathToFileURL(path.join(directory, "store.mjs")).href
  )
  const { runScenario } = await import(
    pathToFileURL(path.join(directory, "scenarios.mjs")).href
  )
  let passed = 0
  for (const scenario of engine.seed.testScenarios) {
    const result = runScenario(scenario.id)
    console.log(`${result.status}: ${scenario.id} - ${result.explanation}`)
    if (result.status.startsWith("Đạt")) passed++
  }
  assert.equal(passed, 10)
  console.log(
    "10/11 ca JSON đạt kiểm tra logic, UC03-IMMUTABLE cần kiểm thử trên giao diện",
  )

  const test = (name, fn) => {
    fn()
    console.log(`PASS: ${name}`)
  }
  test("Lỗi lưu dở UC01 giữ bút toán và mã xử lý, thử lại không ghi hai lần", () => {
    let s = engine.initialState()
    s.faults.partialSave = true
    s = engine.postIncrease(s, "CTDC-001").state
    assert.equal(engine.balance(s, "KH-007"), 7000000)
    assert.equal(s.journals.length, 2)
    assert.equal(s.attempts[0].journalId, "BT-CTDC-001")
    delete s.faults.partialSave
    s = engine.postIncrease(s, "CTDC-001").state
    assert.equal(engine.balance(s, "KH-007"), 9000000)
    assert.equal(s.journals.length, 2)
  })
  test("Lỗi hạch toán UC01 giữ mã xử lý, không tạo bút toán hoặc tăng nợ", () => {
    const s = engine.initialState()
    s.faults.posting = true
    const response = engine.postIncrease(s, "CTBH-001")
    assert.ok(response.warning.includes("XL-CTBH-001"))
    assert.equal(response.state.journals.length, 1)
    assert.equal(response.state.events.length, 0)
  })
  for (const fault of [
    "locked",
    "cancelled",
    "duplicate",
    "wrongCustomer",
    "missing",
    "changed",
  ]) {
    test(`Kiểm tra nguồn chặn ${fault}, không đổi công nợ`, () => {
      const s = engine.initialState()
      s.faults[fault] = true
      const before = JSON.stringify(s)
      assert.throws(() => engine.postIncrease(s, "CTBH-001"))
      assert.throws(() =>
        engine.postReduction(s, "DEMO-PT-A1", { "DEMO-HD-A1": 1000000 }),
      )
      assert.equal(JSON.stringify(s), before)
    })
  }
  test("UC02 lỗi ghi sổ hoàn lại toàn bộ dữ liệu", () => {
    const s = engine.initialState()
    s.faults.reduction = true
    const before = JSON.stringify(s)
    assert.throws(() =>
      engine.postReduction(s, "DEMO-PT-A1", { "DEMO-HD-A1": 1000000 }),
    )
    assert.equal(JSON.stringify(s), before)
  })
  test("Tự phân bổ từ chối hóa đơn thiếu hạn", () => {
    const s = engine.initialState()
    assert.throws(
      () => engine.autoAllocation(s, { customerId: "KH-002", amount: 1000000 }),
      /Chỉ định hóa đơn/,
    )
  })
  test("Không cho giảm vượt nợ hóa đơn gốc", () => {
    let s = engine.initialState()
    s = engine.postReduction(s, "DEMO-GBC-KHONGPB", {}, { note: "Chờ phân bổ" })
    s = engine.postReduction(s, "DEMO-GBC-KHONGPB", { "DEMO-HD-B1": 100000 }, {
      allocationOnly: true,
    })
    s.reductions.find((r) => r.id === "DEMO-PTH-B1").amount = 2000000
    assert.throws(() => engine.postReduction(s, "DEMO-PTH-B1", {}), /vượt nợ/)
  })
  test("Sửa tài khoản hoặc Chỉ ghi giảm cần có lý do", () => {
    const s = engine.initialState()
    assert.throws(
      () => engine.postReduction(s, "DEMO-PT-A1", {}, { debit: "113" }),
      /lý do/,
    )
    assert.throws(() => engine.postReduction(s, "DEMO-PT-A1", {}), /lý do/)
  })
  test("Báo cáo đầu kỳ và phát sinh theo ngày, không dùng số dư hiện tại cho kỳ cũ", () => {
    let s = engine.initialState()
    s.clock = "2026-10-16"
    s = engine.postIncrease(s, "CTDC-001").state
    const past = engine.report(s, "2026-10-15", "2026-10-15", "KH-007")[0]
    const today = engine.report(s, "2026-10-16", "2026-10-16", "KH-007")[0]
    assert.equal(past.closing, 7000000)
    assert.equal(today.opening, 7000000)
    assert.equal(today.increase, 2000000)
    assert.equal(today.closing, 9000000)
    assert.throws(
      () => engine.report(s, "2026-10-01", "2026-10-15"),
      /Chưa đủ dữ liệu/,
    )
  })
  test("Nhắc nợ quét không trùng, không tự gửi", () => {
    let s = engine.scan(engine.initialState())
    assert.equal(s.queue.length, 1)
    assert.equal(s.history.length, 0)
    s = engine.scan(s)
    assert.equal(s.queue.length, 1)
  })
  test("Gửi lỗi một khách không hoàn tác khách gửi thành công", () => {
    const s = engine.initialState()
    s.faults.sendPartial = true
    s.queue = [
      {
        id: "A",
        customerId: "DEMO-KH-A",
        invoiceIds: ["DEMO-HD-A1"],
        amount: 2160000,
        content: "Tin A",
        status: "Chờ duyệt",
      },
      {
        id: "B",
        customerId: "DEMO-KH-B",
        invoiceIds: ["DEMO-HD-B1"],
        amount: 1080000,
        content: "Tin B",
        status: "Chờ duyệt",
      },
    ]
    const result = engine.send(s, ["A", "B"])
    assert.equal(result.failed, 1)
    assert.equal(result.sent, 1)
    assert.equal(result.state.queue.length, 1)
    assert.equal(result.state.history.length, 2)
    assert.equal(engine.balance(result.state, "DEMO-KH-A"), 3240000)
  })
  test("Khoản nợ giảm một phần cần xác nhận lại trước khi gửi", () => {
    let s = engine.initialState()
    s.queue = [
      {
        id: "G",
        customerId: "KH-007",
        invoiceIds: ["HD-GOC-001"],
        amount: 7000000,
        content: "Nợ 7 triệu",
        template: "{So_Tien_No}",
        status: "Chờ duyệt",
      },
    ]
    s = engine.postReduction(s, "DEMO-GBC-CHIDINH", { "HD-GOC-001": 1000000 })
    const result = engine.send(s, ["G"])
    assert.equal(result.changed, true)
    assert.equal(result.sent, 0)
    assert.equal(result.state.queue[0].amount, 6000000)
  })
  test("Chặn mẫu còn biến Link thanh toán chưa cấu hình", () => {
    const s = engine.scan(engine.initialState())
    s.queue[0].content = "Thanh toán tại Chưa cấu hình"
    const result = engine.send(s, [s.queue[0].id])
    assert.equal(result.sent, 0)
    assert.equal(result.failed, 1)
    assert.match(result.state.queue[0].error, /chưa cấu hình/)
  })
  test("Thông báo dùng đúng tăng điều chỉnh, không coi ghi nhận mới là đã thanh toán", () => {
    let s = engine.initialState()
    s = engine.postIncrease(s, "CTBH-001").state
    let rows = engine.noticeRows(s, engine.debtRows(s, "KH-001"))
    assert.equal(rows[0].paid, 0)
    assert.equal(rows[0].increaseValid, 0)
    s = engine.postIncrease(s, "CTDC-001").state
    rows = engine.noticeRows(s, engine.debtRows(s, "KH-007"))
    assert.equal(rows[0].paid, 3000000)
    assert.equal(rows[0].increaseValid, 2000000)
    assert.equal(rows[0].outstanding, 9000000)
  })
  console.log("Hoàn tất toàn bộ kiểm tra logic bổ sung")
} finally {
  fs.rmSync(directory, { recursive: true, force: true })
}
