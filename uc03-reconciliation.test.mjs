import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import ts from "typescript"

const compiled = ts.transpileModule(
  fs.readFileSync("src/uc03/reconciliationModel.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText
const m = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
)

test("customer records have consistent balances and aging totals", () => {
  const state = m.initialReconciliationState()
  assert.equal(state.customers.length, 8)
  for (const record of state.customers) {
    assert.equal(
      m.closingBalance(record),
      record.opening + m.totalIncrease(record) - m.totalDecrease(record),
    )
    assert.equal(
      record.aging.reduce((sum, item) => sum + (item.value || 0), 0),
      m.closingBalance(record),
    )
  }
})

test("external reconciliation covers matches, differences and invalid data", () => {
  const results = m.reconcileFile(m.externalRows)
  assert.equal(results.length, 8)
  assert.equal(results.filter((row) => row.status === "Khớp").length, 2)
  assert.ok(results.some((row) => /Ngày chứng từ/.test(row.reason)))
  assert.ok(results.some((row) => /Số chứng từ/.test(row.reason)))
  assert.ok(results.some((row) => /Số tiền/.test(row.reason)))
  assert.ok(results.some((row) => /Số dư/.test(row.reason)))
  assert.ok(results.some((row) => /Không tìm thấy/.test(row.reason)))
  assert.equal(results.at(-1).status, "Lỗi dữ liệu")
})

test("AR cross-check only passes complete and consistent report sets", () => {
  assert.equal(m.checkReports("difference").status, "Nhất quán")
  assert.equal(m.checkReports("match").status, "Nhất quán")
  assert.equal(m.checkReports("ar-difference").status, "Có chênh lệch")
  assert.equal(m.checkReports("missing").status, "Chưa đủ dữ liệu")
})

test("internal run derives totals and differences from the selected scenario", () => {
  const state = m.initialReconciliationState()
  state.internal.period = "10/2026"
  const cross = m.checkReports("difference")
  const different = m.runInternal(state.internal, cross)
  assert.equal(different.differences.length, 2)
  assert.equal(
    different.salesIncrease - different.arIncrease,
    different.differences[0].sales - different.differences[0].ar,
  )
  state.internal.scenario = "match"
  const matched = m.runInternal(state.internal, m.checkReports("match"))
  assert.equal(matched.differences.length, 0)
  assert.equal(matched.salesIncrease, matched.arIncrease)
  assert.equal(matched.salesDecrease, matched.arDecrease)
})
