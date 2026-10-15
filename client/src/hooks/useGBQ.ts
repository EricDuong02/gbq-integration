import { GET_LOGS, SYNC_DATA } from '@/const'
import { useApi } from '@/hooks/useApi'
import { useQuery } from '@tanstack/react-query'

const useGBQ = () => {
  const api = useApi()

  const { data, isLoading, refetch, error } = useQuery<{
    data: {
      id: number
      name: string
      trigger: string
      condition: string
      active: boolean
    }[]
  }>(
    ['data-sync'],
    () => {
      return api.get(SYNC_DATA)
    },
    {
      enabled: false,
      refetchOnWindowFocus: false,
      retry: () => {
        return false
      },
    }
  )

  const {
    data: dataLog,
    error: errorLog,
    refetch: refetchLog,
  } = useQuery<{
    data: string[]
  }>(
    ['data-logs'],
    () => {
      return api.get(GET_LOGS)
    },
    {
      enabled: false,
      refetchOnWindowFocus: false,
    }
  )

  return {
    data,
    isLoading,
    refetch,
    error,
    dataLog,
    errorLog,
    refetchLog,
  }
}

export default useGBQ
