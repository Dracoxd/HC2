import React from 'react';
import { SignIn } from '@clerk/react';
import centerPhoto from '../assets/images/QUINTIN.png';

const authAppearance = {
  theme: 'simple' as const,
  variables: {
    colorPrimary: '#0f4d3c',
    colorPrimaryForeground: '#ffffff',
    colorBackground: '#ffffff',
    colorForeground: '#17312e',
    colorMutedForeground: '#66736f',
    colorBorder: '#dce7e1',
    colorInput: '#ffffff',
    colorInputForeground: '#17312e',
    colorRing: '#2c7a5f',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '0.5rem',
  },
  options: {
    socialButtonsPlacement: 'top' as const,
    socialButtonsVariant: 'blockButton' as const,
  },
  elements: {
    rootBox: {
      display: 'flex',
      width: '100%',
      justifyContent: 'center',
    },
    card: {
      width: '100%',
      maxWidth: '320px',
      border: '1px solid #dce7e1',
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(23, 58, 55, 0.1)',
    },
    headerTitle: { color: '#17312e' },
    headerSubtitle: { color: '#66736f' },
    socialButtonsBlockButton: {
      borderColor: '#dce7e1',
      borderRadius: '8px',
      boxShadow: 'none',
    },
    formFieldLabel: { color: '#17312e' },
    formFieldInput: {
      borderColor: '#dce7e1',
      borderRadius: '8px',
    },
    formButtonPrimary: {
      backgroundColor: '#0f4d3c',
      borderRadius: '6px',
      boxShadow: 'none',
    },
    footerActionLink: { color: '#0f4d3c' },
  },
};

export const AuthScreen: React.FC = () => {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f8faf9] px-4 py-8 text-[#17312e]">
      <section className="mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-[#dce7e1] bg-white shadow-[0_18px_50px_rgba(23,58,55,0.1)]">
        <div className="border-b border-[#dfe6e1] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={centerPhoto} alt="Quintin De Borja Health Center" className="h-10 w-10 rounded-full border border-[#dfe6e1] object-cover" />
            <div>
              <div className="text-sm font-bold text-[#17312e]">Quintin De Borja</div>
              <div className="mt-0.5 text-xs text-[#66736f]">Health Center · Pateros</div>
            </div>
          </div>
        </div>
        <div className="px-3 py-4 sm:px-4">
          <SignIn routing="hash" appearance={authAppearance} />
        </div>
      </section>
    </main>
  );
};
