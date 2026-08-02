import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import PropertyDetail from "./pages/PropertyDetail";
import ViewingRequest from "./pages/ViewingRequest";
import SellLanding from "./pages/SellLanding";
import AddListing from "./pages/AddListing";
import SellSuccess from "./pages/SellSuccess";
import AdminLogin from "./pages/AdminLogin";
import AdminRoute from "./components/AdminRoute";
import AdminDashboard from "./pages/AdminDashboard";
import AdminObjects from "./pages/AdminObjects";
import AdminObjectCard from "./pages/AdminObjectCard";
import AdminLeads from "./pages/AdminLeads";
import AdminAddObject from "./pages/AdminAddObject";
import AdminAddLead from "./pages/AdminAddLead";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
