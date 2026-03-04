const SUPABASE_URL = "https://pewzovmuynionkjkljqo.supabase.co";
const SUPABASE_KEY = "sb_publishable_4i3U-7-3t9cMy7w2OoF1nw_Ih5KkRzF";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.onload = async () => {
    const inBoleta = document.getElementById('in_boleta');
    inBoleta.readOnly = true;
    inBoleta.style.backgroundColor = "#2d3748";
    inBoleta.style.cursor = "not-allowed";

    console.log("AtomSystem: Sincronizando datos...");
    await cargarClientesDesdeNube();
    await actualizarHistorialNube();
    await generarProximoNumero();
    sincronizar();
};

// --- FUNCIÓN DE MEMORIA CORRELATIVA ---
async function generarProximoNumero() {
    try {
        const { data } = await _supabase
            .from('boletas')
            .select('numero_boleta')
            .order('id', { ascending: false })
            .limit(1);

        if (data && data.length > 0) {
            const ultimoNroStr = data[0].numero_boleta;
            const partes = ultimoNroStr.split('-');
            const ultimoValor = parseInt(partes[1]);
            const siguiente = ultimoValor + 1;
            document.getElementById('in_boleta').value = "B001-" + siguiente.toString().padStart(5, '0');
        } else {
            document.getElementById('in_boleta').value = "B001-00001";
        }
    } catch (e) {
        console.error("Error al generar número correlativo");
    }
    sincronizar();
}

// --- GUARDAR Y EDITAR CON FECHAS ---
async function guardarEnNube() {
    const nro = document.getElementById('in_boleta').value;
    const nombre = document.getElementById('in_nombre').value;

    if (!nombre || nombre === "---") {
        alert("⚠️ Por favor, seleccione un cliente.");
        return;
    }

    const items = Array.from(document.getElementsByClassName('item-desc')).map((d, i) => ({
        desc: d.value,
        precio: document.getElementsByClassName('item-price')[i].value
    }));

    const ahora = new Date().toISOString();

    // Enviamos 'fecha' (creación) y 'actualizada_at' (modificación)
    const { error } = await _supabase.from('boletas').upsert({
        numero_boleta: nro,
        total: parseFloat(document.getElementById('out_total').innerText),
        datos_json: { items, nombre, dni: document.getElementById('in_dni').value },
        fecha: ahora,        // Si es nuevo se guarda, si es upsert se mantiene según RLS/DB
        actualizada_at: ahora // Siempre se actualiza al guardar
    }, { onConflict: 'numero_boleta' });

    if (error) {
        alert("Error al sincronizar: " + error.message);
    } else {
        alert("✅ Boleta " + nro + " sincronizada/actualizada.");
        await actualizarHistorialNube();
    }
}

// --- HISTORIAL CON FORMATO DE FECHA Y HORA ---
async function actualizarHistorialNube() {
    // Ordenamos por 'actualizada_at' para ver lo más reciente arriba
    const { data } = await _supabase.from('boletas')
        .select('*')
        .order('actualizada_at', { ascending: false })
        .limit(6);

    const list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = "";

    data?.forEach(b => {
        // Formatear fecha para humanos (Ej: 04/03/2026 15:30)
        const d = new Date(b.actualizada_at);
        const fechaTxt = d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const div = document.createElement('div');
        div.className = 'history-item';
        div.style = "background:#1a202c; padding:12px; margin-top:8px; border-radius:8px; cursor:pointer; display:flex; justify-content:space-between; border-left: 5px solid #4fd1c5;";

        div.onclick = () => {
            alert("Editando Boleta " + b.numero_boleta + "\nÚltima modificación: " + fechaTxt);
            cargarBoletaDesdeHistorial(b);
        };

        div.innerHTML = `
            <div>
                <b style="color:#4fd1c5">${b.numero_boleta}</b><br>
                <small>${b.datos_json.nombre}</small><br>
                <small style="color:gray; font-size:10px;">🕒 ${fechaTxt}</small>
            </div>
            <div style="text-align:right">
                <b>S/ ${b.total}</b><br>
                <span style="font-size:10px; color:#4fd1c5">Editar ✏️</span>
            </div>`;
        list.appendChild(div);
    });
}

// --- PREPARAR NUEVA VENTA ---
async function prepararNuevaVenta() {
    if (confirm("¿Deseas limpiar la pantalla para una nueva boleta?")) {
        document.getElementById('in_nombre').value = "";
        document.getElementById('in_dni').value = "";
        document.getElementById('items-container').innerHTML = "";
        document.getElementById('select_cliente').value = "";
        await generarProximoNumero();
        alert("Modo: Nueva Boleta");
    }
}

// --- RESTO DE FUNCIONES (MANTENIDAS) ---

