/**
 * Conector Google Meet
 *
 * Integra com Google Calendar API e Google Drive API para acessar
 * gravacoes de reunioes do Google Meet armazenadas no Drive.
 *
 * === Configuracao necessaria (Google Cloud Console) ===
 *
 * 1. Acesse https://console.cloud.google.com
 * 2. Crie um novo projeto ou selecione um existente
 *
 * 3. Ative as APIs necessarias:
 *    - Google Calendar API
 *    - Google Drive API
 *
 * 4. Em "Credenciais", crie uma credencial OAuth 2.0:
 *    - Tipo: "Aplicativo da Web"
 *    - URI de redirecionamento: http://localhost:3000/auth/google/callback
 *
 * 5. Baixe o arquivo JSON das credenciais e salve como:
 *    meeting-intelligence/google-credentials.json
 *
 * 6. Configure as variaveis de ambiente:
 *    GOOGLE_CLIENT_ID=<Client ID>
 *    GOOGLE_CLIENT_SECRET=<Client Secret>
 *    GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
 *    GOOGLE_CREDENTIALS_PATH=./google-credentials.json (opcional)
 *
 * === Dependencias ===
 *  npm install googleapis
 */

const path = require('path');
const fs = require('fs');
const config = require('../config');

// --- Constantes ---
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
];
const TOKEN_PATH = path.resolve(__dirname, '..', '..', 'google-token.json');

// --- Estado interno ---
let authClient = null;
let calendarApi = null;
let driveApi = null;

/**
 * Inicializa o cliente OAuth2 do Google
 * @private
 */
function _criarClienteOAuth() {
  try {
    const { google } = require('googleapis');

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  } catch (erro) {
    throw new Error(
      `Falha ao criar cliente OAuth2. Verifique se googleapis esta instalado: ${erro.message}`
    );
  }
}

/**
 * Carrega token salvo do disco, se existir
 * @private
 */
function _carregarTokenSalvo() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const conteudo = fs.readFileSync(TOKEN_PATH, 'utf-8');
      return JSON.parse(conteudo);
    }
  } catch {
    // Token nao encontrado ou invalido
  }
  return null;
}

/**
 * Salva token no disco para reutilizacao
 * @private
 */
function _salvarToken(token) {
  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2), 'utf-8');
    console.log('[Google Meet] Token salvo em disco para reutilizacao.');
  } catch (erro) {
    console.warn(`[Google Meet] Aviso: nao foi possivel salvar token: ${erro.message}`);
  }
}

/**
 * Inicializa as APIs do Google Calendar e Drive
 * @private
 */
function _inicializarApis() {
  const { google } = require('googleapis');
  calendarApi = google.calendar({ version: 'v3', auth: authClient });
  driveApi = google.drive({ version: 'v3', auth: authClient });
}

/**
 * Autentica com as APIs do Google usando OAuth2
 *
 * Se ja houver um token salvo em disco, reutiliza automaticamente.
 * Caso contrario, retorna a URL de autorizacao para o usuario.
 *
 * @param {Object} [opcoes] - Opcoes de autenticacao
 * @param {string} [opcoes.clientId] - Client ID do Google (sobrescreve env)
 * @param {string} [opcoes.clientSecret] - Client Secret (sobrescreve env)
 * @param {string} [opcoes.code] - Codigo de autorizacao recebido do callback
 * @param {string} [opcoes.refreshToken] - Refresh token para renovacao direta
 * @returns {Promise<{ sucesso: boolean, urlAutorizacao?: string }>}
 */
