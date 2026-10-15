import {
  MAX_QUERY_NUMBER,
  TABLE_NAME_ORDER,
  TABLE_NAME_ORDER_ITEM,
  TABLE_NAME_PRODUCT,
} from '@/const/utils'
import { CustomLoggerService } from '@/shared/services/custom-logger.service'
import {
  GetCollectionQuery,
  GetLineItemQuery,
  GetOrdersQuery,
  GetProductVariantsQuery,
  GetMetafieldsDefinitionsQuery,
  GetOrderMetafieldsQuery,
} from '@/types/admin.generated'
import { Injectable } from '@nestjs/common'
import { GraphqlClient, GraphQLClientResponse } from '@shopify/shopify-api'
import * as fs from 'fs'
import * as path from 'path'
import {
  GET_ORDER_DETAILS_WITH_LINE_ITEMS,
  GET_METAFIELDS_DEFINITIONS,
  GET_ORDERS,
  GET_ORDER_METAFIELDS,
} from '../graphql/order'
import { GET_COLLECTION_DATA, GET_PRODUCT_VARIANTS } from '../graphql/product'
import { GoogleBigQueryServices } from './google-big-query.service'
import { extractIdFromGid } from '@/functions/extractIdFromGid'

// Narrowed helper aliases from generated types (avoid any)
type LineItemOrder = NonNullable<GetLineItemQuery['order']>
type Transaction = LineItemOrder['transactions'][number]
type Fulfillment = LineItemOrder['fulfillments'][number]
type MetafieldNode = LineItemOrder['metafields']['nodes'][number]
type TaxLine = LineItemOrder['taxLines'][number]

@Injectable()
export class GbqService {
  logger: CustomLoggerService
  googleBigQueryServices: GoogleBigQueryServices
  private readonly SYNC_TIMESTAMP_FILE = path.join(
    process.cwd(),
    'last_sync_timestamp.json',
  )

  constructor() {
    this.logger = new CustomLoggerService()
    this.googleBigQueryServices = new GoogleBigQueryServices()
  }

  /**
   * Get last sync timestamp for a specific table
   */
  private getLastSyncTimestamp(tableName: string): string | null {
    try {
      if (fs.existsSync(this.SYNC_TIMESTAMP_FILE)) {
        const data = JSON.parse(
          fs.readFileSync(this.SYNC_TIMESTAMP_FILE, 'utf-8'),
        )
        return data[tableName] || null
      }
    } catch (error) {
      console.error(`Error reading last sync timestamp: ${error}`)
    }
    return null
  }

  /**
   * Save last sync timestamp for a specific table
   */
  private saveLastSyncTimestamp(tableName: string, timestamp: string): void {
    try {
      let data = {}
      if (fs.existsSync(this.SYNC_TIMESTAMP_FILE)) {
        data = JSON.parse(fs.readFileSync(this.SYNC_TIMESTAMP_FILE, 'utf-8'))
      }
      data[tableName] = timestamp
      fs.writeFileSync(this.SYNC_TIMESTAMP_FILE, JSON.stringify(data, null, 2))
      console.log(`💾 Saved last sync timestamp for ${tableName}: ${timestamp}`)
    } catch (error) {
      console.error(`Error saving last sync timestamp: ${error}`)
    }
  }

