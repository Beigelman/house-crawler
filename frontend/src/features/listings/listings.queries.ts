import { useQuery } from '@tanstack/react-query';
import { browse, getListingDetail } from './listings.api';

export function useListings(params: URLSearchParams) {
  return useQuery({
    queryKey: ['listings', params.toString()],
    queryFn: () => browse(params),
  });
}

export function useListingDetail(link: string) {
  return useQuery({
    queryKey: ['detail', link],
    queryFn: () => getListingDetail(link),
  });
}
