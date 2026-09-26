import { useState } from "react";
import type { ChangeEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { theme } from "@/theme";

interface Props {
  icon: LucideIcon;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  toggle?: boolean;
}

export function Field({ icon: Icon, type = "text", placeholder, value, onChange, toggle }: Props) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <div className="relative">
      <Icon size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
      <input
        type={isPw && show ? "text" : type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl py-3 pl-11 pr-11 text-sm outline-none transition-all focus:ring-2"
        style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
      />
      {isPw && toggle && (
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3.5 top-1/2 -translate-y-1/2">
          {show ? <EyeOff size={17} style={{ color: theme.textMuted }} /> : <Eye size={17} style={{ color: theme.textMuted }} />}
        </button>
      )}
    </div>
  );
}