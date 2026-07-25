// ==================== MERCADO PAGO SDK ====================
// Inicializa com a Public Key de TESTE (quando tiver uma válida)
// Por enquanto, usamos a chave pública da aplicação de teste

/* ============================================================
   CONFIGURAÇÃO
   ============================================================ */
const PIX_PAYLOAD_FIXO = '00020126580014BR.GOV.BCB.PIX01367035c2d2-2ca4-44ea-b8cb-14db4351bcec520400005303986540510.005802BR5923Wevily Marques de Abreu6009SAO PAULO6214051019BZrKr7mT63040C8B';
const URL_WEBHOOK_MAKE = "https://hook.us2.make.com/c3pmrx1m3krxobn4lmkdayhcwviudh8k";

// Firebase Realtime Database — o Make salva o resultado Pix aqui após processar
// Crie gratuitamente em console.firebase.google.com e cole a URL abaixo
const FIREBASE_BASE_URL = "https://sorteio-kit-natura-default-rtdb.firebaseio.com";
const RIFA_TOTAL = 100;
const RIFA_PRECO = 10.00;
const RIFA_EXPIRACAO_MINUTOS = 12;
const ADMIN_PHONE_HASH = "74b88f7385548a3e5674d8ac6e727ce7b7374e61f4a6eb8623fbc50244d29527";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB9-i2selGzx2NSEuiYZqV2XZ83p5V2PI0",
  authDomain: "sorteio-kit-natura.firebaseapp.com",
  databaseURL: "https://sorteio-kit-natura-default-rtdb.firebaseio.com",
  projectId: "sorteio-kit-natura",
  storageBucket: "sorteio-kit-natura.firebasestorage.app",
  messagingSenderId: "335849117680",
  appId: "1:335849117680:web:6e7caeb2d6e0fb3745af35",
  measurementId: "G-KSE483LBKK"
};

/* ============================================================
   ESTADO
   ============================================================ */
const STORAGE_KEYS = { dados:'ibpm_v2_dados', cfg:'ibpm_v2_cfg', user:'ibpm_v2_user' };
let bancoDados = {};
let configuracao = { pix:'', titular:'IPBM TERESINA', cidade:'TERESINA' };
let usuarioLogado = '';
let sAdmin = false;
let modalNumeroAtual = null;
let modalStatusSelecionado = null;
let dbBackend = 'local';
let firebaseDb = null;
let countdownTimer = null;
let cleanupTimer = null;
let pixPedidoIdAtual = null;
let pixPollingTimer = null;
let pixNumerosAtual = null;

