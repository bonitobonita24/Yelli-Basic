// Re-export the shared class merger so shadcn primitives can import it via the
// conventional `@/lib/utils` alias (components.json aliases.utils). Single source
// of `cn` lives in @yelli/ui (clsx + tailwind-merge).
export { cn } from '@yelli/ui';
