import LandingHeader from '@/components/landing/Header';
import Hero from '@/components/landing/Hero';
import About from '@/components/landing/About';
import Features from '@/components/landing/Features';
import HowItWorks from '@/components/landing/HowItWorks';
import WhyUs from '@/components/landing/WhyUs';
import ContactSection from '@/components/landing/ContactSection';
import Footer from '@/components/landing/Footer';

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://pro.casa.kz/#organization",
      name: "CASA",
      url: "https://pro.casa.kz/",
      logo: "https://pro.casa.kz/og-image.jpg",
      areaServed: { "@type": "Country", name: "Казахстан" },
    },
    {
      "@type": "SoftwareApplication",
      name: "CASA Pro",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "CRM для агентств недвижимости и застройщиков Казахстана: клиенты, сделки, новостройки, шахматки квартир и ипотека в одной системе.",
      url: "https://pro.casa.kz/",
      publisher: { "@id": "https://pro.casa.kz/#organization" },
      offers: { "@type": "Offer", price: "0", priceCurrency: "KZT" },
      areaServed: { "@type": "Country", name: "Казахстан" },
    },
  ],
};

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
