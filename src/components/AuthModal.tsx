import React, { useState } from 'react';
import { ModalShell } from './ModalShell';
import { GoogleSignInButton } from './GoogleSignInButton';
import { AlertCircle } from 'lucide-react';

export type AuthModalView = 'login' | 'signup' | 'verify' | 'forgot';

interface AuthModalProps {
  isOpen: boolean;
  initialView?: AuthModalView;
  initialResetToken?: string;
  onClose: () => void;
  onSuccess?: () => void;
  onViewChange?: (view: AuthModalView) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title="Student Login"
    >
      <div className="p-6 sm:p-8 flex flex-col items-center text-center">
        <h3 className="text-xl font-black text-ink mb-2">Welcome to Gadwal</h3>
        <p className="text-sm text-text-secondary mb-8">
          Sign in securely using your MIU student Google account to save and generate your course schedules.
        </p>

        {error && (
          <div className="w-full max-w-sm mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 leading-relaxed font-medium">
              {error}
            </p>
          </div>
        )}

        <div className="w-full max-w-sm">
          <GoogleSignInButton
            onSuccess={() => {
              setError(null);
              onSuccess?.();
              onClose();
            }}
            onError={(msg) => setError(msg)}
            text="Continue with MIU Google Account"
          />
        </div>

        <p className="text-xs text-text-muted mt-6 max-w-xs leading-relaxed">
          By signing in, you agree to our Terms of Service and Privacy Policy.
          You must use an official Misr International University email address.
        </p>
      </div>
    </ModalShell>
  );
};

