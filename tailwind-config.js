/**
 * HEUTAGOGI@TEAM_MELAKA - Konfigurasi Tema Utama (Tailwind CSS)
 * Fail ini mendefinisikan palet warna korporat dan fon piawai sistem.
 * Mesti dimuatkan selepas skrip CDN Tailwind.
 */

tailwind.config = {
    theme: {
        extend: {
            // Penetapan fon piawai kepada Poppins
            fontFamily: { 
                sans: ['Poppins', 'sans-serif'] 
            },
            // Palet Warna Rasmi Melaka: Integriti, Kecekapan, Inovasi
            colors: {
                melaka: {
                    red: '#ED1C24',
                    yellow: '#FFC20E',
                    blue: '#0033A0',
                    light: '#F8FAFC',
                    dark: '#0F172A'
                }
            }
        }
    }
}