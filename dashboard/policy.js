/*
 * 정책 기본값 — 대출 규제·세율·요율·소득 기준표처럼 해마다 바뀌는 숫자를 한곳에 모은 데이터.
 * 계산식은 app.jsx에 있고, 숫자는 전부 여기서 읽는다.
 *
 * 실제로 쓰는 값 = 이 기본값 + 부부가 [반영]한 변경(클라우드 키 policy-overrides-v1, 경로별 덮어쓰기).
 * 그래서 값이 바뀌면 코드를 고치거나 재배포하지 않고 앱의 "정책 데이터" 화면에서 반영하면 된다.
 * 서버(functions)는 배포 때 이 파일을 복사해 정책 점검(웹 검색 대조)에 쓴다 — scripts/predeploy-check.js.
 *
 * 규칙: 금액 단위는 이름에 붙인다(…Won 원, …Man 만원). 비율은 소수(0.4 = 40%). 구간표의 마지막 upTo는 null(상한 없음).
 * sections: 점검 단위. nextReview가 지나면 화면에 "확인 필요"가 뜨고 주간 점검이 우선 확인한다.
 */
(function (root) {
  root.POLICY_DEFAULT = {
    version: "2026-09-28",
    sections: {
      loan: { label: "주담대·전세대출·정책대출", paths: ["loan"], asOf: "2026-09-29", nextReview: "2026-12-31",
        sources: ["https://www.fsc.go.kr", "https://nhuf.molit.go.kr", "https://www.hf.go.kr/ko/sub02/sub02_01_02.do"] },
      closing: { label: "취득세·중개보수·부대비용", paths: ["closing"], asOf: "2026-09-29", nextReview: "2026-12-31",
        sources: ["https://www.law.go.kr", "https://www.wetax.go.kr"] },
      payroll: { label: "4대보험 요율", paths: ["payroll"], asOf: "2026-09-29", nextReview: "2027-01-15",
        sources: ["https://www.nps.or.kr", "https://www.nhis.or.kr"] },
      incomeTax: { label: "근로소득세", paths: ["incomeTax"], asOf: "2026-09-29", nextReview: "2027-01-15",
        sources: ["https://www.nts.go.kr"] },
      gift: { label: "증여세", paths: ["gift"], asOf: "2026-09-29", nextReview: "2027-01-15",
        sources: ["https://www.nts.go.kr"] },
      pension: { label: "연금저축·IRP 세액공제", paths: ["pension"], asOf: "2026-09-29", nextReview: "2027-01-15",
        sources: ["https://www.nts.go.kr"] },
      subscription: { label: "청약통장·특별공급 소득 기준", paths: ["subscription", "specialSupply"], asOf: "2026-09-29", nextReview: "2027-04-30",
        sources: ["https://www.applyhome.co.kr", "https://apply.lh.or.kr"] },
      youth: { label: "청년·가구 중위소득 기준", paths: ["youth"], asOf: "2026-09-29", nextReview: "2027-01-15",
        sources: ["https://www.mohw.go.kr", "https://www.kinfa.or.kr"] },
      savingDefaults: { label: "저축 금리·이자 세금 기본값", paths: ["savingDefaults"], asOf: "2026-09-29", nextReview: "2027-01-15",
        sources: ["https://www.epeopletoday.com/news/articleView.html?idxno=22290", "https://www.molit.go.kr", "https://www.nts.go.kr"] },
    },
    // 화면·점검 결과에 보여 줄 이름 (경로 → 한글). 없는 경로는 경로 그대로 보인다.
    labels: {
      "loan.mortgage.ltvRegular": "규제지역 무주택 LTV", "loan.mortgage.ltvFirst": "생애최초 LTV", "loan.mortgage.dsr": "DSR 한도",
      "loan.mortgage.years": "DSR 환산 만기(년)", "loan.mortgage.hardCaps": "가격구간 대출 하드캡", "loan.mortgage.stressFloorPct": "스트레스 금리 하한(%)",
      "loan.jeonse.ratio": "전세대출 보증금 비율", "loan.jeonse.capWon": "전세보증 한도", "loan.jeonse.publicGuaranteeMaxWon": "HF·HUG 보증 보증금 상한",
      "loan.programs": "정책대출 소득·가격·한도",
      "closing.moveCostWon": "이사비 가정", "closing.acqTax": "취득세 구간", "closing.firstTimeRelief": "생애최초 취득세 감면",
      "closing.brokerSale": "매매 중개보수 상한", "closing.brokerLease": "임대차 중개보수 상한",
      "payroll.npCapMonthlyWon": "국민연금 기준소득월액 상한", "payroll.npRate": "국민연금 근로자 요율", "payroll.hiRate": "건강보험 근로자 요율",
      "payroll.ltciRatio": "장기요양(건보료 대비)", "payroll.eiRate": "고용보험 근로자 요율",
      "incomeTax.brackets": "종합소득세율 구간", "incomeTax.creditCaps": "근로소득세액공제 한도",
      "gift.brackets": "증여세율 구간", "gift.filingCredit": "증여세 신고세액공제", "gift.spouseExemptionMan": "배우자 증여공제(10년)",
      "pension.thresholdMan": "공제율 기준 총급여", "pension.rateLow": "세액공제율(기준 이하)", "pension.rateHigh": "세액공제율(기준 초과)",
      "pension.psLimitMan": "연금저축 공제 한도", "pension.totalLimitMan": "연금저축+IRP 공제 한도",
      "subscription.deposit85Man": "민영 85㎡ 이하 예치금(경기 기타)", "subscription.monthlyCreditMan": "청약통장 월 납입 인정액",
      "specialSupply.incomeBase100": "도시근로자 가구원수별 월평균소득 100%", "specialSupply.incomeBaseYear": "소득 기준표 연도",
      "specialSupply.newlywedPct": "신혼특공 소득 배율(%)", "specialSupply.tiers": "특공 소득 구간(우선·일반)", "specialSupply.lotteryPropertyCapWon": "특공 추첨 부동산가액 상한",
      "specialSupply.dualEachMaxPct": "맞벌이 1인 소득 상한(%)", "specialSupply.privateShare": "민영 특공 공급 비율(%)", "specialSupply.preMarriedNewlywed": "예비신혼부부 신혼특공 가능 여부",
      "specialSupply.specialOnceExceptions": "특공 1회 제한 예외", "subscription.minorCredit": "미성년 가입 인정 한도",
      "youth.median2pMonthlyWon": "2인 가구 기준 중위소득(월)", "youth.youthFutureDualPct": "청년미래적금 맞벌이 가구 배율(%)", "youth.youthFuturePersonalMaxMan": "청년미래적금 개인 총급여 상한",
      "savingDefaults.interestTaxRate": "이자소득세율(지방세 포함)", "savingDefaults.subscriptionRates": "청약통장 가입기간별 금리(%)",
      "savingDefaults.isaTaxFreeMan": "ISA 비과세 한도(일반형·서민형)", "savingDefaults.isaOverRate": "ISA 비과세 초과분 분리과세율",
    },

    loan: {
      asOf: "2026-09-29 공식 공고 기준",
      mortgage: {
        ltvFirst: 0.7, ltvRegular: 0.4, dsr: 0.4, years: 30, stressFloorPct: 3,
        // 가격구간 하드캡(2025.10.16~): 주택가격 upToWon 이하면 capWon까지
        hardCaps: [{ upToWon: 1_500_000_000, capWon: 600_000_000 }, { upToWon: 2_500_000_000, capWon: 400_000_000 }, { upToWon: null, capWon: 200_000_000 }],
        rules: ["LTV(집값 대비 대출 비율): 규제지역(서울 전역, 경기 15곳: 과천 등 12곳은 2025.10.16부터, 화성 동탄구·용인 기흥구·구리는 2026.7.1부터)은 무주택자 40%, 생애최초 70%예요. 생애최초는 대출 후 6개월 안에 전입해야 해요.", "가격구간 하드캡(2025.10.16~): 15억 이하 6억 · 25억 이하 4억 · 초과 2억", "토지거래허가구역(서울 전역·경기 12곳은 2026.12.31까지, 동탄구·기흥구·구리는 2026.7.5~2027.12.31)에서 아파트를 사려면 허가를 받고 2년 동안 직접 살아야 해요. 세입자가 있는 집은 2026.5.12부터 계속 무주택인 사람만 남은 임대기간(갱신 1회·최대 2년)까지 입주를 미룰 수 있고 신청은 2027.12.31까지예요. 이 경우 6개월 안 전입이 조건인 주담대는 받기 어려워요.","DSR 40% — 스트레스 가산금리 100% 반영(3단계, 2025.7~), 수도권·규제지역 주담대 스트레스 금리 하한 3%(2025.10.16~), 30년 원리금균등 환산"],
      },
      jeonse: {
        ratio: 0.8, capWon: 400_000_000, publicGuaranteeMaxWon: 700_000_000,
        rules: ["은행 전세대출: 보증금의 80% 이내, 보증기관 한도 최대 4억(HF 일반전세자금보증 — 소득 기반 산식, 수도권·규제지역은 8/9만 인정)", "집이 있는 채로 수도권·규제지역에서 전세대출을 받으면 이자가 DSR에 들어가요(2025.10.29~). HF 보증 한도도 1주택자는 수도권·규제지역 1.8억(그 외 2억)이에요.", "HF·HUG 전세보증은 수도권 보증금 7억 이하만 — 초과 시 SGI 등 민간보증으로만 대출", "보증금과 앞선 대출(선순위 채권)을 합친 금액이 집값의 90% 이내여야 HUG 반환보증에 가입할 수 있어요. 빌라·다세대는 공시가격의 126%가 사실상 상한이에요."],
      },
      // 정책대출 판정 — incomeMax(만원)·priceMax(원). incomeMaxSingle: 외벌이 상한, perPersonMax: 1인 상한. cond는 안내용 추가 요건.
      programs: [
        { name: "신생아 특례 디딤돌", deal: "매매", incomeMax: 20000, incomeMaxSingle: 13000, perPersonMax: 13000, priceMax: 900_000_000, limit: 400_000_000, cond: "신청일 기준 2년 안에 출산한 가구 · 전용 85㎡ 이하 · 순자산 5.11억 원 이하" },
        { name: "신혼부부 디딤돌", deal: "매매", incomeMax: 8500, priceMax: 600_000_000, limit: 320_000_000, cond: "혼인신고일로부터 7년 이내 · 순자산 5.11억 원 이하 · 전용 85㎡ 이하" },
        // anyPersonMax: 합산이 넘어도 부부 중 한 명 소득이 이 이하면 그 배우자 단독 차주로 가능 (2026.10.19 신청분~, 상환능력은 차주 1인 기준)
        { name: "보금자리론", deal: "매매", incomeMax: 8500, anyPersonMax: 7000, anyPersonFrom: "2026-10-19", priceMax: 600_000_000, limit: 360_000_000, cond: "신혼부부 연소득 합산 8,500만 원 이하. 넘으면 연소득 7천만 원 이하인 배우자가 혼자 대출받는 사람(단독 차주)이 되면 가능(2026.10.19 신청분부터, 한도는 그 배우자 소득으로 심사)" },
        { name: "신생아 특례 버팀목", deal: "전세", incomeMax: 20000, incomeMaxSingle: 13000, perPersonMax: 13000, priceMax: 500_000_000, limit: 240_000_000, cond: "신청일 기준 2년 안에 출산한 가구 · 보증금 수도권 5억·그 외 4억 이하 · 순자산 3.45억 원 이하" },
        { name: "신혼부부 버팀목", deal: "전세", incomeMax: 7500, priceMax: 400_000_000, limit: 250_000_000, cond: "혼인신고일로부터 7년 이내 · 수도권 · 순자산 3.45억 원 이하" },
      ],
    },

    closing: {
      moveCostWon: 2_000_000,
      // 무주택·85㎡ 이하 취득세: lowMaxWon 이하 lowRate, highMinWon 초과 highRate, 사이는 (억 × 2/3 − 3)% 선형. 지방교육세 10% 가산
      acqTax: { lowMaxWon: 600_000_000, lowRate: 0.01, highMinWon: 900_000_000, highRate: 0.03, eduSurcharge: 0.1 },
      // 생애최초 감면: 12억 이하 최대 200만. 소형(전용 60㎡ 이하·수도권 6억(그 외 3억) 이하 공동주택)은 300만(지특법 제36조의3) — 면적 입력이 없어 계산은 200만 기준
      firstTimeRelief: { maxPriceWon: 1_200_000_000, amountWon: 2_000_000, smallAmountWon: 3_000_000, until: "2028-12-31" },
      // 중개보수 상한: 가격 upToWon 미만이면 rate, capWon 있으면 그 한도액까지 (부가세 별도)
      brokerSale: [{ upToWon: 50_000_000, rate: 0.006, capWon: 250_000 }, { upToWon: 200_000_000, rate: 0.005, capWon: 800_000 }, { upToWon: 900_000_000, rate: 0.004 }, { upToWon: 1_200_000_000, rate: 0.005 }, { upToWon: 1_500_000_000, rate: 0.006 }, { upToWon: null, rate: 0.007 }],
      brokerLease: [{ upToWon: 50_000_000, rate: 0.005, capWon: 200_000 }, { upToWon: 100_000_000, rate: 0.004, capWon: 300_000 }, { upToWon: 600_000_000, rate: 0.003 }, { upToWon: 1_200_000_000, rate: 0.004 }, { upToWon: 1_500_000_000, rate: 0.005 }, { upToWon: null, rate: 0.006 }],
    },

    payroll: { npCapMonthlyWon /* 2026.7~2027.6 적용 */: 6_590_000, npRate: 0.0475, hiRate: 0.03595, ltciRatio: 0.1314, eiRate: 0.009 },

    incomeTax: {
      brackets: [
        { upTo: 14_000_000, rate: 0.06, deduction: 0 }, { upTo: 50_000_000, rate: 0.15, deduction: 1_260_000 },
        { upTo: 88_000_000, rate: 0.24, deduction: 5_760_000 }, { upTo: 150_000_000, rate: 0.35, deduction: 15_440_000 },
        { upTo: 300_000_000, rate: 0.38, deduction: 19_940_000 }, { upTo: 500_000_000, rate: 0.40, deduction: 25_940_000 },
        { upTo: 1_000_000_000, rate: 0.42, deduction: 35_940_000 }, { upTo: null, rate: 0.45, deduction: 65_940_000 },
      ],
      // 근로소득세액공제 한도: 총급여 overWon 초과 구간에서 base − (총급여 − overWon) × slope, 최소 min
      creditCaps: [{ overWon: 0, base: 740_000, slope: 0, min: 740_000 }, { overWon: 33_000_000, base: 740_000, slope: 0.008, min: 660_000 },
        { overWon: 70_000_000, base: 660_000, slope: 0.5, min: 500_000 }, { overWon: 120_000_000, base: 500_000, slope: 0.5, min: 200_000 }],
    },

    gift: {
      brackets: [
        { upTo: 100_000_000, rate: 0.10, deduction: 0 }, { upTo: 500_000_000, rate: 0.20, deduction: 10_000_000 },
        { upTo: 1_000_000_000, rate: 0.30, deduction: 60_000_000 }, { upTo: 3_000_000_000, rate: 0.40, deduction: 160_000_000 },
        { upTo: null, rate: 0.50, deduction: 460_000_000 },
      ],
      filingCredit: 0.03, spouseExemptionMan: 60000,
    },

    pension: { thresholdMan: 5500, rateLow: 0.165, rateHigh: 0.132, psLimitMan: 600, totalLimitMan: 900 },

    // minorCredit: 미성년 때 가입한 기간은 민영 가점에 최대 5년, 납입은 공공 순위에 최대 60회 인정(2024.3.25~)
    subscription: { deposit85Man: 200, monthlyCreditMan: 25, minorCredit: { privatePeriodYears: 5, publicCount: 60 } },
    specialSupply: {
      incomeBaseYear: "2025년 기준(2026년 공고 적용)",
      // 임대 공고는 1인 ×1.2·2인 ×1.1 가산
      incomeBase100: { 1: 3_813_363, 2: 5_866_270, 3: 8_168_429, 4: 8_802_202, 5: 9_326_985 },
      // 맞벌이라도 한 사람 소득이 우선공급은 100%, 일반공급은 140% 이하 — 운용지침 제9조⑤
      dualEachMaxPct: { priority: 100, general: 140 },
      // 2026.6.15~ 민영 특공 비율(%)
      privateShare: { newborn: 10, newlywed: 15, firstHomePublicLand: 17, firstHomePrivateLand: 7 },
      // 특공 당첨은 원칙적으로 세대당 1회. 예외 ① 혼인신고 전 당첨 이력이 있어도 신혼특공 1회 더 ② 2024.6.19 이후 출생 자녀가 있으면 1회 더
      // ③ 배우자의 혼인 전 당첨 이력은 신생아·신혼·생애최초 특공에서 안 따짐 (규칙 제55조의3, 2025.3.31)
      specialOnceExceptions: "특공 당첨은 원칙적으로 세대당 1회. 예외: 혼인신고 전 당첨 이력이 있어도 신혼특공 1회 더, 2024.6.19 이후 출생 자녀가 있으면 1회 더, 배우자의 혼인 전 당첨 이력은 신생아·신혼·생애최초 특공에서 안 따짐(규칙 제55조의3, 2025.3.31)",
      newlywedPct: { single: 140, dual: 160 }, // 신혼특공 일반공급 상한 (분양은 3인 이하도 3인 기준)
      // 특공 소득 구간(% of 3인 이하 기준) — 청약홈 특별공급 안내(2026-09 확인). 초과하면 추첨 물량(부동산가액 상한 이하)
      tiers: {
        newlywed: { priority: { single: 100, dual: 120 }, general: { single: 140, dual: 160 } }, // 민영
        firstHome: { priority: 130, general: 160 },       // 민영 생애최초
        firstHomePublic: { priority: 100, general: 130 }, // 국민(공공)주택 생애최초
        newborn: { priority: 130, general: 160 },         // 민영 신생아 특공(규칙 제35조의3)
        newbornPublic: { priority: 100, general: 130 },   // 공공 신생아 특공
        // 미혼 1인 가구 생애최초 — 추첨제로만, 단독세대는 전용 60㎡ 이하. 공공주택특별법 적용 공공주택은 1인 가구 불가(혼인·자녀 필요)
        // lotteryOverIncomeWithPropertyCap: 160% 초과도 부동산가액 3.31억 이하면 추첨 가능(규칙 제43조③2나·④3)
        firstHomeSingle: { privatePct: 160, nationalPct: 130, maxAreaM2: 60, lotteryOverIncomeWithPropertyCap: true },
      },
      // 예비신혼부부 신혼특공 — 공공주택특별법 공공분양(뉴:홈·신혼희망타운)만. 민영·국민주택 신혼특공은 불가(혼인 7년 이내만)
      preMarriedNewlywed: { private: false, national: false, publicHousingAct: true },
      lotteryPropertyCapWon: 331_000_000, // 소득 초과 시 추첨제 — 세대 부동산가액 합계 상한
    },

    // 저축 시뮬레이터 기본값. 청약통장 금리는 가입기간(개월) upToMonths 미만이면 ratePct (국토교통부, 2024.9.23 인상 후 유지, 2026.9 확인)
    // 예적금·ISA·연금은 상품마다 달라 기본 금리를 두지 않는다(사용자가 약정 금리·예상 수익률을 적는다)
    savingDefaults: {
      interestTaxRate: 0.154,
      subscriptionRates: [{ upToMonths: 12, ratePct: 2.3 }, { upToMonths: 24, ratePct: 2.8 }, { upToMonths: null, ratePct: 3.1 }],
      isaTaxFreeMan: { normal: 200, low: 400 }, isaOverRate: 0.099,
    },

    youth: { median2pMonthlyWon: 4_199_292, youthFutureDualPct: 250, youthFuturePersonalMaxMan: 7500 },
  };
})(typeof module !== "undefined" && module.exports ? module.exports : window);
