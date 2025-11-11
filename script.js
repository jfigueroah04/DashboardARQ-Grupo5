/* ==== utilidades ==== */
// Helper that accepts either 'id' or '#id' and returns the element or null
const $ = (id) => {
  if (!id) return null;
  try {
    const clean = (typeof id === 'string' && id.startsWith('#')) ? id.slice(1) : id;
    return document.getElementById(clean);
  } catch (e) {
    return null;
  }
};
function waitFor(selectorOrId, { timeoutMs = 3000, intervalMs = 50 } = {}) {
  const isId = selectorOrId.startsWith("#");
  const sel = selectorOrId;
  return new Promise((resolve) => {
    const t0 = performance.now();
    const iv = setInterval(() => {
      const el = isId ? $(selectorOrId.slice(1)) : document.querySelector(sel);
      if (el) {
        clearInterval(iv);
        resolve(el);
      } else if (performance.now() - t0 > timeoutMs) {
        clearInterval(iv);
        resolve(null); // Resuelve con null si no encuentra
      }
    }, intervalMs);
  });
}

/* ==== estado global ==== */
const logs = [];
let simActive = false;
let simLoop = null;
let securityPort = null;
let lightingPort = null;

/* ==== reloj (tolerante si el nodo no existe) ==== */
(function startClock() {
  const tick = () => {
    const node = $("#clock");
    if (!node) return; // evita error si aún no existe
    const now = new Date();
    node.innerHTML =
      `${now.toLocaleTimeString("es-GT",{hour:"2-digit",minute:"2-digit"})} 
      <br><small>${now.toLocaleDateString("es-GT",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}</small>`;
  };
  tick();
  setInterval(tick, 1000);
})();

/* ==== pantalla de carga ==== */
function hideLoading() {
  const loading = document.getElementById("loading");
  const main = document.getElementById("main-content");
  if (loading) loading.style.display = "none";
  if (main) main.classList.remove("hidden");
}

window.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.includes("index")) {
    setTimeout(hideLoading, 500);
  } else {
    hideLoading();
  }
});

// Backup: ensure toggleSidebar works even if binding via waitFor misses (attach on load)
window.addEventListener('load', () => {
  const tb = document.getElementById('toggleSidebar');
  if (tb) tb.addEventListener('click', toggleSidebar);
});

/* ==== modales ==== */
function openModal(type) {
  const modal = $("#modal");
  const title = $("#modalTitle");
  const content = $("#modalContent");
  if (!modal || !title || !content) return;

  if (type === "electricity") {
    title.textContent = "Alertas de Electricidad";
    content.textContent = "Alertas pendientes: Ninguna. Todos los sensores funcionan correctamente.";
  } else if (type === "security") {
    title.textContent = "Alertas de Seguridad";
    content.textContent = "Alertas pendientes: Ninguna. Sistema de acceso operativo.";
  }

  modal.classList.remove("hidden");
}

function closeModal() {
  const modal = $("#modal");
  if (modal) modal.classList.add("hidden");
}

function openSupportModal() {
  const modal = document.getElementById("supportModal");
  if (modal) modal.classList.remove("hidden");
}

function closeSupportModal() {
  const modal = document.getElementById("supportModal");
  if (modal) modal.classList.add("hidden");
}

/* ==== helpers UI seguros ==== */
function pushLog(origen, evento, detalle) {
  const table = document.querySelector("#tblLogs");
  if (!table) return;
  const time = new Date().toLocaleString("es-GT");
  const row = table.insertRow(1); // Insert after header
  row.innerHTML = `<td>${time}</td><td>${origen}</td><td>${evento}</td><td>${detalle}</td>`;
  const eeprom = $("#eeprom");
  const logCount = $("#logCount");
  if (eeprom) {
    logs.push({ time, origen, evento, detalle });
    eeprom.textContent = `${Math.min(logs.length, 100)} / 100`;
  }
  if (logCount) {
    logCount.textContent = `${logs.length} eventos`;
  }
}

