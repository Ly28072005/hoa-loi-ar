import {
  autoAllocation,
  available,
  balance,
  initialState,
  outstanding,
  postIncrease,
  postReduction,
  report,
  scan,
  send,
  type RecordData,
} from "./store"

export function runScenario(id: string) {
  let s = initialState()
  const assert = (value: boolean, message: string) => {
    if (!value) throw new Error(message)
  }
  const increase = (id: string) => {
    s = postIncrease(s, id).state
  }
  const reduce = (
    id: string,
    amounts?: Record<string, number>,
    extra: RecordData = {},
  ) => {
    const r = s.reductions.find((r: RecordData) => r.id === id)
    s = postReduction(s, id, amounts ?? autoAllocation(s, r), {
      date: s.clock,
      note: r.reason,
      ...extra,
    })
  }
  let explanation = ""
  switch (id) {
    case "E2E-01":
      assert(balance(s, "KH-007") === 7000000, "Số dư đầu không đúng")
      increase("CTDC-001")
      assert(balance(s, "KH-007") === 9000000, "Tăng không đúng 9 triệu")
      reduce("DEMO-GBC-GIAMHET", { "HD-GOC-001": 9000000 })
      assert(
        balance(s, "KH-007") === 0 && outstanding(s, "HD-GOC-001") === 0,
        "Chưa tất toán",
      )
      assert(
        s.journals.length === 3 &&
          report(s, s.clock, s.clock, "KH-007")[0].closing === 0,
        "Bút toán hoặc báo cáo không đồng bộ",
      )
      explanation =
        "7.000.000 → 9.000.000 → 0 VND, 1 bút toán tăng và 1 bút toán giảm mới, báo cáo đồng bộ"
      break
    case "UC01-NO-DUP":
      increase("CTBH-006")
      assert(
        s.journals.length === 1 &&
          s.intakes.length === 1 &&
          balance(s, "KH-008") === 5000000,
        "Ghi lại bút toán đã phản ánh",
      )
      try {
        postIncrease(s, "CTBH-006")
        throw new Error("Không chặn ghi trùng")
      } catch (e) {
        assert(
          (e as Error).message.includes("đã được tiếp nhận"),
          "Không chặn ghi trùng",
        )
      }
      explanation =
        "Tiếp nhận CTBH-006 không tăng lại 5 triệu, không tạo bút toán, lần hai bị chặn"
      break
    case "UC01-PREPAID":
      increase("CTBH-005")
      assert(
        balance(s, "KH-005") === 7000000 && s.allocations.length === 0,
        "Ứng trước bị tính lại",
      )
      explanation = "CTBH-005 còn 7 triệu, không sinh lại PB-005"
      break
    case "UC02-PARTIAL":
      reduce("DEMO-PT-A1")
      assert(
        balance(s, "DEMO-KH-A") === 2240000 &&
          outstanding(s, "DEMO-HD-A1") === 1160000 &&
          outstanding(s, "DEMO-HD-A2") === 1080000,
        "Phân bổ một phần không đúng",
      )
      explanation = "Trừ hóa đơn đến hạn sớm nhất, khách còn 2.240.000 VND"
      break
    case "UC02-OVERPAY":
      reduce("DEMO-GBC-A2")
      assert(
        balance(s, "DEMO-KH-A") === -760000 &&
          available(s, "DEMO-GBC-A2") === 760000 &&
          outstanding(s, "DEMO-HD-A1") === 0 &&
          outstanding(s, "DEMO-HD-A2") === 0,
        "Trả thừa bị tính hai lần",
      )
      explanation =
        "Hai hóa đơn tất toán, dư Có 760.000 VND, tiền chưa phân bổ 760.000 VND"
      break
    case "UC02-ADVANCE-THEN-INVOICE":
      reduce("DEMO-PT-TRUOC", {}, { note: "Trả trước chưa có hóa đơn" })
      assert(balance(s, "KH-001") === -1500000, "Trả trước không đúng")
      increase("CTBH-001")
      assert(balance(s, "KH-001") === 8500000, "Nợ sau ghi tăng không đúng")
      const journalCount = s.journals.length
      reduce("DEMO-PT-TRUOC", { "HD-001": 1500000 }, { allocationOnly: true })
      assert(
        balance(s, "KH-001") === 8500000 &&
          outstanding(s, "HD-001") === 8500000 &&
          s.journals.length === journalCount,
        "Phân bổ bị giảm lại khách hàng hoặc tạo bút toán",
      )
      explanation =
        "Dư Có 1,5 triệu → nợ 8,5 triệu, phân bổ không giảm lại số dư và không thêm bút toán"
      break
    case "UC02-RETURN-DISCOUNT":
      reduce("DEMO-PTH-B1", {})
      assert(balance(s, "DEMO-KH-B") === 864000, "Trả hàng sai")
      reduce("DEMO-BBGG-B1", {})
      assert(balance(s, "DEMO-KH-B") === 756000, "Giảm giá sai")
      reduce("DEMO-BBSS-B1", {})
      assert(balance(s, "DEMO-KH-B") === 648000, "Sai sót sai")
      explanation = "Giảm đúng hóa đơn gốc: 864.000 → 756.000 → 648.000 VND"
      break
    case "UC02-UNALLOCATED":
      reduce("DEMO-GBC-KHONGPB", {})
      assert(
        balance(s, "DEMO-KH-B") === 980000 &&
          outstanding(s, "DEMO-HD-B1") === 1080000 &&
          available(s, "DEMO-GBC-KHONGPB") === 100000,
        "Chưa phân bổ bị trừ hóa đơn",
      )
      explanation =
        "Khách còn 980.000 VND, hóa đơn vẫn 1.080.000 VND, tiền chưa phân bổ 100.000 VND"
      break
    case "UC03-IMMUTABLE":
      explanation =
        "Chưa tự động chạy, cần thao tác giao diện phản hồi và xác minh Bán hàng"
      return { state: s, status: "Chưa chạy", explanation }
    case "UC04-REVALIDATE":
      const before = balance(s, "KH-007")
      reduce("DEMO-GBC-CHIDINH", { "HD-GOC-001": 1000000 })
      assert(
        before === 7000000 &&
          balance(s, "KH-007") === 6000000 &&
          s.revision > 1,
        "Số dư hoặc phiên bản không cập nhật",
      )
      explanation =
        "7 triệu → 6 triệu và tăng phiên bản, cơ chế bản xem trước phát hiện stale. Chưa kiểm thử thao tác xuất trên trình duyệt"
      break
    case "UC04-REMINDER-SETTLED":
      increase("CTDC-001")
      s.queue.push({
        id: "TB-SETTLED",
        customerId: "KH-007",
        invoiceIds: ["HD-GOC-001"],
        amount: 9000000,
        status: "Chờ duyệt",
        template: "{So_Tien_No}",
        content: "9.000.000 VND",
        channel: "Zalo",
      })
      reduce("DEMO-GBC-GIAMHET", { "HD-GOC-001": 9000000 })
      const sent = send(s, ["TB-SETTLED"])
      assert(
        sent.sent === 0 && s.queue.length === 0,
        "Gửi nhắc khoản đã tất toán",
      )
      explanation = "Khoản tất toán được gỡ khỏi hàng đợi, số tin gửi bằng 0"
      break
    default:
      throw new Error("Ca thử chưa được ánh xạ")
  }
  return { state: s, status: "Đạt - logic", explanation }
}
