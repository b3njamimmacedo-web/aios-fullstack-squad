/**
 * Conector Microsoft Teams
 *
 * Integra com a Microsoft Graph API para acessar gravacoes de reunioes do Teams.
 *
 * === Configuracao necessaria (Azure AD) ===
 *
 * 1. Acesse https://portal.azure.com > Azure Active Directory > App Registrations
 * 2. Crie um novo registro de aplicativo:
 *    - Nome: "Meeting Intelligence - Teams Connector"
 *    - Tipo de conta: "Contas neste diretorio organizacional"
 *    - URI de redirecionamento: http://localhost:3000/auth/teams/callback
 *
 * 3. Em "Certificados e segredos", crie um novo segredo do cliente
 *
 * 4. Em "Permissoes de API", adicione as permissoes do Microsoft Graph:
 *    - OnlineMeetings.Read (Delegada)
 *    - OnlineMeetingRecording.Read.All (Delegada)
 *    - Calendars.Read (Delegada)
 *    - User.Read (Delegada)
 *
 * 5. Configure as variaveis de ambiente:
 *    TEAMS_CLIENT_ID=<Application (client) ID>
 *    TEAMS_CLIENT_SECRET=<Client secret value>
 *    TEAMS_TENANT_ID=<Directory (tenant) ID>
 *    TEAMS_REDIRECT_URI=http://localhost:3000/auth/teams/callback
 *
 * === Dependencias ===
 *  npm install @azure/msal-node node-fetch
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const config = require('../config');

// --- Constantes ---
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const GRAPH_BETA_URL = 'https://graph.microsoft.com/beta';
const SCOPES = [
  'https://graph.microsoft.com/OnlineMeetings.Read',
  'https://graph.microsoft.com/OnlineMeetingRecording.Read.All',
  'https://graph.microsoft.com/Calendars.Read',
  'https://graph.microsoft.com/User.Read',
];

// --- Estado interno ---
let accessToken = null;
let tokenExpiry = null;
let msalApp = null;

/**
 * Inicializa o cliente MSAL para autenticacao com Azure AD
 * @private
 */
function _initMsalClient() {
  try {
    const msal = require('@azure/msal-node');

    const msalConfig = {
      auth: {
        clientId: process.env.TEAMS_CLIENT_ID || '',
        clientSecret: process.env.TEAMS_CLIENT_SECRET || '',
        authority: `https://login.microsoftonline.com/${process.env.TEAMS_TENANT_ID || 'common'}`,
      },
      system: {
        loggerOptions: {
          loggerCallback: () => {},
          piiLoggingEnabled: false,
          logLevel: 0, // Error
        },
      },
    };

    msalApp = new msal.ConfidentialClientApplication(msalConfig);
    return msalApp;
  } catch (erro) {
    throw new Error(
      `Falha ao inicializar cliente MSAL. Verifique se @azure/msal-node esta instalado: ${erro.message}`
    );
  }
}

/**
 * Faz uma requisicao HTTP para a Microsoft Graph API
 * @private
 */
