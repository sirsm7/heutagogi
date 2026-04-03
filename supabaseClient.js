/**
 * HEUTAGOGI@TEAM_MELAKA - Jambatan Data Backend (Supabase)
 * Modul ini menginisialisasi sambungan global ke pangkalan data.
 * Memerlukan: CDN Supabase JS dimuatkan terlebih dahulu dalam HTML.
 */

const supabaseUrl = 'https://app.tech4ag.my';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY';

// Mengeksport klien ke ruang lingkup global agar dapat diakses secara langsung oleh skrip luaran lain seperti auth.js
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);