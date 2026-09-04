import { SecondaryTabs } from "@/components/marketplace/SecondaryTabs";

/**
 * Оболочка раздела «Вторичка»: вкладки печатаются один раз здесь и работают
 * на всех страницах раздела, чтобы сущности жили внутри раздела, а не
 * отдельными пунктами сайдбара.
 */
export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-6">
      <SecondaryTabs />
      {children}
    </div>
  );
}
