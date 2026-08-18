export default function Footer() {
  return (
    <footer className="bg-[#15325B] py-6">
      <p className="text-center text-xs text-slate-500">
        © {new Date().getFullYear()} CASA Pro. Все права защищены.
      </p>
    </footer>
  );
}
