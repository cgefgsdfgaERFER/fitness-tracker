import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeProduct} from '../src/food.js'

test('nutrition uses per-serving values and converts sodium to milligrams',()=>{
  const food=normalizeProduct({product_name:'Food',serving_size:'30 g',nutriments:{'energy-kcal_serving':120,proteins_serving:4,carbohydrates_serving:15,fat_serving:4,sodium_serving:0.1}},'12345678')
  assert.equal(food.calories,'120')
  assert.equal(food.sodium,'100')
  assert.equal(food.serving,'30 g')
})
test('nutrition falls back to per-100-gram amounts',()=>{
  const food=normalizeProduct({product_name:'Food',nutriments:{'energy-kcal_100g':250,salt_100g:1.5}},'12345678')
  assert.equal(food.calories,'250')
  assert.equal(food.sodium,'600')
  assert.equal(food.serving,'100 g')
})
test('missing nutrients stay empty instead of being falsely set to zero',()=>{
  const food=normalizeProduct({product_name:'Food',nutriments:{}},'12345678')
  assert.equal(food.protein,'')
  assert.equal(food.calories,'')
})
test('product names include brand when available',()=>{
  const food=normalizeProduct({product_name:'Yogurt',brands:'Example',nutriments:{}},'12345678')
  assert.equal(food.name,'Yogurt · Example')
})

test('barcode lookup uses the public product endpoint', async()=>{
  const {lookupBarcode}=await import('../src/food.js')
  const original=globalThis.fetch
  let seen=''
  globalThis.fetch=async(url)=>{seen=url;return {ok:true,json:async()=>({status:1,product:{product_name:'Sample',nutriments:{'energy-kcal_100g':98}}})}}
  try{
    const food=await lookupBarcode('12345678')
    assert.ok(seen.includes('/api/v2/product/12345678.json'))
    assert.equal(food.name,'Sample')
    assert.equal(food.calories,'98')
  }finally{globalThis.fetch=original}
})

test('rejects invalid barcode before contacting a server',async()=>{
  const {lookupBarcode}=await import('../src/food.js')
  await assert.rejects(lookupBarcode('bad'),/valid 8–14 digit barcode/)
})
