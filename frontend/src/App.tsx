import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Auth, TaskMaster2010 } from './components';
import { useAuth } from './hooks/useAuth';
import './styles/globals.css';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f0f0f0] font-sans text-slate-600">
        Loading...
      </div>
    );
  }

  return isAuthenticated ? <TaskMaster2010 /> : <Auth />;
}

function App() {
  return (
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={{ 
        persister,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            // Don't persist 'lists' queries to prevent stale data flash on refresh
            // Lists are small and should always be fetched fresh
            if (query.queryKey[0] === 'lists') return false;
            return true;
          }
        }
      }}
    >
      <AppContent />
      <ReactQueryDevtools initialIsOpen={false} />
    </PersistQueryClientProvider>
  );
}

export default App;
