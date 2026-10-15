import shopify from '@/lib/shopify-app'
import { createParamDecorator } from '@nestjs/common'
import { db } from '@/lib/db'
import { Session } from '@shopify/shopify-api' // Import Session

type ApiType = 'rest' | 'gql'

export const getShopifyClient = async (apiType: ApiType = 'gql') => {
  try {
    const data = await db.appSession.findFirst()

    const session = data.payload as unknown as Session

    if (!session) {
      throw new Error('Session token could not be retrieved.')
    }

    if (apiType === 'rest') {
      return new shopify.api.clients.Rest({ session })
    }

    return new shopify.api.clients.Graphql({ session })
  } catch (error) {
    console.error('Error retrieving Shopify client:', error)
    throw new Error('Failed to create Shopify client.')
  }
}

export const ShopifyServer = createParamDecorator(getShopifyClient)
