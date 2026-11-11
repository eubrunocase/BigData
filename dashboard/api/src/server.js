import express from 'express';
import cors from 'cors';
import { testConnection, closePool } from './db.js';
import { loadMeta } from './meta.js';
import { cacheMiddleware } from './cache.js';
import { HttpError } from './errors.js';
import { metaRouter } from './routes/meta.js';
import { kpisRouter } from './routes/kpis.js';
import { chartsRouter } from './routes/charts.js';
import { drilldownRouter } from './routes/drilldown.js';
import { tableRouter } from './routes/table.js';

const app = express();
app.disable('x-powered-by');

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4200')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origem não permitida pelo CORS'));
    },
    methods: ['GET', 'OPTIONS'],
  })
);

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', async (req, res) => {
  try {
    await testConnection();
    res.json({ status: 'ok', db: true });
  } catch {
    res.status(503).json({ status: 'degraded', db: false });
  }
});

app.use('/api', cacheMiddleware);
app.use('/api', metaRouter);
app.use('/api', kpisRouter);
app.use('/api', chartsRouter);
app.use('/api', drilldownRouter);
app.use('/api', tableRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Endpoint não encontrado.' });
});

// Handler final: 400 para erros de validação, 500 genérico sem detalhes do banco.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ erro: error.message });
    return;
  }

  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ erro: 'Requisição inválida.' });
    return;
  }

  // Log interno (sem credenciais); o cliente recebe apenas a mensagem genérica.
  console.error('[api] Erro interno:', error?.message || error);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

const PORT = Number(process.env.PORT || 3000);

async function start() {
  try {
    await testConnection();
    const meta = await loadMeta();
    console.log(
      `[api] Banco conectado. ${meta.totais.linhas.toLocaleString('pt-BR')} linhas na fato, ` +
        `${meta.totais.movimentacoes.toLocaleString('pt-BR')} movimentações.`
    );
    console.log(
      `[api] Perfis mapeados — mulheres: ${meta.grupos_perfil.mulheres.join(', ')}; ` +
        `homens: ${meta.grupos_perfil.homens.join(', ')}; ` +
        `negras: ${meta.grupos_perfil.negras.join(', ')}; ` +
        `brancas: ${meta.grupos_perfil.brancas.join(', ')}.`
    );

    const server = app.listen(PORT, () => {
      console.log(`[api] Escutando em http://localhost:${PORT} (somente leitura)`);
    });

    const shutdown = async (signal) => {
      console.log(`\n[api] ${signal} recebido, encerrando...`);
      server.close(async () => {
        await closePool();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('\n[api] Falha na inicialização:', error?.message || error);
    if (error?.message?.includes('Mapeamento de perfil')) {
      console.error(
        '[api] Ajuste PERFIL_RULES em src/businessRules.js conforme os valores reais do banco.\n'
      );
    } else {
      console.error(
        '[api] Verifique as credenciais em dashboard/api/.env e a conectividade com o PostgreSQL.\n'
      );
    }
    await closePool().catch(() => {});
    process.exit(1);
  }
}

start();
