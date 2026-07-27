"use client";

import { useState, useEffect } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { getApiUrl, getAuthHeaders } from "@/lib/api-config";
import { toast } from "sonner";

interface Client {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
}

export function ClientsTable() {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            setIsLoading(true);
            const headers = getAuthHeaders();
            const res = await fetch(getApiUrl('/clients?limit=100'), { headers });
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setClients(data.clients);
        } catch (error) {
            console.error(error);
            toast.error("Не удалось загрузить список клиентов");
        } finally {
            setIsLoading(false);
        }
    };

    const filteredClients = clients.filter(client => {
        const q = searchQuery.toLowerCase();
        return (
            client.firstName?.toLowerCase().includes(q) ||
            client.lastName?.toLowerCase().includes(q) ||
            client.phone?.includes(q) ||
            client.email?.toLowerCase().includes(q)
        );
    });

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 max-w-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Поиск клиентов..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Имя</TableHead>
                            <TableHead>Телефон</TableHead>
                            <TableHead>Email</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredClients.map((client) => (
                            <TableRow key={client.id}>
                                <TableCell className="font-medium">
                                    {client.firstName} {client.lastName}
                                </TableCell>
                                <TableCell>{client.phone}</TableCell>
                                <TableCell>{client.email || '-'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
