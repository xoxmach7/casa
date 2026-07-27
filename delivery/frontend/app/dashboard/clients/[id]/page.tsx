'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Edit, Trash2, Mail, Phone, Calendar, FileText, Calculator, ChevronDown, ChevronUp, Building2, Home, Plus, Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { API_URL } from '@/lib/config';
import { toast } from '@/hooks/use-toast';

interface MortgageCalculation {
  id: string;
  propertyPrice: number;
  initialPayment: number;
  loanAmount: number;
  interestRate: number;
  termMonths: number;
  monthlyPayment: number;
  totalPayment: number;
  overpayment: number;
  bankName?: string;
  programName?: string;
  apartmentInfo?: string;
  createdAt: string;
}

interface LinkedProperty {
  id: string;
  title: string;
  propertyType: string;
  address: string;
  price: number;
  status: string;
  images: string[];
}

interface Client {
  id: string;
  iin: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone: string;
  email?: string;
  status: 'NEW' | 'IN_PROGRESS' | 'DEAL_CLOSED' | 'REJECTED';
  notes?: string;
  monthlyIncome?: number;
  initialPayment?: number;
  createdAt: string;
  updatedAt: string;
  broker: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  bookings: any[];
  documents: any[];
  mortgageCalculations: MortgageCalculation[];
  sellerProperties: LinkedProperty[];
  buyerProperties: LinkedProperty[];
}

interface AvailableProperty {
  id: string;
  title: string;
  address: string;
  price: number;
}

const statusLabels = {
  NEW: 'Новый',
  IN_PROGRESS: 'В работе',
  DEAL_CLOSED: 'Сделка закрыта',
  REJECTED: 'Отклонен',
};

