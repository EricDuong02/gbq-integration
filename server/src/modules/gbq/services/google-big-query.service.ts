import { BigQuery } from '@google-cloud/bigquery'
import { Injectable } from '@nestjs/common'

@Injectable()
export class GoogleBigQueryServices {
  bigquery: BigQuery
  constructor() {
    this.bigquery = new BigQuery()
  }

  public async createTable(
    datasetId: string,
    tableId: string,
    schema: { name: string; type: string; mode?: string }[],
  ) {
    const [datasets] = await this.bigquery.getDatasets()
    const datasetExists = datasets.some((dataset) => dataset.id === datasetId)

    if (!datasetExists) {
      await this.bigquery.createDataset(datasetId)
    }

    const dataset = this.bigquery.dataset(datasetId)
    const [tables] = await dataset.getTables()
    const tableExists = tables.some((table) => table.id === tableId)

    if (!tableExists) {
      await dataset.createTable(tableId, { schema })
    }
  }

  public async truncateTable(datasetId: string, tableId: string) {
    const query = `DELETE FROM \`${datasetId}.${tableId}\` WHERE TRUE;`
    await this.bigquery.query(query)
  }

  public async insertData(datasetId: string, tableId: string, rows: object[]) {
    try {
      const dataset = this.bigquery.dataset(datasetId)
      const table = dataset.table(tableId)

      await table.insert(rows)
    } catch (error) {
      console.log('error', error)
    }
  }

  public async checkTableExists(
    datasetId: string,
    tableId: string,
  ): Promise<boolean> {
    const dataset = this.bigquery.dataset(datasetId)
    const [tables] = await dataset.getTables()
    return tables.some((table) => table.id === tableId)
  }

  public async getTableSchema(
    datasetId: string,
    tableId: string,
  ): Promise<any[]> {
    const dataset = this.bigquery.dataset(datasetId)
    const table = dataset.table(tableId)
    const [metadata] = await table.getMetadata()
    return metadata.schema.fields
  }

  public async addColumnsToTable(
    datasetId: string,
    tableId: string,
    newFields: { name: string; type: string; mode?: string }[],
  ) {
    if (!newFields.length) return
    const dataset = this.bigquery.dataset(datasetId)
    const table = dataset.table(tableId)
    const [metadata] = await table.getMetadata()
    const currentFields = metadata.schema.fields
    const updatedFields = [...currentFields, ...newFields]
    await table.setMetadata({ schema: { fields: updatedFields } })
  }

  // Alias for addColumnsToTable
  public async updateTableSchema(
    datasetId: string,
    tableId: string,
    newFields: { name: string; type: string; mode?: string }[],
  ) {
    return this.addColumnsToTable(datasetId, tableId, newFields)
  }

  /**
   * Delete rows from a table based on a WHERE condition
   */
  public async deleteRows(
    datasetId: string,
    tableId: string,
    whereCondition: string,
  ) {
    const query = `DELETE FROM \`${datasetId}.${tableId}\` WHERE ${whereCondition}`
    await this.bigquery.query(query)
  }

