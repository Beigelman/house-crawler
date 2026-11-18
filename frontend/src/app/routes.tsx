import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ListingsPage } from '../features/listings/ListingsPage';
import { ListingDetailPage } from '../features/listings/ListingDetailPage';
import { SearchesPage } from '../features/searches/SearchesPage';
import { RunsPage } from '../features/runs/RunsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path='/' element={<DashboardPage />} />
      <Route path='/imoveis' element={<ListingsPage />} />
      <Route path='/imoveis/:encodedLink' element={<ListingDetailPage />} />
      <Route path='/buscas' element={<SearchesPage />} />
      <Route path='/execucoes' element={<RunsPage />} />
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  );
}
