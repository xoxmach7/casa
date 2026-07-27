"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CrmProperty, PropertyFunnelStage } from "@/types/kanban";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Edit, Trash2, Building, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface PropertiesTableViewProps {
    properties: CrmProperty[];
    onEdit?: (property: CrmProperty) => void; // Optional if we just link
    onDelete?: (id: string) => void;
}

const STAGE_LABELS: Record<string, string> = {
    [PropertyFunnelStage.CREATED]: "Создан",
    [PropertyFunnelStage.PREPARATION]: "Подготовка",
    [PropertyFunnelStage.LEADS]: "Лиды",
    [PropertyFunnelStage.SHOWS]: "Показы",
    [PropertyFunnelStage.DEAL]: "Сделка",
    [PropertyFunnelStage.SOLD]: "Продано",
    [PropertyFunnelStage.CANCELLED]: "Отмена",
};

const STAGE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    [PropertyFunnelStage.CREATED]: "outline",
    [PropertyFunnelStage.PREPARATION]: "secondary",
    [PropertyFunnelStage.LEADS]: "default",
    [PropertyFunnelStage.SHOWS]: "default",
    [PropertyFunnelStage.DEAL]: "secondary",
    [PropertyFunnelStage.SOLD]: "default", // Greenish usually
    [PropertyFunnelStage.CANCELLED]: "destructive",
};

export function PropertiesTableView({ properties, onEdit, onDelete }: PropertiesTableViewProps) {
    const router = useRouter();

    return (
        <div className="rounded-md border bg-white">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[80px]">Фото</TableHead>
                        <TableHead>Объект</TableHead>
                        <TableHead>Адрес</TableHead>
                        <TableHead>Цена</TableHead>
                        <TableHead>Этап</TableHead>
                        <TableHead>Создан</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {properties.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                                Нет объектов
                            </TableCell>
                        </TableRow>
                    ) : (
                        properties.map((property) => (
                            <TableRow key={property.id}>
                                <TableCell>
                                    <div className="relative h-12 w-16 rounded overflow-hidden bg-muted">
                                        {property.images && property.images.length > 0 ? (
                                            <Image
                                                src={property.images[0]}
                                                alt="Property"
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                                <Building className="h-4 w-4" />
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <span>{property.residentialComplex}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {property.rooms ? `${property.rooms}-комн.` : ""} {property.area} м²
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <MapPin className="h-3 w-3" />
                                        {property.address || "Не указан"}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {new Intl.NumberFormat("ru-RU").format(Number(property.price))} ₸
                                </TableCell>
                                <TableCell>
                                    {property.customStage ? (
                                        <Badge
                                            variant="outline"
                                            style={{
                                                borderColor: property.customStage.color,
                                                color: property.customStage.color
                                            }}
                                        >
                                            {property.customStage.name}
                                        </Badge>
                                    ) : (
                                        <Badge variant={STAGE_COLORS[property.funnelStage] || "outline"}>
                                            {STAGE_LABELS[property.funnelStage] || property.funnelStage}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {property.createdAt ? format(new Date(property.createdAt), "dd MMM yyyy", { locale: ru }) : "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        {/* Edit Button - maybe open form? */}
                                        {/* For now, let's just show it but maybe link to details page if we had one? */}
                                        {/* Or trigger the same form as Kanban */}
                                        <Button variant="ghost" size="icon" onClick={() => onEdit && onEdit(property)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => onDelete && onDelete(property.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