  /**
   * Perform a GraphQL request with simple retries and exponential backoff.
   */
  private async gqlRequestWithRetry<T>(
    gqlClient: GraphqlClient,
    document: string,
    options: {
      variables?: {
        [key: string]: string | number | boolean | null | undefined
      }
    },
    maxRetries = 5,
    baseDelayMs = 1000,
  ): Promise<GraphQLClientResponse<T>> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await gqlClient.request<T>(document, options)
      } catch (error) {
        if (attempt === maxRetries) {
          this.logger.error(
            `GraphQL request failed (final). Attempts=${attempt}.`,
          )
          throw error
        }
        const delay = baseDelayMs * Math.pow(2, attempt - 1)
        this.logger.warn(
          `GraphQL request failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`,
        )
        await new Promise((res) => setTimeout(res, delay))
      }
    }
  }

  public getLogs() {
    try {
      const data = fs.readFileSync('logs/app.log', 'utf8')
      return data
        .split('\n')
        .filter((line) => line.includes('[ERROR]') || line.includes('[INFO]'))
    } catch (err) {
      this.logger.error(`Error reading logs: ${err.message}`)
      return []
    }
  }
  public async syncAll(
    gqlClient: GraphqlClient,
    isIncremental: boolean = true,
  ) {
    const syncStartTime = new Date().toISOString()
    console.log(
      `🚀 Starting ${isIncremental ? 'incremental' : 'full'} sync at ${syncStartTime}`,
    )

    await this.syncOrders(gqlClient, isIncremental, syncStartTime)
    await this.syncProducts(gqlClient, isIncremental, syncStartTime)
  }

  private async syncProducts(
    gqlClient: GraphqlClient,
    isIncremental: boolean = true,
    syncStartTime: string,
  ) {
    try {
      this.logger.log('Syncing products from Shopify...')
      const DATA_SET_ID = process.env.DATA_SET_ID

      // Get last sync timestamp for incremental sync
      const lastSyncTime = isIncremental
        ? this.getLastSyncTimestamp(TABLE_NAME_PRODUCT)
        : null

      if (isIncremental && lastSyncTime) {
        console.log(
          `📅 Incremental sync - fetching products updated after ${lastSyncTime}`,
        )
      } else {
        console.log(`📦 Full sync - fetching all products`)
      }

      let hasNextPage = true
      let endCursor = null
      const schema = [
        { name: 'product_handle', type: 'STRING' },
        { name: 'product_collection', type: 'STRING' },
        { name: 'variant_sku', type: 'STRING' },
        { name: 'variant_barcode', type: 'STRING' },
        { name: 'product_title', type: 'STRING' },
        { name: 'product_description', type: 'STRING' },
        { name: 'product_vendor', type: 'STRING' },
        { name: 'color', type: 'STRING' },
        { name: 'size', type: 'STRING' },
        { name: 'variant_price', type: 'FLOAT' },
        { name: 'variant_available_quantity', type: 'FLOAT' },
        { name: 'variant_on_hand_quantity', type: 'FLOAT' },
        { name: 'variant_compared_price', type: 'FLOAT' },
        { name: 'product_status', type: 'STRING' },
        {
          name: 'product_metafield_custom_parents_sku',
          type: 'STRING',
        },
        {
          name: 'product_metafield_custom_pid_catalogue',
          type: 'STRING',
        },
        {
          name: 'product_metafield_magento_product_gender',
          type: 'STRING',
        },
        {
          name: 'product_metafield_magento_product_jda_brand_id',
          type: 'STRING',
        },
        {
          name: 'product_metafield_magento_product_jda_dept',
          type: 'STRING',
        },
        {
          name: 'product_metafield_magento_product_jda_discount_code',
          type: 'STRING',
        },
        {
          name: 'product_metafield_magento_product_jda_dtype',
          type: 'STRING',
        },
        {
          name: 'product_metafield_magento_product_jda_subdept',
          type: 'STRING',
        },
        {
          name: 'product_metafield_magento_product_job_number',
          type: 'STRING',
        },
        { name: 'product_images', type: 'STRING', mode: 'REPEATED' },
        { name: 'variant_id', type: 'STRING' },
        { name: 'product_id', type: 'STRING' },
      ]
      await this.googleBigQueryServices.createTable(
        DATA_SET_ID,
        TABLE_NAME_PRODUCT,
        schema,
      )

      // Only truncate if doing full sync
      if (!isIncremental || !lastSyncTime) {
        await this.googleBigQueryServices.truncateTable(
          DATA_SET_ID,
          TABLE_NAME_PRODUCT,
        )
      }

      while (hasNextPage) {
        try {
          // Build query variables
          const variables: any = {
            first: MAX_QUERY_NUMBER,
            endCursor: endCursor,
            shopLocationId: process.env.SHOP_LOCATION_ID,
          }

          // Add updatedAt OR createdAt filter for incremental sync
          // This ensures we catch both newly created and updated records
          if (isIncremental && lastSyncTime) {
            variables.query = `updated_at:>='${lastSyncTime}' OR created_at:>='${lastSyncTime}'`
          }

          const result: GraphQLClientResponse<GetProductVariantsQuery> =
            await this.gqlRequestWithRetry<GetProductVariantsQuery>(
              gqlClient,
              GET_PRODUCT_VARIANTS,
              {
                variables,
              },
            )

          const dataProducts = await Promise.all(
            result.data.productVariants.edges.map(async (edge) => {
              const productVariant = edge.node
              const metaMap = productVariant.product.metafields.nodes.reduce(
                (acc, mf) => {
                  acc[mf.key] = {
                    value:
                      mf.references == null
                        ? mf.value
                        : mf.references.nodes
                            .map((node) => node.displayName)
                            .join(','),
                    name: mf.key,
                  }
                  return acc
                },
                {},
              )

              const getMeta = (key: string) =>
                metaMap[key] || { name: '', value: '' }

              //check data collection
              const productId = productVariant.product.id

              let allDataCollection = productVariant.product.collections.nodes
              let collectionHasNextPage =
                productVariant.product.collections.pageInfo.hasNextPage
              let lineItemEndCursor =
                productVariant.product.collections.pageInfo.endCursor

              // Paginate through collections if there are more than 250
              while (collectionHasNextPage) {
                try {
                  const collectionResult: GraphQLClientResponse<GetCollectionQuery> =
                    await this.gqlRequestWithRetry<GetCollectionQuery>(
                      gqlClient,
                      GET_COLLECTION_DATA,
                      {
                        variables: {
                          id: productId,
                          first: MAX_QUERY_NUMBER,
                          endCursor: lineItemEndCursor,
                        },
                      },
                    )

                  allDataCollection = allDataCollection.concat(
                    collectionResult.data.product.collections.nodes,
                  )
                  collectionHasNextPage =
                    collectionResult.data.product.collections.pageInfo
                      .hasNextPage
                  lineItemEndCursor =
                    collectionResult.data.product.collections.pageInfo.endCursor
                } catch (error) {
                  this.logger.error(
                    `Error fetching collection for product ${productId}: ${error.message}`,
                  )
                  break // Exit the variant pagination loop if an error occurs
                }
              }
              const dataProduct = {
                product_handle: productVariant.product.handle,
                product_collection: allDataCollection
                  .map((collection) => collection.title)
                  .join(','),
                variant_sku: productVariant.sku,
                variant_barcode: productVariant.barcode,
                product_title: productVariant.product.title,
                product_description: productVariant.product.description,
                product_vendor: productVariant.product.vendor,
                color: productVariant.selectedOptions.find(
                  (data) => data.name.toLowerCase() === 'color',
                )?.value,
                size: productVariant.selectedOptions.find(
                  (data) => data.name.toLowerCase() === 'size',
                )?.value,
                variant_price: productVariant.price,
                variant_compared_price: productVariant.compareAtPrice,
                product_status: productVariant.product.status,
                product_metafield_custom_parents_sku:
                  getMeta('custom.parentsku')?.value || null,
                product_metafield_custom_pid_catalogue:
                  getMeta('custom.pid_catalogue')?.value || null,
                product_metafield_magento_product_gender:
                  getMeta('magento.product_gender')?.value || null,
                product_metafield_magento_product_jda_brand_id:
                  getMeta('magento.product_jda_brand_id')?.value || null,
                product_metafield_magento_product_jda_dept:
                  getMeta('magento.product_jda_dept')?.value || null,
                product_metafield_magento_product_jda_discount_code:
                  getMeta('magento.product_jda_discount_code')?.value || null,
                product_metafield_magento_product_jda_dtype:
                  getMeta('magento.product_jda_dtype')?.value || null,
                product_metafield_magento_product_jda_subdept:
                  getMeta('magento.product_jda_subdept')?.value || null,
                product_metafield_magento_product_job_number:
                  getMeta('magento.product_job_number')?.value || null,
                product_images: productVariant?.product?.media?.nodes?.map(
                  (data) => data?.preview?.image?.url,
                ),
                variant_available_quantity:
                  productVariant?.inventoryItem?.inventoryLevel?.quantities?.find(
                    (data) => data.name === 'available',
                  )?.quantity,
                variant_on_hand_quantity:
                  productVariant?.inventoryItem?.inventoryLevel?.quantities?.find(
                    (data) => data.name === 'on_hand',
                  )?.quantity,

                variant_id: extractIdFromGid(productVariant.id),
                product_id: extractIdFromGid(productVariant.product.id),
              }

              return dataProduct
            }),
          )

          if (dataProducts.length > 0) {
            // Always use INSERT to avoid streaming buffer issues
            // BigQuery will handle duplicates based on insert timestamp
            await this.googleBigQueryServices.insertData(
              DATA_SET_ID,
              TABLE_NAME_PRODUCT,
              dataProducts,
            )
            this.logger.log(
              `✅ Inserted ${dataProducts.length} products (${isIncremental && lastSyncTime ? 'incremental' : 'full'})`,
            )
          }

          hasNextPage = result.data.productVariants.pageInfo.hasNextPage
          endCursor = result.data.productVariants.pageInfo.endCursor
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          this.logger.error(`Error fetching products: ${error.message}`)
          hasNextPage = false // Stop the loop if there's an error
          break
        }
      }

      // Save sync timestamp after successful sync
      this.saveLastSyncTimestamp(TABLE_NAME_PRODUCT, syncStartTime)
      this.logger.log('✅ Product synchronization completed.')
    } catch (error) {
      this.logger.error(`Error fetching products: ${error.message}`)
    }
  }

  private async collectOrderMetafieldKeys(
    gqlClient: GraphqlClient,
  ): Promise<string[]> {
    try {
      const result: GraphQLClientResponse<GetMetafieldsDefinitionsQuery> =
        await this.gqlRequestWithRetry<GetMetafieldsDefinitionsQuery>(
          gqlClient,
          GET_METAFIELDS_DEFINITIONS,
          {
            variables: {
              first: 1,
            },
          },
        )

      return result.data.orders.nodes[0].metafieldDefinitions.nodes.map(
        (node) => node.key,
      )
    } catch (error) {
      this.logger.error(`Error collecting metafield keys: ${error.message}`)
      return []
    }
  }

  private async syncOrders(
    gqlClient: GraphqlClient,
    isIncremental: boolean = true,
    syncStartTime: string,
  ) {
    try {
      this.logger.log('Synchronizing orders from Shopify...')
      const DATA_SET_ID = process.env.DATA_SET_ID

      // Get last sync timestamp for incremental sync
      const lastSyncTime = isIncremental
        ? this.getLastSyncTimestamp(TABLE_NAME_ORDER)
        : null

      if (isIncremental && lastSyncTime) {
        console.log(
          `📅 Incremental sync - fetching orders updated after ${lastSyncTime}`,
        )
      } else {
        console.log(`📦 Full sync - fetching all orders`)
      }

      const metafieldKeys = await this.collectOrderMetafieldKeys(gqlClient)
      const base_schema_order = [
        { name: 'order_id', type: 'STRING' },
        { name: 'order_name', type: 'STRING' },
        { name: 'created_at', type: 'TIMESTAMP' },
        { name: 'updated_at', type: 'TIMESTAMP' },
        { name: 'subtotal_before_discount', type: 'FLOAT' },
        { name: 'subtotal_after_discount', type: 'FLOAT' },
        { name: 'shipping_fee', type: 'FLOAT' },
        { name: 'taxes', type: 'FLOAT' },
        { name: 'total_before_discount', type: 'FLOAT' },
        { name: 'total_after_discount', type: 'FLOAT' },
        { name: 'discount_codes', type: 'STRING' },
        { name: 'discount_amount', type: 'FLOAT' },
        { name: 'refunded_amount', type: 'FLOAT' },
        { name: 'cancelled_at', type: 'TIMESTAMP' },
        { name: 'email', type: 'STRING' },
        { name: 'telephone', type: 'STRING' },
        { name: 'customer_first_name', type: 'STRING' },
        { name: 'customer_last_name', type: 'STRING' },
        { name: 'address1', type: 'STRING' },
        { name: 'address2', type: 'STRING' },
        { name: 'city', type: 'STRING' },
        { name: 'zip_code', type: 'STRING' },
        { name: 'province_name', type: 'STRING' },
        { name: 'country', type: 'STRING' },
        { name: 'payment_method', type: 'STRING' },
        { name: 'payment_id', type: 'STRING' },
        { name: 'paid_at', type: 'TIMESTAMP' },
        { name: 'financial_status', type: 'STRING' },
        { name: 'fulfillment_status', type: 'STRING' },
        { name: 'fulfillment_at', type: 'TIMESTAMP' },
        { name: 'shipping_method', type: 'STRING' },
        { name: 'note', type: 'STRING' },
      ]
      const metafield_schema = metafieldKeys.map((key) => ({
        name: `metafield_${key}`,
        type: 'STRING',
      }))
      const schema_order = [...base_schema_order, ...metafield_schema]
      const schema_item = [
        { name: 'order_id', type: 'STRING' },
        { name: 'order_name', type: 'STRING' },
        { name: 'item_sku', type: 'STRING' },
        { name: 'item_name', type: 'STRING' },
        { name: 'vendor', type: 'STRING' },
        { name: 'quantity', type: 'FLOAT' },
        { name: 'item_price', type: 'FLOAT' },
        { name: 'item_compare_at_price', type: 'FLOAT' },
        { name: 'item_fulfillment_status', type: 'STRING' },
      ]
      // Handle order table
      const orderTableExists =
        await this.googleBigQueryServices.checkTableExists(
          DATA_SET_ID,
          TABLE_NAME_ORDER,
        )

      if (!orderTableExists) {
        await this.googleBigQueryServices.createTable(
          DATA_SET_ID,
          TABLE_NAME_ORDER,
          schema_order,
        )
      } else {
        const currentSchema = await this.googleBigQueryServices.getTableSchema(
          DATA_SET_ID,
          TABLE_NAME_ORDER,
        )
        const currentFieldNames = currentSchema.map((f) => f.name)
        const newFields = schema_order.filter(
          (f) => !currentFieldNames.includes(f.name),
        )
        if (newFields.length > 0) {
          await this.googleBigQueryServices.addColumnsToTable(
            DATA_SET_ID,
            TABLE_NAME_ORDER,
            newFields,
          )
        }
      }

      // Handle order_item table
      const orderItemTableExists =
        await this.googleBigQueryServices.checkTableExists(
          DATA_SET_ID,
          TABLE_NAME_ORDER_ITEM,
        )

      if (!orderItemTableExists) {
        await this.googleBigQueryServices.createTable(
          DATA_SET_ID,
          TABLE_NAME_ORDER_ITEM,
          schema_item,
        )
      } else {
        const currentSchema = await this.googleBigQueryServices.getTableSchema(
          DATA_SET_ID,
          TABLE_NAME_ORDER_ITEM,
        )
        const currentFieldNames = currentSchema.map((f) => f.name)
        const newFields = schema_item.filter(
          (f) => !currentFieldNames.includes(f.name),
        )
        if (newFields.length > 0) {
          await this.googleBigQueryServices.addColumnsToTable(
            DATA_SET_ID,
            TABLE_NAME_ORDER_ITEM,
            newFields,
          )
        }
      }

      // Only truncate if doing full sync
      if (!isIncremental || !lastSyncTime) {
        await this.googleBigQueryServices.truncateTable(
          DATA_SET_ID,
          TABLE_NAME_ORDER,
        )
        await this.googleBigQueryServices.truncateTable(
          DATA_SET_ID,
          TABLE_NAME_ORDER_ITEM,
        )
      }

      let hasNextPage = true
      let endCursor = null

      while (hasNextPage) {
        try {
          // Build query variables
          const variables: any = {
            first: MAX_QUERY_NUMBER,
            endCursor: endCursor,
          }

          // Add updatedAt OR createdAt filter for incremental sync
          // This ensures we catch both newly created and updated records
          if (isIncremental && lastSyncTime) {
            variables.query = `updated_at:>='${lastSyncTime}' OR created_at:>='${lastSyncTime}'`
          }

          const result: GraphQLClientResponse<GetOrdersQuery> =
            await this.gqlRequestWithRetry<GetOrdersQuery>(
              gqlClient,
              GET_ORDERS,
              {
                variables,
              },
            )
          const dataOrders = await Promise.all(
            result.data.orders.edges.map(async (edge) => {
              const order = edge.node

              // Insert data to Order_item
              const dataLineItems = []

              // Accumulators for heavy fields from first GET_ORDER_DETAILS_WITH_LINE_ITEMS page
              let taxTotal = 0
              let discountCodesArray: string[] = []
              let transactions: Transaction[] = []
              let fulfillments: Fulfillment[] = []
              let metafieldNodes: MetafieldNode[] = []
              let metafieldsHasNextPage = false
              let metafieldsEndCursor: string | null = null

              let lineItemHasNextPage = true
              let lineItemEndCursor = null

              // Paginate through lineItems if there are more than 250
              while (lineItemHasNextPage) {
                try {
                  const lineItemResult: GraphQLClientResponse<GetLineItemQuery> =
                    await this.gqlRequestWithRetry<GetLineItemQuery>(
                      gqlClient,
                      GET_ORDER_DETAILS_WITH_LINE_ITEMS,
                      {
                        variables: {
                          id: order.id,
                          first: MAX_QUERY_NUMBER,
                          endCursor: lineItemEndCursor,
                        },
                      },
                    )

                  // On the first page of GET_ORDER_DETAILS_WITH_LINE_ITEMS, capture heavy fields from order
                  if (lineItemEndCursor == null) {
                    const orderData = lineItemResult.data.order
                    const taxLines = orderData?.taxLines || []
                    taxTotal = taxLines.reduce((sum: number, tl: TaxLine) => {
                      const amount = tl?.priceSet?.presentmentMoney?.amount
                      return sum + (parseFloat(amount) || 0)
                    }, 0)
                    discountCodesArray = orderData?.discountCodes || []
                    transactions = orderData?.transactions || []
                    fulfillments = orderData?.fulfillments || []
                    const metaResp = orderData?.metafields
                    metafieldNodes = (metaResp?.nodes || []) as MetafieldNode[]
                    metafieldsHasNextPage =
                      metaResp?.pageInfo?.hasNextPage || false
                    metafieldsEndCursor = metaResp?.pageInfo?.endCursor || null
                  }

                  // Fix: Use push instead of concat to properly add new items
                  const additionalLineItems =
                    lineItemResult.data.order.lineItems.nodes.map(
                      (lineItem) => ({
                        order_id: extractIdFromGid(order.id),
                        order_name: order.name,
                        item_sku: lineItem.sku,
                        item_name: lineItem.name,
                        vendor: lineItem.vendor,
                        quantity: lineItem.quantity,
                        item_price:
                          lineItem.originalUnitPriceSet?.presentmentMoney
                            ?.amount,
                        item_compare_at_price:
                          lineItem.product?.compareAtPriceRange
                            ?.maxVariantCompareAtPrice.amount,
                        item_fulfillment_status: lineItem.fulfillmentStatus,
                      }),
                    )
                  dataLineItems.push(...additionalLineItems)

                  lineItemHasNextPage =
                    lineItemResult.data.order.lineItems.pageInfo.hasNextPage
                  lineItemEndCursor =
                    lineItemResult.data.order.lineItems.pageInfo.endCursor
                } catch (error) {
                  this.logger.error(
                    `Error fetching lineItem for order ${order.id}: ${error.message}`,
                  )
                  break // Exit the variant pagination loop if an error occurs
                }
              }

              // If metafields > 250, paginate the rest using GET_ORDER_METAFIELDS
              if (metafieldsHasNextPage) {
                try {
                  let hasMoreMetafields: boolean = metafieldsHasNextPage
                  let cursor = metafieldsEndCursor
                  while (hasMoreMetafields) {
                    const res: GraphQLClientResponse<GetOrderMetafieldsQuery> =
                      await this.gqlRequestWithRetry<GetOrderMetafieldsQuery>(
                        gqlClient,
                        GET_ORDER_METAFIELDS,
                        {
                          variables: {
                            id: order.id,
                            first: MAX_QUERY_NUMBER,
                            endCursor: cursor,
                          },
                        },
                      )
                    const pageNodes = res.data?.order?.metafields?.nodes || []
                    metafieldNodes.push(...pageNodes)
                    hasMoreMetafields =
                      res.data?.order?.metafields?.pageInfo?.hasNextPage ||
                      false
                    cursor =
                      res.data?.order?.metafields?.pageInfo?.endCursor || null
                  }
                } catch (error) {
                  this.logger.warn(
                    `Failed to paginate metafields for order ${order.id}: ${error.message}`,
                  )
                }
              }

              try {
                await this.googleBigQueryServices.insertData(
                  DATA_SET_ID,
                  TABLE_NAME_ORDER_ITEM,
                  dataLineItems,
                )
              } catch (lineItemError) {
                this.logger.warn(
                  `Failed to insert Order_item data: ${lineItemError.message}`,
                )
              }

              const subtotalBeforeDiscount = dataLineItems.reduce(
                (sum, data) => {
                  const amount = data.item_price
                  return sum + (parseFloat(amount) || 0) * data.quantity
                },
                0,
              )

              // Create base order data
              const baseOrderData = {
                order_id: extractIdFromGid(order.id),
                order_name: order.name,
                created_at: order.createdAt,
                updated_at: order.updatedAt,
                subtotal_before_discount: subtotalBeforeDiscount,
                subtotal_after_discount:
                  order.currentSubtotalPriceSet?.presentmentMoney?.amount,
                shipping_fee:
                  order.shippingLine?.originalPriceSet?.presentmentMoney
                    ?.amount,
                taxes: taxTotal,
                total_before_discount:
                  subtotalBeforeDiscount +
                    Number(
                      order.totalShippingPriceSet?.presentmentMoney?.amount,
                    ) || 0,
                total_after_discount:
                  order.currentTotalPriceSet?.presentmentMoney?.amount,
                discount_codes: (discountCodesArray || []).join(','),
                discount_amount:
                  order.cartDiscountAmountSet?.presentmentMoney?.amount,
                refunded_amount:
                  order.totalRefundedSet?.presentmentMoney?.amount,
                cancelled_at: order.cancelledAt,
                email: order.email,
                telephone: order.phone,
                customer_first_name: order.customer?.firstName,
                customer_last_name: order.customer?.lastName,
                address1: order.displayAddress?.address1,
                address2: order.displayAddress?.address2,
                city: order.displayAddress?.city,
                zip_code: order.displayAddress?.zip,
                province_name: order.displayAddress?.province,
                country: order.displayAddress?.country,
                payment_method: transactions?.[0]?.paymentMethod,
                payment_id: transactions?.[0]?.paymentId,
                paid_at: transactions?.[0]?.createdAt,
                financial_status: order.displayFinancialStatus,
                fulfillment_status: order.displayFulfillmentStatus,
                fulfillment_at: fulfillments.find(
                  (f: Fulfillment) => f.status == 'SUCCESS',
                )?.createdAt,
                shipping_method: order.shippingLine?.code,
                note: order.note,
              }

              // Create metafield data dynamically
              const metafieldData = {}
              if (metafieldKeys.length > 0) {
                const metaMap = new Map<string, unknown>()
                metafieldNodes.forEach((node: MetafieldNode) => {
                  if (node && typeof node.key === 'string') {
                    metaMap.set(node.key, node.value)
                  }
                })
                metafieldKeys.forEach((key) => {
                  const cleanKey = `metafield_${key}`
                  const value = metaMap.has(key) ? metaMap.get(key) : ''
                  metafieldData[cleanKey] = value ? value.toString() : ''
                })
              }

              const dataOrder = {
                ...baseOrderData,
                ...metafieldData,
              }

              return { order: dataOrder, lineItems: dataLineItems }
            }),
          )

          const ordersToInsert = dataOrders.map((d) => d.order)
          const lineItemsToInsert = dataOrders.flatMap((d) => d.lineItems)

          if (ordersToInsert.length > 0) {
            // Always use INSERT to avoid streaming buffer issues
            // BigQuery will handle duplicates based on insert timestamp
            await this.googleBigQueryServices.insertData(
              DATA_SET_ID,
              TABLE_NAME_ORDER,
              ordersToInsert,
            )
            this.logger.log(
              `✅ Inserted ${ordersToInsert.length} orders (${isIncremental && lastSyncTime ? 'incremental' : 'full'})`,
            )
          }

          if (lineItemsToInsert.length > 0) {
            // Always use INSERT to avoid streaming buffer issues
            // For incremental sync, we accept temporary duplicates
            // They will be cleaned up during the nightly full sync
            await this.googleBigQueryServices.insertData(
              DATA_SET_ID,
              TABLE_NAME_ORDER_ITEM,
              lineItemsToInsert,
            )
            this.logger.log(
              `✅ Inserted ${lineItemsToInsert.length} order items (${isIncremental && lastSyncTime ? 'incremental - may have duplicates until full sync' : 'full'})`,
            )
          }

          hasNextPage = result.data.orders.pageInfo.hasNextPage
          endCursor = result.data.orders.pageInfo.endCursor
        } catch (error) {
          this.logger.error(`Error sync orders: ${error.message}`)
          hasNextPage = false // Stop the loop if there's an error
          break
        }
      }

      // Save sync timestamp after successful sync
      this.saveLastSyncTimestamp(TABLE_NAME_ORDER, syncStartTime)
      this.logger.log('✅ Order synchronization completed.')
    } catch (error) {
      this.logger.error(`Error fetching order: ${error.message}`)
    }
  }
}
