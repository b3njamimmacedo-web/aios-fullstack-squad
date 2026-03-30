/**
 * Interface Unificada de Conectores
 *
 * Fornece uma API unificada para acessar reunioes e gravacoes
 * independente da plataforma (Teams, Zoom, Google Meet).
 *
 * Detecta automaticamente qual conector usar baseado nas variaveis
 * de ambiente configuradas. Se nenhuma integracao em nuvem estiver
 * disponivel, usa captura local de audio como fallback.
 */

const path = require('path');
const config = require('../config');

// --- Conectores disponiveis ---
let teamsConnector = null;
let zoomConnector = null;
let googleMeetConnector = null;

/**
 * Carrega um conector de forma segura (sem falhar se dependencias nao estiverem instaladas)
 * @private
 */
function _carregarConector(nome, caminho) {
  try {
    return require(caminho);
  } catch (erro) {
    console.warn(
      `[Conectores] Conector ${nome} nao disponivel: ${erro.message}`
    );
    return null;
  }
}

/**
 * Detecta quais plataformas estao configuradas baseado nas variaveis de ambiente
 * @returns {Object} Estado de cada plataforma
 */
function detectarPlataformas() {
  const plataformas = {
    teams: {
      configurado: !!(
        process.env.TEAMS_CLIENT_ID &&
        process.env.TEAMS_CLIENT_SECRET &&
        process.env.TEAMS_TENANT_ID
      ),
      variaveis: ['TEAMS_CLIENT_ID', 'TEAMS_CLIENT_SECRET', 'TEAMS_TENANT_ID'],
    },
    zoom: {
      configurado: !!(
        process.env.ZOOM_ACCOUNT_ID &&
        process.env.ZOOM_CLIENT_ID &&
        process.env.ZOOM_CLIENT_SECRET
      ),
      variaveis: ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'],
    },
    'google-meet': {
      configurado: !!(
        process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET
      ),
      variaveis: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    },
  };

  // Verifica quais variaveis estao faltando em cada plataforma
  for (const [nome, info] of Object.entries(plataformas)) {
    info.variaveisAusentes = info.variaveis.filter(v => !process.env[v]);
  }

  return plataformas;
}

/**
 * Retorna o conector apropriado para a plataforma solicitada
 * @private
 */
function _obterConector(plataforma) {
  switch (plataforma) {
    case 'teams':
      if (!teamsConnector) {
        teamsConnector = _carregarConector('Teams', './teams-connector');
      }
      return teamsConnector;
    case 'zoom':
      if (!zoomConnector) {
        zoomConnector = _carregarConector('Zoom', './zoom-connector');
      }
      return zoomConnector;
    case 'google-meet':
      if (!googleMeetConnector) {
        googleMeetConnector = _carregarConector('Google Meet', './google-meet-connector');
      }
      return googleMeetConnector;
    default:
      return null;
  }
}

/**
 * Detecta automaticamente a plataforma configurada (prioridade: Teams > Zoom > Google Meet)
 * @private
 */
function _detectarPlataformaAtiva() {
  // Verifica se ha preferencia explicita
  const preferencia = process.env.MEETING_PLATFORM;
  if (preferencia) {
    const normalizado = preferencia.toLowerCase().replace(/\s+/g, '-');
    const plataformas = detectarPlataformas();
    if (plataformas[normalizado]?.configurado) {
      return normalizado;
    }
    console.warn(
      `[Conectores] Plataforma preferida "${preferencia}" nao esta configurada. Tentando auto-deteccao.`
    );
  }

  // Auto-deteccao por ordem de prioridade
  const plataformas = detectarPlataformas();
  if (plataformas.teams.configurado) return 'teams';
  if (plataformas.zoom.configurado) return 'zoom';
  if (plataformas['google-meet'].configurado) return 'google-meet';

  return null;
}

/**
 * Autentica com a plataforma detectada ou especificada
 *
 * @param {Object} [opcoes] - Opcoes de autenticacao
 * @param {string} [opcoes.plataforma] - Forca plataforma especifica ('teams', 'zoom', 'google-meet')
 * @returns {Promise<{ sucesso: boolean, plataforma: string }>}
 */
async function autenticar(opcoes = {}) {
  const plataforma = opcoes.plataforma || _detectarPlataformaAtiva();

  if (!plataforma) {
    console.log(
      '[Conectores] Nenhuma integracao em nuvem configurada. Usando captura local de audio.'
    );
    return {
      sucesso: true,
      plataforma: 'local',
      mensagem: 'Captura local de audio ativa. Configure Teams, Zoom ou Google Meet para integracoes em nuvem.',
    };
  }

  const conector = _obterConector(plataforma);
  if (!conector) {
    throw new Error(`Conector para ${plataforma} nao esta disponivel. Verifique as dependencias.`);
  }

  console.log(`[Conectores] Autenticando com ${plataforma}...`);
  const resultado = await conector.authenticate(opcoes);

  return {
    ...resultado,
    plataforma,
  };
}

/**
 * Lista reunioes de todas as plataformas configuradas ou de uma especifica
 *
 * @param {Object} [filtros] - Filtros de busca
 * @param {string} [filtros.plataforma] - Filtrar por plataforma especifica
 * @param {Date|string} [filtros.dataInicio] - Data inicial
 * @param {Date|string} [filtros.dataFim] - Data final
 * @param {number} [filtros.limite] - Maximo de resultados por plataforma (padrao: 50)
 * @returns {Promise<Array<Object>>} Lista unificada de reunioes
 */
