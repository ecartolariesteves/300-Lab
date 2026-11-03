/* Motor de cartas y equity. No depende del DOM y funciona en navegador y Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PokerEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const RANKS = '23456789TJQKA';
  const SUITS = 'shdc';
  const makeDeck = () => RANKS.split('').flatMap((r) => SUITS.split('').map((s) => r + s));
  const rank = (c) => RANKS.indexOf(c[0]) + 2;
  const suit = (c) => c[1];
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(deck, random = Math.random) {
    const out = deck.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function straightHigh(values) {
    const u = [...new Set(values)].sort((a,b)=>b-a);
    if (u.includes(14)) u.push(1);
    for (let i=0;i<=u.length-5;i++) if (u[i]-u[i+4]===4) return u[i];
    return 0;
  }
  function evaluate7(cards) {
    if (cards.length !== 7) throw new Error('El evaluador necesita 7 cartas');
    const counts = new Map(), suits = new Map();
    const vals = cards.map(rank);
    for (const c of cards) {
      counts.set(rank(c),(counts.get(rank(c))||0)+1);
      if (!suits.has(suit(c))) suits.set(suit(c),[]);
      suits.get(suit(c)).push(rank(c));
    }
    const groups=[...counts.entries()].map(([r,n])=>({r,n})).sort((a,b)=>b.n-a.n||b.r-a.r);
    const flush=[...suits.values()].find(a=>a.length>=5);
    let category, kickers;
    const sf=flush&&straightHigh(flush);
    if(sf){category=8;kickers=[sf];}
    else if(groups[0].n===4){category=7;kickers=[groups[0].r,groups.find(x=>x.n!==4).r];}
    else if(groups[0].n===3&&groups.some(x=>x.n>=2&&x.r!==groups[0].r)){category=6;kickers=[groups[0].r,groups.find(x=>x.n>=2&&x.r!==groups[0].r).r];}
    else if(flush){category=5;kickers=flush.sort((a,b)=>b-a).slice(0,5);}
    else {const sh=straightHigh(vals);if(sh){category=4;kickers=[sh];}
      else if(groups[0].n===3){category=3;kickers=[groups[0].r,...groups.filter(x=>x.n===1).map(x=>x.r).sort((a,b)=>b-a).slice(0,2)];}
      else if(groups[0].n===2&&groups[1].n===2){category=2;kickers=[groups[0].r,groups[1].r,groups.find(x=>x.n===1).r];}
      else if(groups[0].n===2){category=1;kickers=[groups[0].r,...groups.filter(x=>x.n===1).map(x=>x.r).sort((a,b)=>b-a).slice(0,3)];}
      else {category=0;kickers=vals.sort((a,b)=>b-a).slice(0,5);}
    }
    const score=[category,...kickers,0,0,0,0,0].slice(0,6).reduce((n,v)=>n*15+v,0);
    return {category,kickers,score,name:['Carta alta','Pareja','Dobles parejas','Trío','Escalera','Color','Full','Póker','Escalera de color'][category]};
  }
  function compare(a,b){return Math.sign(a.score-b.score);}
  function combinations(cards, n) {
    const out=[];
    function walk(start, picked){if(picked.length===n){out.push(picked.slice());return;}
      for(let i=start;i<=cards.length-(n-picked.length);i++){picked.push(cards[i]);walk(i+1,picked);picked.pop();}}
    walk(0,[]);return out;
  }
  function handClass(cards) {
    const a=rank(cards[0]),b=rank(cards[1]),hi=Math.max(a,b),lo=Math.min(a,b);
    if(a===b)return RANKS[14-a]+RANKS[14-b];
    const names='23456789TJQKA';
    return names[14-hi]+names[14-lo]+(suit(cards[0])===suit(cards[1])?'s':'o');
  }
  function expandChart(chart, dead=[]) {
    const blocked=new Set(dead), out=[];
    const ranks='23456789TJQKA', suits='shdc';
    for(const [hand,actions] of Object.entries(chart||{})){
      const freq=Object.values(actions).reduce((s,v)=>s+v,0);if(!freq)continue;
      let combos=[];
      if(hand.length===2){const r=hand[0],cs=suits.split('').map(s=>r+s);for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)combos.push([cs[i],cs[j]]);}
      else {const hi=hand[0],lo=hand[1],same=hand[2]==='s';
        for(const s1 of suits)for(const s2 of suits)if((same?s1===s2:s1!==s2))combos.push([hi+s1,lo+s2]);}
      for(const c of combos)if(!blocked.has(c[0])&&!blocked.has(c[1]))out.push({cards:c,weight:freq});
    }
    return out;
  }
  function equity(hero, villainRange, board=[], iterations=4000, seed=12345) {
    const random=rng(seed), dead=new Set([...hero,...board]);
    let pool=(villainRange||[]).filter(x=>x.cards&&!dead.has(x.cards[0])&&!dead.has(x.cards[1]));
    if(!pool.length)pool=[{cards:shuffle(makeDeck().filter(c=>!dead.has(c)),random).slice(0,2),weight:1}];
    const total=pool.reduce((s,x)=>s+(x.weight||1),0);
    const remaining=makeDeck().filter(c=>!dead.has(c));
    let wins=0,ties=0;
    for(let i=0;i<iterations;i++){
      let pick=random()*total, villain=pool[0].cards;
      for(const item of pool){pick-=item.weight||1;if(pick<=0){villain=item.cards;break;}}
      const used=new Set([...dead,...villain]);
      const deck=shuffle(remaining.filter(c=>!used.has(c)),random);
      const runout=board.slice();while(runout.length<5)runout.push(deck.pop());
      const h=evaluate7([...hero,...runout]),v=evaluate7([...villain,...runout]),cmp=compare(h,v);
      if(cmp>0)wins++;else if(cmp===0)ties++;
    }
    return (wins+ties/2)/iterations;
  }
  function deal(seed) {
    const random=seed==null?Math.random:rng(seed);
    const deck=shuffle(makeDeck(),random);
    return {deck,hands:Array.from({length:6},(_,i)=>deck.slice(i*2,i*2+2)),board:deck.slice(12,17)};
  }
  return {RANKS,SUITS,makeDeck,shuffle,rng,rank,evaluate7,compare,combinations,handClass,expandChart,equity,deal};
});