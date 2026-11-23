"use client";
import { type ReactElement, type ReactNode, cloneElement, useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";

// Formulario del cliente por pasos (móvil primero). Mismas reglas que la demo; el servidor
// vuelve a validar todo. Los textos legales llegan del servidor (son lo que se firma).

export interface FormConfig {
  slug: string;
  services: { key: string; label: string }[];
  artists: { id: string; name: string }[];
  legal: Record<string, { info: { title: string; text: string }[]; declarations: string[] }>;
  healthQuestions: { key: string; label: string }[];
  checkTexts: { privacy: string; marketing: string; images: string };
  legalInOtherLanguage: boolean;
}

type Errors = Record<string, string>;
const TOTAL = 5;
const RELATIONS = [["madre", "Madre"], ["padre", "Padre"], ["tutor", "Tutor/a legal"]] as const;

function stepOf(field: string): number {
  if (/^(firstName|lastName|dni|birthDate|phone|email|address|minor\.)/.test(field)) return 0;
  if (/^(service|artistId|zone|description)$/.test(field)) return 1;
  if (/^(health\.|healthNotes)/.test(field)) return 2;
  if (/^checks\./.test(field)) return 3;
  return 4;
}

function ageFrom(birthDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const b = new Date(birthDate + "T00:00:00");
  if (Number.isNaN(b.getTime())) return null;
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
}

export function ConsentForm({ config }: { config: FormConfig }) {
  const t = useTranslations("form");
  const tv = useTranslations("validation");
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [v, setV] = useState({
    firstName: "", lastName: "", dni: "", birthDate: "", phone: "", email: "", address: "",
    tutorName: "", tutorDni: "", relation: "", maturityCert: false,
    service: config.services[0]?.key ?? "", artistId: "", zone: "", description: "", healthNotes: "",
    read: false, privacy: false, marketing: false, images: false,
  });
  const [health, setHealth] = useState<Record<string, "si" | "no" | undefined>>({});
  const mainPad = useRef<SignaturePadHandle>(null);
  const tutorPad = useRef<SignaturePadHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const age = ageFrom(v.birthDate);
  const isMinor = age !== null && age >= 0 && age < 18;
  const anyYes = Object.values(health).some((x) => x === "si");
  const legal = config.legal[v.service] ?? Object.values(config.legal)[0]!;

  const clearError = useCallback((field: string) => setErrors((prev) => {
    if (!(field in prev)) return prev;
    const next = { ...prev };
    delete next[field];
    return next;
  }), []);
  const clearMainSig = useCallback(() => clearError("signature"), [clearError]);
  const clearTutorSig = useCallback(() => clearError("tutorSignature"), [clearError]);

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target instanceof HTMLInputElement && e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setV((prev) => ({ ...prev, [k]: value }));
    clearError(k === "tutorName" || k === "tutorDni" || k === "relation" || k === "maturityCert" ? `minor.${k}` : ["read", "privacy", "marketing"].includes(k) ? `checks.${k}` : k);
  };

  function validateStep(i: number): Errors {
    const e: Errors = {};
    const s = (x: string) => x.trim();
    if (i === 0) {
      if (!s(v.firstName)) e.firstName = "firstName";
      if (!s(v.lastName)) e.lastName = "lastName";
      if (v.dni.replace(/[\s-]/g, "").length < 6) e.dni = "document";
      if (age === null || age < 0 || age > 110) e.birthDate = "birthDate";
      if (v.phone.replace(/\D/g, "").length < 9) e.phone = "phone";
      if (s(v.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s(v.email))) e.email = "email";
      if (isMinor) {
        if (!s(v.tutorName)) e["minor.tutorName"] = "tutorName";
        if (v.tutorDni.replace(/[\s-]/g, "").length < 6) e["minor.tutorDni"] = "document";
        if (!v.relation) e["minor.relation"] = "relation";
        if (age! < 16 && !v.maturityCert) e["minor.maturityCert"] = "maturityCert";
      }
    }
    if (i === 1) {
      if (!v.service) e.service = "service";
      if (!v.artistId) e.artistId = "artist";
      if (!s(v.zone)) e.zone = "zone";
    }
    if (i === 2) {
      for (const q of config.healthQuestions) if (!health[q.key]) e[`health.${q.key}`] = "healthAnswer";
      if (anyYes && !s(v.healthNotes)) e.healthNotes = "healthNotes";
    }
    if (i === 3) {
      if (!v.read) e["checks.read"] = "checkRead";
      if (!v.privacy) e["checks.privacy"] = "checkPrivacy";
      if (v.marketing && !s(v.email)) e["checks.marketing"] = "marketingNeedsEmail";
    }
    if (i === 4) {
      if (mainPad.current?.isEmpty()) e.signature = "signature.missing";
      if (isMinor && tutorPad.current?.isEmpty()) e.tutorSignature = "signature.missing";
    }
    return e;
  }

  function show(i: number) {
    setStep(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function focusFirstError() {
    requestAnimationFrame(() => formRef.current?.querySelector(".has-error")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function submit() {
    setSubmitError(null);
    setSending(true);
    const payload = {
      firstName: v.firstName.trim(), lastName: v.lastName.trim(), dni: v.dni.trim(), birthDate: v.birthDate,
      phone: v.phone.trim(), email: v.email.trim(), address: v.address.trim(),
      service: v.service, artistId: v.artistId, zone: v.zone.trim(), description: v.description.trim(),
      health: Object.fromEntries(config.healthQuestions.map((q) => [q.key, health[q.key] === "si"])),
      healthNotes: anyYes ? v.healthNotes.trim() : "",
      checks: { read: v.read, privacy: v.privacy, marketing: v.marketing, images: v.images },
      signature: mainPad.current!.toData(),
      ...(isMinor ? {
        minor: { tutorName: v.tutorName.trim(), tutorDni: v.tutorDni.trim(), relation: v.relation, maturityCert: v.maturityCert },
        tutorSignature: tutorPad.current!.toData(),
      } : {}),
    };
    try {
      const res = await fetch(`/api/s/${encodeURIComponent(config.slug)}/consents`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { redirect?: string; errors?: Errors };
      if (res.ok && body.redirect) {
        window.location.href = body.redirect;
        return;
      }
      if (body.errors && Object.keys(body.errors).length) {
        setErrors(body.errors);
        const target = Math.min(...Object.keys(body.errors).map(stepOf));
        if (target !== step) show(target);
        focusFirstError();
      } else {
        setSubmitError(res.status === 429 ? t("rateLimited") : t("sendError"));
      }
    } catch {
      setSubmitError(t("offline"));
    }
    setSending(false);
  }

  function next() {
    const e = validateStep(step);
    setErrors(e);
    if (Object.keys(e).length) {
      focusFirstError();
      return;
    }
    if (step === TOTAL - 1) void submit();
    else show(step + 1);
  }

  const err = (field: string) => (errors[field] ? tv(errors[field] as never) : "");
  // El error va fuera de la etiqueta y enlazado con aria-describedby: así el lector de pantalla
  // anuncia «Nombre» como nombre del campo y el error como descripción.
  const Field = ({ name, label, children, extra }: { name: string; label: ReactNode; children: ReactElement<Record<string, unknown>>; extra?: ReactNode }) => {
    const errId = `err-${name.replace(/\W/g, "-")}`;
    return (
      <div className={`field-box${errors[name] ? " has-error" : ""}`} data-field={name}>
        <label className="field">
          <span>{label}</span>
          {cloneElement(children, { "aria-invalid": errors[name] ? true : undefined, "aria-describedby": errors[name] ? errId : undefined })}
        </label>
        <div className="err" id={errId}>{err(name)}</div>
        {extra}
      </div>
    );
  };
  const box = (name: string) => `${errors[name] ? "has-error" : ""}`;
  const fullName = `${v.firstName} ${v.lastName}`.trim();
  const today = useMemo(() => new Date().toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" }), []);

  return (
    <form
      ref={formRef}
      className="pub-card"
      noValidate
      autoComplete="on"
      onSubmit={(e) => { e.preventDefault(); next(); }}
      onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); next(); } }}
    >
      <div className="progress" aria-hidden="true">
        {Array.from({ length: TOTAL }, (_, i) => <i key={i} className={i <= step ? "on" : ""} />)}
      </div>

      <section className={`step${step === 0 ? "" : " hidden"}`} aria-hidden={step !== 0}>
        <div className="step-kicker">{t("stepOf", { n: 1, total: TOTAL })}</div>
        <h2>{t("s1Title")}</h2>
        <p className="lead">{t("s1Lead")}</p>
        <div className="row">
          {Field({ name: "firstName", label: t("firstName"), children: <input type="text" name="firstName" autoComplete="given-name" value={v.firstName} onChange={set("firstName")} /> })}
          {Field({ name: "lastName", label: t("lastName"), children: <input type="text" name="lastName" autoComplete="family-name" value={v.lastName} onChange={set("lastName")} /> })}
        </div>
        <div className="row">
          {Field({ name: "dni", label: t("dni"), children: <input type="text" name="dni" autoCapitalize="characters" value={v.dni} onChange={set("dni")} /> })}
          {Field({ name: "birthDate", label: t("birthDate"), children: <input type="date" name="birthDate" autoComplete="bday" value={v.birthDate} onChange={set("birthDate")} /> })}
        </div>
        <div className="row">
          {Field({ name: "phone", label: t("phone"), children: <input type="tel" name="phone" autoComplete="tel" inputMode="tel" value={v.phone} onChange={set("phone")} /> })}
          {Field({ name: "email", label: t("email"), children: <input type="email" name="email" autoComplete="email" inputMode="email" value={v.email} onChange={set("email")} /> })}
        </div>
        {Field({ name: "address", label: <>{t("address")} <small>{t("optional")}</small></>, children: <input type="text" name="address" autoComplete="street-address" value={v.address} onChange={set("address")} /> })}
        {isMinor && (
          <div>
            <div className="notice warn"><b>{t("minorNotice")}</b> {t("minorNoticeText")}</div>
            <div className="row">
              {Field({ name: "minor.tutorName", label: t("tutorName"), children: <input type="text" name="tutorName" value={v.tutorName} onChange={set("tutorName")} /> })}
              {Field({ name: "minor.tutorDni", label: t("tutorDni"), children: <input type="text" name="tutorDni" autoCapitalize="characters" value={v.tutorDni} onChange={set("tutorDni")} /> })}
            </div>
            {Field({
              name: "minor.relation", label: t("relation"), children: (
                <select name="relation" value={v.relation} onChange={set("relation")}>
                  <option value="">{t("choose")}</option>
                  {RELATIONS.map(([k, value]) => <option key={k} value={value}>{t(`relations.${k}`)}</option>)}
                </select>
              ),
            })}
            {age! < 16 && (
              <div className={box("minor.maturityCert")} data-field="minor.maturityCert">
                <label className="check">
                  <input type="checkbox" name="maturityCert" checked={v.maturityCert} onChange={set("maturityCert")} />
                  <div><b>{t("maturity")}</b><br /><small>{t("maturityHint")}</small></div>
                </label>
                <div className="err">{err("minor.maturityCert")}</div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className={`step${step === 1 ? "" : " hidden"}`} aria-hidden={step !== 1}>
        <div className="step-kicker">{t("stepOf", { n: 2, total: TOTAL })}</div>
        <h2>{t("s2Title")}</h2>
        <p className="lead">{t("s2Lead")}</p>
        <div className={box("service")} data-field="service">
          <div className="choice-grid" role="radiogroup">
            {config.services.map((s) => (
              <label className="choice" key={s.key}>
                <input type="radio" name="service" value={s.key} checked={v.service === s.key} onChange={set("service")} />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
          <div className="err">{err("service")}</div>
        </div>
        {Field({
          name: "artistId", label: t("artist"), children: (
            <select name="artistId" value={v.artistId} onChange={set("artistId")}>
              <option value="">{t("choose")}</option>
              {config.artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          ),
        })}
        {Field({ name: "zone", label: t("zone"), children: <input type="text" name="zone" placeholder={t("zonePh")} value={v.zone} onChange={set("zone")} /> })}
        {Field({ name: "description", label: <>{t("description")} <small>{t("optional")}</small></>, children: <textarea name="description" placeholder={t("descriptionPh")} value={v.description} onChange={set("description")} /> })}
      </section>

      <section className={`step${step === 2 ? "" : " hidden"}`} aria-hidden={step !== 2}>
        <div className="step-kicker">{t("stepOf", { n: 3, total: TOTAL })}</div>
        <h2>{t("s3Title")}</h2>
        <p className="lead">{t("s3Lead")}</p>
        {config.legalInOtherLanguage && <div className="notice" style={{ fontSize: ".82rem" }}>{t("legalLangNote")}</div>}
        {config.healthQuestions.map((q) => (
          <div key={q.key} className={`q ${box(`health.${q.key}`)}`} data-field={`health.${q.key}`}>
            <div className="q-row">
              <div id={`q-${q.key}`}>{q.label}</div>
              <div className="seg" role="radiogroup" aria-labelledby={`q-${q.key}`}>
                {(["no", "si"] as const).map((ans) => (
                  <label key={ans}>
                    <input type="radio" name={`h_${q.key}`} value={ans} checked={health[q.key] === ans}
                      onChange={() => { setHealth((h) => ({ ...h, [q.key]: ans })); clearError(`health.${q.key}`); }} />
                    <span>{ans === "si" ? "Sí" : "No"}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="err">{err(`health.${q.key}`)}</div>
          </div>
        ))}
        {anyYes && (
          <div style={{ marginTop: 12 }}>
            {Field({ name: "healthNotes", label: t("healthNotes"), children: <textarea name="healthNotes" value={v.healthNotes} onChange={set("healthNotes")} /> })}
          </div>
        )}
      </section>

      <section className={`step${step === 3 ? "" : " hidden"}`} aria-hidden={step !== 3}>
        <div className="step-kicker">{t("stepOf", { n: 4, total: TOTAL })}</div>
        <h2>{t("s4Title")}</h2>
        <p className="lead">{t("s4Lead")}</p>
        {config.legalInOtherLanguage && <div className="notice" style={{ fontSize: ".82rem" }}>{t("legalLangNote")}</div>}
        <div className="info-doc" tabIndex={0}>
          {legal.info.map((s) => (
            <div key={s.title}><h3>{s.title}</h3><p>{s.text}</p></div>
          ))}
        </div>
        <div className={box("checks.read")} data-field="checks.read">
          <label className="check">
            <input type="checkbox" name="c_read" checked={v.read} onChange={set("read")} />
            <div>{legal.declarations.map((d, i) => <div key={i} style={i ? { marginTop: 6 } : undefined}>{d}</div>)}</div>
          </label>
          <div className="err">{err("checks.read")}</div>
        </div>
        <div className={box("checks.privacy")} data-field="checks.privacy">
          <label className="check"><input type="checkbox" name="c_privacy" checked={v.privacy} onChange={set("privacy")} /><div>{config.checkTexts.privacy}</div></label>
          <div className="err">{err("checks.privacy")}</div>
        </div>
        <div className={box("checks.marketing")} data-field="checks.marketing">
          <label className="check"><input type="checkbox" name="c_marketing" checked={v.marketing} onChange={set("marketing")} /><div><span className="opt">{t("optionalTag")}</span><br />{config.checkTexts.marketing}</div></label>
          <div className="err">{err("checks.marketing")}</div>
        </div>
        <label className="check"><input type="checkbox" name="c_images" checked={v.images} onChange={set("images")} /><div><span className="opt">{t("optionalTag")}</span><br />{config.checkTexts.images}</div></label>
      </section>

      <section className={`step${step === 4 ? "" : " hidden"}`} aria-hidden={step !== 4}>
        <div className="step-kicker">{t("stepOf", { n: 5, total: TOTAL })}</div>
        <h2>{t("s5Title")}</h2>
        <p className="lead">{isMinor ? t("s5LeadMinor") : t("s5Lead")}</p>
        <div className={`sig-block ${box("signature")}`} data-field="signature">
          <div className="label">{fullName ? t("signatureOf", { name: fullName }) : t("yourSignature")}</div>
          <SignaturePad ref={mainPad} hint={t("signHere")} clearLabel={t("clear")} label={t("yourSignature")} testId="firma" onChange={clearMainSig}
            footer={<small className="muted">{today}</small>} />
          <div className="err">{err("signature")}</div>
        </div>
        {isMinor && (
          <div className={`sig-block ${box("tutorSignature")}`} data-field="tutorSignature">
            <div className="label">{t("tutorSignature")}</div>
            <SignaturePad ref={tutorPad} hint={t("tutorSignHere")} clearLabel={t("clear")} label={t("tutorSignature")} testId="firma-tutor" onChange={clearTutorSig} />
            <div className="err">{err("tutorSignature")}</div>
          </div>
        )}
        <div className="notice" style={{ fontSize: ".82rem" }}>{t("signNotice")}</div>
        {submitError && <div className="notice bad" role="alert">{submitError}</div>}
      </section>

      <div className="nav">
        {step > 0 && <button type="button" className="btn ghost" onClick={() => show(step - 1)}>{t("back")}</button>}
        <button type="submit" className="btn lg" disabled={sending}>
          {sending ? t("submitting") : step === TOTAL - 1 ? t("submit") : t("continue")}
        </button>
      </div>
    </form>
  );
}
