import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google script failed')));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google script failed'));
    document.head.appendChild(script);
  });
}

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export function GoogleSignInButton({
  onCredential,
  onError,
  disabled,
}: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || disabled) return;

    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) {
              callbackRef.current(response.credential);
            } else {
              onError?.('Jeton Google manquant.');
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        buttonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: buttonRef.current.offsetWidth || 320,
          locale: 'fr',
        });
        setReady(true);
      })
      .catch(() => {
        onError?.('Impossible de charger Google Sign-In.');
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, disabled, onError]);

  if (!clientId) {
    return (
      <p className="text-xs text-center text-muted-foreground">
        Google OAuth non configuré (VITE_GOOGLE_CLIENT_ID).
      </p>
    );
  }

  return (
    <div className="w-full flex justify-center min-h-[44px]">
      <div
        ref={buttonRef}
        className={`w-full flex justify-center ${disabled || !ready ? 'opacity-60 pointer-events-none' : ''}`}
      />
    </div>
  );
}
