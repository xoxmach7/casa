"use client"

import { useState, useEffect } from "react"
import { Calculator, DollarSign, Percent, Calendar, Save, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

export default function MortgageCalculatorPage() {
  const [propertyPrice, setPropertyPrice] = useState<number>(25000000)
  const [initialPayment, setInitialPayment] = useState<number>(5000000)
  const [initialPaymentPercent, setInitialPaymentPercent] = useState<number>(20)
  const [loanTerm, setLoanTerm] = useState<number>(15) // years
  const [interestRate, setInterestRate] = useState<number>(14) // percent

  const [results, setResults] = useState({
    monthlyPayment: 0,
    loanAmount: 0,
    totalPayment: 0,
    overpayment: 0,
    requiredIncome: 0
  })

  useEffect(() => {
    calculateMortgage()
  }, [propertyPrice, initialPayment, loanTerm, interestRate])

  const handlePriceChange = (value: number) => {
    setPropertyPrice(value)
    setInitialPayment(Math.round(value * (initialPaymentPercent / 100)))
  }

  const handleInitialPaymentChange = (value: number) => {
    setInitialPayment(value)
    setInitialPaymentPercent(Math.round((value / propertyPrice) * 100))
  }

  const handleInitialPaymentPercentChange = (value: number) => {
    setInitialPaymentPercent(value)
    setInitialPayment(Math.round(propertyPrice * (value / 100)))
  }

  const calculateMortgage = () => {
    const loanAmount = propertyPrice - initialPayment
    const monthlyRate = interestRate / 100 / 12
    const totalMonths = loanTerm * 12

    // Formula: M = P [ i(1 + i)^n ] / [ (1 + i)^n – 1 ]
    const monthlyPayment =
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
      (Math.pow(1 + monthlyRate, totalMonths) - 1)

    const totalPayment = monthlyPayment * totalMonths
    const overpayment = totalPayment - loanAmount
    // Assuming max DTI (Debt-to-Income) is 50%
    const requiredIncome = monthlyPayment * 2

    setResults({
      monthlyPayment: Math.round(monthlyPayment),
      loanAmount: Math.round(loanAmount),
      totalPayment: Math.round(totalPayment),
      overpayment: Math.round(overpayment),
      requiredIncome: Math.round(requiredIncome)
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'KZT',
      maximumFractionDigits: 0
    }).format(value)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ипотечный калькулятор</h1>
        <p className="text-muted-foreground">
          Рассчитайте ежемесячный платеж и оцените доступность ипотеки
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calculator Inputs */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Параметры кредита</CardTitle>
              <CardDescription>Введите данные для расчета</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Property Price */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base">Стоимость недвижимости</Label>
                  <div className="relative w-40">
                    <Input
                      type="number"
                      value={propertyPrice}
                      onChange={(e) => handlePriceChange(Number(e.target.value))}
                      className="text-right pr-8 font-bold"
                    />
                    <span className="absolute right-3 top-2.5 text-muted-foreground text-sm">₸</span>
                  </div>
                </div>
                <Slider
                  value={[propertyPrice]}
                  min={5000000}
                  max={100000000}
                  step={500000}
                  onValueChange={(vals) => handlePriceChange(vals[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5 млн ₸</span>
                  <span>100 млн ₸</span>
                </div>
              </div>

              {/* Initial Payment */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base">Первоначальный взнос</Label>
                  <div className="flex gap-2">
                    <div className="relative w-24">
                      <Input
                        type="number"
                        value={initialPaymentPercent}
                        onChange={(e) => handleInitialPaymentPercentChange(Number(e.target.value))}
                        className="text-right pr-6 font-bold"
                      />
                      <span className="absolute right-3 top-2.5 text-muted-foreground text-sm">%</span>
                    </div>
                    <div className="relative w-40">
                      <Input
                        type="number"
                        value={initialPayment}
                        onChange={(e) => handleInitialPaymentChange(Number(e.target.value))}
                        className="text-right pr-8 font-bold"
                      />
                      <span className="absolute right-3 top-2.5 text-muted-foreground text-sm">₸</span>
                    </div>
                  </div>
                </div>
                <Slider
                  value={[initialPaymentPercent]}
                  min={0}
                  max={90}
                  step={5}
                  onValueChange={(vals) => handleInitialPaymentPercentChange(vals[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>90%</span>
                </div>
              </div>

              {/* Loan Term */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base">Срок кредита</Label>
                  <div className="relative w-32">
                    <Input
                      type="number"
                      value={loanTerm}
                      onChange={(e) => setLoanTerm(Number(e.target.value))}
                      className="text-right pr-10 font-bold"
                    />
                    <span className="absolute right-3 top-2.5 text-muted-foreground text-sm">лет</span>
                  </div>
                </div>
                <Slider
                  value={[loanTerm]}
                  min={1}
                  max={30}
                  step={1}
                  onValueChange={(vals) => setLoanTerm(vals[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 год</span>
                  <span>30 лет</span>
                </div>
              </div>

              {/* Interest Rate */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base">Процентная ставка</Label>
                  <div className="relative w-32">
                    <Input
                      type="number"
                      value={interestRate}
                      onChange={(e) => setInterestRate(Number(e.target.value))}
                      className="text-right pr-6 font-bold"
                    />
                    <span className="absolute right-3 top-2.5 text-muted-foreground text-sm">%</span>
                  </div>
                </div>
                <Slider
                  value={[interestRate]}
                  min={0.1}
                  max={30}
                  step={0.1}
                  onValueChange={(vals) => setInterestRate(vals[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.1%</span>
                  <span>30%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Sidebar */}
        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground border-primary">
            <CardHeader>
              <CardTitle className="text-primary-foreground">Ежемесячный платеж</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">
                {formatCurrency(results.monthlyPayment)}
              </div>
              <p className="text-primary-foreground/80 mt-2 text-sm">
                Необходимый доход: ~{formatCurrency(results.requiredIncome)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Результаты расчета</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Сумма кредита</span>
                <span className="font-semibold">{formatCurrency(results.loanAmount)}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Проценты банку</span>
                <span className="font-semibold">{formatCurrency(results.overpayment)}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Общая выплата</span>
                <span className="font-semibold">{formatCurrency(results.totalPayment)}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Срок</span>
                <span className="font-semibold">{loanTerm} лет ({loanTerm * 12} мес)</span>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button className="w-full">
                <Save className="mr-2 h-4 w-4" />
                Сохранить расчет
              </Button>
              <Button variant="outline" className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Сбросить
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
