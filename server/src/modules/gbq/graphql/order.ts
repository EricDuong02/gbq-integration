export const GET_ORDERS = `#graphql
query getOrders($first: Int!, $endCursor: String, $query: String) {
  orders(first: $first, after: $endCursor, query: $query) {
    edges {
      node {
        id
        name
        createdAt
        updatedAt
        subtotalPriceSet {
          presentmentMoney {
            amount
          }
        }
        currentSubtotalPriceSet {
          presentmentMoney {
            amount
          }
        }
        totalShippingPriceSet {
          presentmentMoney {
            amount
          }
        }
        currentTotalPriceSet {
          presentmentMoney {
            amount
          }
        }
        totalPriceSet {
          presentmentMoney {
            amount
          }
        }
        cartDiscountAmountSet {
          presentmentMoney {
            amount
          }
        }
        totalRefundedSet {
          presentmentMoney {
            amount
          }
        }
        cancelledAt
        email
        phone
        customer {
          firstName
          lastName
        }
        displayAddress {
          address1
          address2
          city
          zip
          province
          country
        }
        displayFinancialStatus
        displayFulfillmentStatus
        shippingLine {
          code
          originalPriceSet {
            presentmentMoney {
              amount
            }
          }
        }
        note
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`

export const GET_ORDER_DETAILS_WITH_LINE_ITEMS = `#graphql
query getLineItem($first: Int!, $id: ID!, $endCursor: String) {
  order(id: $id) {
    id
    taxLines {
      priceSet {
        presentmentMoney {
          amount
        }
      }
    }
    discountCodes
    transactions {
      paymentMethod
      paymentId
      createdAt
    }
    fulfillments {
      status
      createdAt
    }
    metafields(first: 250) {
      nodes {
        key
        value
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
    lineItems(first: $first,after: $endCursor) {
      nodes {
        id
        sku
        name
        vendor
        quantity
        originalUnitPriceSet {
          presentmentMoney {
            amount
          }
        }
        product {
          compareAtPriceRange {
            maxVariantCompareAtPrice {
              amount
            }
          }
        }
        fulfillmentStatus
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`

export const GET_METAFIELDS_DEFINITIONS = `#graphql
query getMetafieldsDefinitions($first: Int!) {
  orders(first: $first) {
    nodes {
      metafieldDefinitions(first: 250) {
        nodes {
          key
          name
        }
      }
    }
  }
}`

export const GET_ORDER_METAFIELDS = `#graphql
query getOrderMetafields($id: ID!, $first: Int!, $endCursor: String) {
  order(id: $id) {
    id
    metafields(first: $first, after: $endCursor) {
      nodes {
        key
        value
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`
