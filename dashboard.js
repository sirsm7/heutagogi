/**
 * HEUTAGOGI@TEAM_MELAKA - Enjin Logik Papan Pemuka & Analitik
 * Mengendalikan sesi pengguna, pembalakan (logging) analitik, dan log keluar.
 * Bergantung kepada: supabaseClient.js (perlu dimuatkan terlebih dahulu)
 */

let sessionUserId = null;

document.addEventListener("DOMContentLoaded", () => {
    sessionUserId = sessionStorage.getItem('heuta_user_id');
    const sessionUserName = sessionStorage.getItem('heuta_user_name');
    const sessionUserRole = sessionStorage.getItem('heuta_user_role');

    // 1. Gatekeeper: Tendang keluar jika tiada sesi
    if (!sessionUserId) {
        window.location.replace('index.html');
        return;
    }

    // 2. Gatekeeper Sekuriti Ketat: Halang SUPER ADMIN dari mengakses laman ini
    if (sessionUserRole === 'SUPER ADMIN') {
        window.location.replace('admin_heuta.html');
        return;
    }

    // 3. Kemaskini Profil di Header
    if (sessionUserName) {
        const nameEl = document.getElementById('displayUserName');
        if (nameEl) nameEl.innerText = sessionUserName;
    }
    if (sessionUserRole) {
        const roleEl = document.getElementById('displayUserRole');
        if (roleEl) roleEl.innerText = `KUMPULAN: ${sessionUserRole}`;
    }

    // 4. Merekodkan lawatan (Page View) ke dalam jadual
    trackEvent('dashboard_pengguna');

    // 5. Mengikat acara klik untuk modul AI (Analitik)
    // Menangkap klik pada semua pautan yang mempunyai kelas 'bot-link'
    const botLinks = document.querySelectorAll('.bot-link');
    botLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const botId = e.currentTarget.getAttribute('data-bot-id');
            if (botId) trackEvent(botId);
        });
    });

    // 6. Mengikat acara butang Log Keluar
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', handleLogout);
    }
});

/**
 * FUNGSI ANALITIK BERIDENTITI (SINGLE-ROW UPSERT LOGIC)
 * Merekodkan jumlah interaksi dan modul terakhir yang digunakan ke pangkalan data.
 * @param {string} itemId - ID atau nama modul yang diklik
 */
async function trackEvent(itemId) {
    if (!sessionUserId) return;
    try {
        // Langkah 1: Semak jika pengguna ini sudah mempunyai baris rekod (Row)
        const { data, error } = await supabaseClient
            .from('heuta_analytics')
            .select('*')
            .eq('user_id', sessionUserId)
            .maybeSingle();

        if (error) {
            console.error('Ralat carian pangkalan data:', error);
            return;
        }

        if (data) {
            // Langkah 2: Jika wujud, ekstrak laci JSONB dan tambah nilai klik untuk item ini
            let currentClicks = data.item_clicks || {};
            currentClicks[itemId] = (currentClicks[itemId] || 0) + 1;

            // Kemas kini keseluruhan baris
            await supabaseClient
                .from('heuta_analytics')
                .update({ 
                    total_interactions: data.total_interactions + 1,
                    item_clicks: currentClicks,
                    last_item: itemId,
                    last_active: new Date().toISOString()
                })
                .eq('user_id', sessionUserId);
        } else {
            // Langkah 3: Jika belum wujud, cipta baris mutlak pertama untuk pengguna ini
            let initialClicks = {};
            initialClicks[itemId] = 1;

            await supabaseClient.from('heuta_analytics').insert([{ 
                user_id: sessionUserId,
                total_interactions: 1,
                item_clicks: initialClicks,
                last_item: itemId
            }]);
        }
    } catch (error) {
        console.error('Ralat merekod data analitik V2:', error);
    }
}

/**
 * FUNGSI LOG KELUAR
 * Memaparkan dialog pengesahan, memadam sesi tempatan, dan membawa pengguna ke halaman utama.
 */
function handleLogout() {
    Swal.fire({
        title: 'Log Keluar?',
        text: "Sesi pembelajaran anda akan ditamatkan.",
        icon: 'question',
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