/* Validación pura de acciones NLHE: no muta el estado de la mesa. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.PokerBetting=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const EPS=1e-9;
  function legalActions({player,currentBet=0,lastRaiseSize=0,street='preflop'}){
    const bet=Number(player.bet)||0,stack=Number(player.stack)||0,due=Math.max(0,currentBet-bet);
    const actions=['fold'];
    if(due<=EPS)actions.push('check');
    else if(stack>0)actions.push('call');
    const maxTo=bet+stack;
    if(stack>due+EPS){
      const minTo=currentBet<=EPS?(street==='preflop'?2:0.01):currentBet+Math.max(lastRaiseSize||currentBet,street==='preflop'?1:0.01);
      if(maxTo+EPS>=minTo)actions.push('raise');
      else if(maxTo>currentBet+EPS)actions.push('allin');
    }else if(stack>EPS&&maxTo>currentBet+EPS)actions.push('allin');
    if(due<=EPS&&stack>EPS)actions.push('bet');
    return [...new Set(actions)];
  }
  function validateAction({action,target,player,currentBet=0,lastRaiseSize=0,street='preflop'}){
    const legal=legalActions({player,currentBet,lastRaiseSize,street});
    if(!legal.includes(action))return {ok:false,reason:'Acción no legal en esta situación.',legal};
    if(action!=='raise'&&action!=='bet')return {ok:true,legal};
    const bet=Number(player.bet)||0,stack=Number(player.stack)||0,maxTo=bet+stack;
    if(!Number.isFinite(target))return {ok:false,reason:'Falta un tamaño numérico.',legal};
    if(target>maxTo+EPS)return {ok:false,reason:'La apuesta supera el stack disponible.',legal};
    if(action==='bet'&&currentBet>bet+EPS)return {ok:false,reason:'No puedes apostar si ya hay una apuesta que igualar.',legal};
    const minTo=currentBet<=EPS?(street==='preflop'?2:0.01):currentBet+Math.max(lastRaiseSize||currentBet,street==='preflop'?1:0.01);
    if(target+EPS<minTo)return {ok:false,reason:'La subida no alcanza el mínimo legal.',legal};
    if(target<=currentBet+EPS)return {ok:false,reason:'El tamaño debe superar la apuesta actual.',legal};
    return {ok:true,legal};
  }
  function classify(action){return action==='raise'?'raise':action==='3bet'?'3bet':action==='4bet'?'4bet':action;}
  return {legalActions,validateAction,classify};
});