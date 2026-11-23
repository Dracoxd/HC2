import React, { useState } from 'react';
import { SignIn, SignUp } from '@clerk/react';
import centerPhoto from '../assets/images/QUINTIN.png';

const authAppearance = {
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
    spacing: '1rem',
  },
  options: {
    socialButtonsPlacement: 'top' as const,
    socialButtonsVariant: 'blockButton' as const,
  },
  elements: {
    rootBox: {
      width: '100%',
      minWidth: '0',
      maxWidth: '100%',
    },
    cardBox: {
      width: '100%',
      minWidth: '0',
      maxWidth: '100%',
      boxShadow: 'none',
    },
    card: {
      width: '100%',
      minWidth: '0',
      maxWidth: '100%',
      boxSizing: 'border-box',
      border: '0',
      borderRadius: '0',
      backgroundColor: 'transparent',
      padding: '0',
      boxShadow: 'none',
    },
    headerTitle: { color: '#17312e', textAlign: 'center' },
    headerSubtitle: { color: '#66736f' },
    formFieldLabel: { color: '#17312e' },
    formFieldHintText: { color: '#66736f' },
    formFieldErrorText: { color: '#b91c1c' },
    socialButtonsBlockButton: {
      borderColor: '#dce7e1',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      boxShadow: 'none',
    },
    socialButtonsBlockButtonText: { color: '#17312e' },
    formFieldInput: {
      borderColor: '#dce7e1',
      color: '#17312e',
      borderRadius: '8px',
    },
    phoneInputInput: { color: '#17312e' },
    dividerLine: { backgroundColor: '#dce7e1' },
    dividerText: { color: '#66736f' },
    formButtonPrimary: {
      backgroundColor: '#0f4d3c',
      borderRadius: '6px',
      boxShadow: 'none',
    },
    footerAction: { display: 'none' },
    footerActionText: { color: '#66736f' },
    footerActionLink: { color: '#0f4d3c' },
    identityPreviewText: { color: '#17312e' },
  },
};

export const AuthScreen: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);

  return (
    <main className="min-h-dvh bg-[#f8faf9] px-3 py-4 text-[#17312e] sm:flex sm:items-center sm:justify-center sm:px-4 sm:py-12">
      <section className="mx-auto w-full min-w-0 max-w-md overflow-hidden rounded-xl border border-[#dce7e1] bg-white shadow-[0_18px_50px_rgba(23,58,55,0.1)]">
        <div className="border-b border-[#dfe6e1] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={centerPhoto} alt="Quintin De Borja Health Center" className="h-10 w-10 rounded-full border border-[#dfe6e1] object-cover" />
            <div>
              <div className="text-sm font-bold text-[#17312e]">Quintin De Borja</div>
              <div className="mt-0.5 text-xs text-[#66736f]">Health Center · Pateros</div>
            </div>
          </div>
        </div>
        <div className="min-w-0 px-3 py-5 sm:px-8 sm:py-7">
          {isRegistering ? (
            <SignUp routing="hash" signInUrl="#" appearance={authAppearance} />
          ) : (
            <SignIn routing="hash" signUpUrl="#" appearance={authAppearance} />
          )}
          <div className="mt-5 border-t border-[#dce7e1] pt-4 text-center text-sm text-[#66736f]">
            {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
            <button
              type="button"
              onClick={() => setIsRegistering((registering) => !registering)}
              className="font-semibold text-[#0f4d3c] hover:text-[#2c7a5f]"
            >
              {isRegistering ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};
