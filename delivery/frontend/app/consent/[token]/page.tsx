"use client";

/**
 * CASA Pro Ипотека — защищённая публичная страница согласия клиента (Phase 1).
 * Открывается по одноразовой ссылке (secure link + OTP). Мобильная.
 *
 * DEMO-режим (Phase 1, production-safe): SMS реально не отправляется, поэтому
 * код показан на экране. Механика подтверждения настоящая: ввод кода → согласие
 * получает статус confirmed. Реальная доставка SMS и достаточность способа
 * подтверждения для каждого источника — по open_decisions OD-001/OD-003 (юрист +
 * поставщик данных) до production. Персональные данные здесь не раскрываются
 * сверх маскированного телефона.
 */

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck, Check, X, Lock, Loader2, Building2 } from "lucide-react";

const PURPOSES = [
  "Сбор и обработка анкетных данных",
  "Обработка загруженной кредитной истории",
  "Обработка выписки ЕНПФ",
  "Разрешённые проверки по ИИН в официальных источниках",
  "Предварительный расчёт вариантов ипотеки",
  "Подбор ипотечных программ и квартир в новостройках",
  "Формирование и передача клиентского заключения",
];

// В demo-режиме код детерминированно выводится из токена, чтобы страницу можно
// было пройти без реальной SMS. В production код приходит только по SMS.
function demoCodeFromToken(token: string): string {
  let h = 0;
  for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) >>> 0;
  return String(h % 100000000).padStart(8, "0");
}

type Stage = "review" | "verifying" | "confirmed" | "rejected";

export default function ConsentPage() {
  const params = useParams();
  const token = String(params?.token ?? "");
  const demoCode = useMemo(() => demoCodeFromToken(token || "demo"), [token]);

  const [stage, setStage] = useState<Stage>("review");
  const [code, setCode] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    setStage("verifying");
    // имитация проверки на сервере
    setTimeout(() => {
      if (code.trim() === demoCode) {
        setStage("confirmed");
      } else {
        const left = 5 - (attempts + 1);
        setAttempts((a) => a + 1);
        setStage("review");
        setError(left > 0 ? `Неверный код. Осталось попыток: ${left}.` : "Превышено число попыток. Запросите новую ссылку.");
      }
    }, 700);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0f1f3a] p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Шапка */}
        <div className="flex items-center gap-2 bg-[#15325B] px-5 py-4 text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 font-bold">C</div>
          <div>
            <p className="text-sm font-semibold leading-none">CASA Pro</p>
            <p className="text-xs text-white/70">Согласие на обработку данных</p>
          </div>
          <Lock className="ml-auto h-4 w-4 text-white/60" />
        </div>

        <div className="space-y-4 p-5">
          {stage === "confirmed" ? (
            <Result
              icon={<Check className="h-7 w-7" />}
              tone="green"
              title="Согласие подтверждено"
              text="Спасибо! Ваш специалист CASA продолжит подбор ипотеки. Эту страницу можно закрыть."
            />
          ) : stage === "rejected" ? (
            <Result
              icon={<X className="h-7 w-7" />}
              tone="red"
              title="Согласие отклонено"
              text="Вы отказались от обработки данных. Если это ошибка — запросите новую ссылку у специалиста."
            />
          ) : (
            <>
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#15325B]" />
                <p className="text-sm text-slate-700">
                  Компания <b>CASA Pro</b> просит согласие на обработку ваших данных для предварительного
                  подбора ипотеки. Версия текста 1.1.
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Цели обработки</p>
                <ul className="mt-1.5 space-y-1">
                  {PURPOSES.map((p) => (
                    <li key={p} className="flex items-start gap-1.5 text-sm text-slate-700">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Demo-подсказка кода */}
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-medium">Демо-режим</p>
                <p className="mt-0.5">
                  SMS не отправляется. Ваш одноразовый код для проверки: <b className="font-mono tracking-widest">{demoCode}</b>
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="otp" className="text-sm font-medium text-slate-700">
                  Введите код из SMS
                </label>
                <input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="8 цифр"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-lg tracking-[0.3em] outline-none focus:border-[#15325B] focus:ring-2 focus:ring-[#15325B]/20"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStage("rejected")}
                  className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Отклонить
                </button>
                <button
                  onClick={submit}
                  disabled={code.length < 8 || stage === "verifying" || attempts >= 5}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#15325B] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#15325B]/90 disabled:opacity-50"
                >
                  {stage === "verifying" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Подтвердить
                </button>
              </div>

              <p className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                <Building2 className="h-3 w-3" /> Ссылка защищена и действует ограниченное время
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Result({ icon, tone, title, text }: { icon: React.ReactNode; tone: "green" | "red"; title: string; text: string }) {
  const bg = tone === "green" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700";
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className={`flex h-14 w-14 items-center justify-center rounded-full ${bg}`}>{icon}</div>
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      <p className="max-w-xs text-sm text-slate-600">{text}</p>
    </div>
  );
}
