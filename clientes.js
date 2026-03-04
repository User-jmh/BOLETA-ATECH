// --- LÓGICA DE VENTANA FLOTANTE PARA CLIENTES ---

// Al abrir el modal, ponemos la fecha de hoy por defecto
function abrirModal() {
    const modal = document.getElementById('modalCliente');
    modal.style.display = 'flex';
    
    // Fecha de hoy por defecto
    document.getElementById('new_fecha_inst').valueAsDate = new Date();
    
    // Enfocar el nombre
    setTimeout(() => document.getElementById('new_nombre').focus(), 100);
}

function cerrarModal() {
    document.getElementById('modalCliente').style.display = 'none';
    limpiarFormularioCliente();
}

function limpiarFormularioCliente() {
    document.getElementById('new_nombre').value = "";
    document.getElementById('new_dni').value = "";
    document.getElementById('new_direccion').value = "";
    document.getElementById('new_plan').value = "";
    document.getElementById('new_precio').value = "";
    document.getElementById('new_notas').value = "";
}

// Función para el precio automático según el plan
function actualizarPrecioSugerido() {
    const select = document.getElementById('new_plan');
    const precio = select.options[select.selectedIndex].dataset.precio;
    if(precio) {
        document.getElementById('new_precio').value = precio;
    }
}

async function registrarNuevoCliente() {
    // 1. Captura de datos (Nombre forzado a MAYÚSCULAS)
    const nombre = document.getElementById('new_nombre').value.trim().toUpperCase();
    const dni = document.getElementById('new_dni').value.trim();
    const direccion = document.getElementById('new_direccion').value.trim();
    const fechaInst = document.getElementById('new_fecha_inst').value;
    const plan = document.getElementById('new_plan').value;
    const precio = document.getElementById('new_precio').value;
    const notas = document.getElementById('new_notas').value.trim();

    // 2. Validación estricta
    if (!nombre || !dni || !precio || !fechaInst) {
        alert("⚠️ Apellidos/Nombres, DNI, Precio y Fecha son obligatorios.");
        return;
    }

    // Feedback visual en el botón
    const btn = event.target;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "REGISTRANDO...";

    try {
        // 3. Inserción en Supabase
        const { error } = await _supabase.from('clientes').insert([
            { 
                nombre: nombre, 
                dni: dni, 
                direccion: direccion,
                fecha_instalacion: fechaInst,
                plan_original: plan, 
                precio_original: parseFloat(precio),
                notas: notas
            }
        ]);

        if (error) throw error;

        // 4. Éxito
        alert("✅ CLIENTE REGISTRADO: " + nombre);
        
        // Limpiamos los cargos de la boleta actual y cargamos el plan nuevo
        const container = document.getElementById('items-container');
        if(container) {
            container.innerHTML = "";
            crearFilaItem(plan, precio);
        }

        cerrarModal();
        
        // Refrescamos el selector de clientes en script.js
        if (typeof cargarClientesDesdeNube === 'function') {
            await cargarClientesDesdeNube();
        }

    } catch (err) {
        console.error("Error completo:", err);
        // Si sale el error de RLS, avisamos qué hacer
        if (err.message.includes("row-level security")) {
            alert("❌ Error de Permisos (RLS): Ejecuta el comando SQL en el panel de Supabase.");
        } else {
            alert("❌ Error: " + err.message);
        }
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// Cerrar al hacer clic fuera
window.addEventListener('click', (e) => {
    const modal = document.getElementById('modalCliente');
    if (e.target === modal) cerrarModal();
});