/**
 * Servidor API REST - Meeting Intelligence
 *
 * Fornece endpoints para captura, processamento e consulta de reunioes.
 * Todas as mensagens e respostas estao em portugues do Brasil (pt-BR).
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// --- Configuracao de upload (multer) ---
let multer;
try {
  multer = require('multer');
} catch {
  console.warn('[API] multer nao instalado. Upload de arquivos desabilitado.');
  multer = null;
}

// --- Importacoes internas ---
let meetingStore;
let integrations;
let pipeline;

try { meetingStore = require('../storage/meeting-store'); } catch { meetingStore = null; }
try { integrations = require('../integrations'); } catch { integrations = null; }
try { pipeline = require('../pipeline'); } catch { pipeline = null; }

// --- Estado do servidor ---
let capturaAtiva = null;

/**
 * Cria e configura a aplicacao Express
 * @param {Object} [opcoes] - Opcoes de configuracao
 * @param {number} [opcoes.porta] - Porta do servidor (padrao: 3000)
 * @param {boolean} [opcoes.cors] - Habilitar CORS (padrao: true)
 * @returns {Object} { app, iniciar }
 */
function criarServidor(opcoes = {}) {
  const app = express();
  const porta = opcoes.porta || parseInt(process.env.PORT, 10) || 3000;

  // --- Middlewares globais ---

  // Parse JSON e URL-encoded
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS
  if (opcoes.cors !== false) {
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      next();
    });
  }

  // Arquivos estaticos (dashboard)
  app.use('/static', express.static(path.join(__dirname)));
  app.use('/output', express.static(config.paths.outputDir));

  // Configuracao de upload
  let upload = null;
  if (multer) {
    const armazenamento = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(config.paths.tempDir, 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const nomeUnico = `${Date.now()}-${file.originalname}`;
        cb(null, nomeUnico);
      },
    });

    upload = multer({
      storage: armazenamento,
      limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
      fileFilter: (req, file, cb) => {
        const tiposPermitidos = [
          'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/mp4',
          'audio/m4a', 'audio/ogg', 'audio/webm', 'audio/flac',
          'video/mp4', 'video/webm', 'video/quicktime',
        ];
        if (tiposPermitidos.includes(file.mimetype) || file.originalname.match(/\.(wav|mp3|m4a|mp4|ogg|webm|flac|mov)$/i)) {
          cb(null, true);
        } else {
          cb(new Error(`Tipo de arquivo nao suportado: ${file.mimetype}. Envie audio ou video.`));
        }
      },
    });
  }

  // --- Rota: Dashboard ---

  app.get('/', (req, res) => {
    const dashboardPath = path.join(__dirname, 'dashboard.html');
    if (fs.existsSync(dashboardPath)) {
      res.sendFile(dashboardPath);
    } else {
      res.json({
        mensagem: 'Meeting Intelligence API',
        versao: '1.0.0',
        documentacao: '/api/status',
      });
    }
  });

  // --- Rotas: Captura de audio ---

  /**
   * POST /api/meetings/capture/start
   * Inicia captura de audio em tempo real
   */
  app.post('/api/meetings/capture/start', async (req, res) => {
    try {
      if (capturaAtiva) {
        return res.status(409).json({
          sucesso: false,
          mensagem: 'Ja existe uma captura em andamento. Pare a captura atual antes de iniciar outra.',
          capturaAtual: capturaAtiva,
        });
      }

      const { dispositivo, formato, cliente, assunto } = req.body;

      capturaAtiva = {
        id: _gerarId(),
        iniciadoEm: new Date().toISOString(),
        dispositivo: dispositivo || config.audio.device,
        formato: formato || config.audio.format,
        cliente: cliente || 'Nao informado',
        assunto: assunto || 'Reuniao sem titulo',
        status: 'capturando',
      };

      // Tenta iniciar captura via pipeline
      if (pipeline && typeof pipeline.startCapture === 'function') {
        await pipeline.startCapture({
          device: capturaAtiva.dispositivo,
          format: capturaAtiva.formato,
        });
      }

      console.log(`[API] Captura iniciada: ${capturaAtiva.id}`);

      res.status(201).json({
        sucesso: true,
        mensagem: 'Captura de audio iniciada com sucesso.',
        captura: capturaAtiva,
      });
    } catch (erro) {
      capturaAtiva = null;
      console.error(`[API] Erro ao iniciar captura: ${erro.message}`);
      res.status(500).json({
        sucesso: false,
        mensagem: `Erro ao iniciar captura: ${erro.message}`,
      });
    }
  });

  /**
   * POST /api/meetings/capture/stop
   * Para captura e inicia processamento
   */
  app.post('/api/meetings/capture/stop', async (req, res) => {
    try {
      if (!capturaAtiva) {
        return res.status(404).json({
          sucesso: false,
          mensagem: 'Nenhuma captura em andamento.',
        });
      }

      const captura = { ...capturaAtiva };
      captura.status = 'processando';
      captura.finalizadoEm = new Date().toISOString();
      capturaAtiva = null;

      // Para captura e processa
      let resultado = null;
      if (pipeline && typeof pipeline.stopCapture === 'function') {
        resultado = await pipeline.stopCapture();
      }

      // Salva no store se disponivel
      if (meetingStore && resultado) {
        await meetingStore.salvar({
          ...captura,
          ...resultado,
          status: 'processado',
        });
      }

      console.log(`[API] Captura finalizada e processada: ${captura.id}`);

      res.json({
        sucesso: true,
        mensagem: 'Captura finalizada. Processamento iniciado.',
        captura,
        resultado,
      });
    } catch (erro) {
      capturaAtiva = null;
      console.error(`[API] Erro ao parar captura: ${erro.message}`);
      res.status(500).json({
        sucesso: false,
        mensagem: `Erro ao parar captura: ${erro.message}`,
      });
    }
  });

  /**
   * POST /api/meetings/process
   * Processa um arquivo de audio enviado via upload
   */
  const processMiddleware = upload
    ? upload.single('audio')
    : (req, res, next) => next();

  app.post('/api/meetings/process', processMiddleware, async (req, res) => {
    try {
      if (!req.file && !req.body.caminhoAudio) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'Envie um arquivo de audio ou informe o caminho do arquivo em "caminhoAudio".',
        });
      }

      const caminhoAudio = req.file ? req.file.path : req.body.caminhoAudio;
      const { cliente, assunto, plataforma } = req.body;

      // Verifica se o arquivo existe
      if (!fs.existsSync(caminhoAudio)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `Arquivo nao encontrado: ${caminhoAudio}`,
        });
      }

      const meetingId = _gerarId();

      console.log(`[API] Processando audio: ${caminhoAudio} (ID: ${meetingId})`);

      // Processa via pipeline
      let resultado = null;
      if (pipeline && typeof pipeline.processAudio === 'function') {
        resultado = await pipeline.processAudio(caminhoAudio, {
          cliente,
          assunto,
          plataforma,
        });
      } else {
        resultado = {
          id: meetingId,
          status: 'pendente',
          mensagem: 'Pipeline de processamento nao disponivel. Audio salvo para processamento posterior.',
          caminhoAudio,
        };
      }

      // Salva no store
      if (meetingStore) {
        await meetingStore.salvar({
          id: meetingId,
          cliente: cliente || 'Nao informado',
          assunto: assunto || 'Reuniao sem titulo',
          plataforma: plataforma || 'upload',
          caminhoAudio,
          ...resultado,
          criadoEm: new Date().toISOString(),
        });
      }

      res.status(201).json({
        sucesso: true,
        mensagem: 'Audio recebido e processamento iniciado.',
        id: meetingId,
        resultado,
      });
    } catch (erro) {
      console.error(`[API] Erro ao processar audio: ${erro.message}`);
      res.status(500).json({
        sucesso: false,
        mensagem: `Erro ao processar audio: ${erro.message}`,
      });
    }
  });

  // --- Rotas: Consulta de reunioes ---

  /**
   * GET /api/meetings
   * Lista todas as reunioes processadas
   */
  app.get('/api/meetings', async (req, res) => {
    try {
      const { cliente, status, data, limite, pagina } = req.query;

      let reunioes = [];
      if (meetingStore) {
        reunioes = await meetingStore.listar({
          cliente,
          status,
          data,
          limite: parseInt(limite, 10) || 50,
          pagina: parseInt(pagina, 10) || 1,
        });
      }

      res.json({
        sucesso: true,
        total: reunioes.length,
        reunioes,
      });
    } catch (erro) {
      console.error(`[API] Erro ao listar reunioes: ${erro.message}`);
      res.status(500).json({
        sucesso: false,
        mensagem: `Erro ao listar reunioes: ${erro.message}`,
      });
    }
  });

  /**
   * GET /api/meetings/:id
   * Detalhes completos de uma reuniao + analise
   */
  app.get('/api/meetings/:id', async (req, res) => {
    try {
      const { id } = req.params;

      if (!meetingStore) {
        return res.status(503).json({
          sucesso: false,
          mensagem: 'Armazenamento de reunioes nao disponivel.',
        });
      }

      const reuniao = await meetingStore.obter(id);
      if (!reuniao) {
        return res.status(404).json({
          sucesso: false,
          mensagem: `Reuniao nao encontrada: ${id}`,
        });
      }

      res.json({
        sucesso: true,
        reuniao,
      });
    } catch (erro) {
      console.error(`[API] Erro ao obter reuniao: ${erro.message}`);
      res.status(500).json({
        sucesso: false,
        mensagem: `Erro ao obter reuniao: ${erro.message}`,
      });
    }
  });

  /**
   * GET /api/meetings/:id/proposal
   * Retorna a proposta comercial gerada em HTML
   */
  app.get('/api/meetings/:id/proposal', async (req, res) => {
    try {
      const { id } = req.params;

      if (!meetingStore) {
        return res.status(503).json({
          sucesso: false,
          mensagem: 'Armazenamento nao disponivel.',
        });
      }

      const reuniao = await meetingStore.obter(id);
      if (!reuniao) {
        return res.status(404).json({
          sucesso: false,
          mensagem: `Reuniao nao encontrada: ${id}`,
        });
      }

      // Verifica se a proposta HTML existe
      if (reuniao.caminhoPropostaHtml && fs.existsSync(reuniao.caminhoPropostaHtml)) {
        return res.sendFile(reuniao.caminhoPropostaHtml);
      }

      // Retorna proposta em JSON se nao houver HTML
      if (reuniao.proposta) {
        return res.json({
          sucesso: true,
          proposta: reuniao.proposta,
        });
      }

      res.status(404).json({
        sucesso: false,
        mensagem: 'Proposta ainda nao gerada para esta reuniao.',
      });
    } catch (erro) {
      console.error(`[API] Erro ao obter proposta: ${erro.message}`);
      res.status(500).json({
        sucesso: false,
        mensagem: `Erro ao obter proposta: ${erro.message}`,
      });
    }
  });

  /**
   * GET /api/meetings/:id/pdf
   * Download da proposta em PDF
   */
  app.get('/api/meetings/:id/pdf', async (req, res) => {
    try {
      const { id } = req.params;

      if (!meetingStore) {
        return res.status(503).json({
          sucesso: false,
          mensagem: 'Armazenamento nao disponivel.',
        });
      }

      const reuniao = await meetingStore.obter(id);
      if (!reuniao) {
        return res.status(404).json({
          sucesso: false,
          mensagem: `Reuniao nao encontrada: ${id}`,
        });
      }

      if (reuniao.caminhoPropostaPdf && fs.existsSync(reuniao.caminhoPropostaPdf)) {
        const nomeArquivo = `proposta-${reuniao.cliente || 'reuniao'}-${id.substring(0, 8)}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
        return res.sendFile(reuniao.caminhoPropostaPdf);
      }

      res.status(404).json({
        sucesso: false,
        mensagem: 'PDF da proposta ainda nao gerado. Processe a reuniao primeiro.',
      });
    } catch (erro) {
      console.error(`[API] Erro ao obter PDF: ${erro.message}`);
      res.status(500).json({
        sucesso: false,
        mensagem: `Erro ao obter PDF: ${erro.message}`,
      });
    }
  });

  /**
   * GET /api/meetings/:id/notes
   * Retorna notas formatadas para Obsidian (Markdown)
   */
  app.get('/api/meetings/:id/notes', async (req, res) => {
    try {
      const { id } = req.params;

      if (!meetingStore) {
        return res.status(503).json({
          sucesso: false,
          mensagem: 'Armazenamento nao disponivel.',
        });
      }

      const reuniao = await meetingStore.obter(id);
      if (!reuniao) {
        return res.status(404).json({
          sucesso: false,
          mensagem: `Reuniao nao encontrada: ${id}`,
        });
      }

      if (reuniao.caminhoNotasObsidian && fs.existsSync(reuniao.caminhoNotasObsidian)) {
        const conteudo = fs.readFileSync(reuniao.caminhoNotasObsidian, 'utf-8');
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        return res.send(conteudo);
      }

      // Gera notas basicas se nao existirem
      if (reuniao.analise || reuniao.transcricao) {
        const notas = _gerarNotasObsidian(reuniao);
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        return res.send(notas);
      }

      res.status(404).json({
        sucesso: false,
        mensagem: 'Notas ainda nao disponiveis para esta reuniao.',
      });
    } catch (erro) {
      console.error(`[API] Erro ao obter notas: ${erro.message}`);
      res.status(500).json({
        sucesso: false,
        mensagem: `Erro ao obter notas: ${erro.message}`,
      });
    }
  });

  // --- Rota: Status do sistema ---

  /**
   * GET /api/status
   * Retorna status geral do sistema
   */
  app.get('/api/status', (req, res) => {
    const statusIntegracoes = integrations ? integrations.getStatus() : { plataformaAtiva: 'nenhuma' };

    res.json({
      sucesso: true,
      sistema: {
        nome: 'Meeting Intelligence',
        versao: '1.0.0',
        status: 'operacional',
        horaServidor: new Date().toISOString(),
      },
      captura: {
        ativa: !!capturaAtiva,
        detalhes: capturaAtiva || null,
      },
      integracoes: statusIntegracoes,
      armazenamento: {
        disponivel: !!meetingStore,
      },
      pipeline: {
        disponivel: !!pipeline,
      },
      configuracao: {
        empresa: config.company.name,
        valorHora: config.pricing.hourlyRate,
        moeda: config.pricing.currency,
      },
    });
  });

  // --- Middleware de erro global ---

  app.use((erro, req, res, _next) => {
    // Erro do multer (upload)
    if (erro && erro.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        sucesso: false,
        mensagem: 'Arquivo muito grande. Limite maximo: 500 MB.',
      });
    }

    console.error(`[API] Erro nao tratado: ${erro.message}`);
    res.status(500).json({
      sucesso: false,
      mensagem: `Erro interno do servidor: ${erro.message}`,
    });
  });

  // --- Rota 404 ---

  app.use((req, res) => {
    res.status(404).json({
      sucesso: false,
      mensagem: `Rota nao encontrada: ${req.method} ${req.path}`,
      rotasDisponiveis: [
        'GET  /',
        'POST /api/meetings/capture/start',
        'POST /api/meetings/capture/stop',
        'POST /api/meetings/process',
        'GET  /api/meetings',
        'GET  /api/meetings/:id',
        'GET  /api/meetings/:id/proposal',
        'GET  /api/meetings/:id/pdf',
        'GET  /api/meetings/:id/notes',
        'GET  /api/status',
      ],
    });
  });

  /**
   * Inicia o servidor HTTP
   * @returns {Promise<Object>} Instancia do servidor
   */
  function iniciar() {
    return new Promise((resolve, reject) => {
      try {
        const servidor = app.listen(porta, () => {
          console.log('');
          console.log('==============================================');
          console.log('  Meeting Intelligence - Servidor API');
          console.log('==============================================');
          console.log(`  URL:      http://localhost:${porta}`);
          console.log(`  API:      http://localhost:${porta}/api/status`);
          console.log(`  Empresa:  ${config.company.name}`);
          console.log(`  Hora:     ${new Date().toLocaleString('pt-BR')}`);
          console.log('==============================================');
          console.log('');
          resolve(servidor);
        });

        servidor.on('error', (erro) => {
          if (erro.code === 'EADDRINUSE') {
            console.error(`[API] Porta ${porta} ja esta em uso. Tente outra porta.`);
          }
          reject(erro);
        });
      } catch (erro) {
        reject(erro);
      }
    });
  }

  return { app, iniciar };
}

