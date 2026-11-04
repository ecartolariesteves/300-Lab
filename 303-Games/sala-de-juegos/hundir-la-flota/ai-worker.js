/* Worker opcional para la IA de Hundir la flota. */
importScripts('rules.js');
self.addEventListener('message',event=>{
  const {shots,remainingShips,difficulty,seed}=event.data;
  const random=seed===undefined?Math.random:self.FlotaRules.seeded(seed);
  const cell=self.FlotaRules.chooseShot(shots,remainingShips,difficulty,random);
  self.postMessage({cell});
});
