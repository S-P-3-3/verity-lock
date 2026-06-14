import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { ACCENTS } from "../utils/theme";
import type { AccentColor } from "../types";

export function SettingsSection({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <div className="settings-section">
      <div className="section-header">
        {icon} {title}
      </div>
      <div className="section-card">{children}</div>
    </div>
  );
}

export function SettingsRow({
  label,
  description,
  value,
  chevron,
  onClick,
  children,
}: {
  label: string;
  description?: string;
  value?: string;
  chevron?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className={`settings-row ${onClick ? "tappable" : ""}`} onClick={onClick}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-label">{label}</div>
        {description && <div className="row-desc">{description}</div>}
      </div>
      {value && <span className="row-value">{value}</span>}
      {children}
      {chevron && <ChevronRight size={18} color="var(--text-25)" />}
    </div>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`toggle ${value ? "on" : ""}`}
      role="switch"
      aria-checked={value}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!value);
      }}
    />
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: AccentColor;
  onChange: (v: AccentColor) => void;
}) {
  return (
    <div className="color-picker">
      {(Object.keys(ACCENTS) as AccentColor[]).map((c) => (
        <button
          key={c}
          className={`color-dot ${value === c ? "selected" : ""}`}
          style={{ background: ACCENTS[c].accent }}
          aria-label={c}
          onClick={(e) => {
            e.stopPropagation();
            onChange(c);
          }}
        />
      ))}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          className={`seg-btn ${value === o.value ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Dropdown<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <select
      className="settings-dropdown"
      value={String(value)}
      onChange={(e) => {
        const opt = options.find((o) => String(o.value) === e.target.value);
        if (opt) onChange(opt.value);
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
