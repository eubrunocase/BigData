/**
 * Erro com status HTTP e mensagem segura para o cliente.
 * A mensagem nunca deve conter detalhes internos do banco.
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.expose = true;
  }
}