async function authenticate(opcoes = {}) {
  if (opcoes.clientId) process.env.GOOGLE_CLIENT_ID = opcoes.clientId;
  if (opcoes.clientSecret) process.env.GOOGLE_CLIENT_SECRET = opcoes.clientSecret;

  // Valida configuracao minima
  const campos = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  const ausentes = campos.filter(c => !process.env[c]);
  if (ausentes.length > 0) {
    throw new Error(
      `Variaveis de ambiente ausentes para Google Meet: ${ausentes.join(', ')}. ` +
      'Consulte os comentarios no topo deste arquivo para instrucoes de configuracao.'
    );
  }

  authClient = _criarClienteOAuth();

  // Caso 1: Refresh token fornecido diretamente
  if (opcoes.refreshToken) {
    authClient.setCredentials({ refresh_token: opcoes.refreshToken });
    _inicializarApis();
    console.log('[Google Meet] Autenticado via refresh token fornecido.');
    return { sucesso: true };
  }

  // Caso 2: Token salvo existe no disco
  const tokenSalvo = _carregarTokenSalvo();
  if (tokenSalvo) {
    authClient.setCredentials(tokenSalvo);

    // Verifica se precisa renovar
    if (tokenSalvo.expiry_date && tokenSalvo.expiry_date < Date.now()) {
      try {
        const { credentials } = await authClient.refreshAccessToken();
        authClient.setCredentials(credentials);
        _salvarToken(credentials);
        console.log('[Google Meet] Token renovado com sucesso.');
      } catch (erro) {
        console.warn(`[Google Meet] Falha ao renovar token: ${erro.message}`);
        // Continua com o token existente, pode falhar nas requisicoes
      }
    }

    _inicializarApis();
    console.log('[Google Meet] Autenticado via token salvo.');
    return { sucesso: true };
  }

  // Caso 3: Codigo de autorizacao fornecido (callback do OAuth)
  if (opcoes.code) {
    try {
      const { tokens } = await authClient.getToken(opcoes.code);
      authClient.setCredentials(tokens);
      _salvarToken(tokens);
      _inicializarApis();
      console.log('[Google Meet] Autenticado com sucesso via codigo de autorizacao.');
      return { sucesso: true };
    } catch (erro) {
      throw new Error(`Falha ao trocar codigo por token: ${erro.message}`);
    }
  }

  // Caso 4: Nenhuma credencial disponivel, retorna URL de autorizacao
  const urlAutorizacao = authClient.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('[Google Meet] Autorizacao necessaria. Acesse a URL fornecida.');
  return {
    sucesso: false,
    urlAutorizacao,
    mensagem: 'Acesse a URL de autorizacao e depois chame authenticate({ code: "..." }) com o codigo recebido.',
  };
}

/**
 * Lista reunioes do Google Meet a partir de eventos do Google Calendar
 *
 * @param {Object} [filtros] - Filtros de busca
 * @param {string} [filtros.calendarId] - ID do calendario (padrao: 'primary')
 * @param {Date|string} [filtros.dataInicio] - Data inicial
 * @param {Date|string} [filtros.dataFim] - Data final
 * @param {number} [filtros.limite] - Maximo de resultados (padrao: 50)
 * @param {string} [filtros.busca] - Texto para buscar nos eventos
 * @returns {Promise<Array<Object>>} Lista de reunioes formatadas
 */
