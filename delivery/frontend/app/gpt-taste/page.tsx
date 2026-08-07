import GptHeader from '@/components/landing/gpt-taste/Header';
import GptHero from '@/components/landing/gpt-taste/Hero';
import GptAbout from '@/components/landing/gpt-taste/About';
import GptFeatures from '@/components/landing/gpt-taste/Features';
import GptHowItWorks from '@/components/landing/gpt-taste/HowItWorks';
import GptWhyUs from '@/components/landing/gpt-taste/WhyUs';
import GptContactSection from '@/components/landing/gpt-taste/ContactSection';
import GptFooter from '@/components/landing/gpt-taste/Footer';

export default function GptTastePage() {
  return (
    <div className="min-h-screen bg-white">
      <GptHeader />
      <GptHero />
      <GptAbout />
      <GptFeatures />
      <GptHowItWorks />
      <GptWhyUs />
      <GptContactSection />
      <GptFooter />
    </div>
  );
}
