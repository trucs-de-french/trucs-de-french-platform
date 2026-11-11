// URL соцмереж для футера кабінету (cabinet-footer.tsx). Порожній рядок —
// кнопка цієї мережі просто не рендериться, нічого не ламається. Без
// трекінг-параметрів (?igsh=.../?si=...) — прибрано свідомо.
export const SOCIAL_LINKS = {
  telegram: "https://t.me/trucs_de_french",
  instagram: "https://www.instagram.com/trucs_de_french",
  facebook: "https://www.facebook.com/trucs.de.french",
  youtube: "https://youtube.com/@trucs-de-french",
} as const;

export const SHOP_URL = "https://trucsdefrench.wayforpay.shop";
