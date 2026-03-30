#!/usr/bin/env node

/**
 * CLI - Interface de linha de comando do Meeting Intelligence
 * Uso: node cli.js [comando] [opções]
 */

const path = require('path');
const fs = require('fs');

// Cores para o terminal
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  bg: '\x1b[44m'
};

function banner() {
  console.log(`
${c.cyan}${c.bold}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🎙️  Meeting Intelligence — Sua reunião, automatizada       ║
║                                                              ║
║   Captura → Transcrição → Análise → Proposta → Obsidian     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${c.reset}
  `);
}

function help() {
  banner();
  console.log(`${c.bold}Comandos disponíveis:${c.reset}

  ${c.green}capture${c.reset}              Inicia captura de áudio de reunião
  ${c.green}process <arquivo>${c.reset}    Processa uma gravação de áudio existente
  ${c.green}full${c.reset}                 Pipeline completo (captura + processamento)
  ${c.green}demo${c.reset}                 Executa demo com dados de exemplo
  ${c.green}transcript <arquivo>${c.reset} Processa uma transcrição JSON existente
  ${c.green}devices${c.reset}              Lista dispositivos de áudio disponíveis
  ${c.green}status${c.reset}               Verifica status das dependências
  ${c.green}help${c.reset}                 Mostra esta ajuda

${c.bold}Exemplos:${c.reset}
  ${c.dim}node cli.js capture${c.reset}
  ${c.dim}node cli.js process ./gravacao.wav${c.reset}
  ${c.dim}node cli.js demo${c.reset}
  ${c.dim}node cli.js transcript ./transcricao.json${c.reset}

${c.bold}Variáveis de ambiente:${c.reset} (configure no .env)
  ${c.yellow}OPENAI_API_KEY${c.reset}       Chave da API OpenAI (Whisper)
  ${c.yellow}ANTHROPIC_API_KEY${c.reset}    Chave da API Anthropic (Claude)
  ${c.yellow}AUDIO_DEVICE${c.reset}         Dispositivo de áudio (ex: VB-Cable)
  ${c.yellow}OBSIDIAN_VAULT_PATH${c.reset}  Caminho do vault Obsidian
  ${c.yellow}COMPANY_NAME${c.reset}         Nome da sua empresa
  ${c.yellow}HOURLY_RATE${c.reset}          Valor/hora em R$ (padrão: 150)
`);
}

async function runCapture() {
  console.log(`\n${c.blue}${c.bold}🎙️  Modo: Captura de Reunião${c.reset}\n`);

  const Pipeline = require('./pipeline');
  const pipeline = new Pipeline();

  pipeline.on('stage', ({ stage, status }) => {
    if (status === 'starting') {
      console.log(`${c.yellow}⏳ ${stage}...${c.reset}`);
    }
  });

  try {
    await pipeline.runFull({
      date: new Date().toISOString().split('T')[0],
      platform: 'Captura Local'
    });
  } catch (error) {
    console.error(`${c.red}❌ Erro: ${error.message}${c.reset}`);
    process.exit(1);
  }
}

async function runProcess(audioFile) {
  if (!audioFile) {
    console.error(`${c.red}❌ Informe o caminho do arquivo de áudio.${c.reset}`);
    console.log(`${c.dim}   Uso: node cli.js process <caminho-do-arquivo>${c.reset}`);
    process.exit(1);
  }

  if (!fs.existsSync(audioFile)) {
    console.error(`${c.red}❌ Arquivo não encontrado: ${audioFile}${c.reset}`);
    process.exit(1);
  }

  console.log(`\n${c.blue}${c.bold}📂 Modo: Processar Gravação${c.reset}`);
  console.log(`${c.dim}   Arquivo: ${audioFile}${c.reset}\n`);

  const Pipeline = require('./pipeline');
  const pipeline = new Pipeline();

  try {
    const results = await pipeline.processRecording(path.resolve(audioFile), {
      date: new Date().toISOString().split('T')[0],
      platform: 'Gravação Local'
    });
    console.log(`\n${c.green}${c.bold}✅ Processamento concluído!${c.reset}`);
  } catch (error) {
    console.error(`${c.red}❌ Erro: ${error.message}${c.reset}`);
    process.exit(1);
  }
}