  /**
   * Merge data into a table using a temporary staging approach
   * If streaming buffer error occurs, fallback to delete+insert
   */
  public async mergeData(
    datasetId: string,
    tableId: string,
    rows: object[],
    primaryKeys: string[],
  ) {
    if (rows.length === 0) return

    let stagingTableId: string | null = null

    try {
      // Create a temporary staging table
      stagingTableId = `${tableId}_staging_${Date.now()}`
      const dataset = this.bigquery.dataset(datasetId)

      // Get the schema from the main table
      const mainTable = dataset.table(tableId)
      const [metadata] = await mainTable.getMetadata()
      const schema = metadata.schema.fields

      // Create staging table with the same schema
      await dataset.createTable(stagingTableId, { schema })

      // Insert data into staging table
      const stagingTable = dataset.table(stagingTableId)
      await stagingTable.insert(rows)

      // Build the MERGE query
      const allFields = schema.map((field) => field.name)
      const primaryKeyCondition = primaryKeys
        .map((key) => `T.${key} = S.${key}`)
        .join(' AND ')

      const updateFields = allFields
        .filter((field) => !primaryKeys.includes(field))
        .map((field) => `T.${field} = S.${field}`)
        .join(', ')

      const insertFields = allFields.join(', ')
      const insertValues = allFields.map((field) => `S.${field}`).join(', ')

      const mergeQuery = `
        MERGE \`${datasetId}.${tableId}\` T
        USING \`${datasetId}.${stagingTableId}\` S
        ON ${primaryKeyCondition}
        WHEN MATCHED THEN
          UPDATE SET ${updateFields}
        WHEN NOT MATCHED THEN
          INSERT (${insertFields})
          VALUES (${insertValues})
      `

      // Execute the merge
      await this.bigquery.query(mergeQuery)

      // Drop the staging table
      await stagingTable.delete()

      console.log(
        `✅ Successfully merged ${rows.length} rows using MERGE statement`,
      )
    } catch (error) {
      console.log('Error in mergeData:', error.message)

      // Check if error is due to streaming buffer
      if (error.message && error.message.includes('streaming buffer')) {
        console.log(
          '⚠️  Streaming buffer detected - falling back to DELETE + INSERT method',
        )

        try {
          // Clean up staging table if it exists
          if (stagingTableId) {
            const dataset = this.bigquery.dataset(datasetId)
            const stagingTable = dataset.table(stagingTableId)
            await stagingTable.delete().catch(() => {})
          }

          // Fallback: Delete existing rows then insert new ones
          await this.mergeWithDeleteInsert(
            datasetId,
            tableId,
            rows,
            primaryKeys,
          )
          console.log(
            `✅ Successfully merged ${rows.length} rows using DELETE+INSERT fallback`,
          )
          return
        } catch (fallbackError) {
          console.log('Error in fallback method:', fallbackError.message)
          throw fallbackError
        }
      }

      // Clean up staging table on any other error
      if (stagingTableId) {
        try {
          const dataset = this.bigquery.dataset(datasetId)
          const stagingTable = dataset.table(stagingTableId)
          await stagingTable.delete()
        } catch (cleanupError) {
          console.log('Error cleaning up staging table:', cleanupError.message)
        }
      }

      throw error
    }
  }

  /**
   * Fallback merge method using DELETE + INSERT
   * Used when streaming buffer prevents MERGE operation
   */
  private async mergeWithDeleteInsert(
    datasetId: string,
    tableId: string,
    rows: object[],
    primaryKeys: string[],
  ) {
    if (rows.length === 0) return

    // Extract primary key values from rows
    const primaryKeyValues = rows.map((row) => {
      const values = primaryKeys.map((key) => {
        const value = row[key]
        // Escape single quotes and wrap in quotes if string
        if (typeof value === 'string') {
          return `'${value.replace(/'/g, "\\'")}'`
        }
        return value
      })
      return `(${values.join(', ')})`
    })

    // Build DELETE query - delete rows that will be updated
    const whereConditions = primaryKeyValues.map((values, index) => {
      const conditions = primaryKeys.map((key) => {
        const value = rows[index][key]
        if (typeof value === 'string') {
          return `${key} = '${value.replace(/'/g, "\\'")}'`
        }
        return `${key} = ${value}`
      })
      return `(${conditions.join(' AND ')})`
    })

    if (whereConditions.length > 0) {
      const deleteQuery = `
        DELETE FROM \`${datasetId}.${tableId}\`
        WHERE ${whereConditions.join(' OR ')}
      `

      // Wait a bit to ensure streaming buffer has time to process
      console.log(
        '⏳ Waiting 2 seconds before DELETE to allow streaming buffer to settle...',
      )
      await new Promise((resolve) => setTimeout(resolve, 2000))

      try {
        await this.bigquery.query(deleteQuery)
        console.log(`🗑️  Deleted ${whereConditions.length} existing rows`)
      } catch (deleteError) {
        // If delete still fails due to streaming buffer, just log and continue with insert
        if (
          deleteError.message &&
          deleteError.message.includes('streaming buffer')
        ) {
          console.log(
            '⚠️  DELETE also affected by streaming buffer - skipping delete, will insert duplicates that will be cleaned up later',
          )
        } else {
          throw deleteError
        }
      }
    }

    // Insert new/updated rows
    const dataset = this.bigquery.dataset(datasetId)
    const table = dataset.table(tableId)
    await table.insert(rows)
    console.log(`✅ Inserted ${rows.length} rows`)
  }

