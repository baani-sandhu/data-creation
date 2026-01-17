import { ModeToggle } from "@/components/theme-togle";

export default function Header() {
  return (
    <header className="h-14 border-b flex items-center px-6 justify-between">
      <span className="font-semibold">No-Code AI Fine-Tuning Platform</span>
      <ModeToggle />
    </header>
  );
}
