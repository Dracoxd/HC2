import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import App from './App.tsx';
import './index.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is not configured.');
}

createRoot(document.getElementById('root')!).render(
  <ClerkProvider
    publishableKey={publishableKey}
    localization={{
      signIn: {
        start: {
          title: 'Sign in to Health Center',
          titleCombined: 'Sign in to Health Center',
        },
      },
    }}
  >
    <App />
  </ClerkProvider>,
);
