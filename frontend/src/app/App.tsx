import { RequireSession } from '../features/auth/RequireSession';
import { AppLayout } from './AppLayout';
import { AppRoutes } from './routes';

export function App() {
  return (
    <RequireSession>
      <AppLayout>
        <AppRoutes />
      </AppLayout>
    </RequireSession>
  );
}
