import { motion } from "framer-motion";
import { useTheme } from "../hooks/useTheme";
import { IconMoon, IconSun } from "./Icons";

export default function ThemeToggle({
  className = "",
}: {
  className?: string;
}) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`relative grid h-9 w-9 place-items-center rounded-lg bg-line/5 text-ink-300 ring-1 ring-line/10 transition-colors hover:bg-line/10 hover:text-heading ${className}`}
    >
      <motion.span
        key={theme}
        initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="grid place-items-center"
      >
        {isDark ? (
          <IconSun className="h-[18px] w-[18px]" />
        ) : (
          <IconMoon className="h-[18px] w-[18px]" />
        )}
      </motion.span>
    </button>
  );
}
