/* Reglas puras de Parejas: mazos, semilla y comprobación de parejas. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ParejasRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
const SHAPES=[
{id:'estrella',color:'#D97706'},{id:'luna',color:'#3867A6'},{id:'gota',color:'#168B83'},
{id:'rayo',color:'#B34C42'},{id:'hoja',color:'#477A45'},{id:'ancla',color:'#6755A1'},
{id:'flor',color:'#C04D87'},{id:'montana',color:'#8A5A35'},{id:'corazon',color:'#B3261E'},
{id:'espiral',color:'#47718B'},{id:'rombo',color:'#9B6A19'},{id:'campana',color:'#4E7C6A'},
{id:'caracol',color:'#8055A5'},{id:'cometa',color:'#C05A2A'},{id:'corona',color:'#587A2D'},
{id:'pez',color:'#287A9B'},{id:'hongo',color:'#9D4B4B'},{id:'sol',color:'#B47A12'}
];
const SIZES={facil:8,medio:10,dificil:18};
function seeded(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function shuffle(items,random=Math.random){const out=items.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function makeDeck(level='facil',seed){const count=SIZES[level];if(!count)throw new Error('Nivel desconocido');const cards=SHAPES.slice(0,count).flatMap(shape=>[{...shape,key:shape.id},{...shape,key:shape.id}]);return shuffle(cards,seed===undefined?Math.random:seeded(seed));}
function isMatch(a,b){return !!a&&!!b&&a.key===b.key;}
function isWon(cards){return cards.length>0&&cards.every(c=>c.matched);}
return{SHAPES,SIZES,seeded,shuffle,makeDeck,isMatch,isWon};
});
