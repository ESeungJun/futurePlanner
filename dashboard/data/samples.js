/*
 * 오프라인 폴백 샘플 데이터
 * - 프록시(server.js)가 없거나 API 키가 없을 때 화면을 동작시키기 위한 데이터.
 * - 청약: 공공데이터포털 「청약홈 APT 분양정보」 스키마를 단순화해 정규화한 형태.
 * - 매물: 네이버 부동산 매물을 정규화한 형태(과천 주요 단지 예시, 2026 상반기 추정치).
 * - 브라우저(window.SAMPLE_DATA)와 Node(module.exports) 양쪽에서 쓰도록 노출.
 */
(function (root) {
  // 공급유형: 신혼특공 / 신생아 / 생애최초 / 일반공급
  const CHEONGYAK = [
    {
      id: "gc-jaegunchuk-4",
      name: "과천 주공4단지 재건축(일반분양 추정)",
      region: "과천시",
      addr: "경기 과천시 별양동",
      types: ["일반공급", "신혼특공", "생애최초"],
      areas: [59, 84],
      priceMin: 1_150_000_000,
      priceMax: 1_590_000_000,
      totalUnits: 1200,
      specialUnits: 430,
      applyStart: "2026-09-14",
      applyEnd: "2026-09-16",
      announceDate: "2026-09-24",
      moveIn: "2029-06",
      lat: 37.4293, lng: 126.9948,
      url: "https://www.applyhome.co.kr",
    },
    {
      id: "gc-jisik-b3",
      name: "과천지식정보타운 B3블록",
      region: "과천시",
      addr: "경기 과천시 갈현동",
      types: ["일반공급", "신생아", "신혼특공"],
      areas: [74, 84],
      priceMin: 990_000_000,
      priceMax: 1_240_000_000,
      totalUnits: 640,
      specialUnits: 240,
      applyStart: "2026-08-25",
      applyEnd: "2026-08-27",
      announceDate: "2026-09-03",
      moveIn: "2028-12",
      lat: 37.4165, lng: 126.9861,
      url: "https://www.applyhome.co.kr",
    },
    {
      id: "indeokwon-forena",
      name: "인덕원 자이 SK뷰(생활권)",
      region: "안양시 동안구",
      addr: "경기 안양시 동안구 관양동",
      types: ["일반공급", "생애최초"],
      areas: [59, 74, 84],
      priceMin: 820_000_000,
      priceMax: 1_090_000_000,
      totalUnits: 900,
      specialUnits: 300,
      applyStart: "2026-10-06",
      applyEnd: "2026-10-08",
      announceDate: "2026-10-15",
      moveIn: "2029-03",
      lat: 37.4013, lng: 126.9528,
      url: "https://www.applyhome.co.kr",
    },
    {
      id: "gwacheon-past",
      name: "과천 센트럴 (접수 종료 예시)",
      region: "과천시",
      addr: "경기 과천시 부림동",
      types: ["일반공급"],
      areas: [59, 84],
      priceMin: 1_050_000_000,
      priceMax: 1_480_000_000,
      totalUnits: 500,
      specialUnits: 120,
      applyStart: "2026-05-12",
      applyEnd: "2026-05-14",
      announceDate: "2026-05-21",
      moveIn: "2028-09",
      lat: 37.4258, lng: 126.9971,
      url: "https://www.applyhome.co.kr",
    },
  ];

  // 거래유형: 매매 / 전세 / 월세 (월세는 price=보증금, rent=월세)
  const REALTY = [
    { id: "weberfield-59-j", complex: "과천위버필드", region: "과천시", addr: "원문동", dealType: "전세", area: 59, exclusive: 59.9, price: 880_000_000, rent: 0, floor: "14/25", built: 2021, lat: 37.4256, lng: 126.9989, tags: ["4호선 도보9분", "대공원 인접"] },
    { id: "weberfield-84-s", complex: "과천위버필드", region: "과천시", addr: "원문동", dealType: "매매", area: 84, exclusive: 84.9, price: 2_620_000_000, rent: 0, floor: "9/25", built: 2021, lat: 37.4256, lng: 126.9989, tags: ["대장주"] },
    { id: "gwacheonxi-59-j", complex: "과천자이", region: "과천시", addr: "별양동", dealType: "전세", area: 59, exclusive: 59.8, price: 890_000_000, rent: 0, floor: "7/30", built: 2022, lat: 37.4271, lng: 126.9946, tags: ["과천역 도보7분"] },
    { id: "summit-59-j", complex: "센트럴파크 푸르지오써밋", region: "과천시", addr: "부림동", dealType: "전세", area: 59, exclusive: 59.7, price: 800_000_000, rent: 0, floor: "11/32", built: 2020, lat: 37.4249, lng: 126.9973, tags: ["관악산 조망", "커뮤니티 우수"] },
    { id: "raemian-shure-59-j", complex: "래미안슈르", region: "과천시", addr: "원문동", dealType: "전세", area: 59, exclusive: 59.5, price: 640_000_000, rent: 0, floor: "6/20", built: 2008, lat: 37.4241, lng: 126.9958, tags: ["가격 메리트", "연식 있음"] },
    { id: "raemian-shure-59-w", complex: "래미안슈르", region: "과천시", addr: "원문동", dealType: "월세", area: 59, exclusive: 59.5, price: 100_000_000, rent: 2_200_000, floor: "3/20", built: 2008, lat: 37.4241, lng: 126.9958, tags: ["보증금 1억/월 220"] },
    { id: "decian-74-j", complex: "과천르센토데시앙", region: "과천시", addr: "갈현동", dealType: "전세", area: 74, exclusive: 74.9, price: 700_000_000, rent: 0, floor: "10/29", built: 2023, lat: 37.4159, lng: 126.9855, tags: ["신축", "지식정보타운"] },
    { id: "indeokwon-59-j", complex: "인덕원 푸르지오 엘센트로", region: "안양시 동안구", addr: "관양동", dealType: "전세", area: 59, exclusive: 59.6, price: 560_000_000, rent: 0, floor: "8/34", built: 2020, lat: 37.4008, lng: 126.9521, tags: ["과천 인근", "저렴"] },
  ];

  const DATA = { cheongyak: CHEONGYAK, realty: REALTY };
  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
  if (root) root.SAMPLE_DATA = DATA;
})(typeof window !== "undefined" ? window : null);
