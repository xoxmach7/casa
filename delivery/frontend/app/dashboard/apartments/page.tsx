'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AllApartmentsPage() {
  const router = useRouter();

  useEffect(() => {
    // Редирект на новую страницу выбора ЖК
    router.replace('/dashboard/chess');
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-muted-foreground">Перенаправление...</p>
    </div>
  );
}
