import { createContext, useCallback, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, saveSettings } from "./api.ts";
import { CURRENCIES, DEFAULT_CURRENCY, formatMoney, type CurrencyCode } from "../shared/currency.ts";
import type { Settings } from "../shared/types.ts";

const CurrencyContext = createContext<CurrencyCode>(DEFAULT_CURRENCY);

/** Loads the saved currency and makes it available to useFormatMoney(). */
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const settings = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  return (
    <CurrencyContext.Provider value={settings.data?.currency ?? DEFAULT_CURRENCY}>{children}</CurrencyContext.Provider>
  );
}

export function useFormatMoney() {
  const currency = useContext(CurrencyContext);
  return useCallback((minor: number) => formatMoney(minor, currency), [currency]);
}

const CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function CurrencyPicker() {
  const current = useContext(CurrencyContext);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (currency: CurrencyCode) => saveSettings({ currency }),
    // Switch immediately; roll back if the server rejects it.
    onMutate: async (currency) => {
      await queryClient.cancelQueries({ queryKey: ["settings"] });
      const previous = queryClient.getQueryData<Settings>(["settings"]);
      queryClient.setQueryData<Settings>(["settings"], { ...previous, currency });
      return { previous };
    },
    onError: (_err, _currency, ctx) => queryClient.setQueryData(["settings"], ctx?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <div
        role="radiogroup"
        aria-label="Currency"
        title="Changes how amounts are shown. Amounts are not converted."
        className="flex rounded-md border border-line bg-surface p-1 text-sm"
      >
        {CODES.map((code) => {
          const selected = code === current;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${CURRENCIES[code].label} (${code})`}
              onClick={() => !selected && save.mutate(code)}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 ${
                selected ? "bg-page font-medium text-ink shadow-sm" : "text-ink-2 hover:text-ink"
              }`}
            >
              <span aria-hidden className="text-ink-3">
                {CURRENCIES[code].symbol}
              </span>
              {code}
            </button>
          );
        })}
      </div>
      {save.isError && (
        <p role="alert" className="text-xs text-error">
          Couldn't save currency: {save.error.message}
        </p>
      )}
    </div>
  );
}
