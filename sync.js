(()=>{
  if(window.__JUCA_CARDS_SYNC_LOADED__) return;
  window.__JUCA_CARDS_SYNC_LOADED__=true;
  const KEY='jucacards_data',LAST=KEY+'_last_good';
  let syncing=false,timer;
  const nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem;
  function parse(raw){try{return raw?JSON.parse(raw):null}catch(e){return null}}
  function cards(d){return d&&Array.isArray(d.cards)?d.cards.length:0}
  function hasContent(d){if(!d||typeof d!=='object'||Array.isArray(d))return false;const decks=Array.isArray(d.decks)?d.decks.length:0;const reviews=Array.isArray(d.reviews)?d.reviews.length:0;return cards(d)>0||reviews>0||decks>1}
  function valid(d){return !!d&&typeof d==='object'&&!Array.isArray(d)&&(Array.isArray(d.cards)||Array.isArray(d.decks))}
  function score(d){return cards(d)*100000+(Array.isArray(d.reviews)?d.reviews.length:0)*100+(Array.isArray(d.decks)?d.decks.length:0)}
  function bestLocal(){let best=null,bs=-1;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k)continue;const raw=nativeGet.call(localStorage,k),d=parse(raw);if(!valid(d))continue;const s=score(d);if(s>bs){bs=s;best={key:k,raw,data:d}}}const main=parse(nativeGet.call(localStorage,KEY));if(valid(main)&&score(main)>=bs)return{key:KEY,raw:nativeGet.call(localStorage,KEY),data:main};return best}
  function queue(){clearTimeout(timer);timer=setTimeout(syncBest,350)}
  Storage.prototype.setItem=function(k,v){nativeSet.call(this,k,v);if(k===KEY&&!syncing)queue()};
  async function put(d){
    if(!valid(d)||syncing)return false;
    try{
      syncing=true;
      // Do NOT use keepalive here. Browsers limit keepalive request bodies to 64 KiB,
      // which caused larger imported flashcard libraries to never reach /api/data.
      const body=JSON.stringify(d);
      const r=await fetch('/api/data',{method:'PUT',headers:{'content-type':'application/json'},body,cache:'no-store'});
      const j=await r.json().catch(()=>null);
      if(r.status===409&&j?.data){const raw=JSON.stringify(j.data);nativeSet.call(localStorage,KEY,raw);nativeSet.call(localStorage,LAST,raw);location.reload();return false}
      if(!r.ok)throw new Error(j?.error||`sync ${r.status}`);
      const raw=JSON.stringify(d);nativeSet.call(localStorage,KEY,raw);nativeSet.call(localStorage,LAST,raw);return true
    }catch(e){console.warn('JucaCards: falha ao salvar no servidor',e);return false}
    finally{syncing=false}
  }
  async function syncBest(){
    if(syncing)return;
    const local=bestLocal();
    if(!local)return;
    try{
      const r=await fetch('/api/data',{cache:'no-store'});
      if(!r.ok){if(hasContent(local.data))await put(local.data);return}
      const j=await r.json(),remote=j?.data;
      if(!valid(remote)){if(hasContent(local.data))await put(local.data);return}
      const lc=cards(local.data),rc=cards(remote);
      if(rc===0&&lc>0){await put(local.data);return}
      if(rc>lc){const raw=JSON.stringify(remote);nativeSet.call(localStorage,KEY,raw);nativeSet.call(localStorage,LAST,raw);location.reload();return}
      if(lc>rc){await put(local.data)}
    }catch(e){console.warn('JucaCards: sincronização indisponível',e)}
  }
  window.JucaCardsPersistence={sync:syncBest,bootstrap:syncBest};
  syncBest();setTimeout(syncBest,1200);setInterval(syncBest,5000);window.addEventListener('focus',syncBest);document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncBest()});
})();
