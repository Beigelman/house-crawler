import { useQuery } from '@tanstack/react-query';
import { browse, getListingDetail } from './listings.api';

export function useListings(params: URLSearchParams) {
  return useQuery({
    queryKey: ['listings', params.toString()],
    queryFn: () => browse(params),
  });
}

export function useListingDetail(url: string) {
  return useQuery({
    queryKey: ['detail', url],
    queryFn: () => getListingDetail(url),
  });
}
