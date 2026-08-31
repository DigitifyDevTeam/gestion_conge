import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Palmtree, Lock, AlertCircle, Loader2, CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { activateAccountRequest, validateActivationTokenRequest } from '@/api/auth';
import { ApiError } from '@/api/client';

const activateSchema = z
  .object({
    password: z.string().min(8, 'Au moins 8 caractères'),
    confirmPassword: z.string().min(1, 'Confirmez le mot de passe'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

type ActivateFormData = z.infer<typeof activateSchema>;

export default function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountName, setAccountName] = useState('');

  const form = useForm<ActivateFormData>({ resolver: zodResolver(activateSchema) });

  useEffect(() => {
    const validate = async () => {
      if (!token) {
        setError('Lien d\'activation invalide ou incomplet.');
        setLoading(false);
        return;
      }
      try {
        const data = await validateActivationTokenRequest(token);
        setAccountEmail(data.email);
        setAccountName(data.name);
        setInfo('Choisissez votre mot de passe pour finaliser l\'activation.');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Lien d\'activation invalide ou expiré.');
      } finally {
        setLoading(false);
      }
    };
    validate();
  }, [token]);

  const onSubmit = async (data: ActivateFormData) => {
    setError('');
    setSubmitting(true);
    try {
      const user = await activateAccountRequest(token, data.password);
      navigate(user.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Activation impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center">
              <Palmtree className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestion de congé</h1>
            <p className="text-muted-foreground mt-2">Activation de votre compte</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 shadow-card">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Vérification du lien...</p>
            </div>
          ) : (
            <>
              {error && !accountEmail && (
                <Alert variant="destructive" className="mb-5">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {accountEmail && (
                <>
                  {info && (
                    <Alert className="mb-5 border-primary/30 bg-primary/5">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <AlertDescription className="text-foreground">{info}</AlertDescription>
                    </Alert>
                  )}

                  <div className="mb-6 rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
                    {accountName && (
                      <p className="text-sm font-medium text-foreground">{accountName}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span>{accountEmail}</span>
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive" className="mb-5">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="activate-password">Mot de passe</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="activate-password"
                          type="password"
                          placeholder="Choisissez un mot de passe"
                          className="pl-10 h-12"
                          {...form.register('password')}
                        />
                      </div>
                      {form.formState.errors.password && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="activate-confirm">Confirmer le mot de passe</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="activate-confirm"
                          type="password"
                          placeholder="Confirmez le mot de passe"
                          className="pl-10 h-12"
                          {...form.register('confirmPassword')}
                        />
                      </div>
                      {form.formState.errors.confirmPassword && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.confirmPassword.message}
                        </p>
                      )}
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
                          Activation...
                        </>
                      ) : (
                        'Activer mon compte'
                      )}
                    </Button>
                  </form>
                </>
              )}

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Déjà activé ?{' '}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => navigate('/login')}
                >
                  Se connecter
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
