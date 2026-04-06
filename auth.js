/**
 * HEUTAGOGI@TEAM_MELAKA - Enjin Logik Pengesahan Utama
 * Fail ini mengendalikan log masuk, pendaftaran, pemuatan senarai sekolah,
 * serta logik proksi (proxy logic) bagi pengguna luar Negeri Melaka.
 * Bergantung kepada: supabaseClient.js (diisytihar sebelumnya dalam HTML)
 * Versi: 2.2.0 (Penambahbaikan: Sistem Proksi Pengguna Luar)
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
        return; 
    }

    // 2. Pengikat Acara (Event Listeners Binding)
    document.getElementById('tabLogin')?.addEventListener('click', () => toggleForm('login'));
    document.getElementById('tabRegister')?.addEventListener('click', () => toggleForm('register'));
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
    
    // Penukaran teks ke huruf besar secara automatik untuk input nama
    const regNameInput = document.getElementById('regName');
    if (regNameInput) {
        regNameInput.addEventListener('input', function() {
            this.value = this.value.toUpperCase();
        });
    }

    // Pendengar Acara Khas: Togol Pengguna Luar Melaka
    const checkboxLuarMelaka = document.getElementById('checkboxLuarMelaka');
    const schoolInputContainer = document.getElementById('schoolInputContainer');
    const regSchool = document.getElementById('regSchool');

    if (checkboxLuarMelaka && schoolInputContainer && regSchool) {
        checkboxLuarMelaka.addEventListener('change', function() {
            if (this.checked) {
                // Mod Proksi: Sembunyikan & nyahaktifkan mandatori sekolah
                schoolInputContainer.classList.add('opacity-40', 'pointer-events-none');
                regSchool.removeAttribute('required');
                regSchool.value = ''; // Kosongkan nilai untuk elak konflik
            } else {
                // Mod Normal: Tunjukkan & wajibkan carian sekolah
                schoolInputContainer.classList.remove('opacity-40', 'pointer-events-none');
                regSchool.setAttribute('required', 'true');
            }
        });
    }

    // 3. Pemuatan Data Permulaan (Termasuk PPD)
    await fetchSchools();
});

/**
 * Menarik senarai sekolah dan institusi dari pangkalan data Supabase
 */
async function fetchSchools() {
    try {
        const { data, error } = await supabaseClient
            .from('smpid_sekolah_data')
            .select('kod_sekolah, nama_sekolah, jenis_sekolah')
            .order('nama_sekolah', { ascending: true });

        if (error) throw error;

        schoolDatabase = data;
        const datalist = document.getElementById('schoolList');
        if (datalist) {
            datalist.innerHTML = data.map(s => `<option value="${s.nama_sekolah}">${s.kod_sekolah}</option>`).join('');
        }
    } catch (err) {
        console.error('Gagal memuatkan senarai institusi:', err);
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
        loginForm?.classList.remove('hidden');
        registerForm?.classList.add('hidden');
        if (tabLogin) tabLogin.className = "flex-1 py-4 text-sm font-bold text-melaka-blue bg-white border-b-2 border-melaka-blue transition-colors focus:outline-none";
        if (tabRegister) tabRegister.className = "flex-1 py-4 text-sm font-bold text-slate-400 hover:text-slate-600 bg-slate-50 transition-colors focus:outline-none";
    } else {
        loginForm?.classList.add('hidden');
        registerForm?.classList.remove('hidden');
        if (tabRegister) tabRegister.className = "flex-1 py-4 text-sm font-bold text-melaka-red bg-white border-b-2 border-melaka-red transition-colors focus:outline-none";
        if (tabLogin) tabLogin.className = "flex-1 py-4 text-sm font-bold text-slate-400 hover:text-slate-600 bg-slate-50 transition-colors focus:outline-none";
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
        el?.classList.remove('hidden');
    } else {
        el?.classList.add('hidden');
    }
}

/**
 * Mengendalikan proses log masuk pengguna
 */
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
    const password = document.getElementById('loginPassword')?.value;

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
 * Mengendalikan proses pendaftaran akaun baharu (Dengan Sokongan Proksi)
 */
async function handleRegister(e) {
    e.preventDefault();
    const fullName = document.getElementById('regName')?.value.trim().toUpperCase();
    const role = document.getElementById('regRole')?.value;
    const email = document.getElementById('regEmail')?.value.trim().toLowerCase();
    const password = document.getElementById('regPassword')?.value;
    
    // Status Togol Proksi
    const isLuarMelaka = document.getElementById('checkboxLuarMelaka')?.checked;
    let finalKodSekolah = '';

    // Logik Cabang: Validasi berdasarkan kawasan
    if (isLuarMelaka) {
        // PINTASAN KETAT: Bypass pangkalan data sekolah, gunakan proksi kod 'LUAR_MELAKA'
        finalKodSekolah = 'LUAR_MELAKA';
        // Pengecualian domain emel dibenarkan untuk luar Melaka (tiada blok @moe-dl.edu.my)
    } else {
        // ALIRAN NORMAL: Validasi Pangkalan Data Institusi Melaka
        const schoolName = document.getElementById('regSchool')?.value.trim();
        const schoolObj = schoolDatabase.find(s => s.nama_sekolah === schoolName);
        
        if (!schoolObj) {
            Swal.fire('Ralat Institusi', 'Sila pilih nama sekolah atau PPD yang sah dari senarai cadangan.', 'warning');
            return;
        }
        
        finalKodSekolah = schoolObj.kod_sekolah;

        // Validasi Domain Emel Mengikut Kumpulan Khusus di Melaka
        if ((role === 'MURID' || role === 'GURU') && !email.endsWith('@moe-dl.edu.my')) {
            Swal.fire('Ralat Emel', `Pengguna ${role} KPM wajib menggunakan emel @moe-dl.edu.my. Sila tandakan kotak "Luar Melaka" jika anda bukan dari KPM Melaka.`, 'error');
            return;
        } else if (role === 'IBU BAPA' && !email.endsWith('@gmail.com')) {
            Swal.fire('Ralat Emel', 'Kumpulan IBU BAPA wajib menggunakan emel @gmail.com.', 'error');
            return;
        }
    }

    toggleLoading(true, 'Mendaftarkan Akaun...');

    try {
        // Semakan Emel Sedia Ada (Halang Duplikasi)
        const { data: existingUser } = await supabaseClient
            .from('heuta_users')
            .select('id')
            .eq('email', email)
            .maybeSingle();
            
        if (existingUser) throw new Error('Alamat emel ini telah didaftarkan dalam sistem kami.');

        // Pendaftaran Rekod Baharu
        const { error: insertError } = await supabaseClient.from('heuta_users').insert([{ 
            full_name: fullName, 
            role: role, 
            email: email, 
            password: password,
            kod_sekolah: finalKodSekolah
        }]);

        if (insertError) throw insertError;

        Swal.fire({
            icon: 'success',
            title: 'Pendaftaran Berjaya!',
            text: isLuarMelaka ? 'Akaun (Luar Melaka) anda telah diaktifkan. Sila log masuk.' : 'Akaun anda telah diaktifkan. Sila log masuk.',
            confirmButtonColor: '#0033A0'
        }).then(() => {
            document.getElementById('registerForm')?.reset();
            // Reset state input jika proksi aktif sebelumnya
            document.getElementById('schoolInputContainer')?.classList.remove('opacity-40', 'pointer-events-none');
            document.getElementById('regSchool')?.setAttribute('required', 'true');
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