const OWNER=process.env.GITHUB_OWNER;
const rawRepo=process.env.GITHUB_REPO;
const REPO=rawRepo==='jucacards'?'-jucacards':rawRepo;
const TOKEN=process.env.GITHUB_TOKEN;
const PATH='data/jucacards-data.json';
const BRANCH='main';
function headers(){return{Authorization:`Bearer ${TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'}}
function apiUrl(){return `https://api.github.com/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/contents/${PATH}`}
function hasContent(data){
  if(!data||typeof data!=='object')return false;
  const cards=Array.isArray(data.cards)?data.cards.length:0;
  const reviews=Array.isArray(data.reviews)?data.reviews.length:0;
  const decks=Array.isArray(data.decks)?data.decks.length:0;
  // A single default "Geral" deck is not user data. Imported/created content is.
  return cards>0||reviews>0||decks>1;
}
function decodeContent(content){return JSON.parse(Buffer.from(String(content).replace(/\n/g,''),'base64').toString('utf8'))}
async function githubFile(){const r=await fetch(`${apiUrl()}?ref=${encodeURIComponent(BRANCH)}`,{headers:headers(),cache:'no-store'});if(r.status===404)return null;if(!r.ok)throw new Error(`GitHub GET ${r.status}`);const p=await r.json();return{sha:p.sha,data:decodeContent(p.content)}}
async function saveGithub(data){const current=await githubFile();
  // Never let a blank/default browser state erase real remote data.
  if(current&&hasContent(current.data)&&!hasContent(data))return{protected:true,data:current.data};
  const body={message:'chore: persist JucaCards data',content:Buffer.from(JSON.stringify(data,null,2),'utf8').toString('base64'),branch:BRANCH};
  if(current?.sha)body.sha=current.sha;
  const r=await fetch(apiUrl(),{method:'PUT',headers:headers(),body:JSON.stringify(body)});if(!r.ok)throw new Error(`GitHub PUT ${r.status}`);const p=await r.json();return{protected:false,sha:p.content?.sha||null};
}
module.exports=async function handler(req,res){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,PUT,POST,OPTIONS');if(req.method==='OPTIONS')return res.status(204).end();try{if(!OWNER||!REPO||!TOKEN)return res.status(500).json({ok:false,error:'GitHub persistence is not configured'});if(req.method==='GET'){const f=await githubFile();return f?res.status(200).json({ok:true,data:f.data}):res.status(404).json({ok:true,data:null})}if(req.method==='PUT'||req.method==='POST'){const data=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!data||typeof data!=='object'||Array.isArray(data))return res.status(400).json({ok:false,error:'Invalid data'});const result=await saveGithub(data);if(result.protected)return res.status(409).json({ok:false,protected:true,error:'Remote data protected from an empty/default overwrite',data:result.data});return res.status(200).json({ok:true,sha:result.sha})}return res.status(405).json({ok:false,error:'Method not allowed'})}catch(e){console.error('JucaCards GitHub persistence error:',e);return res.status(500).json({ok:false,error:'Persistent storage unavailable'})}};
