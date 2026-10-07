import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
const destination=resolve(root,'apps/web/fonts'); mkdirSync(destination,{recursive:true});
for(const [font,subset] of [['inter','latin'],['noto-sans-thai','thai'],['noto-sans-thai','latin']]) {
 const location=dirname(require.resolve(`@fontsource/${font}/package.json`));
 for(const weight of [400,600,700]) copyFileSync(resolve(location,`files/${font}-${subset}-${weight}-normal.woff2`),resolve(destination,`${font}-${subset}-${weight}.woff2`));
 copyFileSync(resolve(location,'LICENSE'),resolve(destination,`${font}-LICENSE.txt`));
}
console.log('Local demo fonts ready.');
