import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export default function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="h-12 w-12 rounded-full bg-surface-page flex items-center justify-center text-ink-muted mb-4">
        <Icon size={22} />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="text-sm text-ink-muted mt-1 max-w-xs">{description}</p>}
    </div>
  );
}
