import { Building2, CalendarClock, MessageCircle, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FEATURES = [
  {
    icon: Receipt,
    title: "Recibos sempre à mão",
    text: "Baixe o PDF de qualquer pagamento de aluguel ou água/esgoto já confirmado, quando precisar.",
  },
  {
    icon: CalendarClock,
    title: "Prazo do contrato",
    text: "Veja quantos dias faltam para o fim da vigência do seu contrato, sem precisar perguntar.",
  },
  {
    icon: MessageCircle,
    title: "Avisos por WhatsApp",
    text: "Receba lembretes de vencimento e o recibo direto no WhatsApp.",
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-page">
      <header className="bg-white border-b border-surface-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary-500 text-white flex items-center justify-center font-bold text-sm">
              MA
            </div>
            <span className="font-semibold text-ink">Meu Aluguel</span>
          </div>
          <button onClick={() => navigate("/login")} className="btn-primary">
            Entrar
          </button>
        </div>
      </header>

      <section className="relative overflow-hidden bg-primary-700 text-white">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-primary-900/40 blur-3xl"
        />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight max-w-2xl mx-auto">
            Seus recibos e o prazo do seu contrato, sempre à mão.
          </h1>
          <p className="text-primary-100 mt-4 max-w-xl mx-auto text-sm sm:text-base">
            Acesse sua conta para acompanhar os pagamentos de aluguel e água/esgoto, baixar
            recibos em PDF e saber exatamente quando seu contrato vence.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-white text-primary-700 font-medium px-6 py-3 shadow-lg shadow-primary-900/20 hover:brightness-95 transition"
          >
            Acessar minha conta
          </button>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid sm:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6 space-y-3">
              <div className="h-11 w-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                <f.icon size={20} />
              </div>
              <h3 className="font-semibold text-ink">{f.title}</h3>
              <p className="text-sm text-ink-secondary">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div className="card p-8 sm:p-10 text-center space-y-4">
          <Building2 className="mx-auto text-primary-600" size={28} />
          <h2 className="text-xl font-bold text-ink">Recebeu um login do seu administrador?</h2>
          <p className="text-sm text-ink-secondary max-w-md mx-auto">
            Use o e-mail e a senha que ele te enviou para entrar na sua conta.
          </p>
          <button onClick={() => navigate("/login")} className="btn-primary">
            Entrar
          </button>
        </div>
      </section>

      <footer className="border-t border-surface-border py-6">
        <p className="text-center text-xs text-ink-muted">
          Meu Aluguel · Sistema de gestão de imóveis alugados
        </p>
      </footer>
    </div>
  );
}
