export const GET_PRODUCT_VARIANTS = `#graphql
query getProductVariants($first: Int!, $endCursor: String, $shopLocationId: ID!, $query: String!) {
	productVariants(first: $first,after: $endCursor, query: $query) {
		edges {
			node {
				id
      selectedOptions {
        name
        value
      }
      product {
        id
        handle
        collections(first:  $first) {
          nodes {
            title
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
        description
        vendor
        title
        status
        metafields(first: 9, keys: ["custom.parentsku", "custom.pid_catalogue", "magento.product_gender", "magento.product_jda_brand_id", "magento.product_jda_dept", "magento.product_jda_discount_code", "magento.product_jda_dtype", "magento.product_jda_subdept", "magento.product_job_number"]) {
          nodes {
            key
            value
            references(first: 10) {
              nodes {
                ... on Metaobject {
                  id
                  handle
                  displayName
                }
              }
            }
          }
        }
        media(first: 10) {
          nodes {
            preview {
              image {
                url
              }
            }
          }
        }
      }
      sku
      barcode
      price
      compareAtPrice
      inventoryItem {
        id
        inventoryLevel(locationId: $shopLocationId) {
          quantities(names: ["available", "on_hand"]) {
            id
            name
            quantity
          }
        }
      }
			}
		}
		pageInfo {
			hasNextPage
			endCursor
		}
	}
}`

export const GET_COLLECTION_DATA = `#graphql
query getCollection($first: Int!, $id: ID!, $endCursor: String) {
  product(id: $id) {
    id
    collections(first: $first,after: $endCursor) {
      nodes {
        id
       title
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
}`
