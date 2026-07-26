const STEPS = ["Адрес", "Параметры", "Результат", "Контакты"] as const;

export function WizardProgress({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="flex items-center gap-3 text-sm text-ink/50">
      {STEPS.map((label, index) => {
        const stepNumber = (index + 1) as 1 | 2 | 3 | 4;
        return (
          <li
            key={label}
            className={stepNumber === current ? "font-semibold text-accent-dark" : ""}
          >
            {index + 1}. {label}
          </li>
        );
      })}
    </ol>
  );
}
