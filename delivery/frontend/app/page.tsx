import LandingHeader from '@/components/landing/Header';
import Hero from '@/components/landing/Hero';
import About from '@/components/landing/About';
import Features from '@/components/landing/Features';
import HowItWorks from '@/components/landing/HowItWorks';
import WhyUs from '@/components/landing/WhyUs';
import ContactSection from '@/components/landing/ContactSection';
import Footer from '@/components/landing/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <Hero />
      <About />
      <Features />
      <HowItWorks />
      <WhyUs />
      <ContactSection />
      <Footer />
    </div>
  );
}
