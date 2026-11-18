import { RequireOwner } from '../features/auth/RequireOwner';
import { AppLayout } from './AppLayout';
import { AppRoutes } from './routes';

export function App() {
  return (
    <RequireOwner>
      <AppLayout>
        <AppRoutes />
      </AppLayout>
    </RequireOwner>
  );
}
