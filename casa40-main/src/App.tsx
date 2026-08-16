import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AdminRoute from "./components/AdminRoute";

// Публичные страницы и админка грузятся по требованию (code-splitting),
// чтобы первый экран не тянул весь бандл сразу.
const Index = lazy(() => import("./pages/Index"));
const NewBuildings = lazy(() => import("./pages/NewBuildings"));
const NewBuildingDetail = lazy(() => import("./pages/NewBuildingDetail"));
const PropertyDetail = lazy(() => import("./pages/PropertyDetail"));
const ViewingRequest = lazy(() => import("./pages/ViewingRequest"));
const SellLanding = lazy(() => import("./pages/SellLanding"));
const AddListing = lazy(() => import("./pages/AddListing"));
const SellSuccess = lazy(() => import("./pages/SellSuccess"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminObjects = lazy(() => import("./pages/AdminObjects"));
const AdminObjectCard = lazy(() => import("./pages/AdminObjectCard"));
const AdminLeads = lazy(() => import("./pages/AdminLeads"));
const AdminAddObject = lazy(() => import("./pages/AdminAddObject"));
const AdminAddLead = lazy(() => import("./pages/AdminAddLead"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Лёгкий индикатор на время подгрузки чанка страницы.
const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/novostroyki" element={<NewBuildings />} />
            <Route path="/novostroyki/:id" element={<NewBuildingDetail />} />
            <Route path="/property/:id" element={<PropertyDetail />} />
            <Route path="/property/:id/request" element={<ViewingRequest />} />
            <Route path="/sell" element={<SellLanding />} />
            <Route path="/sell/add" element={<AddListing />} />
            <Route path="/sell/success" element={<SellSuccess />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminRoute />}>
              <Route index element={<AdminDashboard />} />
              <Route path="objects" element={<AdminObjects />} />
              <Route path="objects/new" element={<AdminAddObject />} />
              <Route path="objects/:id" element={<AdminObjectCard />} />
              <Route path="leads" element={<AdminLeads />} />
              <Route path="leads/new" element={<AdminAddLead />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
