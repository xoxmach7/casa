"use client"

import { useEffect, useState, useMemo } from "react"
import {
  Calculator,
  Building2,
  Percent,
  Clock,
  BadgeDollarSign,
  Search,
  Star,
  Check,
  Plus,
  X,
  Wallet,
  UserPlus,
  Save
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { API_URL } from "@/lib/config"
import { useToast } from "@/hooks/use-toast"

interface Client {
  id: string
  firstName: string
  lastName: string
  phone: string
}

interface Apartment {
  id: string
  number: string
  floor: number
  rooms: number
  area: number
  price: number
  project?: {
    id: string
    name: string
  }
}

interface MortgageProgram {
  id: string
  name: string
  bank: string
  rate: number
  minRate?: number
  maxRate?: number
  minDownPayment: number
  maxTerm: number
  type: string
  housingTypes: string[]
  description: string
  requirements: string[]
  maxAmount?: number
}

// Маппинг данных из API в формат фронтенда
function mapApiProgram(p: any): MortgageProgram {
  const housingMap = {
    'NEW_BUILDING': ['Новостройка'],
    'SECONDARY': ['Вторичное'],
    'ALL': ['Новостройка', 'Вторичное'],
  };
  let reqs: string[] = [];
  try { reqs = JSON.parse(p.requirements); } catch { reqs = p.requirements ? p.requirements.split('\n').filter(Boolean) : []; }
  return {
    id: p.id,
    name: p.programName,
    bank: p.bankName,
    rate: Number(p.interestRate),
    minDownPayment: Number(p.minDownPayment),
    maxTerm: p.maxTerm >= 12 ? Math.round(p.maxTerm / 12) : p.maxTerm,
    type: Number(p.interestRate) <= 10 ? 'Государственная' : 'Коммерческая',
    housingTypes: housingMap[p.propertyType as keyof typeof housingMap] || ['Новостройка', 'Вторичное'],
    description: p.programName + ' — ' + p.bankName,
    requirements: reqs,
    maxAmount: p.maxAmount ? Number(p.maxAmount) : undefined,
  };
}

export default function MortgagePage() {
  // Filter states
  const [bankFilter, setBankFilter] = useState("ALL")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [housingFilter, setHousingFilter] = useState("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  
  // Calculator states
  const [propertyPrice, setPropertyPrice] = useState(35000000)
  const [downPayment, setDownPayment] = useState(20)
  const [term, setTerm] = useState(20)
  const [selectedRate, setSelectedRate] = useState(7)
  
  // Compare states
  const [mortgagePrograms, setMortgagePrograms] = useState<MortgageProgram[]>([])
  const [programsLoading, setProgramsLoading] = useState(true)
  const [compareList, setCompareList] = useState<string[]>([])
  
  // Save to client states
  const [clients, setClients] = useState<Client[]>([])
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [selectedApartmentId, setSelectedApartmentId] = useState<string>("")
  const [savingCalculation, setSavingCalculation] = useState(false)
  const { toast } = useToast()

  // Fetch clients and apartments
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token")

        // Загружаем ипотечные программы из БД
        try {
          const progRes = await fetch(`${API_URL}/mortgage-programs`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (progRes.ok) {
            const progData = await progRes.json()
            const mapped = (Array.isArray(progData) ? progData : []).filter(p => p.isActive !== false).map(mapApiProgram)
            if (mapped.length > 0) setMortgagePrograms(mapped)
          }
        } catch (e) { console.error("Failed to fetch mortgage programs:", e) }
        setProgramsLoading(false)

        // Fetch clients
        const clientsResponse = await fetch(`${API_URL}/clients?limit=100`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (clientsResponse.ok) {
          const data = await clientsResponse.json()
          setClients(data.clients || [])
        }
        
        // Fetch available apartments
        const apartmentsResponse = await fetch(`${API_URL}/apartments?status=AVAILABLE&limit=100`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (apartmentsResponse.ok) {
          const data = await apartmentsResponse.json()
          setApartments(data.apartments || data || [])
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
      }
    }
    fetchData()
  }, [])

  // Save calculation to client
  const saveCalculationToClient = async () => {
    if (!selectedClientId) {
      toast({
        title: "Выберите клиента",
        description: "Необходимо выбрать клиента для сохранения расчёта",
        variant: "destructive"
      })
      return
    }

    setSavingCalculation(true)
    try {
      const token = localStorage.getItem("token")
      const program = mortgagePrograms.find(p => p.rate === selectedRate)
      const hasApartment = selectedApartmentId && selectedApartmentId !== "none"
      const apartment = hasApartment ? apartments.find(a => a.id === selectedApartmentId) : null
      
      const calculationData = {
        clientId: selectedClientId,
        apartmentId: hasApartment ? selectedApartmentId : undefined,
        propertyPrice: apartment ? Number(apartment.price) : propertyPrice,
        initialPayment: (apartment ? Number(apartment.price) : propertyPrice) * downPayment / 100,
        loanAmount: calculation.principal,
        interestRate: selectedRate,
        termMonths: term * 12,
        monthlyPayment: calculation.monthlyPayment,
        totalPayment: calculation.totalAmount,
        overpayment: calculation.overpayment,
        bankName: program?.bank || "Индивидуальный расчёт",
        programName: program?.name || `Ставка ${selectedRate}%`,
        apartmentInfo: apartment ? `${apartment.project?.name || 'ЖК'}, кв. ${apartment.number}, ${apartment.rooms}-комн, ${apartment.area} м²` : undefined
      }
      
      const response = await fetch(`${API_URL}/mortgage/calculate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(calculationData)
      })

      if (response.ok) {
        const client = clients.find(c => c.id === selectedClientId)
        toast({
          title: "Расчёт сохранён",
          description: `Ипотечный расчёт сохранён в карточку клиента ${client?.firstName} ${client?.lastName}${apartment ? ` для кв. ${apartment.number}` : ''}`
        })
        setShowSaveDialog(false)
        setSelectedClientId("")
        setSelectedApartmentId("")
      } else {
        throw new Error("Failed to save")
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить расчёт",
        variant: "destructive"
      })
    } finally {
      setSavingCalculation(false)
    }
  }

  const banks = [...new Set(mortgagePrograms.map(p => p.bank))]
  const types = [...new Set(mortgagePrograms.map(p => p.type))]

  // Filtered programs
  const filteredPrograms = useMemo(() => {
    return mortgagePrograms.filter(program => {
      if (bankFilter !== "ALL" && program.bank !== bankFilter) return false
      if (typeFilter !== "ALL" && program.type !== typeFilter) return false
      if (housingFilter !== "ALL" && !program.housingTypes.includes(housingFilter)) return false
      if (searchQuery && !program.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !program.bank.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [bankFilter, typeFilter, housingFilter, searchQuery, mortgagePrograms])

  // Calculator logic
  const calculateMortgage = () => {
    const principal = propertyPrice - (propertyPrice * downPayment / 100)
    const monthlyRate = selectedRate / 100 / 12
    const totalPayments = term * 12
    
    const monthlyPayment = principal * 
      (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / 
      (Math.pow(1 + monthlyRate, totalPayments) - 1)
    
    const totalAmount = monthlyPayment * totalPayments
    const overpayment = totalAmount - principal

    return {
      monthlyPayment: Math.round(monthlyPayment),
      totalAmount: Math.round(totalAmount),
      overpayment: Math.round(overpayment),
      principal: Math.round(principal)
    }
  }

  const calculation = calculateMortgage()

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-RU").format(price)
  }

  const toggleCompare = (id: string) => {
    if (compareList.includes(id)) {
      setCompareList(compareList.filter(i => i !== id))
    } else if (compareList.length < 3) {
      setCompareList([...compareList, id])
    }
  }

  const comparedPrograms = mortgagePrograms.filter(p => compareList.includes(p.id))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ипотека</h1>
          <p className="text-muted-foreground">
            Каталог ипотечных программ и калькулятор
          </p>
        </div>
        {compareList.length > 0 && (
          <Badge variant="outline" className="text-lg px-4 py-2">
            Сравнение: {compareList.length}/3
          </Badge>
        )}
      </div>

      <Tabs defaultValue="catalog" className="space-y-6">
        <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-3 gap-1">
          <TabsTrigger value="catalog">Каталог программ</TabsTrigger>
          <TabsTrigger value="calculator">Калькулятор</TabsTrigger>
          <TabsTrigger value="compare" disabled={compareList.length < 2}>
            Сравнение {compareList.length > 0 && `(${compareList.length})`}
          </TabsTrigger>
        </TabsList>

        {/* Catalog Tab */}
        <TabsContent value="catalog" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Поиск программ..." 
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <Select value={bankFilter} onValueChange={setBankFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Банк" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Все банки</SelectItem>
                    {banks.map(bank => (
                      <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Тип программы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Все типы</SelectItem>
                    {types.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={housingFilter} onValueChange={setHousingFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Тип жилья" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Любое жилье</SelectItem>
                    <SelectItem value="Новостройка">Новостройка</SelectItem>
                    <SelectItem value="Вторичное">Вторичное</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Programs Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPrograms.map(program => (
              <Card key={program.id} className={`relative ${compareList.includes(program.id) ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{program.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <Building2 className="h-3 w-3" />
                        {program.bank}
                      </CardDescription>
                    </div>
                    <Badge className={program.type === "Государственная" ? "bg-[#2E7D5E]" : "bg-[#D4A843]"}>
                      {program.rate}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{program.description}</p>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      <span>от {program.minDownPayment}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>до {program.maxTerm} лет</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {program.housingTypes.map(type => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => {
                      setSelectedRate(program.rate)
                      setDownPayment(program.minDownPayment)
                      setTerm(program.maxTerm)
                    }}
                  >
                    <Calculator className="mr-2 h-3 w-3" />
                    Расчёт
                  </Button>
                  <Button 
                    variant={compareList.includes(program.id) ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => toggleCompare(program.id)}
                    disabled={compareList.length >= 3 && !compareList.includes(program.id)}
                  >
                    {compareList.includes(program.id) ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {filteredPrograms.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Программы не найдены
            </div>
          )}
        </TabsContent>

        {/* Calculator Tab */}
        <TabsContent value="calculator" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Calculator Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Калькулятор ипотеки
                </CardTitle>
                <CardDescription>
                  Рассчитайте ежемесячный платёж и переплату
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Стоимость недвижимости</Label>
                    <span className="text-sm font-medium">{formatPrice(propertyPrice)} ₸</span>
                  </div>
                  <Slider
                    value={[propertyPrice]}
                    onValueChange={([v]) => setPropertyPrice(v)}
                    min={5000000}
                    max={300000000}
                    step={1000000}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>5 млн</span>
                    <span>300 млн</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Первоначальный взнос</Label>
                    <span className="text-sm font-medium">{downPayment}% ({formatPrice(propertyPrice * downPayment / 100)} ₸)</span>
                  </div>
                  <Slider
                    value={[downPayment]}
                    onValueChange={([v]) => setDownPayment(v)}
                    min={0}
                    max={90}
                    step={5}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>90%</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Срок кредита</Label>
                    <span className="text-sm font-medium">{term} лет</span>
                  </div>
                  <Slider
                    value={[term]}
                    onValueChange={([v]) => setTerm(v)}
                    min={1}
                    max={30}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 год</span>
                    <span>30 лет</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Процентная ставка</Label>
                    <span className="text-sm font-medium">{selectedRate}%</span>
                  </div>
                  <Slider
                    value={[selectedRate]}
                    onValueChange={([v]) => setSelectedRate(v)}
                    min={2}
                    max={25}
                    step={0.1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>2%</span>
                    <span>25%</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Label className="text-muted-foreground text-xs">Быстрый выбор программы</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {mortgagePrograms.slice(0, 4).map(p => (
                      <Button
                        key={p.id}
                        variant={selectedRate === p.rate ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedRate(p.rate)
                          setDownPayment(p.minDownPayment)
                          setTerm(Math.min(term, p.maxTerm))
                        }}
                      >
                        {p.name} ({p.rate}%)
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Result Card */}
            <div className="space-y-4">
              <Card className="bg-primary text-primary-foreground">
                <CardHeader>
                  <CardTitle>Ежемесячный платёж</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">
                    {formatPrice(calculation.monthlyPayment)} ₸
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Сумма кредита</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatPrice(calculation.principal)} ₸</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Переплата</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-500">{formatPrice(calculation.overpayment)} ₸</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Общая сумма выплат</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatPrice(calculation.totalAmount)} ₸</div>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => setShowSaveDialog(true)}>
                  <Save className="h-4 w-4 mr-2" />
                  Сохранить расчёт клиенту
                </Button>
              </div>
            </div>
          </div>
          
          {/* Save to Client Dialog */}
          <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Сохранить расчёт клиенту</DialogTitle>
                <DialogDescription>
                  Выберите клиента и привяжите расчёт к квартире
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Calculation Summary */}
                <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Программа:</span>
                    <span className="font-medium">{mortgagePrograms.find(p => p.rate === selectedRate)?.name || `${selectedRate}%`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Сумма кредита:</span>
                    <span className="font-medium">{formatPrice(calculation.principal)} ₸</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ежемесячный платёж:</span>
                    <span className="font-medium">{formatPrice(calculation.monthlyPayment)} ₸</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Срок:</span>
                    <span className="font-medium">{term} лет</span>
                  </div>
                </div>

                {/* Client Selection */}
                <div className="space-y-2">
                  <Label>Выберите клиента *</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите клиента..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.length > 0 ? (
                        clients.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.firstName} {client.lastName} - {client.phone}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          Нет доступных клиентов
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Apartment Selection (optional) */}
                <div className="space-y-2">
                  <Label>Привязать к квартире (опционально)</Label>
                  <Select value={selectedApartmentId} onValueChange={(value) => {
                    setSelectedApartmentId(value)
                    // Update property price when apartment is selected
                    const apt = apartments.find(a => a.id === value)
                    if (apt) {
                      setPropertyPrice(apt.price)
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите квартиру..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без привязки к квартире</SelectItem>
                      {apartments.length > 0 && (
                        apartments.map(apt => (
                          <SelectItem key={apt.id} value={apt.id}>
                            {apt.project?.name || 'ЖК'} - кв. {apt.number}, {apt.rooms}-комн, {apt.area} м², {formatPrice(apt.price)} ₸
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                  Отмена
                </Button>
                <Button 
                  onClick={saveCalculationToClient} 
                  disabled={savingCalculation || !selectedClientId}
                >
                  {savingCalculation ? "Сохранение..." : "Сохранить"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Compare Tab */}
        <TabsContent value="compare" className="space-y-6">
          {compareList.length >= 2 ? (
            <>
              {/* Visual Comparison Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                {comparedPrograms.map((p, idx) => {
                  const payment = propertyPrice * (1 - downPayment/100) * 
                    (p.rate/100/12 * Math.pow(1 + p.rate/100/12, term*12)) / 
                    (Math.pow(1 + p.rate/100/12, term*12) - 1)
                  const principal = propertyPrice * (1 - downPayment/100)
                  const totalPayment = payment * term * 12
                  const overpayment = totalPayment - principal
                  
                  // Определяем лучшие значения
                  const lowestRate = Math.min(...comparedPrograms.map(prog => prog.rate))
                  const lowestOverpayment = Math.min(...comparedPrograms.map(prog => {
                    const pay = propertyPrice * (1 - downPayment/100) * 
                      (prog.rate/100/12 * Math.pow(1 + prog.rate/100/12, term*12)) / 
                      (Math.pow(1 + prog.rate/100/12, term*12) - 1)
                    return pay * term * 12 - propertyPrice * (1 - downPayment/100)
                  }))
                  
                  const isLowestRate = p.rate === lowestRate
                  const isLowestOverpayment = Math.abs(overpayment - lowestOverpayment) < 1000
                  
                  return (
                    <Card 
                      key={p.id} 
                      className={`relative overflow-hidden ${isLowestRate ? 'ring-2 ring-[#2E7D5E] bg-[#2E7D5E]/5' : ''}`}
                    >
                      {isLowestRate && (
                        <div className="absolute top-0 right-0 px-3 py-1 bg-[#2E7D5E] text-white text-xs font-medium rounded-bl-lg">
                          🏆 Лучшая ставка
                        </div>
                      )}
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{p.name}</CardTitle>
                            <CardDescription>{p.bank}</CardDescription>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleCompare(p.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Rate */}
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <div className={`text-4xl font-bold ${isLowestRate ? 'text-[#2E7D5E]' : ''}`}>
                            {p.rate}%
                          </div>
                          <div className="text-sm text-muted-foreground">годовая ставка</div>
                        </div>
                        
                        {/* Monthly Payment */}
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Ежемесячный платёж</span>
                          <span className="font-bold text-lg">{formatPrice(Math.round(payment))} ₸</span>
                        </div>
                        
                        {/* Overpayment */}
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Переплата</span>
                          <span className={`font-bold ${isLowestOverpayment ? 'text-[#2E7D5E]' : 'text-[#D4A843]'}`}>
                            {formatPrice(Math.round(overpayment))} ₸
                          </span>
                        </div>
                        
                        {/* Total */}
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-muted-foreground">Всего выплат</span>
                          <span className="font-bold">{formatPrice(Math.round(totalPayment))} ₸</span>
                        </div>
                        
                        {/* Overpayment Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Переплата</span>
                            <span>{Math.round(overpayment / totalPayment * 100)}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${isLowestOverpayment ? 'bg-[#2E7D5E]' : 'bg-[#D4A843]'}`}
                              style={{ width: `${Math.min(overpayment / totalPayment * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Detailed Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Детальное сравнение</CardTitle>
                  <CardDescription>
                    При стоимости {formatPrice(propertyPrice)} ₸, взносе {downPayment}%, сроке {term} лет
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Параметр</TableHead>
                        {comparedPrograms.map(p => (
                          <TableHead key={p.id}>
                            <div className="flex items-center gap-2">
                              {p.rate === Math.min(...comparedPrograms.map(pr => pr.rate)) && (
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              )}
                              <span>{p.name}</span>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Банк</TableCell>
                        {comparedPrograms.map(p => (
                          <TableCell key={p.id}>{p.bank}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Ставка</TableCell>
                        {comparedPrograms.map(p => {
                          const isLowest = p.rate === Math.min(...comparedPrograms.map(pr => pr.rate))
                          return (
                            <TableCell key={p.id}>
                              <Badge className={isLowest ? "bg-[#2E7D5E]" : "bg-[#D4A843]"}>
                                {p.rate}%
                              </Badge>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Первоначальный взнос</TableCell>
                        {comparedPrograms.map(p => (
                          <TableCell key={p.id}>от {p.minDownPayment}%</TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Максимальный срок</TableCell>
                        {comparedPrograms.map(p => (
                          <TableCell key={p.id}>до {p.maxTerm} лет</TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Тип программы</TableCell>
                        {comparedPrograms.map(p => (
                          <TableCell key={p.id}>
                            <Badge variant={p.type === "Государственная" ? "default" : "secondary"}>
                              {p.type}
                            </Badge>
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Тип жилья</TableCell>
                        {comparedPrograms.map(p => (
                          <TableCell key={p.id}>{p.housingTypes.join(", ")}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Требования</TableCell>
                        {comparedPrograms.map(p => (
                          <TableCell key={p.id}>
                            <ul className="text-xs space-y-1">
                              {p.requirements.map((req, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <Check className="h-3 w-3 text-[#2E7D5E] mt-0.5 flex-shrink-0" />
                                  {req}
                                </li>
                              ))}
                            </ul>
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow className="bg-muted/50">
                        <TableCell className="font-medium">Ежемесячный платёж</TableCell>
                        {comparedPrograms.map(p => {
                          const payment = propertyPrice * (1 - downPayment/100) * 
                            (p.rate/100/12 * Math.pow(1 + p.rate/100/12, term*12)) / 
                            (Math.pow(1 + p.rate/100/12, term*12) - 1)
                          const allPayments = comparedPrograms.map(prog => {
                            return propertyPrice * (1 - downPayment/100) * 
                              (prog.rate/100/12 * Math.pow(1 + prog.rate/100/12, term*12)) / 
                              (Math.pow(1 + prog.rate/100/12, term*12) - 1)
                          })
                          const isLowest = Math.abs(payment - Math.min(...allPayments)) < 100
                          return (
                            <TableCell key={p.id} className={`font-bold ${isLowest ? 'text-[#2E7D5E]' : ''}`}>
                              {formatPrice(Math.round(payment))} ₸
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow className="bg-muted/50">
                        <TableCell className="font-medium">Переплата</TableCell>
                        {comparedPrograms.map(p => {
                          const payment = propertyPrice * (1 - downPayment/100) * 
                            (p.rate/100/12 * Math.pow(1 + p.rate/100/12, term*12)) / 
                            (Math.pow(1 + p.rate/100/12, term*12) - 1)
                          const principal = propertyPrice * (1 - downPayment/100)
                          const overpayment = payment * term * 12 - principal
                          const allOverpayments = comparedPrograms.map(prog => {
                            const pay = propertyPrice * (1 - downPayment/100) * 
                              (prog.rate/100/12 * Math.pow(1 + prog.rate/100/12, term*12)) / 
                              (Math.pow(1 + prog.rate/100/12, term*12) - 1)
                            return pay * term * 12 - propertyPrice * (1 - downPayment/100)
                          })
                          const isLowest = Math.abs(overpayment - Math.min(...allOverpayments)) < 1000
                          return (
                            <TableCell key={p.id} className={`font-bold ${isLowest ? 'text-[#2E7D5E]' : 'text-[#D4A843]'}`}>
                              {formatPrice(Math.round(overpayment))} ₸
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Выберите минимум 2 программы для сравнения
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
