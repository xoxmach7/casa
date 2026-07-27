"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, User } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Broker {
    id: string;
    firstName: string;
    lastName: string;
}

interface Form {
    id: string;
    title: string;
    brokers: Broker[];
}

interface BrokerLinksDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    form: Form | null;
}

export function BrokerLinksDialog({ open, onOpenChange, form }: BrokerLinksDialogProps) {
    if (!form) return null;

    const copyLink = (brokerId: string) => {
        const origin = window.location.origin;
        const url = `${origin}/forms/${form.id}?brokerId=${brokerId}`;
        navigator.clipboard.writeText(url);
        toast.success("Ссылка скопирована");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Ссылки для брокеров: {form.title}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="space-y-4">
                        {form.brokers.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">
                                Нет назначенных брокеров
                            </p>
                        ) : (
                            form.brokers.map(broker => (
                                <div key={broker.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-primary/10 p-2 rounded-full">
                                            <User className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{broker.firstName} {broker.lastName}</p>
                                        </div>
                                    </div>
                                    <Button size="icon" variant="ghost" onClick={() => copyLink(broker.id)} title="Копировать ссылку">
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
