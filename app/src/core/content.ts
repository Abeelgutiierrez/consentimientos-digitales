// Contenido legal del consentimiento: servicios, cuestionario de salud, documento informativo,
// declaraciones y textos de las casillas. Plantilla genérica para Catalunya (Decret 90/2008).
//
// IMPORTANTE
// - Debe revisarlo un asesor legal antes de usarlo con clientes reales.
// - Cualquier cambio de texto obliga a subir CONSENT_VERSION: el texto exacto que se muestra
//   forma parte de lo firmado (y de su huella SHA-256).
// - Los textos legales solo existen en español por ahora. El catalán se añadirá cuando un
//   asesor lo revise (LEGAL_LOCALES); mientras, el contenido legal se muestra en español.

export const CONSENT_VERSION = "v1 · 2026-11";

export const LEGAL_LOCALES = ["es"] as const;
export type LegalLocale = (typeof LEGAL_LOCALES)[number];

export function legalLocaleFor(locale: string): LegalLocale {
  return (LEGAL_LOCALES as readonly string[]).includes(locale) ? (locale as LegalLocale) : "es";
}

export const SERVICE_KEYS = ["tatuaje", "micropigmentacion", "piercing"] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];

export const SERVICES: Record<ServiceKey, { permanent: boolean; label: Record<LegalLocale, string> }> = {
  tatuaje: { permanent: true, label: { es: "Tatuaje" } },
  micropigmentacion: { permanent: false, label: { es: "Micropigmentación" } },
  piercing: { permanent: false, label: { es: "Piercing" } },
};

export function isServiceKey(v: unknown): v is ServiceKey {
  return typeof v === "string" && (SERVICE_KEYS as readonly string[]).includes(v);
}

export function serviceLabel(key: string, locale: LegalLocale = "es"): string {
  return isServiceKey(key) ? SERVICES[key].label[locale] : key;
}

export const HEALTH_KEYS = [
  "alergias", "piel", "diabetes", "coagulacion", "cardiaco", "epilepsia",
  "inmunidad", "embarazo", "medicacion", "sustancias", "desmayos",
] as const;
export type HealthKey = (typeof HEALTH_KEYS)[number];

const HEALTH_LABELS: Record<LegalLocale, Record<HealthKey, string>> = {
  es: {
    alergias: "¿Tienes alguna alergia conocida (látex, metales, pigmentos, anestésicos, desinfectantes)?",
    piel: "¿Tienes alguna afección de la piel en la zona (psoriasis, eccema, lunares, heridas, tendencia a queloides)?",
    diabetes: "¿Tienes diabetes?",
    coagulacion: "¿Tienes problemas de coagulación o tomas anticoagulantes o antiagregantes (Sintrom, aspirina...)?",
    cardiaco: "¿Tienes alguna enfermedad cardíaca o llevas marcapasos?",
    epilepsia: "¿Tienes epilepsia o has sufrido convulsiones?",
    inmunidad: "¿Tienes alguna enfermedad infecciosa o que afecte a tus defensas?",
    embarazo: "¿Estás embarazada o en periodo de lactancia?",
    medicacion: "¿Tomas actualmente alguna medicación?",
    sustancias: "¿Has consumido alcohol u otras drogas en las últimas 24 horas?",
    desmayos: "¿Tienes tendencia a marearte o desmayarte?",
  },
};

export function healthQuestions(locale: LegalLocale = "es"): { key: HealthKey; label: string }[] {
  return HEALTH_KEYS.map((key) => ({ key, label: HEALTH_LABELS[locale][key] }));
}

/** Datos del estudio que aparecen en los textos legales. */
export interface StudioLegalInfo {
  name: string;
  cif: string;
  email: string;
}

export interface InfoSection {
  title: string;
  text: string;
}

