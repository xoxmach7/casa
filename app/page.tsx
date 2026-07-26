import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { TrustSection } from "@/components/landing/TrustSection";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <TrustSection />
      <Footer />
    </main>
  );
}