function setFloorLights(floor, light) {
  const windows = {
    "nivel4": ["window1", "window2", "window3", "window4", "window5"],
    "nivel3": ["window3_1", "window3_2", "window3_3", "window3_4", "window3_5"],
    "nivel2": ["window2_1", "window2_2", "window2_3", "window2_4", "window2_5"],
    "lobby": ["windowL_1", "windowL_2", "windowL_3", "windowL_4", "windowL_5"]
  };
  const ids = windows[floor] || [];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.fill = light ? "#fbbf24" : "#3b82f6";
  });
}

function setZone(prefix, { motion = false, light = false } = {}) {
  const dot = $(`dot${prefix}Mov`);
  const txtM = $(`txt${prefix}Mov`);
  const btnL = $(`btn${prefix}Light`);
  const txtL = $(`txt${prefix}Light`);
  if (dot) dot.style.background = motion ? "#22c55e" : "#6b7280";
  if (txtM) txtM.textContent = `Movimiento: ${motion ? "Detectado" : "No detectado"}`;

  // Normalizar apariencia del botón según la zona (mantener coherencia Tailwind)
  if (btnL) {
    const color = prefix === "Lobby" ? 'blue' : prefix === 'P1' ? 'green' : prefix === 'P2' ? 'indigo' : prefix === 'P3' ? 'purple' : 'gray';
    if (light) {
      // Estado ON
      console.log(`setZone: ${prefix} -> ON`);
      btnL.classList.remove(`bg-${color}-100`, `hover:bg-${color}-200`, `text-${color}-800`);
      btnL.classList.add(`bg-${color}-500`, 'text-white');
      btnL.dataset.on = '1';
    } else {
      console.log(`setZone: ${prefix} -> OFF`);
      // Estado OFF
      btnL.classList.remove(`bg-${color}-500`, 'text-white');
      btnL.classList.add(`bg-${color}-100`, `text-${color}-800`);
      btnL.dataset.on = '0';
    }
  }

  if (txtL) txtL.textContent = `Luz: ${light ? "Encendida" : "Apagada"}`;

  // Actualizar SVG
  const floor = prefix === "P3" ? "nivel4" : prefix === "P2" ? "nivel3" : prefix === "P1" ? "nivel2" : prefix === "Lobby" ? "lobby" : null;
  if (floor) setFloorLights(floor, light);
}

function setTerraza({ dark = false, light = false } = {}) {
  const dot = $("#dotTerrDark");
  const txtD = $("#txtTerrDark");
  const btnL = $("#btnTerrLight");
  const txtL = $("#txtTerrLight");
  if (dot) dot.style.background = dark ? "#f59e0b" : "#3b82f6";
  if (txtD) txtD.textContent = `Luz ambiente: ${dark ? "Oscuro" : "Claro"}`;
  if (btnL) {
    if (light) {
      console.log('setTerraza: ON');
      btnL.classList.remove('bg-yellow-100', 'hover:bg-yellow-200', 'text-yellow-800');
      btnL.classList.add('bg-yellow-500', 'text-white');
      btnL.dataset.on = '1';
    } else {
      console.log('setTerraza: OFF');
      btnL.classList.remove('bg-yellow-500', 'text-white');
      btnL.classList.add('bg-yellow-100', 'text-yellow-800');
      btnL.dataset.on = '0';
    }
  }
  if (txtL) txtL.textContent = `Luz: ${light ? "Encendida" : "Apagada"}`;
  // Update building SVG terrace indicator if present
  try {
    const terraceEl = document.getElementById('windowTerrace');
    if (terraceEl) terraceEl.style.fill = light ? "#fbbf24" : "#3b82f6";
  } catch (e) {
    // noop
  }
}

