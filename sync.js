(()=>{
  if(window.__JUCA_CARDS_SYNC_LOADED__) return;
  window.__JUCA_CARDS_SYNC_LOADED__=true;

  const KEY='jucacards_data';
  const LAST=KEY+'_last_good';
  let syncing=false;
  let timer;
  const originalSet=Storage.prototype.setItem;

  function parse(raw){try{return raw?JSON.parse(raw):null}catch(e){return null}}
  function count(data){return data&&typeof data==='object' ? (Array.isArray(data.cards)?data.cards.length:0)+(Array.isArray(data.decks)?data.decks.length:0)+(Array.isArray(data.reviews)?data.reviews.length:0) : 0}
  function queue(v){clearTimeout(timer);timer=setTimeout(()=>push(v),700)}

  Storage.prototype.setItem=function(k,v){
    originalSet.call(this,k,v);
    if(k===KEY && !syncing) queue(v);
  };

  async function push(v){
    if(!v || syncing) return false;
    const local=parse(v);
    if(!local) return false;
    try{
      syncing=true;
      const r=await fetch('/api/data',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(local),keepalive:true,cache:'no-store'});
      const j=await r.json().catch(()=>null);
      if(r.status===409 && j?.data){
        const remote=JSON.stringify(j.data);
        originalSet.call(localStorage,KEY,remote);
        originalSet.call(localStorage,LAST,remote);
        location.reload();
        return false;
      }
      if(!r.ok) throw new Error(j?.error||`sync ${r.status}`);
      originalSet.call(localStorage,LAST,JSON.stringify(local));
      return true;
    }catch(e){console.warn('JucaCards: falha ao sincronizar',e);return false}
    finally{syncing=false}
  }

  async function bootstrap(){
    try{
      const localRaw=localStorage.getItem(KEY);
      const local=parse(localRaw);
      const r=await fetch('/api/data',{cache:'no-store'});
      if(r.status===404){
        if(local && count(local)>0) await push(JSON.stringify(local));
        return;
      }
      if(!r.ok) return;
      const j=await r.json();
      const remote=j?.data;
      if(!remote){
        if(local && count(local)>0) await push(JSON.stringify(local));
        return;
      }
      const remoteRaw=JSON.stringify(remote);
      // Remote wins only when it actually contains data. Never replace a populated
      // local database with an empty/default remote response.
      if(count(remote)>0){
        if(remoteRaw!==localRaw){
          originalSet.call(localStorage,KEY,remoteRaw);
          originalSet.call(localStorage,LAST,remoteRaw);
          location.reload();
        }
      }else if(local && count(local)>0){
        await push(JSON.stringify(local));
      }
    }catch(e){console.warn('JucaCards: armazenamento remoto indisponível',e)}
  }

  window.JucaCardsPersistence={sync:()=>push(localStorage.getItem(KEY)),bootstrap};
  bootstrap();
})();
