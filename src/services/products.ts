import type { CreateProductInput, Product } from '../types'
import { supabase } from '../lib/supabase'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function validateProductInput(input: CreateProductInput): string | null {
  const name = input.name.trim()
  if (!name) return 'Product name is required.'
  if (name.length > 120) return 'Product name must be 120 characters or fewer.'
  if (input.description.length > 2000) return 'Description must be 2000 characters or fewer.'
  if (!(input.price > 0)) return 'Price must be greater than 0.'
  if (input.stock < 0 || !Number.isInteger(input.stock)) {
    return 'Stock must be a whole number of 0 or more.'
  }
  if (input.status !== 'active' && input.status !== 'inactive') {
    return 'Invalid product status.'
  }
  if (input.imageFile) {
    if (!ALLOWED_TYPES.includes(input.imageFile.type)) {
      return 'Image must be JPEG, PNG, WebP, or GIF.'
    }
    if (input.imageFile.size > MAX_IMAGE_BYTES) {
      return 'Image must be 5MB or smaller.'
    }
  }
  return null
}

async function uploadProductImage(sellerId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${sellerId}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from('product-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })

  if (error) {
    throw new Error(error.message || 'Image upload failed.')
  }

  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

export async function fetchSellerProducts(sellerId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchProductById(productId: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export async function createProduct(
  sellerId: string,
  input: CreateProductInput,
): Promise<Product> {
  const validationError = validateProductInput(input)
  if (validationError) throw new Error(validationError)

  let imageUrl: string | null = null
  if (input.imageFile) {
    imageUrl = await uploadProductImage(sellerId, input.imageFile)
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      seller_id: sellerId,
      name: input.name.trim(),
      description: input.description.trim(),
      price: input.price,
      stock: input.stock,
      status: input.status,
      image_url: imageUrl,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteProduct(productId: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', productId)
  if (error) throw new Error(error.message)
}
