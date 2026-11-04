/* Motor puro de damas: capturas obligatorias, mayoría y damas voladoras. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DamasRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SIZE = 8;
  const DIRECTIONS = [[-1,-1],[-1,1],[1,-1],[1,1]];
  const inside = (r,c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  const key = (r,c) => r + ',' + c;
  const parse = value => value.split(',').map(Number);
  const cloneBoard = board => board.map(row => row.map(piece => piece ? {...piece} : null));

  function createBoard() {
    const board = Array.from({length:SIZE}, () => Array(SIZE).fill(null));
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < SIZE; c++) if ((r + c) % 2 === 1) board[r][c] = {player:2, king:false};
    }
    for (let r = 5; r < 8; r++) {
      for (let c = 0; c < SIZE; c++) if ((r + c) % 2 === 1) board[r][c] = {player:1, king:false};
    }
    return board;
  }

  function directionsFor(piece, variant, capture = false) {
    if (piece.king || (capture && variant === 'brasilenas')) return DIRECTIONS;
    return piece.player === 1 ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
  }

  function captureOptions(board, row, col, piece, variant, captured) {
    const options = [];
    const dirs = directionsFor(piece, variant, true);
    for (const [dr,dc] of dirs) {
      if (piece.king) {
        let r = row + dr, c = col + dc;
        while (inside(r,c) && !board[r][c]) { r += dr; c += dc; }
        if (!inside(r,c)) continue;
        const target = board[r][c];
        if (target.player === piece.player || captured.has(key(r,c))) continue;
        const enemy = [r,c];
        r += dr; c += dc;
        while (inside(r,c) && !board[r][c]) {
          options.push({to:[r,c],capture:enemy});
          r += dr; c += dc;
        }
      } else {
        const er = row + dr, ec = col + dc;
        const lr = row + 2*dr, lc = col + 2*dc;
        if (!inside(er,ec) || !inside(lr,lc)) continue;
        const target = board[er][ec];
        if (target && target.player !== piece.player && !captured.has(key(er,ec)) && !board[lr][lc]) {
          options.push({to:[lr,lc],capture:[er,ec]});
        }
      }
    }
    return options;
  }

  function enumerateCaptures(board, row, col, piece, variant, captured = new Set(), path = [], captures = [], origin = [row,col]) {
    const options = captureOptions(board,row,col,piece,variant,captured);
    if (!options.length) {
      if (captures.length) return [{from:origin,to:[row,col],path,captures,player:piece.player,king:piece.king}];
      return [];
    }
    const all = [];
    for (const option of options) {
      const nextCaptured = new Set(captured);
      nextCaptured.add(key(...option.capture));
      all.push(...enumerateCaptures(
        board, option.to[0], option.to[1], piece, variant,
        nextCaptured, [...path, option.to], [...captures, option.capture], origin
      ));
    }
    return all;
  }

  function simpleMoves(board,row,col,piece) {
    const moves = [];
    if (piece.king) {
      for (const [dr,dc] of DIRECTIONS) {
        let r=row+dr,c=col+dc;
        while (inside(r,c) && !board[r][c]) {
          moves.push({from:[row,col],to:[r,c],path:[[r,c]],captures:[],player:piece.player,king:true});
          r+=dr;c+=dc;
        }
      }
    } else {
      for (const [dr,dc] of directionsFor(piece,'espanolas')) {
        const r=row+dr,c=col+dc;
        if (inside(r,c) && !board[r][c]) moves.push({from:[row,col],to:[r,c],path:[[r,c]],captures:[],player:piece.player,king:false});
      }
    }
    return moves;
  }

  function legalMoves(board, player, variant = 'espanolas') {
    let captures = [];
    let moves = [];
    for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) {
      const piece = board[r][c];
      if (!piece || piece.player !== player) continue;
      captures.push(...enumerateCaptures(board,r,c,piece,variant).map(move=>({...move,from:[r,c]})));
      moves.push(...simpleMoves(board,r,c,piece));
    }
    if (captures.length) {
      const max = Math.max(...captures.map(move => move.captures.length));
      return captures.filter(move => move.captures.length === max);
    }
    return moves;
  }

  function findOrigin(board,player,move) {
    // La primera casilla de la ruta se obtiene retrocediendo al origen en el tablero.
    for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) {
      const piece=board[r][c];
      if (!piece || piece.player!==player) continue;
      const candidate=enumerateCaptures(board,r,c,piece,'brasilenas');
      if (candidate.some(m=>m.to[0]===move.to[0]&&m.to[1]===move.to[1]&&m.path.length===move.path.length&&m.path.every((p,i)=>p[0]===move.path[i][0]&&p[1]===move.path[i][1]))) return [r,c];
    }
    return null;
  }

  function applyMove(board, move) {
    const next=cloneBoard(board);
    const [fr,fc]=move.from;
    const piece={...next[fr][fc]};
    next[fr][fc]=null;
    for (const [r,c] of move.captures) next[r][c]=null;
    const [tr,tc]=move.to;
    if (!piece.king && ((piece.player===1&&tr===0)||(piece.player===2&&tr===7))) piece.king=true;
    next[tr][tc]=piece;
    return next;
  }

  function pieceCount(board,player) {
    return board.flat().filter(piece=>piece?.player===player).length;
  }

  function evaluate(board,player) {
    let score=0;
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) {
      const piece=board[r][c];
      if(!piece) continue;
      const sign=piece.player===player?1:-1;
      const material=piece.king?300:100;
      const advancement=piece.king?0:(piece.player===1?7-r:r)*4;
      const center=(3.5-Math.abs(3.5-c))*3+(3.5-Math.abs(3.5-r))*2;
      score+=sign*(material+advancement+center);
    }
    return score;
  }

  function orderedMoves(board,moves) {
    return moves.slice().sort((a,b)=>
      (b.captures.length*100 + (3.5-Math.abs(3.5-b.to[1]))*3) -
      (a.captures.length*100 + (3.5-Math.abs(3.5-a.to[1]))*3)
    );
  }

  function minimax(board,depth,alpha,beta,maximizing,player,variant) {
    const current=maximizing?player:3-player;
    const moves=legalMoves(board,current,variant);
    if(depth===0||!moves.length) {
      if(!moves.length) return maximizing?-100000-depth:100000+depth;
      return evaluate(board,player);
    }
    const sorted=orderedMoves(board,moves);
    if(maximizing) {
      let best=-Infinity;
      for(const move of sorted) {
        best=Math.max(best,minimax(applyMove(board,move),depth-1,alpha,beta,false,player,variant));
        alpha=Math.max(alpha,best);
        if(beta<=alpha) break;
      }
      return best;
    }
    let best=Infinity;
    for(const move of sorted) {
      best=Math.min(best,minimax(applyMove(board,move),depth-1,alpha,beta,true,player,variant));
      beta=Math.min(beta,best);
      if(beta<=alpha) break;
    }
    return best;
  }

  function chooseMove(board,player=2,difficulty='medio',variant='espanolas',random=Math.random) {
    const moves=legalMoves(board,player,variant);
    if(!moves.length) return null;
    if(difficulty==='facil'&&random()<0.25) return moves[Math.floor(random()*moves.length)];
    const depth=difficulty==='dificil'?6:difficulty==='facil'?2:4;
    let best=-Infinity,choice=moves[0];
    for(const move of orderedMoves(board,moves)) {
      const score=minimax(applyMove(board,move),depth-1,-Infinity,Infinity,false,player,variant);
      if(score>best) {best=score;choice=move;}
    }
    return choice;
  }

  function winner(board,player,variant='espanolas') {
    if(pieceCount(board,player)===0||legalMoves(board,player,variant).length===0) return 3-player;
    if(pieceCount(board,3-player)===0) return player;
    return 0;
  }

  return {SIZE,createBoard,cloneBoard,legalMoves,applyMove,pieceCount,evaluate,minimax,chooseMove,winner};
});
