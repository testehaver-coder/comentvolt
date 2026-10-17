// UI translations (public/i18n.js): exact strings, patterns with numbers/names, and fallbacks.

import { beforeEach, describe, expect, it } from "vitest";

// i18n.js is a plain browser script: it publishes itself on window.
const g = globalThis as unknown as { window: { chatmanyI18n?: unknown } };
g.window = {};
// @ts-expect-error -- plain browser script, it ships no type declarations
await import("../public/i18n.js");
const i18n = g.window.chatmanyI18n as {
  t: (s: string) => string;
  pick: (code: string) => string;
  setLanguage: (code: string) => string;
};

describe("i18n", () => {
  beforeEach(() => i18n.setLanguage("pt-BR"));

  it("picks Portuguese for any pt variant and English otherwise", () => {
    expect(i18n.pick("pt-BR")).toBe("pt");
    expect(i18n.pick("pt")).toBe("pt");
    expect(i18n.pick("fr")).toBe("en");
    expect(i18n.pick("")).toBe("en");
  });

  it("translates exact UI text and keeps the surrounding whitespace", () => {
    expect(i18n.t("Automations")).toBe("Automações");
    expect(i18n.t(" Archive")).toBe(" Arquivo");
    expect(i18n.t("\n      Export CSV\n")).toBe("\n      Exportar CSV\n");
  });

  it("translates text with numbers and names", () => {
    expect(i18n.t("Last 30 days")).toBe("Últimos 30 dias");
    expect(i18n.t("1 minute ago")).toBe("há 1 minuto");
    expect(i18n.t("5 hours ago")).toBe("há 5 horas");
    expect(i18n.t("3 selected")).toBe("3 selecionadas");
    expect(i18n.t("Delete this automation? This can't be undone.")).toBe("Excluir esta automação? Isso não pode ser desfeito.");
    expect(i18n.t("Delete these 4 automations? This can't be undone.")).toBe("Excluir estas 4 automações? Isso não pode ser desfeito.");
    expect(i18n.t('Delete "Promo Black"? This can\'t be undone.')).toBe('Excluir "Promo Black"? Isso não pode ser desfeito.');
  });

  it("leaves unknown text, such as names people typed, untouched", () => {
    expect(i18n.t("Promo Black VOLT")).toBe("Promo Black VOLT");
  });

  it("does nothing in English", () => {
    i18n.setLanguage("en");
    expect(i18n.t("Automations")).toBe("Automations");
  });
});
