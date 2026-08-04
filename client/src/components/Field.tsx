import { cloneElement, isValidElement, useId, type ReactElement } from "react";

interface FieldProps {
  label: string;
  children: ReactElement<{ id?: string }>;
}

export default function Field({ label, children }: FieldProps) {
  const id = useId();
  const child = isValidElement(children) ? cloneElement(children, { id }) : children;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {child}
    </div>
  );
}