// Documento informativo (art. 5.2 del Decret 90/2008): riesgos, cuidados y carácter permanente.
// Texto idéntico al de la demo (un test lo comprueba).
export function infoDocument(studio: StudioLegalInfo, serviceKey: ServiceKey, _locale: LegalLocale = "es"): InfoSection[] {
  const service = SERVICES[serviceKey];
  const nombre = studio.name;
  return [
    {
      title: "En qué consiste",
      text: serviceKey === "piercing"
        ? "El piercing consiste en perforar la piel o el cartílago con una aguja estéril de un solo uso para colocar una joya de material apto para primera colocación."
        : `La técnica consiste en introducir pigmentos en la dermis mediante agujas estériles de un solo uso. ${service.permanent ? "El resultado es PERMANENTE y su eliminación posterior es costosa, puede requerir varias sesiones de láser y no siempre es completa." : "El resultado es semipermanente y se va aclarando con el tiempo; puede requerir retoques."}`,
    },
    {
      title: "Riesgos posibles",
      text: "Aunque se aplican todas las medidas higiénico-sanitarias exigidas, pueden aparecer: infección local, reacción alérgica a los pigmentos o a los materiales, inflamación, sangrado leve, cicatrices o queloides, y cambios en el resultado por una mala cicatrización. Si tienes previsto hacerte una resonancia magnética, informa de que tienes un tatuaje o micropigmentación. Algunos tatuajes pueden limitar temporalmente la donación de sangre.",
    },
    {
      title: "Cuidados después de la sesión",
      text: "Lávate las manos antes de tocar la zona. Limpia con agua y jabón neutro 2 o 3 veces al día y aplica una capa fina de la crema recomendada. No rasques ni arranques las costras. Evita el sol, la piscina, el mar, la sauna y los baños largos durante al menos dos semanas. Si observas enrojecimiento creciente, pus, fiebre o dolor intenso, acude a un centro sanitario.",
    },
    {
      title: "Material y trazabilidad",
      text: `${nombre} utiliza material estéril de un solo uso y pigmentos autorizados. El aplicador anotará en tu ficha la marca, el color y el lote de las tintas utilizadas para garantizar la trazabilidad.`,
    },
    {
      title: "Menores de edad",
      text: "Las personas menores de edad necesitan la autorización por escrito de su padre, madre o tutor legal. Las personas menores de 16 años deben aportar además un certificado de madurez.",
    },
    {
      title: "Protección de datos",
      text: `Responsable: ${nombre}${studio.cif ? " (" + studio.cif + ")" : ""}. Finalidad: gestionar tu consentimiento informado, cumplir las obligaciones sanitarias y conservar la trazabilidad del servicio. Base legal: tu consentimiento y el cumplimiento de obligaciones legales. Tus datos de salud solo se usan para valorar si es seguro realizar el servicio. No se ceden a terceros salvo obligación legal. Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a ${studio.email || "el establecimiento"}. También puedes reclamar ante la Autoridad Catalana de Protección de Datos o la AEPD.`,
    },
  ];
}

// Declaraciones que la persona acepta al firmar (casilla «He leído»). Idénticas a la demo.
export function declarations(studio: StudioLegalInfo, serviceKey: ServiceKey, _locale: LegalLocale = "es"): string[] {
  const service = SERVICES[serviceKey];
  return [
    `He leído y entendido el documento informativo sobre la práctica de ${service.label.es.toLowerCase()} y he podido resolver mis dudas con el aplicador.`,
    "Declaro que los datos de salud que he facilitado son ciertos y que no he omitido información relevante.",
    `Autorizo a ${studio.name} a realizarme el servicio descrito en la zona indicada.`,
  ];
}

// Textos de las casillas de autorización. Un único texto que se muestra en el formulario,
// se incluye en la huella y se imprime en el PDF (en la demo el formulario y el PDF diferían).
export type CheckKey = "privacy" | "marketing" | "images";

const CHECK_TEXTS: Record<LegalLocale, Record<CheckKey, string>> = {
  es: {
    privacy: "Acepto el tratamiento de mis datos, incluidos los de salud, para las finalidades indicadas en el apartado de protección de datos.",
    marketing: "Acepto recibir comunicaciones comerciales (promociones y felicitación de cumpleaños) por correo electrónico. Opcional y revocable en cualquier momento.",
    images: "Autorizo la publicación de fotografías del trabajo realizado en las redes sociales del estudio, sin mostrar mi cara. Opcional.",
  },
};

export function checkTexts(locale: LegalLocale = "es"): Record<CheckKey, string> {
  return CHECK_TEXTS[locale];
}

/** Todo el texto legal que ve la persona para un servicio: va íntegro a lo firmado. */
export function legalContent(studio: StudioLegalInfo, serviceKey: ServiceKey, locale: LegalLocale = "es") {
  return {
    consentVersion: CONSENT_VERSION,
    info: infoDocument(studio, serviceKey, locale),
    declarations: declarations(studio, serviceKey, locale),
    healthQuestions: healthQuestions(locale),
    checkTexts: checkTexts(locale),
  };
}
