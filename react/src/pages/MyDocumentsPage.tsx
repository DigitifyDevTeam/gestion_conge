import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  Eye,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  downloadEmployeeDocument,
  listEmployeeDocuments,
} from '@/api/employeeDocuments';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  DocumentCategory,
  EmployeeDocument,
} from '@/types/document';
import { cn } from '@/lib/utils';

function categoryIcon(category: DocumentCategory) {
  switch (category) {
    case 'payslip':
      return FileSpreadsheet;
    case 'contract':
      return FileText;
    case 'certificate':
      return FileArchive;
    case 'other':
      return FolderOpen;
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
}

function categoryTone(category: DocumentCategory): string {
  switch (category) {
    case 'payslip':
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
    case 'contract':
      return 'bg-sky-500/10 text-sky-700 border-sky-500/20';
    case 'certificate':
      return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    case 'other':
      return 'bg-muted text-muted-foreground border-border';
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
}

export default function MyDocumentsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<DocumentCategory | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['employee-documents', 'mine'],
    queryFn: () => listEmployeeDocuments(),
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (category !== 'all' && doc.category !== category) return false;
      if (!needle) return true;
      return (
        doc.title.toLowerCase().includes(needle)
        || doc.description.toLowerCase().includes(needle)
        || doc.fileName.toLowerCase().includes(needle)
        || doc.categoryLabel.toLowerCase().includes(needle)
      );
    });
  }, [documents, search, category]);

  async function handleAction(doc: EmployeeDocument, inline: boolean) {
    setBusyId(doc.id);
    try {
      await downloadEmployeeDocument(doc, { inline });
    } catch (err) {
      toast({
        title: inline ? 'Ouverture impossible' : 'Téléchargement impossible',
        description: err instanceof Error ? err.message : 'Une erreur est survenue.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Mes documents
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consultez et téléchargez vos documents RH (fiches de paie, contrats, attestations…).
          Seuls vos fichiers vous sont visibles.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un document…"
            className="pl-9"
          />
        </div>
        <Select
          value={category}
          onValueChange={(value) => setCategory(value as DocumentCategory | 'all')}
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {DOCUMENT_CATEGORIES.map((value) => (
              <SelectItem key={value} value={value}>
                {DOCUMENT_CATEGORY_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Chargement des documents…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">Aucun document</p>
          <p className="text-sm text-muted-foreground mt-1">
            {documents.length === 0
              ? 'Votre espace est vide pour le moment. Les fichiers déposés par l’administration apparaîtront ici.'
              : 'Aucun résultat pour ces filtres.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((doc) => {
            const Icon = categoryIcon(doc.category);
            const busy = busyId === doc.id;
            return (
              <article
                key={doc.id}
                className="group rounded-xl border border-border bg-card p-4 flex flex-col gap-3 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0',
                      categoryTone(doc.category),
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-medium text-foreground truncate">{doc.title}</h2>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {doc.fileName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn('font-normal', categoryTone(doc.category))}>
                    {doc.categoryLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(doc.createdAt, 'd MMM yyyy', { locale: fr })}
                  </span>
                </div>

                {doc.description ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {doc.description}
                  </p>
                ) : null}

                <div className="mt-auto flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={busy}
                    onClick={() => handleAction(doc, true)}
                  >
                    <Eye className="w-4 h-4 mr-1.5" />
                    Voir
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={busy}
                    onClick={() => handleAction(doc, false)}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Télécharger
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
