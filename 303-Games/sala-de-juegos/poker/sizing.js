/* Tamaños de referencia configurables. Todos los importes son el total de la apuesta en bb. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.PokerSizing=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DEFAULTS={open:2.5,openSB:3,threeBetIP:3,threeBetOOP:4,fourBet:2.2,betSmall:0.33,betLarge:0.75};
  const PRESETS={
    balanced:{...DEFAULTS},
    small:{...DEFAULTS,open:2.2,openSB:2.5,threeBetIP:2.8,threeBetOOP:3.5,fourBet:2,betSmall:0.25,betLarge:0.66},
    large:{...DEFAULTS,open:3,openSB:3.5,threeBetIP:3.5,threeBetOOP:4.5,fourBet:2.5,betSmall:0.5,betLarge:1}
  };
  function config(value={}){
    const out={...DEFAULTS};
    for(const key of Object.keys(DEFAULTS)){
      if(value[key]!==undefined){
        const n=Number(value[key]);
        if(!Number.isFinite(n)||n<=0)throw new Error('Tamaño no válido: '+key);
        out[key]=n;
      }
    }
    if(out.betSmall>=out.betLarge)throw new Error('La apuesta pequeña debe ser menor que la grande.');
    return out;
  }
  function clampToStack(target,bet,stack){return Math.max(bet,Math.min(Number(target),Number(bet)+Number(stack)));}
  function preflopTarget({position='CO',opponentPosition=null,raises=0,currentBet=1,heroBet=0,stack=100,config:rawConfig={}}){
    const c=config(rawConfig);
    let target;
    if(raises<=0)target=position==='SB'?c.openSB:c.open;
    else if(raises===1){
      const order=['SB','BB','UTG','HJ','CO','BTN'];
      const inPosition=opponentPosition?order.indexOf(position)>order.indexOf(opponentPosition):!['SB','BB'].includes(position);
      target=currentBet*(inPosition?c.threeBetIP:c.threeBetOOP);
    }
    else target=currentBet*c.fourBet;
    return clampToStack(target,heroBet,stack);
  }
  function minRaiseTo({currentBet=0,lastRaiseSize=0,street='preflop'}){
    if(currentBet<=0)return street==='preflop'?2:0;
    return currentBet+Math.max(lastRaiseSize||currentBet,street==='preflop'?1:0.01);
  }
  function postflopTarget({pot,heroBet=0,stack=100,pct=0.33}){
    if(!Number.isFinite(pot)||pot<0||!Number.isFinite(pct)||pct<=0)throw new Error('Bote o porcentaje no válido.');
    return clampToStack(heroBet+Math.max(0.01,pot*pct),heroBet,stack);
  }
  function postflopTargets({pot,heroBet=0,stack=100,config:rawConfig={}}){
    const c=config(rawConfig);
    return [postflopTarget({pot,heroBet,stack,pct:c.betSmall}),postflopTarget({pot,heroBet,stack,pct:c.betLarge})];
  }
  return {DEFAULTS,PRESETS,config,clampToStack,preflopTarget,minRaiseTo,postflopTarget,postflopTargets};
});