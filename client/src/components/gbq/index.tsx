import useGBQ from '@/hooks/useGBQ'
import { Button, Card, Layout, Page, Text } from '@shopify/polaris'
import { useState } from 'react'

const GBQDashboard = () => {
  const { refetch, dataLog, refetchLog } = useGBQ()
  const [showLog, setShowLog] = useState(false)

  return (
    <Page narrowWidth>
      <Layout>
        <Layout.Section>
          <Card>
            <h1 className="text-3xl font-extrabold bg-clip-text bg-gradient-to-br  mb-5">
              Sync data product and order form shopify to GBQ
            </h1>
            <div style={{ margin: '10px 0' }}>
              <Button
                size="large"
                submit
                variant="primary"
                onClick={() => {
                  refetch()
                }}
              >
                {'Sync'}
              </Button>
            </div>
            <Text variant="headingXs" as="h6">
              When clicked synchronization will be carried out in the
              background. Suggest each sync time is 90 minutes apart
            </Text>

            <div style={{ margin: '10px 0' }}>
              <Button
                size="large"
                submit
                variant="primary"
                onClick={() => {
                  refetchLog()
                  setShowLog((pre) => !pre)
                }}
              >
                {!dataLog && !showLog ? 'Show Logs' : 'Hidden Log'}
              </Button>
            </div>
          </Card>
        </Layout.Section>
        {/* Show logs */}
        {dataLog && showLog && (
          <Layout.Section>
            <Card>
              {dataLog?.data?.length > 0 ? (
                dataLog.data.map((log) => (
                  <div key={log} style={{ marginBottom: '10px' }}>
                    <Text as="p">{log}</Text>

                    <hr />
                  </div>
                ))
              ) : (
                <Text as="p">No logs available.</Text>
              )}
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  )
}

export default GBQDashboard