function setAccess(type, { uid = "—", open = false, result = "—" } = {}) {
  const gateEl = $("#gateAnimation");
  const barrierEl = $("#barrierAnimation");
  const txtEl = type === "garita" ? $("#txtServoG") : $("#txtServoP");
  const uidEl = type === "garita" ? $("#uidG") : $("#uidP");

  if (type === "garita" && gateEl) {
    gateEl.style.transform = open ? "translateX(-100%)" : "translateX(0%)";
    if (txtEl) txtEl.textContent = open ? "Abierta" : "Cerrada";
  } else if (type === "parqueo" && barrierEl) {
    barrierEl.style.transform = open ? "rotate(90deg)" : "rotate(0deg)";
    if (txtEl) txtEl.textContent = open ? "Abierta" : "Cerrada";
  }

  if (open) {
    setTimeout(() => {
      if (type === "garita" && gateEl) {
        gateEl.style.transform = "translateX(0%)";
        if (txtEl) txtEl.textContent = "Cerrada";
      } else if (type === "parqueo" && barrierEl) {
        barrierEl.style.transform = "rotate(0deg)";
        if (txtEl) txtEl.textContent = "Cerrada";
      }
    }, 3000);
  }

  if (uidEl) uidEl.textContent = uid;
  $("#lastAccess").textContent = `${type === "garita" ? "Garita" : "Parqueo"} · UID ${uid}`;
  $("#accessResult").textContent = result;
}

// Global fallback functions so onclick attributes in HTML work even if async binding fails
window.tryOpenGarita = function() {
  try {
    console.log('tryOpenGarita invoked');
    const uid = 'LOCAL-' + Math.random().toString(16).substring(2,6).toUpperCase();
    setAccess('garita', { uid, open: true, result: 'Manual' });
    pushLog('RFID Garita', 'Acceso manual', `UID ${uid}`);
  } catch (e) {
    console.error('Error in tryOpenGarita', e);
  }
};

window.tryOpenParqueo = function() {
  try {
    console.log('tryOpenParqueo invoked');
    const uid = 'LOCAL-' + Math.random().toString(16).substring(2,6).toUpperCase();
    setAccess('parqueo', { uid, open: true, result: 'Manual' });
    pushLog('RFID Parqueo', 'Acceso manual', `UID ${uid}`);
  } catch (e) {
    console.error('Error in tryOpenParqueo', e);
  }
};

// Fallback for Terraza button in electricity page
window.tryTerrace = function() {
  try {
    console.log('tryTerrace invoked');
    const btn = document.getElementById('btnTerrLight');
    // Considerar ON solo si tiene la clase de estado 'fuerte' (500/400)
    const isOn = btn && (btn.classList.contains('bg-yellow-400') || btn.classList.contains('bg-yellow-500'));
    setTerraza({ light: !isOn });
    pushLog('Usuario', 'Luz manual', `Terraza: ${!isOn ? 'Encendida' : 'Apagada'}`);
  } catch (e) {
    console.error('Error in tryTerrace', e);
  }
};

// Global fallback functions for All On / All Off buttons
window.tryAllOn = function() {
  try {
    console.log('tryAllOn invoked');
    setZone('Lobby', { light: true });
    setZone('P1', { light: true });
    setZone('P2', { light: true });
    setZone('P3', { light: true });
    setTerraza({ light: true });
    pushLog('Usuario', 'Luz manual', 'Todas: Encendidas (fallback)');
  } catch (e) {
    console.error('Error in tryAllOn', e);
  }
};

window.tryAllOff = function() {
  try {
    console.log('tryAllOff invoked');
    setZone('Lobby', { light: false });
    setZone('P1', { light: false });
    setZone('P2', { light: false });
    setZone('P3', { light: false });
    setTerraza({ light: false });
    pushLog('Usuario', 'Luz manual', 'Todas: Apagadas (fallback)');
  } catch (e) {
    console.error('Error in tryAllOff', e);
  }
};


/* ==== simulación (start/stop) ==== */
function startSim() {
  if (simLoop) clearInterval(simLoop);
  pushLog("Sistema", "Simulación", "Iniciada");
  simLoop = setInterval(() => {
    const rand = () => Math.random() < 0.5;
    setZone("Lobby", { motion: rand(), light: rand() });
    setZone("P1", { motion: rand(), light: rand() });
    setZone("P2", { motion: rand(), light: rand() });
    setZone("P3", { motion: rand(), light: rand() });
    setTerraza({ dark: rand(), light: rand() });

    if (Math.random() < 0.4) {
  const ok = Math.random() < 0.8; // 80% de éxito
  const uid = Math.random().toString(16).substring(2, 10).toUpperCase();
  const isGarita = Math.random() < 0.5;
  const tipo = isGarita ? "garita" : "parqueo";
  
  // Actualiza acceso con animación visual
  setAccess(tipo, { uid, open: ok, result: ok ? "Autorizado" : "Denegado" });
  
  // Agrega el evento al historial
  pushLog(
    tipo === "garita" ? "RFID Garita" : "RFID Parqueo",
    ok ? "Acceso autorizado" : "Acceso denegado",
    `UID ${uid}`
  );
}

function stopSim() {
  if (simLoop) clearInterval(simLoop);
  simLoop = null;
  simActive = false;
  pushLog("Sistema", "Simulación", "Detenida");
}

  }, 1500);
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.classList.toggle("w-64");
    sidebar.classList.toggle("w-16");
    const spans = sidebar.querySelectorAll("span");
    spans.forEach(span => span.classList.toggle("hidden"));
    const icons = sidebar.querySelectorAll("i");
    icons.forEach(icon => {
      if (sidebar.classList.contains("w-16")) {
        icon.classList.remove("mr-3");
      } else {
        icon.classList.add("mr-3");
      }
    });
  }
}

