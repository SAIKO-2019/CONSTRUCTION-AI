// CONSTRUCTION MONITORING v28.3
// Theme/readability patch. CSS owns the palette; no recurring work.
(function(){
  document.documentElement.dataset.uiContrast='v283';

  // Theme preview labels can be refreshed if settings was already open.
  const labels={
    pastel:['Sand & Sage','Warm neutral + soft sage'],
    summer:['Chai Vanilla','Chai + vanilla warmth'],
    ocean:['Navy Teal','Navy + teal + sky blue'],
    forest:['Matcha Almond','Matcha + almond + pistache'],
    sunset:['Carob Chai','Carob brown + chai'],
    lavender:['Earth Neutral','Beige + olive + cream']
  };
  document.querySelectorAll('.theme-preview').forEach(btn=>{
    const pair=labels[btn.dataset.themeChoice];
    if(!pair)return;
    const strong=btn.querySelector('strong'),small=btn.querySelector('small');
    if(strong)strong.textContent=pair[0];
    if(small)small.textContent=pair[1];
  });
})();
