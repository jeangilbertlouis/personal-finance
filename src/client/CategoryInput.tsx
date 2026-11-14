import { useId, useMemo, useState } from "react";
import type { CategoryUsage } from "../shared/types.ts";

interface Props {
  value: string;
  onChange: (value: string) => void;
  categories: CategoryUsage[];
  /** Categories of this type are listed first. */
  preferKind: CategoryUsage["kind"];
  placeholder?: string;
  className?: string;
}

interface Suggestion {
  name: string;
  kinds: Set<CategoryUsage["kind"]>;
  count: number;
}

const MAX_SUGGESTIONS = 8;

/** Merge per-type usage rows into one suggestion per category name. */
function mergeCategories(categories: CategoryUsage[]): Suggestion[] {
  const byName = new Map<string, Suggestion>();
  for (const c of categories) {
    const s = byName.get(c.name) ?? { name: c.name, kinds: new Set(), count: 0 };
    s.kinds.add(c.kind);
    s.count += c.count;
    byName.set(c.name, s);
  }
  return [...byName.values()];
}

export function rankSuggestions(
  categories: CategoryUsage[],
  query: string,
  preferKind: CategoryUsage["kind"],
): Suggestion[] {
  const q = query.trim().toLowerCase();
  const score = (s: Suggestion) => {
    const name = s.name.toLowerCase();
    const match = q === "" ? 1 : name.startsWith(q) ? 2 : name.includes(q) ? 1 : 0;
    return match;
  };
  return mergeCategories(categories)
    .map((s) => ({ s, match: score(s) }))
    .filter(({ s, match }) => match > 0 && s.name.toLowerCase() !== q)
    .sort(
      (a, b) =>
        b.match - a.match ||
        Number(b.s.kinds.has(preferKind)) - Number(a.s.kinds.has(preferKind)) ||
        b.s.count - a.s.count ||
        a.s.name.localeCompare(b.s.name),
    )
    .slice(0, MAX_SUGGESTIONS)
    .map(({ s }) => s);
}

/**
 * Free-text input with an autocomplete list of existing categories.
 * Implements the ARIA 1.2 combobox pattern, rendered in-page rather than via
 * <datalist>, whose native popup doesn't show in every embedded browser.
 */
export function CategoryInput({ value, onChange, categories, preferKind, placeholder, className }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const suggestions = useMemo(
    () => rankSuggestions(categories, value, preferKind),
    [categories, value, preferKind],
  );
  const showList = open && suggestions.length > 0;
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => (suggestions.length === 0 ? -1 : (i + 1) % suggestions.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (suggestions.length === 0 ? -1 : i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && showList && active >= 0) {
      // Pick the highlighted suggestion instead of submitting the form.
      e.preventDefault();
      pick(suggestions[active]!.name);
    } else if (e.key === "Escape" && showList) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        className={className}
        placeholder={placeholder}
        value={value}
        maxLength={60}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Existing categories"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-line bg-surface py-1 text-sm shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.name}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              // mousedown (not click) so the input's blur doesn't close the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s.name);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-ink ${
                i === active ? "bg-page" : ""
              }`}
            >
              <span className="truncate">{s.name}</span>
              <span className="flex shrink-0 items-center gap-1" aria-hidden>
                {s.kinds.has("income") && (
                  <span className="size-2 rounded-sm" style={{ background: "var(--flow-income)" }} />
                )}
                {s.kinds.has("expense") && (
                  <span className="size-2 rounded-sm" style={{ background: "var(--flow-expense)" }} />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
