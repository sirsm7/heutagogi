/**
 * HEUTAGOGI@TEAM_MELAKA - Enjin Logik Pentadbir Pusat & Visualisasi Data
 * Mengendalikan cantuman data rentas jadual (Joins), penjanaan carta, dan kawalan sesi khusus untuk Super Admin.
 * Memerlukan: supabaseClient.js, Chart.js, dan SweetAlert2 dimuatkan terlebih dahulu.
 */

// Pembolehubah Global (Global State)
let aiChartInstance = null;
let parlimenChartInstance = null;
let userChartInstance = null;
let globalLogData = []; 

document.addEventListener("DOMContentLoaded", () => {
    // 1. Gatekeeper: Pengesahan Sesi Super Admin
    const userRole = sessionStorage.getItem('heuta_user_role');
    const userName = sessionStorage.getItem('heuta_user_name');

    if (userRole !== 'SUPER ADMIN') {
        window.location.replace('index.html');
        return;
    }

    // 2. Penetapan Identiti Pentadbir
    const adminIdentityEl = document.getElementById('adminIdentity');
    if (adminIdentityEl) {
        adminIdentityEl.innerText = userName || 'PENTADBIR SISTEM';
    }
    
    // 3. Pengikatan Acara Global (Event Bindings)
    document.getElementById('btnAdminLogout')?.addEventListener('click', handleAdminLogout);
    document.getElementById('btnRefreshData')?.addEventListener('click', fetchAndRenderData);
    document.getElementById('btnDownloadCSV')?.addEventListener('click', downloadCSV);
    document.getElementById('parlimenFilter')?.addEventListener('change', applyFilters);
    document.getElementById('roleFilter')?.addEventListener('change', applyFilters);
    document.getElementById('btnModalCloseTop')?.addEventListener('click', closeModal);
    document.getElementById('btnModalCloseBottom')?.addEventListener('click', closeModal);

    // Pengikatan Acara Perwakilan (Event Delegation) untuk butang dalam jadual dinamik
    document.getElementById('logTableBody')?.addEventListener('click', (e) => {
        const btnDetail = e.target.closest('.btn-detail');
        if (btnDetail) {
            const userId = btnDetail.getAttribute('data-user-id');
            openUserModal(userId);
        }
    });

    // 4. Inisialisasi Data Pertama
    setTimeout(() => {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.classList.add('hidden'), 500);
        }
        
        const dashboard = document.getElementById('dashboardSection');
        if (dashboard) {
            dashboard.classList.remove('hidden');
            dashboard.classList.add('flex');
        }
        
        fetchAndRenderData();
    }, 1200);
});

/**
 * Menarik, memproses, dan mencantum (Join) data dari 3 jadual berasingan.
 */
async function fetchAndRenderData() {
    toggleLoading(true, 'Menjalankan Analisa Silang Terperinci...');
    try {
        // A. Tarik Data Analitik (Pembalakan Penggunaan)
        const { data: analytics, error: errA } = await supabaseClient.from('heuta_analytics').select('*');
        if (errA) throw errA;

        // B. Tarik Data Pengguna
        const { data: users, error: errU } = await supabaseClient.from('heuta_users').select('id, full_name, role, kod_sekolah, email, created_at');
        if (errU) throw errU;

        // C. Tarik Maklumat Sekolah
        const { data: schools, error: errS } = await supabaseClient.from('smpid_sekolah_data').select('kod_sekolah, nama_sekolah, parlimen, jenis_sekolah, daerah, nama_pgb, no_telefon_pgb');
        if (errS) throw errS;

        // D. Pemprosesan: Pemetaan O(N) untuk prestasi yang tinggi (Memory Join)
        const schoolMap = {};
        schools.forEach(s => schoolMap[s.kod_sekolah] = s);

        const validUserMap = {};
        users.forEach(u => {
            const sch = schoolMap[u.kod_sekolah];
            validUserMap[u.id] = { 
                ...u, 
                nama_sekolah: sch ? sch.nama_sekolah : 'PENTADBIR / LUAR SEKOLAH', 
                parlimen: sch ? sch.parlimen : 'PUSAT',
                jenis_sekolah: sch ? sch.jenis_sekolah : 'CENTRAL',
                daerah: sch ? sch.daerah : 'PUSAT',
                nama_pgb: sch ? sch.nama_pgb : 'Tiada Rekod PGB',
                no_telefon_pgb: sch ? sch.no_telefon_pgb : 'N/A'
            };
        });

        // E. Gabungan Mutlak (Merge Data)
        globalLogData = analytics
            .filter(log => validUserMap[log.user_id])
            .map(log => ({
                ...log,
                ...validUserMap[log.user_id]
            }));

        // F. Kemaskini Pilihan Penapis (Filter) Parlimen
        const listParlimen = [...new Set(globalLogData.map(s => s.parlimen))].sort();
        const selectP = document.getElementById('parlimenFilter');
        if (selectP) {
            const oldVal = selectP.value;
            selectP.innerHTML = '<option value="SEMUA">Semua Parlimen</option>' + 
                                listParlimen.map(p => `<option value="${p}">${p}</option>`).join('');
            if (listParlimen.includes(oldVal)) selectP.value = oldVal;
        }

        // G. Proses KPI dan Carta
        processStats(globalLogData);
        applyFilters();

    } catch (err) {
        console.error('Ralat Analitik:', err);
        Swal.fire({ icon: 'error', title: 'Kegagalan Sinkronisasi', text: err.message });
    } finally {
        toggleLoading(false);
    }
}

