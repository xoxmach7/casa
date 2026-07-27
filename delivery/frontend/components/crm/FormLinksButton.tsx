"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link as LinkIcon, Copy, Loader2 } from "lucide-react";
import api from "@/lib/api-client";
import { toast } from "sonner";

interface FormLinksButtonProps {
    userId: string;
}

interface Form {
    id: string;
    title: string;
    distributionType: string;
    brokers: { id: string }[];
}

export function FormLinksButton({ userId }: FormLinksButtonProps) {
    const [forms, setForms] = useState<Form[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (open && forms.length === 0) {
            setLoading(true);
            api.get("/forms")
                .then((res) => {
                    // Filter forms relevant to broker (MANUAL & assigned)
                    const relevant = res.data.filter((f: Form) =>
                        f.distributionType === 'MANUAL' &&
                        f.brokers.some(b => b.id === userId)
                    );
                    setForms(relevant);
                })
                .catch((err) => {
                    console.error(err);
                    toast.error("Не удалось загрузить список форм");
                })
                .finally(() => setLoading(false));
        }
    }, [open, userId, forms.length]);

    const copyLink = (formId: string) => {
        const origin = window.location.origin;
        const url = `${origin}/forms/${formId}?brokerId=${userId}`;
        navigator.clipboard.writeText(url);
        toast.success("Ссылка скопирована");
        setOpen(false);
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Ссылки на формы
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Выберите форму</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {loading ? (
                    <div className="flex justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                ) : forms.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground text-center">
                        Нет доступных форм
                    </div>
                ) : (
                    forms.map((form) => (
                        <DropdownMenuItem
                            key={form.id}
                            onClick={() => copyLink(form.id)}
                            className="justify-between cursor-pointer"
                        >
                            <span className="truncate mr-2">{form.title}</span>
                            <Copy className="h-3 w-3 opacity-50" />
                        </DropdownMenuItem>
                    ))
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