function cargarBoletaDesdeHistorial(boleta) {
    document.getElementById('in_boleta').value = boleta.numero_boleta;
    document.getElementById('in_nombre').value = boleta.datos_json.nombre;
    document.getElementById('in_dni').value = boleta.datos_json.dni;
    const container = document.getElementById('items-container');
    container.innerHTML = "";
    boleta.datos_json.items.forEach(item => crearFilaItem(item.desc, item.precio));
    sincronizar();
}

async function cargarClientesDesdeNube() {
    const { data } = await _supabase.from('clientes').select('*').order('nombre');
    const selector = document.getElementById('select_cliente');
    selector.innerHTML = '<option value="">-- Seleccionar Cliente --</option>';
    data?.forEach(c => {
        let opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nombre;
        opt.dataset.info = JSON.stringify(c);
        selector.appendChild(opt);
    });
}

function cargarCliente() {
    const select = document.getElementById('select_cliente');
    const opt = select.options[select.selectedIndex];
    if (!opt.value) return;
    const c = JSON.parse(opt.dataset.info);
    document.getElementById('in_nombre').value = c.nombre;
    document.getElementById('in_dni').value = c.dni;
    document.getElementById('items-container').innerHTML = "";
    crearFilaItem(c.plan_original, c.precio_original);
}

function crearFilaItem(desc = "", precio = "") {
    const container = document.getElementById('items-container');
    const div = document.createElement('div');
    div.className = 'item-row';
    div.style = "display:flex; gap:5px; margin-bottom:8px;";
    div.innerHTML = `
        <input type="text" class="item-desc" value="${desc}" oninput="sincronizar()" style="flex:2">
        <input type="number" class="item-price" value="${precio}" oninput="sincronizar()" style="flex:1">
        <button onclick="this.parentElement.remove(); sincronizar();" style="color:#fc8181; background:none; border:none; cursor:pointer; font-weight:bold">✕</button>
    `;
    container.appendChild(div);
    sincronizar();
}

function sincronizar() {
    document.getElementById('out_boleta').innerText = document.getElementById('in_boleta').value;
    document.getElementById('out_nombre').innerText = document.getElementById('in_nombre').value || "---";
    document.getElementById('out_dni').innerText = document.getElementById('in_dni').value || "---";
    const descs = document.getElementsByClassName('item-desc');
    const prices = document.getElementsByClassName('item-price');
    const tableBody = document.getElementById('out_table_body');
    let total = 0;
    tableBody.innerHTML = "";
    for (let i = 0; i < descs.length; i++) {
        let p = parseFloat(prices[i].value) || 0;
        total += p;
        tableBody.innerHTML += `<tr><td>${descs[i].value}</td><td style="text-align:right">S/ ${p.toFixed(2)}</td></tr>`;
    }
    document.getElementById('out_total').innerText = total.toFixed(2);
}

function imprimirYGuardar() {
    guardarEnNube();
    window.print();
}



function cargarCliente() {
    const select = document.getElementById('select_cliente');
    const opt = select.options[select.selectedIndex];
    if (!opt.value) return;

    const c = JSON.parse(opt.dataset.info);
    document.getElementById('in_nombre').value = c.nombre;

    // Mostramos DNI y Dirección juntos
    const infoCliente = `${c.dni || ''} | ${c.direccion || 'Sin dirección'}`;
    document.getElementById('in_dni').value = infoCliente;

    document.getElementById('items-container').innerHTML = "";
    crearFilaItem(c.plan_original, c.precio_original);

    sincronizar();
}

// Función para convertir números a texto (Formato Perú)
function numeroALetrasPeruanas(num) {
    const unidades = ['UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = ['ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];

    let entero = Math.floor(num);
    let centimos = Math.round((num - entero) * 100);
    let letras = "";

    if (entero === 0) letras = "CERO";
    else if (entero < 10) letras = unidades[entero - 1];
    else if (entero < 20) {
        if (entero === 10) letras = "DIEZ";
        else letras = especiales[entero - 11];
    } else if (entero < 100) {
        let d = Math.floor(entero / 10);
        let u = entero % 10;
        letras = decenas[d - 1] + (u > 0 ? " Y " + unidades[u - 1] : "");
    } else {
        letras = "CIENTO " + entero; // Simplificado para montos de tus planes
    }

    return `SON: ${letras} CON ${centimos.toString().padStart(2, '0')}/100 SOLES`;
}


// Crea un vigilante que detecta cuando el número "40.00" aparece
const observer = new MutationObserver(() => {
    const totalActual = document.getElementById('out_total').innerText;
    const montoNumerico = parseFloat(totalActual.replace(/[^0-9.]/g, ''));

    if (!isNaN(montoNumerico)) {
        document.getElementById('out_total_letras').innerText = numeroALetrasPeruanas(montoNumerico);
    }
});

// Empezar a vigilar el ID out_total
const target = document.getElementById('out_total');
if (target) {
    observer.observe(target, { childList: true, characterData: true, subtree: true });
}