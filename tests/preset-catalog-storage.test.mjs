import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Storage boundary double: verifies data routing and migration writes, not the
// browser's disk durability, transaction rollback, or actual upgrade timing.
function fixture(initial=[]) {
  const stores=new Map([['presets',new Map(initial.map(r=>[r.id,r]))]]),reads=[];
  let ready;
  const database={
    objectStoreNames:{contains:name=>stores.has(name)},close(){},
    createObjectStore(name){stores.set(name,new Map());return {put:r=>stores.get(name).set(r.id,r)};},
    transaction(names){
      const transaction=new EventTarget();let version=0;
      const request=fn=>{
        const event=new EventTarget(),ticket=++version;
        setImmediate(()=>{event.result=fn();event.dispatchEvent(new Event('success'));
          setImmediate(()=>{if(ticket===version)transaction.dispatchEvent(new Event('complete'));});});
        return event;
      };
      transaction.objectStore=name=>{
        assert.ok((Array.isArray(names)?names:[names]).includes(name));
        return {
          getAll(){reads.push([name,'all']);return request(()=>[...stores.get(name).values()]);},
          get(id){reads.push([name,id]);return request(()=>stores.get(name).get(id));},
          put(r){return request(()=>stores.get(name).set(r.id,r));},
          delete(id){return request(()=>stores.get(name).delete(id));}
        };
      };
      return transaction;
    }
  };
  const indexedDB={open(name,version){
    assert.equal(version,2);
    const request=new EventTarget();request.result=database;
    request.transaction={objectStore:()=>({openCursor(){
      const event=new EventTarget(),entries=[...stores.get('presets').values()];let i=0;
      const next=()=>setImmediate(()=>{event.result=i<entries.length?{value:entries[i++],continue:next}:null;
        event.dispatchEvent(new Event('success'));if(!event.result)ready();});
      next();return event;
    }})};
    queueMicrotask(()=>{
      ready=()=>request.dispatchEvent(new Event('success'));
      if(!stores.has('catalog'))request.dispatchEvent(new Event('upgradeneeded'));else ready();
    });
    return request;
  }};
  const state=vm.createContext({indexedDB});
  const source=readFileSync(new URL('../modules/hairstyle-preset-storage.js',import.meta.url),'utf8');
  vm.runInContext(source.replaceAll('export ',''),state);
  return {api:state,stores,reads};
}
const preset=id=>({id,title:id,category:'full',regions:[],createdAt:1,
  previewImage:'data:image/png;base64,test',project:{format:'anime-hair-studio-project',state:{locks:[]}},
  previewModel:{meshes:[{positions:[0,0,0,1,0,0,0,1,0]}]}});

test('Preset catalog upgrade preserves full records while startup reads metadata only',async()=>{
  const old=preset('old'),{api,stores,reads}=fixture([old]);
  const catalog=await api.listHairstylePresetCatalog();
  assert.equal(catalog.length,1);assert.equal(catalog[0].hasPreviewModel,true);
  assert.ok(!('project' in catalog[0])&&!('previewModel' in catalog[0]));
  assert.equal(stores.get('presets').get('old'),old);
  assert.deepEqual(reads,[['catalog','all']]);
  const detail=await api.readHairstylePresetRecord('old');
  assert.equal(detail.project,old.project);assert.equal(detail.previewModel.meshes.length,1);
  assert.deepEqual(reads.at(-1),['presets','old']);
  await assert.rejects(api.readHairstylePresetRecord('missing'),/no longer available/);
});
test('Preset writes and deletion update both stores; backup listing retains full records',async()=>{
  const {api,stores}=fixture();
  await api.rememberHairstylePresetRecord(preset('new'));
  assert.equal(stores.get('catalog').get('new').title,'new');
  const updated=preset('new');updated.title='renamed';updated.previewModel=null;
  await api.rememberHairstylePresetRecord(updated);
  assert.equal((await api.listHairstylePresetCatalog())[0].hasPreviewModel,false);
  const full=await api.listHairstylePresetRecords();assert.ok(full[0].project);assert.equal(full[0].title,'renamed');
  await api.forgetHairstylePresetRecord('new');
  assert.equal(stores.get('presets').size,0);assert.equal(stores.get('catalog').size,0);
});
