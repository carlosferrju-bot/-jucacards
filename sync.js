(()=>{
  const KEY='jucacards_rebuild_v3';
  const FLAG='jucacards_remote_bootstrap_v1';
  let syncing=false;
  const originalSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){
    originalSet.call(this,k,v);
    if(k===KEY && location.pathname!=='/api/data') queueSync(v);
  };
  let timer;
  function queueSync(v){
    clearTimeout(timer);
    timer=setTimeout(()=>push(v),500);
  }
  async function push(v){
    if(syncing||!v)return;
    try{syncing=true;await fetch('/api/data',{method:'PUT',headers:{'content-type':'application/json'},body:v,keepalive:true})}catch(e){console.warn('JucaCards: falha ao sincronizar',e)}finally{syncing=false}
  }
  async function bootstrap(){
    try{
      const r=await fetch('/api/data',{cache:'no-store'});
      if(!r.ok)return;
      const j=await r.json();
      if(!j?.data)return;
      const local=localStorage.getItem(KEY);
      const remote=JSON.stringify(j.data);
      if(remote===local)return;
      originalSet.call(localStorage,KEY,remote);
      originalSet.call(localStorage,FLAG,'1');
      location.reload();
    }catch(e){console.warn('JucaCards: armazenamento remoto indisponível',e)}
  }
  window.JucaCardsPersistence={sync:()=>push(localStorage.getItem(KEY)),bootstrap};
  bootstrap();
})();