async function _graphRequest(endpoint, opcoes = {}) {
  if (!accessToken) {
    throw new Error('Nao autenticado. Execute authenticate() antes de fazer requisicoes.');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_BASE_URL}${endpoint}`;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...opcoes.headers,
  };

  const resposta = await _fetch(url, {
    method: opcoes.method || 'GET',
    headers,
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(
      `Erro na Graph API [${resposta.status}]: ${corpo}`
    );
  }

  if (opcoes.raw) {
    return resposta;
  }

  const contentType = resposta.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return resposta.json();
  }

  return resposta.buffer();
}

/**
 * Wrapper para fetch com suporte a Node.js nativo
 * @private
 */
async function _fetch(url, opcoes) {
  try {
    const fetch = globalThis.fetch || require('node-fetch');
    return await fetch(url, opcoes);
  } catch (erro) {
    throw new Error(`Falha na requisicao HTTP: ${erro.message}`);
  }
}

/**
 * Verifica se o token atual ainda e valido
 * @private
 */
function _tokenValido() {
  return accessToken && tokenExpiry && Date.now() < tokenExpiry;
}

/**
 * Autentica com a Microsoft Graph API usando credenciais de aplicativo (client credentials)
 *
 * @param {Object} [opcoes] - Opcoes de autenticacao
 * @param {string} [opcoes.clientId] - ID do cliente Azure AD (sobrescreve env)
 * @param {string} [opcoes.clientSecret] - Segredo do cliente (sobrescreve env)
 * @param {string} [opcoes.tenantId] - ID do tenant (sobrescreve env)
 * @returns {Promise<{ sucesso: boolean, expiraEm: Date }>}
 */
async function authenticate(opcoes = {}) {
  if (opcoes.clientId) process.env.TEAMS_CLIENT_ID = opcoes.clientId;
  if (opcoes.clientSecret) process.env.TEAMS_CLIENT_SECRET = opcoes.clientSecret;
  if (opcoes.tenantId) process.env.TEAMS_TENANT_ID = opcoes.tenantId;

  // Valida configuracao
  const campos = ['TEAMS_CLIENT_ID', 'TEAMS_CLIENT_SECRET', 'TEAMS_TENANT_ID'];
  const ausentes = campos.filter(c => !process.env[c]);
  if (ausentes.length > 0) {
    throw new Error(
      `Variaveis de ambiente ausentes para Teams: ${ausentes.join(', ')}. ` +
      'Consulte os comentarios no topo deste arquivo para instrucoes de configuracao.'
    );
  }

  if (_tokenValido()) {
    console.log('[Teams] Token existente ainda valido, reutilizando.');
    return { sucesso: true, expiraEm: new Date(tokenExpiry) };
  }

  try {
    if (!msalApp) _initMsalClient();

    const resultado = await msalApp.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });

    if (!resultado || !resultado.accessToken) {
      throw new Error('Token nao recebido da resposta MSAL.');
    }

    accessToken = resultado.accessToken;
    tokenExpiry = resultado.expiresOn
      ? resultado.expiresOn.getTime()
      : Date.now() + 3600 * 1000;

    console.log('[Teams] Autenticacao realizada com sucesso.');
    return {
      sucesso: true,
      expiraEm: new Date(tokenExpiry),
    };
  } catch (erro) {
    accessToken = null;
    tokenExpiry = null;
    throw new Error(`Falha na autenticacao com Teams: ${erro.message}`);
  }
}

/**
 * Lista reunioes recentes do Teams para o usuario autenticado
 *
 * @param {Object} [filtros] - Filtros de busca
 * @param {string} [filtros.userId] - ID do usuario (padrao: 'me')
 * @param {Date} [filtros.dataInicio] - Data inicial do intervalo
 * @param {Date} [filtros.dataFim] - Data final do intervalo
 * @param {number} [filtros.limite] - Numero maximo de resultados (padrao: 50)
 * @returns {Promise<Array<Object>>} Lista de reunioes formatadas
 */
async function listMeetings(filtros = {}) {
  const {
    userId = 'me',
    dataInicio,
    dataFim,
    limite = 50,
  } = filtros;

  console.log('[Teams] Buscando reunioes...');

  // Busca eventos do calendario com reunioes online
  let endpoint = `/${userId}/events?$top=${limite}&$orderby=start/dateTime desc`;
  endpoint += `&$filter=isOnlineMeeting eq true`;

  if (dataInicio) {
    const inicio = dataInicio instanceof Date ? dataInicio.toISOString() : dataInicio;
    endpoint += ` and start/dateTime ge '${inicio}'`;
  }

  if (dataFim) {
    const fim = dataFim instanceof Date ? dataFim.toISOString() : dataFim;
    endpoint += ` and end/dateTime le '${fim}'`;
  }

  endpoint += '&$select=id,subject,start,end,organizer,attendees,onlineMeeting,bodyPreview';

  try {
    const dados = await _graphRequest(endpoint);
    const reunioes = (dados.value || []).map(_formatarReuniao);

    console.log(`[Teams] ${reunioes.length} reuniao(oes) encontrada(s).`);
    return reunioes;
  } catch (erro) {
    throw new Error(`Erro ao listar reunioes do Teams: ${erro.message}`);
  }
}

/**
 * Baixa a gravacao de uma reuniao do Teams
 *
 * @param {string} meetingId - ID da reuniao online
 * @param {string} [destino] - Caminho do diretorio de destino (padrao: config.paths.tempDir)
 * @returns {Promise<{ caminho: string, tamanho: number, formato: string }>}
 */
async function downloadRecording(meetingId, destino) {
  if (!meetingId) {
    throw new Error('ID da reuniao e obrigatorio para baixar a gravacao.');
  }

  const dirDestino = destino || config.paths.tempDir;
  if (!fs.existsSync(dirDestino)) {
    fs.mkdirSync(dirDestino, { recursive: true });
  }

  console.log(`[Teams] Buscando gravacoes da reuniao ${meetingId}...`);

  try {
    // Busca gravacoes disponiveist pela API beta (gravacoes ainda em beta no Graph)
    const endpoint = `${GRAPH_BETA_URL}/me/onlineMeetings/${meetingId}/recordings`;
    const dados = await _graphRequest(endpoint);

    if (!dados.value || dados.value.length === 0) {
      throw new Error(`Nenhuma gravacao encontrada para a reuniao ${meetingId}.`);
    }

    const gravacao = dados.value[0];
    const contentUrl = gravacao.content || gravacao.recordingContentUrl;

    if (!contentUrl) {
      throw new Error('URL de conteudo da gravacao nao disponivel.');
    }

    // Baixa o conteudo da gravacao
    const resposta = await _graphRequest(contentUrl, { raw: true });
    const buffer = await resposta.buffer();

    const extensao = _detectarExtensao(resposta.headers.get('content-type'));
    const nomeArquivo = `teams_${meetingId}_${Date.now()}${extensao}`;
    const caminhoArquivo = path.join(dirDestino, nomeArquivo);

    fs.writeFileSync(caminhoArquivo, buffer);

    const tamanho = buffer.length;
    console.log(
      `[Teams] Gravacao baixada: ${nomeArquivo} (${(tamanho / 1024 / 1024).toFixed(2)} MB)`
    );

    return {
      caminho: caminhoArquivo,
      tamanho,
      formato: extensao.replace('.', ''),
    };
  } catch (erro) {
    throw new Error(`Erro ao baixar gravacao do Teams: ${erro.message}`);
  }
}

/**
 * Obtem detalhes completos de uma reuniao especifica do Teams
 *
 * @param {string} meetingId - ID da reuniao ou evento
 * @returns {Promise<Object>} Detalhes completos da reuniao
 */
async function getMeetingDetails(meetingId) {
  if (!meetingId) {
    throw new Error('ID da reuniao e obrigatorio.');
  }

  console.log(`[Teams] Obtendo detalhes da reuniao ${meetingId}...`);

  try {
    // Tenta buscar como evento primeiro
    let detalhes;
    try {
      detalhes = await _graphRequest(`/me/events/${meetingId}`);
    } catch {
      // Se falhar, tenta como reuniao online
      detalhes = await _graphRequest(`${GRAPH_BETA_URL}/me/onlineMeetings/${meetingId}`);
    }

    // Busca informacoes de presenca/participacao se disponivel
    let participacao = null;
    try {
      const dados = await _graphRequest(
        `${GRAPH_BETA_URL}/me/onlineMeetings/${meetingId}/attendanceReports`
      );
      participacao = dados.value || [];
    } catch {
      // Relatorios de presenca podem nao estar disponiveis
    }

    const resultado = {
      id: detalhes.id,
      assunto: detalhes.subject || detalhes.topic || 'Sem titulo',
      inicio: detalhes.start?.dateTime || detalhes.startDateTime,
      fim: detalhes.end?.dateTime || detalhes.endDateTime,
      organizador: _extrairOrganizador(detalhes),
      participantes: _extrairParticipantes(detalhes),
      duracao: _calcularDuracao(detalhes),
      linkReuniao: detalhes.onlineMeeting?.joinUrl || detalhes.joinUrl || null,
      descricao: detalhes.bodyPreview || detalhes.description || '',
      plataforma: 'teams',
      participacao,
      metadados: {
        criadoEm: detalhes.createdDateTime || null,
        atualizadoEm: detalhes.lastModifiedDateTime || null,
        tipoReuniao: detalhes.onlineMeetingProvider || 'teamsForBusiness',
      },
    };

    console.log(`[Teams] Detalhes obtidos: "${resultado.assunto}"`);
    return resultado;
  } catch (erro) {
    throw new Error(`Erro ao obter detalhes da reuniao: ${erro.message}`);
  }
}

// --- Funcoes auxiliares (privadas) ---

/**
 * Formata um evento do calendario para o formato padrao
 * @private
 */
function _formatarReuniao(evento) {
  return {
    id: evento.id,
    assunto: evento.subject || 'Sem titulo',
    inicio: evento.start?.dateTime,
    fim: evento.end?.dateTime,
    organizador: evento.organizer?.emailAddress?.name || 'Desconhecido',
    emailOrganizador: evento.organizer?.emailAddress?.address || '',
    participantes: (evento.attendees || []).map(a => ({
      nome: a.emailAddress?.name || 'Desconhecido',
      email: a.emailAddress?.address || '',
      status: a.status?.response || 'naoRespondido',
    })),
    totalParticipantes: (evento.attendees || []).length,
    linkReuniao: evento.onlineMeeting?.joinUrl || null,
    resumo: evento.bodyPreview || '',
    plataforma: 'teams',
    duracao: _calcularDuracao(evento),
  };
}

/**
 * Extrai informacoes do organizador
 * @private
 */
function _extrairOrganizador(detalhes) {
  if (detalhes.organizer?.emailAddress) {
    return {
      nome: detalhes.organizer.emailAddress.name || 'Desconhecido',
      email: detalhes.organizer.emailAddress.address || '',
    };
  }
  if (detalhes.participants?.organizer) {
    const org = detalhes.participants.organizer;
    return {
      nome: org.identity?.user?.displayName || 'Desconhecido',
      email: org.upn || '',
    };
  }
  return { nome: 'Desconhecido', email: '' };
}

/**
 * Extrai lista de participantes
 * @private
 */
function _extrairParticipantes(detalhes) {
  if (detalhes.attendees) {
    return detalhes.attendees.map(a => ({
      nome: a.emailAddress?.name || 'Desconhecido',
      email: a.emailAddress?.address || '',
      status: a.status?.response || 'naoRespondido',
    }));
  }
  if (detalhes.participants?.attendees) {
    return detalhes.participants.attendees.map(a => ({
      nome: a.identity?.user?.displayName || 'Desconhecido',
      email: a.upn || '',
      status: 'presente',
    }));
  }
  return [];
}

/**
 * Calcula duracao da reuniao em minutos
 * @private
 */
function _calcularDuracao(evento) {
  try {
    const inicio = new Date(evento.start?.dateTime || evento.startDateTime);
    const fim = new Date(evento.end?.dateTime || evento.endDateTime);
    const diffMs = fim.getTime() - inicio.getTime();
    return Math.round(diffMs / 60000);
  } catch {
    return 0;
  }
}

/**
 * Detecta extensao de arquivo baseado no content-type
 * @private
 */
function _detectarExtensao(contentType) {
  if (!contentType) return '.mp4';
  if (contentType.includes('audio/wav')) return '.wav';
  if (contentType.includes('audio/mpeg')) return '.mp3';
  if (contentType.includes('video/mp4')) return '.mp4';
  if (contentType.includes('audio/mp4')) return '.m4a';
  return '.mp4';
}

module.exports = {
  authenticate,
  listMeetings,
  downloadRecording,
  getMeetingDetails,
};
