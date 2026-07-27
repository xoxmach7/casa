"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { getApiUrl, getAuthHeaders } from "@/lib/api-config";
import { DealStage } from "@/components/crm/types";

export default function NewDealPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [clientName, setClientName] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [amount, setAmount] = useState("");
    const [commission, setCommission] = useState("");
    const [casaFee, setCasaFee] = useState("");
    const [objectType, setObjectType] = useState("PROPERTY");
    const [source, setSource] = useState("MANUAL");
    const [stage, setStage] = useState<DealStage>(DealStage.CONSULTATION);
    const [notes, setNotes] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName || !amount) {
            toast.error("Заполните обязательные поля (Клиент, Бюджет)");
            return;
        }

        try {
            setIsLoading(true);
            const res = await fetch(getApiUrl('/deals'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    clientName,
                    clientPhone,
                    amount: parseFloat(amount),
                    commission: parseFloat(commission) || 0,
                    casaFee: parseFloat(casaFee) || 0,
                    objectType,
                    source,
                    stage,
                    notes,
                    title: clientName
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text);
            }

            toast.success("Сделка успешно создана");
            router.push('/dashboard/crm');
        } catch (error) {
            console.error(error);
            toast.error("Ошибка создания сделки");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container max-w-2xl py-6 space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/crm">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Новая сделка</h1>
                    <p className="text-muted-foreground text-sm">Создание карточки сделки и клиента</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Информация о сделке</CardTitle>
                    <CardDescription>Заполните детали сделки и данные клиента</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Client Info */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">Клиент</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="clientName">Имя *</Label>
                                    <Input
                                        id="clientName"
                                        placeholder="Иван Иванов"
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="clientPhone">Телефон</Label>
                                    <Input
                                        id="clientPhone"
                                        placeholder="+7 (7xx) xxx-xx-xx"
                                        value={clientPhone}
                                        onChange={(e) => setClientPhone(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Financials */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">Финансы</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="amount">Бюджет (₸) *</Label>
                                    <Input
                                        id="amount"
                                        type="number"
                                        placeholder="0"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="commission">Комиссия (₸)</Label>
                                    <Input
                                        id="commission"
                                        type="number"
                                        placeholder="0"
                                        value={commission}
                                        onChange={(e) => setCommission(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="casaFee">Casa Fee (₸)</Label>
                                    <Input
                                        id="casaFee"
                                        type="number"
                                        placeholder="0"
                                        value={casaFee}
                                        onChange={(e) => setCasaFee(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Deal Details */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">Параметры</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Тип объекта</Label>
                                    <Select value={objectType} onValueChange={setObjectType}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PROPERTY">Вторичная</SelectItem>
                                            <SelectItem value="APARTMENT">Новостройка</SelectItem>
                                            <SelectItem value="BOOKING">Бронь</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Этап воронки</Label>
                                    <Select value={stage} onValueChange={(v) => setStage(v as DealStage)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={DealStage.CONSULTATION}>Консультация</SelectItem>
                                            <SelectItem value={DealStage.CONTRACT}>Договор</SelectItem>
                                            <SelectItem value={DealStage.PROMOTION}>Продвижение</SelectItem>
                                            <SelectItem value={DealStage.SHOWINGS}>Показы</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Источник</Label>
                                    <Select value={source} onValueChange={setSource}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MANUAL">Вручную</SelectItem>
                                            <SelectItem value="RECOMMENDATION">Рекомендация</SelectItem>
                                            <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                                            <SelectItem value="CALL">Звонок</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Примечание</Label>
                            <Textarea
                                id="notes"
                                placeholder="Дополнительная информация..."
                                className="min-h-[100px]"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="button" variant="outline" className="mr-2" onClick={() => router.back()}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Создать сделку
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