  private async waitForTableReady(
    datasetId: string,
    tableId: string,
    maxWaitMs = 15000,
  ): Promise<void> {
    const pollInterval = 500 // ms
    let waited = 0
    while (waited < maxWaitMs) {
      const exists = await this.checkTableExists(datasetId, tableId)
      if (exists) return
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
      waited += pollInterval
    }
    throw new Error(`Timeout: Table ${tableId} not ready after ${maxWaitMs}ms`)
  }

  // Upsert functions using staging table
  public async createStagingTable(
    datasetId: string,
    tableId: string,
    schema: { name: string; type: string; mode?: string }[],
  ) {
    const stagingTableId = `${tableId}_staging`

    // Check if staging table already exists
    const stagingTableExists = await this.checkTableExists(
      datasetId,
      stagingTableId,
    )

    if (stagingTableExists) {
      console.log(
        `Staging table ${stagingTableId} already exists, skipping creation`,
      )
      return stagingTableId
    }

    try {
      await this.createTable(datasetId, stagingTableId, schema)
      console.log(`Created staging table: ${stagingTableId}`)
      // Polling wait for table to exist
      await this.waitForTableReady(datasetId, stagingTableId, 15000)
      return stagingTableId
    } catch (error) {
      console.log(`Error creating staging table: ${error.message}`)
      throw error
    }
  }

