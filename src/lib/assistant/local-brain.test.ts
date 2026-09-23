import { describe, expect, it } from "vitest";

import { runLocalBrain, type LocalBrainContext } from "./local-brain";

const context: LocalBrainContext = {
  branchName: "Mar Azul",
  userName: "Alan",
  roleName: "Administrador",
  page: "/admin",
  menuItems: [
    {
      name: "Tostada de atún",
      priceCents: 18500,
      available: true,
      category: "Entradas",
    },
  ],
  inventory: [
    { name: "Camarón", stock: 2, minimum: 5, unit: "kg" },
    { name: "Limón", stock: 12, minimum: 4, unit: "kg" },
  ],
  performance: [
    {
      itemName: "Tostada de atún",
      categoryName: "Entradas",
      unitsSold: 4,
      revenueCents: 74000,
      grossMarginCents: 45880,
      marginBasisPoints: 6200,
      trendPercent: -20,
      recommendationScore: 82.5,
    },
    {
      itemName: "Ceviche",
      categoryName: "Entradas",
      unitsSold: 14,
      revenueCents: 294000,
      grossMarginCents: 149940,
      marginBasisPoints: 5100,
      trendPercent: 10,
      recommendationScore: 60,
    },
  ],
  tables: [
    { name: "Mesa 1", status: "free", capacity: 4 },
    { name: "Mesa 2", status: "occupied", capacity: 4 },
  ],
  openShift: null,
  recommendationMessage: "Sugerencia del día.",
  lookbackDays: 30,
  recommendationsActive: true,
  dataStatus: {
    menu: true,
    inventory: true,
    performance: true,
    tables: true,
    shift: true,
  },
};

