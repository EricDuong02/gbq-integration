/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types';

export type GetOrdersQueryVariables = AdminTypes.Exact<{
  first: AdminTypes.Scalars['Int']['input'];
  endCursor?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type GetOrdersQuery = { orders: { edges: Array<{ node: (
        Pick<AdminTypes.Order, 'id' | 'name' | 'createdAt' | 'updatedAt' | 'cancelledAt' | 'email' | 'phone' | 'displayFinancialStatus' | 'displayFulfillmentStatus' | 'note'>
        & { subtotalPriceSet?: AdminTypes.Maybe<{ presentmentMoney: Pick<AdminTypes.MoneyV2, 'amount'> }>, currentSubtotalPriceSet: { presentmentMoney: Pick<AdminTypes.MoneyV2, 'amount'> }, totalShippingPriceSet: { presentmentMoney: Pick<AdminTypes.MoneyV2, 'amount'> }, currentTotalPriceSet: { presentmentMoney: Pick<AdminTypes.MoneyV2, 'amount'> }, totalPriceSet: { presentmentMoney: Pick<AdminTypes.MoneyV2, 'amount'> }, cartDiscountAmountSet?: AdminTypes.Maybe<{ presentmentMoney: Pick<AdminTypes.MoneyV2, 'amount'> }>, totalRefundedSet: { presentmentMoney: Pick<AdminTypes.MoneyV2, 'amount'> }, customer?: AdminTypes.Maybe<Pick<AdminTypes.Customer, 'firstName' | 'lastName'>>, displayAddress?: AdminTypes.Maybe<Pick<AdminTypes.MailingAddress, 'address1' | 'address2' | 'city' | 'zip' | 'province' | 'country'>>, shippingLine?: AdminTypes.Maybe<(
          Pick<AdminTypes.ShippingLine, 'code'>
          & { originalPriceSet: { presentmentMoney: Pick<AdminTypes.MoneyV2, 'amount'> } }
        )> }
      ) }>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> } };

export type GetLineItemQueryVariables = AdminTypes.Exact<{
  first: AdminTypes.Scalars['Int']['input'];
  id: AdminTypes.Scalars['ID']['input'];
  endCursor?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type GetLineItemQuery = { order?: AdminTypes.Maybe<(
    Pick<AdminTypes.Order, 'id' | 'discountCodes'>
    & { taxLines: Array<{ priceSet: { presentmentMoney: Pick<AdminTypes.MoneyV2, 'amount'> } }>, transactions: Array<Pick<AdminTypes.OrderTransaction, 'paymentMethod' | 'paymentId' | 'createdAt'>>, fulfillments: Array<Pick<AdminTypes.Fulfillment, 'status' | 'createdAt'>>, metafields: { nodes: Array<Pick<AdminTypes.Metafield, 'key' | 'value'>>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> }, lineItems: { nodes: Array<(
        Pick<AdminTypes.LineItem, 'id' | 'sku' | 'name' | 'vendor' | 'quantity' | 'fulfillmentStatus'>
        & { originalUnitPriceSet: { presentmentMoney: Pick<AdminTypes.MoneyV2, 'amount'> }, product?: AdminTypes.Maybe<{ compareAtPriceRange?: AdminTypes.Maybe<{ maxVariantCompareAtPrice: Pick<AdminTypes.MoneyV2, 'amount'> }> }> }
      )>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> } }
  )> };

export type GetMetafieldsDefinitionsQueryVariables = AdminTypes.Exact<{
  first: AdminTypes.Scalars['Int']['input'];
}>;


export type GetMetafieldsDefinitionsQuery = { orders: { nodes: Array<{ metafieldDefinitions: { nodes: Array<Pick<AdminTypes.MetafieldDefinition, 'key' | 'name'>> } }> } };

export type GetOrderMetafieldsQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  first: AdminTypes.Scalars['Int']['input'];
  endCursor?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type GetOrderMetafieldsQuery = { order?: AdminTypes.Maybe<(
    Pick<AdminTypes.Order, 'id'>
    & { metafields: { nodes: Array<Pick<AdminTypes.Metafield, 'key' | 'value'>>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> } }
  )> };

export type GetProductVariantsQueryVariables = AdminTypes.Exact<{
  first: AdminTypes.Scalars['Int']['input'];
  endCursor?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
  shopLocationId: AdminTypes.Scalars['ID']['input'];
}>;


export type GetProductVariantsQuery = { productVariants: { edges: Array<{ node: (
        Pick<AdminTypes.ProductVariant, 'id' | 'sku' | 'barcode' | 'price' | 'compareAtPrice'>
        & { selectedOptions: Array<Pick<AdminTypes.SelectedOption, 'name' | 'value'>>, product: (
          Pick<AdminTypes.Product, 'id' | 'handle' | 'description' | 'vendor' | 'title' | 'status'>
          & { collections: { nodes: Array<Pick<AdminTypes.Collection, 'title'>>, pageInfo: Pick<AdminTypes.PageInfo, 'endCursor' | 'hasNextPage'> }, metafields: { nodes: Array<(
              Pick<AdminTypes.Metafield, 'key' | 'value'>
              & { references?: AdminTypes.Maybe<{ nodes: Array<AdminTypes.Maybe<Pick<AdminTypes.Metaobject, 'id' | 'handle' | 'displayName'>>> }> }
            )> }, media: { nodes: Array<{ preview?: AdminTypes.Maybe<{ image?: AdminTypes.Maybe<Pick<AdminTypes.Image, 'url'>> }> }> } }
        ), inventoryItem: (
          Pick<AdminTypes.InventoryItem, 'id'>
          & { inventoryLevel?: AdminTypes.Maybe<{ quantities: Array<Pick<AdminTypes.InventoryQuantity, 'id' | 'name' | 'quantity'>> }> }
        ) }
      ) }>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> } };

export type GetCollectionQueryVariables = AdminTypes.Exact<{
  first: AdminTypes.Scalars['Int']['input'];
  id: AdminTypes.Scalars['ID']['input'];
  endCursor?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type GetCollectionQuery = { product?: AdminTypes.Maybe<(
    Pick<AdminTypes.Product, 'id'>
    & { collections: { nodes: Array<Pick<AdminTypes.Collection, 'id' | 'title'>>, pageInfo: Pick<AdminTypes.PageInfo, 'endCursor' | 'hasNextPage'> } }
  )> };

interface GeneratedQueryTypes {
  "#graphql\nquery getOrders($first: Int!, $endCursor: String) {\n  orders(first: $first, after: $endCursor) {\n    edges {\n      node {\n        id\n        name\n        createdAt\n        updatedAt\n        subtotalPriceSet {\n          presentmentMoney {\n            amount\n          }\n        }\n        currentSubtotalPriceSet {\n          presentmentMoney {\n            amount\n          }\n        }\n        totalShippingPriceSet {\n          presentmentMoney {\n            amount\n          }\n        }\n        currentTotalPriceSet {\n          presentmentMoney {\n            amount\n          }\n        }\n        totalPriceSet {\n          presentmentMoney {\n            amount\n          }\n        }\n        cartDiscountAmountSet {\n          presentmentMoney {\n            amount\n          }\n        }\n        totalRefundedSet {\n          presentmentMoney {\n            amount\n          }\n        }\n        cancelledAt\n        email\n        phone\n        customer {\n          firstName\n          lastName\n        }\n        displayAddress {\n          address1\n          address2\n          city\n          zip\n          province\n          country\n        }\n        displayFinancialStatus\n        displayFulfillmentStatus\n        shippingLine {\n          code\n          originalPriceSet {\n            presentmentMoney {\n              amount\n            }\n          }\n        }\n        note\n      }\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}": {return: GetOrdersQuery, variables: GetOrdersQueryVariables},
  "#graphql\nquery getLineItem($first: Int!, $id: ID!, $endCursor: String) {\n  order(id: $id) {\n    id\n    taxLines {\n      priceSet {\n        presentmentMoney {\n          amount\n        }\n      }\n    }\n    discountCodes\n    transactions {\n      paymentMethod\n      paymentId\n      createdAt\n    }\n    fulfillments {\n      status\n      createdAt\n    }\n    metafields(first: 250) {\n      nodes {\n        key\n        value\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n    lineItems(first: $first,after: $endCursor) {\n      nodes {\n        id\n        sku\n        name\n        vendor\n        quantity\n        originalUnitPriceSet {\n          presentmentMoney {\n            amount\n          }\n        }\n        product {\n          compareAtPriceRange {\n            maxVariantCompareAtPrice {\n              amount\n            }\n          }\n        }\n        fulfillmentStatus\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n}": {return: GetLineItemQuery, variables: GetLineItemQueryVariables},
  "#graphql\nquery getMetafieldsDefinitions($first: Int!) {\n  orders(first: $first) {\n    nodes {\n      metafieldDefinitions(first: 250) {\n        nodes {\n          key\n          name\n        }\n      }\n    }\n  }\n}": {return: GetMetafieldsDefinitionsQuery, variables: GetMetafieldsDefinitionsQueryVariables},
  "#graphql\nquery getOrderMetafields($id: ID!, $first: Int!, $endCursor: String) {\n  order(id: $id) {\n    id\n    metafields(first: $first, after: $endCursor) {\n      nodes {\n        key\n        value\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n}": {return: GetOrderMetafieldsQuery, variables: GetOrderMetafieldsQueryVariables},
  "#graphql\nquery getProductVariants($first: Int!, $endCursor: String, $shopLocationId: ID!) {\n\tproductVariants(first: $first,after: $endCursor) {\n\t\tedges {\n\t\t\tnode {\n\t\t\t\tid\n      selectedOptions {\n        name\n        value\n      }\n      product {\n        id\n        handle\n        collections(first:  $first) {\n          nodes {\n            title\n          }\n          pageInfo {\n            endCursor\n            hasNextPage\n          }\n        }\n        description\n        vendor\n        title\n        status\n        metafields(first: 9, keys: [\"custom.parentsku\", \"custom.pid_catalogue\", \"magento.product_gender\", \"magento.product_jda_brand_id\", \"magento.product_jda_dept\", \"magento.product_jda_discount_code\", \"magento.product_jda_dtype\", \"magento.product_jda_subdept\", \"magento.product_job_number\"]) {\n          nodes {\n            key\n            value\n            references(first: 10) {\n              nodes {\n                ... on Metaobject {\n                  id\n                  handle\n                  displayName\n                }\n              }\n            }\n          }\n        }\n        media(first: 10) {\n          nodes {\n            preview {\n              image {\n                url\n              }\n            }\n          }\n        }\n      }\n      sku\n      barcode\n      price\n      compareAtPrice\n      inventoryItem {\n        id\n        inventoryLevel(locationId: $shopLocationId) {\n          quantities(names: [\"available\", \"on_hand\"]) {\n            id\n            name\n            quantity\n          }\n        }\n      }\n\t\t\t}\n\t\t}\n\t\tpageInfo {\n\t\t\thasNextPage\n\t\t\tendCursor\n\t\t}\n\t}\n}": {return: GetProductVariantsQuery, variables: GetProductVariantsQueryVariables},
  "#graphql\nquery getCollection($first: Int!, $id: ID!, $endCursor: String) {\n  product(id: $id) {\n    id\n    collections(first: $first,after: $endCursor) {\n      nodes {\n        id\n       title\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n      }\n    }\n  }\n}": {return: GetCollectionQuery, variables: GetCollectionQueryVariables},
}

interface GeneratedMutationTypes {
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
