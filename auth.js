/**
 * HEUTAGOGI@TEAM_MELAKA - Enjin Logik Pengesahan Utama
 * Fail ini mengendalikan log masuk, pendaftaran, dan pemuatan senarai sekolah.
 * Bergantung kepada: supabaseClient.js (diisytihar sebelumnya dalam HTML)
 */

let schoolDatabase = [];

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Kawalan Akses Sesi (Gatekeeper)
    const currentUserId = sessionStorage.getItem('heuta_user_id');
    const currentUserRole = sessionStorage.getItem('heuta_user_role');
    
    if (currentUserId) {
        if (currentUserRole === 'SUPER ADMIN') {
            window.location.replace('admin_heuta.html');
        } else {
            window.location.replace('dashboard_pengguna.html');
        }
        return; // Hentikan perlaksanaan skrip jika pengguna sudah log masuk
    }

    // 2. Pengikat Acara (Event Listeners Binding)
    document.getElementById('tabLogin').addEventListener('click', () => toggleForm('login'));
    document.getElementById('tabRegister').addEventListener('click', () => toggleForm('register'));
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    
    // Penukaran teks ke huruf besar secara automatik untuk input nama
    const regNameInput = document.getElementById('regName');
    if (regNameInput) {
        regNameInput.addEventListener('input', function() {
            this.value = this.value.toUpperCase();
        });
    }

    // 3. Pemuatan Data Permulaan
    await fetchSchools();
});

/**
 * Menarik senarai sekolah dari pangkalan data Supabase
 * Mengabaikan rekod yang mengandungi 'PPD'
 */
async function fetchSchools() {
    try {
        const { data, error } = await supabaseClient
            .from('smpid_sekolah_data')
            .select('kod_sekolah, nama_sekolah, jenis_sekolah')
            .not('jenis_sekolah', 'ilike', '%PPD%')
            .order('nama_sekolah', { ascending: true });

        if (error) throw error;

        schoolDatabase = data;
        const datalist = document.getElementById('schoolList');
        if (datalist) {
            datalist.innerHTML = data.map(s => `<option value="${s.nama_sekolah}">${s.kod_sekolah}</option>`).join('');
        }
    } catch (err) {
        console.error('Gagal memuatkan senarai sekolah:', err);
    }
}

/**
 * Mengawal paparan tab Log Masuk dan Daftar
 */
function toggleForm(formType) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');

    if (formType === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabLogin.className = "flex-1 py-4 text-sm font-bold text-melaka-blue bg-white border-b-2 border-melaka-blue transition-colors focus:outline-none";
        tabRegister.className = "flex-1 py-4 text-sm font-bold text-slate-400 hover:text-slate-600 bg-slate-50 transition-colors focus:outline-none";
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabRegister.className = "flex-1 py-4 text-sm font-bold text-melaka-red bg-white border-b-2 border-melaka-red transition-colors focus:outline-none";
        tabLogin.className = "flex-1 py-4 text-sm font-bold text-slate-400 hover:text-slate-600 bg-slate-50 transition-colors focus:outline-none";
    }
}

/**
 * Mengawal tindanan pemuatan (Loading Overlay)
 */
function toggleLoading(show, text = 'Sedang Memproses...') {
    const el = document.getElementById('loadingOverlay');
    const textEl = document.getElementById('loadingText');
    
    if (textEl) textEl.innerText = text;
    
    if (show) {
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

/**
 * Mengendalikan proses log masuk pengguna
 */
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    toggleLoading(true, 'Mengesahkan Kredensial...');

    try {
        const { data: user, error } = await supabaseClient
            .from('heuta_users')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .single();

        if (error || !user) throw new Error('Emel atau kata laluan tidak tepat.');

        // Mewujudkan Sesi Tempatan (Local Session)
        sessionStorage.setItem('heuta_user_id', user.id);
        sessionStorage.setItem('heuta_user_email', user.email);
        sessionStorage.setItem('heuta_user_name', user.full_name);
        sessionStorage.setItem('heuta_user_role', user.role);

        Swal.fire({
            icon: 'success',
            title: 'Log Masuk Berjaya!',
            text: `Selamat kembali, ${user.full_name}`,
            showConfirmButton: false,
            timer: 1500
        }).then(() => {
            if (user.role === 'SUPER ADMIN') {
                window.location.href = 'admin_heuta.html';
            } else {
                window.location.href = 'dashboard_pengguna.html';
            }
        });
    } catch (err) {
        Swal.fire({ 
            icon: 'error', 
            title: 'Akses Ditolak', 
            text: err.message, 
            confirmButtonColor: '#ED1C24' 
        });
    } finally {
        toggleLoading(false);
    }
}

/**
 * Mengendalikan proses pendaftaran akaun baharu
 */
async function handleRegister(e) {
    e.preventDefault();
    const fullName = document.getElementById('regName').value.trim().toUpperCase();
    const schoolName = document.getElementById('regSchool').value.trim();
    const role = document.getElementById('regRole').value;
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;

    // Validasi Pilihan Sekolah
    const schoolObj = schoolDatabase.find(s => s.nama_sekolah === schoolName);
    if (!schoolObj) {
        Swal.fire('Ralat Sekolah', 'Sila pilih nama sekolah yang sah dari senarai cadangan.', 'warning');
        return;
    }

    // Validasi Domain Emel Mengikut Kumpulan
    if ((role === 'MURID' || role === 'GURU') && !email.endsWith('@moe-dl.edu.my')) {
        Swal.fire('Ralat Emel', `Kumpulan ${role} wajib menggunakan emel @moe-dl.edu.my.`, 'error');
        return;
    } else if (role === 'IBU BAPA' && !email.endsWith('@gmail.com')) {
        Swal.fire('Ralat Emel', 'Kumpulan IBU BAPA wajib menggunakan emel @gmail.com.', 'error');
        return;
    }

    toggleLoading(true, 'Mendaftarkan Akaun...');

    try {
        // Semakan Emel Sedia Ada
        const { data: existingUser } = await supabaseClient
            .from('heuta_users')
            .select('id')
            .eq('email', email)
            .maybeSingle();
            
        if (existingUser) throw new Error('Alamat emel ini telah didaftarkan.');

        // Pendaftaran Rekod Baharu
        const { error: insertError } = await supabaseClient.from('heuta_users').insert([{ 
            full_name: fullName, 
            role: role, 
            email: email, 
            password: password,
            kod_sekolah: schoolObj.kod_sekolah
        }]);

        if (insertError) throw insertError;

        Swal.fire({
            icon: 'success',
            title: 'Pendaftaran Berjaya!',
            text: 'Akaun telah diaktifkan. Sila log masuk.',
            confirmButtonColor: '#0033A0'
        }).then(() => {
            document.getElementById('registerForm').reset();
            toggleForm('login');
        });
    } catch (err) {
        Swal.fire({ 
            icon: 'warning', 
            title: 'Pendaftaran Gagal', 
            text: err.message, 
            confirmButtonColor: '#ED1C24' 
        });
    } finally {
        toggleLoading(false);
    }
}