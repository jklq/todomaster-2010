import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '../api/client';

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading, error, isError } = useQuery({
    queryKey: ['me'],
    queryFn: auth.getMe,
    retry: false,
    staleTime: Infinity, // User data rarely changes automatically
    // Only attempt to fetch user if there's a token
    enabled: !!localStorage.getItem('token'),
    meta: {
      errorMessage: 'Failed to fetch user'
    }
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => 
      auth.login(email, password),
    onSuccess: (response) => {
      localStorage.setItem('token', response.data.accessToken);
      queryClient.setQueryData(['me'], response.data.user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: ({ email, password, displayName }: { email: string; password: string; displayName?: string }) => 
      auth.register(email, password, displayName),
    onSuccess: (response) => {
      localStorage.setItem('token', response.data.accessToken);
      queryClient.setQueryData(['me'], response.data.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: auth.logout,
    onSettled: () => {
      localStorage.removeItem('token');
      queryClient.setQueryData(['me'], null);
      queryClient.clear(); // Clear all data on logout
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    isError,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
  };
}
