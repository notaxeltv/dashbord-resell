export const IMPORT_CATEGORIES = [
  {
    id: "cards",
    label: "Carte da gioco / TCG (TARIC 9504 40)",
    dutyPct: 2.7,
  },
  {
    id: "print",
    label: "Materiale stampato / collezionismo (TARIC 4911)",
    dutyPct: 0,
  },
  {
    id: "toys",
    label: "Giocattoli (TARIC 9503)",
    dutyPct: 4.7,
  },
  {
    id: "custom",
    label: "Aliquota personalizzata",
    dutyPct: null as number | null,
  },
] as const;

export const SHIPPING_PRESETS = [
  { id: "custom", label: "Inserisco io l’importo", shippingJpy: "", extraEur: "" },
  { id: "packet", label: "Japan Post small packet (stima)", shippingJpy: "900", extraEur: "0" },
  { id: "ems", label: "Japan Post EMS (stima)", shippingJpy: "2800", extraEur: "0" },
  { id: "dhl", label: "DHL / FedEx (stima + svincolo)", shippingJpy: "7500", extraEur: "15" },
  {
    id: "proxy",
    label: "Proxy Buyee / ZenMarket (stima)",
    shippingJpy: "4500",
    extraEur: "0",
  },
] as const;

export const DEFAULT_JPY_PER_EUR = 170;
export const DUTY_EXEMPTION_EUR = 150;

export type JapanImportInput = {
  goodsJpy: number;
  shippingJpy: number;
  insuranceJpy: number;
  proxyJpy: number;
  includeProxyInCustoms: boolean;
  jpyPerEur: number;
  dutyRatePct: number;
  vatRatePct: number;
  extraEur: number;
  applyDutyExemptionUnder150: boolean;
  quantity: number;
};

export type JapanImportResult = {
  goodsEur: number;
  shippingEur: number;
  insuranceEur: number;
  proxyEur: number;
  extraEur: number;
  customsValue: number;
  duty: number;
  dutyExempt: boolean;
  vatBase: number;
  vat: number;
  importCharges: number;
  total: number;
  perUnit: number | null;
};

function jpyToEur(jpy: number, jpyPerEur: number) {
  if (!jpyPerEur || jpyPerEur <= 0) return 0;
  return jpy / jpyPerEur;
}

export function estimateJapanImport(input: JapanImportInput): JapanImportResult {
  const goodsEur = jpyToEur(Math.max(0, input.goodsJpy), input.jpyPerEur);
  const shippingEur = jpyToEur(Math.max(0, input.shippingJpy), input.jpyPerEur);
  const insuranceEur = jpyToEur(Math.max(0, input.insuranceJpy), input.jpyPerEur);
  const proxyEur = jpyToEur(Math.max(0, input.proxyJpy), input.jpyPerEur);
  const extraEur = Math.max(0, input.extraEur);

  const customsValue =
    goodsEur +
    shippingEur +
    insuranceEur +
    (input.includeProxyInCustoms ? proxyEur : 0);

  const dutyExempt =
    input.applyDutyExemptionUnder150 && customsValue <= DUTY_EXEMPTION_EUR;
  const duty = dutyExempt ? 0 : customsValue * (Math.max(0, input.dutyRatePct) / 100);
  const vatBase = customsValue + duty + extraEur;
  const vat = vatBase * (Math.max(0, input.vatRatePct) / 100);
  const importCharges = duty + vat + extraEur;
  const total = goodsEur + shippingEur + insuranceEur + proxyEur + importCharges;
  const qty = Math.floor(input.quantity);
  const perUnit = qty > 0 ? total / qty : null;

  return {
    goodsEur,
    shippingEur,
    insuranceEur,
    proxyEur,
    extraEur,
    customsValue,
    duty,
    dutyExempt,
    vatBase,
    vat,
    importCharges,
    total,
    perUnit,
  };
}

export function formatEur(value: number) {
  return value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatJpy(value: number) {
  return `${Math.round(value).toLocaleString("it-IT")} ¥`;
}