/* ==== binding de botones (tolerante) ==== */
(async function bindUI() {
  const btnSim = await waitFor("#btnSim");
  const btnConnectSecurity = await waitFor("#btnConnectSecurity");
  const btnConnectLighting = await waitFor("#btnConnectLighting");

  // Toggle sidebar
  const btnToggleSidebar = await waitFor("#toggleSidebar");
  if (btnToggleSidebar) {
    btnToggleSidebar.addEventListener("click", toggleSidebar);
  }

  // Support modal
  const btnSupport = await waitFor("#btnSupport");
  if (btnSupport) {
    btnSupport.addEventListener("click", (e) => {
      e.preventDefault();
      openSupportModal();
    });
  }

  // Botones de luz
  const btnLobbyLight = await waitFor("#btnLobbyLight");
  const btnP1Light = await waitFor("#btnP1Light");
  const btnP2Light = await waitFor("#btnP2Light");
  const btnP3Light = await waitFor("#btnP3Light");
  const btnTerrLight = await waitFor("#btnTerrLight");

  if (btnSim) {
    btnSim.addEventListener("click", () => {
      simActive = !simActive;
      const icon = btnSim.querySelector('i');
      if (simActive) {
        icon.className = 'fas fa-pause mr-2';
        startSim();
      } else {
        icon.className = 'fas fa-play mr-2';
        stopSim();
      }
    });
  }

  // Export button removed per UI request

  if (btnConnectSecurity) {
    btnConnectSecurity.addEventListener("click", async () => {
      try {
        securityPort = await navigator.serial.requestPort();
        await securityPort.open({ baudRate: 115200 });
        alert("✅ Arduino de Seguridad conectado correctamente");
        pushLog("Sistema", "Serial Seguridad", "Conectado");
      } catch (e) {
        alert("⚠ No se pudo conectar al Arduino de Seguridad: " + e.message);
      }
    });
  }

  if (btnConnectLighting) {
    btnConnectLighting.addEventListener("click", async () => {
      try {
        lightingPort = await navigator.serial.requestPort();
        await lightingPort.open({ baudRate: 115200 });
        alert("✅ Arduino de Iluminación conectado correctamente");
        pushLog("Sistema", "Serial Iluminación", "Conectado");
      } catch (e) {
        alert("⚠ No se pudo conectar al Arduino de Iluminación: " + e.message);
      }
    });
  }

  // Event listeners para botones de luz
  const lightButtons = [
    { btn: btnLobbyLight, zone: "Lobby" },
    { btn: btnP1Light, zone: "P1" },
    { btn: btnP2Light, zone: "P2" },
    { btn: btnP3Light, zone: "P3" },
    { btn: btnTerrLight, zone: "Terr" }
  ];

  lightButtons.forEach(({ btn, zone }) => {
    if (btn) {
      btn.addEventListener("click", () => {
        // Prefer data attribute for state; fallback to class check
        const isOn = (btn.dataset && btn.dataset.on === '1') || btn.classList.contains('text-white');
        if (zone === "Terr") {
          setTerraza({ light: !isOn });
        } else {
          setZone(zone, { light: !isOn });
        }
        pushLog("Usuario", "Luz manual", `${zone}: ${!isOn ? "Encendida" : "Apagada"}`);
      });
    }
  });

  // Debug / fallback: ensure Terraza button always responde (explicit handler & keyboard support)
  if (btnTerrLight) {
    try {
      btnTerrLight.addEventListener('click', () => {
        console.log('DEBUG: btnTerrLight clicked');
        const isOn = (btnTerrLight.dataset && btnTerrLight.dataset.on === '1') || btnTerrLight.classList.contains('text-white');
        setTerraza({ light: !isOn });
        pushLog('Usuario', 'Luz manual', `Terr: ${!isOn ? 'Encendida' : 'Apagada'}`);
      });
      // keyboard accessibility: enter/space
      btnTerrLight.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          btnTerrLight.click();
        }
      });
    } catch (e) {
      console.warn('No se pudo vincular manejador extra para btnTerrLight', e);
    }
  }

  // Botones específicos de security.html
  const btnSimulateAccess = await waitFor("#btnSimulateAccess");
  const btnSimulateDeny = await waitFor("#btnSimulateDeny");
  const btnTryGarita = await waitFor('#btnTryGarita');
  const btnTryParqueo = await waitFor('#btnTryParqueo');

  // Global control buttons
  const btnAllOn = await waitFor('#btnAllOn');
  const btnAllOff = await waitFor('#btnAllOff');

  if (btnSimulateAccess) {
    btnSimulateAccess.addEventListener("click", () => {
      const uid = Math.random().toString(16).substring(2, 10).toUpperCase();
      const isGarita = Math.random() < 0.5;
      const tipo = isGarita ? "garita" : "parqueo";
      setAccess(tipo, { uid, open: true, result: "Autorizado" });
      pushLog(tipo === "garita" ? "RFID Garita" : "RFID Parqueo", "Acceso autorizado", `UID ${uid}`);
    });
  }

  if (btnSimulateDeny) {
    btnSimulateDeny.addEventListener("click", () => {
      const uid = Math.random().toString(16).substring(2, 10).toUpperCase();
      const isGarita = Math.random() < 0.5;
      const tipo = isGarita ? "garita" : "parqueo";
      setAccess(tipo, { uid, open: false, result: "Denegado" });
      pushLog(tipo === "garita" ? "RFID Garita" : "RFID Parqueo", "Acceso denegado", `UID ${uid}`);
    });
  }
  // Handlers for quick test buttons on the visualization (work without Arduino)
  if (btnTryGarita) {
    btnTryGarita.addEventListener('click', () => {
      const uid = 'LOCAL-' + Math.random().toString(16).substring(2, 6).toUpperCase();
      setAccess('garita', { uid, open: true, result: 'Manual' });
      pushLog('RFID Garita', 'Acceso manual', `UID ${uid}`);
    });
  }

  if (btnTryParqueo) {
    btnTryParqueo.addEventListener('click', () => {
      const uid = 'LOCAL-' + Math.random().toString(16).substring(2, 6).toUpperCase();
      setAccess('parqueo', { uid, open: true, result: 'Manual' });
      pushLog('RFID Parqueo', 'Acceso manual', `UID ${uid}`);
    });
  }

  if (btnAllOn) {
    btnAllOn.addEventListener('click', () => {
      setZone('Lobby', { light: true });
      setZone('P1', { light: true });
      setZone('P2', { light: true });
      setZone('P3', { light: true });
      setTerraza({ light: true });
      pushLog('Usuario', 'Luz manual', 'Todas: Encendidas');
    });
  }

  if (btnAllOff) {
    btnAllOff.addEventListener('click', () => {
      setZone('Lobby', { light: false });
      setZone('P1', { light: false });
      setZone('P2', { light: false });
      setZone('P3', { light: false });
      setTerraza({ light: false });
      pushLog('Usuario', 'Luz manual', 'Todas: Apagadas');
    });
  }

  // Actualizar status de Arduino
  const arduinoStatus = $("#arduinoStatus");
  if (arduinoStatus) {
    if (securityPort || lightingPort) {
      arduinoStatus.textContent = "Conectado";
      arduinoStatus.style.color = "green";
    } else {
      arduinoStatus.textContent = "Desconectado";
      arduinoStatus.style.color = "red";
    }
  }
})();