/**
 * Memproses statitik dan KPI teratas berdasarkan data semasa.
 */
function processStats(logs) {
    let grandTotalClicks = 0;
    let activeTodayCount = 0;
    const aiData = {};
    const parlimenData = {};
    const roleData = { 'MURID': 0, 'GURU': 0, 'IBU BAPA': 0, 'SUPER ADMIN': 0 };
    const todayStr = new Date().toISOString().split('T')[0];

    logs.forEach(log => {
        const total = log.total_interactions || 0;
        grandTotalClicks += total;

        if (log.last_active && log.last_active.startsWith(todayStr)) activeTodayCount++;

        const clicks = log.item_clicks || {};
        for (const [key, val] of Object.entries(clicks)) {
            if (!['dashboard_pengguna', 'homepage'].includes(key)) {
                const lbl = formatLabel(key);
                aiData[lbl] = (aiData[lbl] || 0) + val;
            }
        }

        if (log.parlimen) parlimenData[log.parlimen] = (parlimenData[log.parlimen] || 0) + total;
        if (log.role && roleData.hasOwnProperty(log.role)) roleData[log.role] = (roleData[log.role] || 0) + total;
    });

    // Render Metrik ke DOM
    if(document.getElementById('kpiUsers')) document.getElementById('kpiUsers').innerText = logs.length.toLocaleString();
    if(document.getElementById('kpiInteractions')) document.getElementById('kpiInteractions').innerText = grandTotalClicks.toLocaleString();
    if(document.getElementById('kpiActiveToday')) document.getElementById('kpiActiveToday').innerText = activeTodayCount.toLocaleString();

    let topA = '-', maxA = 0;
    for (const [k, v] of Object.entries(aiData)) { if (v > maxA) { maxA = v; topA = k; } }
    if(document.getElementById('kpiTopAI')) document.getElementById('kpiTopAI').innerText = topA;

    let topP = '-', maxP = 0;
    for (const [k, v] of Object.entries(parlimenData)) { if (v > maxP) { maxP = v; topP = k; } }
    if(document.getElementById('kpiTopParlimen')) document.getElementById('kpiTopParlimen').innerText = topP;

    renderAllCharts(aiData, parlimenData, roleData);
}

/**
 * Merender atau memusnahkan & merender semula carta visual (Chart.js).
 */
