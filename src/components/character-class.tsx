import { CHARACTER_CLASSES, type CharacterClass } from "@/lib/levels";

interface CharacterClassBadgeProps {
  characterClass: CharacterClass;
  size?: "sm" | "md";
}

export function CharacterClassBadge({ characterClass, size = "md" }: CharacterClassBadgeProps) {
  const info = CHARACTER_CLASSES[characterClass] ?? CHARACTER_CLASSES.anon;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2.5 py-1 gap-1.5",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border border-accent/20 bg-accent/10 text-accent font-medium ${sizeClasses[size]}`}
      title={info.description}
    >
      <span>{info.icon}</span>
      <span>{info.name}</span>
    </span>
  );
}
