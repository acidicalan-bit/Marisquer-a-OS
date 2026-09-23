export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("El cuerpo de la solicitud supera el límite permitido.");
    this.name = "RequestBodyTooLargeError";
  }
}

export async function readTextBody(request: Request, maxBytes: number) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }
  return body;
}

export async function readJsonBody(request: Request, maxBytes: number) {
  const body = await readTextBody(request, maxBytes);
  return JSON.parse(body) as unknown;
}
