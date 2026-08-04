type Status = "pendente" | "atrasado" | "pago" | "cancelado" | "ativo" | "encerrado";

const CONFIG: Record<Status, { label: string; classes: string }> = {
  pendente: { label: "Pendente", classes: "bg-status-warning/15 text-[#9a6a00]" },
  atrasado: { label: "Atrasado", classes: "bg-status-critical/10 text-status-critical" },
  pago: { label: "Pago", classes: "bg-status-good/10 text-status-good" },
  cancelado: { label: "Cancelado", classes: "bg-ink-muted/10 text-ink-muted" },
  ativo: { label: "Ativo", classes: "bg-status-good/10 text-status-good" },
  encerrado: { label: "Encerrado", classes: "bg-ink-muted/10 text-ink-muted" },
};

export default function StatusBadge({ status }: { status: Status }) {
  const config = CONFIG[status];
  return <span className={`badge ${config.classes}`}>{config.label}</span>;
}
