let selectedFiles = [];
const userId = getUserId();

// Inisialisasi
document.addEventListener('DOMContentLoaded', () => {
    updateStats();
    loadHistory();
});

function getUserId() {
    let id = localStorage.getItem('neo_user_id');
    if (!id) {
        id = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('neo_user_id', id);
    }
    return id;
}

// Format Ukuran File
function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Drag & Drop
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.onclick = () => fileInput.click();

dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.background = '#eee'; };
dropZone.ondragleave = () => { dropZone.style.background = 'transparent'; };
dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.style.background = 'transparent';
    handleFiles(e.dataTransfer.files);
};

fileInput.onchange = (e) => handleFiles(e.target.files);

function handleFiles(files) {
    selectedFiles = Array.from(files);
    if (selectedFiles.length > 0) {
        document.getElementById('preview-container').classList.remove('hidden');
        renderPreview();
    }
}

function renderPreview() {
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <div class="file-info">
                <h4>${file.name}</h4>
                <small>${formatSize(file.size)}</small>
            </div>
            <button class="btn" style="padding:5px 10px" onclick="removeFile(${index})">X</button>
        `;
        list.appendChild(item);
    });
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    if (selectedFiles.length === 0) document.getElementById('preview-container').classList.add('hidden');
    renderPreview();
}

// Upload Logic
document.getElementById('upload-btn').onclick = async () => {
    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('files', file));

    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    progressContainer.classList.remove('hidden');
    document.getElementById('upload-btn').disabled = true;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);
    xhr.setRequestHeader('x-user-id', userId);

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressFill.style.width = percent + '%';
            progressText.innerText = percent + '%';
        }
    };

    xhr.onload = function() {
        const res = JSON.parse(xhr.responseText);
        if (res.success) {
            showResults(res.files);
            updateStats();
            loadHistory();
            document.getElementById('preview-container').classList.add('hidden');
            selectedFiles = [];
        } else {
            alert('Error: ' + res.message);
        }
        progressContainer.classList.add('hidden');
        document.getElementById('upload-btn').disabled = false;
    };

    xhr.send(formData);
};

function showResults(files) {
    const container = document.getElementById('result-container');
    const list = document.getElementById('result-list');
    container.classList.remove('hidden');
    list.innerHTML = '';

    files.forEach(file => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.style.background = '#e7ffeb';
        div.innerHTML = `
            <div class="file-info">
                <h4>${file.savedName}</h4>
                <input type="text" value="${file.url}" readonly style="width:100%; margin-top:5px; border:1px solid #000; padding:3px">
            </div>
            <div style="display:flex; gap:5px">
                <button class="btn btn-secondary" style="padding:5px" onclick="copyToClipboard('${file.url}')">Copy</button>
                <a href="${file.url}" target="_blank" class="btn btn-primary" style="padding:5px">Open</a>
            </div>
        `;
        list.appendChild(div);
    });
}

async function updateStats() {
    const res = await fetch('/api/stats');
    const data = await res.json();
    document.getElementById('stat-count').innerText = data.totalFiles;
    document.getElementById('stat-size').innerText = formatSize(data.totalSize);
}

async function loadHistory() {
    const res = await fetch(`/api/my-files?userId=${userId}`);
    const files = await res.json();
    const list = document.getElementById('history-list');
    
    if (files.length === 0) return;
    
    list.innerHTML = '';
    files.forEach(file => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.onclick = () => div.classList.toggle('active');
        div.innerHTML = `
            <strong>${file.originalName}</strong>
            <div class="history-detail">
                <p><small>Saved as: ${file.savedName}</small></p>
                <p><small>Size: ${formatSize(file.size)}</small></p>
                <p><small>Date: ${new Date(file.uploadedAt).toLocaleString()}</small></p>
                <div style="margin-top:10px; display:flex; gap:5px">
                    <button class="btn btn-secondary" style="padding:2px 5px; font-size:10px" onclick="event.stopPropagation(); copyToClipboard('${file.url}')">Copy Link</button>
                    <a href="${file.url}" target="_blank" class="btn btn-primary" style="padding:2px 5px; font-size:10px" onclick="event.stopPropagation()">Open</a>
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert('Link copied to clipboard!');
}
