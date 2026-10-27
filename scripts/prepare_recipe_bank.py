#!/usr/bin/env python3
"""Integrate source-grounded recipes and preserve the legacy seed.

Usage: python3 scripts/prepare_recipe_bank.py <top100-export.json> <legacy-recipes.json>
Only recipe data is imported. Purchased Storyteller assets and personal logs are
not included. Source thumbnails are optional local assets with attribution.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path
import json
import re
import sys
import urllib.request

ROOT=Path(__file__).resolve().parent.parent
PUBLIC=ROOT/'apps/web/public'
(PUBLIC/'data').mkdir(parents=True,exist_ok=True)
(PUBLIC/'images').mkdir(parents=True,exist_ok=True)
source=json.loads(Path(sys.argv[1]).read_text())
legacy=json.loads(Path(sys.argv[2]).read_text())
NOW=datetime.now(timezone.utc).isoformat()
KEYS={'calories':'calories_kcal','protein':'protein_g','carbs':'carbs_g','fat':'fat_g','fiber':'fiber_g','sugar':'sugar_g','sodium':'sodium_mg'}
def nutrition(values):return {k:values.get(v) for k,v in KEYS.items()}
def null_nutrition():return {k:None for k in KEYS}
records=[]
for item in source['recipes']:
    src=item['source'];org=item['organization'];vid=src['video_id']
    records.append({
      'id':item['id'],'name':item['title'],'roles':org['suggested_meal_types'],
      'tags':org['suggested_tags'],'categories':['Louis Howard'],
      'ingredients':[{'id':f'{item["id"]}:{i}','name':ing['name'],'quantity':ing['quantity'],
                      'unit':ing['unit'],'quantityText':ing['quantity_text'],'aisle':ing['category'],
                      'sourceText':ing['source_text']} for i,ing in enumerate(item['ingredients'])],
      'steps':item['instructions'],'baseServings':item['servings'],
      'nutrition':nutrition(item['nutrition']['per_serving']),
      'reportedNutrition':nutrition(item['nutrition']['reported']),
      'nutritionBasis':item['nutrition']['reported_basis'],
      'nutritionEvidence':item['nutrition']['source_evidence'],
      'sourceUrl':src['video_url'],'sourceName':src['channel_name'],
      'creatorCredit':src['original_creator_credit'],'viewCount':src['exact_view_count'],
      'viewCountAt':src['view_count_collected_at'],'image':f'/images/{vid}.jpg',
      'prepMinutes':item['prep_minutes'],'cookMinutes':item['cook_minutes'],
      'mealPrepRating':None,'mealPrepNotes':'','dataGaps':item['data_gaps'],
      'favorite':False,'addedAt':NOW,
    })

def parse_quantity(text):
    match=re.match(r'^\s*(\d+(?:\.\d+)?(?:/\d+)?)\s*(.*)$',text)
    if not match:return None,None
    try:value=float(Fraction(match.group(1)))
    except ValueError:return None,None
    tail=match.group(2).strip()
    unit=tail.lower() if tail.lower() in ['g','kg','ml','l','tsp','tbsp','cup','cups','clove','cloves','stalk','stalks','spears','bunch','piece','inch piece'] else None
    return value,unit

roles_by_type={'smoothie':['breakfast','drink'],'main':['lunch','dinner'],'soup':['lunch','dinner'],'side':['side'],'vinaigrette':['condiment']}
aisles={'protein':'meat_fish','fruits':'produce','vegetables':'produce','dairy-alternative':'dairy_eggs',
        'grains':'grains_bread','flour':'grains_bread','legumes':'legumes','nuts':'nuts_seeds','seeds':'nuts_seeds',
        'spices':'spices_herbs','herbs':'spices_herbs','seasonings':'spices_herbs','oils':'oils_condiments','condiments':'oils_condiments','sweeteners':'oils_condiments'}
for item in legacy['recipes']+legacy.get('condiments',[]):
    ingredients=[]
    for i,ing in enumerate(item['ingredients']):
        amount,unit=parse_quantity(ing['quantity'])
        ingredients.append({'id':f'legacy:{item["id"]}:{i}','name':ing['name'],'quantity':amount,'unit':unit,
                            'quantityText':ing['quantity'],'aisle':aisles.get(ing['category'],'other')})
    records.append({'id':f'legacy:{item["id"]}','name':item['name'],'roles':roles_by_type.get(item['type'],[item.get('meal_time','lunch')]),
                    'tags':item['tags'],'categories':['Original collection'],'ingredients':ingredients,'steps':item['instructions'],
                    'baseServings':item['servings'],'nutrition':null_nutrition(),'reportedNutrition':null_nutrition(),
                    'nutritionBasis':'not_stated','sourceUrl':None,'sourceName':'Original recipe collection','creatorCredit':None,
                    'viewCount':None,'viewCountAt':None,'image':None,'prepMinutes':None,'cookMinutes':None,
                    'mealPrepRating':None,'mealPrepNotes':'','dataGaps':['Nutrition values have not been supplied. Legacy tags are preserved, not independently verified.'],
                    'favorite':False,'addedAt':NOW})
if len(records)!=119 or len({r['id'] for r in records})!=119:raise ValueError('Seed counts or source identifiers changed')

def image(rec):
    if not rec['image']:return
    video=rec['id'].split(':',1)[1];target=PUBLIC/'images'/f'{video}.jpg'
    if target.exists():return
    # Public source thumbnails depict the actual linked recipe video; no stock substitution.
    url=f'https://i.ytimg.com/vi/{video}/hqdefault.jpg'
    try:
        with urllib.request.urlopen(url,timeout=20) as response:data=response.read()
        if not data.startswith(b'\xff\xd8'):raise ValueError('Invalid JPEG')
        target.write_bytes(data)
    except Exception as error:
        rec['image']=None
        print(f'Thumbnail unavailable for {video}: {error}',flush=True)
with ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(image,records))
(PUBLIC/'data/recipe-bank.json').write_text(json.dumps({'schemaVersion':1,'recipes':records},ensure_ascii=False,indent=2)+'\n')
print(f'Integrated {len(records)} recipes/condiments; {sum(bool(r["image"]) for r in records)} source thumbnails bundled.',flush=True)
