'use client';
import { useQuery } from '@tanstack/react-query';
import { useMarginAccountInfoStore } from '@/store/margin-account-info-store';
import { MarginAccountService } from '@/lib/margin-utils';

export const useMarginHistory = () => {
  const marginAccountAddress = useMarginAccountInfoStore((s) => s.marginAccountAddress);

  const query = useQuery({
    queryKey: ['margin', 'history', marginAccountAddress ?? null],
    enabled: Boolean(marginAccountAddress),
    queryFn: async () => {
      if (!marginAccountAddress) return [];
      return MarginAccountService.getMarginTransactionHistory(marginAccountAddress);
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  return {
    history: query.data ?? [],
    isLoading: query.isLoading || query.isFetching,
  };
};