async function listMeetings(filtros = {}) {
  _verificarAutenticacao();

  const {
    calendarId = 'primary',
    dataInicio,
    dataFim,
    limite = 50,
    busca,
  } = filtros;

  console.log('[Google Meet] Buscando reunioes no Calendar...');

  try {
    const parametros = {
      calendarId,
      maxResults: limite,
      orderBy: 'startTime',
      singleEvents: true,
    };

    // Filtro de data
    if (dataInicio) {
      parametros.timeMin = dataInicio instanceof Date
        ? dataInicio.toISOString()
        : new Date(dataInicio).toISOString();
    } else {
      // Padrao: ultimos 30 dias
      parametros.timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    if (dataFim) {
      parametros.timeMax = dataFim instanceof Date
        ? dataFim.toISOString()
        : new Date(dataFim).toISOString();
    }

    if (busca) {
      parametros.q = busca;
    }

    const resposta = await calendarApi.events.list(parametros);
    const eventos = resposta.data.items || [];

    // Filtra apenas eventos com Google Meet
    const reunioesMeet = eventos.filter(
      e => e.conferenceData?.conferenceSolution?.name === 'Google Meet' ||
           e.hangoutLink
    );

    const reunioes = reunioesMeet.map(_formatarEvento);

    console.log(`[Google Meet] ${reunioes.length} reuniao(oes) com Meet encontrada(s).`);
    return reunioes;
  } catch (erro) {
    throw new Error(`Erro ao listar reunioes do Google Meet: ${erro.message}`);
  }
}

/**
 * Baixa a gravacao de uma reuniao do Google Meet armazenada no Drive
 *
 * Gravacoes do Meet sao salvas automaticamente no Google Drive do organizador
 * na pasta "Meet Recordings".
 *
 * @param {string} meetingIdOuFileId - ID do arquivo no Drive ou codigo da reuniao Meet
 * @param {string} [destino] - Caminho do diretorio de destino
 * @returns {Promise<{ caminho: string, tamanho: number, formato: string }>}
 */
async function downloadRecording(meetingIdOuFileId, destino) {
  _verificarAutenticacao();

  if (!meetingIdOuFileId) {
    throw new Error('ID do arquivo ou da reuniao e obrigatorio para baixar a gravacao.');
  }

  const dirDestino = destino || config.paths.tempDir;
  if (!fs.existsSync(dirDestino)) {
    fs.mkdirSync(dirDestino, { recursive: true });
  }

  console.log(`[Google Meet] Buscando gravacao ${meetingIdOuFileId}...`);

  try {
    let fileId = meetingIdOuFileId;

    // Se parece ser um codigo de reuniao Meet (e nao um file ID do Drive),
    // busca o arquivo correspondente no Drive
    if (meetingIdOuFileId.includes('-') && meetingIdOuFileId.length < 20) {
      fileId = await _buscarGravacaoNoDrive(meetingIdOuFileId);
    }

    // Obtem metadados do arquivo
    const metadados = await driveApi.files.get({
      fileId,
      fields: 'id,name,mimeType,size',
    });

    const nomeOriginal = metadados.data.name || `meet_${fileId}`;
    const extensao = _extensaoPorMimeType(metadados.data.mimeType);
    const nomeArquivo = nomeOriginal.endsWith(extensao) ? nomeOriginal : `${nomeOriginal}${extensao}`;
    const caminhoArquivo = path.join(dirDestino, nomeArquivo);

    // Baixa o conteudo do arquivo
    const resposta = await driveApi.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    const buffer = Buffer.from(resposta.data);
    fs.writeFileSync(caminhoArquivo, buffer);

    const tamanho = buffer.length;
    console.log(
      `[Google Meet] Gravacao baixada: ${nomeArquivo} (${(tamanho / 1024 / 1024).toFixed(2)} MB)`
    );

    return {
      caminho: caminhoArquivo,
      tamanho,
      formato: extensao.replace('.', ''),
    };
  } catch (erro) {
    throw new Error(`Erro ao baixar gravacao do Google Meet: ${erro.message}`);
  }
}

/**
 * Obtem detalhes completos de uma reuniao do Google Meet
 *
 * @param {string} eventId - ID do evento no Google Calendar
 * @param {string} [calendarId] - ID do calendario (padrao: 'primary')
 * @returns {Promise<Object>} Detalhes completos da reuniao
 */
async function getMeetingDetails(eventId, calendarId = 'primary') {
  _verificarAutenticacao();

  if (!eventId) {
    throw new Error('ID do evento e obrigatorio.');
  }

  console.log(`[Google Meet] Obtendo detalhes do evento ${eventId}...`);

  try {
    const resposta = await calendarApi.events.get({
      calendarId,
      eventId,
      fields: '*',
    });

    const evento = resposta.data;

    // Busca gravacao correspondente no Drive (se existir)
    let gravacao = null;
    const meetCode = _extrairCodigoMeet(evento);
    if (meetCode) {
      try {
        const fileId = await _buscarGravacaoNoDrive(meetCode);
        if (fileId) {
          const metaGravacao = await driveApi.files.get({
            fileId,
            fields: 'id,name,mimeType,size,createdTime,webViewLink',
          });
          gravacao = {
            fileId: metaGravacao.data.id,
            nome: metaGravacao.data.name,
            formato: metaGravacao.data.mimeType,
            tamanho: parseInt(metaGravacao.data.size || '0', 10),
            criadoEm: metaGravacao.data.createdTime,
            linkVisualizacao: metaGravacao.data.webViewLink,
          };
        }
      } catch {
        // Gravacao pode nao existir
      }
    }

    const resultado = {
      id: evento.id,
      assunto: evento.summary || 'Sem titulo',
      descricao: evento.description || '',
      inicio: evento.start?.dateTime || evento.start?.date,
      fim: evento.end?.dateTime || evento.end?.date,
      fusoHorario: evento.start?.timeZone || 'America/Sao_Paulo',
      duracao: _calcularDuracao(evento),
      organizador: {
        nome: evento.organizer?.displayName || 'Desconhecido',
        email: evento.organizer?.email || '',
      },
      participantes: (evento.attendees || []).map(a => ({
        nome: a.displayName || a.email,
        email: a.email || '',
        status: _traduzirStatus(a.responseStatus),
        organizador: a.organizer || false,
      })),
      totalParticipantes: (evento.attendees || []).length,
      linkMeet: evento.hangoutLink || _extrairLinkMeet(evento),
      codigoMeet: meetCode,
      gravacao,
      plataforma: 'google-meet',
      metadados: {
        criadoEm: evento.created,
        atualizadoEm: evento.updated,
        status: evento.status,
        recorrente: !!evento.recurringEventId,
        htmlLink: evento.htmlLink,
      },
    };

    console.log(`[Google Meet] Detalhes obtidos: "${resultado.assunto}"`);
    return resultado;
  } catch (erro) {
    throw new Error(`Erro ao obter detalhes da reuniao: ${erro.message}`);
  }
}

// --- Funcoes auxiliares (privadas) ---

/**
 * Verifica se a autenticacao foi realizada
 * @private
 */
function _verificarAutenticacao() {
  if (!authClient || !calendarApi || !driveApi) {
    throw new Error(
      'Nao autenticado. Execute authenticate() antes de fazer requisicoes.'
    );
  }
}

/**
 * Formata um evento do Calendar para o formato padrao
 * @private
 */
function _formatarEvento(evento) {
  return {
    id: evento.id,
    assunto: evento.summary || 'Sem titulo',
    inicio: evento.start?.dateTime || evento.start?.date,
    fim: evento.end?.dateTime || evento.end?.date,
    organizador: evento.organizer?.displayName || evento.organizer?.email || 'Desconhecido',
    participantes: (evento.attendees || []).map(a => ({
      nome: a.displayName || a.email,
      email: a.email || '',
      status: _traduzirStatus(a.responseStatus),
    })),
    totalParticipantes: (evento.attendees || []).length,
    linkMeet: evento.hangoutLink || _extrairLinkMeet(evento),
    codigoMeet: _extrairCodigoMeet(evento),
    duracao: _calcularDuracao(evento),
    plataforma: 'google-meet',
  };
}

/**
 * Extrai o codigo da reuniao Meet de um evento
 * @private
 */
function _extrairCodigoMeet(evento) {
  if (evento.conferenceData?.conferenceId) {
    return evento.conferenceData.conferenceId;
  }
  if (evento.hangoutLink) {
    const match = evento.hangoutLink.match(/\/([a-z]{3}-[a-z]{4}-[a-z]{3})$/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extrai o link do Meet de um evento
 * @private
 */
function _extrairLinkMeet(evento) {
  if (evento.conferenceData?.entryPoints) {
    const videoEntry = evento.conferenceData.entryPoints.find(
      e => e.entryPointType === 'video'
    );
    if (videoEntry) return videoEntry.uri;
  }
  return null;
}

/**
 * Busca arquivo de gravacao no Google Drive pela pasta "Meet Recordings"
 * @private
 */
async function _buscarGravacaoNoDrive(codigoMeet) {
  // Busca na pasta "Meet Recordings" do Drive
  const query = `name contains '${codigoMeet}' and mimeType contains 'video/' and trashed = false`;

  const resposta = await driveApi.files.list({
    q: query,
    fields: 'files(id,name,mimeType,size,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 5,
  });

  const arquivos = resposta.data.files || [];

  if (arquivos.length === 0) {
    // Tenta buscar na pasta especifica "Meet Recordings"
    const queryPasta = `name = 'Meet Recordings' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const respPasta = await driveApi.files.list({
      q: queryPasta,
      fields: 'files(id)',
      pageSize: 1,
    });

    if (respPasta.data.files && respPasta.data.files.length > 0) {
      const pastaId = respPasta.data.files[0].id;
      const queryNaPasta = `'${pastaId}' in parents and mimeType contains 'video/' and trashed = false`;
      const respArquivos = await driveApi.files.list({
        q: queryNaPasta,
        fields: 'files(id,name)',
        orderBy: 'createdTime desc',
        pageSize: 10,
      });

      const encontrado = (respArquivos.data.files || []).find(
        f => f.name.toLowerCase().includes(codigoMeet.toLowerCase())
      );

      if (encontrado) return encontrado.id;
    }

    throw new Error(
      `Gravacao nao encontrada no Drive para o codigo: ${codigoMeet}. ` +
      'Verifique se a gravacao foi habilitada na reuniao.'
    );
  }

  return arquivos[0].id;
}

/**
 * Calcula duracao do evento em minutos
 * @private
 */
function _calcularDuracao(evento) {
  try {
    const inicio = new Date(evento.start?.dateTime || evento.start?.date);
    const fim = new Date(evento.end?.dateTime || evento.end?.date);
    const diffMs = fim.getTime() - inicio.getTime();
    return Math.round(diffMs / 60000);
  } catch {
    return 0;
  }
}

/**
 * Traduz status de resposta do participante
 * @private
 */
function _traduzirStatus(status) {
  const mapa = {
    accepted: 'aceito',
    declined: 'recusado',
    tentative: 'talvez',
    needsAction: 'pendente',
  };
  return mapa[status] || 'desconhecido';
}

/**
 * Retorna extensao de arquivo baseado no MIME type
 * @private
 */
function _extensaoPorMimeType(mimeType) {
  if (!mimeType) return '.mp4';
  if (mimeType.includes('mp4')) return '.mp4';
  if (mimeType.includes('webm')) return '.webm';
  if (mimeType.includes('mpeg')) return '.mp3';
  if (mimeType.includes('wav')) return '.wav';
  return '.mp4';
}

module.exports = {
  authenticate,
  listMeetings,
  downloadRecording,
  getMeetingDetails,
};
