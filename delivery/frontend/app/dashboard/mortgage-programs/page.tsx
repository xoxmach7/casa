"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DollarSign, TrendingUp, Search } from "lucide-react"
import { API_URL } from "@/lib/config"

interface MortgageProgram {
    id: string
    bankName: string
    programName: string
    interestRate: number
    minDownPayment: number
    maxTerm: number
    propertyType: string
    requirements: string
    isActive: boolean
}

export default function MortgageProgramsPage() {
    const [programs, setPrograms] = useState<MortgageProgram[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")

    useEffect(() => {
        fetchPrograms()
    }, [])

    const fetchPrograms = async () => {
        const token = localStorage.getItem("token")
        if (!token) return

        try {
            const response = await fetch(`${API_URL}/mortgage-programs`, {
                headers: { Authorization: `Bearer ${token}` },
            })

            if (response.ok) {
                const data = await response.json()
                setPrograms(data)
            }
        } catch (error) {
            console.error("Failed fetching programs:", error)
        } finally {
            setLoading(false)
        }
    }

    const filteredPrograms = programs.filter(
        (program) =>
            program.bankName.toLowerCase().includes(search.toLowerCase()) ||
            program.programName.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Ипотечные программы</h1>
                    <p className="text-muted-foreground">Каталог ипотечных продуктов банков</p>
                </div>
                <Button>Добавить программу</Button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Поиск по банку или названию..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Programs Grid */}
            {loading ? (
                <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
            ) : filteredPrograms.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center">
                        <p className="text-muted-foreground">Программы не найдены</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredPrograms.map((program) => (
                        <Card key={program.id} className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-lg">{program.bankName}</CardTitle>
                                        <CardDescription>{program.programName}</CardDescription>
                                    </div>
                                    {program.isActive ? (
                                        <Badge variant="secondary">Активна</Badge>
                                    ) : (
                                        <Badge variant="outline">Неактивна</Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Ставка</span>
                                        <div className="flex items-center gap-1">
                                            <TrendingUp className="h-4 w-4 text-green-600" />
                                            <span className="font-semibold">{program.interestRate}%</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Перв. взнос</span>
                                        <span className="font-medium">{program.minDownPayment}%</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Срок</span>
                                        <span className="font-medium">до {program.maxTerm} мес.</span>
                                    </div>
                                    <div className="pt-2">
                                        <Badge variant="outline" className="text-xs">
                                            {program.propertyType}
                                        </Badge>
                                    </div>
                                    <Button variant="outline" className="w-full" size="sm">
                                        Подробнее
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
