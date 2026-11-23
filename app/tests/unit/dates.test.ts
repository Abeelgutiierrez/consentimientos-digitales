import { describe, expect, it } from "vitest";
import { addDays, ageOn, daysToBirthday, fmtDate, fmtDateTime, fmtLongDate, isoDateInMadrid } from "@/core/dates";

describe("fechas en hora de Madrid", () => {
  it("el día cambia según Madrid, no según UTC", () => {
    // 23:30 UTC del 31/12 ya es 1 de enero en Madrid (UTC+1 en invierno)
    expect(isoDateInMadrid(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(fmtDateTime("2026-07-01T22:15:00Z")).toBe("02/07/2026 00:15"); // verano UTC+2
  });

  it("calcula la edad cumplida", () => {
    const ref = new Date("2026-11-23T12:00:00Z");
    expect(ageOn("2008-11-23", ref)).toBe(18); // cumple hoy
    expect(ageOn("2008-11-24", ref)).toBe(17); // cumple mañana
    expect(ageOn("2010-11-24", ref)).toBe(15);
    expect(ageOn("2026-02-30", ref)).toBeNull();
    expect(ageOn("no", ref)).toBeNull();
  });

  it("días hasta el cumpleaños, incluido el 29 de febrero", () => {
    const ref = new Date("2026-11-23T10:00:00Z");
    expect(daysToBirthday("1990-11-23", ref)).toBe(0);
    expect(daysToBirthday("1990-11-25", ref)).toBe(2);
    expect(daysToBirthday("1990-11-22", ref)).toBe(364);
    expect(daysToBirthday("2000-02-29", new Date("2027-02-28T10:00:00Z"))).toBe(0);
  });

  it("formatea fechas", () => {
    expect(fmtDate("2026-03-05")).toBe("05/03/2026");
    expect(fmtLongDate("2027-03-05")).toBe("5 de marzo de 2027");
    expect(fmtLongDate("2027-04-05", "ca")).toBe("5 d'abril de 2027");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
