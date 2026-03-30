/**
 * Modulo de Configuracao Central
 *
 * Carrega variaveis de ambiente do arquivo .env e fornece valores padrao
 * para toda a aplicacao Meeting Intelligence.
 */

const path = require('path');
const dotenv = require('dotenv');

// Carrega variaveis do .env na raiz do modulo meeting-intelligence
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Retorna o valor de uma variavel de ambiente ou o valor padrao
 */
function env(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}

/**
 * Retorna o valor numerico de uma variavel de ambiente
 */
function envNumber(key, defaultValue = 0) {
  const val = process.env[key];
  if (val === undefined || val === '') return defaultValue;
  const parsed = Number(val);
  return isNaN(parsed) ? defaultValue : parsed;
}

const config = {
  // --- Chaves de API ---
  openaiApiKey: env('OPENAI_API_KEY'),
  anthropicApiKey: env('ANTHROPIC_API_KEY'),

  // --- Audio ---
  audio: {
    device: env('AUDIO_DEVICE', 'CABLE Output (VB-Audio Virtual Cable)'),
    format: env('AUDIO_FORMAT', 'wav'),
    sampleRate: envNumber('AUDIO_SAMPLE_RATE', 16000),
    channels: 1,
    maxChunkSizeMB: 25,
    chunkDurationSeconds: envNumber('AUDIO_CHUNK_DURATION', 30),
  },

  // --- Caminhos ---
  paths: {
    obsidianVault: env('OBSIDIAN_VAULT_PATH', ''),
    outputDir: path.resolve(env('OUTPUT_DIR', path.join(__dirname, '..', 'output'))),
    tempDir: path.resolve(env('TEMP_DIR', path.join(__dirname, '..', 'temp'))),
    samplesDir: path.resolve(__dirname, '..', 'samples'),
  },

  // --- Dados da Empresa ---
  company: {
    name: env('COMPANY_NAME', 'Sua Empresa Tech'),
    logoUrl: env('COMPANY_LOGO_URL', ''),
    email: env('COMPANY_EMAIL', 'contato@empresa.com'),
    phone: env('COMPANY_PHONE', '(11) 99999-9999'),
    website: env('COMPANY_WEBSITE', 'https://empresa.com'),
  },

  // --- Precificacao ---
  pricing: {
    hourlyRate: envNumber('HOURLY_RATE', 250),
    currency: env('CURRENCY', 'BRL'),
    defaultDiscount: envNumber('DEFAULT_DISCOUNT', 0),
  },

  // --- Modelos de IA ---
  models: {
    claude: env('CLAUDE_MODEL', 'claude-sonnet-4-20250514'),
    whisper: env('WHISPER_MODEL', 'whisper-1'),
  },

  /**
   * Valida se todas as configuracoes obrigatorias estao presentes
   * @returns {{ valid: boolean, missing: string[] }}
   */
  validate() {
    const required = [
      { key: 'openaiApiKey', label: 'OPENAI_API_KEY' },
      { key: 'anthropicApiKey', label: 'ANTHROPIC_API_KEY' },
    ];
    const missing = required.filter(r => !this[r.key]).map(r => r.label);
    return { valid: missing.length === 0, missing };
  },

  /**
   * Exibe resumo da configuracao no console (sem expor chaves de API)
   */
  print() {
    console.log('\n=== Configuracao Meeting Intelligence ===');
    console.log(`  Dispositivo de audio: ${this.audio.device}`);
    console.log(`  Formato de audio: ${this.audio.format}`);
    console.log(`  Taxa de amostragem: ${this.audio.sampleRate} Hz`);
    console.log(`  Diretorio de saida: ${this.paths.outputDir}`);
    console.log(`  Vault Obsidian: ${this.paths.obsidianVault || '(nao configurado)'}`);
    console.log(`  Empresa: ${this.company.name}`);
    console.log(`  Valor hora: R$ ${this.pricing.hourlyRate}`);
    console.log(`  Modelo Claude: ${this.models.claude}`);
    console.log(`  Modelo Whisper: ${this.models.whisper}`);
    console.log(`  OpenAI API Key: ${this.openaiApiKey ? '***configurada***' : 'NAO CONFIGURADA'}`);
    console.log(`  Anthropic API Key: ${this.anthropicApiKey ? '***configurada***' : 'NAO CONFIGURADA'}`);
    console.log('=========================================\n');
  },
};

module.exports = config;
