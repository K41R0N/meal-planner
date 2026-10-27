import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseYouTubeReference,extractYouTubeReference} from '../packages/meal-domain/src/youtube';
import {validateRecipes} from '../packages/meal-domain/src';

test('YouTube references normalize watch, short and shared URLs without tracking parameters',()=>{
  for(const url of ['https://youtu.be/CWyGvEJVML4?si=tracking','https://www.youtube.com/watch?v=CWyGvEJVML4&list=abc','https://m.youtube.com/shorts/CWyGvEJVML4','https://www.youtube.com/live/CWyGvEJVML4'])assert.deepEqual(parseYouTubeReference(url),{videoId:'CWyGvEJVML4',url:'https://www.youtube.com/watch?v=CWyGvEJVML4'});
  assert.equal(extractYouTubeReference('Here is a recipe https://youtu.be/CWyGvEJVML4.')?.videoId,'CWyGvEJVML4');
});
test('YouTube parser rejects private-network URLs, credentials, impostors and non-video links',()=>{
  for(const url of ['http://youtube.com/watch?v=CWyGvEJVML4','https://youtube.com.evil.test/watch?v=CWyGvEJVML4','https://user:pass@youtube.com/watch?v=CWyGvEJVML4','https://127.0.0.1/watch?v=CWyGvEJVML4','https://youtube.com/@louishowardpt','https://youtube.com/playlist?list=abc','https://youtu.be/CWyGvEJVML4/extra','https://youtube.com:8443/watch?v=CWyGvEJVML4'])assert.throws(()=>parseYouTubeReference(url));
});
test('source evidence survives recipe validation without changing unknown nutrition',()=>{
  const bank=JSON.parse(fs.readFileSync('apps/web/public/data/recipe-bank.json','utf8'));const original=bank.recipes[0];
  const evidence={method:'description',description:'Creator recipe text, safely rendered as plain text. <script>not rendered as HTML</script>',captions:null,acquiredAt:new Date().toISOString()};
  const recipe=validateRecipes([{...original,sourceEvidence:evidence}])[0];assert.deepEqual(recipe.sourceEvidence,evidence);
  assert.throws(()=>validateRecipes([{...original,sourceEvidence:{...evidence,description:'x'.repeat(32001)}}]));
  assert.throws(()=>validateRecipes([{...original,sourceEvidence:{...evidence,method:'invented'}}]));
});
