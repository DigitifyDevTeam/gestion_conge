import { Bell, User, Shield, Palette } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      {/* Page Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Gérez les préférences de votre compte</p>
      </div>

      {/* Profile Section */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card animate-fade-in" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center gap-2 mb-6">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Profil</h2>
        </div>

        <div className="flex items-center gap-6">
          <Avatar className="w-20 h-20">
            <AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face" />
            <AvatarFallback className="text-lg">SJ</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-foreground text-lg">Sarah Johnson</h3>
            <p className="text-muted-foreground">Product Manager</p>
            <p className="text-sm text-muted-foreground">sarah.johnson@company.com</p>
            <Button variant="outline" size="sm" className="mt-3">
              Modifier le profil
            </Button>
          </div>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card animate-fade-in" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center gap-2 mb-6">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Notifications</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground">Notifications par e-mail</Label>
              <p className="text-sm text-muted-foreground">Recevoir des mises à jour par e-mail sur vos demandes</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground">Approbations de demandes</Label>
              <p className="text-sm text-muted-foreground">Être notifié lorsque votre demande est approuvée ou rejetée</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground">Mises à jour de l'équipe</Label>
              <p className="text-sm text-muted-foreground">Recevoir des mises à jour sur les congés des membres de l'équipe</p>
            </div>
            <Switch />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground">Notifications de rappel</Label>
              <p className="text-sm text-muted-foreground">Recevoir des rappels sur les congés à venir</p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card animate-fade-in" style={{ animationDelay: '300ms' }}>
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Sécurité</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground">Authentification à deux facteurs</Label>
              <p className="text-sm text-muted-foreground">Ajouter une couche supplémentaire de sécurité à votre compte</p>
            </div>
            <Button variant="outline" size="sm">Activer</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground">Changer le mot de passe</Label>
              <p className="text-sm text-muted-foreground">Mettez à jour votre mot de passe régulièrement pour la sécurité</p>
            </div>
            <Button variant="outline" size="sm">Mettre à jour</Button>
          </div>
        </div>
      </div>

      {/* Appearance Section */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card animate-fade-in" style={{ animationDelay: '400ms' }}>
        <div className="flex items-center gap-2 mb-6">
          <Palette className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Apparence</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-foreground">Mode sombre</Label>
            <p className="text-sm text-muted-foreground">Basculer entre les thèmes clair et sombre</p>
          </div>
          <Switch />
        </div>
      </div>
    </div>
  );
}
