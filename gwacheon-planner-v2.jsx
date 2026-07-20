import React, { useState, useEffect } from "react";
import {
  TrendingUp, Calculator, Calendar, CheckSquare, Home,
  AlertTriangle, ChevronRight, Square, CheckSquare2, Info
} from "lucide-react";

// ============== helpers ==============
const won = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "-";
  const eok = Math.floor(n / 100000000);
  const man = Math.round((n % 100000000) / 10000);
  if (eok > 0) return `${eok.toLocaleString()}억${man > 0 ? " " + man.toLocaleString() + "만" : ""}`;
  return `${man.toLocaleString()}만원`;
};
const wonShort = (n) => (n === null || n === undefined ? "확인 필요" : (n / 100000000).toFixed(1) + "억");

function priceTierCap(price) {
  if (price <= 1_500_000_000) return 600_000_000;
  if (price <= 2_500_000_000) return 400_000_000;
  return 200_000_000;
}
function loanFromMonthlyPayment(monthlyPayment, annualRatePct, years) {
  const i = annualRatePct / 100 / 12;
  const n = years * 12;
  if (i <= 0) return monthlyPayment * n;
  return monthlyPayment * (1 - Math.pow(1 + i, -n)) / i;
}
const GIFT_TAX_BRACKETS = [
  { upTo: 100_000_000, rate: 0.10, deduction: 0 },
  { upTo: 500_000_000, rate: 0.20, deduction: 10_000_000 },
  { upTo: 1_000_000_000, rate: 0.30, deduction: 60_000_000 },
  { upTo: 3_000_000_000, rate: 0.40, deduction: 160_000_000 },
  { upTo: Infinity, rate: 0.50, deduction: 460_000_000 },
];
function giftTax(base) {
  if (base <= 0) return 0;
  const b = GIFT_TAX_BRACKETS.find(x => base <= x.upTo);
  return Math.max(0, base * b.rate - b.deduction);
}

