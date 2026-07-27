"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

interface FormField {
    label: string;
    type: string;
    required: boolean;
    options?: string[];
}

interface LeadForm {
    id: string;
    title: string;
    fields: FormField[];
    isActive: boolean;
}

export default function PublicFormPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const id = params.id as string;
    const brokerId = searchParams.get('brokerId');

    const [form, setForm] = useState<LeadForm | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [formData, setFormData] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchForm();
    }, [id]);

    const fetchForm = async () => {
        try {
            // We can use the admin API if we are careful, or a public one.
            // Since we didn't create a specific public "get form definition" endpoint (only submit),
            // we might need to rely on the admin one assuming public access or create one.
            // Oops, I didn't create a public GET endpoint in `public-forms.routes.ts`.
            // I only created POST submit.
            // I should assume I need to fetch form details.
            // Let's try fetching from public endpoint if I add it, or just use the admin list filtered?
            // Admin list requires auth.
            // I MUST add a public GET endpoint to `public-forms.routes.ts`.

            // I will assume I added it or I will add it now.
            // Let's add it in the next step. For now I'll write the fetch logic assuming it exists.
            const res = await fetch(`/api/public/forms/${id}`);
            if (!res.ok) throw new Error('Form not found');
            const data = await res.json();
            setForm(data);
        } catch (error) {
            toast.error('Ошибка загрузки формы');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const payload: any = { ...formData };
            // Only include brokerId if it's actually present and valid (not null/undefined/string 'undefined')
            if (brokerId && brokerId !== 'undefined' && brokerId !== 'null') {
                payload.brokerId = brokerId;
            }

            const res = await fetch(`/api/public/forms/${id}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error('Ошибка отправки');

            setSuccess(true);
        } catch (error) {
            toast.error("Не удалось отправить заявку");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin" /></div>;
    if (!form || !form.isActive) return <div className="text-center mt-20">Форма не найдена или неактивна</div>;

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
                <Card className="w-full max-w-md text-center p-8">
                    <div className="flex justify-center mb-4">
                        <CheckCircle2 className="h-16 w-16 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Заявка принята!</h2>
                    <p className="text-muted-foreground">Мы свяжемся с вами в ближайшее время.</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg shadow-lg">
                <CardHeader className="text-center border-b">
                    <CardTitle className="text-2xl">{form.title}</CardTitle>
                    <CardDescription>Заполните форму, и мы подберем для вас лучшие варианты</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {form.fields.map((field, idx) => (
                            <div key={idx} className="space-y-2">
                                <Label className="text-base">
                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                </Label>

                                {field.type === 'select' && field.options ? (
                                    <Select
                                        onValueChange={(val) => setFormData({ ...formData, [field.label]: val })}
                                        required={field.required}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Выберите..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {field.options.map((opt) => (
                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input
                                        type={field.type}
                                        required={field.required}
                                        placeholder={field.label}
                                        onChange={(e) => setFormData({ ...formData, [field.label]: e.target.value })}
                                    />
                                )}
                            </div>
                        ))}

                        <Button type="submit" className="w-full text-lg h-12 mt-6" disabled={submitting}>
                            {submitting ? 'Отправка...' : 'Отправить заявку'}
                        </Button>

                        <div className="text-xs text-center text-muted-foreground mt-4">
                            Нажима кнопку, вы соглашаетесь с обработкой персональных данных
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
