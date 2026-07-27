"use client";

import { SellersListView } from "@/components/crm/SellersListView";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api-client";
import { CreateSellerForm } from "@/components/crm/forms/CreateSellerForm";
import { useState } from "react";
import { Seller } from "@/types/kanban";

export default function SellersPage() {
    const [isSellerFormOpen, setIsSellerFormOpen] = useState(false);
    const [selectedSellerData, setSelectedSellerData] = useState<Seller | null>(null);

    // Fetch custom funnels to get active funnel ID
    const { data: customFunnels } = useQuery({
        queryKey: ["custom-funnels"],
        queryFn: async () => {
            const res = await api.get("/custom-funnels");
            return res.data;
        }
    });

    const activeFunnelId = customFunnels?.find((f: any) => f.isActive)?.id || customFunnels?.[0]?.id;

    const handleEdit = (seller: Seller) => {
        setSelectedSellerData(seller);
        setIsSellerFormOpen(true);
    };

    return (
        <div className="h-full flex flex-col space-y-4 p-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Клиенты</h1>
            <SellersListView
                activeFunnelId={activeFunnelId}
                onEdit={handleEdit}
            />

            <CreateSellerForm
                open={isSellerFormOpen}
                onOpenChange={(v) => {
                    setIsSellerFormOpen(v);
                    if (!v) setSelectedSellerData(null);
                }}
                activeFunnelId={activeFunnelId}
                initialData={selectedSellerData as any}
            />
        </div>
    );
}