// --- Funcoes auxiliares ---

/**
 * Gera um ID unico simples
 * @private
 */
function _gerarId() {
  const timestamp = Date.now().toString(36);
  const aleatorio = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${aleatorio}`;
}

/**
 * Gera notas basicas no formato Obsidian
 * @private
 */
function _gerarNotasObsidian(reuniao) {
  const data = reuniao.criadoEm
    ? new Date(reuniao.criadoEm).toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');

  let notas = `---
tags: [reuniao, meeting-intelligence]
data: ${data}
cliente: ${reuniao.cliente || 'Nao informado'}
status: ${reuniao.status || 'processado'}
---

# ${reuniao.assunto || 'Reuniao'}

**Data:** ${data}
**Cliente:** ${reuniao.cliente || 'Nao informado'}
**Plataforma:** ${reuniao.plataforma || 'local'}

## Transcricao

${reuniao.transcricao || '_Transcricao nao disponivel_'}

## Analise

${reuniao.analise || '_Analise nao disponivel_'}

## Proximos passos

${reuniao.proximosPassos || '_Nao definidos_'}

---
_Gerado automaticamente por Meeting Intelligence_
`;

  return notas;
}

// --- Exportacoes ---

module.exports = { criarServidor };

// Execucao direta
if (require.main === module) {
  const { iniciar } = criarServidor();
  iniciar().catch(erro => {
    console.error(`[API] Falha ao iniciar servidor: ${erro.message}`);
    process.exit(1);
  });
}
