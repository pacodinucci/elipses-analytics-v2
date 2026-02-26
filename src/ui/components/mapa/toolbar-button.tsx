import React from "react";
import "./toolbar-button.css";

type ToolbarButtonProps = {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
};

export const ToolbarButton = ({
  title,
  onClick,
  active = false,
  children,
  disabled = false,
  className,
}: ToolbarButtonProps) => {
  return (
    <button
      type="button"
      title={title}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={[
        "toolbarButton",
        active ? "toolbarButton--active" : "",
        disabled ? "toolbarButton--disabled" : "",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </button>
  );
};
