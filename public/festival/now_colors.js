// 자동 생성 — build_festival.py가 now-paju/public/index.html의 computeColors를 그대로 복사한다. 직접 고치지 말 것.
// 필요한 전역: ROADGEO·LINKMAP·ROADSIB·ROADS·LVC·spdColor (festival.js가 정의)
// 도로별 색(속도) 계산 — 화면 이동과 무관하므로 소통 데이터가 바뀔 때만 다시 계산한다
function computeColors(speeds){
  const measured={};                                       // OSM 도로별 실측 속도 평균
  for(const [linkId,ri] of Object.entries(LINKMAP)){
    const v=speeds[linkId];
    if(v==null) continue;
    (measured[ri]=measured[ri]||[]).push(v);
  }
  // 도로 상황 카드의 도로별 대표 색 — 그 도로 실측 링크들의 색 중 가장 많은 것(같으면 더 막히는 쪽). 지도 칠하기엔 쓰지 않는다.
  //   서버가 준 도로 상태는 경기도 등급이 없는 도로면 60/35 속도 기준이라 지도 색과 어긋났다.
  const roadAvg={}, tally={}, names=new Set(ROADS.map(r=>r.road));
  for(const [ri,a] of Object.entries(measured)){
    const n=ROADGEO[ri].n; if(!names.has(n)) continue;
    const t=tally[n]=tally[n]||{};
    a.forEach(v=>{ const c=spdColor(v); t[c]=(t[c]||0)+1; });
  }
  const REP={[LVC['원활']]:75,[LVC['서행']]:45,[LVC['정체']]:20};
  ROADS.forEach(r=>{
    const t=tally[r.road];
    if(!t){ roadAvg[r.road]=r.speed; return; }
    roadAvg[r.road]=REP[[LVC['정체'],LVC['서행'],LVC['원활']].reduce((a,b)=>(t[b]||0)>(t[a]||0)?b:a)];
  });
  // 2026-10-14 사용자 "실측 데이터만 남겨줘": 반대 차로 복사·교차로 조각 잇기·나들목 나눔·짧은 조각 다듬기 같은
  //   추정 메우기를 모두 뺐다. 지도는 구간마다 매칭된 측정값만 칠하고, 측정값 없는 길은 비워 둔다
  return {measured,roadAvg};
}
