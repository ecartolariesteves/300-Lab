/* Estado y reglas del Sit & Go de seis jugadores. Sin DOM. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PokerTournament=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const LEVELS=[[10,20,0],[15,30,0],[25,50,0],[50,100,12],[75,150,19],[100,200,25],[150,300,38],[200,400,50],[300,600,75],[400,800,100],[600,1200,150],[800,1600,200]];
 function levelAt(hand,perLevel=10){let n=Math.floor(Math.max(0,hand-1)/perLevel),l=LEVELS[Math.min(n,LEVELS.length-1)];while(n>=LEVELS.length){n-=LEVELS.length;l=[Math.round(l[0]*1.5),Math.round(l[1]*1.5),Math.round(l[2]*1.5)];}return {level:Math.floor((hand-1)/perLevel)+1,sb:l[0],bb:l[1],ante:l[2]};}
 function positions(count){if(count<2||count>6)throw new Error('Jugadores fuera de rango');return ({6:['UTG','HJ','CO','BTN','SB','BB'],5:['HJ','CO','BTN','SB','BB'],4:['CO','BTN','SB','BB'],3:['BTN','SB','BB'],2:['SB','BB']})[count];}
 function create(profiles=['gto','gto','roca','station','maniaco']){return {hand:1,perLevel:10,players:Array.from({length:6},(_,i)=>({id:i,stack:1500,alive:true,profile:i?profiles[i-1]:'hero'})),button:0,finished:false};}
 function effectiveStack(hero,playersBehind){return Math.min(hero,Math.max(0,...playersBehind));}
 function eliminate(state){state.players.forEach(p=>{if(p.stack<=0)p.alive=false;});const alive=state.players.filter(p=>p.alive);if(alive.length<=1){state.finished=true;state.winner=alive[0]?.id??null;}return alive;}
 function advanceHand(state){state.hand++;return levelAt(state.hand,state.perLevel);}
 function prize(place){return place===1?65:place===2?35:0;}
 return {LEVELS,levelAt,positions,create,effectiveStack,eliminate,advanceHand,prize};
});