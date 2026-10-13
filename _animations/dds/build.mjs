import {copyFile,mkdir} from 'node:fs/promises';
const target=new URL('../../assets/animations/dds/',import.meta.url);
await mkdir(target,{recursive:true});
for(const file of ['index.html','player.css','scenes.js','player.js']) await copyFile(new URL('src/'+file,import.meta.url),new URL(file,target));
console.log('Copied 4 dependency-free DDS player files.');
