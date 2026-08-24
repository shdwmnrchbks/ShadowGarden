import fs from "node:fs/promises";
import path from "node:path";

const TEXT_EXTENSIONS=new Set([".html",".js",".css"]);
const LOCAL_ASSET=/\/assets\/[^"'`\s?#]+\.(?:js|css)(?:\?v=[^"'`\s&#]*)?/gi;

export function versionLocalAssets(text,version){
  const stamp=String(version||"").trim();
  if(!stamp)throw new Error("Asset version is required");
  return String(text||"").replace(LOCAL_ASSET,match=>`${match.split("?")[0]}?v=${stamp}`);
}

async function walkTextFiles(root){
  const out=[];
  for(const entry of await fs.readdir(root,{withFileTypes:true})){
    const file=path.join(root,entry.name);
    if(entry.isDirectory())out.push(...await walkTextFiles(file));
    else if(entry.isFile()&&TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))out.push(file);
  }
  return out;
}

export async function stampAssetVersions(root,version){
  let changed=0;
  for(const file of await walkTextFiles(root)){
    const before=await fs.readFile(file,"utf8");
    const after=versionLocalAssets(before,version);
    if(after===before)continue;
    await fs.writeFile(file,after);
    changed++;
  }
  return changed;
}