async function runDemo() {
  console.log(`\n${c.magenta}${c.bold}🎮 Modo: Demo com Dados de Exemplo${c.reset}\n`);

  const samplePath = path.join(__dirname, '..', 'samples', 'demo-transcript.json');

  if (!fs.existsSync(samplePath)) {
    console.error(`${c.red}❌ Arquivo de demo não encontrado: ${samplePath}${c.reset}`);
    process.exit(1);
  }

  const transcript = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
  console.log(`${c.dim}   Carregados ${transcript.length} segmentos da transcrição demo.${c.reset}\n`);

  const Pipeline = require('./pipeline');
  const pipeline = new Pipeline();

  try {
    const results = await pipeline.processTranscript(transcript, {
      date: new Date().toISOString().split('T')[0],
      client: 'Demo E-Commerce',
      platform: 'Demo'
    });

    console.log(`\n${c.green}${c.bold}═══════════════════════════════════════${c.reset}`);
    console.log(`${c.green}${c.bold}   ✅ Demo concluída com sucesso!${c.reset}`);
    console.log(`${c.green}${c.bold}═══════════════════════════════════════${c.reset}\n`);
    console.log(`${c.cyan}📄 Site da proposta:${c.reset} ${results.proposal.htmlPath}`);
    console.log(`${c.cyan}📓 Notas Obsidian:${c.reset}  ${results.obsidian.directory}`);
    console.log(`${c.cyan}💰 Preço sugerido:${c.reset}  ${results.pricing.resumo.valor_recomendado}\n`);

  } catch (error) {
    console.error(`${c.red}❌ Erro no demo: ${error.message}${c.reset}`);
    console.error(`${c.dim}   Verifique se ANTHROPIC_API_KEY está configurada no .env${c.reset}`);
    process.exit(1);
  }
}

async function runTranscript(transcriptFile) {
  if (!transcriptFile || !fs.existsSync(transcriptFile)) {
    console.error(`${c.red}❌ Arquivo de transcrição não encontrado.${c.reset}`);
    process.exit(1);
  }

  console.log(`\n${c.blue}${c.bold}📝 Modo: Processar Transcrição${c.reset}\n`);

  const transcript = JSON.parse(fs.readFileSync(transcriptFile, 'utf-8'));
  const Pipeline = require('./pipeline');
  const pipeline = new Pipeline();

  try {
    await pipeline.processTranscript(transcript, {
      date: new Date().toISOString().split('T')[0],
      platform: 'Transcrição Manual'
    });
  } catch (error) {
    console.error(`${c.red}❌ Erro: ${error.message}${c.reset}`);
    process.exit(1);
  }
}

async function listDevices() {
  console.log(`\n${c.blue}${c.bold}🔊 Dispositivos de Áudio Disponíveis${c.reset}\n`);

  const AudioCapture = require('./capture/audio-capture');
  const capture = new AudioCapture();

  try {
    const devices = await capture.getAvailableDevices();
    if (devices.length === 0) {
      console.log(`${c.yellow}   Nenhum dispositivo encontrado. Instale o VB-Cable.${c.reset}`);
    } else {
      devices.forEach((d, i) => {
        console.log(`  ${c.green}${i + 1}.${c.reset} ${d}`);
      });
    }
  } catch (error) {
    console.error(`${c.red}❌ Erro ao listar dispositivos: ${error.message}${c.reset}`);
  }
}

function checkStatus() {
  console.log(`\n${c.blue}${c.bold}🔍 Verificação de Dependências${c.reset}\n`);

  const checks = [
    { name: 'Node.js', check: () => process.version },
    { name: 'OPENAI_API_KEY', check: () => process.env.OPENAI_API_KEY ? '✅ Configurada' : '❌ Não configurada' },
    { name: 'ANTHROPIC_API_KEY', check: () => process.env.ANTHROPIC_API_KEY ? '✅ Configurada' : '❌ Não configurada' },
    { name: 'FFmpeg', check: () => { try { require('child_process').execSync('ffmpeg -version', { stdio: 'pipe' }); return '✅ Instalado'; } catch { return '❌ Não encontrado'; } } },
    { name: 'Diretório de saída', check: () => process.env.OUTPUT_DIR || './output' },
    { name: 'Vault Obsidian', check: () => process.env.OBSIDIAN_VAULT_PATH || '⚠️ Não configurado' }
  ];

  for (const item of checks) {
    try {
      const result = item.check();
      console.log(`  ${c.cyan}${item.name}:${c.reset} ${result}`);
    } catch (error) {
      console.log(`  ${c.red}${item.name}:${c.reset} Erro - ${error.message}`);
    }
  }
  console.log('');
}

// Roteador de comandos
async function main() {
  // Carrega .env se existir
  try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch {}

  const [,, command, ...args] = process.argv;

  switch (command) {
    case 'capture':
      banner();
      await runCapture();
      break;
    case 'process':
      banner();
      await runProcess(args[0]);
      break;
    case 'full':
      banner();
      await runCapture();
      break;
    case 'demo':
      banner();
      await runDemo();
      break;
    case 'transcript':
      banner();
      await runTranscript(args[0]);
      break;
    case 'devices':
      await listDevices();
      break;
    case 'status':
      checkStatus();
      break;
    case 'help':
    case '--help':
    case '-h':
      help();
      break;
    default:
      help();
      break;
  }
}

main().catch(error => {
  console.error(`${c.red}Erro fatal: ${error.message}${c.reset}`);
  process.exit(1);
});
