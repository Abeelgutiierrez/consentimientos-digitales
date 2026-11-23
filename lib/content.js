'use strict';
// Contenido del consentimiento: servicios, cuestionario de salud y documento informativo.
// Redactado como plantilla genérica para establecimientos de Catalunya (Decret 90/2008).
// IMPORTANTE: antes de usarlo con clientes reales, debe revisarlo un asesor legal.

const CONSENT_VERSION = 'v1 · 2026-11';

const SERVICES = {
  tatuaje: { label: 'Tatuaje', permanent: true },
  micropigmentacion: { label: 'Micropigmentación', permanent: false },
  piercing: { label: 'Piercing', permanent: false },
};

const HEALTH_QUESTIONS = [
  { key: 'alergias', label: '¿Tienes alguna alergia conocida (látex, metales, pigmentos, anestésicos, desinfectantes)?' },
  { key: 'piel', label: '¿Tienes alguna afección de la piel en la zona (psoriasis, eccema, lunares, heridas, tendencia a queloides)?' },
  { key: 'diabetes', label: '¿Tienes diabetes?' },
  { key: 'coagulacion', label: '¿Tienes problemas de coagulación o tomas anticoagulantes o antiagregantes (Sintrom, aspirina...)?' },
  { key: 'cardiaco', label: '¿Tienes alguna enfermedad cardíaca o llevas marcapasos?' },
  { key: 'epilepsia', label: '¿Tienes epilepsia o has sufrido convulsiones?' },
  { key: 'inmunidad', label: '¿Tienes alguna enfermedad infecciosa o que afecte a tus defensas?' },
  { key: 'embarazo', label: '¿Estás embarazada o en periodo de lactancia?' },
  { key: 'medicacion', label: '¿Tomas actualmente alguna medicación?' },
  { key: 'sustancias', label: '¿Has consumido alcohol u otras drogas en las últimas 24 horas?' },
  { key: 'desmayos', label: '¿Tienes tendencia a marearte o desmayarte?' },
];

// Documento informativo (art. 5.2 del Decret 90/2008): riesgos, cuidados y carácter permanente.
function infoDocument(studio, serviceKey) {
  const service = SERVICES[serviceKey] || SERVICES.tatuaje;
  const nombre = studio.name;
  const sections = [
    {
      title: 'En qué consiste',
      text: serviceKey === 'piercing'
        ? 'El piercing consiste en perforar la piel o el cartílago con una aguja estéril de un solo uso para colocar una joya de material apto para primera colocación.'
        : `La técnica consiste en introducir pigmentos en la dermis mediante agujas estériles de un solo uso. ${service.permanent ? 'El resultado es PERMANENTE y su eliminación posterior es costosa, puede requerir varias sesiones de láser y no siempre es completa.' : 'El resultado es semipermanente y se va aclarando con el tiempo; puede requerir retoques.'}`,
    },
    {
      title: 'Riesgos posibles',
      text: 'Aunque se aplican todas las medidas higiénico-sanitarias exigidas, pueden aparecer: infección local, reacción alérgica a los pigmentos o a los materiales, inflamación, sangrado leve, cicatrices o queloides, y cambios en el resultado por una mala cicatrización. Si tienes previsto hacerte una resonancia magnética, informa de que tienes un tatuaje o micropigmentación. Algunos tatuajes pueden limitar temporalmente la donación de sangre.',
    },
    {
      title: 'Cuidados después de la sesión',
      text: 'Lávate las manos antes de tocar la zona. Limpia con agua y jabón neutro 2 o 3 veces al día y aplica una capa fina de la crema recomendada. No rasques ni arranques las costras. Evita el sol, la piscina, el mar, la sauna y los baños largos durante al menos dos semanas. Si observas enrojecimiento creciente, pus, fiebre o dolor intenso, acude a un centro sanitario.',
    },
    {
      title: 'Material y trazabilidad',
      text: `${nombre} utiliza material estéril de un solo uso y pigmentos autorizados. El aplicador anotará en tu ficha la marca, el color y el lote de las tintas utilizadas para garantizar la trazabilidad.`,
    },
    {
      title: 'Menores de edad',
      text: 'Las personas menores de edad necesitan la autorización por escrito de su padre, madre o tutor legal. Las personas menores de 16 años deben aportar además un certificado de madurez.',
    },
    {
      title: 'Protección de datos',
      text: `Responsable: ${nombre}${studio.cif ? ' (' + studio.cif + ')' : ''}. Finalidad: gestionar tu consentimiento informado, cumplir las obligaciones sanitarias y conservar la trazabilidad del servicio. Base legal: tu consentimiento y el cumplimiento de obligaciones legales. Tus datos de salud solo se usan para valorar si es seguro realizar el servicio. No se ceden a terceros salvo obligación legal. Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a ${studio.email || 'el establecimiento'}. También puedes reclamar ante la Autoridad Catalana de Protección de Datos o la AEPD.`,
    },
  ];
  return sections;
}

// Declaraciones que la persona acepta al firmar.
function declarations(studio, serviceKey) {
  const service = SERVICES[serviceKey] || SERVICES.tatuaje;
  return [
    `He leído y entendido el documento informativo sobre la práctica de ${service.label.toLowerCase()} y he podido resolver mis dudas con el aplicador.`,
    'Declaro que los datos de salud que he facilitado son ciertos y que no he omitido información relevante.',
    `Autorizo a ${studio.name} a realizarme el servicio descrito en la zona indicada.`,
  ];
}

module.exports = { CONSENT_VERSION, SERVICES, HEALTH_QUESTIONS, infoDocument, declarations };
