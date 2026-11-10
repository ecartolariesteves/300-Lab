/* Perfiles de rivales. Sin DOM y sin acceso a las cartas del héroe. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PokerProfiles=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const TYPES=['gto','roca','station','maniaco'];
 const LABELS={gto:'GTO aprox.',roca:'Roca',station:'Station',maniaco:'Maníaco'};
 function assign(mode='mixto',random=Math.random){if(mode!=='mixto')return Array(5).fill(mode);const a=['gto','gto','roca','station','maniaco'];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function choose(profile,{hand,position,spot,chart,street='preflop',equity=0.5,potOdds=0.33,due=0,random=Math.random}={}){
  if(street==='preflop'){const e=chart&&chart[hand]||{};if(profile==='roca'){const tight=spot&&spot.tightChart&&spot.tightChart[hand];if(due>0)return ['QQ','KK','AA','AKs','AKo'].includes(hand)?(e['3bet']?'3bet':'call'):(tight?'call':'fold');return tight?'raise':'fold';}
   if(profile==='station'){if(due>0)return e.call||e.raise||e['3bet']?'call':'fold';if(random()<0.5&&e.raise)return 'limp';return e.raise?'raise':'fold';}
   if(profile==='maniaco'){const play=e.call||e.raise||e['3bet'];if(due>0&&play&&random()<0.6)return '3bet';return e.raise||play?'raise':'fold';}
   let n=random(),sum=0;for(const [a,v] of Object.entries(e)){sum+=v;if(n<=sum)return a;}return 'fold';
  }
  if(due>0){const threshold=profile==='roca'?potOdds+0.10:profile==='station'?potOdds-0.08:potOdds+0.04;return equity>threshold?'call':'fold';}
  if(profile==='roca')return equity>0.80?'bet':'check';
  if(profile==='station')return equity>0.70?'bet':'check';
  if(profile==='maniaco')return equity>0.55|| (equity<0.30&&random()<0.30)?'bet':'check';
  if(equity>0.85&&random()<0.30)return 'raise';
  if(equity<0.25&&random()<0.08)return 'bluff';
  return equity>0.62?'bet':'check';
 }
 function exploitLine(profile,aggression=true){if(profile==='maniaco'&&aggression)return 'Un maníaco farolea mucho: puedes pagar más ligero de lo que dice la tabla.';if(profile==='roca'&&aggression)return 'Una roca casi nunca farolea: foldea manos medias.';if(profile==='station')return 'Un calling station paga de más: apuesta por valor más fino y no le farolees.';return '';}
 return {TYPES,LABELS,assign,choose,exploitLine};
});