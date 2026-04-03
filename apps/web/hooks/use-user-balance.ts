import { gameServerUrl } from '@/lib/constants';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useUserBalance(address: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    address ? `${gameServerUrl}/api/users/${address}/balance` : null,
    fetcher,
    {
      refreshInterval: 5000, // Refresh every 5s to keep demo balance updated
    }
  );

  return {
    balance: data?.balance ?? 0,
    isLoading,
    isError: error,
    mutate,
  };
}