async function listMeetings(filtros = {}) {
  const { plataforma, limite = 50 } = filtros;

  // Se plataforma especifica, busca apenas nela
  if (plataforma) {
    return _listarDeUmaPlataforma(plataforma, filtros);
  }

  // Busca de todas as plataformas configuradas
  const plataformasAtivas = detectarPlataformas();
  const resultados = [];
  const erros = [];

  const promessas = Object.entries(plataformasAtivas)
    .filter(([, info]) => info.configurado)
    .map(async ([nome]) => {
      try {
        const reunioes = await _listarDeUmaPlataforma(nome, filtros);
        resultados.push(...reunioes);
      } catch (erro) {
        erros.push({ plataforma: nome, erro: erro.message });
        console.warn(`[Conectores] Erro ao listar reunioes de ${nome}: ${erro.message}`);
      }
    });

  await Promise.allSettled(promessas);

  // Ordena por data de inicio (mais recentes primeiro)
  resultados.sort((a, b) => {
    const dataA = new Date(a.inicio || 0);
    const dataB = new Date(b.inicio || 0);
    return dataB.getTime() - dataA.getTime();
  });

  if (erros.length > 0) {
    console.warn(`[Conectores] ${erros.length} plataforma(s) com erro.`);
  }

  console.log(`[Conectores] Total: ${resultados.length} reuniao(oes) encontrada(s).`);
  return resultados;
}

/**
 * Baixa a gravacao de uma reuniao especifica
 *
 * @param {Object} opcoes - Opcoes de download
 * @param {string} opcoes.id - ID da reuniao ou gravacao
 * @param {string} opcoes.plataforma - Plataforma de origem ('teams', 'zoom', 'google-meet')
 * @param {string} [opcoes.destino] - Diretorio de destino
 * @param {string} [opcoes.downloadUrl] - URL direta de download (Zoom)
 * @returns {Promise<{ caminho: string, tamanho: number, formato: string }>}
 */
async function getRecording(opcoes = {}) {
  const { id, plataforma, destino, downloadUrl } = opcoes;

  if (!plataforma) {
    throw new Error('Plataforma e obrigatoria para baixar gravacao. Informe: teams, zoom ou google-meet.');
  }

  if (!id && !downloadUrl) {
    throw new Error('ID da reuniao ou URL de download e obrigatorio.');
  }

  const conector = _obterConector(plataforma);
  if (!conector) {
    throw new Error(`Conector para ${plataforma} nao disponivel.`);
  }

  console.log(`[Conectores] Baixando gravacao de ${plataforma}...`);

  switch (plataforma) {
    case 'teams':
      return conector.downloadRecording(id, destino);
    case 'zoom':
      return conector.downloadRecording(downloadUrl || id, destino);
    case 'google-meet':
      return conector.downloadRecording(id, destino);
    default:
      throw new Error(`Plataforma nao suportada: ${plataforma}`);
  }
}

/**
 * Obtem informacoes detalhadas de uma reuniao especifica
 *
 * @param {string} meetingId - ID da reuniao
 * @param {string} plataforma - Plataforma ('teams', 'zoom', 'google-meet')
 * @returns {Promise<Object>} Detalhes da reuniao no formato unificado
 */
async function getMeetingInfo(meetingId, plataforma) {
  if (!meetingId) {
    throw new Error('ID da reuniao e obrigatorio.');
  }

  if (!plataforma) {
    throw new Error('Plataforma e obrigatoria. Informe: teams, zoom ou google-meet.');
  }

  const conector = _obterConector(plataforma);
  if (!conector) {
    throw new Error(`Conector para ${plataforma} nao disponivel.`);
  }

  console.log(`[Conectores] Obtendo detalhes de ${plataforma}...`);

  switch (plataforma) {
    case 'teams':
      return conector.getMeetingDetails(meetingId);
    case 'zoom':
      return conector.getMeetingInfo(meetingId);
    case 'google-meet':
      return conector.getMeetingDetails(meetingId);
    default:
      throw new Error(`Plataforma nao suportada: ${plataforma}`);
  }
}

/**
 * Retorna o status geral das integracoes
 * @returns {Object} Status de cada conector e plataforma
 */
function getStatus() {
  const plataformas = detectarPlataformas();
  const ativa = _detectarPlataformaAtiva();

  return {
    plataformaAtiva: ativa || 'local',
    modoLocal: !ativa,
    plataformas: Object.entries(plataformas).reduce((acc, [nome, info]) => {
      acc[nome] = {
        configurado: info.configurado,
        variaveisAusentes: info.variaveisAusentes,
      };
      return acc;
    }, {}),
    preferencia: process.env.MEETING_PLATFORM || 'auto',
  };
}

// --- Funcoes auxiliares (privadas) ---

/**
 * Lista reunioes de uma plataforma especifica
 * @private
 */
async function _listarDeUmaPlataforma(plataforma, filtros) {
  const conector = _obterConector(plataforma);
  if (!conector) {
    throw new Error(`Conector para ${plataforma} nao disponivel.`);
  }

  switch (plataforma) {
    case 'teams':
      return conector.listMeetings({
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
        limite: filtros.limite,
      });

    case 'zoom': {
      const resultado = await conector.listRecordings({
        de: filtros.dataInicio,
        ate: filtros.dataFim,
        pageSize: filtros.limite,
      });
      return resultado.reunioes;
    }

    case 'google-meet':
      return conector.listMeetings({
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
        limite: filtros.limite,
      });

    default:
      throw new Error(`Plataforma nao suportada: ${plataforma}`);
  }
}

module.exports = {
  // API unificada
  autenticar,
  listMeetings,
  getRecording,
  getMeetingInfo,

  // Utilitarios
  detectarPlataformas,
  getStatus,
};
