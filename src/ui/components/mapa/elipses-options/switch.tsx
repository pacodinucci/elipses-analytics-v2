import "./switch.css";

type Props = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  title?: string;
  "aria-label"?: string;
};

export function Switch({
  checked,
  disabled,
  onChange,
  label,
  title,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <label
      className={`elipsesOpt__switch ${disabled ? "is-disabled" : ""}`}
      title={title}
      aria-label={ariaLabel}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="elipsesOpt__switchTrack" aria-hidden="true">
        <span className="elipsesOpt__switchThumb" aria-hidden="true" />
      </span>

      {label ? <span className="elipsesOpt__switchLabel">{label}</span> : null}
    </label>
  );
}
