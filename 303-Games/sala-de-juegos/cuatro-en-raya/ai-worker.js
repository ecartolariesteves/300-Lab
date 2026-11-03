/* Worker independiente para que la búsqueda profunda no bloquee el tablero. */
importScripts('rules.js');
self.addEventListener('message',event=>{
 const {board,player,difficulty,id}=event.data;
 const column=self.CuatroRules.chooseMove(board,player,difficulty);
 self.postMessage({column,id});
});
