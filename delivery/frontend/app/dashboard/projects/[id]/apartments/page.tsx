'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Filter, Plus, Trash2, LayoutGrid, List, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/api-config';
import { ApartmentCardsView } from '@/components/crm/apartments/ApartmentCardsView';
import { ApartmentListView } from '@/components/crm/apartments/ApartmentListView';
import { ApartmentTableView } from '@/components/crm/apartments/ApartmentTableView';
import { ApartmentDetailPanel, type ApartmentDetail } from '@/components/crm/apartments/ApartmentDetailPanel';
import { CreateFixationForm } from '@/components/crm/forms/CreateFixationForm';
import { FixationStatusCard } from '@/components/crm/FixationStatusCard';

interface Apartment extends ApartmentDetail {
  buildingId?: string | null;
  entrance?: number | null;
}

interface Project {
  id: string;
  name: string;
  city: string;
  address: string;
}

interface Building {
  id: string;
  name: string;
}

type ViewMode = 'cards' | 'list' | 'table';

export default function ApartmentsGridPage() {
  const router = useRouter();
  const params = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [apartmentToDelete, setApartmentToDelete] = useState<Apartment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [fixationFormOpen, setFixationFormOpen] = useState(false);
  const [activeFixationId, setActiveFixationId] = useState<string | null>(null);
  const { toast } = useToast();

  const user = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('user') || '{}')
    : {};
  const canAddApartment = user.role === 'DEVELOPER' || user.role === 'ADMIN';

  const [roomsFilter, setRoomsFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');

  useEffect(() => {
    fetchAll();
  }, [params.id]);

  const fetchAll = async () => {
    try {
      const token = (localStorage.getItem('user') ? '1' : null);
      const headers = { Authorization: `Bearer ${token}` };

      const [projectRes, apartmentsRes, buildingsRes] = await Promise.all([
        fetch(getApiUrl(`/projects/${params.id}`), { headers }),
        fetch(getApiUrl(`/apartments?projectId=${params.id}&limit=1000`), { headers }),
        fetch(getApiUrl(`/buildings?projectId=${params.id}`), { headers }),
      ]);

      setProject(await projectRes.json());
      const apartmentsData = await apartmentsRes.json();
      setApartments(apartmentsData.apartments);
      setBuildings(await buildingsRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredApartments = apartments.filter((apt) => {
    if (roomsFilter !== 'all' && apt.rooms !== parseInt(roomsFilter)) return false;
    if (statusFilter !== 'all' && apt.status !== statusFilter) return false;
    if (floorFilter !== 'all' && apt.floor !== parseInt(floorFilter)) return false;
    return true;
  });

  const uniqueFloors = Array.from(new Set(apartments.map((apt) => apt.floor))).sort((a, b) => a - b);

  const handleDeleteApartment = async () => {
    if (!apartmentToDelete) return;

    setDeleting(true);
    try {
      const token = (localStorage.getItem('user') ? '1' : null);
      const response = await fetch(getApiUrl(`/apartments/${apartmentToDelete.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Не удалось удалить квартиру');
      }

      toast({ title: 'Успешно', description: 'Квартира удалена' });
      if (selectedApartment?.id === apartmentToDelete.id) setSelectedApartment(null);
      fetchAll();
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
      setApartmentToDelete(null);
    }
  };

  const handleFixate = (apartment: ApartmentDetail) => {
    setSelectedApartment(apartment as Apartment);
    setActiveFixationId(null);
    setFixationFormOpen(true);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/projects/${params.id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Шахматка квартир</h1>
            {project && <p className="text-muted-foreground">{project.name} - {project.city}</p>}
          </div>
        </div>
        {canAddApartment && (
          <Button onClick={() => router.push(`/dashboard/projects/${params.id}/apartments/new`)}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить квартиру
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Фильтры
            </CardTitle>
            <div className="flex overflow-hidden rounded-md border">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 ${viewMode === 'cards' ? 'bg-primary text-primary-foreground' : ''}`}
                title="Карточки"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : ''}`}
                title="Список"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : ''}`}
                title="Шахматка"
              >
                <Table2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Select value={roomsFilter} onValueChange={setRoomsFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все комнаты</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="AVAILABLE">Доступно</SelectItem>
                <SelectItem value="RESERVED">Бронь</SelectItem>
                <SelectItem value="SOLD">Продано</SelectItem>
              </SelectContent>
            </Select>
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все этажи</SelectItem>
                {uniqueFloors.map((floor) => (
                  <SelectItem key={floor} value={floor.toString()}>{floor}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardContent className="pt-6">
            {viewMode === 'cards' && (
              <ApartmentCardsView
                apartments={filteredApartments}
                selectedId={selectedApartment?.id ?? null}
                onSelect={setSelectedApartment}
              />
            )}
            {viewMode === 'list' && (
              <ApartmentListView
                apartments={filteredApartments}
                selectedId={selectedApartment?.id ?? null}
                onSelect={setSelectedApartment}
              />
            )}
            {viewMode === 'table' && (
              <ApartmentTableView
                apartments={filteredApartments}
                buildings={buildings}
                selectedId={selectedApartment?.id ?? null}
                onSelect={setSelectedApartment}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <ApartmentDetailPanel apartment={selectedApartment} onFixate={handleFixate}>
            {canAddApartment && selectedApartment && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push(`/dashboard/projects/${params.id}/apartments/${selectedApartment.id}/edit`)}
                >
                  Редактировать
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setApartmentToDelete(selectedApartment);
                    setShowDeleteDialog(true);
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </ApartmentDetailPanel>

          {activeFixationId && <FixationStatusCard fixationId={activeFixationId} />}
        </div>
      </div>

      {project && selectedApartment && (
        <CreateFixationForm
          open={fixationFormOpen}
          onOpenChange={setFixationFormOpen}
          projectId={project.id}
          projectName={project.name}
          apartmentId={selectedApartment.id}
          apartmentNumber={selectedApartment.number}
          apartmentPrice={selectedApartment.price}
          onSuccess={(fixationId) => {
            setActiveFixationId(fixationId);
            fetchAll();
          }}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить квартиру?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены что хотите удалить квартиру №{apartmentToDelete?.number}? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteApartment} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
