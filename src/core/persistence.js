const DB_NAME='lfcfoundry-typeface-studio';const STORE='projects';
function openDb(){return new Promise((resolve,reject)=>{if(!globalThis.indexedDB){reject(new Error('IndexedDB is unavailable in this browser origin.'));return;}
  let request;try{request=indexedDB.open(DB_NAME,1);}catch(err){reject(err);return;}
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Could not open browser storage.'));});}
export async function saveProject(project){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({...project,savedAt:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>{const err=tx.error;db.close();reject(err||new Error('Could not save project.'));};});}
export async function loadLatestProject(){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).getAll();req.onsuccess=()=>{const list=req.result||[];db.close();list.sort((a,b)=>(b.savedAt||'').localeCompare(a.savedAt||''));resolve(list[0]||null);};req.onerror=()=>{db.close();reject(req.error||new Error('Could not restore project.'));};});}