function renderAllCharts(ai, p, r) {
    // Carta Subjek AI (Doughnut)
    const ctxA = document.getElementById('aiChart');
    if (ctxA) {
        if (aiChartInstance) aiChartInstance.destroy();
        aiChartInstance = new Chart(ctxA, {
            type: 'doughnut',
            data: {
                labels: Object.keys(ai),
                datasets: [{ data: Object.values(ai), backgroundColor: ['#ED1C24', '#0033A0', '#FFC20E', '#4F46E5', '#10B981'], borderWidth: 0 }]
            },
            options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 9, weight: '800' } } } }, cutout: '70%' }
        });
    }

    // Carta Parlimen (Bar)
    const ctxP = document.getElementById('parlimenChart');
    if (ctxP) {
        if (parlimenChartInstance) parlimenChartInstance.destroy();
        parlimenChartInstance = new Chart(ctxP, {
            type: 'bar',
            data: {
                labels: Object.keys(p),
                datasets: [{ label: 'Interaksi', data: Object.values(p), backgroundColor: '#0033A0', borderRadius: 10 }]
            },
            options: { maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    // Carta Peranan Pengguna (Pie)
    const ctxU = document.getElementById('userChart');
    if (ctxU) {
        if (userChartInstance) userChartInstance.destroy();
        userChartInstance = new Chart(ctxU, {
            type: 'pie',
            data: {
                labels: Object.keys(r),
                datasets: [{ data: Object.values(r), backgroundColor: ['#3b82f6', '#10b981', '#a855f7', '#f43f5e'] }]
            },
            options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }
}

/**
 * Menapis data berdasarkan input saringan pilihan.
 */
function applyFilters() {
    const pVal = document.getElementById('parlimenFilter')?.value || 'SEMUA';
    const rVal = document.getElementById('roleFilter')?.value || 'SEMUA';
    
    let filtered = globalLogData;
    if (pVal !== 'SEMUA') filtered = filtered.filter(l => l.parlimen === pVal);
    if (rVal !== 'SEMUA') filtered = filtered.filter(l => l.role === rVal);
    
    renderTable(filtered);
}

/**
 * Membina baris jadual secara dinamik (DOM String Template).
 */
function renderTable(data) {
    const tbody = document.getElementById('logTableBody');
    const countEl = document.getElementById('tableRecordCount');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    if (countEl) countEl.innerText = `${data.length} Profil Pengguna Ditemui`;

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-32 text-center text-slate-400 font-black uppercase tracking-widest text-[10px]">Tiada rekod ditemui.</td></tr>';
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    
    data.forEach(log => {
        const isActive = log.last_active && log.last_active.startsWith(todayStr);
        const status = isActive 
            ? '<span class="flex h-3 w-3 relative mx-auto"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>'
            : '<span class="flex h-2.5 w-2.5 rounded-full bg-slate-200 mx-auto border-2 border-slate-300"></span>';

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-all border-b border-slate-100 group">
                <td class="px-10 py-7 text-center">${status}</td>
                <td class="px-10 py-7">
                    <div class="flex flex-col">
                        <span class="font-black text-slate-800 uppercase text-sm">${log.full_name}</span>
                        <span class="text-[10px] text-melaka-blue font-black lowercase">${log.email || '-'}</span>
                    </div>
                </td>
                <td class="px-10 py-7">
                    <span class="px-3 py-1.5 rounded-xl text-[9px] font-black border uppercase tracking-widest ${getRoleColor(log.role)}">${log.role}</span>
                </td>
                <td class="px-10 py-7 max-w-[280px]">
                    <span class="font-bold text-slate-600 truncate block">${log.nama_sekolah}</span>
                </td>
                <td class="px-10 py-7 font-black text-melaka-blue uppercase text-[10px]">${log.parlimen}</td>
                <td class="px-10 py-7 text-center">
                    <span class="bg-slate-100 px-4 py-2 rounded-2xl font-black text-slate-900">${log.total_interactions}</span>
                </td>
                <td class="px-10 py-7 text-center">
                    <button data-user-id="${log.user_id}" class="btn-detail bg-slate-900 hover:bg-melaka-blue text-white text-[10px] font-black px-6 py-3 rounded-2xl transition-all shadow-lg uppercase focus:outline-none">Papar Terperinci</button>
                </td>
            </tr>
        `;
    });
}

/**
 * Membuka tetingkap paparan terperinci profil pengguna (Modal).
 */
function openUserModal(userId) {
    const user = globalLogData.find(u => u.user_id === userId);
    if (!user) return;

    const modal = document.getElementById('userDetailModal');
    const content = document.getElementById('modalContent');
    const clicks = user.item_clicks || {};
    const total = user.total_interactions || 1;

    // Pemformatan Tarikh
    const formatOpt = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    const createdDate = user.created_at ? new Date(user.created_at).toLocaleString('ms-MY', formatOpt) : 'Tiada Rekod';
    const lastActiveDate = user.last_active ? new Date(user.last_active).toLocaleString('ms-MY', formatOpt) : 'Belum Pernah Aktif';
    const lastItemStr = user.last_item ? formatLabel(user.last_item) : 'Tiada';

    // Semakan Status Aktif
    const todayStr = new Date().toISOString().split('T')[0];
    const isActiveToday = user.last_active && user.last_active.startsWith(todayStr);
    const statusBadge = isActiveToday 
        ? '<span class="bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Aktif</span>'
        : '<span class="bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Luar Talian</span>';

    // Pemetaan Ikon untuk Modul AI
    const config = {
        'cikgu_luthfi': { name: 'SAINS', color: 'bg-melaka-red', icon: 'fa-atom' },
        'cikgu_mahfudzah': { name: 'MATEMATIK', color: 'bg-melaka-blue', icon: 'fa-square-root-variable' },
        'tcer_amy': { name: 'SK / RBT', color: 'bg-melaka-yellow', icon: 'fa-laptop-code' },
        'telegram_bot': { name: 'TELEGRAM', color: 'bg-indigo-500', icon: 'fa-telegram' },
        'dashboard_pengguna': { name: 'PORTAL UTAMA', color: 'bg-slate-400', icon: 'fa-house-user' },
    };

    let itemsHTML = '';
    for (const [key, val] of Object.entries(clicks)) {
        if (key === 'homepage') continue;
        const meta = config[key] || { name: key.toUpperCase(), color: 'bg-slate-300', icon: 'fa-mouse-pointer' };
        const perc = Math.round((val / total) * 100);
        itemsHTML += `
            <div class="mb-5 bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-3">
                        <div class="w-6 h-6 rounded-md ${meta.color} flex items-center justify-center text-white"><i class="fas ${meta.icon}"></i></div>
                        ${meta.name}
                    </span>
                    <span class="text-xs font-black text-white">${val} KALI <span class="text-slate-500 text-[10px] ml-1">(${perc}%)</span></span>
                </div>
                <div class="w-full bg-slate-900 rounded-full h-2 p-0.5"><div class="${meta.color} h-full rounded-full transition-all duration-1000" style="width: ${perc}%"></div></div>
            </div>
        `;
    }

    // Suntikan DOM Grid Terperinci
    content.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <!-- KIRI: Maklumat Profil & Institusi -->
            <div class="lg:col-span-3 space-y-6">
                <!-- Kad Profil Pengguna -->
                <div class="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 relative overflow-hidden">
                    <div class="absolute top-0 right-0 p-6">${statusBadge}</div>
                    <div class="flex items-start gap-6">
                        <div class="w-20 h-20 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center text-3xl text-slate-300 shrink-0">
                            <i class="fas fa-user-astronaut"></i>
                        </div>
                        <div class="pt-2">
                            <h2 class="text-2xl font-black text-slate-900 uppercase tracking-tight mb-1">${user.full_name}</h2>
                            <p class="text-xs font-bold text-melaka-blue lowercase mb-4 flex items-center gap-2"><i class="fas fa-envelope text-slate-400"></i> ${user.email}</p>
                            <span class="px-4 py-1.5 rounded-xl text-[10px] font-black border uppercase tracking-widest ${getRoleColor(user.role)}">${user.role}</span>
                        </div>
                    </div>
                    
                    <div class="mt-8 grid grid-cols-2 gap-4 border-t border-slate-200 pt-6">
                        <div>
                            <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Akaun Dicipta</p>
                            <p class="text-xs font-bold text-slate-700">${createdDate}</p>
                        </div>
                        <div>
                            <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Log Masuk Terakhir</p>
                            <p class="text-xs font-bold text-slate-700">${lastActiveDate}</p>
                        </div>
                    </div>
                </div>

                <!-- Kad Institusi Pendidikan -->
                <div class="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative">
                    <h3 class="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3 mb-6">
                        <i class="fas fa-school text-melaka-red text-xl"></i> Pangkalan Institusi
                    </h3>
                    
                    <div class="space-y-5">
                        <div>
                            <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Nama Sekolah / Lokasi</p>
                            <p class="text-sm font-bold text-slate-800 uppercase">${user.nama_sekolah}</p>
                        </div>
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Kod Sekolah</p>
                                <p class="text-xs font-bold text-slate-800">${user.kod_sekolah || 'N/A'}</p>
                            </div>
                            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Zon Daerah</p>
                                <p class="text-xs font-bold text-slate-800 uppercase">${user.daerah}</p>
                            </div>
                            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Parlimen</p>
                                <p class="text-xs font-bold text-melaka-blue uppercase">${user.parlimen}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- KANAN: Analitik & Metrik AI -->
            <div class="lg:col-span-2 bg-slate-900 rounded-[2rem] p-8 relative overflow-hidden shadow-xl flex flex-col">
                <div class="absolute top-0 right-0 w-48 h-48 bg-melaka-blue/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                
                <h3 class="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3 mb-8 relative z-10">
                    <i class="fas fa-radar text-melaka-yellow text-xl"></i> Radar Interaksi
                </h3>

                <div class="mb-8 relative z-10 text-center bg-slate-800/50 py-6 rounded-2xl border border-slate-700">
                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Jumlah Akses Sistem</p>
                    <p class="text-5xl font-black text-white tracking-tighter">${total}</p>
                </div>

                <div class="flex-grow space-y-2 relative z-10 overflow-y-auto pr-2 custom-scrollbar-dark">
                    ${itemsHTML || '<p class="text-xs text-slate-500 text-center mt-10 font-bold uppercase tracking-widest">Tiada Rekod Interaksi Ditemui</p>'}
                </div>

                <div class="mt-6 pt-6 border-t border-slate-700 relative z-10">
                    <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Modul Terakhir Disentuh</p>
                    <p class="text-xs font-bold text-melaka-yellow uppercase"><i class="fas fa-history mr-2"></i> ${lastItemStr}</p>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

/**
 * Menutup tetingkap modal terperinci.
 */
function closeModal() { 
    document.getElementById('userDetailModal')?.classList.add('hidden'); 
}

/**
 * Menjana dan memuat turun fail format CSV berdasarkan data yang sedang ditapis.
 */
function downloadCSV() {
    if (globalLogData.length === 0) return;
    let csv = "Tarikh Dicipta,Log Terakhir,Nama,Emel,Kumpulan,Parlimen,Daerah,Sekolah,Nama PGB,No Tel PGB,Interaksi\n";
    globalLogData.forEach(l => {
        const created = l.created_at ? l.created_at.split('T')[0] : 'N/A';
        const row = [
            created,
            l.last_active, 
            `"${l.full_name}"`, 
            l.email, 
            l.role, 
            l.parlimen, 
            l.daerah,
            `"${l.nama_sekolah}"`, 
            `"${l.nama_pgb}"`,
            l.no_telefon_pgb,
            l.total_interactions
        ].join(",");
        csv += row + "\n";
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute('download', `Analitik_Terperinci_Heutagogi.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * FUNGSI BANTUAN (Helpers)
 */

function getRoleColor(role) {
    const m = {
        'MURID': 'bg-blue-50 text-blue-700 border-blue-100',
        'GURU': 'bg-emerald-50 text-emerald-700 border-emerald-100',
        'IBU BAPA': 'bg-purple-50 text-purple-700 border-purple-100',
        'SUPER ADMIN': 'bg-rose-50 text-rose-700 border-rose-100'
    };
    return m[role] || 'bg-slate-50 text-slate-400 border-slate-100';
}

function formatLabel(id) {
    const m = { 'cikgu_luthfi': 'SAINS', 'cikgu_mahfudzah': 'MATEMATIK', 'tcer_amy': 'SK / RBT', 'telegram_bot': 'TELEGRAM BOT', 'dashboard_pengguna': 'PORTAL UTAMA' };
    return m[id] || id.toUpperCase();
}

function toggleLoading(show, text) {
    const el = document.getElementById('loadingOverlay');
    if (!el) return;
    if (text) {
        const textEl = document.getElementById('loadingText');
        if (textEl) textEl.innerText = text;
    }
    if (show) { 
        el.classList.remove('hidden'); 
        setTimeout(() => el.classList.remove('opacity-0'), 10); 
    } else { 
        el.classList.add('opacity-0'); 
        setTimeout(() => el.classList.add('hidden'), 500); 
    }
}

/**
 * FUNGSI LOG KELUAR PENTADBIR
 */
function handleAdminLogout() {
    Swal.fire({
        title: 'Keluar Sistem?',
        text: "Sesi pentadbir anda akan ditamatkan.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ED1C24',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Ya, Keluar',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            sessionStorage.clear();
            window.location.replace('index.html');
        }
    });
}