const statusColors = {
  NEW: 'bg-blue-500',
  IN_PROGRESS: 'bg-yellow-500',
  DEAL_CLOSED: 'bg-green-500',
  REJECTED: 'bg-red-500',
};

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const fromCRM = searchParams.get('from') === 'crm';
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showCalculations, setShowCalculations] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [showProperties, setShowProperties] = useState(true);
  
  // Link property dialog
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [availableProperties, setAvailableProperties] = useState<AvailableProperty[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [linkRole, setLinkRole] = useState<'seller' | 'buyer'>('seller');
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    fetchClient();
  }, [params.id]);

  const fetchClient = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/clients/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch client');
      }

      const data = await response.json();
      setClient(data);
    } catch (error) {
      console.error('Error fetching client:', error);
      router.push('/dashboard/clients');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/clients/${params.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete client');
      }

      router.push('/dashboard/clients');
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Ошибка при удалении клиента');
    } finally {
      setDeleting(false);
    }
  };

  // Fetch available properties for linking
  const fetchAvailableProperties = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/properties?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableProperties(data.properties || []);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  // Link property to client
  const handleLinkProperty = async () => {
    if (!selectedPropertyId) {
      toast({ title: 'Выберите объект', variant: 'destructive' });
      return;
    }

    setLinking(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/clients/${params.id}/link-property`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ propertyId: selectedPropertyId, role: linkRole }),
      });

      if (response.ok) {
        toast({ title: 'Объект успешно привязан' });
        setShowLinkDialog(false);
        setSelectedPropertyId('');
        fetchClient();
      } else {
        const error = await response.json();
        toast({ title: error.error || 'Ошибка', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка привязки объекта', variant: 'destructive' });
    } finally {
      setLinking(false);
    }
  };

  // Unlink property from client
  const handleUnlinkProperty = async (propertyId: string, role: 'seller' | 'buyer') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/clients/${params.id}/unlink-property`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ propertyId, role }),
      });

      if (response.ok) {
        toast({ title: 'Объект отвязан' });
        fetchClient();
      }
    } catch (error) {
      toast({ title: 'Ошибка', variant: 'destructive' });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('ru-KZ', {
      style: 'currency',
      currency: 'KZT',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Клиент не найден</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fromCRM ? router.push('/dashboard/crm') : router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            {fromCRM && <span className="ml-2">В CRM</span>}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {client.lastName} {client.firstName} {client.middleName}
            </h1>
            <p className="text-muted-foreground">ИИН: {client.iin}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/clients/${client.id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Редактировать
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
                <AlertDialogDescription>
                  Это действие нельзя отменить. Все данные клиента, включая документы,
                  брони и расчеты будут удалены.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleting ? 'Удаление...' : 'Удалить'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Основная информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Статус</p>
              <Badge className={statusColors[client.status]}>
                {statusLabels[client.status]}
              </Badge>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Телефон
              </p>
              <p className="font-medium">{client.phone}</p>
            </div>

            {client.email && (
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </p>
                <p className="font-medium">{client.email}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Дата создания
              </p>
              <p className="font-medium">{formatDate(client.createdAt)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Финансовая информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Ежемесячный доход</p>
              <p className="font-medium text-lg">{formatCurrency(client.monthlyIncome)}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Первоначальный взнос</p>
              <p className="font-medium text-lg">{formatCurrency(client.initialPayment)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Брокер</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">ФИО</p>
              <p className="font-medium">
                {client.broker.firstName} {client.broker.lastName}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{client.broker.email}</p>
            </div>

            {client.broker.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Телефон</p>
                <p className="font-medium">{client.broker.phone}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {client.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Заметки
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Linked Properties Section */}
      <Collapsible open={showProperties} onOpenChange={setShowProperties}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Связанные объекты ({(client.sellerProperties?.length || 0) + (client.buyerProperties?.length || 0)})
                </CardTitle>
                <CardDescription>Объекты, где клиент - продавец или покупатель</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    fetchAvailableProperties();
                    setShowLinkDialog(true);
                  }}
                >
                  <Link2 className="h-4 w-4 mr-1" />
                  Привязать
                </Button>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {showProperties ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {/* Seller Properties */}
              {client.sellerProperties && client.sellerProperties.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Продаёт:</p>
                  <div className="space-y-2">
                    {client.sellerProperties.map((property) => (
                      <div 
                        key={property.id} 
                        className="flex items-center gap-3 p-3 border rounded-lg bg-orange-50/50 hover:bg-orange-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/dashboard/properties/${property.id}`)}
                      >
                        {property.images?.[0] ? (
                          <img src={property.images[0]} alt={property.title} className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                            <Home className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{property.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{property.address}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{property.status}</Badge>
                          <p className="font-semibold text-sm whitespace-nowrap">{property.price?.toLocaleString()} ₸</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlinkProperty(property.id, 'seller');
                            }}
                          >
                            <Unlink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Buyer Properties */}
              {client.buyerProperties && client.buyerProperties.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Покупает:</p>
                  <div className="space-y-2">
                    {client.buyerProperties.map((property) => (
                      <div 
                        key={property.id} 
                        className="flex items-center gap-3 p-3 border rounded-lg bg-green-50/50 hover:bg-green-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/dashboard/properties/${property.id}`)}
                      >
                        {property.images?.[0] ? (
                          <img src={property.images[0]} alt={property.title} className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                            <Home className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{property.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{property.address}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{property.status}</Badge>
                          <p className="font-semibold text-sm whitespace-nowrap">{property.price?.toLocaleString()} ₸</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlinkProperty(property.id, 'buyer');
                            }}
                          >
                            <Unlink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!client.sellerProperties || client.sellerProperties.length === 0) && 
               (!client.buyerProperties || client.buyerProperties.length === 0) && (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Нет связанных объектов. Нажмите "Привязать" чтобы добавить.
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Link Property Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Привязать объект к клиенту</DialogTitle>
            <DialogDescription>
              Выберите объект и укажите роль клиента (продавец или покупатель)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Роль клиента</Label>
              <Select value={linkRole} onValueChange={(v) => setLinkRole(v as 'seller' | 'buyer')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller">Продавец</SelectItem>
                  <SelectItem value="buyer">Покупатель</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Объект</Label>
              <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите объект" />
                </SelectTrigger>
                <SelectContent>
                  {availableProperties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.title} - {prop.address} ({prop.price?.toLocaleString()} ₸)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Отмена
            </Button>
            <Button onClick={handleLinkProperty} disabled={linking || !selectedPropertyId}>
              {linking ? 'Привязка...' : 'Привязать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bookings Section */}
      <Collapsible open={showBookings} onOpenChange={setShowBookings}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Брони ({client.bookings.length})
                </CardTitle>
                <CardDescription>Забронированные квартиры</CardDescription>
              </div>
              {client.bookings.length > 0 && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {showBookings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {client.bookings.length > 0 ? (
                <div className="space-y-3">
                  {client.bookings.map((booking: any) => (
                    <div key={booking.id} className="border rounded-lg p-3 bg-muted/50">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">Кв. {booking.apartment?.number || 'N/A'}</p>
                          <p className="text-sm text-muted-foreground">
                            {booking.apartment?.project?.name || 'ЖК не указан'}
                          </p>
                        </div>
                        <Badge variant={booking.status === 'ACTIVE' ? 'default' : 'secondary'}>
                          {booking.status === 'ACTIVE' ? 'Активна' : booking.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        До: {new Date(booking.expiresAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Нет броней</p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Mortgage Calculations Section */}
      <Collapsible open={showCalculations} onOpenChange={setShowCalculations}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Расчёты ипотеки ({client.mortgageCalculations.length})
                </CardTitle>
                <CardDescription>Сохранённые ипотечные расчёты</CardDescription>
              </div>
              {client.mortgageCalculations.length > 0 && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {showCalculations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {client.mortgageCalculations.length > 0 ? (
                <div className="space-y-4">
                  {client.mortgageCalculations.map((calc) => (
                    <div key={calc.id} className="border rounded-lg p-4 bg-muted/50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold text-lg">{calc.programName || 'Расчёт'}</p>
                          <p className="text-sm text-muted-foreground">{calc.bankName}</p>
                        </div>
                        <Badge variant="outline">
                          {calc.interestRate}%
                        </Badge>
                      </div>
                      
                      {calc.apartmentInfo && (
                        <p className="text-sm text-blue-600 mb-3">
                          📍 {calc.apartmentInfo}
                        </p>
                      )}
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Стоимость</p>
                          <p className="font-medium">{formatCurrency(Number(calc.propertyPrice))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Первый взнос</p>
                          <p className="font-medium">{formatCurrency(Number(calc.initialPayment))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Сумма кредита</p>
                          <p className="font-medium">{formatCurrency(Number(calc.loanAmount))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Срок</p>
                          <p className="font-medium">{Math.round(calc.termMonths / 12)} лет</p>
                        </div>
                        <div className="col-span-2 pt-2 border-t">
                          <p className="text-muted-foreground">Ежемесячный платёж</p>
                          <p className="font-bold text-lg text-green-600">{formatCurrency(Number(calc.monthlyPayment))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Общая сумма</p>
                          <p className="font-medium">{formatCurrency(Number(calc.totalPayment))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Переплата</p>
                          <p className="font-medium text-orange-500">{formatCurrency(Number(calc.overpayment))}</p>
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-3">
                        Создан: {new Date(calc.createdAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Нет сохранённых расчётов</p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Документы ({client.documents.length})
          </CardTitle>
          <CardDescription>Загруженные файлы клиента</CardDescription>
        </CardHeader>
        <CardContent>
          {client.documents.length > 0 ? (
            <div className="space-y-2">
              {client.documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">{doc.name}</span>
                  <Button variant="ghost" size="sm">Скачать</Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Нет загруженных документов</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
