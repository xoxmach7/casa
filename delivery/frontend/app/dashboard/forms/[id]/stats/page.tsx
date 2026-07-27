"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getApiUrl, getAuthHeaders } from "@/lib/api-config";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface Submission {
    id: string;
    createdAt: string;
    broker: {
        firstName: string;
        lastName: string;
    };
    client?: {
        firstName: string;
        lastName: string;
        phone: string;
    };
    notes: string;
    status: string;
}

export default function FormStatsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);
    const [formTitle, setFormTitle] = useState("");
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        thisMonth: 0,
        thisWeek: 0,
    });

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            // Fetch form details
            const formsRes = await fetch(getApiUrl('/forms'), { headers: getAuthHeaders() });
            const forms = await formsRes.json();
            const form = forms.find((f: any) => f.id === id);
            if (form) setFormTitle(form.title);

            // Fetch ALL deals to find submissions from this form
            const dealsRes = await fetch(getApiUrl('/deals?limit=10000'), { headers: getAuthHeaders() });
            const dealsData = await dealsRes.json();

            // Filter deals that came from this form
            // Primary: Look for [FORM_ID: xxx] marker (reliable)
            // Fallback: Check form title in notes (for older submissions)
            const formSubmissions = dealsData.deals?.filter((deal: any) => {
                if (!deal.notes) return false;

                // Primary match: FORM_ID marker
                if (deal.notes.includes(`[FORM_ID: ${id}]`)) return true;

                // Fallback: match by form title (for older data)
                return deal.notes.includes(`Заявка с сайта (${form?.title})`);
            }) || [];

            console.log('Form ID:', id);
            console.log('Form title:', form?.title);
            console.log('Total deals:', dealsData.deals?.length);
            console.log('Filtered submissions:', formSubmissions.length);
            if (dealsData.deals?.length > 0) {
                console.log('Sample deal notes:', dealsData.deals[0]?.notes?.substring(0, 200));
            }

            setSubmissions(formSubmissions);

            // Calculate stats
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());

            setStats({
                total: formSubmissions.length,
                thisMonth: formSubmissions.filter((s: any) => new Date(s.createdAt) >= startOfMonth).length,
                thisWeek: formSubmissions.filter((s: any) => new Date(s.createdAt) >= startOfWeek).length,
            });

        } catch (error) {
            console.error('Fetch data error:', error);
            toast.error("Ошибка загрузки статистики");
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        const headers = ['Дата', 'Клиент', 'Телефон', 'Брокер', 'Метод назначения', 'Статус', 'Заметки'];
        const rows = submissions.map(s => {
            const isPersonalLink = s.notes?.includes('[PERSONAL LINK');
            const isRoundRobin = s.notes?.includes('[AUTO-DISTRIBUTED via Round Robin]');
            const assignmentMethod = isPersonalLink ? 'Персональная ссылка' : isRoundRobin ? 'Авто-распределение' : 'Вручную';

            return [
                new Date(s.createdAt).toLocaleString('ru-RU'),
                s.client ? `${s.client.firstName} ${s.client.lastName}` : 'Н/Д',
                s.client?.phone || 'Н/Д',
                `${s.broker.firstName} ${s.broker.lastName}`,
                assignmentMethod,
                s.status,
                s.notes?.replace(/\n/g, ' ') || ''
            ];
        });

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `form_${formTitle}_submissions.csv`;
        link.click();
    };

    if (loading) return <div className="p-8">Загрузка...</div>;

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/dashboard/forms">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h2 className="text-3xl font-bold tracking-tight">Статистика формы</h2>
                    <p className="text-muted-foreground">{formTitle}</p>
                </div>
                <Button onClick={exportToCSV} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Экспорт CSV
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Всего заявок
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            За этот месяц
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.thisMonth}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            За эту неделю
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.thisWeek}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Submissions Table */}
            <Card>
                <CardHeader>
                    <CardTitle>История заявок</CardTitle>
                </CardHeader>
                <CardContent>
                    {submissions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Пока нет заявок через эту форму
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Дата</TableHead>
                                    <TableHead>Клиент</TableHead>
                                    <TableHead>Телефон</TableHead>
                                    <TableHead>Брокер</TableHead>
                                    <TableHead>Метод назначения</TableHead>
                                    <TableHead>Статус</TableHead>
                                    <TableHead>Действия</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {submissions.map((submission) => {
                                    // Parse assignment method from notes
                                    const isPersonalLink = submission.notes?.includes('[PERSONAL LINK');
                                    const isRoundRobin = submission.notes?.includes('[AUTO-DISTRIBUTED via Round Robin]');
                                    const assignmentMethod = isPersonalLink
                                        ? 'Персональная ссылка'
                                        : isRoundRobin
                                            ? 'Авто-распределение'
                                            : 'Вручную';

                                    return (
                                        <TableRow key={submission.id}>
                                            <TableCell className="font-medium">
                                                {new Date(submission.createdAt).toLocaleDateString('ru-RU', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </TableCell>
                                            <TableCell>
                                                {submission.client
                                                    ? `${submission.client.firstName} ${submission.client.lastName}`
                                                    : 'Н/Д'
                                                }
                                            </TableCell>
                                            <TableCell>{submission.client?.phone || 'Н/Д'}</TableCell>
                                            <TableCell>
                                                {submission.broker.firstName} {submission.broker.lastName}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${isPersonalLink ? 'bg-purple-100 text-purple-800' :
                                                    isRoundRobin ? 'bg-blue-100 text-blue-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {assignmentMethod}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${submission.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                                    submission.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {submission.status}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Link href={`/dashboard/deals/${submission.id}`}>
                                                    <Button variant="ghost" size="sm">
                                                        Просмотр
                                                    </Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
