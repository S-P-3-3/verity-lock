interface Props {
  options: { label: string; value: string; count?: number }[];
  active: string;
  onSelect: (value: string) => void;
}

export function FilterPills({ options, active, onSelect }: Props) {
  return (
    <div className="filter-pills">
      {options.map((o) => (
        <button
          key={o.value}
          className={`pill ${active === o.value ? "active" : ""}`}
          onClick={() => onSelect(o.value)}
        >
          {o.label}
          {o.count !== undefined ? ` ${o.count}` : ""}
        </button>
      ))}
    </div>
  );
}
