/** React Query bindings for the product endpoints. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../services/api';
import type { AnalysisResponse, AnalyzeRequest } from '../types';

export const queryKeys = {
  history: ['products', 'history'] as const,
  product: (productId: string) => ['products', productId] as const,
  meta: ['meta'] as const,
};

/** Reference data (categories, platforms) that powers the analyze form. */
export function useMeta() {
  return useQuery({
    queryKey: queryKeys.meta,
    queryFn: () => api.getMeta(),
    staleTime: Infinity,
  });
}

export function useHistory() {
  return useQuery({
    queryKey: queryKeys.history,
    queryFn: () => api.getHistory(),
  });
}

export function useProduct(productId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.product(productId ?? ''),
    queryFn: () => api.getAnalysis(productId as string),
    enabled: Boolean(productId),
  });
}

/**
 * Submits an analysis. On success the fresh report is seeded into the cache so
 * navigating to /report/:id renders instantly without a second round trip.
 */
export function useAnalyzeProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AnalyzeRequest) => api.analyzeProduct(payload),
    onSuccess: (analysis: AnalysisResponse) => {
      queryClient.setQueryData(queryKeys.product(analysis.productId), analysis);
      void queryClient.invalidateQueries({ queryKey: queryKeys.history });
    },
  });
}
