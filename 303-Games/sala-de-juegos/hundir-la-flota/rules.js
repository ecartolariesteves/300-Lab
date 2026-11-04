/* Motor puro de Hundir la flota. La IA solo recibe el mapa de disparos. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FlotaRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SIZE = 10;
  const FLEET = [5,4,3,3,2];
  const DIRECTIONS = [[0,1],[1,0]];

  function seeded(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let t = state;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const emptyShots = () => Array.from({length:SIZE},()=>Array(SIZE).fill(0));
  const inside = (r,c) => r>=0&&r<SIZE&&c>=0&&c<SIZE;
  const key = (r,c) => r+','+c;

  function cellsFor(r,c,length,vertical) {
    return Array.from({length},(_,i)=>vertical?[r+i,c]:[r,c+i]);
  }

  function canPlace(ships,cells) {
    for(const [r,c] of cells) {
      if(!inside(r,c)) return false;
      for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) {
        const rr=r+dr,cc=c+dc;
        if(!inside(rr,cc)) continue;
        if(ships.some(ship=>ship.cells.some(([sr,sc])=>sr===rr&&sc===cc))) return false;
      }
    }
    return true;
  }

  function isValidFleet(ships) {
    if(!Array.isArray(ships)||ships.length!==5) return false;
    const lengths=ships.map(ship=>ship.cells.length).sort((a,b)=>b-a);
    if(lengths.join(',')!==FLEET.join(',')) return false;
    const placed=[];
    for(const ship of ships) {
      const cells=ship.cells;
      if(!cells.length) return false;
      const rows=new Set(cells.map(cell=>cell[0]));
      const cols=new Set(cells.map(cell=>cell[1]));
      if(rows.size!==1&&cols.size!==1) return false;
      if(rows.size===1) {
        const values=cells.map(cell=>cell[1]).sort((a,b)=>a-b);
        if(values.some((v,i)=>i&&v!==values[i-1]+1)) return false;
      } else {
        const values=cells.map(cell=>cell[0]).sort((a,b)=>a-b);
        if(values.some((v,i)=>i&&v!==values[i-1]+1)) return false;
      }
      if(!canPlace(placed,cells)) return false;
      placed.push(ship);
    }
    return true;
  }

  function placeRandom(random=Math.random) {
    const ships=[];
    const lengths=FLEET.slice();
    function place(index) {
      if(index===lengths.length) return true;
      const length=lengths[index];
      const candidates=[];
      for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) for(const vertical of [false,true]) {
        const cells=cellsFor(r,c,length,vertical);
        if(cells.every(([rr,cc])=>inside(rr,cc))&&canPlace(ships,cells)) candidates.push(cells);
      }
      for(let i=candidates.length-1;i>0;i--) {
        const j=Math.floor(random()*(i+1));
        [candidates[i],candidates[j]]=[candidates[j],candidates[i]];
      }
      for(const cells of candidates) {
        ships.push({length,cells});
        if(place(index+1)) return true;
        ships.pop();
      }
      return false;
    }
    if(!place(0)) throw new Error('No se pudo generar una flota válida');
    return ships;
  }

  function validatePlacement(ships, length, row, col, vertical) {
    const cells=cellsFor(row,col,length,vertical);
    return cells.every(([r,c])=>inside(r,c))&&canPlace(ships,cells);
  }

  function shoot(ships,shots,row,col) {
    if(!inside(row,col)||shots[row][col]!==0) return {shots,result:'invalid',sunk:null,won:false};
    const next=shots.map(line=>line.slice());
    const ship=ships.find(item=>item.cells.some(([r,c])=>r===row&&c===col));
    if(!ship) {
      next[row][col]=1;
      return {shots:next,result:'water',sunk:null,won:false};
    }
    next[row][col]=2;
    const sunk=ship.cells.every(([r,c])=>next[r][c]===2||next[r][c]===3);
    if(sunk) {
      for(const [r,c] of ship.cells) next[r][c]=3;
      for(const [r,c] of ship.cells) {
        for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) {
          const rr=r+dr,cc=c+dc;
          if(inside(rr,cc)&&next[rr][cc]===0) next[rr][cc]=1;
        }
      }
    }
    const won=ships.every(item=>item.cells.every(([r,c])=>next[r][c]===3));
    return {shots:next,result:sunk?'sunk':'hit',sunk: sunk?ship.length:null,won};
  }

  function unknownCells(shots) {
    const cells=[];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(shots[r][c]===0) cells.push([r,c]);
    return cells;
  }

  function hitGroups(shots) {
    const seen=new Set(),groups=[];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) {
      if(shots[r][c]!==2||seen.has(key(r,c))) continue;
      const group=[],stack=[[r,c]];seen.add(key(r,c));
      while(stack.length) {
        const [rr,cc]=stack.pop();group.push([rr,cc]);
        for(const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
          const nr=rr+dr,nc=cc+dc,k=key(nr,nc);
          if(inside(nr,nc)&&shots[nr][nc]===2&&!seen.has(k)){seen.add(k);stack.push([nr,nc]);}
        }
      }
      groups.push(group);
    }
    return groups;
  }

  function randomChoice(cells,random) {
    return cells.length?cells[Math.floor(random()*cells.length)]:null;
  }

  // Esta función recibe exclusivamente los disparos conocidos y los tamaños de barcos restantes.
  function chooseShot(shots,remainingShips=FLEET,difficulty='dificil',random=Math.random) {
    const unknown=unknownCells(shots);
    if(!unknown.length) return null;
    if(difficulty==='facil') return randomChoice(unknown,random);
    const groups=hitGroups(shots);
    if(difficulty==='medio') {
      const targets=[];
      for(const group of groups) for(const [r,c] of group) {
        for(const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
          const rr=r+dr,cc=c+dc;
          if(inside(rr,cc)&&shots[rr][cc]===0) targets.push([rr,cc]);
        }
      }
      const unique=[...new Map(targets.map(cell=>[key(...cell),cell])).values()];
      return randomChoice(unique.length?unique:unknown,random);
    }

    const scores=Array.from({length:SIZE},()=>Array(SIZE).fill(0));
    const candidateLengths=remainingShips.length?remainingShips:FLEET;
    const constraints=groups.length?groups:[[]];
    for(const group of constraints) {
      for(const length of candidateLengths) {
        for(const [dr,dc] of DIRECTIONS) {
          for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) {
            const cells=Array.from({length},(_,i)=>[r+i*dr,c+i*dc]);
            if(!cells.every(([rr,cc])=>inside(rr,cc)&&shots[rr][cc]!==1&&shots[rr][cc]!==3)) continue;
            if(group.length&&!group.every(([hr,hc])=>cells.some(([rr,cc])=>rr===hr&&cc===hc))) continue;
            for(const [rr,cc] of cells) if(shots[rr][cc]===0) scores[rr][cc]++;
          }
        }
      }
    }
    let best=-1,choices=[];
    for(const [r,c] of unknown) {
      const score=scores[r][c];
      if(score>best){best=score;choices.length=0;choices.push([r,c]);}
      else if(score===best) choices.push([r,c]);
    }
    if(best<=0) return randomChoice(unknown,random);
    return randomChoice(choices,random);
  }

  return {SIZE,FLEET,seeded,emptyShots,canPlace,isValidFleet,placeRandom,validatePlacement,shoot,unknownCells,hitGroups,chooseShot};
});
