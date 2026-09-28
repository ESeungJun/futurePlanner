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
      loan: { label: "주담대·전세대출·정책대출", paths: ["loan"], asOf: "2026-09-28", nextReview: "2026-12-31",
        sources: ["https://www.fsc.go.kr", "https://nhuf.molit.go.kr", "https://www.hf.go.kr/ko/sub02/sub02_01_02.do"] },
      closing: { label: "취득세·중개보수·부대비용", paths: ["closing"], asOf: "2026-09-28", nextReview: "2026-12-31",
        sources: ["https://www.law.go.kr", "https://www.wetax.go.kr"] },
      payroll: { label: "4대보험 요율", paths: ["payroll"], asOf: "2026-09-28", nextReview: "2027-01-15",
        sources: ["https://www.nps.or.kr", "https://www.nhis.or.kr"] },
      incomeTax: { label: "근로소득세", paths: ["incomeTax"], asOf: "2026-09-28", nextReview: "2027-01-15",
        sources: ["https://www.nts.go.kr"] },
      gift: { label: "증여세", paths: ["gift"], asOf: "2026-09-28", nextReview: "2027-01-15",
        sources: ["https://www.nts.go.kr"] },
      pension: { label: "연금저축·IRP 세액공제", paths: ["pension"], asOf: "2026-09-28", nextReview: "2027-01-15",
        sources: ["https://www.nts.go.kr"] },
      subscription: { label: "청약통장·특별공급 소득 기준", paths: ["subscription", "specialSupply"], asOf: "2026-09-28", nextReview: "2027-04-30",
        sources: ["https://www.applyhome.co.kr", "https://apply.lh.or.kr"] },
      youth: { label: "청년·가구 중위소득 기준", paths: ["youth"], asOf: "2026-09-28", nextReview: "2027-01-15",
        sources: ["https://www.mohw.go.kr", "https://www.kinfa.or.kr"] },
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
      "youth.median2pMonthlyWon": "2인 가구 기준 중위소득(월)", "youth.youthFutureDualPct": "청년미래적금 맞벌이 가구 배율(%)", "youth.youthFuturePersonalMaxMan": "청년미래적금 개인 총급여 상한(일반형)",
    },

    loan: {
      asOf: "2026-09 공식 공고 기준",
      mortgage: {
        ltvFirst: 0.7, ltvRegular: 0.4, dsr: 0.4, years: 30, stressFloorPct: 3,
        // 가격구간 하드캡(2025.10.16~): 주택가격 upToWon 이하면 capWon까지
        hardCaps: [{ upToWon: 1_500_000_000, capWon: 600_000_000 }, { upToWon: 2_500_000_000, capWon: 400_000_000 }, { upToWon: null, capWon: 200_000_000 }],
        rules: ["LTV: 규제지역(서울 전역·과천 등 경기 12곳, 2025.10.16~) 무주택 40%, 생애최초 70%(6개월 내 전입)", "가격구간 하드캡(2025.10.16~): 15억 이하 6억 · 25억 이하 4억 · 초과 2억", "토지거래허가구역(서울 전역·경기 12곳 아파트, 2025.10.20~2026.12.31): 매수 시 허가 + 2년 실거주 — 전세 끼고 매수(갭) 불가", "DSR 40% — 스트레스 가산금리 100% 반영(3단계, 2025.7~), 수도권·규제지역 주담대 스트레스 금리 하한 3%(2025.10.16~), 30년 원리금균등 환산"],
      },
      jeonse: {
        ratio: 0.8, capWon: 400_000_000, publicGuaranteeMaxWon: 700_000_000,
        rules: ["은행 전세대출: 보증금의 80% 이내, 보증기관 한도 최대 4억(HF 일반전세자금보증 — 소득 기반 산식, 수도권·규제지역은 8/9만 인정)", "집이 있는 채로 수도권·규제지역에서 전세대출을 받으면 이자상환분이 DSR에 반영(2025.10~), HF 1주택자 한도 2억", "HF·HUG 전세보증은 수도권 보증금 7억 이하만 — 초과 시 SGI 등 민간보증으로만 대출", "보증보험(HUG) 가입 가능한 전세가율 90% 이하 매물 권장"],
      },
      // 정책대출 판정 — incomeMax(만원)·priceMax(원). incomeMaxSingle: 외벌이 상한, perPersonMax: 1인 상한. cond는 안내용 추가 요건.
      programs: [
        { name: "신생아 특례 디딤돌", deal: "매매", incomeMax: 20000, incomeMaxSingle: 13000, perPersonMax: 13000, priceMax: 900_000_000, limit: 400_000_000, cond: "2년 내 출산 · 85㎡ 이하 · 순자산 5.11억 이하" },
        { name: "신혼부부 디딤돌", deal: "매매", incomeMax: 8500, priceMax: 600_000_000, limit: 320_000_000, cond: "혼인 7년 내 · 순자산 5.11억 이하" },
        // anyPersonMax: 합산이 넘어도 부부 중 한 명 소득이 이 이하면 그 배우자 단독 차주로 가능 (2026.10.19 신청분~, 상환능력은 차주 1인 기준)
        { name: "보금자리론", deal: "매매", incomeMax: 8500, anyPersonMax: 7000, anyPersonFrom: "2026-10-19", priceMax: 600_000_000, limit: 360_000_000, cond: "신혼 합산 8,500만 이하 — 넘으면 소득 7천만 이하 배우자 단독 차주(2026.10.19~, 한도는 그 배우자 소득으로 심사)" },
        { name: "신생아 특례 버팀목", deal: "전세", incomeMax: 20000, incomeMaxSingle: 13000, priceMax: 500_000_000, limit: 240_000_000, cond: "2년 내 출산 · 순자산 3.45억 이하" },
        { name: "신혼부부 버팀목", deal: "전세", incomeMax: 7500, priceMax: 400_000_000, limit: 250_000_000, cond: "혼인 7년 내 · 수도권 · 순자산 3.45억 이하" },
      ],
    },

    closing: {
      moveCostWon: 2_000_000,
      // 무주택·85㎡ 이하 취득세: lowMaxWon 이하 lowRate, highMinWon 초과 highRate, 사이는 (억 × 2/3 − 3)% 선형. 지방교육세 10% 가산
      acqTax: { lowMaxWon: 600_000_000, lowRate: 0.01, highMinWon: 900_000_000, highRate: 0.03, eduSurcharge: 0.1 },
      firstTimeRelief: { maxPriceWon: 1_200_000_000, amountWon: 2_000_000, until: "2028-12-31" },
      // 중개보수 상한: 가격 upToWon 미만이면 rate, capWon 있으면 그 한도액까지 (부가세 별도)
      brokerSale: [{ upToWon: 50_000_000, rate: 0.006, capWon: 250_000 }, { upToWon: 200_000_000, rate: 0.005, capWon: 800_000 }, { upToWon: 900_000_000, rate: 0.004 }, { upToWon: 1_200_000_000, rate: 0.005 }, { upToWon: 1_500_000_000, rate: 0.006 }, { upToWon: null, rate: 0.007 }],
      brokerLease: [{ upToWon: 50_000_000, rate: 0.005, capWon: 200_000 }, { upToWon: 100_000_000, rate: 0.004, capWon: 300_000 }, { upToWon: 600_000_000, rate: 0.003 }, { upToWon: 1_200_000_000, rate: 0.004 }, { upToWon: 1_500_000_000, rate: 0.005 }, { upToWon: null, rate: 0.006 }],
    },

    payroll: { npCapMonthlyWon: 6_590_000, npRate: 0.0475, hiRate: 0.03595, ltciRatio: 0.1314, eiRate: 0.009 },

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

    subscription: { deposit85Man: 200, monthlyCreditMan: 25 },
    specialSupply: {
      incomeBaseYear: "2025년(전년도)",
      incomeBase100: { 2: 5_866_270, 3: 8_168_429, 4: 8_802_202, 5: 9_326_985 },
      newlywedPct: { single: 140, dual: 160 }, // 신혼특공 일반공급 상한 (분양은 3인 이하도 3인 기준)
      // 특공 소득 구간(% of 3인 이하 기준) — 청약홈 특별공급 안내(2026-09 확인). 초과하면 추첨 물량(부동산가액 상한 이하)
      tiers: {
        newlywed: { priority: { single: 100, dual: 120 }, general: { single: 140, dual: 160 } }, // 민영
        firstHome: { priority: 130, general: 160 },       // 민영 생애최초
        firstHomePublic: { priority: 100, general: 130 }, // 국민(공공)주택 생애최초
      },
      lotteryPropertyCapWon: 331_000_000, // 소득 초과 시 추첨제 — 세대 부동산가액 합계 상한
    },

    youth: { median2pMonthlyWon: 4_199_000, youthFutureDualPct: 250, youthFuturePersonalMaxMan: 6000 },
  };
})(typeof module !== "undefined" && module.exports ? module.exports : window);
