/* Evaluación independiente de la acción elegida y del tamaño utilizado. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.PokerEvaluation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function actionScore(action,frequencies){
    const freq=frequencies||{},max=Math.max(0,...Object.values(freq));
    const value=Number(freq[action])||0;
    const score=max?Math.round(100*value/max):0;
    return {score,frequency:value,bestFrequency:max,verdict:score>=90?'Correcta':score>=50?'Aceptable (estrategia mixta)':score>0?'Imprecisa':'Error'};
  }
  function sizingScore(actual,reference,{tolerance=0.15}={}){
    if(!Number.isFinite(actual)||!Number.isFinite(reference)||actual<=0||reference<=0)return {evaluated:false,score:null,verdict:'Sin evaluar'};
    const error=Math.abs(actual-reference)/reference;
    const score=Math.max(0,Math.round(100*(1-error/Math.max(tolerance,0.001))));
    return {evaluated:true,score,actual,reference,error,verdict:score>=90?'Tamaño correcto':score>=50?'Tamaño cercano':'Revisar tamaño'};
  }
  function evaluateDecision({action,frequencies,actualSize,referenceSize,sizeTolerance}){
    const actionResult=actionScore(action,frequencies);
    const sizeResult=sizingScore(actualSize,referenceSize,{tolerance:sizeTolerance});
    return {action:actionResult,sizing:sizeResult,overallScore:sizeResult.evaluated?Math.round((actionResult.score+sizeResult.score)/2):actionResult.score};
  }
  return {actionScore,sizingScore,evaluateDecision};
});