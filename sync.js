(()=>{
  if(window.__JUCA_CARDS_SYNC_LOADED__) return;
  window.__JUCA_CARDS_SYNC_LOADED__=true;

  const KEY='jucacards_data';
  const LEGACY_KEYS=['jucacards_rebuild_v3','jucacards_rebuild_v2','jucacards_rebuild_v1','jucacards_rebuild_v0'];
  const FLAG='jucacards_remote_bootstrap_v4';
  let syncing=false;
  const originalSet=Storage.prototype.setItem;

  function currentData(){
    return localStorage.getItem(KEY) || LEGACY_KEYS.map(k=>localStorage.getItem(k)).find(Boolean) || null;
  }

  Storage.prototype.setItem=function(k,v){
    originalSet.call(this,k,v);
    if(k===KEY && location.pathname!=='/api/data') queueSync(v);
  };

  let timer;
  function queueSync(v){
    clearTimeout(timer);
    timer=setTimeout(()=>push(v),700);
  }

  async function push(v){
    if(syncing||!v)return false;
    try{
      syncing=true;
      const r=await fetch('/api/data',{method:'PUT',headers:{'content-type':'application/json'},body:v,keepalive:true});
      if(r.status===409){
        const conflict=await r.json().catch(()=>null);
        if(conflict?.data){
          const remote=JSON.stringify(conflict.data);
          originalSet.call(localStorage,KEY,remote);
          originalSet.call(localStorage,KEY+'_last_good',remote);
          location.reload();
          return false;
        }
      }
      if(!r.ok)throw new Error(`sync ${r.status}`);
      originalSet.call(localStorage,KEY,v);
      originalSet.call(localStorage,KEY+'_last_good',v);
      return true;
    }catch(e){
      console.warn('JucaCards: falha ao sincronizar',e);
      return false;
    }finally{syncing=false}
  }

  async function bootstrap(){
    try{
      const local=currentData();
      const r=await fetch('/api/data',{cache:'no-store'});

      if(r.status===404){
        if(local) await push(local);
        originalSet.call(localStorage,FLAG,'1');
        return;
      }
      if(!r.ok)return;

      const j=await r.json();
      if(!j?.data){
        if(local) await push(local);
        return;
      }

      const remote=JSON.stringify(j.data);
      if(remote!==local){
        originalSet.call(localStorage,KEY,remote);
        originalSet.call(localStorage,KEY+'_last_good',remote);
        originalSet.call(localStorage,FLAG,'1');
        location.reload();
      }
    }catch(e){
      console.warn('JucaCards: armazenamento remoto indisponível',e);
    }
  }

  window.JucaCardsPersistence={sync:()=>push(currentData()),bootstrap};
  bootstrap();
})();
