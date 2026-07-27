'use client';

import { useState, useEffect } from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameDay,
    isSameMonth,
    addMonths,
    subMonths,
    isToday,
    parseISO
} from 'date-fns';
import { ru } from 'date-fns/locale'; // Russian locale
import { ChevronLeft, ChevronRight, Plus, MapPin, User, Home, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/api-config';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    type: 'SHOWING' | 'MEETING' | 'CALL' | 'OTHER';
    location?: string;
    client?: { firstName: string; lastName: string };
    property?: { address: string; residentialComplex: string };
}

const EVENT_COLORS = {
    SHOWING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    MEETING: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    CALL: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
    OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
};

const EVENT_TYPES = [
    { value: 'SHOWING', label: 'Показ' },
    { value: 'MEETING', label: 'Встреча' },
    { value: 'CALL', label: 'Звонок' },
    { value: 'OTHER', label: 'Другое' },
];

export default function CalendarPage() {
    const { toast } = useToast();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isEventOpen, setIsEventOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
    const [form, setForm] = useState({
        title: '',
        description: '',
        startTime: '09:00',
        endTime: '10:00',
        type: 'SHOWING',
        location: '',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchEvents();
    }, [currentDate]);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const start = startOfMonth(currentDate).toISOString();
            const end = endOfMonth(currentDate).toISOString();

            const token = localStorage.getItem('token');
            const res = await fetch(getApiUrl(`/events?start=${start}&end=${end}`), {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to fetch events');
            const data = await res.json();
            setEvents(data);
        } catch (error) {
            console.error(error);
            toast({ title: "Ошибка", description: "Не удалось загрузить события", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // Calendar Grid Logic
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const handleToday = () => setCurrentDate(new Date());

    const openCreateModal = (date?: Date) => {
        setEditingEvent(null);
        setSelectedDate(date || new Date());
        setForm({
            title: '',
            description: '',
            startTime: '10:00',
            endTime: '11:00',
            type: 'SHOWING',
            location: ''
        });
        setIsEventOpen(true);
    };

    const openEditModal = (event: CalendarEvent, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingEvent(event);
        const start = parseISO(event.startDate);
        const end = parseISO(event.endDate);
        setSelectedDate(start);
        setForm({
            title: event.title,
            description: event.description || '',
            startTime: format(start, 'HH:mm'),
            endTime: format(end, 'HH:mm'),
            type: event.type,
            location: event.location || ''
        });
        setIsEventOpen(true);
    };

    const handleSave = async () => {
        if (!form.title || !selectedDate) return;

        setSaving(true);
        try {
            // Combine date and time
            const startDateTime = new Date(selectedDate);
            const [startH, startM] = form.startTime.split(':').map(Number);
            startDateTime.setHours(startH, startM);

            const endDateTime = new Date(selectedDate);
            const [endH, endM] = form.endTime.split(':').map(Number);
            endDateTime.setHours(endH, endM);

            const payload = {
                title: form.title,
                description: form.description,
                startDate: startDateTime.toISOString(),
                endDate: endDateTime.toISOString(),
                type: form.type,
                location: form.location,
            };

            const token = localStorage.getItem('token');
            const url = editingEvent
                ? getApiUrl(`/events/${editingEvent.id}`)
                : getApiUrl('/events');

            const method = editingEvent ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to save');

            toast({ title: "Успешно", description: "Событие сохранено" });
            setIsEventOpen(false);
            fetchEvents();
        } catch (error) {
            toast({ title: "Ошибка", description: "Не удалось сохранить событие", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editingEvent) return;
        if (!confirm('Вы уверены, что хотите удалить это событие?')) return;

        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(getApiUrl(`/events/${editingEvent.id}`), {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to delete');

            toast({ title: "Успешно", description: "Событие удалено" });
            setIsEventOpen(false);
            fetchEvents();
        } catch (error) {
            toast({ title: "Ошибка", description: "Не удалось удалить событие", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Календарь</h2>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleToday}>Сегодня</Button>
                    <div className="flex items-center rounded-md border bg-card">
                        <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="w-32 text-center font-medium capitalize">
                            {format(currentDate, 'LLLL yyyy', { locale: ru })}
                        </span>
                        <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button onClick={() => openCreateModal()}>
                        <Plus className="mr-2 h-4 w-4" />
                        Создать
                    </Button>
                </div>
            </div>

            <Card className="flex-1 min-h-[600px] flex flex-col">
                <div className="grid grid-cols-7 border-b">
                    {weekDays.map(day => (
                        <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-6">
                    {calendarDays.map((day, idx) => {
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const dayEvents = events.filter(e => isSameDay(parseISO(e.startDate), day));

                        return (
                            <div
                                key={day.toISOString()}
                                className={cn(
                                    "min-h-[100px] p-2 border-b border-r relative group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-900",
                                    !isCurrentMonth && "bg-slate-50/50 dark:bg-slate-900/20 text-muted-foreground",
                                    isToday(day) && "bg-blue-50/30 dark:bg-blue-900/10",
                                    idx % 7 === 6 && "border-r-0" // Last col no border
                                )}
                                onClick={() => openCreateModal(day)}
                            >
                                <div className={cn(
                                    "text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                                    isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"
                                )}>
                                    {format(day, 'd')}
                                </div>
                                <div className="space-y-1">
                                    {dayEvents.map(event => (
                                        <div
                                            key={event.id}
                                            onClick={(e) => openEditModal(event, e)}
                                            className={cn(
                                                "text-xs px-1.5 py-0.5 rounded border truncate cursor-pointer hover:opacity-80",
                                                EVENT_COLORS[event.type] || EVENT_COLORS.OTHER
                                            )}
                                        >
                                            <span className="font-semibold mr-1">
                                                {format(parseISO(event.startDate), 'HH:mm')}
                                            </span>
                                            {event.title}
                                        </div>
                                    ))}
                                </div>
                                {/* Plus icon on hover */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Plus className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            <Dialog open={isEventOpen} onOpenChange={setIsEventOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingEvent ? 'Редактировать событие' : 'Новое событие'}</DialogTitle>
                        <DialogDescription>
                            {selectedDate && format(selectedDate, 'd MMMM yyyy', { locale: ru })}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Название</Label>
                            <Input
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                placeholder="Например: Показ квартиры"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Тип</Label>
                                <Select
                                    value={form.type}
                                    onValueChange={v => setForm({ ...form, type: v as any })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Выберите тип" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {EVENT_TYPES.map(t => (
                                            <SelectItem key={t.value} value={t.value}>
                                                {t.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Локация</Label>
                                <Input
                                    value={form.location}
                                    onChange={e => setForm({ ...form, location: e.target.value })}
                                    placeholder="Адрес"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Начало</Label>
                                <Input
                                    type="time"
                                    value={form.startTime}
                                    onChange={e => setForm({ ...form, startTime: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Конец</Label>
                                <Input
                                    type="time"
                                    value={form.endTime}
                                    onChange={e => setForm({ ...form, endTime: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Описание</Label>
                            <Textarea
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                placeholder="Детали встречи..."
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex justify-between sm:justify-between">
                        {editingEvent ? (
                            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                                Удалить
                            </Button>
                        ) : <div></div>}
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsEventOpen(false)}>Отмена</Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? "Сохранение..." : "Сохранить"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
