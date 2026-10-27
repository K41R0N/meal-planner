import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRecipeDraft,type ExtractedRecipe} from '../server/recipe-extractor';
import type {YouTubeMetadata} from '../server/youtube-provider';
import {emptyNutrition} from '../packages/meal-domain/src/types';
function normalize(name:string,quote:string,aisle:string){
 const text=`Makes 1 serving\nIngredients:\n${quote}\nMethod: Stir and serve.`;
 const metadata:YouTubeMetadata={videoId:'abcdefghijk',canonicalUrl:'https://www.youtube.com/watch?v=abcdefghijk',title:'Fixture',description:text,descriptionTruncated:false,channel:'Test creator',uploader:null,viewCount:null,uploadDate:null,durationSeconds:null,thumbnailUrl:null,manualCaptionLanguages:[],automaticCaptionLanguages:[]};
 const extracted:ExtractedRecipe={name:'Fixture',roles:['snack'],tags:[],categories:[],ingredients:[{name,rawSourceText:quote,quantity:100,unit:'g',aisle}],steps:['Stir and serve.'],yield:1,sourceReportedNutrition:emptyNutrition(),nutritionBasis:'not_stated',nutritionEvidence:null,warnings:[]};
 return normalizeRecipeDraft({metadata,extracted,sourceText:text,method:'description',captions:null,acquiredAt:'2026-10-26T21:00:00.000Z'}).recipe.ingredients[0];
}
test('grocery suggestion aliases map to canonical aisles instead of silently falling into Other',()=>{assert.equal(normalize('cottage cheese','100g cottage cheese','Dairy').aisle,'Dairy & Eggs');assert.equal(normalize('paprika','100g paprika','Spices').aisle,'Herbs & Spices');});
test('source-confirmed preparation suffixes do not split identical groceries but dietary variants remain distinct',()=>{assert.equal(normalize('cottage cheese (sauce)','100g cottage cheese','Dairy').name,'cottage cheese');assert.equal(normalize('cottage cheese (low fat)','100g cottage cheese (low fat)','Dairy').name,'cottage cheese (low fat)');});
