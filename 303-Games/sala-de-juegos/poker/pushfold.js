/* Consulta de pushfold.json y explicación básica. Sin DOM. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PokerPushFold=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const POS=['UTG','HJ','CO','BTN','SB','BB'];
 function lookup(data,{stackBb,pos,playersBehind=0,facingPushFrom=null,hand,action=null}){
  const s=Math.round(stackBb);if(stackBb<4||stackBb>=15.5)return {unevaluated:'Fuera del rango de referencia (4-15 bb).'};
  const keyStack=Math.max(4,Math.min(15,s));let key;
  if(facingPushFrom){key='call';const k=pos+'_vs_'+facingPushFrom+'_'+keyStack;const list=data.call[k];if(!list)return {unevaluated:'La posición no tiene una tabla de call para este rival.'};return {table:k,correct:list.includes(hand)?'call':'fold',inRange:list.includes(hand),sharePct:list.length/1326*100};}
  let p=pos;if(playersBehind===2)p='CO';else if(playersBehind===1)p='BTN';else if(playersBehind===0)p='SB';
  key='push';const k=p+'_'+keyStack,list=data.push[k];if(!list)return {unevaluated:'No hay tabla para esta posición.'};return {table:k,correct:list.includes(hand)?'allin':'fold',inRange:list.includes(hand),sharePct:list.length/1326*100};
 }
 function feedback(data,spot){const ante=(data.ante||0)*6,dead=spot.deadPot??0;return ['Bote muerto: '+(dead+ante).toFixed(2)+' bb (ciegas y antes).','El dinero muerto aumenta el premio inmediato de empujar.','Cuando te pagan, tu equity determina el valor del all-in.','Cuanto menos stack y más tarde la posición, más ancho se empuja.'];}
 return {lookup,feedback,POS};
});