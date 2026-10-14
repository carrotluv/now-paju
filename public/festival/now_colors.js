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
  // 이름만 같은 먼 구간을 메울 도로별 대표값 — 그 도로 링크들의 색 중 가장 많은 것(같으면 더 막히는 쪽).
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
  const avgOf=a=>Math.round(a.reduce((x,y)=>x+y,0)/a.length);
  Object.keys(measured).slice().forEach(ri=>{              // 왕복 분리도로는 반대편 차로도 같이 칠한다
    (ROADSIB[ri]||[]).forEach(s=>{ if(!measured[s]) measured[s]=measured[ri].slice(); });
  });
  Object.keys(measured).slice().forEach(ri=>{              // 두 방향 값이 다르면 더 막히는 쪽으로 맞춘다
    (ROADSIB[ri]||[]).forEach(s=>{                         //   한 줄로 그리므로 보수적인 쪽을 보여 주는 게 맞다
      if(!measured[s]||!measured[ri]) return;
      const a=avgOf(measured[ri]), b=avgOf(measured[s]);
      if(a!==b){ const w=Math.min(a,b); measured[ri]=[w]; measured[s]=[w]; }
    });
  });
  // 교차로 조각 메우기: 색이 없는 짧은 구간이라도 양 끝이 색칠 도로에 붙어 있으면 이웃 속도를 물려받는다
  const val=i=>{ const a=measured[i]; return a?Math.round(a.reduce((x,y)=>x+y,0)/a.length):(roadAvg[ROADGEO[i].n]??null); };
  if(!ROADGEO._fill){                                      // 끝점 색인 (회전교차로는 모든 점을 넣어 진입로와 만나게)
    const k=p=>p[0].toFixed(5)+','+p[1].toFixed(5), em={};
    ROADGEO.forEach((r,i)=>{
      const pts=r.rb?r.p:[r.p[0],r.p[r.p.length-1]];
      pts.forEach(p=>{ (em[k(p)]=em[k(p)]||[]).push(i); });
    });
    ROADGEO._fill=em;
  }
  const kf=p=>p[0].toFixed(5)+','+p[1].toFixed(5);
  const roadLen=p=>{ let s=0; for(let i=0;i<p.length-1;i++) s+=Math.hypot((p[i+1][0]-p[i][0])*111320,(p[i+1][1]-p[i][1])*88000); return s; };
  const dirAt=(p,atStart)=>{ const a=atStart?p[0]:p[p.length-1], b=atStart?p[1]:p[p.length-2];
    return (Math.atan2((b[1]-a[1])*Math.cos(a[0]*Math.PI/180),b[0]-a[0])*180/Math.PI+360)%360; };
  const angGap=(a,b)=>{ const d=Math.abs(a-b)%360; return Math.min(d,360-d); };
  const inherit={};
  const cur=i=>{ const v=val(i); return v!=null?v:(inherit[i]??null); };
  for(let round=0;round<3;round++){                         // 나들목 램프는 여러 조각이라 여러 번 물려줘야 다 이어진다
    const add={};
    ROADGEO.forEach((r,i)=>{
      if(cur(i)!=null) return;
      const nb=[];
      if(r.rb){                                            // 회전교차로: 원형이라 모든 점에서 진입로를 찾는다
        r.p.forEach(p=>(ROADGEO._fill[kf(p)]||[]).forEach(j=>{ if(j!==i){const v=cur(j); if(v!=null) nb.push(v);} }));
        if(nb.length) add[i]=Math.round(nb.reduce((a,b)=>a+b,0)/nb.length);
        return;
      }
      const len=roadLen(r.p);
      if(!r.lk&&len>800) return;                           // 램프는 길이 제한 없이, 그 외는 800m 이하만
      const line=[];                                       // 곧게 이어지거나 같은 도로명인 이웃 — 이쪽 색을 우선한다
      [0,1].forEach(e=>{
        const at=e===0, p=at?r.p[0]:r.p[r.p.length-1], mine=dirAt(r.p,at);
        (ROADGEO._fill[kf(p)]||[]).forEach(j=>{
          if(j===i) return;
          const v=cur(j); if(v==null) return;
          nb.push(v);
          const jp=ROADGEO[j].p, js=kf(jp[0])===kf(p);
          if(angGap(mine,(dirAt(jp,js)+180)%360)<=50||(r.n&&ROADGEO[j].n===r.n)) line.push(v);
        });
      });
      const use=line.length?line:nb;                       // 교차하는 다른 도로 색이 섞이지 않게
      if(nb.length>=(r.lk||line.length?1:2)&&(len<=300||r.lk||line.length))
        add[i]=Math.round(use.reduce((a,b)=>a+b,0)/use.length);
    });
    const keys=Object.keys(add);
    if(!keys.length) break;
    keys.forEach(i=>inherit[i]=add[i]);
  }
  // 이어짐 마무리 — 끝점이 1m쯤 어긋나 매칭이 빗나간 구간은 30m 안에서 방향이 맞는 색을 잇는다
  const EG=0.0003, ek=(a,b)=>Math.round(a/EG)+','+Math.round(b/EG);
  for(let round=0;round<3;round++){                         // 방금 이어 붙인 구간이 다음 구간의 근거가 된다
    const eg={};
    ROADGEO.forEach((r,i)=>{ if(cur(i)==null) return;
      [true,false].forEach(at=>{ const p=at?r.p[0]:r.p[r.p.length-1];
        (eg[ek(p[0],p[1])]=eg[ek(p[0],p[1])]||[]).push([p,dirAt(r.p,at),cur(i),r.n]); }); });
    const add={};
    ROADGEO.forEach((r,i)=>{
      if(cur(i)!=null||r.lk) return;
      const nb=[];
      [true,false].forEach(at=>{
        const p=at?r.p[0]:r.p[r.p.length-1], mine=dirAt(r.p,at);
        const cy=Math.round(p[0]/EG), cx=Math.round(p[1]/EG);
        for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) (eg[(cy+dy)+','+(cx+dx)]||[]).forEach(([q,d,v,n])=>{
          if(Math.hypot((q[0]-p[0])*111320,(q[1]-p[1])*88000)>30) return;
          if(angGap(mine,(d+180)%360)<=50||(r.n&&n===r.n)) nb.push(v);
        });
      });
      if(nb.length) add[i]=Math.round(nb.reduce((a,b)=>a+b,0)/nb.length);
    });
    const keys=Object.keys(add);
    if(!keys.length) break;
    keys.forEach(i=>inherit[i]=add[i]);
  }
  // 램프 마무리 — 나들목 조각은 양 끝에서 가장 가까이 맞닿은 도로 색을 각각 받아, 반씩 나눠 칠한다.
  //   한쪽 색으로만 칠하면 본선 색과 부딪혀 보이므로 양쪽을 이어 주는 셈.
  const split={};
  const ramps=[];
  ROADGEO.forEach((r,i)=>{ if(r.lk&&val(i)==null) ramps.push(i); });
  if(ramps.length){
    const GC=0.0006, gk=(a,b)=>Math.round(a/GC)+','+Math.round(b/GC), gm={};
    ROADGEO.forEach((r,i)=>{ if(r.lk) return; const v=cur(i); if(v==null) return;
      r.p.forEach(p=>{ (gm[gk(p[0],p[1])]=gm[gk(p[0],p[1])]||[]).push([p,v]); }); });
    const nearest=p=>{
      let best=null, bd=80, cy=Math.round(p[0]/GC), cx=Math.round(p[1]/GC);
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) (gm[(cy+dy)+','+(cx+dx)]||[]).forEach(([q,v])=>{
        const d=Math.hypot((q[0]-p[0])*111320,(q[1]-p[1])*88000);
        if(d<bd){ bd=d; best=v; }
      });
      return best;
    };
    ramps.forEach(i=>{
      const p=ROADGEO[i].p, a=nearest(p[0]), b=nearest(p[p.length-1]);
      if(a!=null&&b!=null&&spdColor(a)!==spdColor(b)) split[i]={a,b};
      else if(a!=null||b!=null) inherit[i]=(a!=null&&b!=null)?Math.round((a+b)/2):(a??b);
    });
  }
  // 짧은 조각 하나만 색이 튀는 것 다듬기 — 양옆이 같은 색이면 그 색을 따른다.
  //   교량·교차로 한 칸(17m짜리도 있다)의 측정값 하나가 그대로 색이 되어 선이 얼룩덜룩해 보이던 문제.
  const smooth={}, SMOOTH_M=120;
  ROADGEO.forEach((r,i)=>{
    const v=cur(i);
    if(v==null||split[i]||roadLen(r.p)>SMOOTH_M) return;
    const nb=[];
    [r.p[0],r.p[r.p.length-1]].forEach(p=>(ROADGEO._fill[kf(p)]||[]).forEach(j=>{
      if(j===i) return; const w=cur(j); if(w!=null) nb.push(w); }));
    if(nb.length<2) return;
    const cs=new Set(nb.map(spdColor));
    if(cs.size===1&&!cs.has(spdColor(v))) smooth[i]=Math.round(nb.reduce((a,b)=>a+b,0)/nb.length);
  });
  return {measured,inherit,roadAvg,split,smooth};
}
