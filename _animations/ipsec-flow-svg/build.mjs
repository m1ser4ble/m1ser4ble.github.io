import {copyFile,mkdir} from 'node:fs/promises';
const target=new URL('../../assets/animations/ipsec-flow-svg/',import.meta.url);
await mkdir(target,{recursive:true});
for(const f of ['index.html','player.css','scenes.js','player.js']) await copyFile(new URL('src/'+f,import.meta.url),new URL(f,target));
console.log('Copied 4 dependency-free player files.');
