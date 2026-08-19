import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import {S3Client,PutBucketAclCommand,PutBucketCorsCommand} from '@aws-sdk/client-s3';

const ROOT=process.cwd(),LIB=path.join(ROOT,'library');
async function loadEnv(){const p=path.join(ROOT,'.env.b2');if(!fssync.existsSync(p))return;for(const line of (await fs.readFile(p,'utf8')).split(/\r?\n/)){const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(process.env[m[1]]===undefined)process.env[m[1]]=v}}
const config=JSON.parse(await fs.readFile(path.join(LIB,'b2.json'),'utf8'));
await loadEnv();
const keyId=process.env.B2_KEY_ID,appKey=process.env.B2_APPLICATION_KEY;
if(!keyId||!appKey)throw new Error('Set B2_KEY_ID and B2_APPLICATION_KEY in .env.b2 or your environment.');
if(!config.bucket||!config.endpoint)throw new Error('library/b2.json needs bucket and endpoint.');
const s3=new S3Client({endpoint:config.endpoint,region:config.region||'us-east-1',credentials:{accessKeyId:keyId,secretAccessKey:appKey}});
const origins=config.siteOrigins?.length?config.siteOrigins:['https://shadowgarden-bon.pages.dev'];
await s3.send(new PutBucketAclCommand({Bucket:config.bucket,ACL:'public-read'}));
await s3.send(new PutBucketCorsCommand({Bucket:config.bucket,CORSConfiguration:{CORSRules:[{
  AllowedOrigins:origins,
  AllowedMethods:['GET','HEAD'],
  AllowedHeaders:['*'],
  ExposeHeaders:['Accept-Ranges','Content-Length','Content-Range','ETag'],
  MaxAgeSeconds:86400
}]}}));
console.log(`Configured ${config.bucket} as public-read.`);
console.log(`CORS enabled for: ${origins.join(', ')}`);