  public async insertToStagingTable(
    datasetId: string,
    stagingTableId: string,
    rows: object[],
  ) {
    const maxRetries = 20
    const retryDelay = 2000 // 2 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const dataset = this.bigquery.dataset(datasetId)
        const table = dataset.table(stagingTableId)
        await table.insert(rows)
        console.log(
          `Successfully inserted ${rows.length} rows to staging table: ${stagingTableId}`,
        )
        return
      } catch (error) {
        console.log(
          `Attempt ${attempt}/${maxRetries}: Error inserting to staging table: ${error.message}`,
        )

        // If it's a "Table not found" error and hasn't reached max retries, wait and retry
        if (error.message.includes('not found') && attempt < maxRetries) {
          console.log(`Waiting ${retryDelay}ms before retry...`)
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
          continue
        }

        // If it's not a "not found" error or has reached max retries, throw error
        throw error
      }
    }
  }

  public async mergeFromStagingToMain(
    datasetId: string,
    mainTableId: string,
    stagingTableId: string,
    keyField: string,
    tableType: 'order' | 'order_item' | 'product',
    metafieldKeys?: string[],
  ) {
    const query = `
      MERGE INTO \`${datasetId}.${mainTableId}\` T
      USING \`${datasetId}.${stagingTableId}\` S
      ON T.${keyField} = S.${keyField}
      WHEN MATCHED THEN
        UPDATE SET
          ${this.generateUpdateFields(tableType, metafieldKeys)}
      WHEN NOT MATCHED THEN
        INSERT (${this.generateInsertFields(tableType, metafieldKeys)})
        VALUES (${this.generateInsertValues(tableType, metafieldKeys)})
    `
    await this.bigquery.query(query)
  }

  private generateUpdateFields(
    tableType: string,
    metafieldKeys?: string[],
  ): string {
    // Tạo danh sách các field cần update (trừ key field)
    let updateFields: string[] = []

    if (tableType === 'order') {
      updateFields = [
        'order_name',
        'created_at',
        'updated_at',
        'subtotal_before_discount',
        'subtotal_after_discount',
        'shipping_fee',
        'taxes',
        'total_before_discount',
        'total_after_discount',
        'discount_codes',
        'discount_amount',
        'refunded_amount',
        'cancelled_at',
        'email',
        'telephone',
        'customer_first_name',
        'customer_last_name',
        'address1',
        'address2',
        'city',
        'zip_code',
        'province_name',
        'country',
        'payment_method',
        'payment_id',
        'paid_at',
        'financial_status',
        'fulfillment_status',
        'fulfillment_at',
        'shipping_method',
        'note',
      ]

      // Thêm metafield keys vào update fields
      if (metafieldKeys && metafieldKeys.length > 0) {
        const metafieldFields = metafieldKeys.map((key) => `metafield_${key}`)
        updateFields = [...updateFields, ...metafieldFields]
      }
    } else if (tableType === 'order_item') {
      updateFields = [
        'order_name',
        'item_sku',
        'item_name',
        'vendor',
        'quantity',
        'item_price',
        'item_compare_at_price',
        'item_fulfillment_status',
        'unique_key',
      ]
    } else if (tableType === 'product') {
      updateFields = [
        'product_handle',
        'product_collection',
        'variant_sku',
        'variant_barcode',
        'product_title',
        'product_description',
        'product_vendor',
        'color',
        'size',
        'variant_price',
        'variant_available_quantity',
        'variant_on_hand_quantity',
        'variant_compared_price',
        'product_status',
        'product_metafield_custom_parents_sku',
        'product_metafield_custom_pid_catalogue',
        'product_metafield_magento_product_gender',
        'product_metafield_magento_product_jda_brand_id',
        'product_metafield_magento_product_jda_dept',
        'product_metafield_magento_product_jda_discount_code',
        'product_metafield_magento_product_jda_dtype',
        'product_metafield_magento_product_jda_subdept',
        'product_metafield_magento_product_job_number',
        'product_images',
        'variant_id',
      ]
    }

    return updateFields.map((field) => `T.${field} = S.${field}`).join(', ')
  }

  private generateInsertFields(
    tableType: string,
    metafieldKeys?: string[],
  ): string {
    // Tạo danh sách các field để insert
    let insertFields: string[] = []

    if (tableType === 'order') {
      insertFields = [
        'order_id',
        'order_name',
        'created_at',
        'updated_at',
        'subtotal_before_discount',
        'subtotal_after_discount',
        'shipping_fee',
        'taxes',
        'total_before_discount',
        'total_after_discount',
        'discount_codes',
        'discount_amount',
        'refunded_amount',
        'cancelled_at',
        'email',
        'telephone',
        'customer_first_name',
        'customer_last_name',
        'address1',
        'address2',
        'city',
        'zip_code',
        'province_name',
        'country',
        'payment_method',
        'payment_id',
        'paid_at',
        'financial_status',
        'fulfillment_status',
        'fulfillment_at',
        'shipping_method',
        'note',
      ]

      // Thêm metafield keys vào insert fields
      if (metafieldKeys && metafieldKeys.length > 0) {
        const metafieldFields = metafieldKeys.map((key) => `metafield_${key}`)
        insertFields = [...insertFields, ...metafieldFields]
      }
    } else if (tableType === 'order_item') {
      insertFields = [
        'order_id',
        'order_name',
        'item_sku',
        'item_name',
        'vendor',
        'quantity',
        'item_price',
        'item_compare_at_price',
        'item_fulfillment_status',
        'unique_key',
      ]
    } else if (tableType === 'product') {
      insertFields = [
        'product_handle',
        'product_collection',
        'variant_sku',
        'variant_barcode',
        'product_title',
        'product_description',
        'product_vendor',
        'color',
        'size',
        'variant_price',
        'variant_available_quantity',
        'variant_on_hand_quantity',
        'variant_compared_price',
        'product_status',
        'product_metafield_custom_parents_sku',
        'product_metafield_custom_pid_catalogue',
        'product_metafield_magento_product_gender',
        'product_metafield_magento_product_jda_brand_id',
        'product_metafield_magento_product_jda_dept',
        'product_metafield_magento_product_jda_discount_code',
        'product_metafield_magento_product_jda_dtype',
        'product_metafield_magento_product_jda_subdept',
        'product_metafield_magento_product_job_number',
        'product_images',
        'variant_id',
        'product_id',
      ]
    }

    return insertFields.join(', ')
  }

  private generateInsertValues(
    tableType: string,
    metafieldKeys?: string[],
  ): string {
    // Tạo danh sách các giá trị tương ứng với insert fields
    let insertFields: string[] = []

    if (tableType === 'order') {
      insertFields = [
        'order_id',
        'order_name',
        'created_at',
        'updated_at',
        'subtotal_before_discount',
        'subtotal_after_discount',
        'shipping_fee',
        'taxes',
        'total_before_discount',
        'total_after_discount',
        'discount_codes',
        'discount_amount',
        'refunded_amount',
        'cancelled_at',
        'email',
        'telephone',
        'customer_first_name',
        'customer_last_name',
        'address1',
        'address2',
        'city',
        'zip_code',
        'province_name',
        'country',
        'payment_method',
        'payment_id',
        'paid_at',
        'financial_status',
        'fulfillment_status',
        'fulfillment_at',
        'shipping_method',
        'note',
      ]

      // Thêm metafield keys vào insert values
      if (metafieldKeys && metafieldKeys.length > 0) {
        const metafieldFields = metafieldKeys.map((key) => `metafield_${key}`)
        insertFields = [...insertFields, ...metafieldFields]
      }
    } else if (tableType === 'order_item') {
      insertFields = [
        'order_id',
        'order_name',
        'item_sku',
        'item_name',
        'vendor',
        'quantity',
        'item_price',
        'item_compare_at_price',
        'item_fulfillment_status',
        'unique_key',
      ]
    } else if (tableType === 'product') {
      insertFields = [
        'product_handle',
        'product_collection',
        'variant_sku',
        'variant_barcode',
        'product_title',
        'product_description',
        'product_vendor',
        'color',
        'size',
        'variant_price',
        'variant_available_quantity',
        'variant_on_hand_quantity',
        'variant_compared_price',
        'product_status',
        'product_metafield_custom_parents_sku',
        'product_metafield_custom_pid_catalogue',
        'product_metafield_magento_product_gender',
        'product_metafield_magento_product_jda_brand_id',
        'product_metafield_magento_product_jda_dept',
        'product_metafield_magento_product_jda_discount_code',
        'product_metafield_magento_product_jda_dtype',
        'product_metafield_magento_product_jda_subdept',
        'product_metafield_magento_product_job_number',
        'product_images',
        'variant_id',
        'product_id',
      ]
    }

    return insertFields.map((field) => `S.${field}`).join(', ')
  }

  public async dropStagingTable(datasetId: string, stagingTableId: string) {
    try {
      const dataset = this.bigquery.dataset(datasetId)
      const table = dataset.table(stagingTableId)
      await table.delete()
    } catch (error) {
      console.log('error dropping staging table', error)
    }
  }

  // Helper function to handle upsert for any table type
  public async upsertData(
    datasetId: string,
    tableId: string,
    stagingTableId: string,
    rows: object[],
    keyField: string,
    tableType: 'order' | 'order_item' | 'product',
    metafieldKeys?: string[],
  ) {
    try {
      // Insert data to staging table
      await this.insertToStagingTable(datasetId, stagingTableId, rows)

      // Merge from staging to main table
      await this.mergeFromStagingToMain(
        datasetId,
        tableId,
        stagingTableId,
        keyField,
        tableType,
        metafieldKeys,
      )
    } catch (error) {
      console.log('Error in upsertData', error)
      throw error
    }
  }
}
