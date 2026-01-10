export default function Footer() {
  return (
    <footer className="h-10 border-t flex items-center justify-between px-6 text-sm text-gray-500">
      <span>© {new Date().getFullYear()} NSAI Platform</span>
      <span>No-Code AI Fine-Tuning</span>
    </footer>
  );
}
