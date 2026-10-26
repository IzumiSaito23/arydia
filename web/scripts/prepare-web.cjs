const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../dist');
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name),rel=path.relative(root,p).replaceAll('\\','/');if(entry.isDirectory()){if(rel!=='music'&&rel!=='maps'&&rel!=='cards')walk(p);}else if(!['sw.js','precache.js','_headers','update.json','.nojekyll'].includes(rel))files.push(rel);}}
walk(root);files.sort();const hash=crypto.createHash('sha256');for(const p of files)hash.update(p).update(fs.readFileSync(path.join(root,p)));hash.update(fs.readFileSync(path.join(root,'sw.js')));
fs.writeFileSync(path.join(root,'precache.js'),`self.ARYDIA_BUILD=${JSON.stringify(hash.digest('hex').slice(0,12))};\nself.ARYDIA_FILES=${JSON.stringify(files)};\n`);
console.log(`Prepared ${files.length} offline assets`);
