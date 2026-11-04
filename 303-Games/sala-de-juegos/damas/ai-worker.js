/* Worker para la búsqueda minimax de Damas. */
importScripts('rules.js');
self.addEventListener('message',event=>{
  const {board,player,difficulty,variant,id}=event.data;
  const move=self.DamasRules.chooseMove(board,player,difficulty,variant);
  self.postMessage({move,id});
});
