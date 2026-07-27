"use client";

import { useEffect, useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api-client";
import { User } from "lucide-react";

interface Broker {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

interface BrokerFilterProps {
    value: string | undefined;
    onChange: (value: string | undefined) => void;
    className?: string;
}

export function BrokerFilter({ value, onChange, className }: BrokerFilterProps) {
    const [brokers, setBrokers] = useState<Broker[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBrokers = async () => {
            try {
                // Fetch users with BROKER role using admin endpoint
                // Note: Standard users endpoint filters by role query param
                const res = await api.get("/admin/users", {
                    params: { role: "BROKER", limit: 100 }
                });
                setBrokers(res.data.users);
            } catch (error) {
                console.error("Failed to fetch brokers:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBrokers();
    }, []);

    const handleChange = (newValue: string) => {
        if (newValue === "all") {
            onChange(undefined);
        } else {
            onChange(newValue);
        }
    };

    return (
        <Select value={value || "all"} onValueChange={handleChange}>
            <SelectTrigger className={className}>
                <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Все брокеры" />
                </div>
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Все брокеры</SelectItem>
                {brokers.map((broker) => (
                    <SelectItem key={broker.id} value={broker.id}>
                        {broker.firstName} {broker.lastName}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
