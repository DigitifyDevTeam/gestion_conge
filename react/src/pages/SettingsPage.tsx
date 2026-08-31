import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { listNotifications } from '@/api/notifications';
import { toast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [avatar, setAvatar] = useState('');

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: listNotifications,
  });
  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    if (!user) {
      return;
    }
    setName(user.name);
    setDepartment(user.department ?? '');
    setPosition(user.position ?? '');
    setAvatar(user.avatar ?? '');
  }, [user]);

  const getInitials = (value: string) =>
    value
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateProfile({
      name: name.trim(),
      department: department.trim(),
      position: position.trim(),
      avatar: avatar.trim(),
    });
    setSaving(false);

    if (result.ok) {
      setEditing(false);
      toast({ title: 'Profil mis à jour' });
      return;
    }

    toast({
      title: 'Erreur',
      description: result.error,
      variant: 'destructive',
    });
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="mt-1 text-muted-foreground">Gérez les préférences de votre compte</p>
      </div>

      <div
        className="rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in"
        style={{ animationDelay: '100ms' }}
      >
        <div className="mb-6 flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Profil</h2>
        </div>

        {!editing ? (
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-semibold text-foreground">{user.name}</h3>
              <p className="text-muted-foreground">{user.position || '—'}</p>
              {user.department ? (
                <p className="text-sm text-muted-foreground">{user.department}</p>
              ) : null}
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditing(true)}>
                Modifier le profil
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Nom complet</Label>
              <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-position">Poste</Label>
              <Input
                id="profile-position"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-department">Département</Label>
              <Input
                id="profile-department"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-avatar">URL de l&apos;avatar</Label>
              <Input
                id="profile-avatar"
                value={avatar}
                onChange={(event) => setAvatar(event.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  'Enregistrer'
                )}
              </Button>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setName(user.name);
                  setDepartment(user.department ?? '');
                  setPosition(user.position ?? '');
                  setAvatar(user.avatar ?? '');
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </div>

      <div
        className="rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in"
        style={{ animationDelay: '200ms' }}
      >
        <div className="mb-6 flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Notifications</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-foreground">Notifications in-app</p>
              <p className="text-sm text-muted-foreground">
                Demandes soumises, approbations, refus et activité de l&apos;équipe
              </p>
            </div>
            {unreadCount > 0 ? (
              <Badge variant="default">{unreadCount} non lu{unreadCount > 1 ? 's' : ''}</Badge>
            ) : (
              <Badge variant="secondary">À jour</Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/notifications')}>
            Voir toutes les notifications
          </Button>
        </div>
      </div>
    </div>
  );
}
