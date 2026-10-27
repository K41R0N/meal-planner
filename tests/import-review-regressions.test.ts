import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {once} from 'node:events';
import {createServer,request as httpRequest} from 'node:http';
import {restoreDraft} from '../apps/web/src/components/RecipeImport';
import {MAX_RECIPE_JSON_BYTES,recipeJsonFileFits} from '../apps/web/src/import-limits';
import {emptyNutrition,type Recipe} from '../packages/meal-domain/src/types';
import {validateState} from '../packages/meal-domain/src/validation';
import {createApp} from '../server/app';

function draftFixture(){
 const seed=JSON.parse(fs.readFileSync('apps/web/public/data/recipe-bank.json','utf8')).recipes[0] as Recipe;
 const nutrition={...emptyNutrition(),calories:500,protein:30};
 return {recipe:{...seed,id:'youtube:abcdefghijk',sourceUrl:'https://www.youtube.com/watch?v=abcdefghijk',nutritionBasis:'per_serving' as const,nutrition,reportedNutrition:nutrition},source:{provider:'youtube' as const,videoId:'abcdefghijk',url:'https://www.youtube.com/watch?v=abcdefghijk',title:'Fixture recipe',creator:'Test creator',description:'Calories 500 kcal; Protein 30 g per serving',captions:null,method:'description' as const,acquiredAt:'2026-10-26T21:00:00.000Z'},warnings:[]};
}
test('draft restoration validates structure and preserves user-confirmed nutrition instead of rerunning initial normalization',()=>{
 const fixture=draftFixture();const restored=restoreDraft(fixture);assert.ok(restored);assert.equal(restored.recipe.nutritionBasis,'per_serving');assert.equal(restored.recipe.nutrition.protein,30);assert.equal(restoreDraft({recipe:fixture.recipe}),null);assert.equal(restoreDraft({...fixture,source:{...fixture.source,videoId:'xxxxxxxxxxx'}}),null);
});
test('full-state backup preserves optional original source evidence',()=>{
 const restored=restoreDraft(draftFixture())!;
 const state=validateState({version:1,recipes:[restored.recipe],plans:[],activePlanId:null,logs:[],targets:emptyNutrition(),shoppingChecks:{},manualShopping:{}});
 assert.deepEqual(state.recipes[0].sourceEvidence,restored.recipe.sourceEvidence);
});
test('Settings and state parser share a 32 MiB JSON policy with boundary checks',()=>{
 assert.equal(MAX_RECIPE_JSON_BYTES,33554432);assert.equal(recipeJsonFileFits(MAX_RECIPE_JSON_BYTES),true);assert.equal(recipeJsonFileFits(MAX_RECIPE_JSON_BYTES+1),false);assert.equal(recipeJsonFileFits(-1),false);
 const app=fs.readFileSync('apps/web/src/useMealbook.ts','utf8'),settings=fs.readFileSync('apps/web/src/components/Settings.tsx','utf8');assert.match(app,/recipeJsonFileFits\(file.size\)/);assert.match(settings,/recipeJsonFileFits\(file.size\)/);
});
test('chunked oversized imports return the JSON 413 envelope without destroying the response socket',async()=>{
 const app=createApp({importEnabled:()=>true});const server=createServer((req,res)=>void app(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');
 try{
 const result=await new Promise<{status:number;body:string}>((resolve,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port:address.port,path:'/api/recipes/preview',method:'POST',headers:{'Content-Type':'application/json'}},res=>{let body='';res.on('data',chunk=>body+=String(chunk));res.on('end',()=>resolve({status:res.statusCode??0,body}));});req.on('error',reject);req.write('{"sourceText":"');req.write('x'.repeat(110000));req.end('"}');});
 assert.equal(result.status,413);assert.equal(JSON.parse(result.body).error.code,'REQUEST_TOO_LARGE');
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
test('same-origin Fetch Metadata survives an internal proxy Host mismatch without admitting cross-site browser calls',async()=>{
 const app=createApp({importEnabled:()=>true});const server=createServer((req,res)=>void app(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');
 try{
 const response=await fetch(`http://127.0.0.1:${address.port}/api/recipes/preview`,{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://public-preview.example','Sec-Fetch-Site':'same-origin'},body:JSON.stringify({url:'https://invalid.example'})});assert.equal(response.status,422);
 const blocked=await fetch(`http://127.0.0.1:${address.port}/api/recipes/preview`,{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://unrelated.example','Sec-Fetch-Site':'cross-site'},body:JSON.stringify({url:'https://invalid.example'})});assert.equal(blocked.status,403);
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
