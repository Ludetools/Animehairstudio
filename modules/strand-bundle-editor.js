import { normalizeStrandBundle, normalizeBundleAccent } from './strand-bundle.js?v=20260907-7';
import { mountBundleCurveEditor } from './bundle-curve-editor.js?v=20260905-1';
const key = 'anime-hair-studio-strand-bundle-recipe';
export function mountStrandBundleEditor(root, host, changed) {
  let recipe = normalizeStrandBundle();
  try { const saved = JSON.parse(host.localStorage.getItem(key)); if(saved) recipe=normalizeStrandBundle(saved); } catch { /* Defaults remain usable. */ }
  const fields = [];
  const curves = [];
  const build = (title, prefix, specs) => {
    const section = root.ownerDocument.createElement('fieldset');
    const legend = root.ownerDocument.createElement('legend'); legend.textContent=title; section.append(legend);
    for(const [name,label,min,max,step] of specs) {
      const row=root.ownerDocument.createElement('label'); row.className='compact-select-row';
      const caption=root.ownerDocument.createElement('span'); caption.textContent=label;
      const input=root.ownerDocument.createElement('input'); input.type='number'; input.min=min; input.max=max; input.step=step;
      input.value=(prefix?recipe[prefix][name]:recipe[name]) ?? '';
      if(name==='release') {input.placeholder='Legacy';input.title='Fraction of this lock before the tip begins to peel away. Empty retains legacy placement.';}
      input.addEventListener('change',()=>{const target=prefix?recipe[prefix]:recipe;target[name]=name==='release' && input.value==='' ? null : Number(input.value);recipe=normalizeStrandBundle(recipe);sync(false);changed();});
      fields.push({input,prefix,name}); row.append(caption,input); section.append(row);
    }
    root.append(section);
  };
  const sync=(rebuildAccents=true)=>{fields.forEach(({input,prefix,name})=>{input.value=(prefix?recipe[prefix][name]:recipe[name]) ?? '';});curves.forEach(curve=>curve.render());if(rebuildAccents)renderAccents();};
  build('Main Shape & Variation','',[['width','Main width',.02,2,.01],['depth','Depth / width',.1,2,.05],['taper','Accessory taper',.2,3,.1],['seed','Seed',0,2147483647,1],['variation','Variation',0,1,.05]]);
  for(const [key,title] of [['widthCurve','Main Width Curve'],['depthCurve','Main Depth Curve']]) {
    curves.push(mountBundleCurveEditor(root,title,()=>recipe[key],value=>{recipe[key]=value;changed();}));
  }
  const specs=[['count','Count',0,24,1],['width','Relative width',.01,.8,.01],['length','Length fraction',.1,1,.05],['start','Root position',0,.8,.05],['follow','Surface following',0,1,.05],['release','Release point',0,.95,.05],['flare','Tip separation',0,2,.05],['curl','Curl',0,1,.05]];
  build('Medium Locks','medium',specs); build('Flyaways','flyaway',specs);
  const accentRoot=root.ownerDocument.createElement('div');root.append(accentRoot);
  function renderAccents() {
    accentRoot.replaceChildren();
    recipe.accents.forEach((accent,index)=>{
      const section=root.ownerDocument.createElement('fieldset');
      const legend=root.ownerDocument.createElement('legend');legend.textContent=`Chunky Accent ${index+1}`;section.append(legend);
      for(const [name,label,min,max,step] of [
        ['start','Attachment',0,1,.01],['angle','Around strand (°)',-180,180,5],
        ['width','Relative width',.02,.8,.01],['depth','Depth / width',.1,2,.05],
        ['length','Length fraction',.02,.6,.01],['flow','Flow (−1 up / 1 down)',-1,1,.1],
        ['reach','Outward reach',0,3,.05],['bend','Bend',-2,2,.05],
      ]) {
        const row=root.ownerDocument.createElement('label');row.className='compact-select-row';
        const caption=root.ownerDocument.createElement('span');caption.textContent=label;
        const input=root.ownerDocument.createElement('input');Object.assign(input,{type:'number',min,max,step,value:accent[name]});
        input.addEventListener('change',()=>{recipe.accents[index]=normalizeBundleAccent({...recipe.accents[index],[name]:Number(input.value)});input.value=recipe.accents[index][name];changed();});
        row.append(caption,input);section.append(row);
      }
      const remove=root.ownerDocument.createElement('button');remove.type='button';remove.textContent='Remove Accent';
      remove.addEventListener('click',()=>{recipe.accents.splice(index,1);renderAccents();changed();});section.append(remove);accentRoot.append(section);
    });
    const add=root.ownerDocument.createElement('button');add.type='button';add.textContent='Add Chunky Accent';add.disabled=recipe.accents.length>=8;
    add.addEventListener('click',()=>{recipe.accents.push(normalizeBundleAccent());renderAccents();changed();});accentRoot.append(add);
  }
  renderAccents();
  const status=root.ownerDocument.createElement('p'); status.className='help-text';
  for(const [label,action] of [
    ['Reroll',()=>{recipe.seed=(recipe.seed+1)%2147483648;sync();changed();}],
    ['Save Recipe',()=>{try{host.localStorage.setItem(key,JSON.stringify(recipe));status.textContent='Recipe saved in this browser.';}catch{status.textContent='Could not save recipe. Browser storage is unavailable.';}}],
    ['Reset Recipe',()=>{recipe=normalizeStrandBundle();sync();changed();}],
  ]) {const button=root.ownerDocument.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',action);root.append(button);}
  root.append(status);
  return {
    getRecipe:()=>normalizeStrandBundle(recipe),
    setRecipe:value=>{recipe=normalizeStrandBundle(value);sync();status.textContent='Ponytail recipe loaded. Save Recipe to keep your changes.';changed();},
  };
}
