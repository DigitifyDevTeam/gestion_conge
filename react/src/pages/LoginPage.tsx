import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Palmtree,
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { useAuth } from '@/contexts/AuthContext';
import {
  forgotPasswordRequest,
  resendCodeRequest,
  resetPasswordRequest,
} from '@/api/auth';
import { ApiError } from '@/api/client';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

type Mode = 'login' | 'verify' | 'forgot' | 'reset';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

const emailSchema = z.object({
  email: z.string().email('Email invalide'),
});

const resetSchema = z
  .object({
    password: z.string().min(8, 'Au moins 8 caractères'),
    confirmPassword: z.string().min(1, 'Confirmez le mot de passe'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

type LoginFormData = z.infer<typeof loginSchema>;
type EmailFormData = z.infer<typeof emailSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { login, verifyEmail, loginWithGoogle, isLoading } = useAuth();

  const redirectAfterAuth = () => {
    const stored = localStorage.getItem('user');
    let role: string | undefined;
    if (stored) {
      try {
        role = JSON.parse(stored).role;
      } catch {
        /* ignore */
      }
    }
    navigate(role === 'admin' ? '/admin' : '/');
  };

  const loginForm = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });
  const forgotForm = useForm<EmailFormData>({ resolver: zodResolver(emailSchema) });
  const resetForm = useForm<ResetFormData>({ resolver: zodResolver(resetSchema) });

  const goTo = (next: Mode, email = '') => {
    setMode(next);
    setError('');
    setInfo('');
    setOtpCode('');
    if (email) setPendingEmail(email);
    loginForm.reset();
    forgotForm.reset();
    resetForm.reset();
  };

  const onLogin = async (data: LoginFormData) => {
    setError('');
    const result = await login(data.email, data.password);
    if (result.ok) {
      redirectAfterAuth();
      return;
    }
    if (result.needsVerification) {
      setPendingEmail(result.email || data.email);
      setMode('verify');
      setInfo("Votre compte n'est pas encore vérifié. Entrez le code reçu par e-mail.");
      return;
    }
    setError(result.error || 'Email ou mot de passe incorrect');
  };

  const onGoogleCredential = async (idToken: string) => {
    setError('');
    setBusy(true);
    const result = await loginWithGoogle(idToken);
    setBusy(false);
    if (result.ok) {
      redirectAfterAuth();
    } else {
      setError(result.error || 'Connexion Google impossible.');
    }
  };

  const onVerify = async () => {
    setError('');
    if (otpCode.length !== 6) {
      setError('Saisissez le code à 6 chiffres.');
      return;
    }
    const result = await verifyEmail(pendingEmail, otpCode);
    if (result.ok) {
      navigate('/');
    } else {
      setError(result.error || 'Code invalide.');
    }
  };

  const onForgot = async (data: EmailFormData) => {
    setError('');
    setBusy(true);
    try {
      const res = await forgotPasswordRequest(data.email);
      setPendingEmail(data.email);
      setMode('reset');
      setInfo(res.detail);
      setOtpCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer le code.");
    } finally {
      setBusy(false);
    }
  };

  const onReset = async (data: ResetFormData) => {
    setError('');
    if (otpCode.length !== 6) {
      setError('Saisissez le code à 6 chiffres reçu par e-mail.');
      return;
    }
    setBusy(true);
    try {
      const res = await resetPasswordRequest(pendingEmail, otpCode, data.password);
      setInfo(res.detail);
      setMode('login');
      setOtpCode('');
      resetForm.reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Réinitialisation impossible.');
    } finally {
      setBusy(false);
    }
  };

  const onResend = async (purpose: 'signup' | 'reset') => {
    setError('');
    setBusy(true);
    try {
      const res = await resendCodeRequest(pendingEmail, purpose);
      setInfo(res.detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Renvoi impossible.');
    } finally {
      setBusy(false);
    }
  };

  const submitting = isLoading || busy;

  const title =
    mode === 'login'
      ? 'Se connecter à HolidayHub'
      : mode === 'verify'
        ? 'Confirmez votre e-mail'
        : mode === 'forgot'
          ? 'Mot de passe oublié'
          : 'Réinitialiser le mot de passe';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center">
              <Palmtree className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">HolidayHub</h1>
            <p className="text-muted-foreground mt-2">{title}</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 shadow-card">
          {mode !== 'login' && (
            <button
              type="button"
              onClick={() => goTo('login')}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à la connexion
            </button>
          )}

          {error && (
            <Alert variant="destructive" className="mb-5">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {info && !error && (
            <Alert className="mb-5 border-primary/30 bg-primary/5">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <AlertDescription className="text-foreground">{info}</AlertDescription>
            </Alert>
          )}

          {mode === 'login' && (
            <>
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="sr-only">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Adresse e-mail"
                      className="pl-10 h-12"
                      {...loginForm.register('email')}
                    />
                  </div>
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password" className="sr-only">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Mot de passe"
                      className="pl-10 h-12"
                      {...loginForm.register('password')}
                    />
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => goTo('forgot')}
                    className="text-sm text-primary hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>

                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full h-12 text-base"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    'Se connecter'
                  )}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground">ou</span>
                </div>
              </div>

              <GoogleSignInButton
                onCredential={onGoogleCredential}
                onError={setError}
                disabled={submitting}
              />
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Connexion Google réservée aux e-mails autorisés par un administrateur.
              </p>

              <div className="mt-6 pt-5 border-t border-border">
                <p className="text-xs text-muted-foreground mb-3">Comptes de démonstration :</p>
                <div className="space-y-2 text-xs">
                  <div className="bg-secondary/50 p-3 rounded-lg">
                    <p className="font-medium text-foreground mb-1">Admin</p>
                    <p className="text-muted-foreground">admin@company.com</p>
                    <p className="text-muted-foreground">Mot de passe: password</p>
                  </div>
                  <div className="bg-secondary/50 p-3 rounded-lg">
                    <p className="font-medium text-foreground mb-1">Employé</p>
                    <p className="text-muted-foreground">sarah.johnson@company.com</p>
                    <p className="text-muted-foreground">Mot de passe: password</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {mode === 'verify' && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground text-center">
                Entrez le code à 6 chiffres envoyé à{' '}
                <span className="font-medium text-foreground">{pendingEmail}</span>
              </p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button
                type="button"
                variant="gradient"
                className="w-full h-12 text-base"
                disabled={submitting}
                onClick={onVerify}
              >
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Vérification...</> : 'Confirmer mon compte'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Pas reçu ?{' '}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  disabled={busy}
                  onClick={() => onResend('signup')}
                >
                  Renvoyer le code
                </button>
              </p>
            </div>
          )}

          {mode === 'forgot' && (
            <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Saisissez votre e-mail. Nous vous enverrons un code pour réinitialiser votre mot de passe.
              </p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Adresse e-mail"
                  className="pl-10 h-12"
                  {...forgotForm.register('email')}
                />
              </div>
              {forgotForm.formState.errors.email && (
                <p className="text-sm text-destructive">{forgotForm.formState.errors.email.message}</p>
              )}
              <Button type="submit" variant="gradient" className="w-full h-12 text-base" disabled={submitting}>
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi...</> : 'Envoyer le code'}
              </Button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Code envoyé à <span className="font-medium text-foreground">{pendingEmail}</span>
              </p>
              <div className="flex justify-center py-1">
                <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Nouveau mot de passe"
                  className="pl-10 h-12"
                  {...resetForm.register('password')}
                />
              </div>
              {resetForm.formState.errors.password && (
                <p className="text-sm text-destructive">{resetForm.formState.errors.password.message}</p>
              )}
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Confirmer le mot de passe"
                  className="pl-10 h-12"
                  {...resetForm.register('confirmPassword')}
                />
              </div>
              {resetForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">{resetForm.formState.errors.confirmPassword.message}</p>
              )}
              <Button type="submit" variant="gradient" className="w-full h-12 text-base" disabled={submitting}>
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Mise à jour...</> : 'Changer le mot de passe'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Pas reçu ?{' '}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  disabled={busy}
                  onClick={() => onResend('reset')}
                >
                  Renvoyer le code
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