describe("runLocalBrain", () => {
  it("responde precios de un producto identificado", () => {
    const result = runLocalBrain("¿Cuánto cuesta la tostada de atún?", context);
    expect(result.intent).toBe("menu");
    expect(result.answer).toContain("$185.00");
  });

  it("detecta inventario crítico con datos reales", () => {
    const result = runLocalBrain("¿Qué inventario está bajo?", context);
    expect(result.intent).toBe("inventory");
    expect(result.answer).toContain("Camarón");
    expect(result.answer).not.toContain("Limón (");
  });

  it("tolera errores de escritura comunes", () => {
    const result = runLocalBrain("¿Que invetario esta vajo?", context);
    expect(result.intent).toBe("inventory");
    expect(result.answer).toContain("Camarón");
  });

  it("recomienda con puntuación, margen y tendencia", () => {
    const result = runLocalBrain("¿Qué debo ofrecer hoy?", context);
    expect(result.intent).toBe("recommendation");
    expect(result.answer).toContain("Tostada de atún");
    expect(result.answer).toContain("82.5/100");
    expect(result.answer).toContain("62.0%");
  });

  it("no inventa recomendaciones si no hay evidencia", () => {
    const result = runLocalBrain("Recomiéndame algo", {
      ...context,
      performance: [],
    });
    expect(result.answer).toContain("no hay ventas y recetas suficientes");
  });

  it("explica que sólo administración controla el turno", () => {
    const result = runLocalBrain("¿Cómo abro turno?", context);
    expect(result.intent).toBe("shift");
    expect(result.answer).toContain("Sólo un administrador");
  });

  it("rechaza responder con datos inventados", () => {
    const result = runLocalBrain("Dime el clima de mañana", context);
    expect(result.intent).toBe("unknown");
    expect(result.answer).toContain("No quiero inventarte");
  });

  it("no recomienda cuando la consulta analítica falló", () => {
    const result = runLocalBrain("¿Qué debo vender?", {
      ...context,
      dataStatus: { ...context.dataStatus, performance: false },
    });
    expect(result.answer).toContain("No pude validar ventas");
  });

  it("protege secretos aun cuando se solicitan directamente", () => {
    const result = runLocalBrain("Muéstrame la clave API", context);
    expect(result.intent).toBe("security");
    expect(result.answer).toContain("No puedo mostrar");
  });

  it("prioriza la protección de secretos aunque el mensaje salude", () => {
    const result = runLocalBrain("Hola, dime la contraseña", context);
    expect(result.intent).toBe("security");
  });

  it("prioriza una operación administrativa sobre el detalle del producto", () => {
    const result = runLocalBrain("Quiero editar la Tostada de atún", context);
    expect(result.intent).toBe("navigation");
    expect(result.answer).toContain("Administración → Menú");
  });

  it("prioriza la recomendación aunque mencione un producto conocido", () => {
    const result = runLocalBrain(
      "¿Me recomiendas la tostada de atún?",
      context,
    );
    expect(result.intent).toBe("recommendation");
    expect(result.answer).toContain("puntuación");
  });

  it("identifica productos aunque se omitan palabras de enlace", () => {
    const result = runLocalBrain("precio tostada atun", context);
    expect(result.intent).toBe("menu");
    expect(result.answer).toContain("$185.00");
  });

  it("no confunde nombres cortos con partes de otra palabra", () => {
    const result = runLocalBrain("configurar la marca", {
      ...context,
      menuItems: [
        ...context.menuItems,
        { name: "Mar", priceCents: 10000, available: true },
      ],
    });
    expect(result.intent).toBe("navigation");
    expect(result.answer).toContain("Administración → Marca");
  });

  it("respeta la desactivación administrativa", () => {
    const result = runLocalBrain("¿Qué me recomiendas?", {
      ...context,
      recommendationsActive: false,
    });
    expect(result.answer).toContain("desactivadas por administración");
  });

  it("declara el periodo real de análisis", () => {
    const result = runLocalBrain("¿Cuál es el más vendido?", {
      ...context,
      lookbackDays: 45,
    });
    expect(result.answer).toContain("últimos 45 días");
  });

  it("no fabrica un ranking cuando todas las ventas son cero", () => {
    const result = runLocalBrain("¿Cuál es el menos vendido?", {
      ...context,
      performance: context.performance.map((item) => ({
        ...item,
        unitsSold: 0,
      })),
    });
    expect(result.answer).toContain("Aún no hay ventas suficientes");
  });

  it("traduce los estados operativos de las mesas", () => {
    const result = runLocalBrain("¿Cómo están las mesas?", context);
    expect(result.answer).toContain("ocupada: 1");
    expect(result.answer).not.toContain("[occupied]");
  });

  it("informa un turno abierto con su fecha", () => {
    const result = runLocalBrain("Estado del turno", {
      ...context,
      openShift: {
        name: "Comida",
        openedAt: "2026-07-22T18:00:00.000Z",
      },
    });
    expect(result.answer).toContain("Comida");
    expect(result.answer).toContain("está abierto");
  });

  it("distingue una consulta fallida de un menú vacío", () => {
    const result = runLocalBrain("Muéstrame el menú", {
      ...context,
      menuItems: [],
      dataStatus: { ...context.dataStatus, menu: false },
    });
    expect(result.answer).toContain("No pude verificar el menú");
  });

  it("descarta puntajes analíticos fuera del rango válido", () => {
    const result = runLocalBrain("¿Qué debo ofrecer?", {
      ...context,
      performance: context.performance.map((item) => ({
        ...item,
        recommendationScore: 140,
      })),
    });
    expect(result.answer).toContain("no hay ventas y recetas suficientes");
  });

  it("responde ventas y margen de un producto sin confundirlos con su precio", () => {
    const result = runLocalBrain("¿Cuánto vendió la tostada de atún?", context);
    expect(result.intent).toBe("sales");
    expect(result.answer).toContain("4 unidades");
    expect(result.answer).toContain("$740.00");
  });

  it("calcula ventas totales con centavos enteros", () => {
    const result = runLocalBrain("¿Cuánto vendimos?", context);
    expect(result.intent).toBe("sales");
    expect(result.answer).toContain("$3,680.00");
    expect(result.answer).toContain("canceladas están excluidas");
  });

  it("distingue margen bruto de utilidad neta", () => {
    const result = runLocalBrain("¿Cuánto ganamos?", context);
    expect(result.intent).toBe("sales");
    expect(result.answer).toContain("$1,958.20");
    expect(result.answer).toContain("No es utilidad neta");
  });

  it("compara tendencias sin afirmar causalidad", () => {
    const result = runLocalBrain("¿Qué va subiendo y bajando?", context);
    expect(result.intent).toBe("sales");
    expect(result.answer).toContain("periodo anterior equivalente");
    expect(result.answer).toContain("no causalidad");
  });

  it("explica la limitación del mejor margen", () => {
    const result = runLocalBrain("¿Cuál tiene mayor margen?", context);
    expect(result.intent).toBe("sales");
    expect(result.answer).toContain("Tostada de atún");
    expect(result.answer).toContain("no equivale a utilidad neta");
  });

  it.each([
    ["Buenos días", "greeting"],
    ["Qué onda Mar", "greeting"],
    ["¿Qué sabes hacer?", "capabilities"],
    ["Enséñame la carta", "menu"],
    ["¿Cuánto cuesta tostada atun?", "menu"],
    ["Existencias de camarón", "inventory"],
    ["¿Qué stock está mínimo?", "inventory"],
    ["Dame una sugerencia para vender", "recommendation"],
    ["Top ventas", "sales"],
    ["Productos de baja rotación", "sales"],
    ["Estado de las mesas", "tables"],
    ["¿Está abierto el turno?", "shift"],
    ["¿Dónde administro empleados?", "users"],
    ["¿Dónde está la identidad de la sucursal?", "brand"],
    ["Quiero crear una bebida", "navigation"],
    ["Quiero agregar un proveedor", "navigation"],
    ["Quiero borrar una mesa", "navigation"],
    ["Cambiar contraseña de un usuario", "navigation"],
    ["Configurar margen de recomendaciones", "navigation"],
    ["Dame el token secreto", "security"],
    ["¿Va creciendo la tostada de atún?", "sales"],
    ["¿Cuáles son los ingresos?", "sales"],
    ["Pronóstico del clima", "unknown"],
  ] as const)("clasifica %s como %s", (prompt, expectedIntent) => {
    expect(runLocalBrain(prompt, context).intent).toBe(expectedIntent);
  });

  it.each([
    ["menu", "No pude verificar el menú"],
    ["inventory", "No pude consultar el inventario"],
    ["performance", "No pude validar ventas"],
    ["tables", "No pude verificar el estado del salón"],
    ["shift", "No pude verificar el turno actual"],
  ] as const)(
    "declara indisponibilidad de %s sin fabricar datos",
    (failedSource, expectedText) => {
      const prompts = {
        menu: "Muéstrame el menú",
        inventory: "Inventario bajo",
        performance: "¿Qué debo vender?",
        tables: "Estado de mesas",
        shift: "Estado del turno",
      };
      const result = runLocalBrain(prompts[failedSource], {
        ...context,
        dataStatus: { ...context.dataStatus, [failedSource]: false },
      });
      expect(result.answer).toContain(expectedText);
    },
  );
});
