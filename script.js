// Supabase Configuration
const SUPABASE_URL = 'https://kerzplsnuqgwgpkyukiy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlcnpwbHNudXFnd2dwa3l1a2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NTE2ODIsImV4cCI6MjA4MzUyNzY4Mn0.VSF33LFe2OwGB4l62mKUbiy6q37kb7TwcCqcMp_fXbU';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Management
let currentPage = 0;
const PAGE_SIZE = 12;
let isLoading = false;
let currentUsername = localStorage.getItem('hub_username');

// Elements
const scriptFeed = document.getElementById('script-feed');
const loadMoreBtn = document.getElementById('load-more');
const uploadTrigger = document.getElementById('upload-trigger');
const uploadModal = document.getElementById('upload-modal');
const detailModal = document.getElementById('detail-modal');
const uploadForm = document.getElementById('upload-form');
const userInfo = document.getElementById('user-info');
const displayUsername = document.getElementById('display-username');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadScripts();
    setupNavigation();
    setupModals();
    checkUserIdentity();
});

// User Identity Logic
function checkUserIdentity() {
    if (currentUsername) {
        userInfo.classList.remove('hidden');
        displayUsername.textContent = `@${currentUsername}`;
        document.getElementById('username-input').value = currentUsername;
    }
}

// Data Fetching
async function loadScripts(append = false) {
    if (isLoading) return;
    isLoading = true;
    loadMoreBtn.textContent = 'Loading...';

    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
        const { data, error } = await supabaseClient
            .from('scripts')
            .select('*')
            .order('views', { ascending: false })
            .range(from, to);

        if (error) throw error;

        if (data.length < PAGE_SIZE) {
            loadMoreBtn.classList.add('hidden');
        } else {
            loadMoreBtn.classList.remove('hidden');
        }

        renderScripts(data, append);
        currentPage++;
    } catch (err) {
        console.error('Error loading scripts:', err);
    } finally {
        isLoading = false;
        loadMoreBtn.textContent = 'More Scripts';
    }
}

function renderScripts(scripts, append) {
    if (!append) scriptFeed.innerHTML = '';

    scripts.forEach(script => {
        const card = document.createElement('div');
        card.className = 'script-card glass';
        card.innerHTML = `
            <span class="tag">${script.game}</span>
            <h3>${script.title}</h3>
            <p>${script.description || 'No description provided.'}</p>
            <div class="card-footer">
                <span class="uploader">@${script.username}</span>
                <span>👁️ ${script.views}</span>
            </div>
        `;
        card.onclick = () => showScriptDetail(script);
        scriptFeed.appendChild(card);
    });
}

// Script Detail
async function showScriptDetail(script) {
    document.getElementById('detail-title').textContent = script.title;
    document.getElementById('detail-game').textContent = script.game;
    document.getElementById('detail-user').textContent = `By: @${script.username}`;
    document.getElementById('detail-views').textContent = `👁️ ${script.views + 1} views`;
    document.getElementById('detail-desc').textContent = script.description;

    const codeElem = document.getElementById('detail-code');
    codeElem.textContent = script.script_code;

    detailModal.classList.remove('hidden');

    // Increment views in background
    await supabaseClient
        .from('scripts')
        .update({ views: script.views + 1 })
        .eq('id', script.id);
}

// Navigation
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const target = link.getAttribute('href').substring(1);
            document.getElementById('scripts').classList.toggle('hidden', target !== 'scripts');
            document.getElementById('executors').classList.toggle('hidden', target !== 'executors');
            document.getElementById('hero').classList.toggle('hidden', target !== 'scripts');
        };
    });
}

// Modals Setup
function setupModals() {
    uploadTrigger.onclick = () => uploadModal.classList.remove('hidden');

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => {
            uploadModal.classList.add('hidden');
            detailModal.classList.add('hidden');
        };
    });

    window.onclick = (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            uploadModal.classList.add('hidden');
            detailModal.classList.add('hidden');
        }
    };

    uploadForm.onsubmit = handleUpload;

    document.getElementById('copy-script').onclick = () => {
        const code = document.getElementById('detail-code').textContent;
        navigator.clipboard.writeText(code);
        const btn = document.getElementById('copy-script');
        btn.textContent = 'Copied! ✅';
        setTimeout(() => btn.textContent = 'Copy Code', 2000);
    };
}

// Upload Logic
async function handleUpload(e) {
    e.preventDefault();
    const btn = uploadForm.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = 'Publishing...';
    btn.disabled = true;

    const username = document.getElementById('username-input').value.trim();
    const title = document.getElementById('script-title').value.trim();
    const game = document.getElementById('game-name').value.trim();
    const description = document.getElementById('script-desc').value.trim();
    const script_code = document.getElementById('script-code').value.trim();

    try {
        // 1. Ensure user exists
        const { data: user, error: userError } = await supabaseClient
            .from('users')
            .select('username')
            .eq('username', username)
            .single();

        if (userError && userError.code !== 'PGRST116') throw userError;

        if (!user) {
            // Create user
            const { error: insertError } = await supabaseClient
                .from('users')
                .insert({ username });
            if (insertError) throw insertError;
        }

        // 2. Upload script
        const { error: scriptError } = await supabaseClient
            .from('scripts')
            .insert({
                title,
                game,
                description,
                script_code,
                username,
                views: 0
            });

        if (scriptError) throw scriptError;

        // Success
        localStorage.setItem('hub_username', username);
        currentUsername = username;
        checkUserIdentity();
        uploadModal.classList.add('hidden');
        uploadForm.reset();

        // Refresh feed
        currentPage = 0;
        loadScripts();
        alert('Script published successfully! 🚀');

    } catch (err) {
        console.error('Upload error:', err);
        alert('Error publishing script. Please try again.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Load More handler
loadMoreBtn.onclick = () => loadScripts(true);
