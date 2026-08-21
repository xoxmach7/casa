'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Filter, Plus, Trash2, List, Table2, Download, Upload, Grid3x3, LayoutGrid } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl, getAuthHeaders } from '@/lib/api-client';
import { ApartmentListView } from '@/components/crm/apartments/ApartmentListView';
import { ApartmentCardsView } from '@/components/crm/apartments/ApartmentCardsView';
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

type ViewMode = 'list' | 'table' | 'cards';

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
  // По умолчанию — шахматка: на неё ведёт кнопка «Шахматка квартир» (S6).
  const [viewMode, setViewMode] = useState<ViewMode>('table');
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

  // --- Быстрый ввод фонда: шаблон / импорт .xlsx / генератор дома («шахматка») ---
  const projectId = String(params.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genFloors, setGenFloors] = useState('9');
  const [genPerFloor, setGenPerFloor] = useState('4');
  const [genRooms, setGenRooms] = useState('1');
  const [genArea, setGenArea] = useState('40');
  const [genPrice, setGenPrice] = useState('20000000');
  const [genStartNumber, setGenStartNumber] = useState('1');
  const [genPreview, setGenPreview] = useState<
    Array<{ number: string; floor: number; rooms: number; area: number; price: number }>
  >([]);
  const [creating, setCreating] = useState(false);

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

  // 1) Скачать пустой .xlsx-шаблон фонда. Cookie уйдёт браузером автоматически.
  const handleDownloadTemplate = () => {
    window.location.href = getApiUrl('/apartments/import-template');
  };

  // 2) Загрузить заполненный .xlsx: multipart file + projectId.
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('projectId', projectId);
      const res = await fetch(getApiUrl('/apartments/import-xlsx'), {
        method: 'POST',
        body: fd,
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка импорта');
      toast({ title: 'Импорт завершён', description: data.message });
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        toast({
          title: `Ошибки в строках (${data.errors.length})`,
          description: data.errors.slice(0, 3).join('; '),
          variant: 'destructive',
        });
      }
      fetchAll();
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 3) Генератор дома: строим сквозную сетку floors × perFloor.
  const buildGrid = () => {
    const floors = Number(genFloors);
    const perFloor = Number(genPerFloor);
    const rooms = Number(genRooms);
    const area = Number(genArea);
    const price = Number(genPrice);
    const start = Number(genStartNumber) || 1;
    if (!floors || !perFloor || floors < 1 || perFloor < 1) {
      toast({
        title: 'Ошибка',
        description: 'Укажите количество этажей и квартир на этаже',
        variant: 'destructive',
      });
      return;
    }
    const grid: Array<{ number: string; floor: number; rooms: number; area: number; price: number }> = [];
    let counter = start;
    for (let f = 1; f <= floors; f++) {
      for (let p = 0; p < perFloor; p++) {
        grid.push({ number: String(counter), floor: f, rooms, area, price });
        counter++;
      }
    }
    setGenPreview(grid);
  };

  // Поячейковое редактирование превью до создания.
  const updatePreviewCell = (
    idx: number,
    field: 'number' | 'floor' | 'rooms' | 'area' | 'price',
    value: string,
  ) => {
    setGenPreview((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        if (field === 'number') return { ...row, number: value };
        return { ...row, [field]: Number(value) };
      }),
    );
  };

  const handleBulkCreate = async () => {
    if (genPreview.length === 0) return;
    setCreating(true);
    try {
      const apartments = genPreview.map((a) => ({
        number: String(a.number),
        floor: Number(a.floor),
        rooms: Number(a.rooms),
        area: Number(a.area),
        price: Number(a.price),
        status: 'AVAILABLE',
      }));
      const res = await fetch(getApiUrl('/apartments/bulk'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ projectId, apartments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка создания квартир');
      toast({ title: 'Готово', description: data.message });
      setGenOpen(false);
      setGenPreview([]);
      fetchAll();
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
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

      {canAddApartment && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 py-4">
            <span className="mr-1 text-sm font-medium text-muted-foreground">
              Быстрый ввод фонда:
            </span>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Скачать шаблон
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {importing ? 'Загрузка...' : 'Загрузить Excel'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setGenOpen(true)}>
              <Grid3x3 className="mr-2 h-4 w-4" />
              Сгенерировать дом
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleImportFile}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Фильтры
            </CardTitle>
            <div className="flex overflow-hidden rounded-md border">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : ''}`}
                title="Шахматка"
              >
                <Table2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : ''}`}
                title="Список"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 ${viewMode === 'cards' ? 'bg-primary text-primary-foreground' : ''}`}
                title="Карточки"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Select value={roomsFilter} onValueChange={setRoomsFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все комнаты</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="AVAILABLE">Доступно</SelectItem>
                <SelectItem value="RESERVED">Фиксация</SelectItem>
                <SelectItem value="SOLD">Продано</SelectItem>
              </SelectContent>
            </Select>
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
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
            {viewMode === 'list' && (
              <ApartmentListView
                apartments={filteredApartments}
                selectedId={selectedApartment?.id ?? null}
                onSelect={setSelectedApartment}
              />
            )}
            {viewMode === 'cards' && (
              <ApartmentCardsView
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

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Сгенерировать дом (шахматка)</DialogTitle>
            <DialogDescription>
              Задайте параметры дома — сетка квартир построится автоматически.
              Значения можно поправить перед созданием.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="gen-floors">Этажей</Label>
              <Input
                id="gen-floors"
                type="number"
                min={1}
                value={genFloors}
                onChange={(e) => setGenFloors(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gen-perfloor">Квартир на этаже</Label>
              <Input
                id="gen-perfloor"
                type="number"
                min={1}
                value={genPerFloor}
                onChange={(e) => setGenPerFloor(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gen-start">Начальный номер</Label>
              <Input
                id="gen-start"
                type="number"
                min={1}
                value={genStartNumber}
                onChange={(e) => setGenStartNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gen-rooms">Комнат (по умолч.)</Label>
              <Input
                id="gen-rooms"
                type="number"
                min={0}
                value={genRooms}
                onChange={(e) => setGenRooms(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gen-area">Площадь, м² (по умолч.)</Label>
              <Input
                id="gen-area"
                type="number"
                min={0}
                value={genArea}
                onChange={(e) => setGenArea(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gen-price">Цена (по умолч.)</Label>
              <Input
                id="gen-price"
                type="number"
                min={0}
                value={genPrice}
                onChange={(e) => setGenPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={buildGrid}>
              Сгенерировать сетку
            </Button>
            {genPreview.length > 0 && (
              <span className="text-sm text-muted-foreground">
                Квартир в превью: {genPreview.length}
              </span>
            )}
          </div>

          {genPreview.length > 0 && (
            <div className="max-h-72 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>№</TableHead>
                    <TableHead>Этаж</TableHead>
                    <TableHead>Комн.</TableHead>
                    <TableHead>Площадь</TableHead>
                    <TableHead>Цена</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {genPreview.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Input
                          className="h-8 w-20"
                          value={row.number}
                          onChange={(e) => updatePreviewCell(idx, 'number', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-16"
                          type="number"
                          value={row.floor}
                          onChange={(e) => updatePreviewCell(idx, 'floor', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-16"
                          type="number"
                          value={row.rooms}
                          onChange={(e) => updatePreviewCell(idx, 'rooms', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-24"
                          type="number"
                          value={row.area}
                          onChange={(e) => updatePreviewCell(idx, 'area', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-28"
                          type="number"
                          value={row.price}
                          onChange={(e) => updatePreviewCell(idx, 'price', e.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)} disabled={creating}>
              Отмена
            </Button>
            <Button onClick={handleBulkCreate} disabled={creating || genPreview.length === 0}>
              {creating ? 'Создание...' : `Создать ${genPreview.length} квартир`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
