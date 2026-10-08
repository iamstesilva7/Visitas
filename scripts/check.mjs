import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
for(const file of ['public/app.js','server/core.mjs','server/stores.mjs','netlify/functions/api.mjs']){
  const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
  if(result.status!==0)process.exit(1);
}
for(const file of ['public/index.html','public/style.css','public/logo.png','public/brazil.svg'])if(!existsSync(file))throw Error('Missing asset: '+file);
console.log('Netlify build ready.');
