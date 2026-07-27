"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { FileSignature } from "lucide-react";

interface ChecklistDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    items: string[];
    onSuccess: () => void;
}

export function ChecklistDialog({
    open,
    onOpenChange,
    title,
    items,
    onSuccess,
}: ChecklistDialogProps) {
    const [checkedState, setCheckedState] = useState<boolean[]>(
        new Array(items.length).fill(false)
    );

    const handleCheck = (index: number) => {
        const updated = [...checkedState];
        updated[index] = !updated[index];
        setCheckedState(updated);
    };

    const allChecked = checkedState.every(Boolean);

    const handleConfirm = () => {
        if (allChecked) {
            onSuccess();
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSignature className="h-5 w-5 text-indigo-600" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        Подтвердите выполнение всех условий для перехода на этот этап.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {items.map((item, idx) => (
                        <div key={idx} className="flex items-center space-x-2 border p-3 rounded bg-gray-50/50">
                            <Checkbox
                                id={`chk-${idx}`}
                                checked={checkedState[idx]}
                                onCheckedChange={() => handleCheck(idx)}
                            />
                            <label
                                htmlFor={`chk-${idx}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                                {item}
                            </label>
                        </div>
                    ))}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Отмена
                    </Button>
                    <Button onClick={handleConfirm} disabled={!allChecked} className={allChecked ? "bg-green-600 hover:bg-green-700" : ""}>
                        Подтвердить
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
