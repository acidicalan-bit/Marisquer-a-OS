export type AssistantMode = "openai" | "local";

export type LocalBrainContext = {
  branchName: string;
  userName: string;
  roleName?: string | null;
  page: string;
  menuItems: Array<{
    name: string;
    priceCents: number;
    available: boolean;
    category?: string | null;
  }>;
  inventory: Array<{
    name: string;
    stock: number;
    minimum: number;
    unit: string;
  }>;
  performance: Array<{
    itemName: string;
    categoryName?: string | null;
    unitsSold: number;
    revenueCents: number;
    grossMarginCents: number;
    marginBasisPoints: number;
    trendPercent: number;
    recommendationScore: number;
  }>;
  tables: Array<{ name: string; status: string; capacity: number }>;
  openShift: { name: string; openedAt: string } | null;
  recommendationMessage?: string | null;
  lookbackDays: number;
  recommendationsActive: boolean;
  dataStatus: {
    menu: boolean;
    inventory: boolean;
    performance: boolean;
    tables: boolean;
    shift: boolean;
  };
};

export type LocalBrainResult = {
  answer: string;
  intent:
    | "greeting"
    | "capabilities"
    | "menu"
    | "inventory"
    | "sales"
    | "recommendation"
    | "tables"
    | "shift"
    | "users"
    | "brand"
    | "security"
    | "navigation"
    | "unknown";
};

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function editDistance(left: string, right: string) {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function approximatelyMatches(text: string, term: string) {
  if (text.includes(term)) return true;
  const words = text.split(" ");
  return term.split(" ").every((expected) =>
    words.some((word) => {
      if (expected.length < 5) return word === expected;
      const tolerance = expected.length >= 9 ? 2 : 1;
      return editDistance(word, expected) <= tolerance;
    }),
  );
}

function has(text: string, terms: string[]) {
  return terms.some((term) => approximatelyMatches(text, term));
}

function list(items: string[], empty: string) {
  if (!items.length) return empty;
  return items.slice(0, 5).join("; ");
}

function entityMatches(message: string, name: string) {
  const normalizedName = normalize(name);
  if (` ${message} `.includes(` ${normalizedName} `)) return true;
  const meaningfulWords = normalizedName
    .split(" ")
    .filter(
      (word) =>
        word.length >= 3 && !["con", "del", "los", "las"].includes(word),
    );
  return (
    meaningfulWords.length > 0 &&
    meaningfulWords.every((word) => approximatelyMatches(message, word))
  );
}

function localizedUnit(unit: string) {
  return (
    {
      g: "g",
      kg: "kg",
      ml: "ml",
      l: "l",
      piece: "pzas.",
      portion: "porciones",
    }[unit] ?? unit
  );
}

function localizedTableStatus(status: string) {
  return (
    {
      free: "libre",
      occupied: "ocupada",
      reserved: "reservada",
      cleaning: "en limpieza",
      disabled: "fuera de servicio",
    }[status] ?? status
  );
}

function matchedMenuItem(message: string, context: LocalBrainContext) {
  return context.menuItems
    .filter((item) => normalize(item.name).length >= 3)
    .sort((left, right) => right.name.length - left.name.length)
    .find((item) => entityMatches(message, item.name));
}

function matchedIngredient(message: string, context: LocalBrainContext) {
  return context.inventory
    .filter((item) => normalize(item.name).length >= 3)
    .sort((left, right) => right.name.length - left.name.length)
    .find((item) => entityMatches(message, item.name));
}

function recommendation(context: LocalBrainContext) {
  return [...context.performance]
    .filter(
      (item) =>
        Number.isFinite(item.recommendationScore) &&
        Number.isFinite(item.marginBasisPoints) &&
        item.recommendationScore > 0 &&
        item.recommendationScore <= 100,
    )
    .sort(
      (left, right) => right.recommendationScore - left.recommendationScore,
    )[0];
}

function navigationAnswer(message: string) {
  if (has(message, ["menu", "platillo", "bebida", "categoria"]))
    return "Abre Administración → Menú. Ahí puedes crear o editar platillos, bebidas, categorías, precios, disponibilidad e imágenes.";
  if (has(message, ["inventario", "ingrediente", "producto", "proveedor"]))
    return "Abre Administración → Inventario. Ahí puedes registrar existencias, mínimos, costos, movimientos y proveedores.";
  if (has(message, ["mesa", "salon", "seccion", "estacion"]))
    return "Abre Administración → Salón. Ahí puedes administrar mesas, secciones y estaciones de preparación.";
  if (has(message, ["usuario", "contrasena", "password", "rol", "equipo"]))
    return "Abre Administración → Equipo. Los cambios de usuario, rol o contraseña requieren permisos administrativos y confirmación en el formulario.";
  if (has(message, ["logo", "marca", "restaurante", "nombre"]))
    return "Abre Administración → Marca. Puedes cambiar el nombre, cargar un logo, ajustar tamaño y posición o generar una propuesta cuando la IA esté disponible.";
  if (has(message, ["venta", "recomendacion", "margen", "reporte"]))
    return "Abre Administración → Inteligencia para revisar ventas, márgenes, tendencias y configurar el criterio de recomendaciones.";
  return null;
}

export function runLocalBrain(
  rawMessage: string,
  context: LocalBrainContext,
): LocalBrainResult {
  const message = normalize(rawMessage);
  const menuMatch = matchedMenuItem(message, context);
  const ingredientMatch = matchedIngredient(message, context);
  const asksForRecommendation = has(message, [
    "recomienda",
    "recomendacion",
    "ofrecer",
    "vender hoy",
    "que vendo",
    "debo vender",
    "conviene vender",
    "sugerencia",
  ]);
  const asksForSalesRanking = has(message, [
    "mas vendido",
    "mas consumido",
    "top ventas",
    "mejor vendido",
    "menos vendido",
    "menos consumido",
    "baja venta",
    "baja rotacion",
  ]);
  const asksForSalesAnalysis =
    asksForSalesRanking ||
    has(message, [
      "ventas",
      "vendido",
      "vendio",
      "ingreso",
      "facturacion",
      "ganancia",
      "utilidad",
      "margen",
      "tendencia",
      "subiendo",
      "bajando",
      "creciendo",
      "cayendo",
    ]);
  const asksForSecret = has(message, [
    "api key",
    "clave api",
    "token secreto",
    "secret key",
    "service role",
    "pin empleado",
    "dime la contrasena",
    "muestra la contrasena",
  ]);

  if (asksForSecret) {
    return {
      intent: "security",
      answer:
        "No puedo mostrar, recuperar ni solicitar contraseñas, PIN, tokens o claves API. Un administrador puede reemplazar credenciales desde el módulo autorizado, pero los valores secretos nunca aparecen en el chat.",
    };
  }

  if (
    has(message, [
      "hola",
      "buenos dias",
      "buenas tardes",
      "buenas noches",
      "que onda",
    ])
  ) {
    return {
      intent: "greeting",
      answer: `Hola, ${context.userName}. Soy Mar en modo local inteligente para ${context.branchName}. Puedo analizar ventas, recomendar productos, revisar inventario y guiarte por la administración.`,
    };
  }

  if (
    has(message, [
      "como agrego",
      "como creo",
      "quiero agregar",
      "quiero crear",
      "editar",
      "modificar",
      "borrar",
      "eliminar",
      "configurar",
      "cambiar contrasena",
      "cambiar password",
    ])
  ) {
    const route = navigationAnswer(message);
    if (route) return { intent: "navigation", answer: route };
    if (menuMatch) {
      return {
        intent: "navigation",
        answer:
          "Abre Administración → Menú, localiza el elemento y usa Editar. Ahí puedes cambiar nombre, descripción, precio, categoría, disponibilidad e imagen; el cambio sólo se guarda al confirmar el formulario.",
      };
    }
    if (ingredientMatch) {
      return {
        intent: "navigation",
        answer:
          "Abre Administración → Inventario, localiza el producto y usa Editar. Las existencias se ajustan mediante un movimiento para conservar trazabilidad.",
      };
    }
  }

  if (
    has(message, [
      "que puedes",
      "que sabes",
      "ayuda",
      "opciones",
      "como funcionas",
    ])
  ) {
    return {
      intent: "capabilities",
      answer:
        "Puedo decirte qué vender, cuáles productos se venden más o menos, qué inventario está bajo, el estado de mesas y turno, precios del menú y dónde editar usuarios, marca o configuración.",
    };
  }

  if (menuMatch && !asksForRecommendation && !asksForSalesAnalysis) {
    return {
      intent: "menu",
      answer: `${menuMatch.name} cuesta ${money.format(menuMatch.priceCents / 100)} y está ${menuMatch.available ? "disponible" : "marcado como no disponible"}${menuMatch.category ? ` en ${menuMatch.category}` : ""}. Para modificarlo abre Administración → Menú.`,
    };
  }

  if (
    has(message, [
      "menu",
      "carta",
      "platillos disponibles",
      "bebidas disponibles",
      "precios",
      "cuanto cuesta",
    ])
  ) {
    if (!context.dataStatus.menu) {
      return {
        intent: "menu",
        answer:
          "No pude verificar el menú en la base de datos en este momento. Reintenta antes de informar precios o disponibilidad.",
      };
    }
    const available = context.menuItems.filter((item) => item.available);
    return {
      intent: "menu",
      answer: available.length
        ? `Hay ${available.length} elementos disponibles. Algunos son: ${list(
            available.map(
              (item) => `${item.name} (${money.format(item.priceCents / 100)})`,
            ),
            "",
          )}. Dime el nombre de uno para darte su detalle.`
        : "No hay platillos o bebidas marcados como disponibles en este momento.",
    };
  }

  if (ingredientMatch && !asksForRecommendation && !asksForSalesAnalysis) {
    const low = ingredientMatch.stock <= ingredientMatch.minimum;
    return {
      intent: "inventory",
      answer: `${ingredientMatch.name}: ${ingredientMatch.stock} ${localizedUnit(ingredientMatch.unit)} disponibles; mínimo ${ingredientMatch.minimum} ${localizedUnit(ingredientMatch.unit)}. ${low ? "Está en nivel crítico y conviene reabastecerlo." : "El nivel está por encima del mínimo."}`,
    };
  }

  if (
    has(message, [
      "inventario",
      "stock",
      "existencia",
      "agotado",
      "reabastecer",
      "minimo",
    ])
  ) {
    if (!context.dataStatus.inventory) {
      return {
        intent: "inventory",
        answer:
          "No pude consultar el inventario en la base de datos. No asumiré existencias: reintenta antes de comprar, vender o reabastecer.",
      };
    }
    const lowStock = context.inventory
      .filter((item) => item.stock <= item.minimum)
      .sort(
        (left, right) =>
          left.stock / Math.max(left.minimum, 1) -
          right.stock / Math.max(right.minimum, 1),
      );
    return {
      intent: "inventory",
      answer: lowStock.length
        ? `Hay ${lowStock.length} insumo${lowStock.length === 1 ? "" : "s"} en nivel crítico: ${list(
            lowStock.map(
              (item) =>
                `${item.name} (${item.stock}/${item.minimum} ${localizedUnit(item.unit)})`,
            ),
            "",
          )}. Revisa Administración → Inventario antes del servicio.`
        : `No detecto inventario por debajo del mínimo entre ${context.inventory.length} insumos activos.`,
    };
  }

  if (asksForRecommendation) {
    if (!context.recommendationsActive) {
      return {
        intent: "recommendation",
        answer:
          "Las recomendaciones comerciales están desactivadas por administración. Puedes reactivarlas en Administración → Inteligencia.",
      };
    }
    if (!context.dataStatus.performance) {
      return {
        intent: "recommendation",
        answer:
          "No pude validar ventas, recetas y márgenes. No generaré una recomendación comercial sin evidencia; reintenta en unos momentos.",
      };
    }
    const top = recommendation(context);
    if (!top) {
      return {
        intent: "recommendation",
        answer:
          "Todavía no hay ventas y recetas suficientes para calcular una recomendación confiable. Registra recetas, costos y ventas; después priorizaré margen, baja rotación e inventario según la configuración del panel.",
      };
    }
    const configured = context.recommendationMessage?.trim();
    return {
      intent: "recommendation",
      answer: `${configured ? `Mensaje configurado: “${configured.slice(0, 200)}”. ` : ""}Conviene ofrecer ${top.itemName}: puntuación ${top.recommendationScore.toFixed(1)}/100 durante los últimos ${context.lookbackDays} días, ${top.unitsSold} vendidos y margen unitario estimado ${(top.marginBasisPoints / 100).toFixed(1)}%. ${top.trendPercent < 0 ? `Sus ventas bajaron ${Math.abs(top.trendPercent).toFixed(1)}% contra el periodo anterior equivalente; puede ser una oportunidad de impulso.` : "Combínalo con una recomendación breve y natural al tomar la orden."}`,
    };
  }

  if (asksForSalesAnalysis && menuMatch) {
    if (!context.dataStatus.performance) {
      return {
        intent: "sales",
        answer:
          "No pude consultar el rendimiento de ventas. Reintenta antes de usar esta cifra.",
      };
    }
    const item = context.performance.find((row) =>
      entityMatches(normalize(row.itemName), menuMatch.name),
    );
    return {
      intent: "sales",
      answer: item
        ? `${item.itemName} registró ${item.unitsSold} unidades y ${money.format(item.revenueCents / 100)} en ventas durante los últimos ${context.lookbackDays} días. Margen bruto unitario estimado: ${(item.marginBasisPoints / 100).toFixed(1)}%; tendencia contra el periodo anterior: ${item.trendPercent > 0 ? "+" : ""}${item.trendPercent.toFixed(1)}%.`
        : `No encontré ventas verificables para ${menuMatch.name} en los últimos ${context.lookbackDays} días.`,
    };
  }

  if (
    has(message, [
      "mas vendido",
      "mas consumido",
      "top ventas",
      "mejor vendido",
    ])
  ) {
    if (!context.dataStatus.performance) {
      return {
        intent: "sales",
        answer:
          "No pude consultar el rendimiento de ventas. Reintenta antes de usar este ranking para una decisión.",
      };
    }
    const best = [...context.performance].sort(
      (left, right) => right.unitsSold - left.unitsSold,
    );
    return {
      intent: "sales",
      answer: best.some((item) => item.unitsSold > 0)
        ? `Los más vendidos de los últimos ${context.lookbackDays} días son: ${list(
            best.map((item) => `${item.itemName} (${item.unitsSold})`),
            "",
          )}.`
        : "Aún no hay ventas suficientes para construir el ranking.",
    };
  }

  if (
    has(message, [
      "menos vendido",
      "menos consumido",
      "baja venta",
      "baja rotacion",
    ])
  ) {
    if (!context.dataStatus.performance) {
      return {
        intent: "sales",
        answer:
          "No pude consultar el rendimiento de ventas. No identificaré baja rotación sin datos verificados.",
      };
    }
    const slow = [...context.performance].sort(
      (left, right) => left.unitsSold - right.unitsSold,
    );
    return {
      intent: "sales",
      answer: slow.some((item) => item.unitsSold > 0)
        ? `Los de menor rotación de los últimos ${context.lookbackDays} días son: ${list(
            slow.map((item) => `${item.itemName} (${item.unitsSold})`),
            "",
          )}. Antes de impulsarlos revisa margen, receta e inventario en Inteligencia.`
        : "Aún no hay ventas suficientes para identificar productos de baja rotación.",
    };
  }

  if (has(message, ["mejor margen", "mayor margen", "margen mas alto"])) {
    if (!context.dataStatus.performance) {
      return {
        intent: "sales",
        answer: "No pude validar los márgenes en la base de datos.",
      };
    }
    const highest = [...context.performance]
      .filter(
        (item) =>
          item.marginBasisPoints > 0 && Number.isFinite(item.marginBasisPoints),
      )
      .sort(
        (left, right) => right.marginBasisPoints - left.marginBasisPoints,
      )[0];
    return {
      intent: "sales",
      answer: highest
        ? `${highest.itemName} tiene el mayor margen bruto unitario estimado: ${(highest.marginBasisPoints / 100).toFixed(1)}%. Esto no equivale a utilidad neta porque no incluye renta, nómina ni otros gastos operativos.`
        : "No hay recetas y costos suficientes para comparar márgenes.",
    };
  }

  if (
    has(message, [
      "cuanto vendimos",
      "venta total",
      "ventas totales",
      "ingresos",
      "facturacion",
    ])
  ) {
    if (!context.dataStatus.performance) {
      return {
        intent: "sales",
        answer: "No pude validar el total de ventas en la base de datos.",
      };
    }
    const revenue = context.performance.reduce(
      (total, item) => total + item.revenueCents,
      0,
    );
    return {
      intent: "sales",
      answer: `Las ventas registradas en los últimos ${context.lookbackDays} días suman ${money.format(revenue / 100)}; las órdenes canceladas están excluidas.`,
    };
  }

  if (
    has(message, [
      "cuanto ganamos",
      "ganancia",
      "utilidad",
      "margen bruto total",
    ])
  ) {
    if (!context.dataStatus.performance) {
      return {
        intent: "sales",
        answer: "No pude validar el margen bruto en la base de datos.",
      };
    }
    const grossMargin = context.performance.reduce(
      (total, item) => total + item.grossMarginCents,
      0,
    );
    return {
      intent: "sales",
      answer: `El margen bruto estimado de los últimos ${context.lookbackDays} días es ${money.format(grossMargin / 100)}. No es utilidad neta: aún faltan nómina, renta, servicios, mermas y otros gastos.`,
    };
  }

  if (
    has(message, [
      "tendencia",
      "subiendo",
      "bajando",
      "caida",
      "crecimiento",
      "creciendo",
      "cayendo",
    ])
  ) {
    if (!context.dataStatus.performance) {
      return {
        intent: "sales",
        answer: "No pude validar las tendencias de ventas.",
      };
    }
    const comparable = context.performance.filter(
      (item) => item.unitsSold > 0 && Number.isFinite(item.trendPercent),
    );
    const rising = [...comparable].sort(
      (left, right) => right.trendPercent - left.trendPercent,
    )[0];
    const falling = [...comparable].sort(
      (left, right) => left.trendPercent - right.trendPercent,
    )[0];
    return {
      intent: "sales",
      answer:
        rising && falling
          ? `Contra el periodo anterior equivalente, el mayor crecimiento es ${rising.itemName} (${rising.trendPercent > 0 ? "+" : ""}${rising.trendPercent.toFixed(1)}%) y la mayor caída es ${falling.itemName} (${falling.trendPercent > 0 ? "+" : ""}${falling.trendPercent.toFixed(1)}%). Los porcentajes describen cambio, no causalidad.`
          : "No hay dos periodos comparables con ventas suficientes para calcular tendencias.",
    };
  }

  if (has(message, ["mesa", "mesas", "ocupada", "libre", "salon"])) {
    if (!context.dataStatus.tables) {
      return {
        intent: "tables",
        answer:
          "No pude verificar el estado del salón. Consulta el tablero antes de asignar una mesa.",
      };
    }
    const occupied = context.tables.filter((table) => table.status !== "free");
    const free = context.tables.length - occupied.length;
    const statusCounts = Object.entries(
      context.tables.reduce<Record<string, number>>((counts, table) => {
        const status = localizedTableStatus(table.status);
        counts[status] = (counts[status] ?? 0) + 1;
        return counts;
      }, {}),
    )
      .map(([status, count]) => `${status}: ${count}`)
      .join(", ");
    return {
      intent: "tables",
      answer: `Hay ${context.tables.length} mesas configuradas: ${free} libres y ${occupied.length} con otro estado (${statusCounts}).${
        occupied.length
          ? ` No libres: ${list(
              occupied.map(
                (table) =>
                  `${table.name} [${localizedTableStatus(table.status)}]`,
              ),
              "",
            )}.`
          : ""
      }`,
    };
  }

  if (
    has(message, [
      "turno",
      "abrir caja",
      "cerrar caja",
      "abrir servicio",
      "cerrar servicio",
    ])
  ) {
    if (!context.dataStatus.shift) {
      return {
        intent: "shift",
        answer:
          "No pude verificar el turno actual. No abras ni cierres caja basándote en esta respuesta; revisa Administración.",
      };
    }
    return {
      intent: "shift",
      answer: context.openShift
        ? `El turno “${context.openShift.name}” está abierto desde ${new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(new Date(context.openShift.openedAt))}. Sólo un administrador puede cerrarlo desde la parte superior de Administración.`
        : "No hay un turno abierto. Sólo un administrador puede iniciarlo desde la parte superior de Administración.",
    };
  }

  if (
    has(message, [
      "usuario",
      "contrasena",
      "password",
      "rol",
      "permiso",
      "empleado",
    ])
  ) {
    return {
      intent: "users",
      answer:
        "Los usuarios se administran en Administración → Equipo. Puedes crear, suspender o eliminar cuentas, cambiar rol, sucursal, correo y contraseña. Por seguridad, Mar no solicita ni cambia contraseñas dentro del chat.",
    };
  }

  if (
    has(message, [
      "logo",
      "marca",
      "nombre del restaurante",
      "identidad",
      "sucursal",
    ])
  ) {
    return {
      intent: "brand",
      answer:
        "La identidad se modifica en Administración → Marca. El nombre, logo cargado, escala, posición y color funcionan sin IA; la generación de un logo completamente nuevo requiere OpenAI o elegir una plantilla premium guardada.",
    };
  }

  const route = navigationAnswer(message);
  if (route) return { intent: "navigation", answer: route };

  const pageHint = context.page.startsWith("/admin")
    ? "Estás en Administración. Prueba: “¿qué debo vender hoy?”, “inventario bajo”, “estado de mesas” o “cómo cambio una contraseña”."
    : "Prueba: “¿qué debo ofrecer hoy?”, “más vendidos”, “inventario bajo” o “estado del turno”.";
  return {
    intent: "unknown",
    answer: `No quiero inventarte una respuesta. ${pageHint}`,
  };
}
