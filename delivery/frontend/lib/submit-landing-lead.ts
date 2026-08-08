export async function submitLandingLead(data: { name: string; phone: string; role: string; source: string }) {
  const res = await fetch('/api/public/landing-leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error('Не удалось отправить заявку');
  }
}
