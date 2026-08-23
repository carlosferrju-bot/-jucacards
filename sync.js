(()=>{
  if(window.__JUCA_CARDS_SYNC_LOADED__) return;
  window.__JUCA_CARDS_SYNC_LOADED__=true;

  const KEY='jucacards_data';
  const LAST=KEY+'_last_good';
  let syncing=false;
  let timer;
  const nativeGet=Storage.prototype.getItem;
  const nativeSet=Storage.prototype.setItem;

  function parse(raw){try{return raw?JSON.parse(raw):null}catch(e){return null}}
  function count(data){return data&&typeof data==='object' ? (Array.isArray(data.cards)?data.cards.length:0)+(Array.isArray(data.decks)?data.decks.length:0)+(Array.isArray(data.reviews)?data.reviews.length:0) : 0}
  function score(data){return count(data)*1000+(Array.isArray(data.decks)?data.decks.length:0)*10+(Array.isArray(data.reviews)?data.reviews.length:0)}
  function valid(data){return !!data&&typeof data==='object'&&!Array.isArray(data)&&(Array.isArray(data.cards)||Array.isArray(data.decks))}

  // Recover imported/rebuilt databases that may have been stored under an older key.
  function bestLocal(){
    let best=null,bestScore=-1;
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i); if(!k) continue;
      const raw=nativeGet.call(localStorage,k); const data=parse(raw);
      if(!valid(data)) continue;
      const s=score(data);
      if(s>bestScore){bestScore=s;best={key:k,raw,data}}
    }
    const main=parse(nativeGet.call(localStorage,KEY));
    if(valid(main) && score(main)>=bestScore) return {key:KEY,raw:nativeGet.call(localStorage,KEY),data:main};
    return best;
  }

  function queue(){clearTimeout(timer);timer=setTimeout(syncBest,500)}
  Storage.prototype.setItem=function(k,v){
    nativeSet.call(this,k,v);
    if(k===KEY&&!syncing) queue();
  };

  async function put(data){
    if(!valid(data)||syncing) return false;
    try{
      syncing=true;
      const r=await fetch('/api/data',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(data),keepalive:true,cache:'no-store'});
      const j=await r.json().catch(()=>null);
      if(r.status===409&&j?.data){
        const raw=JSON.stringify(j.data); nativeSet.call(localStorage,KEY,raw); nativeSet.call(localStorage,LAST,raw); location.reload(); return false;
      }
      if(!r.ok) throw new Error(j?.error||`sync ${r.status}`);
      const raw=JSON.stringify(data); nativeSet.call(localStorage,KEY,raw); nativeSet.call(localStorage,LAST,raw);
      return true;
    }catch(e){console.warn('JucaCards: falha ao salvar no servidor',e);return false}
    finally{syncing=false}
  }

  async function syncBest(){
    if(syncing) return;
    const local=bestLocal();
    if(!local) return;
    try{
      const r=await fetch('/api/data',{cache:'no-store'});
      if(!r.ok){ if(count(local.data)>0) await put(local.data); return; }
      const j=await r.json(); const remote=j?.data;
      if(!valid(remote)){ if(count(local.data)>0) await put(local.data); return; }
      const lc=count(local.data), rc=count(remote);
      if(rc===0 && lc>0){ await put(local.data); return; }
      if(rc>lc){
        const raw=JSON.stringify(remote); nativeSet.call(localStorage,KEY,raw); nativeSet.call(localStorage,LAST,raw); location.reload(); return;
      }
      // When the server has the same or fewer cards, prefer the populated local copy.
      // This is what makes an import on one device available to the other devices.
      if(lc>rc){ await put(local.data); }
    }catch(e){console.warn('JucaCards: sincronização indisponível',e)}
  }

  // Keep the remote copy current even when the application's own save function
  // does not call the persistence layer directly.
  window.JucaCardsPersistence={sync:syncBest,bootstrap:syncBest};
  syncBest();
  setTimeout(syncBest,1500);
  setInterval(syncBest,5000);
  window.addEventListener('focus',syncBest);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncBest()});
})();