function $(id){ return document.getElementById(id); }
function toast(msg, tipo){
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (tipo || '');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> el.classList.remove('show'), 3200);
}
function setLoading(on){ $('loadingScreen').classList.toggle('show', !!on); }
function setStatusBadge(online){
  const b = $('navStatus');
  b.classList.toggle('online', online);
  b.classList.toggle('offline', !online);
  $('navStatusText').textContent = online ? 'Online' : 'Local';
}
function digitos(s){ return (s||'').toString().replace(/\D/g,''); }
function validarTelefoneBR(fone){ const f = digitos(fone); return f.length === 10 || f.length === 11; }
function formatarMascaraTelefone(v){
  v = digitos(v);
  if(v.length === 11) return `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
  if(v.length === 10) return `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`;
  return v;
}
function aplicarMascaraInput(input){
  input.addEventListener('input', () => {
    const d = digitos(input.value).slice(0,11);
    input.value = formatarMascaraTelefone(d) || d;
  });
}
async function sha256(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
}

/* ============================================================
   PERSISTÊNCIA
   ============================================================ */
async function inicializarBackend(){
  const cfgOk = FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL;
  if(!cfgOk){
    dbBackend = 'local';
    setStatusBadge(false);
    carregarLocal();
    return;
  }
  try {
    await carregarScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
    await carregarScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js');
    firebase.initializeApp(FIREBASE_CONFIG);
    firebaseDb = firebase.database();
    dbBackend = 'firebase';
    setStatusBadge(true);
    firebaseDb.ref('dados').on('value', snap => {
      bancoDados = snap.val() || {};
      localStorage.setItem(STORAGE_KEYS.dados, JSON.stringify(bancoDados));
      reRenderTudo();
    });
    firebaseDb.ref('configuracao').on('value', snap => {
      const v = snap.val();
      if(v){
        configuracao = Object.assign(configuracao, v);
        localStorage.setItem(STORAGE_KEYS.cfg, JSON.stringify(configuracao));
        if(sAdmin) carregarCamposConfig();
      }
    });
  } catch (e){
    console.warn('Falha Firebase, usando localStorage', e);
    dbBackend = 'local';
    setStatusBadge(false);
    carregarLocal();
  }
}
function carregarScript(src){
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
function carregarLocal(){
  bancoDados = JSON.parse(localStorage.getItem(STORAGE_KEYS.dados) || '{}');
  const cfg = localStorage.getItem(STORAGE_KEYS.cfg);
  if(cfg) configuracao = Object.assign(configuracao, JSON.parse(cfg));
}
async function salvarRegistroNumero(cod, registro){
  bancoDados[cod] = registro;
  localStorage.setItem(STORAGE_KEYS.dados, JSON.stringify(bancoDados));
  if(dbBackend === 'firebase') await firebaseDb.ref('dados/' + cod).set(registro);
}
async function removerRegistroNumero(cod){
  delete bancoDados[cod];
  localStorage.setItem(STORAGE_KEYS.dados, JSON.stringify(bancoDados));
  if(dbBackend === 'firebase') await firebaseDb.ref('dados/' + cod).remove();
}
async function salvarConfigPersistente(novo){
  configuracao = Object.assign(configuracao, novo);
  localStorage.setItem(STORAGE_KEYS.cfg, JSON.stringify(configuracao));
  if(dbBackend === 'firebase') await firebaseDb.ref('configuracao').set(configuracao);
}
async function apagarTudoPersistente(){
  bancoDados = {};
  localStorage.removeItem(STORAGE_KEYS.dados);
  if(dbBackend === 'firebase') await firebaseDb.ref('dados').remove();
}

/* ============================================================
   AUTENTICAÇÃO
   ============================================================ */
async function verificarSessao(){
  usuarioLogado = localStorage.getItem(STORAGE_KEYS.user) || '';
  if(usuarioLogado){
    sAdmin = (await sha256(usuarioLogado)) === ADMIN_PHONE_HASH;
    ajustarTelasDoSistema();
  }
}
async function autenticarUsuario(){
  const fone = digitos($('loginFone').value);
  const hint = $('loginFoneHint');
  const input = $('loginFone');
  if(!validarTelefoneBR(fone)){
    input.classList.add('invalid');
    hint.textContent = 'Telefone inválido. Use DDD + número (10 ou 11 dígitos).';
    hint.classList.add('err');
    return;
  }
  input.classList.remove('invalid');
  hint.classList.remove('err');
  hint.textContent = 'Use DDD + número (10 ou 11 dígitos)';
  usuarioLogado = fone;
  sAdmin = (await sha256(fone)) === ADMIN_PHONE_HASH;
  localStorage.setItem(STORAGE_KEYS.user, fone);
  ajustarTelasDoSistema();
  toast(sAdmin ? 'Bem-vindo(a), administrador(a)' : 'Boa rifa!', 'ok');
}
function ajustarTelasDoSistema(){
  $('loginScreen').style.display = 'none';
  $('appMain').style.display = 'block';
  const clientDash = $('clientDashboard');
  const adminTabs = $('adminTabs');
  if(sAdmin){
    clientDash.style.display = 'none';
    adminTabs.style.display = 'flex';
    trocarAba('painel', $('tBtnPainel'));
  } else {
    clientDash.style.display = 'block';
    adminTabs.style.display = 'none';
    $('clientPhoneDisplay').textContent = formatarMascaraTelefone(usuarioLogado);
    atualizarNumerosCompradosDoCliente();
    trocarAba('grade');
  }
  reRenderTudo();
}
function fazerLogout(){
  if(!confirm('Sair da conta?')) return;
  usuarioLogado = '';
  sAdmin = false;
  localStorage.removeItem(STORAGE_KEYS.user);
  $('loginScreen').style.display = 'flex';
  $('appMain').style.display = 'none';
}

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
function trocarAba(idAba, botao){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  $('p-' + idAba).classList.add('active');
  if(botao) botao.classList.add('active');
  if(idAba === 'grade') montarGradeNumeros();
  if(idAba === 'painel' && sAdmin) recalcularBalancoAdmin();
  if(idAba === 'config' && sAdmin) carregarCamposConfig();
}

/* ============================================================
   SELEÇÃO MÚLTIPLA
   ============================================================ */
let numerosSelecionados = new Set();
function toggleSelecaoNumero(cod, btn){
  if(numerosSelecionados.has(cod)){
    numerosSelecionados.delete(cod);
    btn.classList.remove('selecionado');
  } else {
    numerosSelecionados.add(cod);
    btn.classList.add('selecionado');
  }
  atualizarActionBar();
}
function atualizarActionBar(){
  const bar = $('actionBar');
  if(!bar) return;
  const qtd = numerosSelecionados.size;
  if(qtd === 0){
    bar.classList.remove('show');
    document.body.classList.remove('has-action-bar');
    return;
  }
  bar.classList.add('show');
  document.body.classList.add('has-action-bar');
  const total = (qtd * RIFA_PRECO).toFixed(2).replace('.',',');
  $('actionDetail').innerHTML = `<span>${qtd} número${qtd>1?'s':''} selecionado${qtd>1?'s':''}</span> &nbsp;<span class="price">R$ ${total}</span>`;
}
function limparSelecao(){
  numerosSelecionados.clear();
  document.querySelectorAll('.num-btn.selecionado').forEach(b => b.classList.remove('selecionado'));
  atualizarActionBar();
}
function confirmarSelecaoMultipla(){
  if(numerosSelecionados.size === 0) return;
  if(numerosSelecionados.size === 1){
    const cod = [...numerosSelecionados][0];
    limparSelecao();
    carregarModalNumero(cod);
    return;
  }
  abrirModalMultiplo([...numerosSelecionados].sort());
}
function abrirModalMultiplo(numeros){
  modalNumeroAtual = numeros[0];
  pararCountdown();
  $('modalNumeroBadge').textContent = numeros.join(', ');
  $('modalTitulo').textContent = `Reservar ${numeros.length} números`;
  $('modalSub').textContent = `Total: R$ ${(numeros.length * RIFA_PRECO).toFixed(2).replace('.',',')} — Informe seu nome`;
  $('modalForm').style.display = 'block';
  $('mFoneCompradorWrap').style.display = 'none';
  $('modalAdminStatus').style.display = 'none';
  $('modalPixArea').style.display = 'none';
  $('btnLiberarNumero').style.display = 'none';
  const btnAcao = $('btnAcaoModal');
  btnAcao.style.display = 'block';
  btnAcao.textContent = `Confirmar e gerar Pix (${numeros.length} números)`;
  btnAcao.onclick = () => processarEnvioMultiplo(numeros);
  $('mNome').value = '';
  limparSelecao();
  abrirModal();
}
async function processarEnvioMultiplo(numeros){
  const nome = $('mNome').value.trim();
  if(!nome || nome.length < 3){ toast('Informe o nome completo', 'err'); return; }
  const btn = $('btnAcaoModal');
  btn.disabled = true;
  try {
    const agora = Date.now();
    const expiresAt = agora + RIFA_EXPIRACAO_MINUTOS * 60 * 1000;
    for(const cod of numeros){
      if(bancoDados[cod] && bancoDados[cod].fone !== usuarioLogado) continue;
      const registro = { nome, fone: usuarioLogado, status: 'reservado', atualizadoEm: agora, criadoEm: agora, expiresAt };
      await salvarRegistroNumero(cod, registro);
    }
    montarGradeNumeros();
    atualizarNumerosCompradosDoCliente();
    toast(`${numeros.length} número(s) reservado(s)! Pague o Pix para confirmar.`, 'ok');
    $('modalTitulo').textContent = 'Reserva efetuada!';
    $('modalSub').textContent = `Pague R$ ${(numeros.length * RIFA_PRECO).toFixed(2).replace('.',',')} via Pix para garantir todos.`;
    $('modalForm').style.display = 'none';
    btn.style.display = 'none';
    const areaPix = $('modalPixArea');
    areaPix.style.display = 'block';
    const valorTotal = numeros.length * RIFA_PRECO;
    const valorExib = valorTotal.toFixed(2).replace('.',',');
    $('pixValorDisplay').textContent = `R$ ${valorExib}`;
    $('pixStringTarget').textContent = '';
    $('qrCodeTarget').innerHTML = '<div style="font-size:12px;color:var(--muted);padding:20px">Gerando Pix...</div>';
    [$('countdownBlock'), document.querySelector('.pay-instructions'), document.querySelector('.pix-qr-wrap')].forEach(el => { if(el) el.style.display = ''; });
    const codigoLabel = areaPix.querySelector('.form-label');
    const codigoBox = $('pixStringTarget');
    const btnCopiar = areaPix.querySelector('.btn-block-primary');
    if(codigoLabel) codigoLabel.style.display = '';
    if(codigoBox) codigoBox.style.display = '';
    if(btnCopiar) btnCopiar.style.display = '';
    const btnJaPaguei = $('btnJaPaguei');
    if(btnJaPaguei){ btnJaPaguei.style.display = ''; btnJaPaguei.disabled = false; btnJaPaguei.textContent = '✅ Já paguei! Verificar pagamento'; }
    solicitarPixIntermediario(numeros, valorTotal, nome, usuarioLogado)
      .then(dadosMake => {
        exibirPixNoModal(dadosMake, valorExib);
        iniciarPollingConfirmacao(pixPedidoIdAtual, numeros);
      });
    iniciarCountdown(expiresAt, numeros[0]);
    const registro = bancoDados[numeros[0]];
    if(registro) preencherComprovante(Object.assign({}, registro, { _numeros: numeros }));
    btn.onclick = processarEnvioNumero;
  } catch(e){
    console.error(e);
    toast('Erro ao salvar. Tente novamente.', 'err');
  } finally {
    btn.disabled = false;
  }
}

/* ============================================================
   GRADE
   ============================================================ */
function montarGradeNumeros(){
  const grid = $('gridNumeros');
  grid.innerHTML = '';
  for(let i = 1; i <= RIFA_TOTAL; i++){
    const cod = String(i).padStart(3, '0');
    const registro = bancoDados[cod];
    const status = registro ? registro.status : 'livre';
    const meu = registro && registro.fone === usuarioLogado;
    const btn = document.createElement('button');
    btn.className = `num-btn ${status}` + (meu ? ' meu' : '');
    btn.textContent = cod;
    btn.onclick = () => {
      if(status === 'livre' && !sAdmin){
        toggleSelecaoNumero(cod, btn);
      } else {
        carregarModalNumero(cod);
      }
    };
    grid.appendChild(btn);
  }
  atualizarProgresso();
}
function atualizarProgresso(){
  const vendidos = Object.keys(bancoDados).length;
  $('progressTotal').textContent = RIFA_TOTAL;
  $('progressSold').textContent = vendidos;
  $('progressFill').style.width = ((vendidos / RIFA_TOTAL) * 100).toFixed(1) + '%';
}
function atualizarNumerosCompradosDoCliente(){
  const container = $('myNumbersList');
  container.innerHTML = '';
  const meus = [];
  Object.entries(bancoDados).forEach(([num, dado]) => {
    if(dado.fone === usuarioLogado) meus.push({num, status: dado.status});
  });
  if(meus.length === 0){
    container.innerHTML = '<span style="font-size:12px;color:var(--muted)">Você ainda não possui números reservados.</span>';
    return;
  }
  meus.sort((a,b) => a.num.localeCompare(b.num)).forEach(m => {
    const b = document.createElement('button');
    b.className = 'my-number-badge ' + m.status;
    b.textContent = m.num + (m.status === 'pago' ? ' ✓' : '');
    b.onclick = () => carregarModalNumero(m.num);
    container.appendChild(b);
  });
}
function reRenderTudo(){
  if($('appMain').style.display === 'block'){
    if(document.querySelector('.page.active')?.id === 'p-grade') montarGradeNumeros();
    else atualizarProgresso();
    if(sAdmin) recalcularBalancoAdmin();
    else atualizarNumerosCompradosDoCliente();
  }
}

/* ============================================================
   MODAL
   ============================================================ */
function abrirModal(){
  $('modalOverlay').classList.add('open');
  document.body.classList.add('modal-open');
}
function fecharModal(){
  $('modalOverlay').classList.remove('open');
  document.body.classList.remove('modal-open');
  modalNumeroAtual = null;
  pararCountdown();
  pararPollingConfirmacao();
}
function controlarFechamentoModal(e){
  if(e.target === $('modalOverlay')) fecharModal();
}
function carregarModalNumero(cod){
  modalNumeroAtual = cod;
  pararCountdown();
  const registro = bancoDados[cod];
  $('modalNumeroBadge').textContent = cod;
  const inpNome = $('mNome');
  const wrapFone = $('mFoneCompradorWrap');
  const inpFone = $('mFoneComprador');
  const areaPix = $('modalPixArea');
  const areaStatusAdmin = $('modalAdminStatus');
  const btnAcao = $('btnAcaoModal');
  const btnLiberar = $('btnLiberarNumero');
  inpNome.value = '';
  inpFone.value = '';
  wrapFone.style.display = 'none';
  areaPix.style.display = 'none';
  areaStatusAdmin.style.display = 'none';
  btnLiberar.style.display = 'none';
  if(!registro){
    if(sAdmin){
      $('modalTitulo').textContent = 'Cadastrar venda';
      $('modalSub').textContent = 'Cadastro manual pelo administrador';
      $('modalForm').style.display = 'block';
      wrapFone.style.display = 'block';
      areaStatusAdmin.style.display = 'block';
      modalStatusSelecionado = 'reservado';
      atualizarInterfaceStatusAdmin();
      btnAcao.style.display = 'block';
      btnAcao.textContent = 'Salvar venda';
    } else {
      $('modalTitulo').textContent = 'Reservar número';
      $('modalSub').textContent = 'Informe seu nome para gerar o Pix';
      $('modalForm').style.display = 'block';
      btnAcao.style.display = 'block';
      btnAcao.textContent = 'Confirmar e gerar Pix';
      modalStatusSelecionado = 'reservado';
    }
  } else if(sAdmin){
    $('modalTitulo').textContent = 'Editar venda';
    $('modalSub').textContent = 'Comprador: ' + formatarMascaraTelefone(registro.fone);
    $('modalForm').style.display = 'block';
    inpNome.value = registro.nome || '';
    inpFone.value = formatarMascaraTelefone(registro.fone);
    wrapFone.style.display = 'block';
    areaStatusAdmin.style.display = 'block';
    btnLiberar.style.display = 'block';
    modalStatusSelecionado = registro.status;
    atualizarInterfaceStatusAdmin();
    btnAcao.style.display = 'block';
    btnAcao.textContent = 'Salvar alterações';
    construirModuloPixInterno(registro.status, registro);
  } else if(registro.fone === usuarioLogado){
    $('modalTitulo').textContent = 'Seu número ' + cod;
    $('modalSub').textContent = registro.status === 'pago'
      ? 'Pagamento confirmado pela igreja.'
      : 'Aguardando confirmação. Faça o pagamento via Pix abaixo.';
    $('modalForm').style.display = 'none';
    btnAcao.style.display = 'none';
    construirModuloPixInterno(registro.status, registro);
  } else {
    $('modalTitulo').textContent = 'Número ocupado';
    $('modalSub').textContent = 'Este número já foi escolhido por outra pessoa.';
    $('modalForm').style.display = 'none';
    btnAcao.style.display = 'none';
  }
  abrirModal();
}
function definirStatusVenda(st){
  if(!sAdmin) return;
  modalStatusSelecionado = st;
  atualizarInterfaceStatusAdmin();
  construirModuloPixInterno(st);
}
function atualizarInterfaceStatusAdmin(){
  $('optRes').className = 'status-opt' + (modalStatusSelecionado === 'reservado' ? ' sel-reservado' : '');
  $('optPag').className = 'status-opt' + (modalStatusSelecionado === 'pago' ? ' sel-pago' : '');
}
async function processarEnvioNumero(){
  const nome = $('mNome').value.trim();
  if(!nome || nome.length < 3){ toast('Informe o nome completo', 'err'); return; }
  let foneDono;
  if(sAdmin){
    foneDono = digitos($('mFoneComprador').value);
    if(!validarTelefoneBR(foneDono)){
      toast('Informe um telefone válido (10 ou 11 dígitos)', 'err');
      return;
    }
  } else {
    foneDono = usuarioLogado;
  }
  const btn = $('btnAcaoModal');
  btn.disabled = true;
  try{
    const agora = Date.now();
    const expiresAt = (!sAdmin && modalStatusSelecionado === 'reservado')
      ? agora + RIFA_EXPIRACAO_MINUTOS * 60 * 1000
      : null;
    const registro = {
      nome,
      fone: foneDono,
      status: modalStatusSelecionado,
      atualizadoEm: agora,
      criadoEm: bancoDados[modalNumeroAtual]?.criadoEm || agora
    };
    if(expiresAt) registro.expiresAt = expiresAt;
    await salvarRegistroNumero(modalNumeroAtual, registro);
    montarGradeNumeros();
    if(sAdmin){
      recalcularBalancoAdmin();
      toast('Venda salva', 'ok');
      fecharModal();
    } else {
      toast(`Número ${modalNumeroAtual} reservado!`, 'ok');
      atualizarNumerosCompradosDoCliente();
      $('modalTitulo').textContent = 'Reserva efetuada';
      $('modalSub').textContent = 'Pague o Pix abaixo dentro do tempo para confirmar.';
      $('modalForm').style.display = 'none';
      btn.style.display = 'none';
      construirModuloPixInterno('reservado', registro);
    }
  } catch(e){
    console.error(e);
    toast('Erro ao salvar. Tente novamente.', 'err');
  } finally {
    btn.disabled = false;
  }
}
async function excluirReservaAdmin(){
  if(!sAdmin) return;
  if(!confirm(`Liberar o número ${modalNumeroAtual} (apaga o registro)?`)) return;
  try {
    await removerRegistroNumero(modalNumeroAtual);
    montarGradeNumeros();
    recalcularBalancoAdmin();
    toast('Número liberado', 'ok');
    fecharModal();
  } catch(e){
    toast('Erro ao liberar', 'err');
  }
}

/* ============================================================
   MAKE.COM — INTERMEDIÁRIO PIX
   ============================================================ */
async function solicitarPixIntermediario(numeros, valorTotal, nomeCliente, telefoneCliente) {
  if (!URL_WEBHOOK_MAKE) return null;

  const pedidoId = 'pix_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  pixPedidoIdAtual = pedidoId;
  pixNumerosAtual = numeros;

  try {
    console.log("⏳ Aguardando Make processar o Pix...", pedidoId);
    const res = await fetch(URL_WEBHOOK_MAKE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valor: valorTotal,
        descricao: `Sorteio IPBM - Números: ${numeros.join(', ')}`,
        nome: nomeCliente,
        telefone: telefoneCliente,
        cpf: "12345678909",
        numeros: numeros,
        pedido_id: pedidoId
      })
    });

    if (!res.ok) { console.error("❌ Make erro HTTP:", res.status); return null; }

    const dados = await res.json();
    console.log("✅ Pix recebido do Make!", dados);
    if (dados && dados.copia_e_cola) {
      // Inicia polling de confirmação imediatamente após receber o QR
      setTimeout(() => iniciarPollingConfirmacao(pedidoId, numeros), 500);
      return dados;
    }

    // Fallback polling
    const resultado = await aguardarResultadoPix(pedidoId, 15000);
    return resultado;

  } catch (error) {
    console.error("Erro ao solicitar Pix:", error);
    return null;
  }
}

// Polling de CONFIRMAÇÃO: verifica no Firebase se o Asaas confirmou o pagamento
function iniciarPollingConfirmacao(pedidoId, numeros) {
  pararPollingConfirmacao();
  console.log("🔄 Iniciando polling de confirmação para", pedidoId);
  pixPollingTimer = setInterval(async () => {
    try {
      const url = `${FIREBASE_BASE_URL}/pix_resultados/${pedidoId}.json`;
      const res = await fetch(url);
      const dados = await res.json();
      if (dados && dados.status === 'CONFIRMED') {
        console.log("✅ Pagamento confirmado pelo Asaas!", dados);
        pararPollingConfirmacao();
        await confirmarPagamentoAutomatico(numeros);
      }
    } catch(e) { /* continua tentando */ }
  }, 3000);
}

function pararPollingConfirmacao() {
  if (pixPollingTimer) { clearInterval(pixPollingTimer); pixPollingTimer = null; }
}

async function confirmarPagamentoAutomatico(numeros) {
  try {
    const agora = Date.now();
    for (const cod of numeros) {
      const reg = bancoDados[cod];
      if (!reg) continue;
      const atualizado = Object.assign({}, reg, { status: 'pago', atualizadoEm: agora, pagamentoConfirmadoEm: agora });
      await salvarRegistroNumero(cod, atualizado);
    }
    montarGradeNumeros();
    atualizarNumerosCompradosDoCliente();
    toast('🎉 Pagamento confirmado! Número garantido!', 'ok');
    // Atualiza o modal se ainda estiver aberto
    const sit = $('rcSituacao');
    if (sit) { sit.textContent = 'Pagamento confirmado'; sit.className = 'receipt-value status-pago'; }
    pararCountdown();
    construirModuloPixInterno('pago', bancoDados[numeros[0]]);
    console.log("✅ Números marcados como pagos:", numeros);
  } catch(e) {
    console.error("Erro ao confirmar pagamento automático:", e);
  }
}

// Polling: verifica no Firebase a cada 2s se o Make salvou o resultado
async function aguardarResultadoPix(pedidoId, timeoutMs) {
  const FIREBASE_URL = `${FIREBASE_BASE_URL}/pix_resultados/${pedidoId}.json`;
  const inicio = Date.now();

  return new Promise((resolve) => {
    const intervalo = setInterval(async () => {
      try {
        // Verifica se passou do timeout
        if (Date.now() - inicio > timeoutMs) {
          clearInterval(intervalo);
          console.warn("⏱️ Timeout aguardando Pix do Make. Usando Pix fixo.");
          resolve(null);
          return;
        }

        const res = await fetch(FIREBASE_URL);
        const dados = await res.json();

        if (dados && dados.copia_e_cola) {
          clearInterval(intervalo);
          console.log("✅ Pix recebido do Make!", dados);
          // Limpa o resultado do Firebase após ler
          fetch(FIREBASE_URL, { method: 'DELETE' }).catch(() => {});
          resolve(dados);
        }
      } catch(e) {
        // Continua tentando
      }
    }, 2000); // verifica a cada 2 segundos
  });
}
function exibirPixNoModal(dadosMake, valorExibicao) {
  const areaQr = $('qrCodeTarget');
  areaQr.innerHTML = '';

  // Verifica se veio do Asaas (campo copia_e_cola)
  if (dadosMake && dadosMake.copia_e_cola) {
    $('pixTargetChave').textContent = 'Pix gerado via Asaas';
    $('pixStringTarget').textContent = dadosMake.copia_e_cola;

    if (dadosMake.qr_code_base64) {
      const img = document.createElement('img');
      const raw = dadosMake.qr_code_base64;
      img.src = raw.startsWith('data:') ? raw : 'data:image/png;base64,' + raw;
      img.style.cssText = 'width:140px;height:140px;border-radius:8px';
      img.alt = 'QR Code Pix';
      areaQr.appendChild(img);
    } else if (typeof QRCode !== 'undefined') {
      new QRCode(areaQr, { text: dadosMake.copia_e_cola, width: 140, height: 140, correctLevel: QRCode.CorrectLevel.M });
    }
  } else {
    // Fallback para Pix fixo da sua irmã
    $('pixTargetChave').textContent = 'Chave Pix: Wevily Marques de Abreu';
    $('pixStringTarget').textContent = PIX_PAYLOAD_FIXO;
    if (typeof QRCode !== 'undefined') {
      new QRCode(areaQr, { text: PIX_PAYLOAD_FIXO, width: 140, height: 140, correctLevel: QRCode.CorrectLevel.M });
    }
  }
  $('pixValorDisplay').textContent = `R$ ${valorExibicao}`;
}
function construirModuloPixInterno(status, registro){
  const areaPix = $('modalPixArea');
  if(!registro){
    areaPix.style.display = 'none';
    return;
  }
  areaPix.style.display = 'block';
  const blocosPix = [$('countdownBlock'), document.querySelector('.pay-instructions'), document.querySelector('.pix-qr-wrap')];
  const codigoLabel = areaPix.querySelector('.form-label');
  const codigoBox = $('pixStringTarget');
  const btnCopiar = areaPix.querySelector('.btn-block-primary');
  const visivel = status === 'reservado';
  blocosPix.forEach(el => { if(el) el.style.display = visivel ? '' : 'none'; });
  if(codigoLabel) codigoLabel.style.display = visivel ? '' : 'none';
  if(codigoBox) codigoBox.style.display = visivel ? '' : 'none';
  if(btnCopiar) btnCopiar.style.display = visivel ? '' : 'none';
  const btnJaPaguei = $('btnJaPaguei');
  if(btnJaPaguei){
    btnJaPaguei.style.display = visivel ? '' : 'none';
    if(visivel && registro && registro.pagamentoInformado){
      btnJaPaguei.textContent = '📲 Notificação enviada ao admin';
      btnJaPaguei.style.background = 'var(--accent)';
      btnJaPaguei.disabled = true;
    } else if(visivel){
      btnJaPaguei.textContent = '✅ Já paguei! Verificar pagamento';
      btnJaPaguei.style.background = '';
      btnJaPaguei.disabled = false;
    }
  }
  let pagoBanner = $('pagoBannerEl');
  if(status === 'pago'){
    if(!pagoBanner){
      pagoBanner = document.createElement('div');
      pagoBanner.id = 'pagoBannerEl';
      pagoBanner.className = 'pago-banner';
      pagoBanner.innerHTML = '<div class="pago-banner-icon">🎉</div><div class="pago-banner-title">Pagamento Confirmado!</div><div class="pago-banner-sub">Seu número está garantido. Boa sorte!</div>';
      areaPix.insertBefore(pagoBanner, areaPix.firstChild);
    }
    pagoBanner.style.display = '';
  } else {
    if(pagoBanner) pagoBanner.style.display = 'none';
  }
  if(visivel){
    const valorExib = RIFA_PRECO.toFixed(2).replace('.',',');
    solicitarPixIntermediario(
      [modalNumeroAtual],
      RIFA_PRECO,
      registro.nome || '',
      registro.fone || ''
    ).then(dadosMake => {
      exibirPixNoModal(dadosMake, valorExib);
    });
  }
  preencherComprovante(registro);
  if(status === 'reservado' && registro.expiresAt){
    iniciarCountdown(registro.expiresAt, modalNumeroAtual);
  } else {
    pararCountdown();
    if(status === 'pago'){
      const cb = $('countdownBlock');
      cb.style.display = 'none';
    }
  }
}
function copiarCodigoPix(){
  const str = $('pixStringTarget').textContent;
  if(!str){ toast('Nada para copiar', 'err'); return; }
  if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(str).then(
      () => toast('Código Pix copiado!', 'ok'),
      () => fallbackCopy(str)
    );
  } else {
    fallbackCopy(str);
  }
}
async function validarPagamentoPix(){
  const btn = $('btnJaPaguei');
  if(!btn || !modalNumeroAtual) return;
  const registro = bancoDados[modalNumeroAtual];
  if(!registro){ toast('Número não encontrado', 'err'); return; }
  if(registro.status === 'pago'){ toast('Este número já está marcado como pago!', 'ok'); return; }
  btn.disabled = true;
  btn.classList.add('verificando');
  btn.textContent = '⏳ Verificando pagamento...';
  await new Promise(r => setTimeout(r, 2000));
  btn.classList.remove('verificando');
  btn.disabled = false;
  btn.textContent = '✅ Já paguei! Verificar pagamento';
  const confirmado = confirm(
    `Confirmação de pagamento\n\nVocê realizou o Pix de R$ ${RIFA_PRECO.toFixed(2).replace('.',',')} para:\n` +
    `Wevily Marques de Abreu\n\n` +
    `⚠️ Atenção: Ao confirmar, o administrador será notificado para validar seu pagamento.\n\n` +
    `Seu pagamento foi realizado?`
  );
  if(!confirmado) return;
  try {
    const novoRegistro = Object.assign({}, registro, {
      pagamentoInformado: true,
      pagamentoInformadoEm: Date.now()
    });
    await salvarRegistroNumero(modalNumeroAtual, novoRegistro);
    const msg = encodeURIComponent(
      `✅ *Pagamento realizado!*\n\n` +
      `Número: *${modalNumeroAtual}*\n` +
      `Nome: ${registro.nome}\n` +
      `Telefone: ${formatarMascaraTelefone(registro.fone)}\n` +
      `Valor: R$ ${RIFA_PRECO.toFixed(2).replace('.',',')}\n\n` +
      `Por favor, confirme o pagamento no sistema.`
    );
    window.open(`https://wa.me/5586998106406?text=${msg}`, '_blank');
    toast('Pagamento informado! O admin será notificado para confirmar.', 'ok');
    btn.textContent = '📲 Notificação enviada ao admin';
    btn.style.background = 'var(--accent)';
    btn.disabled = true;
  } catch(e){
    console.error(e);
    toast('Erro ao informar pagamento. Tente novamente.', 'err');
  }
}
function fallbackCopy(str){
  try {
    const ta = document.createElement('textarea');
    ta.value = str;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Código Pix copiado!', 'ok');
  } catch(e){
    toast('Copie manualmente o código', 'err');
  }
}
function sanitizarPixTexto(s, n){ return (s || '').substring(0, n).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(); }
function compilarPayloadPixEMV(chave, titular, cidade, valor){
  titular = sanitizarPixTexto(titular, 25) || 'IPBM';
  cidade = sanitizarPixTexto(cidade, 15) || 'TERESINA';
  const f = (id, v) => id + String(v.length).padStart(2,'0') + v;
  const subAr = f('00','BR.GOV.BCB.PIX') + f('01', chave);
  const base = f('00','01') + f('26', subAr) + f('52','0000') + f('53','986') +
               f('54', parseFloat(valor).toFixed(2)) + f('58','BR') +
               f('59', titular) + f('60', cidade) + f('62', f('05','RIFAIPBM')) + '6304';
  let crc = 0xFFFF;
  for(let i = 0; i < base.length; i++){
    crc ^= base.charCodeAt(i) << 8;
    for(let j = 0; j < 8; j++){
      if(crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xFFFF;
    }
  }
  return base + crc.toString(16).toUpperCase().padStart(4,'0');
}

/* ============================================================
   ADMIN
   ============================================================ */
function recalcularBalancoAdmin(){
  if(!sAdmin) return;
  const valores = Object.values(bancoDados);
  const totalReservados = valores.filter(x => x.status === 'reservado').length;
  const totalPagos = valores.filter(x => x.status === 'pago').length;
  const totalLivres = RIFA_TOTAL - totalReservados - totalPagos;
  $('sVend').textContent = totalReservados;
  $('sPag').textContent = totalPagos;
  $('sLivre').textContent = totalLivres;
  $('sCaixa').textContent = `R$ ${(totalPagos * RIFA_PRECO).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
  atualizarProgresso();
  listarCompradoresAdmin();
}
function listarCompradoresAdmin(){
  const search = $('searchList');
  if(!search) return;
  const query = digitos(search.value).length ? digitos(search.value) : search.value.toLowerCase().trim();
  const box = $('listaCompradoresContainer');
  box.innerHTML = '';
  const agrupado = {};
  Object.entries(bancoDados).forEach(([num, d]) => {
    if(!agrupado[d.fone]) agrupado[d.fone] = { nome: d.nome, fone: d.fone, nums: [], pagos: 0, reservados: 0 };
    agrupado[d.fone].nums.push({n: num, st: d.status});
    if(d.status === 'pago') agrupado[d.fone].pagos++;
    else agrupado[d.fone].reservados++;
  });
  const lista = Object.values(agrupado);
  if(lista.length === 0){ box.innerHTML = '<div class="empty-state">Nenhum comprador ainda.</div>'; return; }
  let mostrados = 0;
  lista.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(c => {
    const matchNome = c.nome.toLowerCase().includes(typeof query === 'string' ? query : '');
    const matchFone = digitos(query).length ? c.fone.includes(digitos(query)) : false;
    if(query && !matchNome && !matchFone) return;
    mostrados++;
    const item = document.createElement('div');
    item.className = 'buyer-item';
    item.onclick = () => { trocarAba('grade', $('tBtnGrade')); carregarModalNumero(c.nums[0].n); };
    const tag = c.pagos === c.nums.length
      ? '<span class="buyer-tag pago">PAGO</span>'
      : (c.pagos > 0 ? '<span class="buyer-tag misto">PARCIAL</span>' : '<span class="buyer-tag reservado">RESERVA</span>');
    const nums = c.nums.sort((a,b) => a.n.localeCompare(b.n)).map(x => `<span style="font-weight:800;color:${x.st==='pago'?'var(--primary)':'var(--accent)'}">${x.n}</span>`).join(', ');
    item.innerHTML = `<div class="buyer-row"><div style="min-width:0;flex:1"><div class="buyer-name">${escHTML(c.nome)}</div><div class="buyer-fone">${formatarMascaraTelefone(c.fone)}</div></div>${tag}</div><div class="buyer-nums">Números: ${nums}</div>`;
    box.appendChild(item);
  });
  if(mostrados === 0) box.innerHTML = '<div class="empty-state">Nenhum resultado para a busca.</div>';
}
function escHTML(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function carregarCamposConfig(){
  $('cfgChave').value = configuracao.pix || '';
  $('cfgTitular').value = configuracao.titular || '';
  $('cfgCidade').value = configuracao.cidade || '';
}
async function salvarConfiguracoes(){
  const chave = $('cfgChave').value.trim();
  const titular = $('cfgTitular').value.trim();
  const cidade = $('cfgCidade').value.trim();
  if(!chave){ toast('Informe a chave Pix', 'err'); return; }
  if(!titular){ toast('Informe o titular', 'err'); return; }
  if(!cidade){ toast('Informe a cidade', 'err'); return; }
  try { await salvarConfigPersistente({ pix: chave, titular, cidade }); toast('Configurações salvas', 'ok'); }
  catch(e){ toast('Erro ao salvar', 'err'); }
}
async function reiniciarRifa(){
  if(!confirm('ATENÇÃO: isso apagará TODAS as reservas e pagamentos. Continuar?')) return;
  if(!confirm('Tem certeza absoluta? Esta ação é IRREVERSÍVEL.')) return;
  try { await apagarTudoPersistente(); montarGradeNumeros(); recalcularBalancoAdmin(); toast('Rifa reiniciada', 'ok'); }
  catch(e){ toast('Erro ao reiniciar', 'err'); }
}

/* ============================================================
   EXPORT / BACKUP
   ============================================================ */
function exportarCSV(){
  if(Object.keys(bancoDados).length === 0){ toast('Nada para exportar', 'err'); return; }
  const linhas = ['numero;nome;telefone;status;atualizado_em'];
  Object.entries(bancoDados).sort().forEach(([num, d]) => {
    const data = d.atualizadoEm ? new Date(d.atualizadoEm).toLocaleString('pt-BR') : '';
    linhas.push([num, csvEscape(d.nome), formatarMascaraTelefone(d.fone), d.status, data].join(';'));
  });
  baixarArquivo('rifa-ipbm.csv', '\uFEFF' + linhas.join('\r\n'), 'text/csv;charset=utf-8;');
  toast('CSV gerado', 'ok');
}
function csvEscape(s){ s = (s || '').replace(/"/g,'""'); return /[;"\r\n]/.test(s) ? `"${s}"` : s; }
function exportarBackup(){
  const data = { dados: bancoDados, configuracao, exportadoEm: new Date().toISOString() };
  baixarArquivo('rifa-ipbm-backup.json', JSON.stringify(data, null, 2), 'application/json');
  toast('Backup baixado', 'ok');
}
async function importarBackup(ev){
  const file = ev.target.files[0];
  if(!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if(!data.dados) throw new Error('Arquivo inválido');
    if(!confirm('Substituir todos os dados pelo conteúdo do backup?')) return;
    if(dbBackend === 'firebase'){
      await firebaseDb.ref('dados').set(data.dados);
      if(data.configuracao) await firebaseDb.ref('configuracao').set(data.configuracao);
    } else {
      bancoDados = data.dados;
      if(data.configuracao) configuracao = data.configuracao;
      localStorage.setItem(STORAGE_KEYS.dados, JSON.stringify(bancoDados));
      localStorage.setItem(STORAGE_KEYS.cfg, JSON.stringify(configuracao));
    }
    montarGradeNumeros();
    recalcularBalancoAdmin();
    toast('Backup restaurado', 'ok');
  } catch(e){ toast('Backup inválido: ' + e.message, 'err'); }
  finally { ev.target.value = ''; }
}
function baixarArquivo(nome, conteudo, tipo){
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================
   COUNTDOWN E EXPIRAÇÃO AUTOMÁTICA
   ============================================================ */
function iniciarCountdown(expiresAt, codNumero){
  pararCountdown();
  const cb = $('countdownBlock');
  cb.classList.remove('expired');
  cb.style.display = '';
  $('countdownSub').textContent = 'Você tem este tempo para pagar';
  const tick = async () => {
    const restante = expiresAt - Date.now();
    if(restante <= 0){
      $('countdownTime').textContent = '00:00';
      cb.classList.add('expired');
      $('countdownSub').textContent = 'Tempo expirado. O número foi liberado.';
      pararCountdown();
      const sit = $('rcSituacao');
      if(sit){ sit.textContent = 'Expirada (não paga)'; sit.className = 'receipt-value status-expirado'; }
      [document.querySelector('.pay-instructions'), document.querySelector('.pix-qr-wrap')].forEach(el => { if(el) el.style.display='none'; });
      $('pixStringTarget').style.display='none';
      const lbl = $('modalPixArea').querySelector('.form-label'); if(lbl) lbl.style.display='none';
      const btnCopiar = $('modalPixArea').querySelector('.btn-block-primary'); if(btnCopiar) btnCopiar.style.display='none';
      const reg = bancoDados[codNumero];
      if(reg && reg.status === 'reservado' && reg.expiresAt === expiresAt){
        try { await removerRegistroNumero(codNumero); }
        catch(e){ console.warn('Falha ao liberar número expirado', e); }
        montarGradeNumeros();
        atualizarNumerosCompradosDoCliente();
      }
      return;
    }
    const min = Math.floor(restante / 60000);
    const seg = Math.floor((restante % 60000) / 1000);
    $('countdownTime').textContent = `${String(min).padStart(2,'0')}:${String(seg).padStart(2,'0')}`;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}
function pararCountdown(){ if(countdownTimer){ clearInterval(countdownTimer); countdownTimer = null; } }
async function verificarExpirados(){
  const agora = Date.now();
  const expirados = Object.entries(bancoDados).filter(([n,d]) => d.status === 'reservado' && d.expiresAt && d.expiresAt < agora).map(([n]) => n);
  if(expirados.length === 0) return;
  for(const cod of expirados) try { await removerRegistroNumero(cod); } catch(e){ console.warn('Falha ao expirar', cod, e); }
  reRenderTudo();
}

/* ============================================================
   COMPROVANTE
   ============================================================ */
function preencherComprovante(registro){
  const status = registro.status;
  const sit = $('rcSituacao');
  if(status === 'pago'){ sit.textContent = 'Pagamento confirmado'; sit.className = 'receipt-value status-pago'; }
  else { sit.textContent = 'Aguardando pagamento'; sit.className = 'receipt-value status-aguardando'; }
  $('rcComprador').textContent = registro.nome || '—';
  $('rcTelefone').textContent = formatarMascaraTelefone(registro.fone) || '—';
  $('rcData').textContent = formatarDataHora(registro.criadoEm || registro.atualizadoEm || Date.now());
  if(registro.expiresAt && status === 'reservado'){ $('rcExpira').textContent = formatarDataHora(registro.expiresAt); $('rcExpiraRow').style.display = ''; }
  else { $('rcExpiraRow').style.display = 'none'; }
  const meusDoTelefone = Object.entries(bancoDados).filter(([n,d]) => d.fone === registro.fone).map(([n]) => n).sort();
  if(modalNumeroAtual && !meusDoTelefone.includes(modalNumeroAtual)) meusDoTelefone.push(modalNumeroAtual);
  const bilhetesParaMostrar = meusDoTelefone.length > 0 ? meusDoTelefone : [modalNumeroAtual];
  $('rcQtd').textContent = bilhetesParaMostrar.length;
  $('rcTotal').textContent = `R$ ${(bilhetesParaMostrar.length * RIFA_PRECO).toFixed(2).replace('.',',')}`;
  const bilhetesBox = $('rcBilhetes');
  bilhetesBox.innerHTML = '';
  bilhetesParaMostrar.forEach(n => { const b = document.createElement('span'); b.className = 'receipt-ticket-badge'; b.textContent = n; bilhetesBox.appendChild(b); });
}
function formatarDataHora(ts){
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} às ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}
async function baixarComprovante(){
  const card = $('receiptCard');
  if(!card){ toast('Comprovante indisponível', 'err'); return; }
  if(typeof html2canvas === 'undefined'){ toast('Biblioteca de imagem não carregou', 'err'); return; }
  toast('Gerando imagem...', '');
  try {
    const canvas = await html2canvas(card, { backgroundColor: '#ffffff', scale: 2, logging: false, useCORS: true });
    const nomeArq = `comprovante-rifa-ipbm-${modalNumeroAtual || 'reserva'}.png`;
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nomeArq;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Comprovante baixado', 'ok');
    }, 'image/png');
  } catch(e){ console.error(e); toast('Erro ao gerar comprovante', 'err'); }
}

/* ============================================================
   BOOT
   ============================================================ */
(async function init(){
  setLoading(true);
  aplicarMascaraInput($('loginFone'));
  aplicarMascaraInput($('mFoneComprador'));
  $('loginFone').addEventListener('keydown', e => { if(e.key === 'Enter') autenticarUsuario(); });
  await inicializarBackend();
  await verificarSessao();
  await verificarExpirados();
  cleanupTimer = setInterval(verificarExpirados, 30000);
  setLoading(false);
})();