// ---- 세후(실수령) 추정: 4대보험 + 근로소득세 간이 계산 (2026년 요율 기준, 1인 근로자·본인공제만 가정) ----
const INCOME_TAX_BRACKETS = [
  { upTo: 14_000_000, rate: 0.06, deduction: 0 },
  { upTo: 50_000_000, rate: 0.15, deduction: 1_260_000 },
  { upTo: 88_000_000, rate: 0.24, deduction: 5_760_000 },
  { upTo: 150_000_000, rate: 0.35, deduction: 15_440_000 },
  { upTo: 300_000_000, rate: 0.38, deduction: 19_940_000 },
  { upTo: 500_000_000, rate: 0.40, deduction: 25_940_000 },
  { upTo: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { upTo: Infinity, rate: 0.45, deduction: 65_940_000 },
];
function estimateNetAnnual(grossAnnualWon) {
  const g = Math.max(0, grossAnnualWon);
  const monthlyGross = g / 12;
  // 4대보험 (근로자 부담분, 2026년 요율)
  const npBase = Math.min(monthlyGross, 6_370_000);
  const np = npBase * 0.0475;
  const hi = monthlyGross * 0.03595;
  const ltci = hi * 0.1295;
  const ei = monthlyGross * 0.009;
  const insuranceAnnual = (np + hi + ltci + ei) * 12;

  // 근로소득공제
  let deduction;
  if (g <= 5_000_000) deduction = g * 0.7;
  else if (g <= 15_000_000) deduction = 3_500_000 + (g - 5_000_000) * 0.4;
  else if (g <= 45_000_000) deduction = 7_500_000 + (g - 15_000_000) * 0.15;
  else if (g <= 100_000_000) deduction = 12_000_000 + (g - 45_000_000) * 0.05;
  else deduction = 14_750_000 + (g - 100_000_000) * 0.02;
  const earnedIncomeAmount = Math.max(0, g - deduction);

  // 종합소득공제(본인 인적공제 150만원 + 4대보험료 전액)
  const taxBase = Math.max(0, earnedIncomeAmount - 1_500_000 - insuranceAnnual);

  const b = INCOME_TAX_BRACKETS.find(x => taxBase <= x.upTo);
  let incomeTax = Math.max(0, taxBase * b.rate - b.deduction);

  // 근로소득세액공제(간이 적용)
  let credit = incomeTax <= 1_300_000 ? incomeTax * 0.55 : 715_000 + (incomeTax - 1_300_000) * 0.3;
  let creditCap = 740_000;
  if (g > 33_000_000) creditCap = Math.max(660_000, 740_000 - (g - 33_000_000) * 0.008);
  if (g > 70_000_000) creditCap = Math.max(500_000, 660_000 - (g - 70_000_000) * 0.5 / 100);
  credit = Math.min(credit, creditCap);
  incomeTax = Math.max(0, incomeTax - credit);
  const totalTax = incomeTax * 1.1; // 지방소득세 10% 포함

  return g - insuranceAnnual - totalTax;
}

// ============== data ==============
const TABS = [
  { id: "diag", label: "진단", icon: AlertTriangle },
  { id: "strategy", label: "전략·혜택", icon: TrendingUp },
  { id: "wealth", label: "자산관리", icon: Home },
  { id: "loan", label: "대출계산기", icon: Calculator },
  { id: "timeline", label: "타임라인", icon: Calendar },
  { id: "checklist", label: "체크리스트", icon: CheckSquare },
];

const TARGETS = [
  { key: "sale84", label: "매매 · 84㎡(34평)", price: 2_600_000_000, note: "과천자이·써밋 등 준신축 실거래 평균" },
  { key: "sale59", label: "매매 · 59㎡(25평)", price: 2_000_000_000, note: "센트럴파크 푸르지오써밋 등 실거래 기준" },
  { key: "sub84", label: "청약(일반분양) · 84㎡", price: 1_590_000_000, note: "3기 재건축 4단지 분양가 추정" },
  { key: "jeonse59", label: "전세 · 59㎡ (대장주)", price: 880_000_000, note: "위버필드·자이 등 실거래 평균" },
  { key: "jeonse59budget", label: "전세 · 59㎡ (절충)", price: 640_000_000, note: "래미안슈르 등 연식 있는 단지" },
];

const JEONSE_OPTIONS = [
  { name: "과천위버필드", area: "원문동 · 2021년", price: 880_000_000, note: "대공원 인접, 4호선 도보 9분" },
  { name: "과천자이", area: "별양동 · 2022년", price: 890_000_000, note: "과천역 도보 7분" },
  { name: "센트럴파크 푸르지오써밋", area: "부림동 · 2020년", price: 800_000_000, note: "관악산 조망, 커뮤니티 우수" },
  { name: "래미안슈르", area: "원문동 · 2008년", price: 640_000_000, note: "연식 있지만 가격 메리트 큼" },
  { name: "과천르센토데시앙", area: "갈현동 지식정보타운 · 2023년", price: 700_000_000, note: "신축, 본도심보다 저렴, 상권은 약함" },
  { name: "인덕원역 생활권", area: "안양 동안구·의왕", price: null, note: "과천 인근, 더 저렴할 가능성 높음(확인 필요)" },
];

const STRATEGIES = [
  {
    title: "청약 (신생아·생애최초·일반공급)",
    badge: "1순위", tone: "good",
    points: [
      "분양가 상한제로 시세보다 8~10억 이상 저렴",
      "2026.6.15 신설된 신생아 특공 — 혼인기간 무관, 자녀 2세 미만",
      "소득 초과 시 일반공급(가점제·추첨제)으로 — 소득기준 자체가 없음",
      "단점: 당첨 확률 불확실, 입주까지 2~4년 소요",
    ],
  },
  {
    title: "매매",
    badge: "자기자본 부담 큼", tone: "warn",
    points: [
      "즉시 실입주, 원하는 단지·평형 직접 선택 가능",
      "가격구간 하드캡(2025.10.16 시행)이 소득과 무관하게 적용",
      "과천 84㎡ 기준 자기자본 20억 이상 필요할 수 있음",
      "대안: 소형 평형 또는 재건축 대기 단지로 눈높이 조정",
    ],
  },
  {
    title: "전세 → 매매/청약 갈아타기",
    badge: "현재 추천 경로", tone: "good",
    points: [
      "자기자본 부담이 낮아 지금 현금 규모로 실행 가능",
      "무주택 상태 유지하며 청약 가점(무주택기간) 계속 축적",
      "전세대출 DSR 반영 확대 가능성 — 갈아타기 시점 대출여력 축소 리스크",
      "전세금 상승분은 자산 형성에 기여하지 않는 기회비용 고려",
    ],
  },
];

const BENEFITS = [
  { title: "신혼특공(민영) — 자산기준 경로", fit: "해당 가능성 높음", tone: "good",
    body: "소득기준(160%) 초과해도 세대 부동산가액 3.31억 이하면 신청 가능. 무주택인 두 분은 부동산가액 0원이라 이 경로로 신청 가능성이 높아요.",
    link: "https://www.applyhome.co.kr", label: "청약홈 바로가기" },
  { title: "청약 일반공급(가점제·추첨제)", fit: "소득 무관 · 핵심 전략", tone: "good",
    body: "애초에 소득기준이 없어요. 무주택기간·부양가족수·통장 가입기간이 핵심이라 특공 소득요건과 무관하게 계속 도전할 수 있어요.",
    link: "https://www.applyhome.co.kr", label: "청약캘린더 보기" },
  { title: "신생아 특별공급(민영, 2026.6.15 신설)", fit: "자녀 계획 시 유리", tone: "neutral",
    body: "혼인기간 요건 없이 만 2세 미만 자녀만 있으면 신청 가능. 지금은 해당 없지만 출산 시점에 챙기면 좋아요.",
    link: "https://www.myhome.go.kr", label: "마이홈포털 안내" },
  { title: "생애최초 취득세 감면", fit: "과천엔 대부분 해당 없음", tone: "warn",
    body: "12억 이하 주택만 적용되는데, 과천 매물은 대부분 15억을 넘어 실질적으로 적용받기 어려워요.",
    link: "https://www.myhome.go.kr", label: "관련 안내" },
  { title: "신생아 특례 디딤돌·버팀목대출", fit: "소득은 OK, 가격상한에 막힘", tone: "warn",
    body: "소득요건(맞벌이 2억 이하)은 충족하지만 담보주택 6~9억, 전세보증금 5억 상한이 있어 과천엔 적용 안 돼요.",
    link: "https://nhuf.molit.go.kr", label: "주택도시기금 포털" },
  { title: "보금자리론 · 일반 디딤돌·버팀목", fit: "과천엔 해당 없음", tone: "bad",
    body: "보금자리론은 6억 이하 주택만, 일반 디딤돌·버팀목은 소득상한(6~8.5천만원대)이 있어 우리 조건으로는 이용이 어려워요.",
    link: "https://www.hf.go.kr", label: "한국주택금융공사" },
];

const TIMELINE = [
  { phase: "Phase 1 · 0~6개월", title: "기반 다지기", items: [
    "청약통장 가입기간·납입횟수 점검",
    "부부합산 소득분위 정확히 계산 → 특공/일반공급 경로 확정",
    "혼인신고일 확정(특공 7년 요건 기산점)",
    "연금저축·IRP·ISA 계좌 개설, 자동이체 세팅",
  ]},
  { phase: "Phase 2 · 6개월~1.5년", title: "전세 진입 + 자산 축적", items: [
    "과천 전세(59㎡ 기준 6.4억~8.8억선) 계약 실행",
    "과천 신규 공급 단지 청약 일정 상시 모니터링",
    "ISA 목적자금 축적 시작",
  ]},
  { phase: "Phase 3 · 1.5~3년", title: "전세 만기 임박, 재평가", items: [
    "청약 당첨 여부 확인, 미당첨 시 매매 갈아타기 재검토",
    "자기자본 갭 축소 추이 점검, 저축 속도 재조정",
  ]},
  { phase: "Phase 4 · 3~5년+", title: "입주 및 안정화", items: [
    "입주 또는 매매 실행, 대출 상환계획 확정",
    "자산 포트폴리오 재조정",
  ]},
];

const CHECKLIST_INIT = [
  { cat: "청약 준비", items: ["청약통장 가입기간·납입횟수 확인", "혼인관계증명서 준비", "부부합산 소득분위 정확히 산출", "자녀 계획 시 신생아특공 요건 확인"] },
  { cat: "대출/자금", items: ["기존 신용대출·할부 정리로 DSR 여유 확보", "정책 모기지 소득·자산 요건 확인", "고정 vs 변동금리 비교", "비상자금(생활비 3~6개월분) 별도 확보"] },
  { cat: "정보 모니터링", items: ["청약홈 과천 지역 공급 일정 알림 설정", "LH청약플러스 공고 확인", "규제지역 지정 현황 반기 점검", "도시근로자 월평균소득 고시 갱신 반영"] },
];

// ============== small building blocks ==============
function SectionHeader({ eyebrow, title }) {
  return (
    <div className="mb-4">
      {eyebrow && <div className="text-[13px] font-semibold tracking-wide text-[#9C7A22] mb-1">{eyebrow}</div>}
      <h3 className="text-xl font-bold text-[#24231E]" style={{ fontFamily: "'Noto Serif KR', serif" }}>{title}</h3>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl border border-[#E4DFD3] p-5 ${className}`}>{children}</div>;
}

function ToneBadge({ tone, children }) {
  const map = {
    good: "bg-[#1F5D46] text-white",
    warn: "bg-[#9C7A22] text-white",
    bad: "bg-[#A8451F] text-white",
    neutral: "bg-[#E4DFD3] text-[#24231E]",
  };
  return <span className={`text-[13px] px-3 py-1 rounded-full font-semibold whitespace-nowrap ${map[tone] || map.neutral}`}>{children}</span>;
}

function Field({ label, value, onChange, step = 1 }) {
  return (
    <div>
      <label className="text-[14px] text-[#5C584C] block mb-1.5 font-medium">{label}</label>
      <input
        type="number" step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-12 px-3 rounded-xl border border-[#E4DFD3] text-[16px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#9C7A22]/50"
      />
    </div>
  );
}

function Toggle({ label, active, onClick, activeText, inactiveText }) {
  return (
    <div className="flex flex-col justify-end">
      <label className="text-[14px] text-[#5C584C] mb-1.5 font-medium">{label}</label>
      <button onClick={onClick}
        className={`h-12 rounded-xl text-[15px] font-semibold border ${active ? "bg-[#1F5D46] text-white border-[#1F5D46]" : "bg-white text-[#24231E] border-[#E4DFD3]"}`}>
        {active ? activeText : inactiveText}
      </button>
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  const color = tone === "warn" ? "text-[#A8451F]" : tone === "good" ? "text-[#1F5D46]" : "text-[#24231E]";
  return (
    <div className="py-3">
      <div className="text-[14px] text-[#5C584C] mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`} style={{ fontFamily: "'Noto Serif KR', serif" }}>{value}</div>
      {sub && <div className="text-[13px] text-[#8A8578] mt-1">{sub}</div>}
    </div>
  );
}

function InfoNote({ children }) {
  return (
    <div className="flex gap-2 text-[13px] text-[#8A8578] leading-relaxed">
      <Info size={15} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

// ============== main app ==============
export default function App() {
  const [tab, setTab] = useState("diag");

  const [income1, setIncome1] = useState(9700);
  const [income2, setIncome2] = useState(6000);
  const [assets, setAssets] = useState(20000);
  const [monthlySave, setMonthlySave] = useState(250);
  const [firstTime, setFirstTime] = useState(true);
  const [targetKey, setTargetKey] = useState("jeonse59budget");
  const [rate, setRate] = useState(6.3);
  const [existingDebtMonthly, setExistingDebtMonthly] = useState(0);
  const [giftAmount, setGiftAmount] = useState(20000);
  const [spouseGiftUsed, setSpouseGiftUsed] = useState(0);
  const [loanAmountCalc, setLoanAmountCalc] = useState(60000);
  const [loanRateCalc, setLoanRateCalc] = useState(4.5);
  const [loanYearsCalc, setLoanYearsCalc] = useState(30);
  const [repayType, setRepayType] = useState("equal_payment");

  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get("household-inputs-v2", false);
        if (!cancelled && res && res.value) {
          const d = JSON.parse(res.value);
          if (d.income1 !== undefined) setIncome1(d.income1);
          if (d.income2 !== undefined) setIncome2(d.income2);
          if (d.assets !== undefined) setAssets(d.assets);
          if (d.monthlySave !== undefined) setMonthlySave(d.monthlySave);
          if (d.firstTime !== undefined) setFirstTime(d.firstTime);
          if (d.targetKey !== undefined) setTargetKey(d.targetKey);
          if (d.rate !== undefined) setRate(d.rate);
          if (d.existingDebtMonthly !== undefined) setExistingDebtMonthly(d.existingDebtMonthly);
          if (d.giftAmount !== undefined) setGiftAmount(d.giftAmount);
          if (d.spouseGiftUsed !== undefined) setSpouseGiftUsed(d.spouseGiftUsed);
          if (d.loanAmountCalc !== undefined) setLoanAmountCalc(d.loanAmountCalc);
          if (d.loanRateCalc !== undefined) setLoanRateCalc(d.loanRateCalc);
          if (d.loanYearsCalc !== undefined) setLoanYearsCalc(d.loanYearsCalc);
          if (d.repayType !== undefined) setRepayType(d.repayType);
        }
      } catch (e) { /* first run, no saved data */ }
      finally { if (!cancelled) setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const h = setTimeout(async () => {
      try {
        const payload = JSON.stringify({ income1, income2, assets, monthlySave, firstTime, targetKey, rate, existingDebtMonthly, giftAmount, spouseGiftUsed, loanAmountCalc, loanRateCalc, loanYearsCalc, repayType });
        const res = await window.storage.set("household-inputs-v2", payload, false);
        if (res) setSavedAt(new Date());
      } catch (e) { /* save failed silently */ }
    }, 600);
    return () => clearTimeout(h);
  }, [loaded, income1, income2, assets, monthlySave, firstTime, targetKey, rate, existingDebtMonthly, giftAmount, spouseGiftUsed, loanAmountCalc, loanRateCalc, loanYearsCalc, repayType]);

  const target = TARGETS.find(t => t.key === targetKey);
  const income = income1 + income2;
  const incomeWon = income * 10000;
  const netAnnual = estimateNetAnnual(income1 * 10000) + estimateNetAnnual(income2 * 10000);
  const netMonthly = netAnnual / 12;
  const assetsWon = assets * 10000;
  const monthlySaveWon = monthlySave * 10000;

  const dsrMonthlyBudget = Math.max(0, (incomeWon * 0.4) / 12 - existingDebtMonthly * 10000);
  const dsrLoan = loanFromMonthlyPayment(dsrMonthlyBudget, rate, 30);
  const ltvPct = firstTime ? 0.7 : 0.5;
  const ltvLoan = target.price * ltvPct;
  const tierCap = priceTierCap(target.price);
  const maxLoan = Math.min(dsrLoan, ltvLoan, tierCap);
  const bindingConstraint = maxLoan === tierCap ? "가격구간 대출한도" : maxLoan === ltvLoan ? "LTV" : "DSR(소득)";
  const requiredCash = Math.max(0, target.price - maxLoan);
  const gap = requiredCash - assetsWon;
  const monthsToGoal = gap > 0 && monthlySaveWon > 0 ? Math.ceil(gap / monthlySaveWon) : 0;
  const yearsToGoal = (monthsToGoal / 12).toFixed(1);
  const incomeExceedsSpecialSupply = income > 12600;

  const spouseExemption = Math.max(0, 60000 - spouseGiftUsed);
  const giftTaxableBase = Math.max(0, giftAmount * 10000 - spouseExemption * 10000);
  const giftTaxOwed = giftTax(giftTaxableBase);

  // 대출 이자 계산기
  const loanP = loanAmountCalc * 10000;
  const loanI = loanRateCalc / 100 / 12;
  const loanN = loanYearsCalc * 12;
  let loanFirstMonthPay = 0, loanTotalPay = 0, loanTotalInterest = 0;
  if (loanP > 0 && loanN > 0) {
    if (repayType === "equal_payment") {
      const M = loanI > 0 ? loanP * loanI / (1 - Math.pow(1 + loanI, -loanN)) : loanP / loanN;
      loanFirstMonthPay = M;
      loanTotalPay = M * loanN;
      loanTotalInterest = loanTotalPay - loanP;
    } else {
      const principalPerMonth = loanP / loanN;
      loanFirstMonthPay = principalPerMonth + loanP * loanI;
      loanTotalInterest = loanI * loanP * (loanN + 1) / 2;
      loanTotalPay = loanP + loanTotalInterest;
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#24231E]" style={{ fontFamily: "'Pretendard','Noto Sans KR',sans-serif" }}>
      {/* header */}
      <header className="px-5 pt-8 pb-6 sm:px-8 border-b border-[#E4DFD3]">
        <div className="max-w-2xl mx-auto">
          <div className="text-[13px] font-semibold tracking-wide text-[#9C7A22] mb-2">신혼부부 재무설계 · 2026년 기준</div>
          <h1 className="text-3xl font-bold leading-snug" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            과천 내 집 마련
          </h1>
          <p className="mt-2 text-[15px] text-[#5C584C] leading-relaxed">
            자산진단 · 청약/매매/전세 전략 · 자산관리 · 타임라인
          </p>
          <p className="mt-2 text-[13px] text-[#8A8578]">
            {savedAt ? `자동 저장됨 · ${savedAt.toLocaleTimeString("ko-KR")}` : "입력값은 이 기기에 자동 저장됩니다"}
          </p>
        </div>
      </header>

      {/* nav */}
      <nav className="sticky top-0 z-10 bg-[#FAF7F0]/95 backdrop-blur border-b border-[#E4DFD3]">
        <div className="max-w-2xl mx-auto flex overflow-x-auto no-scrollbar px-3 sm:px-8">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-4 text-[15px] font-semibold whitespace-nowrap border-b-[3px] transition-colors ${
                  active ? "border-[#9C7A22] text-[#24231E]" : "border-transparent text-[#8A8578]"
                }`}>
                <Icon size={16} strokeWidth={2} />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-5 sm:px-8 py-8 space-y-8">

        {/* ============ DIAGNOSIS ============ */}
        {tab === "diag" && (
          <>
            <section>
              <SectionHeader eyebrow="STEP 1" title="우리 부부 정보" />
              <Card>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="본인 연소득(만원)" value={income1} onChange={setIncome1} />
                  <Field label="배우자 연소득(만원)" value={income2} onChange={setIncome2} />
                  <Field label="현재 순자산(만원)" value={assets} onChange={setAssets} />
                  <Field label="월 저축가능액(만원)" value={monthlySave} onChange={setMonthlySave} />
                  <Field label="기존 대출 월상환액(만원)" value={existingDebtMonthly} onChange={setExistingDebtMonthly} />
                </div>
                <p className="mt-4 text-[13px] text-[#8A8578]">※ 자차 등 비유동자산은 순자산 계산에서 제외하세요.</p>
                <div className="mt-4 pt-4 border-t border-[#E4DFD3] space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[15px] text-[#5C584C]">부부합산 월소득(세전, 연÷12)</span>
                    <span className="text-xl font-bold" style={{ fontFamily: "'Noto Serif KR', serif" }}>{won(Math.round(incomeWon / 12))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[15px] text-[#5C584C]">부부합산 월소득(세후 추정)</span>
                    <span className="text-xl font-bold text-[#1F5D46]" style={{ fontFamily: "'Noto Serif KR', serif" }}>{won(Math.round(netMonthly))}</span>
                  </div>
                </div>
                <p className="mt-3 text-[13px] text-[#8A8578] leading-relaxed">
                  세후 금액은 2026년 4대보험 요율(국민연금 4.75%, 건강보험 3.595%, 장기요양 12.95%, 고용보험 0.9%)과 근로소득세 간이세율을 적용한 <b>추정치</b>예요. 부양가족 수, 각종 세액공제, 비과세 항목(식대 등)에 따라 실제 급여명세서와 다를 수 있어요.
                </p>
                {incomeExceedsSpecialSupply && (
                  <div className="mt-4 flex gap-2 text-[14px] text-[#A8451F] bg-[#A8451F]/5 rounded-xl p-3">
                    <Info size={16} className="mt-0.5 shrink-0" />
                    <span>소득 기준 신혼특공(우선·일반공급)은 초과할 가능성이 높아요. 자산기준 경로나 일반공급을 중심으로 보세요. (전략·혜택 탭 참고)</span>
                  </div>
                )}
              </Card>
            </section>

            <section>
              <SectionHeader eyebrow="STEP 2" title="목표 유형 선택" />
              <div className="space-y-3">
                {TARGETS.map(t => (
                  <button key={t.key} onClick={() => setTargetKey(t.key)}
                    className={`w-full text-left rounded-2xl border p-4 transition-colors ${
                      targetKey === t.key ? "border-[#9C7A22] bg-[#9C7A22]/5" : "border-[#E4DFD3] bg-white"
                    }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[15px] font-semibold">{t.label}</div>
                        <div className="text-[13px] text-[#8A8578] mt-0.5">{t.note}</div>
                      </div>
                      <div className="text-xl font-bold shrink-0" style={{ fontFamily: "'Noto Serif KR', serif" }}>{wonShort(t.price)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <SectionHeader eyebrow="STEP 3" title="진단 결과" />
              <Card className="!p-0 overflow-hidden">
                <div className="px-5 py-4 bg-[#24231E] text-white text-[15px] font-semibold">{target.label}</div>
                <div className="px-5 divide-y divide-[#E4DFD3]">
                  <Stat label="목표 가격" value={won(target.price)} />
                  <Stat label="최대 대출가능액(추정)" value={won(maxLoan)} sub={`제약 요인: ${bindingConstraint}`} />
                  <Stat label="필요 자기자본" value={won(requiredCash)} />
                  <Stat label="자기자본 갭" value={gap > 0 ? won(gap) : "충족"} tone={gap > 0 ? "warn" : "good"} />
                  <Stat label="현재 저축 속도로 달성까지" value={gap > 0 ? `약 ${yearsToGoal}년 (${monthsToGoal}개월)` : "즉시 가능"} tone={gap > 0 ? "warn" : "good"} />
                </div>
                {gap > 0 && (
                  <div className="px-5 py-4 text-[14px] text-[#5C584C] leading-relaxed bg-[#FAF7EE] border-t border-[#E4DFD3]">
                    2025년 10월 규제 이후 대출한도는 가격구간별 하드캡이 걸려 있어 소득이 높아도 한계가 있어요.
                    {target.key.startsWith("sale") ? " 매매는 자기자본 비중이 압도적으로 커야 해서 청약 병행을 강력 추천해요." : " 청약은 분양가 상한제 덕분에 자기자본 부담이 낮지만, 당첨 확률과 입주 시점(2027~2030년)이 불확실해요."}
                  </div>
                )}
              </Card>
            </section>

            <section>
              <SectionHeader eyebrow="참고자료" title="59㎡ 전세 실거래가" />
              <p className="text-[14px] text-[#5C584C] mb-4 leading-relaxed">신혼부부 둘이 살기 적당한 크기 기준, 최근 1년 실거래예요.</p>
              <div className="space-y-3">
                {JEONSE_OPTIONS.map((j, i) => (
                  <Card key={i}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[15px] font-semibold">{j.name}</div>
                        <div className="text-[13px] text-[#8A8578] mt-0.5">{j.area}</div>
                      </div>
                      <div className="text-lg font-bold text-[#9C7A22] shrink-0" style={{ fontFamily: "'Noto Serif KR', serif" }}>{wonShort(j.price)}</div>
                    </div>
                    <p className="text-[13px] text-[#5C584C] mt-2">{j.note}</p>
                  </Card>
                ))}
              </div>
              <div className="mt-3">
                <InfoNote>전세는 매물 회전이 빨라 가격이 자주 바뀝니다. 계약 전 국토부 실거래가 공개시스템(rt.molit.go.kr)에서 재확인하세요.</InfoNote>
              </div>
            </section>
          </>
        )}

        {/* ============ STRATEGY & BENEFITS ============ */}
        {tab === "strategy" && (
          <>
            <section>
              <SectionHeader eyebrow="경로 비교" title="청약 · 매매 · 전세" />
              <div className="space-y-4">
                {STRATEGIES.map((s, i) => (
                  <Card key={i}>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h4 className="text-lg font-bold" style={{ fontFamily: "'Noto Serif KR', serif" }}>{s.title}</h4>
                      <ToneBadge tone={s.tone}>{s.badge}</ToneBadge>
                    </div>
                    <ul className="space-y-2">
                      {s.points.map((p, j) => (
                        <li key={j} className="flex gap-2 text-[15px] text-[#3D3A32] leading-relaxed">
                          <ChevronRight size={16} className="mt-0.5 shrink-0 text-[#8A8578]" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            </section>

            <section>
              <SectionHeader eyebrow="우리 조건 기준" title="혜택·제도 활용 가능 여부" />
              <div className="mb-4 text-[14px] text-[#5C584C] bg-[#9C7A22]/8 rounded-xl p-4 leading-relaxed">
                과천은 가격 자체가 높아서 조건을 통과해도 "가격 상한"에 막히는 제도가 많아요. 실제로 열려 있는 것과 막히는 것을 구분했어요.
              </div>
              <div className="space-y-4">
                {BENEFITS.map((b, i) => (
                  <Card key={i}>
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <h4 className="text-[15px] font-bold">{b.title}</h4>
                      <ToneBadge tone={b.tone}>{b.fit}</ToneBadge>
                    </div>
                    <p className="text-[14px] text-[#3D3A32] leading-relaxed mb-3">{b.body}</p>
                    <a href={b.link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[14px] font-semibold text-[#24231E] underline decoration-[#9C7A22] underline-offset-2">
                      {b.label} <ChevronRight size={13} />
                    </a>
                  </Card>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ============ WEALTH MANAGEMENT ============ */}
        {tab === "wealth" && (
          <>
            <section>
              <SectionHeader eyebrow="결론부터" title="합칠까, 나눌까" />
              <Card>
                <p className="text-[15px] text-[#3D3A32] leading-relaxed">
                  계좌를 물리적으로 합칠 필요는 없어요. <b>각자 명의 절세계좌(ISA·연금저축·IRP)는 각자 유지</b>하고, <b>공동 목표자금만 별도 통장</b>으로 분리하세요. 이러면 세액공제도 각자 최대로 받고, 나중에 자금출처 소명도 훨씬 쉬워요.
                </p>
              </Card>
            </section>

            <section>
              <SectionHeader eyebrow="절세계좌 3종" title="ISA · 연금저축 · IRP" />
              <div className="space-y-4">
                <Card>
                  <h4 className="text-[15px] font-bold mb-3">① ISA — 각자 1개씩</h4>
                  <ul className="space-y-2 text-[15px] text-[#3D3A32]">
                    <li className="flex gap-2"><ChevronRight size={16} className="mt-0.5 shrink-0 text-[#8A8578]" /><span>연 4,000만원 한도, 총 2억원 (미납입분 이월)</span></li>
                    <li className="flex gap-2"><ChevronRight size={16} className="mt-0.5 shrink-0 text-[#8A8578]" /><span>비과세 500만원, 초과분 9.9% 분리과세</span></li>
                    <li className="flex gap-2"><ChevronRight size={16} className="mt-0.5 shrink-0 text-[#8A8578]" /><span>의무유지 3년 — 원금은 언제든 인출 가능(수익분만 세제혜택 취소)</span></li>
                    <li className="flex gap-2"><ChevronRight size={16} className="mt-0.5 shrink-0 text-[#8A8578]" /><span>과천 목적자금(청약·매매용)에 가장 적합</span></li>
                  </ul>
                </Card>
                <Card>
                  <h4 className="text-[15px] font-bold mb-3">② 연금저축 + IRP — 각자 900만원</h4>
                  <ul className="space-y-2 text-[15px] text-[#3D3A32]">
                    <li className="flex gap-2"><ChevronRight size={16} className="mt-0.5 shrink-0 text-[#8A8578]" /><span>연금저축 600만원(월 50만) + IRP 300만원(월 25만) = 900만원</span></li>
                    <li className="flex gap-2"><ChevronRight size={16} className="mt-0.5 shrink-0 text-[#8A8578]" /><span>공제율: 총급여 5,500만원 초과 시 13.2% — 1인당 약 118.8만원 환급</span></li>
                    <li className="flex gap-2"><ChevronRight size={16} className="mt-0.5 shrink-0 text-[#8A8578]" /><span>만 55세까지 묶임 — 과천 목적자금과는 별개로 접근</span></li>
                  </ul>
                </Card>
              </div>
            </section>

            <section>
              <SectionHeader eyebrow="비교" title="한눈에 보는 차이" />
              <div className="grid grid-cols-3 gap-3">
                <Card className="text-center !p-4">
                  <div className="text-[13px] text-[#8A8578] mb-1">ISA</div>
                  <div className="text-[15px] font-bold">3년</div>
                  <div className="text-[12px] text-[#8A8578]">묶이는 기간</div>
                </Card>
                <Card className="text-center !p-4">
                  <div className="text-[13px] text-[#8A8578] mb-1">연금저축</div>
                  <div className="text-[15px] font-bold">55세</div>
                  <div className="text-[12px] text-[#8A8578]">묶이는 기간</div>
                </Card>
                <Card className="text-center !p-4">
                  <div className="text-[13px] text-[#8A8578] mb-1">IRP</div>
                  <div className="text-[15px] font-bold">55세</div>
                  <div className="text-[12px] text-[#8A8578]">묶이는 기간</div>
                </Card>
              </div>
              <div className="mt-3">
                <InfoNote>ISA 만기(3년) 자금을 60일 내 연금계좌로 옮기면 이전액의 10%(최대 300만원)를 추가 세액공제 받을 수 있어요. 단 그만큼 다시 55세까지 묶여요.</InfoNote>
              </div>
            </section>

            <section>
              <SectionHeader eyebrow="계좌 구조" title="실전 세팅" />
              <Card>
                <div className="space-y-3 text-[15px] text-[#3D3A32]">
                  <p>• <b>각자 명의:</b> 급여통장, ISA, 연금저축·IRP — 세액공제·비과세 한도를 각자 최대로</p>
                  <p>• <b>공동생활비 통장:</b> 월세·관리비·공과금 등 소비성 지출만 정액 이체</p>
                  <p>• <b>목적자금 통장:</b> 청약 계약금용, 각자 기여분 기록해두기</p>
                  <p>• <b>비상금:</b> 생활비 3~6개월분은 파킹통장에 별도 보관</p>
                </div>
              </Card>
            </section>

            <section>
              <SectionHeader eyebrow="세금 폭탄 예방" title="배우자간 자금 이동 계산기" />
              <Card>
                <p className="text-[14px] text-[#5C584C] leading-relaxed mb-4">배우자 증여재산공제는 10년간 6억원. 넘는 만큼만 증여세가 붙어요.</p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Field label="이체 검토 금액(만원)" value={giftAmount} onChange={setGiftAmount} />
                  <Field label="최근 10년 기사용 공제(만원)" value={spouseGiftUsed} onChange={setSpouseGiftUsed} />
                </div>
                <div className="divide-y divide-[#E4DFD3]">
                  <Stat label="잔여 배우자 증여공제(10년)" value={won(spouseExemption * 10000)} />
                  <Stat label="공제 초과 과세대상 금액" value={won(giftTaxableBase)} />
                  <Stat label="예상 증여세" value={giftTaxOwed > 0 ? won(giftTaxOwed) : "0원 · 비과세 범위"} tone={giftTaxOwed > 0 ? "warn" : "good"} />
                </div>
              </Card>
            </section>

            <section>
              <SectionHeader eyebrow="실전 수칙" title="세금 폭탄 예방" />
              <Card className="bg-[#9C7A22]/5 border-[#9C7A22]/30">
                <div className="space-y-3 text-[15px] text-[#3D3A32] leading-relaxed">
                  <p>• <b>부모님 증여 계획 있다면:</b> 혼인신고 전후 2년 이내, 양가 합산 최대 3억원까지 비과세</p>
                  <p>• <b>부모님께 무이자 차입:</b> 약 2억원까지 증여세 없음 — 단 차용증+상환 이체기록 필수</p>
                  <p>• <b>공동명의 매매:</b> 지분율 = 실제 자금 부담 비율이어야 함</p>
                  <p>• <b>자금조달계획서:</b> 투기과열지구는 금액 무관 전원 제출, 있는 그대로 기재</p>
                </div>
              </Card>
            </section>
          </>
        )}

        {/* ============ LOAN CALCULATOR ============ */}
        {tab === "loan" && (
          <>
            <section>
              <SectionHeader eyebrow="계산 결과" title="대출 한도 3단 필터" />
              <Card>
                <div className="space-y-3">
                  <FilterRow label="① DSR 40% (소득 기반)" value={won(dsrLoan)} active={maxLoan === dsrLoan} />
                  <FilterRow label={`② LTV ${firstTime ? "70%(생애최초)" : "50%"}`} value={won(ltvLoan)} active={maxLoan === ltvLoan} />
                  <FilterRow label="③ 가격구간 하드캡(2025.10.16~)" value={won(tierCap)} active={maxLoan === tierCap} />
                </div>
                <div className="mt-4 pt-4 border-t border-[#E4DFD3] flex justify-between items-center">
                  <span className="text-[15px] font-semibold">최종 대출가능액</span>
                  <span className="text-2xl font-bold" style={{ fontFamily: "'Noto Serif KR', serif" }}>{won(maxLoan)}</span>
                </div>
              </Card>
            </section>

            <section>
              <SectionHeader eyebrow="입력값 조정" title="조건 바꿔보기" />
              <Card>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="적용금리 · 스트레스 포함(%)" value={rate} onChange={setRate} step={0.1} />
                  <Toggle label="생애최초 구입자" active={firstTime} onClick={() => setFirstTime(v => !v)} activeText="예 (LTV 70%)" inactiveText="아니오 (LTV 50%)" />
                </div>
              </Card>
            </section>

            <section>
              <SectionHeader eyebrow="직접 계산" title="이자 계산기" />
              <Card>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Field label="대출금액(만원)" value={loanAmountCalc} onChange={setLoanAmountCalc} />
                  <Field label="금리(%)" value={loanRateCalc} onChange={setLoanRateCalc} step={0.1} />
                  <Field label="대출기간(년)" value={loanYearsCalc} onChange={setLoanYearsCalc} />
                  <Toggle
                    label="상환방식"
                    active={repayType === "equal_payment"}
                    onClick={() => setRepayType(v => v === "equal_payment" ? "equal_principal" : "equal_payment")}
                    activeText="원리금균등"
                    inactiveText="원금균등"
                  />
                </div>
                <div className="divide-y divide-[#E4DFD3]">
                  <Stat
                    label={repayType === "equal_payment" ? "매달 상환액(고정)" : "첫 달 상환액(이후 점점 감소)"}
                    value={won(Math.round(loanFirstMonthPay))}
                  />
                  <Stat label="총 이자" value={won(Math.round(loanTotalInterest))} tone="warn" />
                  <Stat label="총 상환액(원금+이자)" value={won(Math.round(loanTotalPay))} />
                </div>
                <p className="mt-3 text-[13px] text-[#8A8578] leading-relaxed">
                  <b>원리금균등</b>은 매달 같은 금액을 내고(초반엔 이자 비중이 크고 후반엔 원금 비중이 큼), <b>원금균등</b>은 원금을 매달 동일하게 갚아서 이자가 점점 줄어드는 대신 초반 상환액이 더 커요. 총 이자는 원금균등이 더 적어요.
                </p>
              </Card>
            </section>

            <section>
              <SectionHeader eyebrow="참고표" title="가격구간별 대출한도" />
              <div className="space-y-3">
                <Card className="flex items-center justify-between !py-4">
                  <span className="text-[15px]">15억원 이하</span>
                  <span className="text-[16px] font-bold">6억원</span>
                </Card>
                <Card className="flex items-center justify-between !py-4">
                  <span className="text-[15px]">15억 초과 ~ 25억 이하</span>
                  <span className="text-[16px] font-bold">4억원</span>
                </Card>
                <Card className="flex items-center justify-between !py-4">
                  <span className="text-[15px]">25억원 초과</span>
                  <span className="text-[16px] font-bold">2억원</span>
                </Card>
              </div>
              <div className="mt-3">
                <InfoNote>정책대출(디딤돌 등)은 DSR 대신 DTI 60%를 적용해 상대적으로 여유가 있지만, 별도 소득·주택가격 요건이 있어요.</InfoNote>
              </div>
            </section>
          </>
        )}

        {/* ============ TIMELINE ============ */}
        {tab === "timeline" && (
          <section>
            <SectionHeader eyebrow="로드맵" title="4단계 타임라인" />
            <div className="relative pl-6">
              <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[#E4DFD3]" />
              {TIMELINE.map((p, idx) => (
                <div key={idx} className="mb-8 relative last:mb-0">
                  <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-[#9C7A22] border-2 border-[#FAF7F0]" />
                  <div className="text-[13px] font-semibold text-[#9C7A22] mb-1">{p.phase}</div>
                  <div className="text-lg font-bold mb-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>{p.title}</div>
                  <ul className="space-y-2">
                    {p.items.map((it, i) => (
                      <li key={i} className="flex gap-2 text-[15px] text-[#3D3A32] leading-relaxed">
                        <ChevronRight size={16} className="mt-0.5 shrink-0 text-[#8A8578]" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ============ CHECKLIST ============ */}
        {tab === "checklist" && <Checklist />}
      </main>

      <footer className="text-center text-[13px] text-[#8A8578] pb-10 px-5">
        본 도구는 참고용 시뮬레이션이며 법률·세무·투자 자문이 아닙니다. 실행 전 은행·세무사·청약 전문가 확인을 권장합니다.
      </footer>
    </div>
  );
}

function FilterRow({ label, value, active }) {
  return (
    <div className={`flex justify-between items-center px-4 py-3.5 rounded-xl ${active ? "bg-[#9C7A22]/10 border border-[#9C7A22]/40" : "bg-[#FAF7F0]"}`}>
      <span className="text-[15px]">{label}</span>
      <span className={`text-[16px] font-bold ${active ? "text-[#9C7A22]" : "text-[#24231E]"}`}>{value}</span>
    </div>
  );
}

function Checklist() {
  const [state, setState] = useState(
    CHECKLIST_INIT.map(g => ({ ...g, items: g.items.map(t => ({ text: t, done: false })) }))
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get("checklist-done-v2", false);
        if (!cancelled && res && res.value) {
          const doneMap = JSON.parse(res.value);
          setState(prev => prev.map((g, gi) => ({
            ...g, items: g.items.map((it, ii) => ({ ...it, done: !!doneMap[`${gi}-${ii}`] })),
          })));
        }
      } catch (e) { /* no saved checklist yet */ }
      finally { if (!cancelled) setReady(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const h = setTimeout(async () => {
      try {
        const doneMap = {};
        state.forEach((g, gi) => g.items.forEach((it, ii) => { if (it.done) doneMap[`${gi}-${ii}`] = true; }));
        await window.storage.set("checklist-done-v2", JSON.stringify(doneMap), false);
      } catch (e) { /* save failed silently */ }
    }, 400);
    return () => clearTimeout(h);
  }, [ready, state]);

  const toggle = (gi, ii) => {
    setState(prev => {
      const next = prev.map(g => ({ ...g, items: g.items.map(it => ({ ...it })) }));
      next[gi].items[ii].done = !next[gi].items[ii].done;
      return next;
    });
  };
  const total = state.reduce((a, g) => a + g.items.length, 0);
  const done = state.reduce((a, g) => a + g.items.filter(i => i.done).length, 0);

  return (
    <section>
      <SectionHeader eyebrow="실행 관리" title="체크리스트" />
      <Card className="flex items-center justify-between mb-4">
        <span className="text-[15px] font-semibold">전체 진행률</span>
        <span className="text-[16px] font-bold text-[#9C7A22]">{done} / {total}</span>
      </Card>
      <div className="space-y-4">
        {state.map((g, gi) => (
          <Card key={gi}>
            <h4 className="text-[13px] font-semibold text-[#8A8578] mb-3">{g.cat}</h4>
            <ul className="space-y-3">
              {g.items.map((it, ii) => (
                <li key={ii}>
                  <button onClick={() => toggle(gi, ii)} className="flex items-start gap-3 text-left w-full">
                    {it.done ? <CheckSquare2 size={19} className="mt-0.5 shrink-0 text-[#1F5D46]" /> : <Square size={19} className="mt-0.5 shrink-0 text-[#8A8578]" />}
                    <span className={`text-[15px] ${it.done ? "line-through text-[#8A8578]" : "text-[#24231E]"}`}>{it.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}
