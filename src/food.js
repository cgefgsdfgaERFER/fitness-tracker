// Public, community-maintained product database. Internet is required.
export function normalizeProduct(product, code = '') {
  const n = product?.nutriments || {}
  const serving = Boolean(product?.serving_size && (
    n['energy-kcal_serving'] != null || n.proteins_serving != null || n.carbohydrates_serving != null
  ))
  const suffix = serving ? '_serving' : '_100g'
  const pick = (name) => {
    const value = n[`${name}${suffix}`]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }
  const kcal = pick('energy-kcal') ?? (pick('energy') != null ? pick('energy') / 4.184 : null)
  const sodiumG = pick('sodium') ?? (pick('salt') != null ? pick('salt') / 2.5 : null)
  const rounded = (v, factor = 10) => v == null ? '' : String(Math.round(v * factor) / factor)
  return {
    name: [product?.product_name || product?.product_name_en || 'Unknown product', product?.brands].filter(Boolean).join(' · '),
    barcode: code,
    amount: '1',
    serving: serving ? product.serving_size : '100 g',
    calories: rounded(kcal, 1),
    protein: rounded(pick('proteins')), carbs: rounded(pick('carbohydrates')),
    fat: rounded(pick('fat')), fiber: rounded(pick('fiber')),
    sodium: rounded(sodiumG == null ? null : sodiumG * 1000, 1),
    source: 'Open Food Facts'
  }
}
export async function lookupBarcode(barcode) {
  const code = String(barcode).replace(/\D/g, '')
  if (!/^\d{8,14}$/.test(code)) throw Error('Enter a valid 8–14 digit barcode.')
  const fields = 'product_name,product_name_en,brands,serving_size,nutriments'
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`
  const response = await fetch(url, {headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(12000)})
  if (!response.ok) throw Error(`Food lookup unavailable (${response.status}). Try manual entry.`)
  const data = await response.json()
  if (data.status !== 1 || !data.product) throw Error('Barcode not found. You can still enter the nutrition label manually.')
  return normalizeProduct(data.product, code)
}
// Resize images before storing in IndexedDB/exports to prevent huge backups.
export async function shrinkPhoto(file) {
  if (!file?.type?.startsWith('image/')) throw Error('Choose an image file.')
  if (file.size > 15_000_000) throw Error('Photo is too large (maximum 15 MB).')
  const img = await createImageBitmap(file)
  const factor = Math.min(1, 1080 / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * factor))
  canvas.height = Math.max(1, Math.round(img.height * factor))
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  img.close?.()
  return canvas.toDataURL('image/jpeg', 0.67)
}
